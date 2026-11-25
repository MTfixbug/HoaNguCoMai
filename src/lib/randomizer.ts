import type { VocabProgressRecord } from '../types/lms'

/** Pure Fisher-Yates (Durstenfeld) unbiased shuffle returning a shallow copy. */
export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Sampling without replacement + cooldown deferral across cycles. Guarantees 0 duplicates for n <= pool.length. */
export class SessionDeckQueue<T extends { id: string }> {
  private pool: T[]
  private cursor = 0
  private deck: T[] = []
  private readonly rng: () => number
  private lastServedId: string | null = null

  constructor(pool: readonly T[], cooldownIds: readonly string[] = [], rng: () => number = Math.random) {
    this.pool = pool.slice()
    this.rng = rng
    this.refill(new Set(cooldownIds))
  }

  private refill(cooldown: Set<string>) {
    if (this.pool.length === 0) {
      this.deck = []
      this.cursor = 0
      return
    }
    const fresh = shuffleArray(
      this.pool.filter((x) => !cooldown.has(x.id)),
      this.rng,
    )
    const cooled = shuffleArray(
      this.pool.filter((x) => cooldown.has(x.id)),
      this.rng,
    )
    const combined = [...fresh, ...cooled]
    if (combined.length > 1 && this.lastServedId && combined[0].id === this.lastServedId) {
      const swapIdx = Math.min(combined.length - 1, 1 + Math.floor(this.rng() * (combined.length - 1)))
      ;[combined[0], combined[swapIdx]] = [combined[swapIdx], combined[0]]
    }
    this.deck = combined
    this.cursor = 0
  }

  next(): T | undefined {
    if (this.pool.length === 0) return undefined
    if (this.cursor >= this.deck.length) {
      this.refill(new Set())
    }
    const item = this.deck[this.cursor++]
    this.lastServedId = item.id
    return item
  }

  nextBatch(count: number): T[] {
    if (this.pool.length === 0 || count <= 0) return []
    const take = Math.min(count, this.pool.length)
    const out: T[] = []
    const seen = new Set<string>()
    let guard = 0
    while (out.length < take && guard < this.pool.length * 3) {
      guard++
      const item = this.next()
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
    return out
  }
}

export interface SmartWeightContext {
  progressMap: Record<string, VocabProgressRecord>
  recentIds?: ReadonlySet<string>
  now?: number
}

export function computeStudyWeight(wordId: string, ctx: SmartWeightContext): number {
  const now = ctx.now ?? Date.now()
  const rec = ctx.progressMap[wordId]
  let w = 2.0
  if (!rec) {
    w = 2.0
  } else {
    const dueMs = new Date(rec.next_review_at).getTime()
    if (Number.isFinite(dueMs) && dueMs <= now) w = 3.0
    else if (rec.mastery_status === 'mastered') w = 0.3
    else w = 1.0

    if (rec.wrong_count > 0) w *= 1.8 + Math.min(2.2, rec.wrong_count * 0.4)
    if (rec.is_flagged_hard) w *= 1.5
  }
  if (ctx.recentIds?.has(wordId)) w *= 0.05
  return Math.max(0.01, w)
}

export function weightedSample<T extends { id: string }>(
  items: readonly T[],
  count: number,
  ctx: SmartWeightContext,
  rng: () => number = Math.random,
): T[] {
  if (items.length === 0 || count <= 0) return []
  const candidates = items.map((item) => ({ item, weight: computeStudyWeight(item.id, ctx) }))
  const target = Math.min(count, candidates.length)
  const picked: T[] = []
  for (let k = 0; k < target; k++) {
    let total = 0
    for (const c of candidates) total += c.weight
    let r = rng() * total
    let chosenIdx = candidates.length - 1
    for (let i = 0; i < candidates.length; i++) {
      r -= candidates[i].weight
      if (r <= 0) {
        chosenIdx = i
        break
      }
    }
    picked.push(candidates[chosenIdx].item)
    candidates.splice(chosenIdx, 1)
  }
  return picked
}

/** Prevents > 2 consecutive identical option indices without biasing overall slot uniformity. */
export class AntiStreakTracker {
  private history: number[] = []
  private readonly rng: () => number

  constructor(rng: () => number = Math.random) {
    this.rng = rng
  }

  adjustCorrectIndex<T>(options: T[], currentCorrectIdx: number): { options: T[]; correctIndex: number } {
    if (options.length < 2) {
      this.history.push(currentCorrectIdx)
      return { options, correctIndex: currentCorrectIdx }
    }
    const len = this.history.length
    if (len >= 2 && this.history[len - 1] === currentCorrectIdx && this.history[len - 2] === currentCorrectIdx) {
      const alts: number[] = []
      for (let i = 0; i < options.length; i++) if (i !== currentCorrectIdx) alts.push(i)
      const swapWith = alts[Math.floor(this.rng() * alts.length)]
      const copy = options.slice()
      ;[copy[currentCorrectIdx], copy[swapWith]] = [copy[swapWith], copy[currentCorrectIdx]]
      this.history.push(swapWith)
      return { options: copy, correctIndex: swapWith }
    }
    this.history.push(currentCorrectIdx)
    return { options, correctIndex: currentCorrectIdx }
  }

  getHistory(): readonly number[] {
    return this.history
  }
}

export interface MCQCandidate {
  id: string
  hanzi: string
  meaningVi: string
  pos?: string
  hskNum?: number
}

const norm = (s: string) => s.trim().toLowerCase()

export function generateMCQOptions<T extends MCQCandidate>(
  target: T,
  pool: readonly T[],
  optionCount = 4,
  tracker?: AntiStreakTracker,
  rng: () => number = Math.random,
): { options: T[]; correctIndex: number } {
  const usedHanzi = new Set<string>([norm(target.hanzi)])
  const usedMeaning = new Set<string>([norm(target.meaningVi)])
  const shuffled = shuffleArray(pool, rng)

  const tier1: T[] = []
  const tier2: T[] = []
  const tier3: T[] = []

  for (const cand of shuffled) {
    if (cand.id === target.id) continue
    const sameLevel = target.hskNum !== undefined && cand.hskNum === target.hskNum
    const samePos = Boolean(target.pos && cand.pos && cand.pos === target.pos)
    if (sameLevel && samePos) tier1.push(cand)
    else if (sameLevel || samePos) tier2.push(cand)
    else tier3.push(cand)
  }

  const distractors: T[] = []
  for (const cand of [...tier1, ...tier2, ...tier3]) {
    if (distractors.length >= optionCount - 1) break
    const h = norm(cand.hanzi)
    const m = norm(cand.meaningVi)
    if (usedHanzi.has(h) || usedMeaning.has(m)) continue
    usedHanzi.add(h)
    usedMeaning.add(m)
    distractors.push(cand)
  }

  if (distractors.length < optionCount - 1) {
    for (const cand of shuffled) {
      if (distractors.length >= optionCount - 1) break
      if (cand.id === target.id || distractors.some((d) => d.id === cand.id)) continue
      distractors.push(cand)
    }
  }

  const mixed = shuffleArray([target, ...distractors], rng)
  const rawIdx = mixed.findIndex((x) => x.id === target.id)
  if (tracker) return tracker.adjustCorrectIndex(mixed, rawIdx)
  return { options: mixed, correctIndex: rawIdx }
}
