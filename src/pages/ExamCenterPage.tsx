import {
  AlertCircle,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  FileSpreadsheet,
  Flag,
  Grid,
  Lightbulb,
  Play,
  PlusCircle,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import GlassDialog from '../components/common/GlassDialog'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { loadExamPapers, loadExamTrends } from '../lib/dataLoader'
import { buildMockExamQuestions, EXAM_BLUEPRINTS, getBlueprint, gradeExamAttempt, type GradeResult } from '../lib/examEngine'
import { speak, stopSpeaking } from '../lib/tts'
import type { ActiveMockExam, CuratedExamPaper, ExamQuestion, ExamSectionKey, ExamTrendProfile } from '../types/exam'
import type { DictEntry, HskStandard } from '../types/vocab'

function QuestionCoachingBox({
  q,
  settings,
  approvedSet,
  onAddSrsWord,
  onAddSrsGrammar,
}: {
  q: ExamQuestion
  settings: ReturnType<typeof useLms>['settings']
  approvedSet: Set<string>
  onAddSrsWord: (wordId: string) => void
  onAddSrsGrammar: (gramId: string) => void
}) {
  const [miniChoice, setMiniChoice] = useState<number | null>(null)
  const coaching = q.coaching
  if (!coaching) return null

  const trap = settings.contentOverrides?.[q.id]?.trap ?? coaching.trap
  const tip = settings.contentOverrides?.[q.id]?.tip ?? coaching.tip
  const isWaiting = q.reviewed === false && !approvedSet.has(q.id)

  return (
    <div className="mt-2 rounded-2xl border border-ochre/30 bg-ochre/5 p-3.5 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-ochre flex items-center gap-1.5">
          <Lightbulb size={14} /> Giải thích 3 lớp &amp; Mẹo sửa bẫy
        </span>
        {isWaiting && <span className="soft-chip !bg-ochre-soft !text-ochre text-[10px]">Đang chờ cô duyệt</span>}
      </div>

      <div className="space-y-1 text-ink">
        <div>
          <strong className="text-crimson">1. Bẫy hay gặp:</strong> {trap}
        </div>
        <div>
          <strong className="text-jade">2. Mẹo sát đề:</strong> {tip}
        </div>
      </div>

      {coaching.miniExample && (
        <div className="rounded-xl bg-glass p-3 space-y-2 border border-line">
          <div className="font-semibold text-ink">3. Ví dụ tương tự (Làm thử ngay): {coaching.miniExample.prompt}</div>
          <div className="flex flex-wrap gap-1.5">
            {coaching.miniExample.options.map((opt, idx) => {
              const picked = miniChoice === idx
              const right = idx === coaching.miniExample.correctIndex
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMiniChoice(idx)}
                  className={`glass-pill-btn !min-h-9 !px-3 text-xs ${
                    miniChoice !== null && picked
                      ? right
                        ? '!border-jade !bg-jade-soft text-jade'
                        : '!border-crimson !bg-crimson/10 text-crimson'
                      : miniChoice !== null && right
                        ? '!border-jade/60 text-jade'
                        : ''
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {miniChoice !== null && <div className="text-muted">{coaching.miniExample.explanation}</div>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {coaching.relatedWordIds?.map((wid) => (
          <button
            key={wid}
            type="button"
            onClick={() => onAddSrsWord(wid)}
            className="glass-pill-btn !min-h-8 !px-3 text-[11px] !border-jade/40 text-jade"
          >
            <PlusCircle size={12} /> Thêm từ liên quan vào ôn hôm nay
          </button>
        ))}
        {coaching.relatedGrammarId && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onAddSrsGrammar(coaching.relatedGrammarId!)}
              className="glass-pill-btn !min-h-8 !px-3 text-[11px] !border-ochre/40 text-ochre"
            >
              <PlusCircle size={12} /> Ôn điểm ngữ pháp ({coaching.relatedGrammarId})
            </button>
            <Link
              to={`/practice?tab=grammar&grammarId=${coaching.relatedGrammarId}`}
              className="glass-pill-btn !min-h-8 !px-3 text-[11px]"
            >
              <BookOpen size={12} /> Xem bài ngữ pháp
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExamCenterPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const {
    settings,
    updateSettings,
    customLessons,
    assignments,
    loadLevelVocab,
    submitExamAttempt,
    rateWord,
    recordQuizOutcome,
    recordStudySession,
    promoteStudentLevel,
    examAttempts,
  } = useLms()

  const activeAssignment = params.get('assignment')
    ? assignments.find((a) => a.id === params.get('assignment'))
    : undefined
  const activeLevel = activeAssignment?.config.hskLevel ?? Math.max(1, profile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, profile?.target_hsk_level || activeLevel)
  const standard: HskStandard = settings.hskStandard ?? '3.0'
  const approvedSet = useMemo(() => new Set(settings.approvedContentIds ?? []), [settings.approvedContentIds])

  const [sectionOnly, setSectionOnly] = useState<'full' | ExamSectionKey>(
    () => (activeAssignment?.config.examMode === 'section' ? 'listening' : 'full'),
  )
  const [levelPool, setLevelPool] = useState<DictEntry[]>([])
  const [curatedPapers, setCuratedPapers] = useState<CuratedExamPaper[]>([])
  const [trends, setTrends] = useState<ExamTrendProfile[]>([])
  const [showTrends, setShowTrends] = useState(false)
  const [loading, setLoading] = useState(false)

  const [activeExam, setActiveExam] = useState<ActiveMockExam | null>(null)
  const [secIdx, setSecIdx] = useState(0)
  const [qCursor, setQCursor] = useState(0)
  const [responses, setResponses] = useState<Record<string, string | number>>({})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [audioPlays, setAudioPlays] = useState<Record<string, number>>({})
  const [sectionSecondsLeft, setSectionSecondsLeft] = useState(0)
  const [sectionElapsed, setSectionElapsed] = useState<Record<string, number>>({})
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)
  const [gradeReport, setGradeReport] = useState<{ result: GradeResult; exam: ActiveMockExam } | null>(null)
  const [promoted, setPromoted] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      loadLevelVocab(activeLevel),
      activeLevel >= 3 && activeLevel <= 6 ? loadExamPapers(activeLevel) : Promise.resolve([]),
      loadExamTrends(),
    ])
      .then(([rows, papers, trendRows]) => {
        if (!alive) return
        setLevelPool(rows)
        setCuratedPapers(papers)
        setTrends(trendRows)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [activeLevel, loadLevelVocab])

  const bp = getBlueprint(activeLevel, standard)
  const currentTrend = trends.find((t) => t.level === Math.min(6, activeLevel))

  const startCuratedPaper = (paper: CuratedExamPaper) => {
    const firstSec = paper.questions[0]?.section ?? 'listening'
    const firstSecBp = bp.sections.find((s) => s.key === firstSec) ?? bp.sections[0]
    const exam: ActiveMockExam = {
      id: `${paper.id}-${Date.now()}`,
      level: activeLevel,
      standard,
      mode: 'full',
      blueprint: bp,
      questions: paper.questions,
      createdAt: Date.now(),
      paperTitle: paper.title,
      reviewed: paper.reviewed,
    }
    setActiveExam(exam)
    setSecIdx(0)
    setQCursor(0)
    setResponses({})
    setFlagged({})
    setAudioPlays({})
    setSectionElapsed({})
    setGradeReport(null)
    setPromoted(false)
    setSectionSecondsLeft(firstSecBp.officialMinutes * 60)
    toast.success(`Đã mở ${paper.title}`)
  }

  const startDynamicExam = () => {
    const mode = sectionOnly === 'full' ? 'full' : 'section'
    const questions = buildMockExamQuestions(
      activeLevel,
      levelPool,
      customLessons,
      true,
      sectionOnly === 'full' ? undefined : sectionOnly,
      standard,
    )
    if (!questions.length) {
      toast.error('Dữ liệu từ vựng cốt lõi đang được nạp.')
      return
    }
    const exam: ActiveMockExam = {
      id: `mock-${Date.now()}`,
      level: activeLevel,
      standard,
      mode,
      blueprint: bp,
      questions,
      createdAt: Date.now(),
    }
    const firstSec = questions[0].section
    const firstSecBp = bp.sections.find((s) => s.key === firstSec) ?? bp.sections[0]
    setActiveExam(exam)
    setSecIdx(0)
    setQCursor(0)
    setResponses({})
    setFlagged({})
    setAudioPlays({})
    setSectionElapsed({})
    setGradeReport(null)
    setPromoted(false)
    setSectionSecondsLeft(firstSecBp.officialMinutes * 60)
    toast.success(`Đã bắt đầu ${bp.title}`)
  }

  const activeSections = useMemo(() => {
    if (!activeExam) return []
    const keys = Array.from(new Set(activeExam.questions.map((q) => q.section)))
    return activeExam.blueprint.sections.filter((s) => keys.includes(s.key))
  }, [activeExam])

  const currentSection = activeSections[secIdx]
  const sectionQuestions = useMemo(() => {
    if (!activeExam || !currentSection) return []
    return activeExam.questions.filter((q) => q.section === currentSection.key)
  }, [activeExam, currentSection])
  const currentQuestion = sectionQuestions[qCursor]

  useEffect(() => {
    if (!activeExam || !currentSection) return
    const timer = window.setInterval(() => {
      setSectionSecondsLeft((s) => {
        if (s <= 1) {
          handleNextSection(true)
          return 0
        }
        return s - 1
      })
      setSectionElapsed((prev) => ({
        ...prev,
        [currentSection.key]: (prev[currentSection.key] ?? 0) + 1,
      }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeExam, secIdx, currentSection?.key])

  const finalizeExam = (exam: ActiveMockExam, ansMap: Record<string, string | number>, timings: Record<string, number>) => {
    stopSpeaking()
    const result = gradeExamAttempt(exam.level, exam.questions, ansMap, exam.standard)
    for (const wid of result.wrongWordIds) recordQuizOutcome(wid, exam.level, false)
    for (const gid of result.wrongGrammarIds) rateWord(`gram:${gid}`, Math.min(3, exam.level), 'again')

    const totalSec = Object.values(timings).reduce((a, b) => a + b, 0)
    const writingResponses = exam.questions
      .filter((q) => q.kind === 'writing_prompt' || q.kind === 'translation_prompt')
      .map((q) => `${q.partLabel}: ${String(ansMap[q.id] ?? '')}`)
      .join('\n---\n')

    void submitExamAttempt(
      {
        hsk_level: exam.level,
        mode: exam.mode,
        listening_score: result.listeningScore,
        reading_score: result.readingScore,
        writing_score: result.writingScore,
        total_score: result.totalScore,
        passed: result.passed,
        section_timings: timings,
        responses: ansMap,
        writing_text: writingResponses || undefined,
        writing_prompt: exam.questions.find((q) => q.kind === 'writing_prompt')?.prompt,
      },
      activeAssignment?.id,
    )

    recordStudySession('mock_exam', exam.level, Math.max(30, totalSec), exam.questions.length, result.accuracyPct)
    setActiveExam(null)
    setConfirmSubmitOpen(false)
    setGradeReport({ result, exam })
    toast.success(`Đã chấm xong bài thi: ${result.accuracyPct}% chính xác`)
  }

  const handleNextSection = (autoExpired = false) => {
    if (!activeExam) return
    stopSpeaking()
    if (secIdx + 1 < activeSections.length) {
      const nextSec = activeSections[secIdx + 1]
      setSecIdx((s) => s + 1)
      setQCursor(0)
      setSectionSecondsLeft(nextSec.officialMinutes * 60)
      toast.info(autoExpired ? `Hết giờ! Chuyển sang phần ${nextSec.label}` : `Chuyển sang phần ${nextSec.label}`)
    } else {
      finalizeExam(activeExam, responses, sectionElapsed)
    }
  }

  const playStrictAudio = (qId: string, text: string, maxPlays: number, audioUrl?: string) => {
    const used = audioPlays[qId] ?? 0
    if (used >= maxPlays) {
      toast.error(`Quy định chuẩn HSK: chỉ được nghe tối đa ${maxPlays} lần cho câu này.`)
      return
    }
    setAudioPlays((prev) => ({ ...prev, [qId]: used + 1 }))
    speak(text, { rate: 0.95, audioUrl })
  }

  if (gradeReport) {
    const { result, exam } = gradeReport
    const canAdvanceLevel = exam.mode === 'full' && (result.hasOfficialPassScore ? result.passed : result.accuracyPct >= 70) && exam.level < targetLevel

    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="exam-certificate">
        <div className="glass-panel p-5 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade">
            <Award size={28} />
          </div>
          <div>
            {result.hasOfficialPassScore ? (
              <span className={`soft-chip ${result.passed ? '!bg-moss-soft !text-moss' : '!bg-terracotta-soft !text-terracotta'}`}>
                {result.passed ? 'ĐẠT CHUẨN HSK 2.0' : 'CHƯA ĐẠT MỨC CHUẨN'}
              </span>
            ) : (
              <span className="soft-chip !bg-jade-soft !text-jade">
                HSK 3.0 · ĐÚNG {result.accuracyPct}% (ĐIỂM ƯỚC LƯỢNG THAM KHẢO)
              </span>
            )}
            <h1 className="mt-2 text-xl sm:text-2xl font-bold text-ink">
              {exam.paperTitle ?? exam.blueprint.title} · Phiếu kết quả
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              {result.hsk79Band
                ? `Mức đánh giá: ${result.hsk79Band}`
                : result.hasOfficialPassScore
                  ? `Mức điểm đạt: ${exam.blueprint.passScore} / ${result.maxPossible}`
                  : 'HSK 3.0 cấp 1–6 chưa áp ngưỡng đỗ chính thức trên hệ thống — dùng tỉ lệ % đúng và điểm ước lượng để theo dõi tiến bộ.'}
            </p>
          </div>

          <div className="flex items-baseline justify-center gap-4">
            <div className="text-4xl font-extrabold text-jade">{result.accuracyPct}%</div>
            <div className="text-sm font-semibold text-muted">
              (Ước lượng {result.totalScore} / {result.maxPossible} điểm)
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="glass-subtle p-3">
              <div className="text-xs text-muted">Nghe hiểu</div>
              <div className="text-lg font-bold text-ink">{result.listeningScore}/100</div>
            </div>
            <div className="glass-subtle p-3">
              <div className="text-xs text-muted">Đọc hiểu</div>
              <div className="text-lg font-bold text-ink">{result.readingScore}/100</div>
            </div>
            <div className="glass-subtle p-3">
              <div className="text-xs text-muted">Viết / Nâng cao</div>
              <div className="text-lg font-bold text-ink">{result.writingScore}/100</div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {canAdvanceLevel && !promoted && (
              <button
                type="button"
                onClick={() => {
                  void promoteStudentLevel(exam.level + 1)
                    .then(() => {
                      setPromoted(true)
                      toast.success(`Chúc mừng! Đã mở khóa chặng HSK ${exam.level + 1}!`)
                    })
                    .catch(() => toast.error('Không thể cập nhật chặng học'))
                }}
                className="glass-pill-btn glass-primary-btn min-h-11 px-4"
              >
                <ArrowUpRight size={16} /> Mở khóa chặng HSK {exam.level + 1}
              </button>
            )}
            <button type="button" onClick={() => setGradeReport(null)} className="glass-pill-btn min-h-11 px-4">
              Quay về Phòng thi thử
            </button>
          </div>
        </div>

        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-sm font-bold text-ink">Chữa bài chi tiết &amp; Coaching 3 lớp (Bẫy · Mẹo · Ví dụ)</h2>
          {exam.questions.map((q, i) => {
            const resp = responses[q.id]
            const isObj = q.correctIndex !== undefined
            const ok = isObj ? resp === q.correctIndex : String(resp ?? '').trim().length > 0
            return (
              <div key={q.id} className="glass-subtle p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    Câu {i + 1} · {q.partLabel}
                  </span>
                  <span className={`soft-chip ${ok ? '!bg-moss-soft !text-moss' : '!bg-terracotta-soft !text-terracotta'}`}>
                    {ok ? 'Đúng / Đã nộp' : 'Cần ôn lại'}
                  </span>
                </div>
                <div className="hanzi text-sm font-medium text-ink">{q.prompt}</div>
                {isObj && q.options && (
                  <div className="text-muted">
                    Đáp án đúng: <span className="hanzi font-semibold text-ink">{q.options[q.correctIndex!]}</span>
                  </div>
                )}
                <div className="text-muted">{q.explanation}</div>
                {!ok && (
                  <QuestionCoachingBox
                    q={q}
                    settings={settings}
                    approvedSet={approvedSet}
                    onAddSrsWord={(wid) => {
                      rateWord(wid, exam.level, 'again')
                      toast.success('Đã đưa từ này vào danh sách ôn hôm nay')
                    }}
                    onAddSrsGrammar={(gid) => {
                      rateWord(`gram:${gid}`, Math.min(3, exam.level), 'again')
                      toast.success('Đã đưa điểm ngữ pháp này vào hàng đợi ôn hôm nay')
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (activeExam && currentSection && currentQuestion) {
    const mins = Math.floor(sectionSecondsLeft / 60)
    const secs = sectionSecondsLeft % 60
    const maxAudio = currentSection.maxAudioPlays ?? 1
    const usedAudio = audioPlays[currentQuestion.id] ?? 0
    const isLastInSection = qCursor + 1 >= sectionQuestions.length

    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="active-mock-exam">
        <div className="glass-panel p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="soft-chip">HSK {activeExam.level >= 7 ? '7–9' : activeExam.level} ({activeExam.standard})</span>
            <span className="text-sm font-bold text-ink">{currentSection.label}</span>
            <span className="text-xs text-muted">
              ({qCursor + 1}/{sectionQuestions.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`soft-chip ${sectionSecondsLeft < 120 ? '!bg-terracotta-soft !text-terracotta' : '!bg-periwinkle-soft !text-periwinkle'}`}>
              <Clock size={13} /> {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => setPaletteOpen(true)} className="glass-pill-btn !min-h-9 !px-3 text-xs">
              <Grid size={13} /> Bảng câu
            </button>
            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="glass-pill-btn glass-primary-btn !min-h-9 !px-3 text-xs"
            >
              <Send size={13} /> Nộp bài
            </button>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="soft-chip">{currentQuestion.partLabel}</span>
            <button
              type="button"
              onClick={() => setFlagged((f) => ({ ...f, [currentQuestion.id]: !f[currentQuestion.id] }))}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${
                flagged[currentQuestion.id] ? '!border-ochre !bg-ochre-soft !text-ochre' : ''
              }`}
            >
              <Flag size={13} /> {flagged[currentQuestion.id] ? 'Đã đánh dấu' : 'Xem lại sau'}
            </button>
          </div>

          {currentQuestion.kind === 'mcq_audio' && currentQuestion.audioText && (
            <div className="glass-subtle p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-ink">Trình phát âm thanh thi chuẩn</div>
                <div className="text-[11px] text-muted">
                  Lượt nghe còn lại: {Math.max(0, maxAudio - usedAudio)} / {maxAudio}
                </div>
              </div>
              <button
                type="button"
                disabled={usedAudio >= maxAudio}
                onClick={() => playStrictAudio(currentQuestion.id, currentQuestion.audioText!, maxAudio, currentQuestion.audioUrl)}
                className="glass-pill-btn glass-primary-btn !min-h-11 !px-4 text-xs"
              >
                <Volume2 size={15} /> {usedAudio >= maxAudio ? 'Đã hết lượt' : `Nghe (${usedAudio}/${maxAudio})`}
              </button>
            </div>
          )}

          <div className="space-y-1">
            {currentQuestion.kind !== 'mcq_audio' && (
              <div className="hanzi text-lg sm:text-xl font-bold leading-relaxed text-ink">{currentQuestion.prompt}</div>
            )}
            {currentQuestion.subPrompt && <p className="text-xs text-muted">{currentQuestion.subPrompt}</p>}
          </div>

          {currentQuestion.options ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {currentQuestion.options.map((opt, oi) => {
                const chosen = responses[currentQuestion.id] === oi
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setResponses((r) => ({ ...r, [currentQuestion.id]: oi }))}
                    className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-left transition cursor-pointer min-h-12 ${
                      chosen ? 'border-jade bg-jade-soft font-semibold' : 'border-line bg-glass-subtle hover:border-jade'
                    }`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-glass text-xs font-bold border border-line text-ink">
                      {['A', 'B', 'C', 'D'][oi]}
                    </span>
                    <span className="hanzi text-sm text-ink">{opt}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <textarea
              rows={7}
              value={String(responses[currentQuestion.id] ?? '')}
              onChange={(e) => setResponses((r) => ({ ...r, [currentQuestion.id]: e.target.value }))}
              placeholder="Nhập bài viết tiếng Trung của bạn tại đây..."
              className="glass-subtle w-full p-4 hanzi text-sm text-ink outline-none focus:border-jade"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
            <button
              type="button"
              disabled={qCursor === 0}
              onClick={() => setQCursor((q) => Math.max(0, q - 1))}
              className="glass-pill-btn min-h-11 px-4 text-xs"
            >
              Câu trước
            </button>

            {isLastInSection ? (
              <button
                type="button"
                onClick={() => handleNextSection(false)}
                className="glass-pill-btn glass-primary-btn min-h-11 px-4 text-xs"
              >
                {secIdx + 1 < activeSections.length ? 'Xong phần này · Qua phần tiếp' : 'Nộp bài thi'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setQCursor((q) => Math.min(sectionQuestions.length - 1, q + 1))}
                className="glass-pill-btn glass-primary-btn min-h-11 px-4 text-xs"
              >
                Câu tiếp theo
              </button>
            )}
          </div>
        </div>

        <GlassDialog
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          title={`Bảng câu hỏi — ${currentSection.label}`}
          subtitle="Chạm vào số câu để chuyển nhanh."
        >
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
            {sectionQuestions.map((sq, idx) => {
              const ans = responses[sq.id] !== undefined && String(responses[sq.id]).trim() !== ''
              const fl = Boolean(flagged[sq.id])
              return (
                <button
                  key={sq.id}
                  type="button"
                  onClick={() => {
                    setQCursor(idx)
                    setPaletteOpen(false)
                  }}
                  className={`glass-pill-btn !min-h-10 text-xs ${
                    idx === qCursor
                      ? '!border-jade ring-2 ring-jade/30'
                      : fl
                        ? '!bg-ochre-soft !text-ochre'
                        : ans
                          ? '!bg-moss-soft !text-moss'
                          : ''
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </GlassDialog>

        <GlassDialog
          open={confirmSubmitOpen}
          onClose={() => setConfirmSubmitOpen(false)}
          title="Xác nhận nộp bài thi?"
          subtitle="Phần trắc nghiệm được chấm ngay và mở coaching 3 lớp; phần Viết lưu để Cô Mai xem."
        >
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Bạn đã trả lời {Object.keys(responses).length} / {activeExam.questions.length} câu hỏi.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSubmitOpen(false)} className="glass-pill-btn min-h-11">
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={() => finalizeExam(activeExam, responses, sectionElapsed)}
                className="glass-pill-btn glass-primary-btn min-h-11"
              >
                Xác nhận nộp bài
              </button>
            </div>
          </div>
        </GlassDialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="text-jade" size={22} />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-ink">
                Phòng Thi Thử HSK {activeLevel >= 7 ? '7–9' : activeLevel}
              </h1>
              <p className="text-xs text-muted">
                Lộ trình HSK {activeLevel} → HSK {targetLevel} · Chỉ lấy từ vựng chuẩn đề cương
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['3.0', '2.0'] as HskStandard[]).map((std) => (
              <button
                key={std}
                type="button"
                onClick={() => updateSettings({ hskStandard: std })}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${standard === std ? 'glass-primary-btn' : ''}`}
              >
                Chuẩn {std}
              </button>
            ))}
            {currentTrend && (
              <button
                type="button"
                onClick={() => setShowTrends((v) => !v)}
                className={`glass-pill-btn !min-h-9 !px-3 text-xs ${showTrends ? '!border-ochre !bg-ochre-soft text-ochre' : ''}`}
              >
                <Compass size={14} /> Xu hướng ra đề
              </button>
            )}
          </div>
        </div>

        {/* 1 màn hình Xu hướng ra đề */}
        {showTrends && currentTrend && (
          <div className="glass-subtle rounded-2xl p-4 space-y-3 border border-ochre/30 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-ink text-sm">{currentTrend.title}</div>
              {!currentTrend.reviewed && !approvedSet.has(`trend-${currentTrend.level}`) && (
                <span className="soft-chip !bg-ochre-soft !text-ochre text-[10px]">Đang chờ cô duyệt</span>
              )}
            </div>
            <p className="text-jade font-semibold">{currentTrend.formatSummary}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="font-bold text-crimson mb-1">Bẫy hay gặp:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-muted">
                  {currentTrend.topTraps.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-bold text-jade mb-1">Chủ điểm trọng tâm:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-muted">
                  {currentTrend.highYieldTopics.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="text-ink">
              <strong>Chiến thuật thời gian:</strong> {currentTrend.timeStrategy}
            </div>
            <a
              href={currentTrend.officialReferenceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-jade hover:underline"
            >
              Xem thông tin đề chính thức CTI (chinesetest.cn) <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Bộ đề biên soạn sẵn (HSK 3-6) */}
        {curatedPapers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Sparkles size={14} className="text-ochre" /> Bộ đề biên soạn theo cấu trúc HSK {activeLevel} (kèm Coaching 3 lớp)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {curatedPapers.map((paper) => {
                const isWaiting = !paper.reviewed && !approvedSet.has(paper.id)
                return (
                  <div key={paper.id} className="glass-subtle rounded-2xl p-3.5 flex flex-col justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="soft-chip text-[10px]">Đề {paper.paperNumber}</span>
                        {isWaiting && (
                          <span className="soft-chip !bg-ochre-soft !text-ochre text-[10px]">
                            <AlertCircle size={10} /> Chờ cô duyệt
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-ink">{paper.title}</div>
                      <div className="text-[11px] text-muted">{paper.subtitle} · {paper.questions.length} câu</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCuratedPaper(paper)}
                      className="glass-pill-btn glass-primary-btn min-h-10 text-xs w-full"
                    >
                      <Play size={14} /> Làm Đề {paper.paperNumber}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Khối thi sinh tự động theo cấu trúc HSK 3.0 / 2.0 */}
        <div className="glass-subtle p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink">{bp.title}</h2>
              <p className="text-xs text-muted">{bp.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="soft-chip">Nghe {bp.audioReplayRule === '2x' ? '2 lần' : '1 lần'}</span>
              <span className="soft-chip !bg-moss-soft !text-moss">
                {bp.hasOfficialPassScore ? `Đạt: ${bp.passScore}/${bp.totalScore}` : `${bp.officialTotalQuestions} câu · ${bp.officialMinutes} phút`}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {bp.sections.map((s) => (
              <div key={s.key} className="rounded-2xl border border-line bg-glass p-3 text-xs">
                <div className="font-bold text-ink">{s.label}</div>
                <div className="text-muted mt-0.5">{s.questionCount} câu · {s.officialMinutes} phút</div>
                {s.maxAudioPlays && <div className="text-jade mt-0.5">Nghe: {s.maxAudioPlays} lần</div>}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted">{bp.notes}</p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              aria-label="Chế độ thi"
              value={sectionOnly}
              onChange={(e) => setSectionOnly(e.target.value as 'full' | ExamSectionKey)}
              className="glass-subtle px-3 py-2.5 text-xs font-semibold outline-none min-h-11"
            >
              <option value="full">Thi thử đầy đủ (Đề ngẫu nhiên chuẩn)</option>
              {bp.sections.map((s) => (
                <option key={s.key} value={s.key}>
                  Luyện riêng phần: {s.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={loading || !levelPool.length}
              onClick={startDynamicExam}
              className="glass-pill-btn glass-primary-btn min-h-11 px-4"
            >
              <Play size={15} /> {loading ? 'Đang nạp đề thi...' : 'Tạo đề ngẫu nhiên ngay'}
            </button>
          </div>
        </div>
      </div>

      {examAttempts.length > 0 && (
        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-sm font-bold text-ink">Lịch sử thi thử gần đây</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {examAttempts.slice(0, 6).map((ex) => (
              <div key={ex.id} className="glass-subtle p-3.5 text-xs flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-ink">
                    HSK {ex.hsk_level >= 7 ? '7–9' : ex.hsk_level} · {ex.mode === 'full' ? 'Đề đầy đủ' : 'Theo phần'}
                  </div>
                  <div className="text-muted">
                    Nghe {ex.listening_score} · Đọc {ex.reading_score} · Viết {ex.writing_score} · {new Date(ex.created_at).toLocaleDateString('vi-VN')}
                  </div>
                  {ex.admin_feedback && <div className="mt-1 text-jade">Giáo viên: {ex.admin_feedback}</div>}
                </div>
                <span className={`soft-chip ${ex.passed ? '!bg-moss-soft !text-moss' : '!bg-ochre-soft !text-ochre'}`}>
                  <CheckCircle2 size={12} /> {ex.total_score} đ
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { EXAM_BLUEPRINTS }
