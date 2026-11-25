import { Copy, Eye, EyeOff, Gift, KeyRound, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { toast } from 'sonner'
import { KUDOS_STICKERS, PET_CATALOG, getRankForXp } from '../../lib/gamification'
import ClayPetAvatar from '../gamification/ClayPetAvatar'
import GlassDialog from '../common/GlassDialog'
import type { ExamAttemptRecord, KudosSticker, StudySession, TeacherKudos, UserProfile, VocabProgressRecord } from '../../types/lms'
import type { DictEntry } from '../../types/vocab'

interface StudentDrawerProps {
  student: UserProfile | null
  onClose: () => void
  allStudentProgress: Record<string, Record<string, VocabProgressRecord>>
  sessions: StudySession[]
  examAttempts: ExamAttemptRecord[]
  kudos: TeacherKudos[]
  savedPassword?: string
  searchIndex: DictEntry[]
  onEnsureSearchIndex: () => Promise<DictEntry[]>
  onReviewExamAttempt: (attemptId: string, writingScore: number, feedback: string) => Promise<void>
  onSendKudos: (studentId: string, xpBonus: number, sticker: KudosSticker, message: string) => Promise<void>
  onResetPassword: (studentId: string, newPassword: string) => Promise<void>
}

export function StudentDrawer({
  student,
  onClose,
  allStudentProgress,
  sessions,
  examAttempts,
  kudos,
  savedPassword,
  searchIndex,
  onEnsureSearchIndex,
  onReviewExamAttempt,
  onSendKudos,
  onResetPassword,
}: StudentDrawerProps) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>('')
  const [writingScore, setWritingScore] = useState<string>('78')
  const [feedback, setFeedback] = useState<string>('')
  const [savingReview, setSavingReview] = useState(false)

  const [kudosSticker, setKudosSticker] = useState<KudosSticker>('star')
  const [kudosXp, setKudosXp] = useState<number>(25)
  const [kudosMsg, setKudosMsg] = useState<string>('')
  const [sendingKudos, setSendingKudos] = useState(false)

  const [showDrawerPw, setShowDrawerPw] = useState(false)
  const [newDrawerPw, setNewDrawerPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (student && searchIndex.length === 0) {
      void onEnsureSearchIndex()
    }
  }, [student, searchIndex.length, onEnsureSearchIndex])

  const wordLookup = useMemo(() => {
    const map = new Map<string, DictEntry>()
    for (const item of searchIndex) map.set(item.id, item)
    return map
  }, [searchIndex])

  const studentProgress = useMemo(() => {
    if (!student) return []
    return Object.values(allStudentProgress[student.id] ?? {})
  }, [student, allStudentProgress])

  const funnelData = useMemo(() => {
    const counts = { new: 0, learning: 0, familiar: 0, mastered: 0 }
    for (const rec of studentProgress) counts[rec.mastery_status] += 1
    return [
      { stage: 'Mới', count: counts.new, color: '#8E99A8' },
      { stage: 'Đang học', count: counts.learning, color: '#C79A5B' },
      { stage: 'Quen thuộc', count: counts.familiar, color: '#6F7FA6' },
      { stage: 'Thành thạo', count: counts.mastered, color: '#4B8B7B' },
    ]
  }, [studentProgress])

  const topMissed = useMemo(() => {
    return [...studentProgress]
      .filter((p) => p.wrong_count > 0 || p.is_flagged_hard)
      .sort((a, b) => b.wrong_count - a.wrong_count)
      .slice(0, 8)
  }, [studentProgress])

  const studentSessions = useMemo(() => {
    if (!student) return []
    return sessions
      .filter((s) => s.user_id === student.id)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 10)
  }, [student, sessions])

  const studentExams = useMemo(() => {
    if (!student) return []
    return examAttempts
      .filter((e) => e.user_id === student.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [student, examAttempts])

  const activeAttempt = useMemo(() => {
    return studentExams.find((e) => e.id === selectedAttemptId) ?? studentExams[0] ?? null
  }, [studentExams, selectedAttemptId])

  useEffect(() => {
    if (activeAttempt) {
      setWritingScore(String(activeAttempt.writing_score || 0))
      setFeedback(activeAttempt.admin_feedback ?? '')
    }
  }, [activeAttempt])

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAttempt) return
    const parsedScore = Math.max(0, Math.min(100, Number(writingScore) || 0))
    setSavingReview(true)
    try {
      await onReviewExamAttempt(activeAttempt.id, parsedScore, feedback.trim())
      toast.success('Đã lưu điểm Viết và nhận xét giáo viên')
    } finally {
      setSavingReview(false)
    }
  }

  const studentKudos = useMemo(() => {
    if (!student) return []
    return kudos.filter((k) => k.student_id === student.id).slice(0, 6)
  }, [student, kudos])

  const studentRadar = useMemo(() => {
    if (!student) return []
    const allSess = sessions.filter((s) => s.user_id === student.id)
    const avgOf = (modes: string[]) => {
      const m = allSess.filter((s) => modes.includes(s.mode))
      return m.length ? Math.round(m.reduce((a, s) => a + s.accuracy_pct, 0) / m.length) : 0
    }
    const masteredPct = studentProgress.length
      ? Math.round((studentProgress.filter((p) => p.mastery_status === 'mastered' || p.mastery_status === 'familiar').length / studentProgress.length) * 100)
      : 0
    const writingPct = studentExams.length
      ? Math.round(studentExams.reduce((a, e) => a + (e.writing_score || 0), 0) / studentExams.length)
      : avgOf(['grammar', 'writing'])
    const streakPct = Math.min(100, Math.round(((student.streak_days ?? 0) / 7) * 100))

    return [
      { skill: 'Từ vựng', score: masteredPct },
      { skill: 'Thanh điệu', score: avgOf(['tone', 'dictation']) },
      { skill: 'Đọc hiểu', score: avgOf(['quiz', 'match']) },
      { skill: 'Viết / Câu', score: writingPct },
      { skill: 'Đều đặn', score: streakPct },
    ]
  }, [student, sessions, studentProgress, studentExams])

  const handleSendKudos = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    setSendingKudos(true)
    try {
      await onSendKudos(
        student.id,
        kudosXp,
        kudosSticker,
        kudosMsg.trim() || `Cô Mai khen ${student.full_name} học rất chăm chỉ!`,
      )
      setKudosMsg('')
      toast.success(`Đã tặng +${kudosXp} XP và gửi Sticker cho ${student.full_name}`)
    } catch (err) {
      toast.error(`Không gửi được lời khen: ${err instanceof Error ? err.message : 'Lỗi máy chủ'}`)
    } finally {
      setSendingKudos(false)
    }
  }

  const handleDrawerResetPw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    if (newDrawerPw.length < 6) {
      toast.error('Mật khẩu mới cần tối thiểu 6 ký tự.')
      return
    }
    setSavingPw(true)
    try {
      await onResetPassword(student.id, newDrawerPw)
      setNewDrawerPw('')
      setShowDrawerPw(true)
      toast.success(`Đã đổi mật khẩu mới cho ${student.full_name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đổi được mật khẩu.')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <GlassDialog
      open={Boolean(student)}
      onClose={onClose}
      title={student ? `Hồ sơ học viên: ${student.full_name}` : 'Hồ sơ học viên'}
      subtitle={
        student
          ? `${student.email} • Lộ trình ${student.current_hsk_level === 0 ? 'Mới bắt đầu' : `HSK ${student.current_hsk_level}`} → HSK ${student.target_hsk_level} • ${student.daily_goal_minutes} phút/ngày`
          : undefined
      }
      maxWidthClass="max-w-4xl"
    >
      {student && (
        <div className="space-y-6">
          {/* Thông tin đăng nhập & Đổi mật khẩu nhanh */}
          <form onSubmit={handleDrawerResetPw} className="glass-subtle rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-ink flex items-center gap-1.5">
                <KeyRound size={15} className="text-jade" /> Tài khoản &amp; Mật khẩu học viên
              </div>
              <div className="flex flex-wrap items-center gap-2 text-muted">
                <span>Email: <strong className="text-ink">{student.email}</strong></span>
                <span>•</span>
                <span>Mật khẩu:</span>
                {savedPassword ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-glass px-2 py-0.5 font-mono font-semibold text-ink">
                    {showDrawerPw ? savedPassword : '••••••••'}
                    <button
                      type="button"
                      onClick={() => setShowDrawerPw((v) => !v)}
                      className="text-muted hover:text-jade cursor-pointer"
                    >
                      {showDrawerPw ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(`${student.email} / ${savedPassword}`)
                        toast.success('Đã sao chép tài khoản & mật khẩu')
                      }}
                      className="text-muted hover:text-jade cursor-pointer"
                    >
                      <Copy size={12} />
                    </button>
                  </span>
                ) : (
                  <span>Chưa lưu</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newDrawerPw}
                onChange={(e) => setNewDrawerPw(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                className="rounded-xl border border-line bg-glass px-3 py-1.5 text-xs font-mono text-ink outline-none focus:border-jade"
              />
              <button type="submit" disabled={savingPw || !newDrawerPw.trim()} className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs">
                {savingPw ? 'Đang lưu...' : 'Đổi MK'}
              </button>
            </div>
          </form>
          {/* Tóm tắt Gamification + Thú cưng + Radar 5 kỹ năng cá nhân */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="glass-subtle rounded-2xl p-4 flex items-center gap-3">
              <ClayPetAvatar pet={student.pet_type ?? 'cat'} mood="happy" size={56} />
              <div className="min-w-0 space-y-1 text-xs">
                <div className="font-bold text-ink">{getRankForXp(student.xp_points ?? 0).title}</div>
                <div className="flex flex-wrap gap-2 font-bold tabular-nums">
                  <span className="text-ochre">🔥 {student.streak_days ?? 0} ngày</span>
                  <span className="text-jade">⭐ {student.xp_points ?? 0} XP</span>
                </div>
                <div className="text-[11px] text-muted">
                  Bạn đồng hành: {PET_CATALOG.find((p) => p.id === (student.pet_type ?? 'cat'))?.nameVi}
                </div>
              </div>
            </div>

            <div className="glass-subtle rounded-2xl p-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-ink mb-1">Biểu đồ 5 kỹ năng cá nhân</h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="68%" data={studentRadar}>
                    <PolarGrid stroke="rgba(120,130,145,0.2)" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: 'var(--ink)' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                    <Radar name="Điểm (%)" dataKey="score" stroke="#0D9488" fill="#0D9488" fillOpacity={0.35} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tặng điểm thưởng XP & Sticker lời khen từ Cô Mai */}
          <form onSubmit={handleSendKudos} className="glass-subtle rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <Gift size={16} className="text-ochre" /> Tặng thưởng XP &amp; Sticker khen ngợi
              </h3>
              <span className="text-xs text-muted">Học viên sẽ nhận thông báo khi đăng nhập</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {KUDOS_STICKERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setKudosSticker(s.id)}
                  className={`glass-pill-btn !min-h-8 !px-3 text-xs ${
                    kudosSticker === s.id ? 'glass-primary-btn' : ''
                  }`}
                >
                  <span>{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-4">
              <select
                aria-label="Mức XP tặng thêm"
                value={kudosXp}
                onChange={(e) => setKudosXp(Number(e.target.value))}
                className="rounded-xl border border-line bg-glass px-3 py-2 text-xs font-semibold text-ink outline-none"
              >
                {[10, 25, 50, 100].map((v) => (
                  <option key={v} value={v}>+{v} XP thưởng</option>
                ))}
              </select>
              <input
                type="text"
                value={kudosMsg}
                onChange={(e) => setKudosMsg(e.target.value)}
                placeholder="Lời nhắn động viên của Cô Mai..."
                className="rounded-xl border border-line bg-glass px-3 py-2 text-xs text-ink outline-none sm:col-span-2"
              />
              <button type="submit" disabled={sendingKudos} className="glass-pill-btn glass-primary-btn text-xs">
                <Send size={14} /> {sendingKudos ? 'Đang gửi...' : 'Gửi lời khen'}
              </button>
            </div>

            {studentKudos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted">
                <span>Đã gửi gần đây:</span>
                {studentKudos.slice(0, 3).map((k) => {
                  const st = KUDOS_STICKERS.find((x) => x.id === k.sticker)
                  return (
                    <span key={k.id} className="rounded-full border border-line bg-glass px-2 py-0.5 text-ink">
                      {st?.emoji} +{k.xp_bonus} XP ({k.created_at.slice(0, 10)})
                    </span>
                  )
                })}
              </div>
            )}
          </form>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="glass-subtle rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-ink">Phễu ghi nhớ từ vựng (SM-2)</h3>
              <p className="mb-3 text-xs text-muted">
                {studentProgress.length} từ đang theo dõi theo chu kỳ ôn tập
              </p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,145,0.18)" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid var(--glass-line)',
                        background: 'var(--glass-strong)',
                        color: 'var(--ink)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" name="Số từ" radius={[8, 8, 0, 0]}>
                      {funnelData.map((entry) => (
                        <Cell key={entry.stage} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-subtle rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-ink">Từ hay nhầm &amp; Đánh dấu khó</h3>
              <p className="mb-3 text-xs text-muted">Các từ có số lần sai nhiều nhất cần ôn kỹ</p>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {topMissed.map((item) => {
                  const dict = wordLookup.get(item.word_id)
                  return (
                    <div
                      key={item.word_id}
                      className="flex items-center justify-between rounded-xl border border-line bg-glass px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="hanzi text-base font-semibold text-ink">
                          {dict?.hanzi ?? item.word_id}
                        </span>
                        {dict && (
                          <span className="ml-2 text-muted">
                            {dict.pinyin} • {dict.hanViet}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--terracotta)_16%,transparent)] px-2 py-0.5 font-semibold tabular-nums text-[var(--terracotta)]">
                          Sai {item.wrong_count} lần
                        </span>
                        {item.is_flagged_hard && (
                          <span className="rounded-full bg-[color-mix(in_srgb,var(--ochre)_16%,transparent)] px-2 py-0.5 text-[var(--ochre)]">
                            Khó
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {topMissed.length === 0 && (
                  <p className="py-10 text-center text-xs text-muted">Chưa ghi nhận từ nào làm sai.</p>
                )}
              </div>
            </div>
          </div>

          <div className="glass-subtle rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-ink">Lịch sử Thi thử &amp; Chấm phần Viết</h3>
            {studentExams.length === 0 ? (
              <p className="mt-2 text-xs text-muted">Học viên này chưa nộp bài thi thử nào.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  {studentExams.map((attempt) => {
                    const isSelected = activeAttempt?.id === attempt.id
                    return (
                      <button
                        key={attempt.id}
                        type="button"
                        onClick={() => setSelectedAttemptId(attempt.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-[var(--jade)] bg-[color-mix(in_srgb,var(--jade)_10%,transparent)]'
                            : 'border-line bg-glass'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-ink">
                            HSK {attempt.hsk_level} ({attempt.mode === 'full' ? 'Đề đầy đủ' : 'Từng phần'})
                          </span>
                          <span className={attempt.passed ? 'text-[var(--moss)]' : 'text-[var(--terracotta)]'}>
                            Tổng {attempt.total_score} • {attempt.passed ? 'Đạt' : 'Chưa đạt'}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
                          <span>Nghe: {attempt.listening_score}</span>
                          <span>Đọc: {attempt.reading_score}</span>
                          <span>Viết: {attempt.writing_score}</span>
                          <span>{attempt.created_at.slice(0, 10)}</span>
                          {attempt.admin_reviewed && <span className="text-[var(--jade)]">Đã chấm</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {activeAttempt && (
                  <form onSubmit={handleSaveReview} className="space-y-3 rounded-2xl border border-line bg-glass p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Chấm điểm Viết / Dịch thuật
                    </div>
                    {activeAttempt.writing_prompt && (
                      <p className="text-xs text-muted">
                        <strong>Đề bài:</strong> {activeAttempt.writing_prompt}
                      </p>
                    )}
                    <div className="max-h-32 overflow-y-auto rounded-xl border border-line bg-glass-strong p-3 text-xs leading-relaxed text-ink">
                      {activeAttempt.writing_text || 'Không có bài viết tự luận trong lượt thi này.'}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="text-xs font-medium text-muted">
                        Điểm Viết (0–100)
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={writingScore}
                          onChange={(e) => setWritingScore(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-1.5 text-sm text-ink"
                        />
                      </label>
                      <label className="text-xs font-medium text-muted sm:col-span-2">
                        Nhận xét của giáo viên
                        <input
                          type="text"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Góp ý ngữ pháp, cách dùng từ cho học viên..."
                          className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-1.5 text-sm text-ink"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={savingReview}
                      className="rounded-xl bg-[var(--jade)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {savingReview ? 'Đang lưu...' : 'Lưu điểm & Nhận xét'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          <div className="glass-subtle rounded-2xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">Các phiên học gần đây</h3>
            <div className="space-y-1.5 text-xs">
              {studentSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-glass px-3 py-2"
                >
                  <span className="font-medium text-ink">
                    HSK {sess.hsk_level} · {sess.mode === 'flashcard' ? 'Thẻ nhớ' : sess.mode === 'mock_exam' ? 'Thi thử' : 'Luyện tập'}
                  </span>
                  <span className="tabular-nums text-muted">
                    {Math.max(1, Math.round(sess.duration_sec / 60))} phút • {sess.items_completed} câu • Đúng {sess.accuracy_pct}%
                  </span>
                  <span className="text-muted">
                    {sess.device_info.viewport === 'mobile' ? 'Điện thoại' : 'Máy tính'} • {sess.started_at.slice(0, 10)}
                  </span>
                </div>
              ))}
              {studentSessions.length === 0 && <p className="text-muted">Chưa có phiên học nào được ghi lại.</p>}
            </div>
          </div>
        </div>
      )}
    </GlassDialog>
  )
}
