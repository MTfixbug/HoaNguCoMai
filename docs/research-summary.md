# Phase 0 Research Summary — HSK 1–9 Interactive Learning & Exam Platform

## 1. Verified HSK 1–9 Vocabulary Datasets

Source datasets cached and cross-verified from open-source repositories and local textbook materials:

- **`complete.min.json` (`drkameleon/complete-hsk-vocabulary`)**: **11,470** unique lexical entries covering both classic HSK 2.0 (`o1`–`o6`) and new HSK 3.0 (`n1`–`n7`).
  - **HSK 2.0 tag breakdown**: L1 = 150, L2 = 150, L3 = 299, L4 = 601, L5 = 1,298, L6 = 2,500 (5,000-word standard).
  - **HSK 3.0 tag breakdown**: L1 = 506, L2 = 750, L3 = 953, L4 = 972, L5 = 1,059, L6 = 1,123, L7–9 = 5,606.
  - **Primary level chunking (HSK 3.0 primary bucket, falling back to HSK 2.0)**:
    - `hsk-1.json`: 507+ words
    - `hsk-2.json`: 754+ words
    - `hsk-3.json`: 964+ words
    - `hsk-4.json`: 980+ words
    - `hsk-5.json`: 1,109+ words
    - `hsk-6.json`: 1,550+ words (plus curated entries from textbook)
    - `hsk-7-9.json`: 5,606 words
- **`CVDICT.u8` & `hanviet.csv`**: Chinese-to-Vietnamese dictionary definitions paired with character-by-character Sino-Vietnamese (Hán-Việt) readings via a Simplified→Traditional map built directly from `CVDICT.u8` and `complete.min.json`.
- **Curated Textbook Pack (`Giáo trình chuẩn HSK 6 上`, Lessons 1–20)**: 20 full lessons extracted from `C:\Users\Phuc\Downloads\PDF.pdf` containing **922** vocabulary items (with expansions, collocations, synonyms/antonyms), full bilingual paragraphs, grammar notes, `词语辨析` comparisons, and 4 exercise formats (`fill_blank_passage`, `word_choice`, `error_sentence`, `comprehension`).
- **Stroke Order & Guided Writing**: Powered by `hanzi-writer` with dynamic CDN data loading (`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/<char>.json`).

---

## 2. Verified Official HSK 1–6 & HSK 7–9 Exam Blueprints

| Level | Sections | Question Counts | Section Timings | Audio Playback Rule | Score & Pass Threshold |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HSK 1** | Listening, Reading | L: 20 · R: 20 (Total 40) | L: 15m · R: 17m (~40m total) | **2x per recording** | Total 200 · Pass **120/200** |
| **HSK 2** | Listening, Reading | L: 35 · R: 25 (Total 60) | L: 25m · R: 22m (~55m total) | **2x per recording** | Total 200 · Pass **120/200** |
| **HSK 3** | Listening, Reading, Writing | L: 40 · R: 30 · W: 10 (Total 80) | L: 35m · R: 30m · W: 15m (~90m total) | **2x per recording** | Total 300 · Pass **180/300** |
| **HSK 4** | Listening, Reading, Writing | L: 45 · R: 40 · W: 15 (Total 100) | L: 30m · R: 40m · W: 25m (~105m total) | **1x ONLY** | Total 300 · Pass **180/300** |
| **HSK 5** | Listening, Reading, Writing | L: 45 · R: 45 · W: 10 (Total 100) | L: 30m · R: 45m · W: 40m (~125m total) | **1x ONLY** | Total 300 · Pass **180/300** |
| **HSK 6** | Listening, Reading, Writing | L: 50 · R: 50 · W: 1 essay/summary (Total 101) | L: 35m · R: 50m · W: 45m (~140m total) | **1x ONLY** | Total 300 · Pass **180/300** |
| **HSK 7–9** | Listening, Reading, Writing, Translation, Speaking | ~91–98 tasks (L: 34 · R: 30 · W: 2 · Tr: 4 · Sp: 4) | ~200m (33m / 48m / 55m / 42m / 22m) | **1x ONLY** | 5×100 scale → **Band 7 / 8 / 9** |

*Section scoring note:* For HSK 1–6, each section is scaled out of 100 points, with no individual per-section fail floor; passing depends strictly on cumulative score (`>= 120` for HSK 1–2, `>= 180` for HSK 3–6).

---

## 3. Adaptive Retention, SRS & Telemetry Design

- **SM-2 Spaced Repetition (`src/lib/srs.ts`)**:
  - `ease_factor` clamped to `[1.3, 3.0]` starting at `2.5`.
  - Ratings (`again`, `hard`, `good`, `easy`) compute next `interval_days` (`0`, `1`, `6`, exponential thereafter) and map directly to Supabase `vocab_progress.mastery_status`:
    - `'new'`: `repetitions === 0 && wrong_count === 0`
    - `'learning'`: `interval_days < 6 || wrong_count > correct_count`
    - `'familiar'`: `interval_days >= 6 && interval_days < 21`
    - `'mastered'`: `interval_days >= 21`
- **Anti-Bias Randomizer (`src/lib/randomizer.ts`)**:
  - Pure Fisher-Yates shuffle + `SessionDeckQueue` (without replacement + cooldown ring buffer) + `weightedSample` (Mistake Vault 4×, Due SRS 3×, Fresh 2×, Mastered 0.3×, Recent cooldown 0.05×) + `AntiStreakTracker` preventing > 2 consecutive identical A/B/C/D answer slots.
- **Role Security**:
  - Supabase Auth with `flowType: 'pkce'` (`?code=` never collides with SPA routes).
  - Row Level Security (RLS) enforced in Postgres via `private.is_admin()` (`SECURITY DEFINER`, `set search_path = ''`, `(select auth.uid())`).
