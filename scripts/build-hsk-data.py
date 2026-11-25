"""Build HSK 1-9 per-level JSON chunks (hsk-1..6, hsk-7-9) + search-index.json + vocab-meta.json."""
import ast
import csv
import glob
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get("HSK6_CACHE_DIR", r"D:\AI\Antigravity\work\hsk6-cache")
OUT_DIR = os.path.join(ROOT, "public", "data", "vocab")
LESSONS_DIR = os.path.join(ROOT, "public", "data", "lessons")

EXTRA_HV = {
    "词": "từ", "岛": "đảo", "鹅": "nga", "离": "ly", "却": "khước", "驮": "đà", "钻": "toàn",
}

EXTRA_VI = {
    "不肯": "không chịu, từ chối",
    "不利于": "bất lợi cho, có hại cho",
    "不难": "không khó",
    "不如说": "chi bằng nói là, đúng hơn là",
    "不太": "không quá, không lắm",
    "不一会儿": "chẳng mấy chốc, một lát sau",
    "不予": "không cấp, từ chối",
    "车上": "trên xe",
    "趁着": "nhân lúc, thừa cơ",
    "城里": "trong thành phố",
    "打篮球": "chơi bóng rổ",
    "定为": "quy định là, chọn làm",
    "放到": "đặt vào, để vào",
    "飞往": "bay tới, bay đi",
    "公益性": "tính công ích",
    "很难说": "khó nói, khó đoán",
    "怀着": "ôm ấp, mang trong lòng",
    "见过": "từng gặp, đã thấy",
    "难以想象": "khó tưởng tượng nổi",
    "能不能": "có thể ... không",
    "纽扣儿": "cúc áo, khuy áo",
    "说起来": "nói ra thì, nhắc tới",
    "送到": "đưa tới, gửi tới",
    "系领带": "thắt cà vạt",
    "眼里": "trong mắt",
    "一番": "một phen, một hồi",
    "有劲儿": "có sức, hăng hái",
    "这时候": "lúc này, giờ đây",
    "着眼于": "chú trọng vào, hướng tới",
    "指着": "chỉ vào",
    "致力于": "dốc sức vào, cống hiến cho",
}

POS_MAP = {
    "n": "dt.", "v": "đgt.", "a": "tt.", "d": "phó.", "r": "đt.",
    "p": "giới.", "c": "liên.", "q": "lượng.", "u": "trợ.", "e": "thán.",
    "m": "số.", "t": "dt. thời gian", "s": "dt. nơi chốn", "f": "phương vị",
    "vn": "đgt./dt.", "an": "tt./dt.", "ad": "tt./phó.", "b": "tính từ định ngữ",
    "l": "quán dụng ngữ", "i": "thành ngữ", "g": "tố từ", "z": "trạng thái",
    "nr": "tên riêng", "ns": "địa danh", "nt": "cơ quan",
}

CHUNK_KEYS = ["hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9"]


def strip_tones(py: str) -> str:
    s = unicodedata.normalize("NFD", py)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("ü", "u").replace("Ü", "u").replace("u:", "u")
    return re.sub(r"[^a-zA-Z]", "", s).lower()


def pick_hsk_level(levels: list[str]) -> tuple[int, str, str]:
    """Use HSK 3.0 (n1..n7) primary level, falling back to HSK 2.0 (o1..o6)."""
    ns = sorted(int(x[1:]) for x in levels if x.startswith("n") and x[1:].isdigit())
    os_ = sorted(int(x[1:]) for x in levels if x.startswith("o") and x[1:].isdigit())
    lvl_num = ns[0] if ns else (os_[0] if os_ else 7)
    if 1 <= lvl_num <= 6:
        return lvl_num, f"HSK{lvl_num}", f"hsk-{lvl_num}"
    return 7, "HSK7-9", "hsk-7-9"


def load_cvdict(path: str):
    cv: dict[str, list[tuple[str, bool, list[str]]]] = {}
    s2t: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$", line)
            if not m:
                continue
            trad, simp, py_raw, mean = m.groups()
            if len(trad) == len(simp):
                for sc, tc in zip(simp, trad):
                    if sc != tc and "\u4e00" <= sc <= "\u9fff":
                        s2t.setdefault(sc, tc)
            is_upper = bool(py_raw) and py_raw[0].isupper()
            py_norm = py_raw.lower().replace(" ", "").replace("u:", "v")
            ms = [x.strip() for x in mean.split("/") if x.strip() and not x.strip().startswith(("CL:", "xem ", "biến thể"))]
            if not ms:
                ms = [x.strip() for x in mean.split("/") if x.strip()]
            cv.setdefault(simp, []).append((py_norm, is_upper, ms))
    return cv, s2t


def load_hanviet(path: str):
    hv_char: dict[str, str] = dict(EXTRA_HV)
    hv_py: dict[tuple[str, str], str] = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ch = row["char"].strip()
            vals = ast.literal_eval(row["hanviet"])
            py = row["pinyin"].strip().lower()
            if vals:
                hv_char.setdefault(ch, vals[0])
                hv_py.setdefault((ch, py), vals[0])
    return hv_char, hv_py


def compute_hanviet(simp: str, trad: str, py_nums: str, hv_char, hv_py, s2t: dict[str, str]) -> str:
    py_parts = [p.lower() for p in py_nums.split() if p]
    out = []
    han_idx = 0
    for i, ch in enumerate(simp):
        if not ("\u4e00" <= ch <= "\u9fff"):
            continue
        tch = trad[i] if i < len(trad) else ch
        mapped = s2t.get(ch, ch)
        py_tok = py_parts[han_idx] if han_idx < len(py_parts) else ""
        han_idx += 1
        reading = (
            hv_py.get((ch, py_tok))
            or hv_py.get((tch, py_tok))
            or hv_py.get((mapped, py_tok))
            or hv_char.get(ch)
            or hv_char.get(tch)
            or hv_char.get(mapped)
        )
        if reading:
            out.append(reading)
    return " ".join(out)


def pick_cv_meaning(hanzi: str, py_num: str, cv) -> str:
    if hanzi in EXTRA_VI:
        return EXTRA_VI[hanzi]
    cands = cv.get(hanzi, [])
    if not cands:
        return ""
    py_key = py_num.lower().replace(" ", "").replace("u:", "v")
    scored = []
    for py_c, is_upper, ms in cands:
        exact = 1 if py_c == py_key else 0
        non_prop = 0 if is_upper else 1
        non_ref = 0 if (ms and ms[0].startswith(("biến thể", "xem ", "Quận ", "Thành phố "))) else 1
        scored.append((exact, non_prop, non_ref, ms))
    scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    ms = scored[0][3]
    clean = [re.sub(r"\[[^\]]+\]", "", m).strip() for m in ms[:3]]
    clean = [c for c in clean if c]
    return "; ".join(clean)[:140]


def load_book_vocab():
    book: dict[str, dict] = {}
    for fp in sorted(glob.glob(os.path.join(LESSONS_DIR, "lesson-*.json"))):
        with open(fp, encoding="utf-8") as f:
            les = json.load(f)
        num = les["number"]
        for v in les.get("vocab", []):
            hz = v["hanzi"].strip()
            ex0 = (v.get("expansion", {}).get("examples") or [None])[0]
            book.setdefault(
                hz,
                {
                    "meaningVi": v["meaningVi"],
                    "pos": v.get("pos", ""),
                    "pinyin": v.get("pinyin", ""),
                    "bookLesson": num,
                    "exampleZh": ex0["zh"] if ex0 else "",
                    "exampleVi": ex0["vi"] if ex0 else "",
                },
            )
    return book


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    comp_path = os.path.join(CACHE, "complete.min.json")
    cv_path = os.path.join(CACHE, "CVDICT.u8")
    hv_path = os.path.join(CACHE, "hanviet.csv")

    with open(comp_path, encoding="utf-8") as f:
        comp = json.load(f)
    cv, s2t = load_cvdict(cv_path)
    hv_char, hv_py = load_hanviet(hv_path)
    for e in comp:
        simp = e.get("s", "").strip()
        trad = (e["f"][0].get("t", simp) if e.get("f") else simp).strip()
        if len(trad) == len(simp):
            for sc, tc in zip(simp, trad):
                if sc != tc and "\u4e00" <= sc <= "\u9fff":
                    s2t.setdefault(sc, tc)

    book = load_book_vocab()
    chunks: dict[str, list[dict]] = {k: [] for k in CHUNK_KEYS}
    seen_hanzi: set[str] = set()
    index_rows: list[list] = []

    for idx, e in enumerate(comp, 1):
        hanzi = e["s"].strip()
        if not hanzi or hanzi in seen_hanzi:
            continue
        seen_hanzi.add(hanzi)

        form = e["f"][0] if e.get("f") else {}
        trad = form.get("t", hanzi)
        info = form.get("i", {})
        pinyin = info.get("y", "") or ""
        py_num = info.get("n", "") or ""
        en_list = form.get("m", []) or []
        meaning_en = "; ".join(en_list[:2])[:140]

        pos_codes = e.get("p", [])
        pos = POS_MAP.get(pos_codes[0], pos_codes[0]) if pos_codes else ""
        lvl_num, hsk_label, chunk_key = pick_hsk_level(e.get("l", []))
        han_viet = compute_hanviet(hanzi, trad, py_num, hv_char, hv_py, s2t)
        meaning_vi = pick_cv_meaning(hanzi, py_num, cv)

        bk = book.get(hanzi)
        book_lesson = None
        example_zh = ""
        example_vi = ""
        if bk:
            meaning_vi = bk["meaningVi"] or meaning_vi
            pos = bk["pos"] or pos
            pinyin = bk["pinyin"] or pinyin
            book_lesson = bk["bookLesson"]
            example_zh = bk["exampleZh"]
            example_vi = bk["exampleVi"]
            if lvl_num > 6:
                lvl_num, hsk_label, chunk_key = 6, "HSK6", "hsk-6"

        if not meaning_vi:
            meaning_vi = meaning_en

        eid = f"v-{idx:05d}"
        entry = {
            "id": eid,
            "hanzi": hanzi,
            "pinyin": pinyin,
            "pinyinPlain": strip_tones(pinyin),
            "hanViet": han_viet,
            "meaningVi": meaning_vi,
            "meaningEn": meaning_en,
            "pos": pos,
            "hskNum": lvl_num,
            "hskLevel": hsk_label,
        }
        if book_lesson is not None:
            entry["bookLesson"] = book_lesson
        if example_zh:
            entry["exampleZh"] = example_zh
            entry["exampleVi"] = example_vi

        chunks[chunk_key].append(entry)
        index_rows.append(
            [eid, hanzi, pinyin, entry["pinyinPlain"], han_viet, meaning_vi, lvl_num, hsk_label, pos, book_lesson or 0]
        )

    extra_idx = len(comp)
    for hz, bk in book.items():
        if hz in seen_hanzi:
            continue
        seen_hanzi.add(hz)
        extra_idx += 1
        eid = f"v-{extra_idx:05d}"
        py = bk["pinyin"]
        hv = compute_hanviet(hz, hz, "", hv_char, hv_py, s2t)
        entry = {
            "id": eid,
            "hanzi": hz,
            "pinyin": py,
            "pinyinPlain": strip_tones(py),
            "hanViet": hv,
            "meaningVi": bk["meaningVi"],
            "meaningEn": "",
            "pos": bk["pos"],
            "hskNum": 6,
            "hskLevel": "HSK6",
            "bookLesson": bk["bookLesson"],
        }
        if bk["exampleZh"]:
            entry["exampleZh"] = bk["exampleZh"]
            entry["exampleVi"] = bk["exampleVi"]
        chunks["hsk-6"].append(entry)
        index_rows.append(
            [eid, hz, py, entry["pinyinPlain"], hv, bk["meaningVi"], 6, "HSK6", bk["pos"], bk["bookLesson"]]
        )

    for k, items in chunks.items():
        with open(os.path.join(OUT_DIR, f"{k}.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(OUT_DIR, "search-index.json"), "w", encoding="utf-8") as f:
        json.dump(index_rows, f, ensure_ascii=False, separators=(",", ":"))

    meta = {
        "version": 2,
        "total": len(index_rows),
        "chunks": {k: len(v) for k, v in chunks.items()},
    }
    with open(os.path.join(OUT_DIR, "vocab-meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("HSK 1-9 build OK:", json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
