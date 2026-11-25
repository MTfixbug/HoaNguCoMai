"""Build graded Tatoeba example sentences (--prepare batches -> AI Vi translation -> --finalize)."""
import argparse
import json
import os
import re
import jieba
from pypinyin import Style, pinyin as pypinyin_fn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.environ.get("V12_SOURCES_DIR", r"D:\AI\Antigravity\work\v12-sources")
VOCAB_DIR = os.path.join(ROOT, "public", "data", "vocab")
EX_DIR = os.path.join(ROOT, "public", "data", "examples")
BATCH_DIR = os.path.join(SOURCES, "vi_batches")

TARGETS = {1: 0.90, 2: 0.90, 3: 0.85, 4: 0.62, 5: 0.56, 6: 0.54, 7: 0.25}


def load_core_vocab():
    words: dict[str, dict] = {}
    by_lvl: dict[int, list[dict]] = {i: [] for i in range(1, 8)}
    for k in ["hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9"]:
        for e in json.load(open(os.path.join(VOCAB_DIR, f"{k}.json"), encoding="utf-8")):
            words[e["hanzi"]] = e
            by_lvl[e["hskNum"]].append(e)
            jieba.add_word(e["hanzi"], freq=50000)
    return words, by_lvl


def clean_zh(s: str) -> str:
    return s.strip()


def is_clean_sentence(zh: str) -> bool:
    if not (3 <= len(zh) <= 38):
        return False
    han = sum(1 for c in zh if "\u4e00" <= c <= "\u9fff")
    if han < 3 or han / len(zh) < 0.55:
        return False
    if any(b in zh for b in ("[", "]", "【", "】", "(", ")", "（", "）", "\t", "http")):
        return False
    return True


def prepare():
    os.makedirs(BATCH_DIR, exist_ok=True)
    words, by_lvl = load_core_vocab()
    tat = json.load(open(os.path.join(SOURCES, "tatoeba_cmn_cache.json"), encoding="utf-8"))
    cmn = tat["cmn"]
    vie = tat["vie"]
    eng = tat["eng"]
    c2v = tat["cmn_to_vie"]
    c2e = tat["cmn_to_eng"]
    audio_ids = set(tat["audio_ids"])

    # Index: hanzi -> candidate sentence list (score, cid, zh, vi_native, en_text, has_audio)
    word_cands: dict[str, list[tuple]] = {}
    for cid, zh in cmn.items():
        if not is_clean_sentence(zh):
            continue
        toks = set(jieba.lcut(zh, HMM=False))
        matched = [t for t in toks if t in words]
        if not matched:
            continue
        max_other = max(words[t]["hskNum"] for t in matched)
        has_vi = cid in c2v and bool(c2v[cid])
        has_au = cid in audio_ids
        vi_txt = vie[c2v[cid][0]] if has_vi else ""
        en_txt = eng[c2e[cid][0]] if cid in c2e and c2e[cid] else ""
        if not vi_txt and not en_txt:
            continue

        for w in matched:
            wlvl = words[w]["hskNum"]
            # Graded filter: prefer sentences whose hardest word <= wlvl + 1
            lvl_gap = max(0, max_other - wlvl)
            if wlvl <= 3 and lvl_gap > 2 and not has_vi:
                continue
            score = (
                (100 if has_vi else 0)
                + (50 if has_au else 0)
                - lvl_gap * 12
                - abs(len(zh) - 12)
            )
            word_cands.setdefault(w, []).append((score, cid, zh, vi_txt, en_txt, has_au))

    selected = []
    need_vi = []
    used_cids_per_lvl = {}
    stats = {}
    for lvl in range(1, 8):
        pool = by_lvl[lvl]
        cap = int(len(pool) * TARGETS.get(lvl, 0.55) + 0.999)
        covered = 0
        # Sort so words with native cmn-vie or Tatoeba audio come first!
        def word_priority(e):
            cands = word_cands.get(e["hanzi"])
            if not cands:
                return -9999
            cands.sort(key=lambda x: x[0], reverse=True)
            return cands[0][0]

        ordered_pool = sorted(pool, key=word_priority, reverse=True)
        for e in ordered_pool:
            if covered >= cap:
                break
            w = e["hanzi"]
            cands = word_cands.get(w)
            if not cands:
                continue
            best = cands[0]
            # Avoid taking same Tatoeba sentence >2 times inside the same level
            for cand in cands[:6]:
                if used_cids_per_lvl.get((lvl, cand[1]), 0) < 2:
                    best = cand
                    break
            used_cids_per_lvl[(lvl, best[1])] = used_cids_per_lvl.get((lvl, best[1]), 0) + 1
            covered += 1
            _, cid, zh, vi_txt, en_txt, has_au = best
            rec = {
                "wordId": e["id"],
                "hanzi": w,
                "hskNum": lvl,
                "tatoebaId": cid,
                "zh": zh,
                "vi": vi_txt,
                "en": en_txt,
                "hasAudio": has_au,
            }
            selected.append(rec)
            if not vi_txt:
                need_vi.append({"cid": cid, "zh": zh, "en": en_txt, "kw": w})
        stats[f"hsk-{lvl if lvl <= 6 else '7-9'}"] = {
            "words": len(pool),
            "covered": covered,
            "pct": round(covered * 100.0 / max(1, len(pool)), 1),
        }

    # Deduplicate need_vi by cid so same sentence is only translated once
    uniq_need = {}
    for x in need_vi:
        uniq_need.setdefault(x["cid"], x)
    need_list = list(uniq_need.values())

    with open(os.path.join(BATCH_DIR, "selected_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(selected, f, ensure_ascii=False)

    num_batches = 6
    chunk_sz = (len(need_list) + num_batches - 1) // num_batches
    for b in range(num_batches):
        part = need_list[b * chunk_sz : (b + 1) * chunk_sz]
        with open(os.path.join(BATCH_DIR, f"batch_{b+1}.json"), "w", encoding="utf-8") as f:
            json.dump(part, f, ensure_ascii=False, indent=1)

    print("Prepare stats:", json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Total selected={len(selected)}, direct cmn-vie={len(selected)-len(need_vi)}, unique en-to-vi needed={len(need_list)}")


def finalize():
    os.makedirs(EX_DIR, exist_ok=True)
    selected = json.load(open(os.path.join(BATCH_DIR, "selected_manifest.json"), encoding="utf-8"))
    words, by_lvl = load_core_vocab()
    vi_trans: dict[str, str] = {}
    for b in range(1, 7):
        p = os.path.join(BATCH_DIR, f"batch_{b}_vi.json")
        if os.path.exists(p):
            for k, v in json.load(open(p, encoding="utf-8")).items():
                if v and str(v).strip():
                    vi_trans[str(k)] = str(v).strip()

    chunks: dict[str, list[dict]] = {f"hsk-{i}" if i <= 6 else "hsk-7-9": [] for i in range(1, 8)}
    per_word_first: dict[str, tuple[str, str]] = {}
    direct_vi_count = 0
    translated_vi_count = 0
    audio_count = 0

    for idx, r in enumerate(selected, 1):
        vi = r["vi"] or vi_trans.get(str(r["tatoebaId"]), "")
        if not vi:
            continue
        is_direct = bool(r["vi"])
        if is_direct:
            direct_vi_count += 1
        else:
            translated_vi_count += 1
        if r["hasAudio"]:
            audio_count += 1

        py = " ".join(x[0] for x in pypinyin_fn(r["zh"], style=Style.TONE))
        lvl = r["hskNum"]
        ck = f"hsk-{lvl}" if lvl <= 6 else "hsk-7-9"
        ex = {
            "id": f"ex-{idx:05d}",
            "wordId": r["wordId"],
            "hanzi": r["hanzi"],
            "hskNum": lvl,
            "zh": r["zh"],
            "pinyin": py,
            "vi": vi,
            "en": r["en"],
            "source": "tatoeba-vi" if is_direct else "tatoeba-en-vi",
            "tatoebaId": r["tatoebaId"],
            "reviewed": True if is_direct else False,
        }
        if r["hasAudio"]:
            ex["audioUrl"] = f"https://audio.tatoeba.org/sentences/cmn/{r['tatoebaId']}.mp3"
        chunks[ck].append(ex)
        per_word_first.setdefault(r["wordId"], (r["zh"], vi))

    coverage = {}
    for lvl in range(1, 8):
        ck = f"hsk-{lvl}" if lvl <= 6 else "hsk-7-9"
        # Fill exampleZh / exampleVi onto vocab json if missing
        vpath = os.path.join(VOCAB_DIR, f"{ck}.json")
        vrows = json.load(open(vpath, encoding="utf-8"))
        with_ex = 0
        for vr in vrows:
            if not vr.get("exampleZh") and vr["id"] in per_word_first:
                vr["exampleZh"], vr["exampleVi"] = per_word_first[vr["id"]]
            if vr.get("exampleZh"):
                with_ex += 1
        with open(vpath, "w", encoding="utf-8") as f:
            json.dump(vrows, f, ensure_ascii=False, separators=(",", ":"))

        with open(os.path.join(EX_DIR, f"{ck}.json"), "w", encoding="utf-8") as f:
            json.dump(chunks[ck], f, ensure_ascii=False, separators=(",", ":"))

        coverage[ck] = {
            "vocabWords": len(vrows),
            "examples": len(chunks[ck]),
            "wordsWithExample": with_ex,
            "coveragePct": round(with_ex * 100.0 / max(1, len(vrows)), 1),
        }

    meta = {
        "version": 1,
        "totalExamples": direct_vi_count + translated_vi_count,
        "directCmnVieCount": direct_vi_count,
        "translatedEnVieCount": translated_vi_count,
        "nativeAudioCount": audio_count,
        "coverageByChunk": coverage,
    }
    with open(os.path.join(EX_DIR, "examples-meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("Finalize examples OK:", json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--prepare", action="store_true")
    p.add_argument("--finalize", action="store_true")
    args = p.parse_args()
    if args.prepare:
        prepare()
    elif args.finalize:
        finalize()
