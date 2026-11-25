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
  Mic,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TeacherKudosBanner from '../components/gamification/TeacherKudosBanner'
import { ShareProgressCard } from '../components/social/ShareProgressCard'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { loadGrammarLevel } from '../lib/dataLoader'
import { computeAchievements, getRankForXp } from '../lib/gamification'
import { buildTodayQueue, DEFAULT_DAILY_NEW_LIMIT } from '../lib/todayQueue'
import type { GrammarPoint } from '../types/grammar'
import type { DictEntry } from '../types/vocab'

export default function DashboardPage() {
  const { profile } = useAuth()
  const {
    settings,
    profiles,
    customLessons,
    progressMap,
    sessions,
    assignments,
    submissions,
    examAttempts,
    loadLevelVocab,
  } = useLms()

  const liveProfile = profiles.find((p) => p.id === profile?.id) ?? profile
  const uid = liveProfile?.id ?? ''
  const activeLevel = Math.max(1, liveProfile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, liveProfile?.target_hsk_level || activeLevel)
  const goalMin = liveProfile?.daily_goal_minutes ?? 20
  const dailyNewLimit = settings.dailyNewLimit ?? DEFAULT_DAILY_NEW_LIMIT
  const standard = settings.hskStandard ?? '3.0'

  const [levelPool, setLevelPool] = useState<DictEntry[]>([])
  const [grammarPool, setGrammarPool] = useState<GrammarPoint[]>([])
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    let alive = true
    const gLevel = Math.min(3, Math.max(1, activeLevel))
    Promise.all([loadLevelVocab(activeLevel), loadGrammarLevel(gLevel)])
      .then(([words, grams]) => {
        if (!alive) return
        setLevelPool(words)
        setGrammarPool(grams)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [activeLevel, loadLevelVocab])

  const todayPlan = useMemo(
    () =>
      buildTodayQueue({
        pool: levelPool,
        progressMap,
        dailyNewLimit,
        grammarPool,
      }),
    [levelPool, progressMap, dailyNewLimit, grammarPool],
  )

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
    <div className="space-y-5">
      {uid && <TeacherKudosBanner studentId={uid} />}

      {/* Khối chính "Học hôm nay" — chạm 1 lần vào ngay thẻ đầu tiên */}
      <section className="glass-panel p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-jade">
              Hoa Ngữ Cô Mai · Chặng HSK {activeLevel >= 7 ? '7–9' : activeLevel} (Chuẩn {standard})
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Hôm nay học gì{liveProfile?.full_name ? `, ${liveProfile.full_name}` : ''}?
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-muted mr-1">
              <Compass size={14} className="text-jade" />
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

        {/* 3 chỉ số gói học hôm nay + nút lớn Bắt đầu */}
        <div className="rounded-2xl border border-jade/30 bg-jade/8 p-4 space-y-3.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-glass p-2.5">
              <div className="text-lg sm:text-2xl font-extrabold text-terracotta tabular-nums">
                {todayPlan.dueWords.length}
              </div>
              <div className="text-[11px] font-medium text-muted">Thẻ cần ôn</div>
            </div>
            <div className="rounded-xl bg-glass p-2.5">
              <div className="text-lg sm:text-2xl font-extrabold text-jade tabular-nums">
                {todayPlan.newWords.length}
              </div>
              <div className="text-[11px] font-medium text-muted">Từ mới hôm nay</div>
            </div>
            <div className="rounded-xl bg-glass p-2.5">
              <div className="text-lg sm:text-2xl font-extrabold text-ochre tabular-nums">
                {todayPlan.dailyGrammar ? 1 : 0}
              </div>
              <div className="text-[11px] font-medium text-muted">Điểm ngữ pháp</div>
            </div>
          </div>

          {todayPlan.dailyGrammar && (
            <div className="rounded-xl bg-glass px-3 py-2 text-xs text-ink flex items-center justify-between gap-2">
              <span className="truncate">
                <strong>Ngữ pháp hôm nay:</strong> {todayPlan.dailyGrammar.title}
              </span>
              {!todayPlan.dailyGrammar.reviewed && (
                <span className="shrink-0 text-[10px] font-semibold text-ochre">Chờ cô duyệt</span>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              to="/today"
              data-testid="start-today-cta"
              className="glass-pill-btn glass-primary-btn w-full sm:flex-1 !rounded-2xl min-h-12 px-4 text-sm sm:text-base font-bold justify-center shadow-sm"
            >
              <Play size={18} /> Bắt đầu học hôm nay ({todayPlan.dueWords.length + todayPlan.newWords.length} thẻ)
            </Link>
            <button
              type="button"
              onClick={() => setShowShare((v) => !v)}
              className="glass-pill-btn w-full sm:w-auto !rounded-2xl min-h-11 px-4 text-xs"
              aria-label="Chia sẻ tiến độ hôm nay"
            >
              <Share2 size={16} /> Chia sẻ
            </button>
          </div>
        </div>

        {showShare && (
          <div className="glass-subtle rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted">Tạo ảnh thành tích 1080×1350 để lưu hoặc chia sẻ với bạn bè, Cô Mai.</div>
            <ShareProgressCard
              studentName={liveProfile?.full_name ?? 'Học viên'}
              streakDays={streakDays}
              xpPoints={xpPoints}
              learnedCount={allProgress.length}
              todayDone={allProgress.length}
              currentLevel={activeLevel}
              targetLevel={targetLevel}
              petType={liveProfile?.pet_type ?? settings.petType}
            />
          </div>
        )}

        {/* Thanh Chuỗi ngày học + Điểm tích lũy XP */}
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

        {/* 4 Lối tắt nhanh (di động chạm mượt 1 tay) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Link to="/practice?tab=grammar" className="glass-subtle rounded-2xl p-3.5 hover:border-jade transition space-y-1">
            <div className="flex items-center gap-1.5 text-jade font-bold text-xs">
              <BookOpen size={15} /> Ngữ pháp HSK 1–3
            </div>
            <p className="text-[11px] text-muted">Công thức, so sánh Việt–Trung &amp; tự chấm</p>
          </Link>

          <Link to="/practice?tab=speed" className="glass-subtle rounded-2xl p-3.5 hover:border-jade transition space-y-1">
            <div className="flex items-center gap-1.5 text-ochre font-bold text-xs">
              <Flame size={15} /> Thử thách 60s
            </div>
            <p className="text-[11px] text-muted">Luyện phản xạ nhanh nhận nghĩa từ vựng</p>
          </Link>

          <Link to="/practice?tab=speech" className="glass-subtle rounded-2xl p-3.5 hover:border-jade transition space-y-1">
            <div className="flex items-center gap-1.5 text-jade font-bold text-xs">
              <Mic size={15} /> Luyện phát âm
            </div>
            <p className="text-[11px] text-muted">Đọc theo giọng chuẩn tiếng Trung (zh-CN)</p>
          </Link>

          <Link to="/exams" className="glass-subtle rounded-2xl p-3.5 hover:border-jade transition space-y-1">
            <div className="flex items-center gap-1.5 text-jade font-bold text-xs">
              <FileSpreadsheet size={15} /> Thi thử HSK {standard}
            </div>
            <p className="text-[11px] text-muted">Đề chuẩn + Coaching 3 lớp khi làm sai</p>
          </Link>
        </div>
      </section>

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
                    ? `/practice?tab=flashcards&assignment=${a.id}`
                    : a.target_type === 'lesson' && a.config.lessonId
                      ? `/lessons/${a.config.lessonId}`
                      : `/practice?tab=quiz&assignment=${a.id}`
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
                  <Link to={launchTo} className="glass-pill-btn glass-primary-btn !min-h-10 !px-4 text-xs self-start">
                    {done ? 'Xem lại / Ôn thêm' : 'Làm ngay'} <ArrowRight size={13} />
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
                <AlertCircle size={13} /> {mistakeCount} từ khó cần ôn
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
              <BookOpen size={16} className="text-jade" /> Bài học chặng HSK {activeLevel} &amp; Mở rộng
            </h2>
            <Link to="/vocab?topic=slang" className="text-xs font-semibold text-ochre hover:underline">
              Khám phá Từ lóng mạng →
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
              Chặng HSK {activeLevel} sử dụng kho từ chuẩn HSK 3.0 (bản chốt 11/2025) kèm bài tập ngữ pháp và ví dụ Tatoeba. Nhấn “Bắt đầu học hôm nay” để vào thẻ đầu tiên ngay.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
