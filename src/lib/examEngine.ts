import { AntiStreakTracker, generateMCQOptions, shuffleArray } from './randomizer'
import type { ExamBlueprint, ExamCoaching, ExamQuestion, ExamSectionKey } from '../types/exam'
import type { CustomLesson } from '../types/lms'
import type { DictEntry, HskStandard } from '../types/vocab'

export const EXAM_BLUEPRINTS_20: Record<number, ExamBlueprint> = {
  1: {
    level: 1,
    standard: '2.0',
    title: 'Đề thi thử HSK 2.0 Cấp 1',
    subtitle: 'Giao tiếp hằng ngày nền tảng (150 từ HSK 2.0)',
    audioReplayRule: '2x',
    officialTotalQuestions: 40,
    officialMinutes: 35,
    totalScore: 200,
    passScore: 120,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 2.0: Nghe tối đa 2 lần mỗi câu. Tổng điểm đạt từ 120/200 trở lên.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 20, officialMinutes: 15, maxAudioPlays: 2, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 20, officialMinutes: 17, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  2: {
    level: 2,
    standard: '2.0',
    title: 'Đề thi thử HSK 2.0 Cấp 2',
    subtitle: 'Hội thoại sơ cấp (300 từ HSK 2.0 tích lũy)',
    audioReplayRule: '2x',
    officialTotalQuestions: 60,
    officialMinutes: 50,
    totalScore: 200,
    passScore: 120,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 2.0: Nghe phát 2 lần mỗi câu; tổng điểm đạt từ 120/200 trở lên.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 35, officialMinutes: 25, maxAudioPlays: 2, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 25, officialMinutes: 22, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  3: {
    level: 3,
    standard: '2.0',
    title: 'Đề thi thử HSK 2.0 Cấp 3',
    subtitle: 'Giao tiếp đời sống, học tập và du lịch trung cấp',
    audioReplayRule: '2x',
    officialTotalQuestions: 80,
    officialMinutes: 85,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 2.0 bổ sung phần Viết; phần Nghe phát 2 lần. Tổng điểm đạt từ 180/300 trở lên.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 40, officialMinutes: 35, maxAudioPlays: 2, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 30, officialMinutes: 30, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 10, officialMinutes: 15, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  4: {
    level: 4,
    standard: '2.0',
    title: 'Đề thi thử HSK 2.0 Cấp 4',
    subtitle: 'Thảo luận độc lập nhiều chủ đề học tập và công việc',
    audioReplayRule: '1x',
    officialTotalQuestions: 100,
    officialMinutes: 100,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 2.0 chỉ được nghe 1 lần duy nhất mỗi câu. Tổng điểm đạt từ 180/300 trở lên.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 45, officialMinutes: 30, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 40, officialMinutes: 40, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 15, officialMinutes: 25, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  5: {
    level: 5,
    standard: '2.0',
    title: 'Đề thi thử HSK 2.0 Cấp 5',
    subtitle: 'Đọc báo chí, hiểu truyền thông và viết đoạn văn ngắn',
    audioReplayRule: '1x',
    officialTotalQuestions: 100,
    officialMinutes: 120,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 2.0 nghe 1 lần duy nhất. Tổng điểm đạt từ 180/300 trở lên.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 45, officialMinutes: 30, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 45, officialMinutes: 45, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 10, officialMinutes: 40, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  6: {
    level: 6,
    standard: '2.0',
    title: 'Đề thi thử HSK 2.0 Cấp 6',
    subtitle: 'Đọc hiểu nâng cao và tóm tắt bài văn ~400 chữ (缩写)',
    audioReplayRule: '1x',
    officialTotalQuestions: 101,
    officialMinutes: 135,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 2.0: Nghe 1 lần, Đọc hiểu điền khuyết/đọc đoạn và Viết tóm tắt (缩写). Đạt >= 180/300.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 50, officialMinutes: 35, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 50, officialMinutes: 50, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết tóm tắt (缩写)', questionCount: 1, officialMinutes: 45, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  7: {
    level: 7,
    standard: '2.0',
    title: 'Đề thi hợp nhất HSK Cấp 7–9',
    subtitle: 'Đánh giá trình độ cao cấp học thuật & chuyên sâu (Cấp 7, 8, 9)',
    audioReplayRule: '1x',
    officialTotalQuestions: 74,
    officialMinutes: 200,
    totalScore: 500,
    passScore: 300,
    hasOfficialPassScore: true,
    notes: 'Chuẩn HSK 7–9 gồm 5 kỹ năng (mỗi kỹ năng 100 điểm): Đạt HSK 7 >= 300, HSK 8 >= 375, HSK 9 >= 430.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 34, officialMinutes: 33, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 30, officialMinutes: 48, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 2, officialMinutes: 55, maxAudioPlays: null, maxScore: 100 },
      { key: 'translation', label: 'Dịch thuật', questionCount: 4, officialMinutes: 42, maxAudioPlays: null, maxScore: 100 },
      { key: 'speaking', label: 'Nói', questionCount: 4, officialMinutes: 22, maxAudioPlays: 1, maxScore: 100 },
    ],
  },
}

export const EXAM_BLUEPRINTS_30: Record<number, ExamBlueprint> = {
  1: {
    level: 1,
    standard: '3.0',
    title: 'Đề thi thử HSK 3.0 Cấp 1 (Bản chốt 11/2025)',
    subtitle: '40 câu / 40 phút · 300 từ chuẩn HSK 3.0',
    audioReplayRule: '2x',
    officialTotalQuestions: 40,
    officialMinutes: 40,
    totalScore: 200,
    passScore: 120,
    hasOfficialPassScore: false,
    notes: 'Chuẩn HSK 3.0 áp dụng từ 13/12/2026: 40 câu / ~40 phút. Chấm theo % đúng và điểm ước lượng tham khảo.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 20, officialMinutes: 20, maxAudioPlays: 2, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 20, officialMinutes: 20, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  2: {
    level: 2,
    standard: '3.0',
    title: 'Đề thi thử HSK 3.0 Cấp 2 (Bản chốt 11/2025)',
    subtitle: '60 câu / 60 phút · 500 từ tích lũy HSK 3.0',
    audioReplayRule: '2x',
    officialTotalQuestions: 60,
    officialMinutes: 60,
    totalScore: 200,
    passScore: 120,
    hasOfficialPassScore: false,
    notes: 'Chuẩn HSK 3.0: 60 câu / ~60 phút. Chấm theo % đúng và điểm ước lượng tham khảo (chưa công bố ngưỡng đỗ riêng).',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 35, officialMinutes: 25, maxAudioPlays: 2, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 25, officialMinutes: 35, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  3: {
    level: 3,
    standard: '3.0',
    title: 'Đề thi thử HSK 3.0 Cấp 3 (Bản chốt 11/2025)',
    subtitle: '70 câu / 83 phút làm bài (+15 phút nghe) · 1.000 từ',
    audioReplayRule: '2x',
    officialTotalQuestions: 70,
    officialMinutes: 98,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: false,
    notes: 'Chuẩn HSK 3.0: 70 câu, tổng ~98 phút (83 phút làm bài + ~15 phút nghe). Hiển thị % đúng và điểm ước lượng tham khảo.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 35, officialMinutes: 15, maxAudioPlays: 2, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 25, officialMinutes: 43, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 10, officialMinutes: 40, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  4: {
    level: 4,
    standard: '3.0',
    title: 'Đề thi thử HSK 3.0 Cấp 4 (Bản chốt 11/2025)',
    subtitle: '70 câu / 85 phút làm bài (+20 phút nghe) · 2.000 từ',
    audioReplayRule: '1x',
    officialTotalQuestions: 70,
    officialMinutes: 105,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: false,
    notes: 'Chuẩn HSK 3.0: 70 câu, tổng ~105 phút (85 phút + ~20 phút nghe 1 lần). Hiển thị % đúng và điểm ước lượng.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 35, officialMinutes: 20, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 25, officialMinutes: 45, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 10, officialMinutes: 40, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  5: {
    level: 5,
    standard: '3.0',
    title: 'Đề thi thử HSK 3.0 Cấp 5 (Bản chốt 11/2025)',
    subtitle: '72 câu / 110 phút làm bài (+23 phút nghe) · 3.600 từ',
    audioReplayRule: '1x',
    officialTotalQuestions: 72,
    officialMinutes: 133,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: false,
    notes: 'Chuẩn HSK 3.0: 72 câu, tổng ~133 phút (110 phút + ~23 phút nghe 1 lần). Chấm theo % đúng và điểm ước lượng.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 35, officialMinutes: 23, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 25, officialMinutes: 55, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết', questionCount: 12, officialMinutes: 55, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  6: {
    level: 6,
    standard: '3.0',
    title: 'Đề thi thử HSK 3.0 Cấp 6 (Bản chốt 11/2025)',
    subtitle: '82 câu / 125 phút làm bài (+23 phút nghe) · 5.400 từ',
    audioReplayRule: '1x',
    officialTotalQuestions: 82,
    officialMinutes: 148,
    totalScore: 300,
    passScore: 180,
    hasOfficialPassScore: false,
    notes: 'Chuẩn HSK 3.0: 82 câu, tổng ~148 phút (125 phút + ~23 phút nghe 1 lần). Chấm theo % đúng và điểm ước lượng.',
    sections: [
      { key: 'listening', label: 'Nghe hiểu', questionCount: 40, officialMinutes: 23, maxAudioPlays: 1, maxScore: 100 },
      { key: 'reading', label: 'Đọc hiểu', questionCount: 40, officialMinutes: 65, maxAudioPlays: null, maxScore: 100 },
      { key: 'writing', label: 'Viết & Tóm tắt', questionCount: 2, officialMinutes: 60, maxAudioPlays: null, maxScore: 100 },
    ],
  },
  7: EXAM_BLUEPRINTS_20[7],
}

/** Backwards-compatible alias defaulting to HSK 2.0 pass thresholds */
export const EXAM_BLUEPRINTS = EXAM_BLUEPRINTS_20

export function getBlueprint(level: number, standard: HskStandard = '2.0'): ExamBlueprint {
  const map = standard === '3.0' ? EXAM_BLUEPRINTS_30 : EXAM_BLUEPRINTS_20
  if (level >= 7) return map[7]
  return map[Math.max(1, Math.min(6, level))]
}

function buildGeneratedCoaching(w: DictEntry, pool: DictEntry[]): ExamCoaching {
  const sameLevelDistractor = pool.find((p) => p.id !== w.id && p.hanzi !== w.hanzi)
  const trap =
    w.pos.includes('đgt.')
      ? `Dễ nhầm từ loại động từ/tân ngữ đi sau "${w.hanzi}" hoặc nhầm với "${sameLevelDistractor?.hanzi ?? w.hanzi}".`
      : `Dễ chọn nhầm từ có âm Hán-Việt gần giống (${w.hanViet}) hoặc lệch sắc thái nghĩa "${w.meaningVi.split(';')[0]}".`
  const tip = `Nhớ bộ chữ & Hán-Việt "${w.hanViet}" (${w.pos || 'từ khóa'}): gạch chân cụm từ đi kèm trước khi chọn đáp án.`
  const altOpts = [
    w.meaningVi.split(';')[0].trim(),
    ...(sameLevelDistractor ? [sameLevelDistractor.meaningVi.split(';')[0].trim()] : []),
    'không liên quan ngữ cảnh',
  ]
  while (altOpts.length < 3) altOpts.push('nghĩa khác')
  return {
    trap,
    tip,
    miniExample: {
      prompt: `Kiểm tra nhanh nghĩa cốt lõi của “${w.hanzi}” [${w.pinyin}]:`,
      options: altOpts,
      correctIndex: 0,
      explanation: `${w.hanzi} [${w.pinyin}] (Hán-Việt: ${w.hanViet}) nghĩa là "${w.meaningVi}".`,
    },
    relatedWordIds: [w.id],
  }
}

export function buildMockExamQuestions(
  level: number,
  vocabPool: DictEntry[],
  customLessons: CustomLesson[] = [],
  compactSample = true,
  sectionOnly?: ExamSectionKey,
  standard: HskStandard = '2.0',
): ExamQuestion[] {
  const bp = getBlueprint(level, standard)
  const tracker = new AntiStreakTracker()
  // Only pull from HSK syllabus core words (`source !== 'extra'`) for mock exam questions
  const corePool = vocabPool.filter((w) => w.source !== 'extra')
  const pool = corePool.length >= 8 ? corePool : vocabPool.length >= 8 ? vocabPool : []
  const shuffled = shuffleArray(pool)
  const questions: ExamQuestion[] = []
  let cursor = 0

  const nextWord = (): DictEntry | undefined => {
    if (!shuffled.length) return undefined
    const w = shuffled[cursor % shuffled.length]
    cursor++
    return w
  }

  const targetSections = sectionOnly ? bp.sections.filter((s) => s.key === sectionOnly) : bp.sections

  for (const sec of targetSections) {
    const itemTarget = compactSample
      ? sec.key === 'writing' || sec.key === 'translation' || sec.key === 'speaking'
        ? Math.min(2, sec.questionCount)
        : Math.min(12, sec.questionCount)
      : sec.questionCount

    if (sec.key === 'listening') {
      for (let i = 0; i < itemTarget; i++) {
        const w = nextWord()
        if (!w) break
        const { options, correctIndex } = generateMCQOptions(w, pool, 4, tracker)
        questions.push({
          id: `ex-${level}-l-${i + 1}`,
          section: 'listening',
          kind: 'mcq_audio',
          partLabel: `Nghe hiểu · Câu ${i + 1} (${bp.audioReplayRule === '2x' ? 'Nghe 2 lần' : 'Nghe 1 lần'})`,
          prompt: w.exampleZh || `请听录音，选择与 “${w.hanzi}” 最匹配的解释：`,
          subPrompt: `Nhấn phát âm để nghe (tối đa ${sec.maxAudioPlays ?? 1} lần).`,
          audioText: w.exampleZh || w.hanzi,
          options: options.map((o) => `${o.hanzi} — ${o.meaningVi}`),
          correctIndex,
          explanation: `${w.hanzi} [${w.pinyin}] (${w.hanViet}): ${w.meaningVi}`,
          targetWordId: w.id,
          coaching: buildGeneratedCoaching(w, pool),
          reviewed: true,
        })
      }
    } else if (sec.key === 'reading') {
      const lessonQuizPool = shuffleArray(
        customLessons
          .filter((l) => l.is_published && Math.abs(l.hsk_level - level) <= 1)
          .flatMap((l) => l.quiz_items.map((q) => ({ title: l.title_zh, q }))),
      )

      let usedCustom = 0
      for (let i = 0; i < itemTarget; i++) {
        if (usedCustom < lessonQuizPool.length && i % 3 === 1) {
          const item = lessonQuizPool[usedCustom++]
          const adj = tracker.adjustCorrectIndex(item.q.options, item.q.answer)
          questions.push({
            id: `ex-${level}-r-cl-${i + 1}`,
            section: 'reading',
            kind: 'mcq_reading',
            partLabel: `Đọc hiểu · Bài lớp (${item.title})`,
            prompt: item.q.prompt,
            subPrompt: 'Chọn đáp án phù hợp nhất theo bài học của lớp:',
            options: adj.options,
            correctIndex: adj.correctIndex,
            explanation: item.q.explanationVi,
            reviewed: true,
          })
          continue
        }

        const w = nextWord()
        if (!w) break
        const { options, correctIndex } = generateMCQOptions(w, pool, 4, tracker)
        const hasEx = Boolean(w.exampleZh && w.exampleZh.includes(w.hanzi))
        questions.push({
          id: `ex-${level}-r-${i + 1}`,
          section: 'reading',
          kind: hasEx ? 'cloze' : 'mcq_reading',
          partLabel: hasEx ? `Đọc hiểu · Điền từ Câu ${i + 1}` : `Đọc hiểu · Từ vựng Câu ${i + 1}`,
          prompt: hasEx ? w.exampleZh!.replace(w.hanzi, '（ ______ ）') : `${w.meaningVi}`,
          subPrompt: hasEx ? `Ngữ cảnh: ${w.exampleVi ?? ''}` : `Chọn từ tiếng Trung chính xác (${w.pos || 'Từ vựng'}):`,
          options: hasEx ? options.map((o) => `${o.hanzi} (${o.pinyin})`) : options.map((o) => `${o.hanzi} [${o.hanViet}]`),
          correctIndex,
          explanation: `${w.hanzi} (${w.pinyin}): ${w.meaningVi}`,
          targetWordId: w.id,
          coaching: buildGeneratedCoaching(w, pool),
          reviewed: true,
        })
      }
    } else if (sec.key === 'writing') {
      if (level >= 6) {
        questions.push({
          id: `ex-${level}-w-1`,
          section: 'writing',
          kind: 'writing_prompt',
          partLabel: 'Viết · Tóm tắt & Nghị luận (缩写)',
          prompt: '请用400字左右阐述“长期坚持与习惯养成”对学习与工作的积极影响，注意结构清晰、用词得体。',
          subPrompt: 'Viết bài bằng tiếng Trung vào khung bên dưới; Giáo viên sẽ xem và chấm điểm trực tiếp.',
          explanation: 'Chấm theo mạch lạc ý, giữ đủ ý chính, đúng ngữ pháp và độ dài quy định.',
          reviewed: true,
        })
      } else {
        for (let i = 0; i < itemTarget; i++) {
          const w = nextWord()
          if (!w) break
          questions.push({
            id: `ex-${level}-w-${i + 1}`,
            section: 'writing',
            kind: 'writing_prompt',
            partLabel: `Viết · Đặt câu Câu ${i + 1}`,
            prompt: `Hãy dùng từ “${w.hanzi}” (${w.pinyin} — ${w.meaningVi}) để đặt 1 câu tiếng Trung hoàn chỉnh:`,
            subPrompt: w.exampleZh ? `Ví dụ tham khảo nghĩa: ${w.exampleVi}` : 'Lưu ý trật tự Chủ ngữ + Thời gian/Nơi chốn + Động từ + Tân ngữ.',
            correctAnswer: w.hanzi,
            explanation: w.exampleZh ? `Câu mẫu: ${w.exampleZh} (${w.exampleVi})` : `Cần có từ khóa ${w.hanzi}.`,
            targetWordId: w.id,
            reviewed: true,
          })
        }
      }
    } else if (sec.key === 'translation' || sec.key === 'speaking') {
      const w1 = nextWord()
      questions.push({
        id: `ex-${level}-${sec.key}-1`,
        section: sec.key,
        kind: 'translation_prompt',
        partLabel: sec.key === 'translation' ? 'Dịch thuật · Việt ↔ Trung' : 'Nói · Dàn ý trình bày',
        prompt:
          w1?.exampleVi && w1?.exampleZh
            ? `${sec.key === 'translation' ? 'Dịch câu sau sang tiếng Trung trang trọng' : 'Soạn đoạn trình bày ngắn sử dụng từ'} “${w1.hanzi}”: 「${w1.exampleVi}」`
            : '请用得体的书面汉语谈谈现代科技对跨文化交流的影响（约120–200字）。',
        subPrompt: 'Nhập bài làm bằng tiếng Trung; hệ thống sẽ lưu lại để giáo viên đánh giá chi tiết.',
        correctAnswer: w1?.exampleZh,
        explanation: w1?.exampleZh ? `Câu tiếng Trung gợi ý: ${w1.exampleZh}` : 'Đánh giá theo văn phong học thuật và độ liên kết câu.',
        targetWordId: w1?.id,
        reviewed: true,
      })
    }
  }

  return questions
}

export interface GradeResult {
  listeningScore: number
  readingScore: number
  writingScore: number
  totalScore: number
  maxPossible: number
  accuracyPct: number
  hasOfficialPassScore: boolean
  passed: boolean
  wrongWordIds: string[]
  wrongGrammarIds: string[]
  sectionAccuracy: Record<string, { correct: number; total: number }>
  hsk79Band?: string
}

export function gradeExamAttempt(
  level: number,
  questions: ExamQuestion[],
  responses: Record<string, string | number>,
  standard: HskStandard = '2.0',
): GradeResult {
  const bp = getBlueprint(level, standard)
  const wrongWordIds: string[] = []
  const wrongGrammarIds: string[] = []
  const bySec: Record<string, { correct: number; total: number }> = {
    listening: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
    translation: { correct: 0, total: 0 },
    speaking: { correct: 0, total: 0 },
  }

  for (const q of questions) {
    const resp = responses[q.id]
    if (q.kind === 'mcq_audio' || q.kind === 'mcq_reading' || q.kind === 'cloze') {
      bySec[q.section].total += 1
      if (resp === q.correctIndex) {
        bySec[q.section].correct += 1
      } else {
        if (q.targetWordId) wrongWordIds.push(q.targetWordId)
        if (q.coaching?.relatedWordIds) wrongWordIds.push(...q.coaching.relatedWordIds)
        if (q.coaching?.relatedGrammarId) wrongGrammarIds.push(q.coaching.relatedGrammarId)
      }
    } else {
      bySec[q.section].total += 1
      const txt = typeof resp === 'string' ? resp.trim() : ''
      if (txt.length >= 60 || (q.correctAnswer && txt.includes(q.correctAnswer.slice(0, 2)))) {
        bySec[q.section].correct += 0.85
      } else if (txt.length >= 8) {
        bySec[q.section].correct += 0.6
      }
    }
  }

  const scale = (k: ExamSectionKey) =>
    bySec[k].total > 0 ? Math.round((bySec[k].correct / bySec[k].total) * 100) : 0

  const listeningScore = scale('listening')
  const readingScore = scale('reading')
  const hasWriting = bp.sections.some((s) => s.key === 'writing')
  const writingScore = hasWriting ? scale('writing') : 0
  const extraScore = level >= 7 ? scale('translation') + scale('speaking') : 0

  const totalScore = listeningScore + readingScore + writingScore + extraScore
  const totalCorrect = Object.values(bySec).reduce((acc, s) => acc + s.correct, 0)
  const totalItems = Object.values(bySec).reduce((acc, s) => acc + s.total, 0)
  const accuracyPct = totalItems > 0 ? Math.round((totalCorrect / totalItems) * 100) : 0
  const passed = totalScore >= bp.passScore

  let hsk79Band: string | undefined
  if (level >= 7) {
    if (totalScore >= 430) hsk79Band = 'HSK Cấp 9'
    else if (totalScore >= 375) hsk79Band = 'HSK Cấp 8'
    else if (totalScore >= 300) hsk79Band = 'HSK Cấp 7'
    else hsk79Band = 'Chưa đạt HSK 7'
  }

  return {
    listeningScore,
    readingScore,
    writingScore,
    totalScore,
    maxPossible: bp.totalScore,
    accuracyPct,
    hasOfficialPassScore: bp.hasOfficialPassScore,
    passed,
    wrongWordIds: Array.from(new Set(wrongWordIds)),
    wrongGrammarIds: Array.from(new Set(wrongGrammarIds)),
    sectionAccuracy: bySec,
    hsk79Band,
  }
}
