import type { MasteryStatus, Rating, VocabProgressRecord } from '../types/lms'

export const DAY_MS = 86_400_000
export const MIN_EASE = 1.3
export const MAX_EASE = 3.0
export const START_EASE = 2.5
export const LEECH_THRESHOLD = 8

export function computeMasteryStatus(intervalDays: number, repetitions: number, wrongCount: number, correctCount: number): MasteryStatus {
  if (repetitions === 0 && wrongCount === 0 && correctCount === 0) return 'new'
  if (intervalDays >= 21) return 'mastered'
  if (intervalDays >= 6 && wrongCount <= correctCount) return 'familiar'
  return 'learning'
}

export function createInitialProgress(userId: string, wordId: string, hskLevel: number, now = Date.now()): VocabProgressRecord {
  const iso = new Date(now).toISOString()
  return {
    user_id: userId,
    word_id: wordId,
    hsk_level: hskLevel,
    ease_factor: START_EASE,
    interval_days: 0,
    repetitions: 0,
    next_review_at: iso,
    wrong_count: 0,
    correct_count: 0,
    is_flagged_hard: false,
    mastery_status: 'new',
    updated_at: iso,
  }
}

export function calculateNextReview(card: VocabProgressRecord, rating: Rating, now = Date.now()): VocabProgressRecord {
  let ease = card.ease_factor
  let reps = card.repetitions
  let interval = card.interval_days
  let wrong = card.wrong_count
  let correct = card.correct_count
  let nextReviewMs: number

  if (rating === 'again') {
    reps = 0
    interval = 0
    wrong += 1
    ease = Math.max(MIN_EASE, +(ease - 0.2).toFixed(2))
    nextReviewMs = now + 10 * 60_000
  } else {
    correct += 1
    if (rating === 'hard') {
      ease = Math.max(MIN_EASE, +(ease - 0.15).toFixed(2))
      interval = reps === 0 ? 1 : Math.max(card.interval_days, Math.round(card.interval_days * 1.2))
    } else if (rating === 'good') {
      if (reps === 0) interval = 1
      else if (reps === 1) interval = 6
      else interval = Math.max(card.interval_days + 1, Math.round(card.interval_days * ease))
    } else {
      ease = Math.min(MAX_EASE, +(ease + 0.15).toFixed(2))
      if (reps === 0) interval = 4
      else if (reps === 1) interval = 10
      else interval = Math.max(card.interval_days + 2, Math.round(card.interval_days * ease * 1.3))
    }
    reps += 1
    nextReviewMs = now + interval * DAY_MS
  }

  return {
    ...card,
    ease_factor: ease,
    interval_days: interval,
    repetitions: reps,
    next_review_at: new Date(nextReviewMs).toISOString(),
    wrong_count: wrong,
    correct_count: correct,
    is_flagged_hard: card.is_flagged_hard || wrong >= LEECH_THRESHOLD,
    mastery_status: computeMasteryStatus(interval, reps, wrong, correct),
    updated_at: new Date(now).toISOString(),
  }
}

export function isDue(card: VocabProgressRecord, now = Date.now()): boolean {
  const t = new Date(card.next_review_at).getTime()
  return Number.isNaN(t) ? true : t <= now
}

export function formatInterval(days: number, isAgain = false): string {
  if (isAgain) return '10 phút'
  if (days === 1) return '1 ngày'
  if (days < 30) return `${days} ngày`
  const months = Math.round(days / 30)
  return months === 1 ? '1 tháng' : `${months} tháng`
}

export function previewIntervals(card: VocabProgressRecord, now = Date.now()): Record<Rating, string> {
  return {
    again: formatInterval(0, true),
    hard: formatInterval(calculateNextReview(card, 'hard', now).interval_days),
    good: formatInterval(calculateNextReview(card, 'good', now).interval_days),
    easy: formatInterval(calculateNextReview(card, 'easy', now).interval_days),
  }
}
