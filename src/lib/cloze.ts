import { shuffleArray } from './randomizer'
import type { DictEntry, ExampleSentence } from '../types/vocab'

export interface ClozeQuestion {
  word: DictEntry
  sentenceZh: string
  sentenceMasked: string
  sentencePinyin: string
  sentenceVi: string
  audioUrl?: string
  options: string[]
  correctIndex: number
}

function normalizePos(pos: string): string {
  return pos.split(/[/.、]/)[0]?.trim().toLowerCase() ?? ''
}

export function buildClozeQuestion(
  target: DictEntry,
  pool: DictEntry[],
  example?: ExampleSentence | null,
): ClozeQuestion | null {
  const zh = example?.zh || target.exampleZh
  const vi = example?.vi || target.exampleVi
  if (!zh || !zh.includes(target.hanzi)) return null

  const masked = zh.replace(target.hanzi, ' ______ ')
  const targetPos = normalizePos(target.pos)
  const targetLen = target.hanzi.length

  const samePosLevel = pool.filter(
    (w) =>
      w.id !== target.id &&
      w.hanzi !== target.hanzi &&
      w.source !== 'extra' &&
      Math.abs(w.hanzi.length - targetLen) <= 1 &&
      (targetPos ? normalizePos(w.pos) === targetPos : true),
  )

  const sameLevel = pool.filter(
    (w) =>
      w.id !== target.id &&
      w.hanzi !== target.hanzi &&
      w.source !== 'extra' &&
      !samePosLevel.some((x) => x.id === w.id),
  )

  const candidates = [...shuffleArray(samePosLevel), ...shuffleArray(sameLevel)]
  const distractors: string[] = []
  for (const c of candidates) {
    if (!distractors.includes(c.hanzi)) distractors.push(c.hanzi)
    if (distractors.length >= 3) break
  }
  if (distractors.length < 3) return null

  const options = shuffleArray([target.hanzi, ...distractors])
  return {
    word: target,
    sentenceZh: zh,
    sentenceMasked: masked,
    sentencePinyin: example?.pinyin ?? '',
    sentenceVi: vi ?? target.meaningVi,
    audioUrl: example?.audioUrl,
    options,
    correctIndex: options.indexOf(target.hanzi),
  }
}
