import { describe, expect, it } from 'vitest'
import { computeNextStreak, getRankForXp, PET_CATALOG } from '../src/lib/gamification'
import { evaluatePinyinAnswer, extractSyllableTones } from '../src/lib/pinyinTools'

describe('Gamification & Pinyin tools', () => {
  it('computes streak continuity accurately across consecutive, same, and missed days', () => {
    expect(computeNextStreak(null, 0, 0, '2026-11-25')).toEqual({
      streak_days: 1,
      longest_streak: 1,
      last_study_date: '2026-11-25',
    })

    expect(computeNextStreak('2026-11-25', 3, 5, '2026-11-25')).toEqual({
      streak_days: 3,
      longest_streak: 5,
      last_study_date: '2026-11-25',
    })

    expect(computeNextStreak('2026-11-24', 5, 5, '2026-11-25')).toEqual({
      streak_days: 6,
      longest_streak: 6,
      last_study_date: '2026-11-25',
    })

    expect(computeNextStreak('2026-11-20', 4, 7, '2026-11-25')).toEqual({
      streak_days: 1,
      longest_streak: 7,
      last_study_date: '2026-11-25',
    })
  })

  it('computes rank tier and progress percentage from XP', () => {
    expect(getRankForXp(0).level).toBe(1)
    expect(getRankForXp(150).level).toBe(2)
    expect(getRankForXp(950).title).toBe('Cao Thủ Thanh Điệu')
    expect(PET_CATALOG).toHaveLength(7)
  })

  it('extracts pinyin syllable tones including 1-4 and neutral tone 5', () => {
    const syllables = extractSyllableTones('nǐ hǎo')
    expect(syllables.map((s) => s.tone)).toEqual([3, 3])
    expect(extractSyllableTones('māma').map((s) => s.tone)).toEqual([1, 5])
    expect(extractSyllableTones('zhōngguó').map((s) => s.tone)).toEqual([1, 2])
  })

  it('evaluates marked, numbered, toneless, and wrong pinyin answers', () => {
    expect(evaluatePinyinAnswer('nǐ hǎo', 'nǐ hǎo').match).toBe('exact')
    expect(evaluatePinyinAnswer('ni3 hao3', 'nǐ hǎo').match).toBe('exact')
    expect(evaluatePinyinAnswer('ni hao', 'nǐ hǎo').match).toBe('toneless')
    expect(evaluatePinyinAnswer('ni4 hao1', 'nǐ hǎo').match).toBe('toneless')
    expect(evaluatePinyinAnswer('wo3 men5', 'nǐ hǎo').match).toBe('wrong')
  })
})
