import { describe, expect, it } from 'vitest'
import { buildMockExamQuestions, EXAM_BLUEPRINTS, getBlueprint, gradeExamAttempt } from '../src/lib/examEngine'
import type { DictEntry } from '../src/types/vocab'

const sampleVocab: DictEntry[] = Array.from({ length: 40 }, (_, i) => ({
  id: `v-${i}`,
  hanzi: `词组${i}`,
  pinyin: `ci zu ${i}`,
  pinyinPlain: `cizu${i}`,
  hanViet: `từ tổ ${i}`,
  meaningVi: `nghĩa thứ ${i}`,
  meaningEn: `meaning ${i}`,
  pos: i % 2 === 0 ? 'Động từ' : 'Danh từ',
  hskNum: 6,
  hskLevel: 'HSK 6',
  exampleZh: `我们每天都在认真学习第${i}个词语。`,
  exampleVi: `Mỗi ngày chúng tôi đều chăm chỉ học từ thứ ${i}.`,
}))

describe('Đề thi thử chuẩn HSK 1-9', () => {
  it('áp dụng đúng quy tắc nghe (2x cho HSK 1-3, 1x cho HSK 4-9) và điểm đạt', () => {
    expect(EXAM_BLUEPRINTS[1].audioReplayRule).toBe('2x')
    expect(EXAM_BLUEPRINTS[2].audioReplayRule).toBe('2x')
    expect(EXAM_BLUEPRINTS[3].audioReplayRule).toBe('2x')
    expect(EXAM_BLUEPRINTS[4].audioReplayRule).toBe('1x')
    expect(EXAM_BLUEPRINTS[5].audioReplayRule).toBe('1x')
    expect(EXAM_BLUEPRINTS[6].audioReplayRule).toBe('1x')
    expect(EXAM_BLUEPRINTS[7].audioReplayRule).toBe('1x')

    expect(EXAM_BLUEPRINTS[1].passScore).toBe(120)
    expect(EXAM_BLUEPRINTS[6].passScore).toBe(180)
    expect(EXAM_BLUEPRINTS[7].passScore).toBe(300)
    expect(getBlueprint(8).level).toBe(7)
    expect(getBlueprint(9).totalScore).toBe(500)
  })

  it('tạo đề thi và chấm điểm trắc nghiệm + viết chính xác', () => {
    const questions = buildMockExamQuestions(6, sampleVocab, [], true)
    expect(questions.length).toBeGreaterThan(10)

    const perfectResponses: Record<string, string | number> = {}
    for (const q of questions) {
      if (q.kind === 'writing_prompt' || q.kind === 'translation_prompt') {
        perfectResponses[q.id] =
          '这篇文章深入讨论了语言学习与跨文化沟通的重要性，提醒我们在日常生活与工作当中保持耐心和持续反思，这样才能真正提高理解能力并取得长期进步。'
      } else {
        perfectResponses[q.id] = q.correctIndex ?? 0
      }
    }

    const grade = gradeExamAttempt(6, questions, perfectResponses)
    expect(grade.listeningScore).toBe(100)
    expect(grade.readingScore).toBe(100)
    expect(grade.writingScore).toBe(85)
    expect(grade.totalScore).toBe(285)
    expect(grade.passed).toBe(true)
    expect(grade.wrongWordIds).toHaveLength(0)
  })

  it('xếp hạng chứng nhận HSK Cấp 7-9 bằng tiếng Việt', () => {
    const qs = buildMockExamQuestions(7, sampleVocab, [], true)
    const allCorrect: Record<string, string | number> = {}
    for (const q of qs) {
      allCorrect[q.id] =
        q.kind === 'writing_prompt' || q.kind === 'translation_prompt'
          ? '当代信息技术的发展改变了人们的沟通方式，然而跨文化对话依然需要尊重、倾听与深入的理解。'.repeat(2)
          : q.correctIndex ?? 0
    }
    const result = gradeExamAttempt(7, qs, allCorrect)
    expect(result.totalScore).toBeGreaterThanOrEqual(430)
    expect(result.hsk79Band).toBe('HSK Cấp 9')
  })
})
