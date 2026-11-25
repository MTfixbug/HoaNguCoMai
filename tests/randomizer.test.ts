import { describe, expect, it } from 'vitest'
import {
  AntiStreakTracker,
  generateMCQOptions,
  SessionDeckQueue,
  shuffleArray,
  weightedSample,
  type MCQCandidate,
} from '../src/lib/randomizer'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pool: MCQCandidate[] = Array.from({ length: 80 }, (_, idx) => ({
  id: `word-${idx}`,
  hanzi: `词${idx}`,
  meaningVi: `meaning number ${idx}`,
  pos: idx % 3 === 0 ? 'V' : idx % 3 === 1 ? 'N' : 'Adj',
  hskNum: (idx % 6) + 1,
}))

describe('randomizer & anti-streak', () => {
  it('shuffleArray preserves all items without mutating input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const copy = src.slice()
    const shuffled = shuffleArray(src, mulberry32(42))
    expect(src).toEqual(copy)
    expect(shuffled).toHaveLength(src.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(src)
  })

  it('SessionDeckQueue guarantees 0 duplicates across a 50-question session', () => {
    const queue = new SessionDeckQueue(pool, ['word-0', 'word-1'], mulberry32(99))
    const batch = queue.nextBatch(50)
    expect(batch).toHaveLength(50)
    const uniqueIds = new Set(batch.map((b) => b.id))
    expect(uniqueIds.size).toBe(50)
  })

  it('weightedSample favors due/wrong items and demotes recently seen items', () => {
    const now = Date.now()
    const pickedCounts: Record<string, number> = { 'word-0': 0, 'word-1': 0 }
    const rng = mulberry32(7)
    for (let run = 0; run < 200; run += 1) {
      const sample = weightedSample(
        pool.slice(0, 6),
        1,
        {
          now,
          recentIds: new Set(['word-1']),
          progressMap: {
            'word-0': {
              user_id: 'u1',
              word_id: 'word-0',
              hsk_level: 6,
              ease_factor: 1.5,
              interval_days: 0,
              repetitions: 0,
              next_review_at: new Date(now - 60_000).toISOString(),
              wrong_count: 3,
              correct_count: 0,
              is_flagged_hard: true,
              mastery_status: 'learning',
              updated_at: new Date(now).toISOString(),
            },
          },
        },
        rng,
      )
      if (sample[0]) pickedCounts[sample[0].id] = (pickedCounts[sample[0].id] ?? 0) + 1
    }
    expect(pickedCounts['word-0']).toBeGreaterThan(pickedCounts['word-1'] * 4)
  })

  it('distributes correct answers uniformly (~20%-30% per A/B/C/D) across 1,000 consecutive MCQs with 0 duplicate options and 0 streaks > 2', () => {
    const rng = mulberry32(2026)
    const tracker = new AntiStreakTracker(rng)
    const slotCounts = [0, 0, 0, 0]
    let streak = 0
    let prevSlot = -1
    let maxStreak = 0

    for (let i = 0; i < 1000; i += 1) {
      const target = pool[i % pool.length]
      const { options, correctIndex } = generateMCQOptions(target, pool, 4, tracker, rng)
      expect(options).toHaveLength(4)
      expect(new Set(options.map((o) => o.id)).size).toBe(4)
      expect(options[correctIndex].id).toBe(target.id)

      slotCounts[correctIndex] += 1
      streak = correctIndex === prevSlot ? streak + 1 : 1
      prevSlot = correctIndex
      maxStreak = Math.max(maxStreak, streak)
    }

    expect(maxStreak).toBeLessThanOrEqual(2)
    for (const count of slotCounts) {
      expect(count).toBeGreaterThanOrEqual(200)
      expect(count).toBeLessThanOrEqual(300)
    }
  })
})
