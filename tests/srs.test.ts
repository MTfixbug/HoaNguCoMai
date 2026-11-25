import { describe, expect, it } from 'vitest'
import {
  calculateNextReview,
  computeMasteryStatus,
  createInitialProgress,
  DAY_MS,
  isDue,
  MAX_EASE,
  MIN_EASE,
  previewIntervals,
} from '../src/lib/srs'

describe('Thuật toán lặp lại ngắt quãng SM-2', () => {
  it('khởi tạo thẻ mới đến hạn ôn tập với hệ số ease 2.5', () => {
    const now = 1_700_000_000_000
    const card = createInitialProgress('u1', 'w1', 6, now)
    expect(card.mastery_status).toBe('new')
    expect(card.ease_factor).toBe(2.5)
    expect(card.interval_days).toBe(0)
    expect(isDue(card, now)).toBe(true)
  })

  it('tăng chu kỳ theo SM-2 qua các lần Nhớ (good) tới thành thạo (mastered)', () => {
    const t0 = 1_700_000_000_000
    let card = createInitialProgress('u1', 'w1', 6, t0)

    card = calculateNextReview(card, 'good', t0)
    expect(card.interval_days).toBe(1)
    expect(card.repetitions).toBe(1)
    expect(card.mastery_status).toBe('learning')

    card = calculateNextReview(card, 'good', t0 + DAY_MS)
    expect(card.interval_days).toBe(6)
    expect(card.repetitions).toBe(2)
    expect(card.mastery_status).toBe('familiar')

    card = calculateNextReview(card, 'good', t0 + 7 * DAY_MS)
    expect(card.interval_days).toBe(15)
    expect(card.mastery_status).toBe('familiar')

    card = calculateNextReview(card, 'good', t0 + 22 * DAY_MS)
    expect(card.interval_days).toBeGreaterThanOrEqual(21)
    expect(card.mastery_status).toBe('mastered')
  })

  it('đặt lại số lần lặp khi Quên và giữ ease trong [MIN_EASE, MAX_EASE]', () => {
    const t0 = 1_700_000_000_000
    let card = createInitialProgress('u1', 'w2', 5, t0)

    for (let i = 0; i < 12; i += 1) {
      card = calculateNextReview(card, 'again', t0 + i * 60_000)
    }
    expect(card.ease_factor).toBe(MIN_EASE)
    expect(card.repetitions).toBe(0)
    expect(card.wrong_count).toBe(12)
    expect(card.mastery_status).toBe('learning')

    for (let i = 0; i < 15; i += 1) {
      card = calculateNextReview(card, 'easy', t0 + i * DAY_MS)
    }
    expect(card.ease_factor).toBe(MAX_EASE)
  })

  it('hiển thị nhãn khoảng thời gian bằng tiếng Việt chính xác', () => {
    const card = createInitialProgress('u1', 'w3', 4, 1_700_000_000_000)
    const preview = previewIntervals(card, 1_700_000_000_000)
    expect(preview.again).toBe('10 phút')
    expect(preview.hard).toBe('1 ngày')
    expect(preview.good).toBe('1 ngày')
    expect(preview.easy).toBe('4 ngày')
    expect(computeMasteryStatus(0, 0, 0, 0)).toBe('new')
    expect(computeMasteryStatus(21, 4, 0, 4)).toBe('mastered')
  })
})
