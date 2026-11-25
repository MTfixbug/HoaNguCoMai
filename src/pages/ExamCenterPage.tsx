import { ArrowUpRight, Award, CheckCircle2, Clock, FileSpreadsheet, Flag, Grid, Lock, Play, Send, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import GlassDialog from '../components/common/GlassDialog'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { buildMockExamQuestions, EXAM_BLUEPRINTS, getBlueprint, gradeExamAttempt, type GradeResult } from '../lib/examEngine'
import { speak, stopSpeaking } from '../lib/tts'
import type { ActiveMockExam, ExamSectionKey } from '../types/exam'
import type { DictEntry } from '../types/vocab'

export default function ExamCenterPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const assignmentId = params.get('assignment') ?? undefined
  const { customLessons, assignments, loadLevelVocab, submitExamAttempt, recordQuizOutcome, recordStudySession, promoteStudentLevel, examAttempts } = useLms()

  const activeAssignment = assignmentId ? assignments.find((a) => a.id === assignmentId) : undefined
  const activeLevel = activeAssignment?.config.hskLevel ?? Math.max(1, profile?.current_hsk_level || 1)
  const targetLevel = Math.max(activeLevel, profile?.target_hsk_level || activeLevel)

  const [sectionOnly, setSectionOnly] = useState<'full' | ExamSectionKey>(
    () => (activeAssignment?.config.examMode === 'section' ? 'listening' : 'full'),
  )
  const [levelPool, setLevelPool] = useState<DictEntry[]>([])
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
    loadLevelVocab(activeLevel)
      .then((rows) => {
        if (alive) {
          setLevelPool(rows)
          setLoading(false)
        }
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [activeLevel, loadLevelVocab])

  const bp = getBlueprint(activeLevel)

  const startExam = () => {
    const mode = sectionOnly === 'full' ? 'full' : 'section'
    const questions = buildMockExamQuestions(
      activeLevel,
      levelPool,
      customLessons,
      true,
      sectionOnly === 'full' ? undefined : sectionOnly,
    )
    if (!questions.length) {
      toast.error('Dữ liệu đề thi đang được tải.')
      return
    }
    const exam: ActiveMockExam = {
      id: `mock-${Date.now()}`,
      level: activeLevel,
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
  const sectionQuestions = useMemo(
    () => (activeExam && currentSection ? activeExam.questions.filter((q) => q.section === currentSection.key) : []),
    [activeExam, currentSection],
  )
  const currentQuestion = sectionQuestions[qCursor]

  useEffect(() => {
    if (!activeExam || !currentSection) return
    const timer = window.setInterval(() => {
      setSectionSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timer)
          handleAdvanceSection(true)
          return 0
        }
        return s - 1
      })
      setSectionElapsed((prev) => ({ ...prev, [currentSection.key]: (prev[currentSection.key] ?? 0) + 1 }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeExam?.id, secIdx, currentSection?.key])

  const finalizeExam = (exam: ActiveMockExam, finalResponses: Record<string, string | number>, timings: Record<string, number>) => {
    stopSpeaking()
    const result = gradeExamAttempt(exam.level, exam.questions, finalResponses)
    const writingQ = exam.questions.find((q) => q.kind === 'writing_prompt' || q.kind === 'translation_prompt')
    const writingText = writingQ ? String(finalResponses[writingQ.id] ?? '') : ''

    for (const wid of result.wrongWordIds) {
      recordQuizOutcome(wid, exam.level, false)
    }

    const totalSec = Object.values(timings).reduce((a, b) => a + b, 0) || 60
    recordStudySession('mock_exam', exam.level, totalSec, exam.questions.length, Math.round((result.totalScore / result.maxPossible) * 100))

    submitExamAttempt(
      {
        hsk_level: exam.level,
        mode: exam.mode,
        listening_score: result.listeningScore,
        reading_score: result.readingScore,
        writing_score: result.writingScore,
        total_score: result.totalScore,
        passed: result.passed,
        section_timings: timings,
        responses: finalResponses,
        writing_prompt: writingQ?.prompt,
        writing_text: writingText,
      },
      assignmentId,
    )

    setGradeReport({ result, exam })
    setActiveExam(null)
    setConfirmSubmitOpen(false)
  }

  const handleAdvanceSection = (autoExpired = false) => {
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

  const playStrictAudio = (qId: string, text: string, maxPlays: number) => {
    const used = audioPlays[qId] ?? 0
    if (used >= maxPlays) {
      toast.error(`Quy định chuẩn HSK: chỉ được nghe tối đa ${maxPlays} lần cho câu này.`)
      return
    }
    setAudioPlays((prev) => ({ ...prev, [qId]: used + 1 }))
    speak(text, { rate: 0.95 })
  }

  if (gradeReport) {
    const { result, exam } = gradeReport
    const canAdvanceLevel = exam.mode === 'full' && result.passed && exam.level < targetLevel

    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="exam-certificate">
        <div className="glass-panel p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade">
            <Award size={28} />
          </div>
          <div>
            <span className={`soft-chip ${result.passed ? '!bg-moss-soft !text-moss' : '!bg-terracotta-soft !text-terracotta'}`}>
              {result.passed ? 'ĐẠT CHUẨN' : 'CHƯA ĐẠT MỨC CHUẨN'}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-ink">{exam.blueprint.title} · Phiếu điểm</h1>
            <p className="text-sm text-muted">
              {result.hsk79Band ? `Mức đánh giá: ${result.hsk79Band}` : `Mức điểm đạt: ${exam.blueprint.passScore} / ${result.maxPossible}`}
            </p>
          </div>

          <div className="text-4xl font-extrabold text-jade">
            {result.totalScore} <span className="text-base font-medium text-muted">/ {result.maxPossible}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
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
                      toast.success(`Chúc mừng! Bạn đã mở khóa chặng HSK ${exam.level + 1}!`)
                    })
                    .catch(() => toast.error('Không thể cập nhật chặng học'))
                }}
                className="glass-pill-btn glass-primary-btn"
              >
                <ArrowUpRight size={16} /> Mở khóa chặng HSK {exam.level + 1}
              </button>
            )}
            <button type="button" onClick={() => setGradeReport(null)} className="glass-pill-btn">
              Quay về Phòng thi thử
            </button>
          </div>
        </div>

        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-sm font-bold text-ink">Chi tiết Đáp án &amp; Giải thích</h2>
          {exam.questions.map((q, i) => {
            const resp = responses[q.id]
            const isObj = q.correctIndex !== undefined
            const ok = isObj ? resp === q.correctIndex : String(resp ?? '').trim().length > 0
            return (
              <div key={q.id} className="glass-subtle p-3.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">
                    Câu {i + 1} · {q.partLabel}
                  </span>
                  <span className={`soft-chip ${ok ? '!bg-moss-soft !text-moss' : '!bg-terracotta-soft !text-terracotta'}`}>
                    {ok ? 'Đúng / Đã nộp' : 'Chưa đúng'}
                  </span>
                </div>
                <div className="hanzi text-sm font-medium text-ink">{q.prompt}</div>
                {isObj && q.options && (
                  <div className="text-muted">
                    Đáp án đúng: <span className="hanzi font-semibold text-ink">{q.options[q.correctIndex!]}</span>
                  </div>
                )}
                <div className="text-muted">{q.explanation}</div>
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
            <span className="soft-chip">HSK {activeExam.level >= 7 ? '7–9' : activeExam.level}</span>
            <span className="text-sm font-bold text-ink">{currentSection.label}</span>
            <span className="text-xs text-muted">
              ({qCursor + 1}/{sectionQuestions.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`soft-chip ${sectionSecondsLeft < 120 ? '!bg-terracotta-soft !text-terracotta' : '!bg-periwinkle-soft !text-periwinkle'}`}>
              <Clock size={13} /> {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => setPaletteOpen(true)} className="glass-pill-btn !min-h-8 !px-3 text-xs">
              <Grid size={13} /> Bảng câu hỏi
            </button>
            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs"
            >
              <Send size={13} /> Nộp bài
            </button>
          </div>
        </div>

        <div className="glass-panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="soft-chip">{currentQuestion.partLabel}</span>
            <button
              type="button"
              onClick={() => setFlagged((f) => ({ ...f, [currentQuestion.id]: !f[currentQuestion.id] }))}
              className={`glass-pill-btn !min-h-8 !px-3 text-xs ${
                flagged[currentQuestion.id] ? '!border-ochre !bg-ochre-soft !text-ochre' : ''
              }`}
            >
              <Flag size={13} /> {flagged[currentQuestion.id] ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}
            </button>
          </div>

          {currentQuestion.kind === 'mcq_audio' && currentQuestion.audioText && (
            <div className="glass-subtle p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-ink">Trình phát âm thanh thi chuẩn</div>
                <div className="text-[11px] text-muted">
                  Số lượt nghe còn lại: {Math.max(0, maxAudio - usedAudio)} / {maxAudio}
                </div>
              </div>
              <button
                type="button"
                disabled={usedAudio >= maxAudio}
                onClick={() => playStrictAudio(currentQuestion.id, currentQuestion.audioText!, maxAudio)}
                className="glass-pill-btn glass-primary-btn !min-h-9 !px-4 text-xs"
              >
                <Volume2 size={15} /> {usedAudio >= maxAudio ? 'Đã hết lượt nghe' : `Nghe (${usedAudio}/${maxAudio})`}
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
                    className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
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
            <div className="space-y-2">
              <textarea
                rows={7}
                value={String(responses[currentQuestion.id] ?? '')}
                onChange={(e) => setResponses((r) => ({ ...r, [currentQuestion.id]: e.target.value }))}
                placeholder="Nhập bài viết tiếng Trung của bạn tại đây..."
                className="glass-subtle w-full p-4 hanzi text-sm text-ink outline-none focus:border-jade"
              />
              <div className="text-right text-xs text-muted">
                Số ký tự: {String(responses[currentQuestion.id] ?? '').trim().length}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              disabled={qCursor === 0}
              onClick={() => setQCursor((c) => Math.max(0, c - 1))}
              className="glass-pill-btn !min-h-9 !px-4 text-xs"
            >
              Câu trước
            </button>
            {isLastInSection ? (
              <button
                type="button"
                onClick={() => (secIdx + 1 < activeSections.length ? handleAdvanceSection(false) : setConfirmSubmitOpen(true))}
                className="glass-pill-btn glass-primary-btn !min-h-9 !px-4 text-xs"
              >
                {secIdx + 1 < activeSections.length ? (
                  <>
                    <Lock size={13} /> Khóa &amp; Sang phần tiếp
                  </>
                ) : (
                  'Xem lại & Nộp bài'
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setQCursor((c) => Math.min(sectionQuestions.length - 1, c + 1))}
                className="glass-pill-btn glass-primary-btn !min-h-9 !px-4 text-xs"
              >
                Câu tiếp theo
              </button>
            )}
          </div>
        </div>

        <GlassDialog
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          title={`Bảng câu hỏi · ${currentSection.label}`}
          subtitle="Xanh = Đã chọn · Vàng = Đánh dấu xem lại"
        >
          <div className="grid grid-cols-5 gap-2">
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
          subtitle="Phần trắc nghiệm được chấm điểm ngay; phần Viết được lưu để giáo viên chấm chi tiết."
        >
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Bạn đã trả lời {Object.keys(responses).length} / {activeExam.questions.length} câu hỏi.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSubmitOpen(false)} className="glass-pill-btn">
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={() => finalizeExam(activeExam, responses, sectionElapsed)}
                className="glass-pill-btn glass-primary-btn"
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
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="text-jade" size={22} />
            <div>
              <h1 className="text-xl font-bold text-ink">Thi Thử Chặng HSK {activeLevel >= 7 ? '7–9' : activeLevel}</h1>
              <p className="text-xs text-muted">
                Vượt qua bài thi đầy đủ của chặng này sẽ mở khóa chặng tiếp theo trong lộ trình tới HSK {targetLevel}.
              </p>
            </div>
          </div>
          <span className="soft-chip">Lộ trình: HSK {activeLevel} → HSK {targetLevel}</span>
        </div>

        <div className="glass-subtle p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink">{bp.title}</h2>
              <p className="text-xs text-muted">{bp.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="soft-chip">Nghe {bp.audioReplayRule === '2x' ? '2 lần' : '1 lần'}</span>
              <span className="soft-chip !bg-moss-soft !text-moss">Mức đạt: {bp.passScore}/{bp.totalScore}</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {bp.sections.map((s) => (
              <div key={s.key} className="rounded-2xl border border-line bg-glass p-3 text-xs">
                <div className="font-bold text-ink">{s.label}</div>
                <div className="text-muted mt-0.5">{s.questionCount} câu chuẩn · {s.officialMinutes} phút</div>
                {s.maxAudioPlays && <div className="text-jade mt-0.5">Giới hạn nghe: {s.maxAudioPlays} lần</div>}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted">{bp.notes}</p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              aria-label="Chế độ thi"
              value={sectionOnly}
              onChange={(e) => setSectionOnly(e.target.value as 'full' | ExamSectionKey)}
              className="glass-subtle px-3 py-2 text-xs font-semibold outline-none"
            >
              <option value="full">Thi đầy đủ cả bài (Mở khóa lên cấp)</option>
              {bp.sections.map((s) => (
                <option key={s.key} value={s.key}>
                  Luyện riêng phần: {s.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={loading || !levelPool.length}
              onClick={startExam}
              className="glass-pill-btn glass-primary-btn"
            >
              <Play size={15} /> {loading ? 'Đang nạp đề thi...' : 'Bắt đầu làm bài thi'}
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
                  {ex.admin_feedback && <div className="mt-1 text-jade">Cô Khánh Mai: {ex.admin_feedback}</div>}
                </div>
                <span className={`soft-chip ${ex.passed ? '!bg-moss-soft !text-moss' : '!bg-terracotta-soft !text-terracotta'}`}>
                  <CheckCircle2 size={12} /> {ex.total_score} điểm
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
