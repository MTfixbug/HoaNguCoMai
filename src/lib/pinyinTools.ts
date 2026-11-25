export type PinyinTone = 1 | 2 | 3 | 4 | 5

export interface SyllableToneInfo {
  syllable: string
  plain: string
  tone: PinyinTone
}

const TONE_CHAR_MAP: Record<string, { base: string; tone: 1 | 2 | 3 | 4 }> = {
  ā: { base: 'a', tone: 1 }, á: { base: 'a', tone: 2 }, ǎ: { base: 'a', tone: 3 }, à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 }, é: { base: 'e', tone: 2 }, ě: { base: 'e', tone: 3 }, è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 }, í: { base: 'i', tone: 2 }, ǐ: { base: 'i', tone: 3 }, ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 }, ó: { base: 'o', tone: 2 }, ǒ: { base: 'o', tone: 3 }, ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 }, ú: { base: 'u', tone: 2 }, ǔ: { base: 'u', tone: 3 }, ù: { base: 'u', tone: 4 },
  ǖ: { base: 'v', tone: 1 }, ǘ: { base: 'v', tone: 2 }, ǚ: { base: 'v', tone: 3 }, ǜ: { base: 'v', tone: 4 },
  ü: { base: 'v', tone: 1 }, // handled specially below when no tone mark
}

const A = '[aāáǎà]'
const E = '[eēéěè]'
const I = '[iīíǐì]'
const O = '[oōóǒò]'
const U = '[uūúǔù]'
const V = '[üǖǘǚǜv]'
const ANY_VOWEL = '[aeiouvüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]'

const FINALS_PATTERN = [
  `${I}${A}ng`,
  `${I}${O}ng`,
  `${U}${A}ng`,
  `${U}${E}ng`,
  `${I}${A}n`,
  `${I}${A}${O}`,
  `${I}ng`,
  `${O}ng`,
  `${U}${A}${I}`,
  `${U}${A}n`,
  `${A}ng`,
  `${E}ng`,
  `${I}${A}`,
  `${I}${E}`,
  `${I}${U}`,
  `${O}${U}`,
  `${U}${A}`,
  `${U}${O}`,
  `${U}${I}`,
  `${U}n`,
  `${V}${E}`,
  `${U}${E}`,
  `${V}n`,
  `${A}${I}`,
  `${E}${I}`,
  `${A}${O}`,
  `${A}n`,
  `${E}n`,
  `${E}r`,
  A,
  E,
  I,
  O,
  U,
  V,
].join('|')

const PINYIN_FINALS_INITIALS_REGEX = new RegExp(
  `(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:${FINALS_PATTERN})(?:ng(?!${ANY_VOWEL})|n(?!${ANY_VOWEL})|r(?!${ANY_VOWEL}))?`,
  'gi',
)

function stripToneChar(ch: string): { base: string; tone?: 1 | 2 | 3 | 4 } {
  if (ch === 'ü') return { base: 'v' }
  const hit = TONE_CHAR_MAP[ch]
  if (hit) return { base: hit.base, tone: hit.tone }
  return { base: ch }
}

function analyzeSingleSyllable(raw: string): SyllableToneInfo {
  const lower = raw.toLowerCase().trim()
  let plain = ''
  let tone: PinyinTone = 5
  for (const ch of lower) {
    if (ch === 'ü') {
      plain += 'v'
      continue
    }
    const info = TONE_CHAR_MAP[ch]
    if (info) {
      plain += info.base
      tone = info.tone
    } else if (/[a-z]/.test(ch)) {
      plain += ch
    }
  }
  return { syllable: raw.trim(), plain, tone }
}

/**
 * Tách một chuỗi Pinyin thành danh sách âm tiết kèm thanh điệu (1..5, trong đó 5 = thanh nhẹ).
 */
export function extractSyllableTones(pinyin: string): SyllableToneInfo[] {
  const cleaned = pinyin
    .replace(/[()[\],.;!?·’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []

  const roughTokens = cleaned.split(' ').filter(Boolean)
  const out: SyllableToneInfo[] = []

  for (const tok of roughTokens) {
    // Nếu có dấu thanh hoặc đã tách âm rõ ràng
    const splitParts = tok.match(PINYIN_FINALS_INITIALS_REGEX)
    if (splitParts && splitParts.join('').length === tok.replace(/[^a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/gi, '').length && splitParts.length > 1) {
      // Kiểm tra lại: chỉ chia nhỏ khi mỗi mảnh có nguyên âm
      const validParts = splitParts.every((p) => /[aeiouvüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(p))
      if (validParts) {
        for (const p of splitParts) {
          const parsed = analyzeSingleSyllable(p)
          if (parsed.plain) out.push(parsed)
        }
        continue
      }
    }
    const parsed = analyzeSingleSyllable(tok)
    if (parsed.plain) out.push(parsed)
  }

  return out
}

export function normalizeMarkedPinyin(input: string): { numbered: string; plain: string } {
  const trimmed = input.trim().toLowerCase().replace(/[’']/g, ' ')
  // Nếu người dùng gõ dạng số (ví dụ: ni3 hao3 hoặc ni3hao3)
  if (/[1-5]/.test(trimmed)) {
    const tokens = trimmed
      .replace(/([a-zvü]+[1-5])/gi, '$1 ')
      .split(/\s+/)
      .filter(Boolean)
    const numberedParts: string[] = []
    const plainParts: string[] = []
    for (const t of tokens) {
      const m = t.match(/^([a-zvü]+)([1-5])?$/)
      if (!m) continue
      const letters = m[1].replace(/ü/g, 'v')
      const tone = m[2] ?? '5'
      numberedParts.push(`${letters}${tone}`)
      plainParts.push(letters)
    }
    if (numberedParts.length > 0) {
      return {
        numbered: numberedParts.join(' '),
        plain: plainParts.join(' '),
      }
    }
  }

  const syllables = extractSyllableTones(trimmed)
  if (syllables.length === 0) {
    const plainFallback = Array.from(trimmed)
      .map((c) => stripToneChar(c).base)
      .join('')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return { numbered: plainFallback, plain: plainFallback }
  }

  return {
    numbered: syllables.map((s) => `${s.plain}${s.tone}`).join(' '),
    plain: syllables.map((s) => s.plain).join(' '),
  }
}

/**
 * Đánh giá câu trả lời Pinyin hỗ trợ cả có dấu (`nǐ hǎo`), số thanh (`ni3 hao3`), hoặc không dấu (`ni hao`).
 */
export function evaluatePinyinAnswer(
  userInput: string,
  targetPinyin: string,
): { match: 'exact' | 'toneless' | 'wrong'; expectedDisplay: string; expectedNumbered: string } {
  const targetSyllables = extractSyllableTones(targetPinyin)
  const expectedNumbered = targetSyllables.map((s) => `${s.plain}${s.tone}`).join(' ')
  const expectedPlainCompact = targetSyllables.map((s) => s.plain).join('')
  const expectedNumberedCompact = targetSyllables.map((s) => `${s.plain}${s.tone}`).join('')

  const userTrim = userInput.trim()
  if (!userTrim || targetSyllables.length === 0) {
    return { match: 'wrong', expectedDisplay: targetPinyin, expectedNumbered }
  }

  const parsedUser = normalizeMarkedPinyin(userTrim)
  const userNumberedCompact = parsedUser.numbered.replace(/\s+/g, '')
  const userPlainCompact = parsedUser.plain.replace(/\s+/g, '')
  const userHasTones = /[1-5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(userTrim)

  if (userHasTones && userNumberedCompact === expectedNumberedCompact) {
    return { match: 'exact', expectedDisplay: targetPinyin, expectedNumbered }
  }

  if (userPlainCompact === expectedPlainCompact) {
    return { match: 'toneless', expectedDisplay: targetPinyin, expectedNumbered }
  }

  return { match: 'wrong', expectedDisplay: targetPinyin, expectedNumbered }
}
