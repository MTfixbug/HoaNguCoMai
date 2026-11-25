import { getSupabase, isSupabaseConfigured } from './supabase'
import type {
  Assignment,
  AssignmentSubmission,
  ClientSettings,
  CustomLesson,
  ExamAttemptRecord,
  StudyMode,
  StudySession,
  TeacherKudos,
  UserActivityEvent,
  UserProfile,
  VocabProgressRecord,
} from '../types/lms'

const STORAGE_KEY = 'zhweb_lms_store_v3'

export const defaultClientSettings: ClientSettings = {
  theme: 'system',
  hanziSize: 'lg',
  ttsRate: 0.85,
  ttsVoiceURI: '',
  autoSpeak: true,
  showPinyin: true,
  showHanViet: true,
  showMeaning: true,
  petType: 'cat',
  petEnabled: true,
  stickersEnabled: true,
}

export interface LmsStoreSnapshot {
  demoRole: 'student' | 'admin'
  settings: ClientSettings
  profiles: UserProfile[]
  customLessons: CustomLesson[]
  progressMap: Record<string, VocabProgressRecord>
  allStudentProgress: Record<string, Record<string, VocabProgressRecord>>
  sessions: StudySession[]
  events: UserActivityEvent[]
  assignments: Assignment[]
  submissions: AssignmentSubmission[]
  examAttempts: ExamAttemptRecord[]
  kudos: TeacherKudos[]
  recentIds: string[]
  pendingSyncEvents: UserActivityEvent[]
}

const isoDaysAgo = (days: number, hour = 19) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

const isoDaysAhead = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}

export const DEMO_STUDENT_ID = '00000000-0000-4000-8000-000000000101'
export const DEMO_ADMIN_ID = '00000000-0000-4000-8000-000000000001'

function createSeedStore(): LmsStoreSnapshot {
  const demoStudent2 = '00000000-0000-4000-8000-000000000102'

  const profiles: UserProfile[] = [
    {
      id: DEMO_ADMIN_ID,
      email: 'admin@zhweb.vn',
      full_name: 'Khánh Mai',
      avatar_url: '',
      role: 'admin',
      account_status: 'approved',
      current_hsk_level: 6,
      target_hsk_level: 9,
      onboarding_completed: true,
      daily_goal_minutes: 30,
      preferred_voice: '',
      xp_points: 0,
      streak_days: 0,
      longest_streak: 0,
      last_study_date: null,
      pet_type: 'cat',
      pet_enabled: false,
      created_at: isoDaysAgo(45),
      last_seen_at: isoDaysAgo(0, 9),
    },
    {
      id: DEMO_STUDENT_ID,
      email: 'minh.anh@gmail.com',
      full_name: 'Minh Anh',
      avatar_url: '',
      role: 'student',
      account_status: 'approved',
      current_hsk_level: 2,
      target_hsk_level: 5,
      onboarding_completed: true,
      daily_goal_minutes: 20,
      preferred_voice: '',
      xp_points: 185,
      streak_days: 4,
      longest_streak: 6,
      last_study_date: new Date().toLocaleDateString('en-CA'),
      pet_type: 'cat',
      pet_enabled: true,
      created_at: isoDaysAgo(30),
      last_seen_at: isoDaysAgo(0, 8),
    },
    {
      id: demoStudent2,
      email: 'gia.huy@gmail.com',
      full_name: 'Gia Huy',
      avatar_url: '',
      role: 'student',
      account_status: 'pending',
      current_hsk_level: 0,
      target_hsk_level: 4,
      onboarding_completed: false,
      daily_goal_minutes: 20,
      preferred_voice: '',
      xp_points: 0,
      streak_days: 0,
      longest_streak: 0,
      last_study_date: null,
      pet_type: 'shiba',
      pet_enabled: true,
      created_at: isoDaysAgo(1),
      last_seen_at: isoDaysAgo(1, 20),
    },
  ]

  const customLessons: CustomLesson[] = [
    {
      id: 'lesson-seed-hsk1',
      hsk_level: 1,
      title_zh: '你好，认识你很高兴',
      title_pinyin: 'Nǐ hǎo, rènshi nǐ hěn gāoxìng',
      title_vi: 'Chào hỏi và làm quen cơ bản (HSK 1)',
      summary: 'Bài mở đầu giúp học viên nắm vững đại từ nhân xưng, cách chào hỏi và giới thiệu tên.',
      paragraphs: [
        {
          id: 'p-1',
          zh: '你好！我叫小明。认识你很高兴，你最近忙不忙？',
          pinyin: 'Nǐ hǎo! Wǒ jiào Xiǎomíng. Rènshi nǐ hěn gāoxìng, nǐ zuìjìn máng bu máng?',
          vi: 'Xin chào! Mình tên là Tiểu Minh. Rất vui được làm quen với bạn, dạo này bạn có bận không?',
        },
      ],
      vocab_items: [
        { id: 'cl-v1', hanzi: '认识', pinyin: 'rènshi', hanViet: 'nhận thức', pos: 'Động từ', meaningVi: 'làm quen, biết' },
        { id: 'cl-v2', hanzi: '高兴', pinyin: 'gāoxìng', hanViet: 'cao hứng', pos: 'Tính từ', meaningVi: 'vui mừng' },
        { id: 'cl-v3', hanzi: '最近', pinyin: 'zuìjìn', hanViet: 'tối cận', pos: 'Danh từ', meaningVi: 'dạo này, gần đây' },
      ],
      grammar_notes: [
        {
          id: 'cl-g1',
          title: 'Câu hỏi chính phản với 不',
          pattern: 'Chủ ngữ + Động từ/Tính từ + 不 + Động từ/Tính từ?',
          explanationVi: 'Dùng để hỏi có/không một cách tự nhiên mà không cần từ để hỏi 吗 ở cuối câu.',
          examples: [{ zh: '你今天忙不忙？', pinyin: 'Nǐ jīntiān máng bu máng?', vi: 'Hôm nay bạn có bận không?' }],
        },
      ],
      quiz_items: [
        {
          id: 'cl-q1',
          prompt: '认识你很（  ）。',
          options: ['高兴', '明天', '老师', '学校'],
          answer: 0,
          explanationVi: '“认识你很高兴” nghĩa là “Rất vui được quen biết bạn”.',
        },
      ],
      is_published: true,
      created_by: DEMO_ADMIN_ID,
      created_at: isoDaysAgo(5),
      updated_at: isoDaysAgo(5),
    },
  ]

  const assignments: Assignment[] = [
    {
      id: 'assign-01',
      title: 'Ôn luyện 20 từ trọng tâm HSK theo lộ trình',
      description: 'Hoàn thành tối thiểu 20 câu hỏi trắc nghiệm và đạt độ chính xác từ 80% trở lên.',
      target_type: 'quiz',
      config: { hskLevel: 2, itemCount: 20 },
      assigned_to: 'all',
      due_at: isoDaysAhead(4),
      pass_score: 80,
      created_by: DEMO_ADMIN_ID,
      created_at: isoDaysAgo(2),
    },
  ]

  const sessions: StudySession[] = [
    {
      id: 'sess-1',
      user_id: DEMO_STUDENT_ID,
      started_at: isoDaysAgo(0, 8),
      ended_at: isoDaysAgo(0, 8),
      duration_sec: 720,
      mode: 'flashcard',
      hsk_level: 2,
      items_completed: 20,
      accuracy_pct: 90,
      device_info: { viewport: 'mobile', uaSummary: 'Safari', tz: 'Asia/Ho_Chi_Minh' },
    },
  ]

  const events: UserActivityEvent[] = [
    {
      id: 'evt-seed-1',
      user_id: DEMO_STUDENT_ID,
      event_type: 'flashcard_batch',
      metadata: { items: 20 },
      created_at: isoDaysAgo(0, 8),
    },
  ]

  return {
    demoRole: 'student',
    settings: { ...defaultClientSettings },
    profiles,
    customLessons,
    progressMap: {},
    allStudentProgress: {},
    sessions,
    events,
    assignments,
    submissions: [],
    examAttempts: [],
    kudos: [],
    recentIds: [],
    pendingSyncEvents: [],
  }
}

export function loadLocalStore(): LmsStoreSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedStore()
    const parsed = JSON.parse(raw) as Partial<LmsStoreSnapshot>
    const seed = createSeedStore()
    return {
      ...seed,
      ...parsed,
      settings: { ...defaultClientSettings, ...(parsed.settings ?? {}) },
      profiles: Array.isArray(parsed.profiles) && parsed.profiles.length ? parsed.profiles : seed.profiles,
      customLessons: Array.isArray(parsed.customLessons) ? parsed.customLessons : seed.customLessons,
      progressMap: parsed.progressMap ?? seed.progressMap,
      allStudentProgress: parsed.allStudentProgress ?? {},
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : seed.sessions,
      events: Array.isArray(parsed.events) ? parsed.events : seed.events,
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : seed.assignments,
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : seed.submissions,
      examAttempts: Array.isArray(parsed.examAttempts) ? parsed.examAttempts : seed.examAttempts,
      kudos: Array.isArray(parsed.kudos) ? parsed.kudos : seed.kudos,
      recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds.slice(0, 60) : [],
      pendingSyncEvents: Array.isArray(parsed.pendingSyncEvents) ? parsed.pendingSyncEvents : [],
    }
  } catch {
    return createSeedStore()
  }
}

export function saveLocalStore(store: LmsStoreSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Bỏ qua nếu đầy bộ nhớ trình duyệt
  }
}

export function resetLocalStore() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getDeviceSummary(): StudySession['device_info'] {
  if (typeof window === 'undefined') return { viewport: 'desktop', uaSummary: 'node', tz: 'UTC' }
  return {
    viewport: window.innerWidth < 768 ? 'mobile' : 'desktop',
    uaSummary: navigator.userAgent.slice(0, 72),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

export async function syncRemoteState(userId: string, isAdmin: boolean) {
  const sb = getSupabase()
  if (!sb || !isSupabaseConfigured()) return null

  const [profRes, lessonRes, vocabRes, sessRes, evtRes, assignRes, subRes, examRes, kudosRes] = await Promise.all([
    isAdmin
      ? sb.from('profiles').select('*').order('created_at', { ascending: false })
      : sb.from('profiles').select('*').eq('id', userId),
    sb.from('custom_lessons').select('*').order('hsk_level', { ascending: true }).order('created_at', { ascending: false }),
    isAdmin
      ? sb.from('vocab_progress').select('*')
      : sb.from('vocab_progress').select('*').eq('user_id', userId),
    isAdmin
      ? sb.from('study_sessions').select('*').order('started_at', { ascending: false }).limit(250)
      : sb.from('study_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(100),
    isAdmin
      ? sb.from('user_activity_events').select('*').order('created_at', { ascending: false }).limit(300)
      : sb.from('user_activity_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('assignments').select('*').order('due_at', { ascending: true }),
    isAdmin
      ? sb.from('assignment_submissions').select('*')
      : sb.from('assignment_submissions').select('*').eq('user_id', userId),
    isAdmin
      ? sb.from('exam_attempts').select('*').order('created_at', { ascending: false }).limit(150)
      : sb.from('exam_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    isAdmin
      ? sb.from('teacher_kudos').select('*').order('created_at', { ascending: false }).limit(100)
      : sb.from('teacher_kudos').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(30),
  ])

  const progressMap: Record<string, VocabProgressRecord> = {}
  const allStudentProgress: Record<string, Record<string, VocabProgressRecord>> = {}
  for (const r of (vocabRes.data ?? []) as VocabProgressRecord[]) {
    if (r.user_id === userId) progressMap[r.word_id] = r
    allStudentProgress[r.user_id] ??= {}
    allStudentProgress[r.user_id][r.word_id] = r
  }

  const hydratedSessions = ((sessRes.data ?? []) as StudySession[]).map((row) => ({
    ...row,
    mode: (row.device_info?.subMode as StudyMode | undefined) ?? row.mode,
  }))

  return {
    profiles: (profRes.data ?? []) as UserProfile[],
    customLessons: (lessonRes.data ?? []) as CustomLesson[],
    progressMap,
    allStudentProgress,
    sessions: hydratedSessions,
    events: (evtRes.data ?? []) as UserActivityEvent[],
    assignments: (assignRes.data ?? []) as Assignment[],
    submissions: (subRes.data ?? []) as AssignmentSubmission[],
    examAttempts: (examRes.data ?? []) as ExamAttemptRecord[],
    kudos: (kudosRes.data ?? []) as TeacherKudos[],
  }
}

export function buildGradebookCsv(
  students: UserProfile[],
  assignments: Assignment[],
  submissions: AssignmentSubmission[],
): string {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
  const header = [
    'Họ tên',
    'Email',
    'Hiện tại',
    'Mục tiêu',
    ...assignments.map((a) => `${a.title} (Trạng thái)`),
    ...assignments.map((a) => `${a.title} (Điểm)`),
  ]
  const rows = students
    .filter((s) => s.role === 'student')
    .map((s) => {
      const subFor = (aid: string) => submissions.find((x) => x.assignment_id === aid && x.user_id === s.id)
      const statusText = (st: string) =>
        st === 'graded' ? 'Đã chấm' : st === 'submitted' ? 'Đã nộp' : st === 'overdue' ? 'Quá hạn' : 'Chưa làm'
      return [
        s.full_name,
        s.email,
        s.current_hsk_level === 0 ? 'Mới bắt đầu' : `HSK ${s.current_hsk_level}`,
        `HSK ${s.target_hsk_level}`,
        ...assignments.map((a) =>
          statusText(subFor(a.id)?.status ?? (new Date(a.due_at).getTime() < Date.now() ? 'overdue' : 'pending')),
        ),
        ...assignments.map((a) => (subFor(a.id) ? `${subFor(a.id)!.score}/${subFor(a.id)!.max_score}` : '-')),
      ]
        .map(esc)
        .join(',')
    })
  return [header.map(esc).join(','), ...rows].join('\n')
}
