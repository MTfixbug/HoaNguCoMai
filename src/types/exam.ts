import type { HskStandard } from './vocab'

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
  standard: HskStandard
  title: string
  subtitle: string
  sections: ExamSectionBlueprint[]
  officialTotalQuestions: number
  officialMinutes: number
  totalScore: number
  passScore: number
  hasOfficialPassScore: boolean
  audioReplayRule: '2x' | '1x'
  notes: string
}

export interface ExamCoaching {
  trap: string
  tip: string
  miniExample: {
    prompt: string
    options: string[]
    correctIndex: number
    explanation: string
  }
  relatedWordIds?: string[]
  relatedGrammarId?: string
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
  audioUrl?: string
  options?: string[]
  correctIndex?: number
  correctAnswer?: string
  explanation: string
  targetWordId?: string
  coaching?: ExamCoaching
  reviewed?: boolean
}

export interface CuratedExamPaper {
  id: string
  level: number
  standard: HskStandard
  paperNumber: number
  title: string
  subtitle: string
  reviewed: boolean
  questions: ExamQuestion[]
}

export interface ExamTrendProfile {
  level: number
  title: string
  formatSummary: string
  topTraps: string[]
  highYieldTopics: string[]
  timeStrategy: string
  reviewed: boolean
  officialReferenceUrl: string
}

export interface ActiveMockExam {
  id: string
  level: number
  standard: HskStandard
  mode: 'full' | 'section'
  blueprint: ExamBlueprint
  questions: ExamQuestion[]
  createdAt: number
  paperTitle?: string
  reviewed?: boolean
}
