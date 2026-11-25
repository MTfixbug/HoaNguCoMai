import { isDue } from './srs'
import type { GrammarPoint } from '../types/grammar'
import type { VocabProgressRecord } from '../types/lms'
import type { DictEntry } from '../types/vocab'

export const MAX_DUE_REVIEWS_PER_DAY = 100
export const DEFAULT_DAILY_NEW_LIMIT = 10
export const DAILY_NEW_LIMIT_OPTIONS = [5, 10, 15, 20] as const

export interface TodayQueuePlan {
  dueWords: DictEntry[]
  overdueOverflowCount: number
  newWords: DictEntry[]
  dailyGrammar: GrammarPoint | null
  wrongCountAll: number
}

function getDueTimestamp(rec?: VocabProgressRecord): number {
  if (!rec) return Number.MAX_SAFE_INTEGER
  const t = new Date(rec.next_review_at).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function buildTodayQueue(params: {
  pool: DictEntry[]
  progressMap: Record<string, VocabProgressRecord>
  dailyNewLimit?: number
  grammarPool?: GrammarPoint[]
  now?: number
  seedDate?: string
}): TodayQueuePlan {
  const {
    pool,
    progressMap,
    dailyNewLimit = DEFAULT_DAILY_NEW_LIMIT,
    grammarPool = [],
    now = Date.now(),
    seedDate = new Date(now).toISOString().slice(0, 10),
  } = params

  const wordById = new Map<string, DictEntry>()
  for (const w of pool) wordById.set(w.id, w)

  const dueCandidates: Array<{ entry: DictEntry; nextMs: number }> = []
  const newCandidates: DictEntry[] = []

  for (const w of pool) {
    const rec = progressMap[w.id]
    if (!rec) {
      newCandidates.push(w)
      continue
    }
    if (isDue(rec, now)) {
      dueCandidates.push({ entry: w, nextMs: getDueTimestamp(rec) })
    }
  }

  // Sort due reviews: oldest overdue first
  dueCandidates.sort((a, b) => a.nextMs - b.nextMs)

  const dueWords = dueCandidates.slice(0, MAX_DUE_REVIEWS_PER_DAY).map((x) => x.entry)
  const overdueOverflowCount = Math.max(0, dueCandidates.length - MAX_DUE_REVIEWS_PER_DAY)

  // Prefer core HSK syllabus words for daily new batch
  const sortedNew = [...newCandidates].sort((a, b) => {
    const aCore = a.source === 'extra' ? 1 : 0
    const bCore = b.source === 'extra' ? 1 : 0
    return aCore - bCore
  })
  const clampedNew = Math.max(0, Math.min(30, dailyNewLimit))
  const newWords = sortedNew.slice(0, clampedNew)

  // Pick 1 due grammar item first; otherwise deterministic daily pick from grammarPool
  let dailyGrammar: GrammarPoint | null = null
  if (grammarPool.length > 0) {
    const dueGram = grammarPool.find((g) => {
      const rec = progressMap[`gram:${g.id}`]
      return rec && (isDue(rec, now) || rec.wrong_count > rec.correct_count)
    })
    if (dueGram) {
      dailyGrammar = dueGram
    } else {
      const unseen = grammarPool.filter((g) => !progressMap[`gram:${g.id}`])
      const source = unseen.length > 0 ? unseen : grammarPool
      const hash = seedDate.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      dailyGrammar = source[hash % source.length] ?? null
    }
  }

  return {
    dueWords,
    overdueOverflowCount,
    newWords,
    dailyGrammar,
    wrongCountAll: dueWords.filter((w) => (progressMap[w.id]?.wrong_count ?? 0) > 0).length,
  }
}

/**
 * Requeue a forgotten ("Quên") card 3 to 5 positions later inside the current active session.
 */
export function requeueForgottenCard<T extends { id: string }>(
  queue: T[],
  currentIndex: number,
  offset = 4,
): T[] {
  const card = queue[currentIndex]
  if (!card) return queue
  const insertAt = Math.min(queue.length, currentIndex + Math.max(2, Math.min(6, offset)) + 1)
  const next = [...queue]
  next.splice(insertAt, 0, card)
  return next
}
