export type UserRole = 'student' | 'admin'
export type AccountStatus = 'pending' | 'approved' | 'locked'
export type StudyMode = 'flashcard' | 'quiz' | 'match' | 'grammar' | 'writing' | 'mock_exam' | 'tone' | 'dictation'
export type MasteryStatus = 'new' | 'learning' | 'familiar' | 'mastered'
export type Rating = 'again' | 'hard' | 'good' | 'easy'
export type PetType = 'cat' | 'shiba' | 'panda' | 'rabbit' | 'fox' | 'dragon' | 'baozi'
export type KudosSticker = 'star' | 'trophy' | 'panda' | 'flower' | 'rocket' | 'heart'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string
  role: UserRole
  account_status: AccountStatus
  current_hsk_level: number // 0 = Mới bắt đầu, 1..9
  target_hsk_level: number // 1..9
  onboarding_completed: boolean
  daily_goal_minutes: number
  preferred_voice: string
  xp_points?: number
  streak_days?: number
  longest_streak?: number
  last_study_date?: string | null
  pet_type?: PetType
  pet_enabled?: boolean
  created_at: string
  last_seen_at: string
}

export interface TeacherKudos {
  id: string
  student_id: string
  created_by: string
  sticker: KudosSticker
  message: string
  xp_bonus: number
  is_seen: boolean
  created_at: string
}

export interface CustomLessonParagraph {
  id: string
  zh: string
  pinyin: string
  vi: string
}

export interface CustomLessonVocab {
  id: string
  hanzi: string
  pinyin: string
  hanViet: string
  pos: string
  meaningVi: string
  exampleZh?: string
  exampleVi?: string
}

export interface CustomLessonGrammar {
  id: string
  title: string
  pattern: string
  explanationVi: string
  examples: { zh: string; pinyin: string; vi: string }[]
}

export interface CustomLessonQuiz {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanationVi: string
}

export interface CustomLesson {
  id: string
  hsk_level: number
  title_zh: string
  title_pinyin: string
  title_vi: string
  summary: string
  paragraphs: CustomLessonParagraph[]
  vocab_items: CustomLessonVocab[]
  grammar_notes: CustomLessonGrammar[]
  quiz_items: CustomLessonQuiz[]
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface StudySession {
  id: string
  user_id: string
  started_at: string
  ended_at: string
  duration_sec: number
  mode: StudyMode
  hsk_level: number
  items_completed: number
  accuracy_pct: number
  device_info: {
    viewport: 'mobile' | 'desktop'
    uaSummary: string
    tz: string
    subMode?: StudyMode
  }
}

export interface UserActivityEvent {
  id: string
  user_id: string
  event_type: 'login' | 'flashcard_batch' | 'quiz_complete' | 'exam_submit' | 'assignment_submit'
  metadata: Record<string, unknown>
  created_at: string
}

export interface VocabProgressRecord {
  user_id: string
  word_id: string
  hsk_level: number
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_at: string
  wrong_count: number
  correct_count: number
  is_flagged_hard: boolean
  mastery_status: MasteryStatus
  updated_at: string
}

export type AssignmentTargetType = 'vocab_pack' | 'quiz' | 'mock_exam' | 'lesson'

export interface Assignment {
  id: string
  title: string
  description: string
  target_type: AssignmentTargetType
  config: {
    hskLevel: number
    itemCount?: number
    lessonId?: string
    examMode?: 'full' | 'section'
    quizMode?: string
    requiredWords?: string[]
  }
  assigned_to: 'all' | string[]
  due_at: string
  pass_score: number
  created_by: string
  created_at: string
}

export type SubmissionStatus = 'pending' | 'in_progress' | 'submitted' | 'graded'

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  user_id: string
  status: SubmissionStatus
  score: number
  max_score: number
  duration_sec: number
  answers: Record<string, unknown>
  mistakes: string[]
  submitted_at: string | null
  admin_feedback: string
}

export interface ExamAttemptRecord {
  id: string
  user_id: string
  hsk_level: number
  mode: 'full' | 'section'
  listening_score: number
  reading_score: number
  writing_score: number
  total_score: number
  passed: boolean
  section_timings: Record<string, number>
  responses: Record<string, string | number>
  writing_text?: string
  writing_prompt?: string
  admin_reviewed?: boolean
  admin_feedback?: string
  created_at: string
}

export interface ClientSettings {
  theme: 'system' | 'light' | 'dark'
  hanziSize: 'md' | 'lg' | 'xl'
  ttsRate: number
  ttsVoiceURI: string
  autoSpeak: boolean
  showPinyin: boolean
  showHanViet: boolean
  showMeaning: boolean
  petType: PetType
  petEnabled: boolean
  stickersEnabled: boolean
}
