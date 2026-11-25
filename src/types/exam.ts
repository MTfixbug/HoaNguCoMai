export type ExamSectionKey = 'listening' | 'reading' | 'writing' | 'translation' | 'speaking'

export interface ExamSectionBlueprint {
  key: ExamSectionKey
  label: string
  questionCount: number
  officialMinutes: number
  maxAudioPlays: number | null // 2 for HSK 1-3, 1 for HSK 4-9, null if non-listening
  maxScore: number
}

export interface ExamBlueprint {
  level: number // 1..6, 7 represents HSK 7-9
  title: string
  subtitle: string
  sections: ExamSectionBlueprint[]
  totalScore: number
  passScore: number
  audioReplayRule: '2x' | '1x'
  notes: string
}

export type ExamQuestionKind = 'mcq_audio' | 'mcq_reading' | 'cloze' | 'writing_prompt' | 'translation_prompt'

export interface ExamQuestion {
  id: string
  section: ExamSectionKey
  kind: ExamQuestionKind
  partLabel: string
  prompt: string
  subPrompt?: string
  audioText?: string
  options?: string[]
  correctIndex?: number
  correctAnswer?: string
  explanation: string
  targetWordId?: string
}

export interface ActiveMockExam {
  id: string
  level: number
  mode: 'full' | 'section'
  blueprint: ExamBlueprint
  questions: ExamQuestion[]
  createdAt: number
}
