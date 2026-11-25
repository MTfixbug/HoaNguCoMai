import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { loadSearchIndex, loadVocabChunk, levelToChunkKey, loadVocabMeta } from '../lib/dataLoader'
import { computeNextStreak } from '../lib/gamification'
import { getDeviceSummary, loadLocalStore, resetLocalStore, saveLocalStore, syncRemoteState, type LmsStoreSnapshot } from '../lib/lmsStore'
import { calculateNextReview, createInitialProgress } from '../lib/srs'
import { getSupabase } from '../lib/supabase'
import type {
  AccountStatus,
  Assignment,
  AssignmentSubmission,
  ClientSettings,
  CustomLesson,
  ExamAttemptRecord,
  KudosSticker,
  PetType,
  Rating,
  StudyMode,
  StudySession,
  TeacherKudos,
  UserProfile,
  VocabProgressRecord,
} from '../types/lms'
import type { DictEntry, VocabMeta } from '../types/vocab'
import { useAuth } from './AuthContext'

interface LmsContextValue {
  settings: ClientSettings
  updateSettings: (patch: Partial<ClientSettings>) => void
  customLessons: CustomLesson[]
  vocabMeta: VocabMeta | null
  searchIndex: DictEntry[]
  indexLoading: boolean
  ensureSearchIndex: () => Promise<DictEntry[]>
  loadLevelVocab: (hskLevel: number) => Promise<DictEntry[]>
  dataLoading: boolean
  profiles: UserProfile[]
  progressMap: Record<string, VocabProgressRecord>
  allStudentProgress: Record<string, Record<string, VocabProgressRecord>>
  sessions: StudySession[]
  events: LmsStoreSnapshot['events']
  assignments: Assignment[]
  submissions: AssignmentSubmission[]
  examAttempts: ExamAttemptRecord[]
  kudos: TeacherKudos[]
  studentPasswords: Record<string, string>
  recentIds: string[]
  awardXpAndStreak: (xpDelta: number) => void
  updatePetPreferences: (petType: PetType, petEnabled: boolean) => Promise<void>
  sendTeacherKudos: (studentId: string, xpBonus: number, sticker: KudosSticker, message: string) => Promise<void>
  markKudosSeen: (kudosId: string) => Promise<void>
  adminCreateStudent: (input: {
    fullName: string
    email: string
    password: string
    currentHskLevel: number
    targetHskLevel: number
    dailyGoalMinutes: number
  }) => Promise<{ profile: UserProfile; password: string }>
  adminResetStudentPassword: (studentId: string, newPassword: string) => Promise<void>
  rateWord: (wordId: string, hskLevel: number, rating: Rating) => void
  toggleHardWord: (wordId: string, hskLevel: number, value?: boolean) => void
  recordQuizOutcome: (wordId: string, hskLevel: number, correct: boolean) => void
  recordStudySession: (mode: StudyMode, hskLevel: number, durationSec: number, itemsCompleted: number, accuracyPct: number) => void
  recordAssignmentCompletion: (
    assignmentId: string,
    score: number,
    maxScore: number,
    durationSec: number,
    mistakes?: string[],
  ) => Promise<void>
  submitExamAttempt: (attempt: Omit<ExamAttemptRecord, 'id' | 'user_id' | 'created_at'>, assignmentId?: string) => ExamAttemptRecord
  createAssignment: (input: Omit<Assignment, 'id' | 'created_by' | 'created_at'>) => Promise<void>
  gradeSubmission: (submissionId: string, score: number, feedback: string) => Promise<void>
  reviewExamAttempt: (attemptId: string, writingScore: number, feedback: string) => Promise<void>
  setStudentAccountStatus: (userId: string, status: AccountStatus) => Promise<void>
  adminUpdateStudentProfile: (
    userId: string,
    patch: { current_hsk_level: number; target_hsk_level: number; daily_goal_minutes: number; onboarding_completed?: boolean },
  ) => Promise<void>
  deleteStudentProfile: (userId: string) => Promise<void>
  createCustomLesson: (input: Omit<CustomLesson, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<void>
  toggleLessonPublished: (lessonId: string, published: boolean) => Promise<void>
  deleteCustomLesson: (lessonId: string) => Promise<void>
  completeOnboarding: (currentLevel: number, targetLevel: number, dailyMinutes: number) => Promise<void>
  promoteStudentLevel: (nextLevel: number) => Promise<void>
  exportAllJson: () => string
  importAllJson: (raw: string) => { ok: boolean; error?: string }
  resetDemoProgress: () => void
}

const LmsCtx = createContext<LmsContextValue | null>(null)

export function LmsProvider({ children }: { children: ReactNode }) {
  const { configured, profile, refreshProfile } = useAuth()
  const [store, setStore] = useState<LmsStoreSnapshot>(loadLocalStore)
  const [vocabMeta, setVocabMeta] = useState<VocabMeta | null>(null)
  const [searchIndex, setSearchIndex] = useState<DictEntry[]>([])
  const [indexLoading, setIndexLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const profileRef = useRef(profile)
  profileRef.current = profile

  useEffect(() => {
    saveLocalStore(store)
    document.documentElement.dataset.hanzi = store.settings.hanziSize
  }, [store])

  useEffect(() => {
    let alive = true
    loadVocabMeta()
      .then((meta) => {
        if (!alive) return
        setVocabMeta(meta)
        setDataLoading(false)
      })
      .catch(() => alive && setDataLoading(false))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const p = profileRef.current
    if (!configured || !p || p.account_status !== 'approved') return
    let alive = true
    syncRemoteState(p.id, p.role === 'admin').then((remote) => {
      if (!alive || !remote) return
      setStore((s) => ({
        ...s,
        settings: {
          ...s.settings,
          petType: p.pet_type ?? s.settings.petType,
          petEnabled: p.pet_enabled ?? s.settings.petEnabled,
        },
        profiles: remote.profiles.length ? remote.profiles : s.profiles,
        customLessons: remote.customLessons,
        progressMap: remote.progressMap,
        allStudentProgress: remote.allStudentProgress,
        sessions: remote.sessions,
        events: remote.events,
        assignments: remote.assignments,
        submissions: remote.submissions,
        examAttempts: remote.examAttempts,
        kudos: remote.kudos,
        studentPasswords: remote.studentPasswords,
      }))
    })
    return () => {
      alive = false
    }
  }, [configured, profile?.id, profile?.role, profile?.account_status])

  const ensureSearchIndex = useCallback(async () => {
    if (searchIndex.length > 0) return searchIndex
    setIndexLoading(true)
    try {
      const idx = await loadSearchIndex()
      setSearchIndex(idx)
      return idx
    } finally {
      setIndexLoading(false)
    }
  }, [searchIndex])

  const loadLevelVocab = useCallback(async (hskLevel: number) => {
    return loadVocabChunk(levelToChunkKey(hskLevel))
  }, [])

  const updateSettings = useCallback((patch: Partial<ClientSettings>) => {
    setStore((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const awardXpAndStreak = useCallback(
    (xpDelta: number) => {
      const delta = Math.max(0, Math.round(xpDelta))
      const p = profileRef.current
      const uid = p?.id ?? 'local'
      if (p?.role === 'admin') return

      let syncedPatch: {
        xp_points: number
        streak_days: number
        longest_streak: number
        last_study_date: string
      } | null = null

      setStore((s) => {
        const curProf = s.profiles.find((x) => x.id === uid) ?? p
        if (!curProf) return s
        const streakUpdate = computeNextStreak(
          curProf.last_study_date,
          curProf.streak_days ?? 0,
          curProf.longest_streak ?? 0,
        )
        const nextXp = (curProf.xp_points ?? 0) + delta
        syncedPatch = {
          xp_points: nextXp,
          streak_days: streakUpdate.streak_days,
          longest_streak: streakUpdate.longest_streak,
          last_study_date: streakUpdate.last_study_date,
        }
        const exists = s.profiles.some((x) => x.id === uid)
        const nextProfiles = exists
          ? s.profiles.map((x) => (x.id === uid ? { ...x, ...syncedPatch } : x))
          : [{ ...curProf, ...syncedPatch }, ...s.profiles]
        return { ...s, profiles: nextProfiles }
      })

      const sb = getSupabase()
      if (configured && sb && p && syncedPatch) {
        void sb.from('profiles').update(syncedPatch).eq('id', uid)
      }
    },
    [configured],
  )

  const updatePetPreferences = useCallback(
    async (petType: PetType, petEnabled: boolean) => {
      setStore((s) => ({
        ...s,
        settings: { ...s.settings, petType, petEnabled },
        profiles: s.profiles.map((x) =>
          x.id === (profileRef.current?.id ?? '') ? { ...x, pet_type: petType, pet_enabled: petEnabled } : x,
        ),
      }))
      const sb = getSupabase()
      const p = profileRef.current
      if (configured && sb && p) {
        const { error } = await sb
          .from('profiles')
          .update({ pet_type: petType, pet_enabled: petEnabled })
          .eq('id', p.id)
        if (error) throw new Error(error.message)
      }
    },
    [configured],
  )

  const sendTeacherKudos = useCallback(
    async (studentId: string, xpBonus: number, sticker: KudosSticker, message: string) => {
      const uid = profileRef.current?.id ?? 'admin'
      const bonus = Math.max(0, Math.min(500, Math.round(xpBonus)))
      const sb = getSupabase()
      let createdKudos: TeacherKudos = {
        id: `kudos-${Date.now()}`,
        student_id: studentId,
        created_by: uid,
        sticker,
        message: message.trim(),
        xp_bonus: bonus,
        is_seen: false,
        created_at: new Date().toISOString(),
      }

      if (configured && sb && profileRef.current) {
        const { data, error } = await sb
          .from('teacher_kudos')
          .insert({
            student_id: studentId,
            created_by: uid,
            sticker,
            message: message.trim(),
            xp_bonus: bonus,
          })
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        if (data) createdKudos = data as TeacherKudos

        if (bonus > 0) {
          const target = store.profiles.find((p) => p.id === studentId)
          const nextXp = (target?.xp_points ?? 0) + bonus
          const { error: upErr } = await sb.from('profiles').update({ xp_points: nextXp }).eq('id', studentId)
          if (upErr) throw new Error(upErr.message)
        }
      }

      setStore((s) => ({
        ...s,
        kudos: [createdKudos, ...s.kudos],
        profiles: s.profiles.map((p) =>
          p.id === studentId ? { ...p, xp_points: (p.xp_points ?? 0) + bonus } : p,
        ),
      }))
    },
    [configured, store.profiles],
  )

  const markKudosSeen = useCallback(
    async (kudosId: string) => {
      setStore((s) => ({
        ...s,
        kudos: s.kudos.map((k) => (k.id === kudosId ? { ...k, is_seen: true } : k)),
      }))
      const sb = getSupabase()
      if (configured && sb && !kudosId.startsWith('kudos-')) {
        await sb.from('teacher_kudos').update({ is_seen: true }).eq('id', kudosId)
      }
    },
    [configured],
  )

  const persistVocabRecord = useCallback(
    async (rec: VocabProgressRecord) => {
      const sb = getSupabase()
      if (!configured || !sb || !profile) return
      await sb.from('vocab_progress').upsert(rec, { onConflict: 'user_id,word_id' })
    },
    [configured, profile],
  )

  const rateWord = useCallback(
    (wordId: string, hskLevel: number, rating: Rating) => {
      const uid = profile?.id ?? store.profiles[1]?.id ?? 'local'
      setStore((s) => {
        const cur = s.progressMap[wordId] ?? createInitialProgress(uid, wordId, hskLevel)
        const next = calculateNextReview(cur, rating)
        void persistVocabRecord(next)
        return {
          ...s,
          progressMap: { ...s.progressMap, [wordId]: next },
          recentIds: [wordId, ...s.recentIds.filter((x) => x !== wordId)].slice(0, 60),
        }
      })
      awardXpAndStreak(rating === 'again' ? 2 : 5)
    },
    [profile?.id, store.profiles, persistVocabRecord, awardXpAndStreak],
  )

  const toggleHardWord = useCallback(
    (wordId: string, hskLevel: number, value?: boolean) => {
      const uid = profile?.id ?? 'local'
      setStore((s) => {
        const cur = s.progressMap[wordId] ?? createInitialProgress(uid, wordId, hskLevel)
        const next: VocabProgressRecord = {
          ...cur,
          is_flagged_hard: value ?? !cur.is_flagged_hard,
          updated_at: new Date().toISOString(),
        }
        void persistVocabRecord(next)
        return { ...s, progressMap: { ...s.progressMap, [wordId]: next } }
      })
    },
    [profile?.id, persistVocabRecord],
  )

  const recordQuizOutcome = useCallback(
    (wordId: string, hskLevel: number, correct: boolean) => {
      const uid = profile?.id ?? 'local'
      setStore((s) => {
        const cur = s.progressMap[wordId] ?? createInitialProgress(uid, wordId, hskLevel)
        const next = calculateNextReview(cur, correct ? 'good' : 'again')
        void persistVocabRecord(next)
        return {
          ...s,
          progressMap: { ...s.progressMap, [wordId]: next },
          recentIds: [wordId, ...s.recentIds.filter((x) => x !== wordId)].slice(0, 60),
        }
      })
      awardXpAndStreak(correct ? 8 : 2)
    },
    [profile?.id, persistVocabRecord, awardXpAndStreak],
  )

  const recordStudySession = useCallback(
    (mode: StudyMode, hskLevel: number, durationSec: number, itemsCompleted: number, accuracyPct: number) => {
      const uid = profile?.id ?? 'local'
      const safeLevel = Math.max(1, Math.min(9, hskLevel || 1))
      const now = new Date().toISOString()
      const deviceSummary = { ...getDeviceSummary(), subMode: mode }
      const sess: StudySession = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: uid,
        started_at: now,
        ended_at: now,
        duration_sec: Math.max(1, Math.round(durationSec)),
        mode,
        hsk_level: safeLevel,
        items_completed: itemsCompleted,
        accuracy_pct: Math.round(accuracyPct),
        device_info: deviceSummary,
      }
      const evt: LmsStoreSnapshot['events'][number] = {
        id: `evt-${Date.now()}`,
        user_id: uid,
        event_type: mode === 'flashcard' ? 'flashcard_batch' : 'quiz_complete',
        metadata: { mode, hskLevel: safeLevel, itemsCompleted, accuracyPct },
        created_at: now,
      }
      setStore((s) => ({ ...s, sessions: [sess, ...s.sessions], events: [evt, ...s.events] }))
      awardXpAndStreak(15 + (accuracyPct >= 80 ? 10 : 0))

      const dbMode = mode === 'tone' || mode === 'dictation' ? 'quiz' : mode
      const sb = getSupabase()
      if (configured && sb && profile) {
        void sb.from('study_sessions').insert({
          user_id: uid,
          started_at: sess.started_at,
          ended_at: sess.ended_at,
          duration_sec: sess.duration_sec,
          mode: dbMode,
          hsk_level: safeLevel,
          items_completed: itemsCompleted,
          accuracy_pct: sess.accuracy_pct,
          device_info: deviceSummary,
        })
        void sb.from('user_activity_events').insert({
          user_id: uid,
          event_type: evt.event_type,
          metadata: evt.metadata,
        })
      }
    },
    [configured, profile, awardXpAndStreak],
  )

  const recordAssignmentCompletion = useCallback(
    async (assignmentId: string, score: number, maxScore: number, durationSec: number, mistakes: string[] = []) => {
      const uid = profile?.id
      if (!uid || !assignmentId) return
      const now = new Date().toISOString()
      const nextSub: AssignmentSubmission = {
        id: `sub-${Date.now()}`,
        assignment_id: assignmentId,
        user_id: uid,
        status: 'submitted',
        score,
        max_score: maxScore,
        duration_sec: Math.max(1, Math.round(durationSec)),
        answers: {},
        mistakes,
        submitted_at: now,
        admin_feedback: '',
      }
      setStore((s) => {
        const idx = s.submissions.findIndex((x) => x.assignment_id === assignmentId && x.user_id === uid)
        const list = [...s.submissions]
        if (idx >= 0) list[idx] = { ...list[idx], ...nextSub, id: list[idx].id }
        else list.unshift(nextSub)
        return { ...s, submissions: list }
      })

      const sb = getSupabase()
      if (configured && sb) {
        await sb.from('assignment_submissions').upsert(
          {
            assignment_id: assignmentId,
            user_id: uid,
            status: 'submitted',
            score,
            max_score: maxScore,
            duration_sec: Math.max(1, Math.round(durationSec)),
            mistakes,
            submitted_at: now,
          },
          { onConflict: 'assignment_id,user_id' },
        )
      }
    },
    [configured, profile?.id],
  )

  const submitExamAttempt = useCallback(
    (attempt: Omit<ExamAttemptRecord, 'id' | 'user_id' | 'created_at'>, assignmentId?: string) => {
      const uid = profile?.id ?? 'local'
      const full: ExamAttemptRecord = {
        ...attempt,
        id: `exam-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        admin_reviewed: false,
        admin_feedback: '',
      }
      setStore((s) => ({ ...s, examAttempts: [full, ...s.examAttempts] }))
      awardXpAndStreak(attempt.passed ? 100 : 50)

      if (assignmentId) {
        const maxScore = attempt.hsk_level <= 2 ? 200 : attempt.hsk_level >= 7 ? 500 : 300
        const dur = Object.values(attempt.section_timings).reduce((a, b) => a + b, 0)
        void recordAssignmentCompletion(assignmentId, attempt.total_score, maxScore, dur)
      }

      const sb = getSupabase()
      if (configured && sb && profile) {
        void sb.from('exam_attempts').insert({
          user_id: uid,
          hsk_level: attempt.hsk_level,
          mode: attempt.mode,
          listening_score: attempt.listening_score,
          reading_score: attempt.reading_score,
          writing_score: attempt.writing_score,
          total_score: attempt.total_score,
          passed: attempt.passed,
          section_timings: attempt.section_timings,
          responses: attempt.responses,
          writing_prompt: attempt.writing_prompt ?? '',
          writing_text: attempt.writing_text ?? '',
        })
      }
      return full
    },
    [configured, profile, recordAssignmentCompletion],
  )

  const createAssignment = useCallback(
    async (input: Omit<Assignment, 'id' | 'created_by' | 'created_at'>) => {
      const uid = profile?.id ?? 'admin'
      const sb = getSupabase()
      if (configured && sb && profile) {
        const { data, error } = await sb
          .from('assignments')
          .insert({
            title: input.title,
            description: input.description,
            target_type: input.target_type,
            config: input.config,
            assigned_to: input.assigned_to,
            due_at: input.due_at,
            pass_score: input.pass_score,
            created_by: uid,
          })
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        if (data) setStore((s) => ({ ...s, assignments: [data as Assignment, ...s.assignments] }))
        return
      }
      const created: Assignment = {
        ...input,
        id: `assign-${Date.now()}`,
        created_by: uid,
        created_at: new Date().toISOString(),
      }
      setStore((s) => ({ ...s, assignments: [created, ...s.assignments] }))
    },
    [configured, profile],
  )

  const gradeSubmission = useCallback(
    async (submissionId: string, score: number, feedback: string) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb
          .from('assignment_submissions')
          .update({ score, admin_feedback: feedback, status: 'graded' })
          .eq('id', submissionId)
        if (error) throw new Error(error.message)
      }
      setStore((s) => ({
        ...s,
        submissions: s.submissions.map((sub) =>
          sub.id === submissionId ? { ...sub, score, admin_feedback: feedback, status: 'graded' } : sub,
        ),
      }))
    },
    [configured],
  )

  const reviewExamAttempt = useCallback(
    async (attemptId: string, writingScore: number, feedback: string) => {
      const target = store.examAttempts.find((ex) => ex.id === attemptId)
      const nextTotal = target ? target.listening_score + target.reading_score + writingScore : writingScore
      const passThreshold = target ? (target.hsk_level <= 2 ? 120 : target.hsk_level >= 7 ? 300 : 180) : 180
      const passed = nextTotal >= passThreshold

      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb
          .from('exam_attempts')
          .update({
            writing_score: writingScore,
            total_score: nextTotal,
            passed,
            admin_reviewed: true,
            admin_feedback: feedback,
          })
          .eq('id', attemptId)
        if (error) throw new Error(error.message)
      }

      setStore((s) => ({
        ...s,
        examAttempts: s.examAttempts.map((ex) =>
          ex.id === attemptId
            ? { ...ex, writing_score: writingScore, total_score: nextTotal, passed, admin_reviewed: true, admin_feedback: feedback }
            : ex,
        ),
      }))
    },
    [configured, store.examAttempts],
  )

  const setStudentAccountStatus = useCallback(
    async (userId: string, status: AccountStatus) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb.from('profiles').update({ account_status: status }).eq('id', userId)
        if (error) throw new Error(error.message)
      }
      setStore((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === userId ? { ...p, account_status: status } : p)),
      }))
    },
    [configured],
  )

  const adminUpdateStudentProfile = useCallback(
    async (
      userId: string,
      patch: { current_hsk_level: number; target_hsk_level: number; daily_goal_minutes: number; onboarding_completed?: boolean },
    ) => {
      const safeCurrent = Math.max(0, Math.min(9, patch.current_hsk_level))
      const safeTarget = Math.max(1, Math.max(safeCurrent, Math.min(9, patch.target_hsk_level)))
      const payload = {
        current_hsk_level: safeCurrent,
        target_hsk_level: safeTarget,
        daily_goal_minutes: patch.daily_goal_minutes,
        onboarding_completed: patch.onboarding_completed ?? true,
      }
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb.from('profiles').update(payload).eq('id', userId)
        if (error) throw new Error(error.message)
      }
      setStore((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === userId ? { ...p, ...payload } : p)),
      }))
    },
    [configured],
  )

  const adminCreateStudent = useCallback(
    async (input: {
      fullName: string
      email: string
      password: string
      currentHskLevel: number
      targetHskLevel: number
      dailyGoalMinutes: number
    }) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { data, error } = await sb.functions.invoke<{
          ok?: boolean
          error?: string
          profile?: UserProfile
          login_password?: string
        }>('auth-manager', {
          body: {
            action: 'admin_create_student',
            ...input,
          },
        })
        if (error) throw new Error(error.message)
        if (!data?.ok || !data.profile) throw new Error(data?.error ?? 'Không tạo được tài khoản học viên.')

        const createdProf = data.profile
        const savedPw = data.login_password ?? input.password
        setStore((s) => ({
          ...s,
          profiles: [createdProf, ...s.profiles.filter((x) => x.id !== createdProf.id)],
          studentPasswords: { ...s.studentPasswords, [createdProf.id]: savedPw },
        }))
        return { profile: createdProf, password: savedPw }
      }

      const now = new Date().toISOString()
      const localProf: UserProfile = {
        id: `student-${Date.now()}`,
        email: input.email.trim().toLowerCase(),
        full_name: input.fullName.trim(),
        avatar_url: '',
        role: 'student',
        account_status: 'approved',
        current_hsk_level: input.currentHskLevel,
        target_hsk_level: Math.max(1, Math.max(input.currentHskLevel, input.targetHskLevel)),
        onboarding_completed: true,
        daily_goal_minutes: input.dailyGoalMinutes,
        preferred_voice: '',
        xp_points: 0,
        streak_days: 0,
        longest_streak: 0,
        last_study_date: null,
        pet_type: 'cat',
        pet_enabled: true,
        created_at: now,
        last_seen_at: now,
      }
      setStore((s) => ({
        ...s,
        profiles: [localProf, ...s.profiles],
        studentPasswords: { ...s.studentPasswords, [localProf.id]: input.password },
      }))
      return { profile: localProf, password: input.password }
    },
    [configured],
  )

  const adminResetStudentPassword = useCallback(
    async (studentId: string, newPassword: string) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { data, error } = await sb.functions.invoke<{ ok?: boolean; error?: string; login_password?: string }>(
          'auth-manager',
          {
            body: {
              action: 'admin_reset_password',
              studentId,
              newPassword,
            },
          },
        )
        if (error) throw new Error(error.message)
        if (!data?.ok) throw new Error(data?.error ?? 'Không thể đổi mật khẩu học viên.')
      }
      setStore((s) => ({
        ...s,
        studentPasswords: { ...s.studentPasswords, [studentId]: newPassword },
      }))
    },
    [configured],
  )

  const deleteStudentProfile = useCallback(
    async (userId: string) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { data, error } = await sb.functions.invoke<{ ok?: boolean; error?: string }>('auth-manager', {
          body: { action: 'admin_delete_student', studentId: userId },
        })
        if (error) throw new Error(error.message)
        if (!data?.ok) throw new Error(data?.error ?? 'Không thể xóa học viên.')
      }
      setStore((s) => {
        const nextPasswords = { ...s.studentPasswords }
        delete nextPasswords[userId]
        return {
          ...s,
          profiles: s.profiles.filter((p) => p.id !== userId),
          studentPasswords: nextPasswords,
        }
      })
    },
    [configured],
  )

  const createCustomLesson = useCallback(
    async (input: Omit<CustomLesson, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      const uid = profile?.id ?? 'admin'
      const sb = getSupabase()
      if (configured && sb && profile) {
        const { data, error } = await sb
          .from('custom_lessons')
          .insert({ ...input, created_by: uid })
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        if (data) setStore((s) => ({ ...s, customLessons: [data as CustomLesson, ...s.customLessons] }))
        return
      }
      const now = new Date().toISOString()
      const localLesson: CustomLesson = {
        ...input,
        id: `lesson-${Date.now()}`,
        created_by: uid,
        created_at: now,
        updated_at: now,
      }
      setStore((s) => ({ ...s, customLessons: [localLesson, ...s.customLessons] }))
    },
    [configured, profile],
  )

  const toggleLessonPublished = useCallback(
    async (lessonId: string, published: boolean) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb
          .from('custom_lessons')
          .update({ is_published: published, updated_at: new Date().toISOString() })
          .eq('id', lessonId)
        if (error) throw new Error(error.message)
      }
      setStore((s) => ({
        ...s,
        customLessons: s.customLessons.map((l) => (l.id === lessonId ? { ...l, is_published: published } : l)),
      }))
    },
    [configured],
  )

  const deleteCustomLesson = useCallback(
    async (lessonId: string) => {
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb.from('custom_lessons').delete().eq('id', lessonId)
        if (error) throw new Error(error.message)
      }
      setStore((s) => ({
        ...s,
        customLessons: s.customLessons.filter((l) => l.id !== lessonId),
      }))
    },
    [configured],
  )

  const completeOnboarding = useCallback(
    async (currentLevel: number, targetLevel: number, dailyMinutes: number) => {
      const uid = profile?.id
      if (!uid) return
      const safeTarget = Math.max(1, Math.max(currentLevel, targetLevel))
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb
          .from('profiles')
          .update({
            current_hsk_level: currentLevel,
            target_hsk_level: safeTarget,
            daily_goal_minutes: dailyMinutes,
            onboarding_completed: true,
          })
          .eq('id', uid)
        if (error) throw new Error(error.message)
        await refreshProfile()
      }
      setStore((s) => ({
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === uid
            ? {
                ...p,
                current_hsk_level: currentLevel,
                target_hsk_level: safeTarget,
                daily_goal_minutes: dailyMinutes,
                onboarding_completed: true,
              }
            : p,
        ),
      }))
    },
    [configured, profile?.id, refreshProfile],
  )

  const promoteStudentLevel = useCallback(
    async (nextLevel: number) => {
      const uid = profile?.id
      if (!uid || !profile) return
      const clamped = Math.min(Math.max(1, profile.target_hsk_level), Math.max(1, nextLevel))
      const sb = getSupabase()
      if (configured && sb) {
        const { error } = await sb.from('profiles').update({ current_hsk_level: clamped }).eq('id', uid)
        if (error) throw new Error(error.message)
        await refreshProfile()
      }
      setStore((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === uid ? { ...p, current_hsk_level: clamped } : p)),
      }))
    },
    [configured, profile, refreshProfile],
  )

  const exportAllJson = useCallback(() => JSON.stringify({ app: 'zhweb-lms', version: 3, store }, null, 2), [store])

  const importAllJson = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      if (!parsed?.store) {
        return { ok: false, error: 'Tệp sao lưu ZHWeb không hợp lệ.' }
      }
      setStore(parsed.store)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Tệp không đúng định dạng JSON.' }
    }
  }, [])

  const resetDemoProgress = useCallback(() => {
    resetLocalStore()
    setStore(loadLocalStore())
  }, [])

  return (
    <LmsCtx.Provider
      value={{
        settings: store.settings,
        updateSettings,
        customLessons: store.customLessons,
        vocabMeta,
        searchIndex,
        indexLoading,
        ensureSearchIndex,
        loadLevelVocab,
        dataLoading,
        profiles: store.profiles,
        progressMap: store.progressMap,
        allStudentProgress: store.allStudentProgress,
        sessions: store.sessions,
        events: store.events,
        assignments: store.assignments,
        submissions: store.submissions,
        examAttempts: store.examAttempts,
        kudos: store.kudos,
        studentPasswords: store.studentPasswords,
        recentIds: store.recentIds,
        awardXpAndStreak,
        updatePetPreferences,
        sendTeacherKudos,
        markKudosSeen,
        adminCreateStudent,
        adminResetStudentPassword,
        rateWord,
        toggleHardWord,
        recordQuizOutcome,
        recordStudySession,
        recordAssignmentCompletion,
        submitExamAttempt,
        createAssignment,
        gradeSubmission,
        reviewExamAttempt,
        setStudentAccountStatus,
        adminUpdateStudentProfile,
        deleteStudentProfile,
        createCustomLesson,
        toggleLessonPublished,
        deleteCustomLesson,
        completeOnboarding,
        promoteStudentLevel,
        exportAllJson,
        importAllJson,
        resetDemoProgress,
      }}
    >
      {children}
    </LmsCtx.Provider>
  )
}

export function useLms() {
  const c = useContext(LmsCtx)
  if (!c) throw new Error('useLms phải dùng bên trong LmsProvider')
  return c
}
