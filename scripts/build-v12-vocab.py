"""Build v1.2 HSK 3.0 (Nov 2025 final syllabus) + HSK 2.0 mapping + Practical Extra vocab & Internet Slang."""
import ast
import csv
import glob
import gzip
import json
import os
import re
import unicodedata
import jieba
from pypinyin import Style, pinyin as pypinyin_fn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.environ.get("V12_SOURCES_DIR", r"D:\AI\Antigravity\work\v12-sources")
CACHE = os.environ.get("HSK6_CACHE_DIR", r"D:\AI\Antigravity\work\hsk6-cache")
OUT_DIR = os.path.join(ROOT, "public", "data", "vocab")

CHUNK_KEYS = ["hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9", "extra"]

PDF_POS_MAP = {
    "名": "dt.", "动": "đgt.", "形": "tt.", "副": "phó.", "代": "đt.",
    "数": "số.", "量": "lượng.", "介": "giới.", "连": "liên.", "助": "trợ.",
    "叹": "thán.", "拟声": "tượng thanh", "前缀": "tiền tố", "后缀": "hậu tố",
    "名、动": "dt./đgt.", "动、名": "đgt./dt.", "形、副": "tt./phó.",
    "动、形": "đgt./tt.", "形、动": "tt./đgt.", "名、形": "dt./tt.",
    "形、名": "tt./dt.", "副、连": "phó./liên.", "连、副": "liên./phó.",
    "介、连": "giới./liên.", "连、介": "liên./giới.", "动、介": "đgt./giới.",
    "介、动": "giới./đgt.", "名、量": "dt./lượng.", "动、量": "đgt./lượng.",
    "代、副": "đt./phó.", "数、代": "số./đt.", "形、代": "tt./đt.",
    "助、动": "trợ./đgt.", "副、形": "phó./tt.", "名、后缀": "dt./hậu tố",
}

DRK_POS_MAP = {
    "n": "dt.", "v": "đgt.", "a": "tt.", "d": "phó.", "r": "đt.",
    "p": "giới.", "c": "liên.", "q": "lượng.", "u": "trợ.", "e": "thán.",
    "m": "số.", "t": "dt. thời gian", "s": "dt. nơi chốn", "f": "phương vị",
    "vn": "đgt./dt.", "an": "tt./dt.", "ad": "tt./phó.", "b": "tính từ định ngữ",
    "l": "quán dụng ngữ", "i": "thành ngữ", "g": "tố từ", "z": "trạng thái",
    "nr": "tên riêng", "ns": "địa danh", "nt": "cơ quan", "nz": "dt.",
}

MISSING_VI_NEW_CORE = {
    "上半场": "nửa trận đầu, hiệp một",
    "下半场": "nửa trận sau, hiệp hai",
    "两翼": "hai cánh, hai bên sườn",
    "压轴": "tiết mục cuối (đinh), khép màn ấn tượng",
    "口哨儿": "tiếng huýt sáo; cái còi",
    "居于": "nằm ở, đứng ở (vị trí)",
    "新媒体": "truyền thông mới (new media)",
    "新能源": "năng lượng mới (tái tạo)",
    "来之不易": "khó khăn lắm mới có được, không dễ mà có",
    "精彩纷呈": "rực rỡ đặc sắc, muôn màu muôn vẻ",
}

MISSING_EN_EXTRA = {
    "白噪音": "white noise",
    "别致": "unique; chic; distinctive",
    "打车": "to take a taxi; hail a cab",
    "打个比方": "for example; to draw an analogy",
    "得力": "capable; competent; right-hand",
    "发呆": "to stare blankly; daydream",
    "风波": "storm; disturbance; controversy",
    "风度": "demeanor; grace; bearing",
    "过瘾": "to satisfy a craving; really enjoy",
    "狠心": "hardhearted; resolute; to harden one's heart",
    "胡思乱想": "to let one's imagination run wild",
    "花哨": "showy; flashy; gaudy",
    "欢呼": "to cheer; acclaim",
    "节制": "to restrain; moderate; control",
    "哭鼻子": "to cry; snivel",
    "狼吞虎咽": "to wolf down; devour ravenously",
    "念念不忘": "to bear in mind constantly; unforgettable",
    "心甘情愿": "willingly and gladly",
}

EXTRA_HV = {"词": "từ", "岛": "đảo", "鹅": "nga", "离": "ly", "却": "khước", "驮": "đà", "钻": "toàn"}

INTERNET_SLANG = [
    ("躺平", "nằm thẳng (từ bỏ chạy đua áp lực, sống tối giản)", "lie flat; opt out of the rat race", "đgt."),
    ("内卷", "cuốn vào cạnh tranh khốc liệt vô nghĩa (nội quyển)", "involution; toxic over-competition", "đgt./dt."),
    ("破防", "vỡ phòng tuyến cảm xúc, xúc động mạnh hoặc mất bình tĩnh", "emotionally overwhelmed; defenses broken", "đgt."),
    ("真香", "nói không nhưng cuối cùng lại mê tít (tự vả)", "eating one's words after loving something", "tt."),
    ("社恐", "sợ giao tiếp xã hội, hướng nội ngại đám đông", "social anxiety; socially awkward", "dt./tt."),
    ("社牛", "siêu hướng ngoại, bắt chuyện với ai cũng được", "social butterfly; ultra-extroverted", "dt./tt."),
    ("佛系", "sống kiểu Phật hệ, tùy duyên không tranh giành", "zen attitude; easygoing and unbothered", "tt."),
    ("摸鱼", "lười việc riêng trong giờ làm (sờ cá)", "slacking off at work; cyberslacking", "đgt."),
    ("打工人", "người đi làm thuê (cách gọi hài hước dân văn phòng)", "wage earner; corporate worker", "dt."),
    ("摆烂", "buông xuôi cho hỏng luôn, mặc kệ tới đâu thì tới", "let it rot; stop trying on purpose", "đgt."),
    ("拿捏", "nắm thóp, kiểm soát ngon ơ, bắt bài chuẩn", "nail it; handle effortlessly", "đgt."),
    ("绝绝子", "đỉnh của chóp, xuất sắc không chê vào đâu được", "awesome; next-level amazing", "tt."),
    ("吃瓜", "hóng chuyện, hóng drama (ăn dưa)", "spectate gossip or drama", "đgt."),
    ("吃瓜群众", "quần chúng hóng biến, cư dân mạng xem kịch", "gossip onlookers; spectators", "dt."),
    ("种草", "làm người khác thèm muốn mua món đồ (gieo cỏ)", "inspire someone to buy something", "đgt."),
    ("拔草", "mua cho bằng được hoặc hết hứng muốn mua nữa", "finally buy or lose interest in an item", "đgt."),
    ("剁手", "vung tay quá trán mua sắm online (chặt tay)", "impulse shopping; overspending online", "đgt."),
    ("颜值", "chỉ số nhan sắc, độ đẹp trai xinh gái", "looks score; physical attractiveness", "dt."),
    ("学霸", "học bá, cao thủ học giỏi top đầu", "straight-A top student", "dt."),
    ("学渣", "học tra, người lười học hoặc điểm kém", "underachieving student", "dt."),
    ("单身狗", "F.A. lâu năm, dân độc thân (tự trào)", "single person (jocular slang)", "dt."),
    ("杠精", "thánh cãi cùn, chuyên phản bác cho bằng được", "contrarian troll; nitpicker", "dt."),
    ("键盘侠", "anh hùng bàn phím", "keyboard warrior", "dt."),
    ("锦鲤", "cá chép gấm (biểu tượng siêu may mắn)", "lucky charm; extraordinarily lucky person", "dt."),
    ("柠檬精", "người hay ghen tị, chua ngoa (chua như chanh)", "envious person; green with envy", "dt."),
    ("小哥哥", "anh trai dễ mến (cách gọi thân mật giới trẻ)", "handsome young guy; bro", "dt."),
    ("小姐姐", "chị gái xinh xắn (cách gọi thân mật giới trẻ)", "pretty young lady; sis", "dt."),
    ("老铁", "chiến hữu thân thiết, bạn cứng (tiếng vùng Đông Bắc)", "close buddy; homie", "dt."),
    ("给力", "rất chất, hết sảy, hữu ích cực kỳ", "awesome; supportive; impressive", "tt."),
    ("吐槽", "bóc phốt nhẹ, phàn nàn hài hước, khịa vui", "roast playfully; rant; complain", "đgt."),
    ("点赞", "thả like, bấm thích, khen ngợi", "give a like; thumbs up", "đgt."),
    ("打卡", "check-in địa điểm hoặc điểm danh mục tiêu mỗi ngày", "check in; punch the clock; daily log", "đgt."),
    ("拼单", "mua chung cho đủ đơn freeship/giảm giá", "split a group order online", "đgt."),
    ("刷屏", "spam kín màn hình, tràn ngập bảng tin", "flood the screen; spam timeline", "đgt."),
    ("拉黑", "chặn liên lạc, đưa vào danh sách đen", "block someone; blacklist", "đgt."),
    ("微信", "WeChat (ứng dụng nhắn tin, thanh toán phổ biến ở TQ)", "WeChat", "dt."),
    ("支付宝", "Alipay (ví điện tử thanh toán tại TQ)", "Alipay", "dt."),
    ("外卖", "đồ ăn giao tận nơi, gọi ship đồ ăn", "food delivery; takeout", "dt."),
    ("快递", "chuyển phát nhanh, shipper giao hàng", "express delivery; courier", "dt."),
    ("扫码", "quét mã QR", "scan a QR code", "đgt."),
    ("直播", "livestream, phát trực tiếp", "livestream; live broadcast", "đgt./dt."),
    ("带货", "bán hàng qua livestream / KOL giới thiệu", "promote and sell goods via livestream", "đgt."),
    ("弹幕", "bình luận chạy ngang trên video (danmu)", "bullet comments on video", "dt."),
    ("网购", "mua sắm trực tuyến", "online shopping", "đgt./dt."),
    ("充电宝", "sạc dự phòng", "power bank", "dt."),
    ("朋友圈", "bảng tin Moments trên WeChat", "WeChat Moments feed", "dt."),
    ("表情包", "bộ sticker, ảnh chế meme dùng khi chat", "meme pack; sticker set", "dt."),
    ("闺蜜", "bạn thân khác giới/nữ chí cốt, chị em bạn dì", "bestie; close confidante", "dt."),
    ("暖男", "chàng trai ấm áp, chu đáo", "warm, caring guy", "dt."),
    ("吃货", "tâm hồn ăn uống, người mê ẩm thực", "foodie", "dt."),
    ("宅男", "con trai thích ở nhà cày game/phim, ít ra ngoài", "homebody guy; indoor geek", "dt."),
    ("宅女", "con gái thích ở nhà đọc truyện/xem phim", "homebody girl", "dt."),
    ("加班狗", "dân tăng ca triền miên", "overworked overtime worker", "dt."),
    ("干饭人", "tín đồ ăn uống nhiệt tình ('dân đánh chén')", "enthusiastic eater", "dt."),
    ("工具人", "người bị lợi dụng sai vặt, 'lốp dự phòng'", "errand runner; friend-zoned helper", "dt."),
    ("凡尔赛", "khoe khéo (kêu ca giả vờ để khoe mẽ)", "humblebragging (Versailles style)", "tt./đgt."),
    ("社死", "chết đứng vì quá quê trước đám đông (xã hội tử vong)", "die of public embarrassment", "đgt."),
    ("笑死", "cười xỉu, buồn cười chết đi được", "laughing to death; hilarious", "đgt."),
    ("无语", "cạn lời, không nói nên lời", "speechless; dumbfounded", "đgt./tt."),
    ("离谱", "vô lý hết sức, quá lố", "ridiculous; out of line", "tt."),
    ("上头", "cuốn quá đà, nghiện hoặc bốc đồng mất kiểm soát", "hooked; carried away; tipsy", "đgt./tt."),
    ("下头", "tụt mood ngay lập tức, mất hết cảm tình", "major turn-off; buzzkill", "đgt./tt."),
    ("翻车", "toang, thất bại thảm hại trái ngược dự tính", "fail miserably; crash and burn", "đgt."),
    ("爆款", "mặt hàng bán chạy bùng nổ, hot trend", "hit product; viral bestseller", "dt."),
    ("秒杀", "săn sale chớp nhoáng trong vài giây, áp đảo hoàn toàn", "flash sale; wipe out instantly", "đgt."),
    ("云吸猫", "ngắm ảnh/video mèo online cho đỡ ghiền", "watch cat videos online vicariously", "đgt."),
    ("社畜", "nô lệ công sở, làm việc cật lực dưới áp lực", "corporate drone; wage slave", "dt."),
    ("精神内耗", "tự dằn vặt tiêu hao năng lượng tinh thần", "mental overthinking and burnout", "dt."),
    ("显眼包", "cây hài nổi bật nhất đám đông, thích gây chú ý", "scene-stealer; lovable show-off", "dt."),
    ("松弛感", "thần thái thư thả, điềm tĩnh không gồng", "effortless chill vibe; composure", "dt."),
    ("情绪价值", "giá trị cảm xúc (khả năng mang lại niềm vui, an ủi)", "emotional value", "dt."),
    ("脑洞大开", "trí tưởng tượng bay bổng cực mạnh, ý tưởng táo bạo", "wildly imaginative; mind-blown", "cụm từ"),
]


def strip_tones(py: str) -> str:
    s = unicodedata.normalize("NFD", py)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("ü", "u").replace("Ü", "u").replace("u:", "u")
    return re.sub(r"[^a-zA-Z0-9]", "", s).lower()


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
            ms = [x.strip() for x in mean.split("/") if x.strip() and not x.strip().startswith(("CL:", "xem ", "biến thể", "Quận ", "Thành phố ", "tỉnh ", "huyện "))]
            if not ms:
                ms = [x.strip() for x in mean.split("/") if x.strip()]
            cv.setdefault(simp, []).append((py_norm, is_upper, ms))
    return cv, s2t


def load_cedict(path: str):
    ced: dict[str, tuple[str, str, list[str]]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            m = re.match(r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$", line.strip())
            if not m:
                continue
            trad, simp, py_raw, mean = m.groups()
            if simp in ced and py_raw[0].isupper():
                continue
            ms = [re.sub(r"\[[^\]]+\]", "", x).strip() for x in mean.split("/") if x.strip() and not x.strip().startswith(("CL:", "variant of", "see ", "surname "))]
            if not ms:
                ms = [x.strip() for x in mean.split("/") if x.strip()]
            ced.setdefault(simp, (trad, py_raw, ms))
    return ced


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


def compute_hanviet(simp: str, hv_char, hv_py, s2t) -> str:
    py_syls = [x[0] for x in pypinyin_fn(simp, style=Style.TONE3, neutral_tone_with_five=True)]
    out = []
    han_idx = 0
    for ch in simp:
        if not ("\u4e00" <= ch <= "\u9fff"):
            continue
        py_tok = py_syls[han_idx].lower() if han_idx < len(py_syls) else ""
        han_idx += 1
        mapped = s2t.get(ch, ch)
        reading = hv_py.get((ch, py_tok)) or hv_py.get((mapped, py_tok)) or hv_char.get(ch) or hv_char.get(mapped)
        if reading:
            out.append(reading)
    return " ".join(out)


def pick_cv_meaning(hanzi: str, cv) -> str:
    if hanzi in MISSING_VI_NEW_CORE:
        return MISSING_VI_NEW_CORE[hanzi]
    cands = cv.get(hanzi, [])
    if not cands:
        return ""
    cands_sorted = sorted(cands, key=lambda x: (0 if not x[1] else 1))
    ms = cands_sorted[0][2]
    clean = [re.sub(r"\[[^\]]+\]", "", m).strip() for m in ms[:3]]
    clean = [c for c in clean if c]
    return "; ".join(clean)[:140]


def map_pdf_pos(pos_raw: str, hanzi: str, drk_pos: str) -> str:
    if pos_raw:
        p = re.sub(r"[（）()]", "", pos_raw).strip()
        if p in PDF_POS_MAP:
            return PDF_POS_MAP[p]
        first = re.split(r"[、,]", p)[0].strip()
        if first in PDF_POS_MAP:
            return PDF_POS_MAP[first]
    if drk_pos:
        return drk_pos
    if len(hanzi) >= 4 and " " not in hanzi:
        return "thành ngữ"
    if " " in hanzi or len(hanzi) >= 3:
        return "cụm từ"
    return "đgt./dt."


def classify_topic(hanzi: str, meaning_vi: str, meaning_en: str) -> str:
    m = (meaning_vi + " " + meaning_en).lower()
    if any(k in m for k in ("cơm", "ăn", "uống", "món", "thức ăn", "quán", "nhà hàng", "mua", "tiền", "giá", "bán", "trái cây", "food", "eat", "drink", "buy", "price", "shop", "cook", "tea", "coffee")):
        return "Ẩm thực & Mua sắm"
    if any(k in m for k in ("công ty", "văn phòng", "họp", "sếp", "hợp đồng", "báo cáo", "công việc", "kinh doanh", "nhân viên", "lương", "company", "office", "work", "meeting", "business", "report", "contract", "manager")):
        return "Công việc & Văn phòng"
    if any(k in m for k in ("xe", "tàu", "máy bay", "đường", "du lịch", "khách sạn", "hộ chiếu", "vé", "ga ", "sân bay", "travel", "hotel", "ticket", "train", "airport", "bus", "car", "road")):
        return "Du lịch & Giao thông"
    if any(k in m for k in ("mạng", "máy tính", "điện thoại", "phần mềm", "ứng dụng", "dữ liệu", "kỹ thuật", "internet", "computer", "phone", "app", "software", "digital", "video", "screen")):
        return "Công nghệ & Đời sống"
    return "Giao tiếp hằng ngày"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # 1. Load existing entries to preserve exact IDs v-00001..v-11488
    existing_by_hanzi: dict[str, dict] = {}
    max_id_num = 0
    for fp in sorted(glob.glob(os.path.join(OUT_DIR, "hsk-*.json"))):
        for row in json.load(open(fp, encoding="utf-8")):
            existing_by_hanzi[row["hanzi"]] = row
            m = re.match(r"v-(\d+)$", row["id"])
            if m:
                max_id_num = max(max_id_num, int(m.group(1)))

    # 2. Load parsed PDF 2025 core + drkameleon + krmanik + dicts
    pdf_data = json.load(open(os.path.join(SOURCES, "parsed", "pdf_vocab.json"), encoding="utf-8"))
    pdf_map: dict[str, list] = pdf_data["pdf_map"]
    drk_list = json.load(open(os.path.join(SOURCES, "drkameleon", "complete.min.json"), encoding="utf-8"))
    drk_by_hanzi: dict[str, dict] = {x["s"].strip(): x for x in drk_list if x.get("s")}
    cv, s2t = load_cvdict(os.path.join(CACHE, "CVDICT.u8"))
    ced = load_cedict(os.path.join(SOURCES, "cedict.txt.gz"))
    hv_char, hv_py = load_hanviet(os.path.join(CACHE, "hanviet.csv"))

    chunks: dict[str, list[dict]] = {k: [] for k in CHUNK_KEYS}
    used_hanzi: set[str] = set()
    next_id = max_id_num

    def alloc_id(hanzi: str) -> str:
        nonlocal next_id
        ex = existing_by_hanzi.get(hanzi)
        if ex:
            return ex["id"]
        next_id += 1
        return f"v-{next_id:05d}"

    def drk_hsk2(hanzi: str) -> int | None:
        d = drk_by_hanzi.get(hanzi)
        if not d:
            return None
        os_ = sorted(int(x[1:]) for x in d.get("l", []) if x.startswith("o") and x[1:].isdigit())
        return os_[0] if os_ else None

    def drk_en_pos(hanzi: str) -> tuple[str, str, str]:
        d = drk_by_hanzi.get(hanzi)
        en, pos, py = "", "", ""
        if d:
            f0 = d["f"][0] if d.get("f") else {}
            ms = f0.get("m", []) or []
            en = "; ".join(ms[:2])[:140]
            pc = d.get("p", [])
            pos = DRK_POS_MAP.get(pc[0], pc[0]) if pc else ""
            py = (f0.get("i") or {}).get("y", "") or ""
        if not en and hanzi in ced:
            en = "; ".join(ced[hanzi][2][:2])[:140]
        if not en and hanzi in MISSING_EN_EXTRA:
            en = MISSING_EN_EXTRA[hanzi]
        return en, pos, py

    # Step A: Build CORE (10,896 official Nov 2025 syllabus words)
    hsk2_counts = {str(i): 0 for i in range(1, 7)}
    for hanzi, items in pdf_map.items():
        used_hanzi.add(hanzi)
        lvl_num = min(x[0] for x in items)
        pdf_py = next((x[1] for x in items if x[0] == lvl_num and x[1]), items[0][1])
        pdf_pos_raw = next((x[2] for x in items if x[0] == lvl_num and x[2]), items[0][2])

        ex = existing_by_hanzi.get(hanzi)
        eid = alloc_id(hanzi)
        drk_en, drk_pos, drk_py = drk_en_pos(hanzi)
        hsk2 = drk_hsk2(hanzi)
        if hsk2:
            hsk2_counts[str(hsk2)] += 1

        pinyin = (ex.get("pinyin") if ex else "") or pdf_py or drk_py or " ".join(x[0] for x in pypinyin_fn(hanzi, style=Style.TONE))
        pinyin_plain = strip_tones(pinyin)
        han_viet = (ex.get("hanViet") if ex else "") or compute_hanviet(hanzi, hv_char, hv_py, s2t)
        meaning_vi = (ex.get("meaningVi") if ex else "") or pick_cv_meaning(hanzi, cv)
        meaning_en = (ex.get("meaningEn") if ex else "") or drk_en
        if not meaning_en and meaning_vi:
            meaning_en = MISSING_EN_EXTRA.get(hanzi, meaning_vi)
        if not meaning_vi:
            meaning_vi = meaning_en
        pos = (ex.get("pos") if ex and ex.get("pos") else "") or map_pdf_pos(pdf_pos_raw, hanzi, drk_pos)

        hsk_label = f"HSK{lvl_num}" if lvl_num <= 6 else "HSK7-9"
        chunk_key = f"hsk-{lvl_num}" if lvl_num <= 6 else "hsk-7-9"

        entry: dict = {
            "id": eid,
            "hanzi": hanzi,
            "pinyin": pinyin,
            "pinyinPlain": pinyin_plain,
            "hanViet": han_viet,
            "meaningVi": meaning_vi,
            "meaningEn": meaning_en,
            "pos": pos,
            "hskNum": lvl_num,
            "hskLevel": hsk_label,
            "hsk3Level": lvl_num,
            "source": "core",
        }
        if hsk2:
            entry["hsk2Level"] = hsk2
        if ex and ex.get("bookLesson"):
            entry["bookLesson"] = ex["bookLesson"]
        if ex and ex.get("exampleZh"):
            entry["exampleZh"] = ex["exampleZh"]
            entry["exampleVi"] = ex.get("exampleVi", "")

        chunks[chunk_key].append(entry)

    # Step B: Legacy non-2025 entries (preserve exact existing IDs!) -> source: 'extra'
    for hanzi, ex in existing_by_hanzi.items():
        if hanzi in used_hanzi:
            continue
        used_hanzi.add(hanzi)
        hsk2 = drk_hsk2(hanzi)
        if hsk2:
            hsk2_counts[str(hsk2)] += 1
        drk_en, drk_pos, _ = drk_en_pos(hanzi)
        pos = ex.get("pos") or map_pdf_pos("", hanzi, drk_pos)
        meaning_en = ex.get("meaningEn") or drk_en or ex.get("meaningVi", "")
        entry = {
            "id": ex["id"],
            "hanzi": hanzi,
            "pinyin": ex["pinyin"],
            "pinyinPlain": ex.get("pinyinPlain") or strip_tones(ex["pinyin"]),
            "hanViet": ex.get("hanViet") or compute_hanviet(hanzi, hv_char, hv_py, s2t),
            "meaningVi": ex["meaningVi"],
            "meaningEn": meaning_en,
            "pos": pos,
            "hskNum": 0,
            "hskLevel": "Mở rộng",
            "source": "extra",
            "topic": "HSK 2.0 & Mở rộng" if hsk2 else classify_topic(hanzi, ex["meaningVi"], meaning_en),
        }
        if hsk2:
            entry["hsk2Level"] = hsk2
        if ex.get("bookLesson"):
            entry["bookLesson"] = ex["bookLesson"]
        if ex.get("exampleZh"):
            entry["exampleZh"] = ex["exampleZh"]
            entry["exampleVi"] = ex.get("exampleVi", "")
        chunks["extra"].append(entry)

    # Step C: Add 72 Internet Slang entries -> source: 'extra', topic: 'Từ lóng mạng', reviewed: False
    for hanzi, vi, en, pos in INTERNET_SLANG:
        if hanzi in used_hanzi:
            # Find in chunks and tag topic/reviewed if already extra; if core keep core
            continue
        used_hanzi.add(hanzi)
        next_id += 1
        py = " ".join(x[0] for x in pypinyin_fn(hanzi, style=Style.TONE))
        entry = {
            "id": f"v-{next_id:05d}",
            "hanzi": hanzi,
            "pinyin": py,
            "pinyinPlain": strip_tones(py),
            "hanViet": compute_hanviet(hanzi, hv_char, hv_py, s2t),
            "meaningVi": vi,
            "meaningEn": en,
            "pos": pos,
            "hskNum": 0,
            "hskLevel": "Mở rộng",
            "source": "extra",
            "topic": "Từ lóng mạng",
            "reviewed": False,
        }
        chunks["extra"].append(entry)

    # Step D: Add ~2,200 high-frequency everyday words from jieba dict intersect CVDICT + CEDICT
    jieba_dict = os.path.join(os.path.dirname(jieba.__file__), "dict.txt")
    freq_words: list[tuple[int, str, str]] = []
    with open(jieba_dict, encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            w, freq_s, jpos = parts[0], parts[1], parts[2]
            if w in used_hanzi or not (2 <= len(w) <= 4):
                continue
            if not all("\u4e00" <= c <= "\u9fff" for c in w):
                continue
            if jpos in ("nr", "ns", "nt", "nz", "x", "f", "t") or not freq_s.isdigit():
                continue
            cands = cv.get(w)
            if not cands or cands[0][1]:  # skip uppercase proper nouns
                continue
            if w not in ced:
                continue
            vi = pick_cv_meaning(w, cv)
            if not vi or vi.startswith(("họ ", "tên ", "tỉnh ", "huyện ", "xem ")):
                continue
            freq_words.append((int(freq_s), w, jpos))

    freq_words.sort(reverse=True)
    added_practical = 0
    for _, w, jpos in freq_words:
        if added_practical >= 2200:
            break
        used_hanzi.add(w)
        next_id += 1
        en_raw = "; ".join(ced[w][2][:2])[:140]
        vi = pick_cv_meaning(w, cv)
        if not en_raw:
            en_raw = vi
        py = " ".join(x[0] for x in pypinyin_fn(w, style=Style.TONE))
        pos = DRK_POS_MAP.get(jpos, "dt." if jpos.startswith("n") else ("đgt." if jpos.startswith("v") else "tt."))
        chunks["extra"].append({
            "id": f"v-{next_id:05d}",
            "hanzi": w,
            "pinyin": py,
            "pinyinPlain": strip_tones(py),
            "hanViet": compute_hanviet(w, hv_char, hv_py, s2t),
            "meaningVi": vi,
            "meaningEn": en_raw,
            "pos": pos,
            "hskNum": 0,
            "hskLevel": "Mở rộng",
            "source": "extra",
            "topic": classify_topic(w, vi, en_raw),
        })
        added_practical += 1

    # Write chunks & build compact search-index.json
    index_rows: list[list] = []
    for k in CHUNK_KEYS:
        items = chunks[k]
        with open(os.path.join(OUT_DIR, f"{k}.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, separators=(",", ":"))
        for e in items:
            index_rows.append([
                e["id"],
                e["hanzi"],
                e["pinyin"],
                e["pinyinPlain"],
                e["hanViet"],
                e["meaningVi"],
                e["hskNum"],
                e["hskLevel"],
                e["pos"],
                e.get("bookLesson", 0) or 0,
                e.get("source", "core"),
                e.get("hsk2Level", 0) or 0,
                e.get("topic", ""),
                1 if e.get("reviewed", True) else 0,
            ])

    with open(os.path.join(OUT_DIR, "search-index.json"), "w", encoding="utf-8") as f:
        json.dump(index_rows, f, ensure_ascii=False, separators=(",", ":"))

    cum = 0
    hsk3_cum = {}
    for k in ["hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9"]:
        cum += len(chunks[k])
        hsk3_cum[k] = cum

    core_total = sum(len(chunks[k]) for k in CHUNK_KEYS if k != "extra")
    extra_total = len(chunks["extra"])
    slang_count = sum(1 for e in chunks["extra"] if e.get("topic") == "Từ lóng mạng")

    meta = {
        "version": 3,
        "standard": "hsk-syllabus-2025",
        "total": len(index_rows),
        "coreTotal": core_total,
        "extraTotal": extra_total,
        "slangTotal": slang_count,
        "chunks": {k: len(chunks[k]) for k in CHUNK_KEYS},
        "hsk3CoreCumulative": hsk3_cum,
        "hsk2Counts": hsk2_counts,
    }
    with open(os.path.join(OUT_DIR, "vocab-meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("HSK v1.2 vocab build OK:")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
