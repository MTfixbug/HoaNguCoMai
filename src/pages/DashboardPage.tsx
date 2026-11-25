import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  Flame,
  FlaskConical,
  Keyboard,
  Layers,
  Music2,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import TeacherKudosBanner from '../components/gamification/TeacherKudosBanner'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { computeAchievements, getRankForXp } from '../lib/gamification'
import { isDue } from '../lib/srs'

export default function DashboardPage() {
  const { profile } = useAuth()
  const { profiles, customLessons, progressMap, sessions, assignments, submissions, examAttempts } = useLms()

  const liveProfile = profiles.find((p) => p.id === profile?.id) ?? profile
  const uid = liveProfile?.id ?? ''
  const activeLevel = Math.max(1, liveProfile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, liveProfile?.target_hsk_level || activeLevel)
  const goalMin = liveProfile?.daily_goal_minutes ?? 20

  const xpPoints = liveProfile?.xp_points ?? 0
  const streakDays = liveProfile?.streak_days ?? 0
  const longestStreak = Math.max(streakDays, liveProfile?.longest_streak ?? 0)
  const rank = getRankForXp(xpPoints)
  const achievements = computeAchievements(liveProfile ?? null, progressMap, sessions, examAttempts)
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  const todayPrefix = new Date().toISOString().slice(0, 10)
  const studiedTodaySec = sessions
    .filter((s) => s.user_id === uid && s.started_at.startsWith(todayPrefix))
    .reduce((acc, s) => acc + s.duration_sec, 0)
  const studiedMin = Math.round(studiedTodaySec / 60)
  const goalPct = Math.min(100, Math.round((studiedMin / Math.max(1, goalMin)) * 100))

  const allProgress = Object.values(progressMap)
  const dueCount = allProgress.filter((c) => c.hsk_level === activeLevel && isDue(c)).length
  const mistakeCount = allProgress.filter((c) => c.wrong_count > 0 || c.is_flagged_hard).length
  const masteredCount = allProgress.filter((c) => c.mastery_status === 'mastered').length

  const radius = 32
  const circ = 2 * Math.PI * radius
  const dashOffset = circ - (goalPct / 100) * circ

  const studentAssignments = assignments.filter(
    (a) => a.assigned_to === 'all' || (Array.isArray(a.assigned_to) && a.assigned_to.includes(uid)),
  )

  const stageLessons = customLessons.filter((l) => l.is_published && l.hsk_level === activeLevel)

  const roadmapStages = Array.from({ length: targetLevel - activeLevel + 1 }, (_, i) => activeLevel + i).filter(
    (lvl) => lvl <= 9,
  )

  return (
    <div className="space-y-6">
      {/* Lời khen & Điểm thưởng từ Cô Mai */}
      {uid && <TeacherKudosBanner studentId={uid} />}

      {/* Thẻ chính dẫn dắt "Hôm nay học gì?" */}
      <section className="glass-panel p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-jade">
              Hoa Ngữ Cô Mai · Chặng HSK {activeLevel >= 7 ? '7–9' : activeLevel}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
              Xin chào{liveProfile?.full_name ? `, ${liveProfile.full_name}` : ''}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted">
              Mọi bài tập và đề thi hiện tại được tập trung gọn vào chặng <strong>HSK {activeLevel}</strong> hướng tới mục tiêu <strong>HSK {targetLevel}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-muted mr-1">
              <Compass size={14} className="text-jade" /> Lộ trình:
            </span>
            {roadmapStages.map((lvl) => (
              <span
                key={lvl}
                className={`soft-chip ${
                  lvl === activeLevel ? '!bg-jade !text-white' : '!bg-glass-subtle !text-muted border border-line'
                }`}
              >
                HSK {lvl}
              </span>
            ))}
          </div>
        </div>

        {/* Thanh Chuỗi ngày học + Điểm tích lũy XP + Cấp bậc */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass-subtle p-3.5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ochre-soft text-ochre">
              <Flame size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted">Chuỗi học tập</div>
              <div className="text-sm font-bold text-ink tabular-nums">
                {streakDays} ngày <span className="text-xs font-normal text-muted">(kỷ lục {longestStreak})</span>
              </div>
            </div>
          </div>

          <div className="glass-subtle p-3.5 flex items-center gap-3 sm:col-span-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-jade-soft text-jade">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-ink">
                  Cấp {rank.level}: {rank.title}
                </span>
                <span className="font-bold text-jade tabular-nums">
                  {xpPoints} / {rank.nextXp} XP
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-jade transition-all duration-300"
                  style={{ width: `${rank.progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 6 Hoạt động học tập khóa theo chặng HSK hiện tại */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/flashcards"
            className="card-playful rounded-2xl border border-line bg-glass-subtle p-4 hover:border-jade hover:bg-jade-soft/45 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-soft text-jade">
                <Layers size={20} />
              </div>
              {dueCount > 0 ? (
                <span className="soft-chip">{dueCount} đến hạn</span>
              ) : (
                <span className="text-[11px] font-semibold text-jade">Quẹt thẻ</span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Học Thẻ từ HSK {activeLevel}</h2>
              <p className="mt-0.5 text-xs text-muted">Quẹt trái/phải phân loại nhanh, nghe đọc và tập viết nét chữ Hán.</p>
            </div>
          </Link>

          <Link
            to="/lab?tab=tone"
            className="card-playful rounded-2xl border border-line bg-glass-subtle p-4 hover:border-jade hover:bg-jade-soft/45 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-soft text-jade">
                <Music2 size={20} />
              </div>
              <span className="text-[11px] font-semibold text-muted">Mới</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Luyện Thanh Điệu (1–4)</h2>
              <p className="mt-0.5 text-xs text-muted">Nghe âm và chọn chuẩn 4 thanh điệu + thanh nhẹ từng âm tiết.</p>
            </div>
          </Link>

          <Link
            to="/lab?tab=dictation"
            className="card-playful rounded-2xl border border-line bg-glass-subtle p-4 hover:border-jade hover:bg-jade-soft/45 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-soft text-jade">
                <Keyboard size={20} />
              </div>
              <span className="text-[11px] font-semibold text-muted">Phản xạ</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Nghe – Gõ Pinyin</h2>
              <p className="mt-0.5 text-xs text-muted">Nghe giọng đọc chuẩn và gõ nhanh phiên âm kèm số thanh.</p>
            </div>
          </Link>

          <Link
            to="/quiz"
            className="card-playful rounded-2xl border border-line bg-glass-subtle p-4 hover:border-jade hover:bg-jade-soft/45 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-soft text-jade">
                <Zap size={20} />
              </div>
              <span className="text-[11px] font-semibold text-muted">Trắc nghiệm</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Trắc nghiệm tổng hợp</h2>
              <p className="mt-0.5 text-xs text-muted">Chọn nghĩa, điền câu ngữ cảnh, luyện nghe và đấu tốc độ.</p>
            </div>
          </Link>

          <Link
            to="/lab?tab=match"
            className="card-playful rounded-2xl border border-line bg-glass-subtle p-4 hover:border-jade hover:bg-jade-soft/45 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-soft text-jade">
                <FlaskConical size={20} />
              </div>
              <span className="text-[11px] font-semibold text-muted">{stageLessons.length} bài của Cô</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Ghép cặp &amp; Bài của Cô</h2>
              <p className="mt-0.5 text-xs text-muted">Ghép cặp siêu tốc, sắp xếp câu và học bài Cô Mai soạn riêng.</p>
            </div>
          </Link>

          <Link
            to="/exams"
            className="card-playful rounded-2xl border border-jade/40 bg-jade-soft p-4 hover:border-jade flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade text-white">
                <FileSpreadsheet size={20} />
              </div>
              <span className="soft-chip !bg-white/85 !text-jade">Lên cấp</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Thi thử lên cấp HSK {activeLevel}</h2>
              <p className="mt-0.5 text-xs text-muted">Đạt điểm chuẩn để mở khóa chặng tiếp theo trong lộ trình.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Nhiệm vụ Cô giao */}
      {studentAssignments.length > 0 && (
        <section className="glass-panel p-5 space-y-3" data-testid="assignments-banner">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Nhiệm vụ Cô Mai giao</h2>
            <span className="text-xs text-muted">{studentAssignments.length} nhiệm vụ</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {studentAssignments.map((a) => {
              const sub = submissions.find((s) => s.assignment_id === a.id && s.user_id === uid)
              const done = sub?.status === 'submitted' || sub?.status === 'graded'
              const launchTo =
                a.target_type === 'mock_exam'
                  ? `/exams?assignment=${a.id}`
                  : a.target_type === 'vocab_pack'
                    ? `/flashcards?assignment=${a.id}`
                    : a.target_type === 'lesson' && a.config.lessonId
                      ? `/lessons/${a.config.lessonId}`
                      : `/quiz?assignment=${a.id}`
              return (
                <div key={a.id} className="glass-subtle p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="soft-chip">
                        HSK {a.config.hskLevel}
                        {a.config.itemCount ? ` · ${a.config.itemCount} ${a.target_type === 'vocab_pack' ? 'từ' : 'câu'}` : ''}
                      </span>
                      <span className={`soft-chip ${done ? '!bg-moss-soft !text-moss' : '!bg-ochre-soft !text-ochre'}`}>
                        {done ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {done ? `Đã xong (${sub?.score}/${sub?.max_score})` : `Hạn ${new Date(a.due_at).toLocaleDateString('vi-VN')}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-ink">{a.title}</h3>
                    <p className="text-xs text-muted">{a.description}</p>
                  </div>
                  <Link to={launchTo} className="glass-pill-btn glass-primary-btn !min-h-9 !px-4 text-xs self-start">
                    {done ? 'Xem lại / Ôn thêm' : 'Làm ngay'} <ArrowRight size={13} />
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Huy hiệu thành tích + Tiến độ hôm nay + Bài học Cô soạn */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="glass-panel p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--glass-line)" strokeWidth="7" />
                <circle
                  cx="42"
                  cy="42"
                  r={radius}
                  fill="none"
                  stroke="var(--jade)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-sm font-bold text-ink">{goalPct}%</div>
                <div className="text-[10px] text-muted">{studiedMin}/{goalMin}p</div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="text-sm font-bold text-ink">Tiến độ hôm nay</div>
              <div className="text-muted">Đã thành thạo: <strong className="text-moss">{masteredCount} từ</strong></div>
              <Link to="/vocab?tab=mistakes" className="inline-flex items-center gap-1 font-semibold text-terracotta hover:underline">
                <AlertCircle size={13} /> {mistakeCount} từ hay sai cần ôn
              </Link>
            </div>
          </div>

          <div className="border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-ink flex items-center gap-1">
                <Award size={14} className="text-jade" /> Huy hiệu ({unlockedCount}/{achievements.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {achievements.map((a) => (
                <span
                  key={a.id}
                  title={`${a.title}: ${a.desc}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    a.unlocked
                      ? 'border-jade/30 bg-jade-soft text-jade'
                      : 'border-line bg-glass-subtle text-muted opacity-55'
                  }`}
                >
                  <span>{a.emoji}</span>
                  <span>{a.title}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="glass-panel p-5 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <BookOpen size={16} className="text-jade" /> Bài học chặng HSK {activeLevel}
            </h2>
            <Link to="/lab?tab=courses" className="text-xs font-semibold text-jade hover:underline">
              Mở Phòng luyện →
            </Link>
          </div>
          {stageLessons.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {stageLessons.slice(0, 4).map((l) => (
                <Link key={l.id} to={`/lessons/${l.id}`} className="glass-subtle p-3.5 hover:border-jade transition">
                  <div className="hanzi font-bold text-sm text-ink">{l.title_zh}</div>
                  <div className="text-xs text-muted truncate mt-0.5">{l.title_vi}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass-subtle p-4 text-xs text-muted">
              Chặng HSK {activeLevel} hiện học trực tiếp từ kho từ vựng chuẩn, luyện thanh điệu &amp; trắc nghiệm. Bạn có thể chọn bất kỳ chế độ luyện tập nào ở trên để tích lũy XP.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
