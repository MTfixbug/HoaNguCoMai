import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, AlertTriangle, Award, Clock, Flame, Gift, Sparkles, Trophy, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type {
  AssignmentSubmission,
  ExamAttemptRecord,
  StudySession,
  UserActivityEvent,
  UserProfile,
  VocabProgressRecord,
} from '../../types/lms'
import type { DictEntry } from '../../types/vocab'

interface CohortOverviewProps {
  profiles: UserProfile[]
  sessions: StudySession[]
  events: UserActivityEvent[]
  examAttempts: ExamAttemptRecord[]
  submissions: AssignmentSubmission[]
  allStudentProgress: Record<string, Record<string, VocabProgressRecord>>
  searchIndex: DictEntry[]
  onSelectStudent: (student: UserProfile) => void
  onQuickAssignReview: (student: UserProfile) => Promise<void>
}

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  flashcard: { label: 'Thẻ nhớ', color: '#0D9488' },
  quiz: { label: 'Trắc nghiệm', color: '#0284C7' },
  tone: { label: 'Thanh điệu', color: '#D97706' },
  dictation: { label: 'Nghe – Gõ Pinyin', color: '#7C3AED' },
  match: { label: 'Ghép cặp', color: '#16A34A' },
  grammar: { label: 'Xếp câu / Bài Cô', color: '#DB2777' },
  mock_exam: { label: 'Thi thử HSK', color: '#DC2626' },
  writing: { label: 'Tập viết', color: '#475569' },
}

const TOOLTIP_STYLE = {
  borderRadius: '14px',
  border: '1px solid var(--glass-line)',
  background: 'var(--glass-strong)',
  color: 'var(--ink)',
  fontSize: '12px',
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function CohortOverview({
  profiles,
  sessions,
  events,
  examAttempts,
  submissions,
  allStudentProgress,
  searchIndex,
  onSelectStudent,
  onQuickAssignReview,
}: CohortOverviewProps) {
  const [daysWindow, setDaysWindow] = useState<7 | 14 | 30>(14)
  const [levelFilter, setLevelFilter] = useState<'all' | number>('all')
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const students = useMemo(() => {
    const base = profiles.filter((p) => p.role === 'student')
    if (levelFilter === 'all') return base
    return base.filter((s) => (s.current_hsk_level || 1) === levelFilter)
  }, [profiles, levelFilter])

  const studentIds = useMemo(() => new Set(students.map((s) => s.id)), [students])

  const windowCutoffMs = useMemo(() => Date.now() - daysWindow * 86_400_000, [daysWindow])

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          studentIds.has(s.user_id) &&
          new Date(s.started_at).getTime() >= windowCutoffMs &&
          (levelFilter === 'all' || s.hsk_level === levelFilter),
      ),
    [sessions, studentIds, windowCutoffMs, levelFilter],
  )

  const filteredEvents = useMemo(
    () => events.filter((e) => studentIds.has(e.user_id) && new Date(e.created_at).getTime() >= windowCutoffMs),
    [events, studentIds, windowCutoffMs],
  )

  const filteredExams = useMemo(
    () =>
      examAttempts.filter(
        (e) =>
          studentIds.has(e.user_id) &&
          (levelFilter === 'all' || e.hsk_level === levelFilter),
      ),
    [examAttempts, studentIds, levelFilter],
  )

  const stats = useMemo(() => {
    const now = Date.now()
    const sevenDaysMs = 7 * 86_400_000
    const active7d = students.filter((s) => {
      const seen = new Date(s.last_seen_at).getTime()
      if (now - seen <= sevenDaysMs) return true
      return sessions.some((sess) => sess.user_id === s.id && now - new Date(sess.started_at).getTime() <= sevenDaysMs)
    }).length

    const totalSec = filteredSessions.reduce((acc, s) => acc + (s.duration_sec || 0), 0)
    const avgMinutesPerStudent = students.length ? Math.round(totalSec / 60 / students.length) : 0
    const avgAccuracy = filteredSessions.length
      ? Math.round(filteredSessions.reduce((acc, s) => acc + s.accuracy_pct, 0) / filteredSessions.length)
      : 0
    const passCount = filteredExams.filter((e) => e.passed).length
    const passRate = filteredExams.length ? Math.round((passCount / filteredExams.length) * 100) : 0
    const totalXp = students.reduce((acc, s) => acc + (s.xp_points ?? 0), 0)
    const bestStreak = students.reduce((m, s) => Math.max(m, s.streak_days ?? 0), 0)
    const avgStreak = students.length
      ? Math.round((students.reduce((acc, s) => acc + (s.streak_days ?? 0), 0) / students.length) * 10) / 10
      : 0

    return {
      totalStudents: students.length,
      active7d,
      avgMinutesPerStudent,
      avgAccuracy,
      passRate,
      attemptCount: filteredExams.length,
      totalXp,
      bestStreak,
      avgStreak,
    }
  }, [students, sessions, filteredSessions, filteredExams])

  // 1. AreaChart: Thời lượng học theo ngày
  const dailyStudySeries = useMemo(() => {
    const today = new Date()
    const days: { date: string; label: string; minutes: number; events: number }[] = []
    for (let offset = daysWindow - 1; offset >= 0; offset -= 1) {
      const d = new Date(today)
      d.setDate(today.getDate() - offset)
      const iso = d.toISOString().slice(0, 10)
      days.push({
        date: iso,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        minutes: 0,
        events: 0,
      })
    }
    const indexByDate = new Map(days.map((d, idx) => [d.date, idx]))
    for (const s of filteredSessions) {
      const idx = indexByDate.get(dayKey(s.started_at))
      if (idx !== undefined) days[idx].minutes += Math.max(1, Math.round(s.duration_sec / 60))
    }
    for (const ev of filteredEvents) {
      const idx = indexByDate.get(dayKey(ev.created_at))
      if (idx !== undefined) days[idx].events += 1
    }
    return days
  }, [filteredSessions, filteredEvents, daysWindow])

  // 2. RadarChart: Bản đồ 5 kỹ năng toàn lớp
  const skillRadarData = useMemo(() => {
    const avgOf = (modes: string[], fallback = 0) => {
      const matched = filteredSessions.filter((s) => modes.includes(s.mode))
      if (!matched.length) return fallback
      return Math.round(matched.reduce((a, s) => a + s.accuracy_pct, 0) / matched.length)
    }

    const allProg = students.flatMap((st) => Object.values(allStudentProgress[st.id] ?? {}))
    const masteredRatio = allProg.length
      ? Math.round((allProg.filter((p) => p.mastery_status === 'mastered' || p.mastery_status === 'familiar').length / allProg.length) * 100)
      : 0
    const writingAvg = filteredExams.length
      ? Math.round(filteredExams.reduce((a, e) => a + (e.writing_score || 0), 0) / filteredExams.length)
      : avgOf(['grammar', 'writing'], 0)
    const streakConsistency = students.length
      ? Math.min(100, Math.round((students.reduce((a, s) => a + Math.min(7, s.streak_days ?? 0), 0) / (students.length * 7)) * 100))
      : 0

    return [
      { skill: 'Từ vựng SRS', score: masteredRatio },
      { skill: 'Nghe & Thanh điệu', score: avgOf(['tone', 'dictation'], stats.avgAccuracy) },
      { skill: 'Đọc & Trắc nghiệm', score: avgOf(['quiz', 'match'], stats.avgAccuracy) },
      { skill: 'Viết & Ngữ pháp', score: writingAvg },
      { skill: 'Độ đều đặn', score: streakConsistency },
    ]
  }, [filteredSessions, students, allStudentProgress, filteredExams, stats.avgAccuracy])

  // 3. PieChart (Donut): Phân bổ chế độ học
  const modeDonutData = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of filteredSessions) {
      map.set(s.mode, (map.get(s.mode) ?? 0) + 1)
    }
    for (const ex of filteredExams) {
      if (new Date(ex.created_at).getTime() >= windowCutoffMs) {
        map.set('mock_exam', (map.get('mock_exam') ?? 0) + 1)
      }
    }
    return Array.from(map.entries()).map(([mode, count]) => ({
      mode,
      name: MODE_LABELS[mode]?.label ?? mode,
      value: count,
      color: MODE_LABELS[mode]?.color ?? '#64748B',
    }))
  }, [filteredSessions, filteredExams, windowCutoffMs])

  // 4. BarChart ngang: Top 10 từ hay sai nhất cả lớp
  const wordLookup = useMemo(() => {
    const m = new Map<string, DictEntry>()
    for (const w of searchIndex) m.set(w.id, w)
    return m
  }, [searchIndex])

  const topMissedWords = useMemo(() => {
    const errorSum = new Map<string, number>()
    for (const st of students) {
      const prog = allStudentProgress[st.id] ?? {}
      for (const rec of Object.values(prog)) {
        if (rec.wrong_count > 0) {
          errorSum.set(rec.word_id, (errorSum.get(rec.word_id) ?? 0) + rec.wrong_count)
        }
      }
    }
    return Array.from(errorSum.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([wordId, errors]) => {
        const d = wordLookup.get(wordId)
        return {
          wordId,
          label: d ? `${d.hanzi} (${d.pinyin})` : wordId,
          errors,
        }
      })
  }, [students, allStudentProgress, wordLookup])

  // 5. LineChart: Tiến bộ điểm Thi thử
  const examTrendData = useMemo(() => {
    return [...filteredExams]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-15)
      .map((ex, i) => ({
        label: `#${i + 1} (${ex.created_at.slice(5, 10)})`,
        listening: ex.listening_score,
        reading: ex.reading_score,
        writing: ex.writing_score,
        total: ex.total_score,
      }))
  }, [filteredExams])

  // 6. BarChart: Phễu trí nhớ toàn lớp
  const cohortFunnelData = useMemo(() => {
    const counts = { new: 0, learning: 0, familiar: 0, mastered: 0 }
    for (const st of students) {
      const prog = Object.values(allStudentProgress[st.id] ?? {})
      for (const rec of prog) {
        counts[rec.mastery_status] += 1
      }
    }
    return [
      { stage: 'Mới', count: counts.new, color: '#94A3B8' },
      { stage: 'Đang học', count: counts.learning, color: '#D97706' },
      { stage: 'Quen thuộc', count: counts.familiar, color: '#0284C7' },
      { stage: 'Thành thạo', count: counts.mastered, color: '#0D9488' },
    ]
  }, [students, allStudentProgress])

  // 7. BarChart: Khung giờ học tập của lớp
  const hourlyBuckets = useMemo(() => {
    const slots = [
      { slot: '0–6h', min: 0, max: 6, count: 0 },
      { slot: '6–9h', min: 6, max: 9, count: 0 },
      { slot: '9–12h', min: 9, max: 12, count: 0 },
      { slot: '12–15h', min: 12, max: 15, count: 0 },
      { slot: '15–18h', min: 15, max: 18, count: 0 },
      { slot: '18–21h', min: 18, max: 21, count: 0 },
      { slot: '21–24h', min: 21, max: 24, count: 0 },
    ]
    for (const s of filteredSessions) {
      const h = new Date(s.started_at).getHours()
      const bucket = slots.find((b) => h >= b.min && h < b.max)
      if (bucket) bucket.count += 1
    }
    return slots
  }, [filteredSessions])

  // Biểu đồ nhiệt 30 ngày
  const heatmapDays = useMemo(() => {
    const today = new Date()
    const cells: { date: string; count: number; level: number }[] = []
    const counts = new Map<string, number>()

    for (const s of sessions) {
      if (!studentIds.has(s.user_id)) continue
      const k = dayKey(s.started_at)
      counts.set(k, (counts.get(k) ?? 0) + Math.max(1, Math.round(s.duration_sec / 300)))
    }
    for (const e of events) {
      if (!studentIds.has(e.user_id)) continue
      const k = dayKey(e.created_at)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }

    for (let offset = 29; offset >= 0; offset -= 1) {
      const d = new Date(today)
      d.setDate(today.getDate() - offset)
      const iso = d.toISOString().slice(0, 10)
      const count = counts.get(iso) ?? 0
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4
      cells.push({ date: iso, count, level })
    }
    return cells
  }, [sessions, events, studentIds])

  // Trung tâm Cảnh báo sớm + Dữ liệu bảng học viên
  const studentRows = useMemo(() => {
    const now = Date.now()
    return students.map((student) => {
      const stSessions = sessions.filter((s) => s.user_id === student.id)
      const totalMinutes = Math.round(stSessions.reduce((acc, s) => acc + s.duration_sec, 0) / 60)
      const avgAcc = stSessions.length
        ? Math.round(stSessions.reduce((acc, s) => acc + s.accuracy_pct, 0) / stSessions.length)
        : 0
      const stProg = Object.values(allStudentProgress[student.id] ?? {})
      const masteredCount = stProg.filter((p) => p.mastery_status === 'mastered').length
      const dueCount = stProg.filter((p) => new Date(p.next_review_at).getTime() <= now).length
      const latestExam = examAttempts
        .filter((e) => e.user_id === student.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      const pendingSubs = submissions.filter(
        (sub) => sub.user_id === student.id && (sub.status === 'submitted' || sub.status === 'pending'),
      ).length

      const daysSinceSeen = Math.floor((now - new Date(student.last_seen_at).getTime()) / 86_400_000)
      const daysJoined = Math.floor((now - new Date(student.created_at).getTime()) / 86_400_000)
      const alerts: string[] = []
      if (student.account_status === 'approved') {
        if (daysSinceSeen >= 3) alerts.push(`Nghỉ ${daysSinceSeen} ngày`)
        if (stSessions.length > 0 && avgAcc < 65) alerts.push(`Chính xác thấp (${avgAcc}%)`)
        if (dueCount >= 20) alerts.push(`${dueCount} từ đến hạn`)
        if ((student.streak_days ?? 0) === 0 && daysJoined >= 2) alerts.push('Chưa giữ chuỗi')
      }

      return {
        student,
        totalMinutes,
        avgAcc,
        masteredCount,
        trackedCount: stProg.length,
        dueCount,
        latestExam,
        pendingSubs,
        alerts,
      }
    })
  }, [students, sessions, allStudentProgress, examAttempts, submissions])

  const atRiskStudents = useMemo(
    () => studentRows.filter((r) => r.alerts.length > 0),
    [studentRows],
  )

  const xpLeaderboard = useMemo(
    () =>
      [...students]
        .sort((a, b) => (b.xp_points ?? 0) - (a.xp_points ?? 0) || (b.streak_days ?? 0) - (a.streak_days ?? 0))
        .slice(0, 8),
    [students],
  )

  const handleQuickAssign = async (student: UserProfile) => {
    setAssigningId(student.id)
    try {
      await onQuickAssignReview(student)
      toast.success(`Đã giao bài ôn bổ sung 15 từ HSK ${Math.max(1, student.current_hsk_level || 1)} cho ${student.full_name}`)
    } catch (err) {
      toast.error(`Không giao được bài: ${err instanceof Error ? err.message : 'Lỗi kết nối'}`)
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Thanh bộ lọc Thời gian & Cấp HSK */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-ink">Bảng Điều Khiển &amp; Phân Tích Lớp Học</h1>
          <p className="text-xs text-muted">Theo dõi chuỗi học tập, XP, 5 nhóm kỹ năng và cảnh báo học viên theo thời gian thực</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line bg-glass-subtle p-1">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysWindow(d)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  daysWindow === d ? 'bg-jade text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {d} ngày
              </button>
            ))}
          </div>

          <select
            aria-label="Lọc theo cấp độ HSK"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-full border border-line bg-glass-strong px-3.5 py-1.5 text-xs font-semibold text-ink outline-none"
          >
            <option value="all">Tất cả cấp HSK</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
              <option key={lvl} value={lvl}>HSK {lvl}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Sĩ số lớp</span>
            <Users className="h-4 w-4 text-jade" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{stats.totalStudents}</p>
          <p className="mt-1 text-xs text-muted">{stats.active7d} học viên hoạt động 7 ngày qua</p>
        </div>

        <div className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tổng điểm XP lớp</span>
            <Sparkles className="h-4 w-4 text-jade" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{stats.totalXp.toLocaleString('vi-VN')} XP</p>
          <p className="mt-1 text-xs text-muted">Tích lũy từ thẻ từ, trắc nghiệm &amp; thi thử</p>
        </div>

        <div className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Chuỗi ngày học</span>
            <Flame className="h-4 w-4 text-ochre" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{stats.bestStreak} ngày</p>
          <p className="mt-1 text-xs text-muted">Kỷ lục lớp · Trung bình {stats.avgStreak} ngày</p>
        </div>

        <div className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Thời gian học TB</span>
            <Clock className="h-4 w-4 text-periwinkle" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{stats.avgMinutesPerStudent} phút</p>
          <p className="mt-1 text-xs text-muted">Trong {daysWindow} ngày gần nhất</p>
        </div>

        <div className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Độ chính xác TB</span>
            <Activity className="h-4 w-4 text-moss" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{stats.avgAccuracy}%</p>
          <p className="mt-1 text-xs text-muted">Trên {filteredSessions.length} phiên luyện tập</p>
        </div>

        <div className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tỉ lệ đạt thi thử</span>
            <Award className="h-4 w-4 text-ochre" />
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{stats.passRate}%</p>
          <p className="mt-1 text-xs text-muted">{stats.attemptCount} lượt thi đã nộp</p>
        </div>
      </div>

      {/* Trung tâm Cảnh báo sớm */}
      <section className="glass-panel rounded-3xl p-5 space-y-3" data-testid="early-warning-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-ochre" />
            <div>
              <h2 className="text-base font-bold text-ink">Cần Cô Mai quan tâm ({atRiskStudents.length})</h2>
              <p className="text-xs text-muted">Tự động phát hiện học viên nghỉ lâu, tụt độ chính xác, sắp đứt chuỗi hoặc tồn nhiều từ cần ôn</p>
            </div>
          </div>
        </div>

        {atRiskStudents.length === 0 ? (
          <div className="glass-subtle p-4 text-xs text-moss font-medium">
            Toàn bộ học viên đang giữ tiến độ ổn định, chưa có cảnh báo nào.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {atRiskStudents.map(({ student, alerts }) => (
              <div key={student.id} className="glass-subtle p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">{student.full_name}</span>
                    <span className="text-xs text-muted">HSK {Math.max(1, student.current_hsk_level || 1)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {alerts.map((reason) => (
                      <span key={reason} className="soft-chip !bg-terracotta-soft !text-terracotta text-[11px]">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={assigningId === student.id}
                    onClick={() => void handleQuickAssign(student)}
                    className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs"
                  >
                    <Zap size={13} /> {assigningId === student.id ? 'Đang giao...' : 'Giao bài ôn 1 chạm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectStudent(student)}
                    className="glass-pill-btn !min-h-8 !px-3 text-xs"
                  >
                    Xem
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hàng biểu đồ 1: AreaChart + RadarChart */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Thời lượng học {daysWindow} ngày gần nhất</h2>
              <p className="text-xs text-muted">Tổng số phút học mỗi ngày của toàn lớp</p>
            </div>
            <span className="soft-chip">Phút / Ngày</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStudySeries} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="cohortMinutesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,145,0.18)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="minutes" name="Phút học" stroke="#0D9488" strokeWidth={2.5} fillOpacity={1} fill="url(#cohortMinutesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Bản đồ 5 kỹ năng toàn lớp</h2>
              <p className="text-xs text-muted">Cân bằng Từ vựng, Thanh điệu, Đọc hiểu, Viết và Độ đều đặn</p>
            </div>
            <span className="soft-chip !bg-periwinkle-soft !text-periwinkle">Radar</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={skillRadarData}>
                <PolarGrid stroke="rgba(120,130,145,0.22)" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: 'var(--ink)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Radar name="Điểm kỹ năng (%)" dataKey="score" stroke="#0D9488" fill="#0D9488" fillOpacity={0.32} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Hàng biểu đồ 2: Donut Chế độ học + Top 10 từ hay sai */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Phân bổ Chế độ luyện tập</h2>
              <p className="text-xs text-muted">Tỉ trọng lượt học giữa Thẻ từ, Thanh điệu, Gõ Pinyin &amp; Thi thử</p>
            </div>
            <span className="soft-chip">Lượt học</span>
          </div>
          <div className="h-64 w-full">
            {modeDonutData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">Chưa có dữ liệu phiên học trong khoảng thời gian này.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modeDonutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={86} paddingAngle={3}>
                    {modeDonutData.map((entry) => (
                      <Cell key={entry.mode} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Top 10 từ cả lớp hay sai nhất</h2>
              <p className="text-xs text-muted">Giúp Cô chọn nhanh các từ cần giảng lại trên lớp</p>
            </div>
            <span className="soft-chip !bg-terracotta-soft !text-terracotta">Cần lưu ý</span>
          </div>
          <div className="h-64 w-full">
            {topMissedWords.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">Chưa ghi nhận lượt làm sai từ vựng nào.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMissedWords} layout="vertical" margin={{ top: 4, right: 18, left: 20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,145,0.18)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis type="category" dataKey="label" width={115} tick={{ fontSize: 11, fill: 'var(--ink)' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="errors" name="Số lượt sai" fill="#DC2626" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Hàng biểu đồ 3: LineChart Thi thử + Phễu trí nhớ + Khung giờ học */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-ink">Tiến bộ điểm Thi thử</h2>
            <p className="text-xs text-muted">Xu hướng Nghe · Đọc · Viết · Tổng điểm</p>
          </div>
          <div className="h-56 w-full">
            {examTrendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">Chưa có bài thi thử nào được nộp.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={examTrendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,145,0.18)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="total" name="Tổng" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="listening" name="Nghe" stroke="#0284C7" strokeWidth={1.8} />
                  <Line type="monotone" dataKey="reading" name="Đọc" stroke="#D97706" strokeWidth={1.8} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-ink">Phễu trí nhớ toàn lớp</h2>
            <p className="text-xs text-muted">Tổng hợp độ chín từ vựng SM-2</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortFunnelData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,145,0.18)" />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Số từ" radius={[8, 8, 0, 0]}>
                  {cohortFunnelData.map((entry) => (
                    <Cell key={entry.stage} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-ink">Khung giờ học tập của lớp</h2>
            <p className="text-xs text-muted">Giờ vàng học viên hay mở app luyện tập</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyBuckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,145,0.18)" />
                <XAxis dataKey="slot" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Số phiên" fill="#0284C7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bảng Xếp Hạng Chuỗi & XP + Biểu đồ nhiệt 30 ngày */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="glass-panel rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink flex items-center gap-1.5">
              <Trophy size={16} className="text-ochre" /> Bảng Xếp Hạng XP &amp; Chuỗi
            </h2>
          </div>
          <div className="space-y-2">
            {xpLeaderboard.map((st, idx) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectStudent(st)}
                className="w-full glass-subtle px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:border-jade transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0 ? 'bg-ochre text-white' : idx === 1 ? 'bg-jade text-white' : 'bg-glass text-muted border border-line'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-ink">{st.full_name}</div>
                    <div className="text-[11px] text-muted">HSK {Math.max(1, st.current_hsk_level || 1)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs font-bold tabular-nums">
                  <span className="text-ochre">🔥 {st.streak_days ?? 0}</span>
                  <span className="text-jade">{st.xp_points ?? 0} XP</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">Biểu đồ nhiệt hoạt động 30 ngày</h2>
              <p className="text-xs text-muted">Tổng hợp tần suất ôn thẻ, luyện thanh điệu, trắc nghiệm và thi thử</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span>Nghỉ</span>
              <span className="h-3 w-3 rounded-[4px] bg-glass-subtle border border-line" />
              <span className="h-3 w-3 rounded-[4px] bg-[color-mix(in_srgb,var(--jade)_30%,transparent)]" />
              <span className="h-3 w-3 rounded-[4px] bg-[color-mix(in_srgb,var(--jade)_55%,transparent)]" />
              <span className="h-3 w-3 rounded-[4px] bg-[color-mix(in_srgb,var(--jade)_80%,transparent)]" />
              <span className="h-3 w-3 rounded-[4px] bg-[var(--jade)]" />
              <span>Chăm chỉ</span>
            </div>
          </div>
          <div className="grid grid-cols-10 gap-2 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
            {heatmapDays.map((cell) => {
              const bgClass =
                cell.level === 0
                  ? 'bg-glass-subtle'
                  : cell.level === 1
                    ? 'bg-[color-mix(in_srgb,var(--jade)_28%,transparent)]'
                    : cell.level === 2
                      ? 'bg-[color-mix(in_srgb,var(--jade)_52%,transparent)]'
                      : cell.level === 3
                        ? 'bg-[color-mix(in_srgb,var(--jade)_78%,transparent)]'
                        : 'bg-[var(--jade)]'
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} hoạt động`}
                  className={`flex h-9 flex-col items-center justify-center rounded-xl border border-line text-[10px] font-medium tabular-nums ${bgClass} ${
                    cell.level >= 3 ? 'text-white' : 'text-muted'
                  }`}
                >
                  <span>{cell.date.slice(8)}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Bảng chi tiết từng học viên */}
      <section className="glass-panel rounded-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Chi tiết Học viên lớp Hoa Ngữ Cô Mai</h2>
            <p className="text-xs text-muted">Bấm vào từng dòng để xem Radar 5 kỹ năng, tặng điểm thưởng XP và gửi Sticker khen ngợi</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="pb-3 font-medium">Học viên</th>
                <th className="pb-3 font-medium">Lộ trình</th>
                <th className="pb-3 font-medium">Chuỗi &amp; XP</th>
                <th className="pb-3 font-medium">Đã học</th>
                <th className="pb-3 font-medium">Chính xác</th>
                <th className="pb-3 font-medium">Từ thuộc</th>
                <th className="pb-3 font-medium">Thi thử gần nhất</th>
                <th className="pb-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {studentRows.map(({ student, totalMinutes, avgAcc, masteredCount, trackedCount, dueCount, latestExam, pendingSubs }) => (
                <tr
                  key={student.id}
                  onClick={() => onSelectStudent(student)}
                  className="cursor-pointer transition hover:bg-[color-mix(in_srgb,var(--jade)_8%,transparent)]"
                >
                  <td className="py-3.5 pr-3">
                    <div className="font-semibold text-ink">{student.full_name}</div>
                    <div className="text-xs text-muted">{student.email}</div>
                  </td>
                  <td className="py-3.5 pr-3">
                    <span className="soft-chip !bg-periwinkle-soft !text-periwinkle">
                      {student.current_hsk_level === 0 ? 'Mới' : `HSK ${student.current_hsk_level}`} → HSK {student.target_hsk_level}
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 tabular-nums text-xs">
                    <span className="font-bold text-ochre mr-2">🔥 {student.streak_days ?? 0}d</span>
                    <span className="font-bold text-jade">{student.xp_points ?? 0} XP</span>
                  </td>
                  <td className="py-3.5 pr-3 tabular-nums text-muted text-xs">
                    {totalMinutes} phút
                  </td>
                  <td className="py-3.5 pr-3 tabular-nums font-medium text-ink">{avgAcc}%</td>
                  <td className="py-3.5 pr-3 tabular-nums text-muted text-xs">
                    {masteredCount} / {trackedCount || 0}
                    {dueCount > 0 && <span className="ml-1.5 text-ochre">({dueCount} hạn)</span>}
                  </td>
                  <td className="py-3.5 pr-3">
                    {latestExam ? (
                      <span
                        className={`soft-chip ${
                          latestExam.passed ? '!bg-moss-soft !text-moss' : '!bg-terracotta-soft !text-terracotta'
                        }`}
                      >
                        HSK {latestExam.hsk_level}: {latestExam.total_score} ({latestExam.passed ? 'Đạt' : 'Cần ôn'})
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Chưa thi</span>
                    )}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectStudent(student)
                      }}
                      className="glass-pill-btn !min-h-8 !px-3 text-xs !text-jade"
                    >
                      <Gift size={13} /> Khen / Xem {pendingSubs > 0 ? `(${pendingSubs})` : ''}
                    </button>
                  </td>
                </tr>
              ))}
              {studentRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted">
                    Chưa có học viên nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
