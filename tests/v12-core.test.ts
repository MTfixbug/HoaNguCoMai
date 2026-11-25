import { describe, expect, it } from 'vitest'
import { buildClozeQuestion } from '../src/lib/cloze'
import { buildMockExamQuestions, getBlueprint, gradeExamAttempt } from '../src/lib/examEngine'
import { calculateNextReview, createInitialProgress, LEECH_THRESHOLD } from '../src/lib/srs'
import { mergeProgressMaps } from '../src/lib/syncMerge'
import { buildTodayQueue, MAX_DUE_REVIEWS_PER_DAY, requeueForgottenCard } from '../src/lib/todayQueue'
import type { GrammarPoint } from '../src/types/grammar'
import type { VocabProgressRecord } from '../src/types/lms'
import type { DictEntry } from '../src/types/vocab'

const makeCoreWord = (i: number): DictEntry => ({
  id: `v-${String(i).padStart(5, '0')}`,
  hanzi: `词语${i}`,
  pinyin: `ci yu ${i}`,
  pinyinPlain: `ciyu${i}`,
  hanViet: `từ ngữ ${i}`,
  meaningVi: `nghĩa thứ ${i}`,
  meaningEn: `meaning ${i}`,
  pos: i % 2 === 0 ? 'dt.' : 'đgt.',
  hskNum: 1,
  hskLevel: 'HSK1',
  hsk3Level: 1,
  hsk2Level: 1,
  source: 'core',
  exampleZh: `我每天都在学习词语${i}。`,
  exampleVi: `Tôi học từ ${i} mỗi ngày.`,
})

describe('Hoa Ngữ Cô Mai v1.2 — logic cốt lõi', () => {
  it('giới hạn 100 thẻ ôn/ngày (ưu tiên quá hạn lâu nhất), mặc định 10 từ mới và 1 ngữ pháp', () => {
    const now = Date.UTC(2026, 10, 25, 10, 0, 0)
    const pool = Array.from({ length: 140 }, (_, i) => makeCoreWord(i + 1))
    const progressMap: Record<string, VocabProgressRecord> = {}

    // 115 thẻ quá hạn với thứ tự thời gian ngược nhau để kiểm tra sort
    for (let i = 1; i <= 115; i++) {
      const rec = createInitialProgress('u1', pool[i - 1].id, 1, now)
      rec.repetitions = 1
      rec.next_review_at = new Date(now - (120 - i) * 3_600_000).toISOString()
      progressMap[pool[i - 1].id] = rec
    }

    const g1: GrammarPoint = {
      id: 'g1-01',
      hskLevel: 1,
      category: 'Động từ',
      topic: 'Câu với 是',
      title: 'Câu chữ 是',
      formula: 'A + 是 + B',
      explanationVi: 'Dùng để khẳng định danh từ.',
      viComparison: 'Giống "là" trong tiếng Việt.',
      confusablePairs: [],
      examples: [{ zh: '我是学生。', pinyin: 'Wǒ shì xuésheng.', vi: 'Tôi là học sinh.' }],
      exercises: [],
      reviewed: false,
    }

    const plan = buildTodayQueue({ pool, progressMap, dailyNewLimit: 10, grammarPool: [g1], now })
    expect(plan.dueWords).toHaveLength(MAX_DUE_REVIEWS_PER_DAY)
    expect(plan.overdueOverflowCount).toBe(15)
    expect(plan.dueWords[0].id).toBe('v-00001') // oldest overdue first
    expect(plan.newWords).toHaveLength(10)
    expect(plan.dailyGrammar?.id).toBe('g1-01')

    const requeued = requeueForgottenCard(plan.newWords, 0, 4)
    expect(requeued).toHaveLength(11)
    expect(requeued[5].id).toBe(plan.newWords[0].id)
  })

  it('tự đánh dấu Từ khó (leech) khi wrong_count >= 8', () => {
    let card = createInitialProgress('u1', 'v-00001', 1)
    for (let i = 0; i < LEECH_THRESHOLD; i++) {
      card = calculateNextReview(card, 'again')
    }
    expect(card.wrong_count).toBe(8)
    expect(card.is_flagged_hard).toBe(true)
  })

  it('tạo câu điền từ (cloze) kèm 3 đáp án nhiễu cùng cấp', () => {
    const pool = Array.from({ length: 12 }, (_, i) => makeCoreWord(i + 1))
    const q = buildClozeQuestion(pool[0], pool)
    expect(q).not.toBeNull()
    expect(q!.sentenceMasked).toContain('______')
    expect(q!.options).toHaveLength(4)
    expect(q!.options[q!.correctIndex]).toBe(pool[0].hanzi)
  })

  it('gộp dữ liệu sync theo updated_at mới hơn mà không làm mất tiến độ offline', () => {
    const older = createInitialProgress('u1', 'v-1', 1, 1_000_000)
    const newer = { ...older, repetitions: 3, updated_at: new Date(2_000_000).toISOString() }
    const offlineOnly = createInitialProgress('u1', 'v-2', 1, 1_500_000)
    const merged = mergeProgressMaps({ 'v-1': older, 'v-2': offlineOnly }, { 'v-1': newer })
    expect(merged['v-1'].repetitions).toBe(3)
    expect(merged['v-2'].word_id).toBe('v-2')
  })

  it('hỗ trợ blueprint HSK 3.0 (40/60/70/70/72/82 câu), lọc từ core và chấm % không khẳng định đỗ', () => {
    expect(getBlueprint(1, '3.0').officialTotalQuestions).toBe(40)
    expect(getBlueprint(2, '3.0').officialTotalQuestions).toBe(60)
    expect(getBlueprint(3, '3.0').officialTotalQuestions).toBe(70)
    expect(getBlueprint(4, '3.0').officialTotalQuestions).toBe(70)
    expect(getBlueprint(5, '3.0').officialTotalQuestions).toBe(72)
    expect(getBlueprint(6, '3.0').officialTotalQuestions).toBe(82)

    const mixedPool: DictEntry[] = [
      ...Array.from({ length: 16 }, (_, i) => makeCoreWord(i + 1)),
      { ...makeCoreWord(99), id: 'v-99999', hanzi: '内卷', source: 'extra', topic: 'Từ lóng mạng' },
    ]
    const qs = buildMockExamQuestions(1, mixedPool, [], true, undefined, '3.0')
    expect(qs.some((q) => q.targetWordId === 'v-99999')).toBe(false)
    expect(qs.every((q) => q.kind === 'writing_prompt' || Boolean(q.coaching?.trap && q.coaching?.tip))).toBe(true)

    const grade = gradeExamAttempt(1, qs, {}, '3.0')
    expect(grade.hasOfficialPassScore).toBe(false)
    expect(grade.accuracyPct).toBe(0)
  })
})
