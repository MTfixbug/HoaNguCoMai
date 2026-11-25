import confetti from 'canvas-confetti'
import { ArrowRight, CheckCircle2, Flame, RotateCcw, Sparkles, Timer, Volume2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { AntiStreakTracker, generateMCQOptions, SessionDeckQueue, shuffleArray, weightedSample } from '../../lib/randomizer'
import { speak } from '../../lib/tts'
import type { CustomLesson } from '../../types/lms'
import type { DictEntry } from '../../types/vocab'

export type QuizMode = 'mix' | 'zh_to_vi' | 'vi_to_zh' | 'audio' | 'pinyin' | 'cloze' | 'class_quiz'

export interface BuiltQuizQuestion {
  id: string
  targetWordId: string
  hskNum: number
  kind: Exclude<QuizMode, 'mix'>
  badge: string
  promptMain: string
  promptSub?: string
  audioText?: string
  options: { label: string; sub?: string }[]
  correctIndex: number
  explanation: string
  hanzi?: string
  meaningVi?: string
}

export function buildQuizQuestions({
  vocabPool,
  customLessons,
  mode,
  count,
  progressMap,
  recentIds,
}: {
  vocabPool: DictEntry[]
  customLessons: CustomLesson[]
  mode: QuizMode
  count: number
  progressMap: ReturnType<typeof useLms>['progressMap']
  recentIds: string[]
}): BuiltQuizQuestion[] {
  const tracker = new AntiStreakTracker()
  const recentSet = new Set(recentIds)
  const out: BuiltQuizQuestion[] = []
  const usedIds = new Set<string>()

  const lessonItems: Array<{
    id: string
    hskLevel: number
    badge: string
    promptMain: string
    promptSub: string
    rawOptions: string[]
    rawAnswer: string
    explanation: string
  }> = []

  if (mode === 'mix' || mode === 'class_quiz') {
    for (const l of customLessons.filter((x) => x.is_published)) {
      for (const q of l.quiz_items ?? []) {
        if (q.options.length >= 2) {
          lessonItems.push({
            id: q.id,
            hskLevel: l.hsk_level,
            badge: `HSK ${l.hsk_level} · ${l.title_zh}`,
            promptMain: q.prompt,
            promptSub: 'Chọn đáp án chính xác nhất:',
            rawOptions: q.options,
            rawAnswer: q.options[q.answer],
            explanation: q.explanationVi,
          })
        }
      }
    }
  }

  if ((mode === 'class_quiz' || mode === 'mix') && lessonItems.length > 0) {
    const quota =
      mode === 'class_quiz'
        ? Math.min(count, lessonItems.length)
        : Math.min(Math.max(1, Math.floor(count * 0.15)), lessonItems.length)
    const picked = new SessionDeckQueue(lessonItems, recentIds).nextBatch(quota)
    for (const g of picked) {
      usedIds.add(g.id)
      const opts = shuffleArray(g.rawOptions)
      const rawIdx = opts.indexOf(g.rawAnswer)
      const adj = tracker.adjustCorrectIndex(
        opts.map((o) => ({ label: o })),
        rawIdx >= 0 ? rawIdx : 0,
      )
      out.push({
        id: g.id,
        targetWordId: g.id,
        hskNum: g.hskLevel,
        kind: 'class_quiz',
        badge: g.badge,
        promptMain: g.promptMain,
        promptSub: g.promptSub,
        options: adj.options,
        correctIndex: adj.correctIndex,
        explanation: g.explanation,
      })
    }
  }

  const remaining = Math.max(0, count - out.length)
  if (remaining > 0 && vocabPool.length >= 4) {
    const sampled = weightedSample(
      vocabPool.filter((w) => !usedIds.has(w.id)),
      remaining,
      { progressMap, recentIds: recentSet },
    )
    const mixCycle: Array<Exclude<QuizMode, 'mix' | 'class_quiz'>> = ['zh_to_vi', 'vi_to_zh', 'audio', 'pinyin', 'cloze']

    sampled.forEach((w, idx) => {
      let kind: Exclude<QuizMode, 'mix' | 'class_quiz'> =
        mode === 'mix' || mode === 'class_quiz' ? mixCycle[idx % mixCycle.length] : mode
      if (kind === 'cloze' && (!w.exampleZh || !w.exampleZh.includes(w.hanzi))) {
        kind = 'zh_to_vi'
      }

      const { options, correctIndex } = generateMCQOptions(w, vocabPool, 4, tracker)

      if (kind === 'cloze' && w.exampleZh) {
        out.push({
          id: `qz-${w.id}-cloze`,
          targetWordId: w.id,
          hskNum: w.hskNum,
          kind: 'cloze',
          badge: `${w.hskLevel} · Điền từ theo ngữ cảnh`,
          promptMain: w.exampleZh.replace(w.hanzi, '（ ______ ）'),
          promptSub: w.exampleVi,
          audioText: w.exampleZh,
          options: options.map((o) => ({ label: o.hanzi, sub: o.pinyin })),
          correctIndex,
          explanation: `${w.hanzi} (${w.pinyin}): ${w.meaningVi}`,
          hanzi: w.hanzi,
          meaningVi: w.meaningVi,
        })
      } else if (kind === 'audio') {
        out.push({
          id: `qz-${w.id}-audio`,
          targetWordId: w.id,
          hskNum: w.hskNum,
          kind: 'audio',
          badge: `${w.hskLevel} · Nghe chọn chữ Hán`,
          promptMain: '🎧 Nghe phát âm và chọn đúng từ tiếng Trung',
          promptSub: 'Nhấn nút Nghe để phát lại giọng đọc chuẩn',
          audioText: w.hanzi,
          options: options.map((o) => ({ label: o.hanzi, sub: o.meaningVi })),
          correctIndex,
          explanation: `${w.hanzi} [${w.pinyin}] (${w.hanViet}): ${w.meaningVi}`,
          hanzi: w.hanzi,
          meaningVi: w.meaningVi,
        })
      } else if (kind === 'pinyin') {
        out.push({
          id: `qz-${w.id}-py`,
          targetWordId: w.id,
          hskNum: w.hskNum,
          kind: 'pinyin',
          badge: `${w.hskLevel} · Pinyin → Chữ Hán`,
          promptMain: w.pinyin,
          promptSub: w.hanViet ? `Gợi ý Hán-Việt: [${w.hanViet}]` : w.meaningVi,
          audioText: w.hanzi,
          options: options.map((o) => ({ label: o.hanzi, sub: o.meaningVi })),
          correctIndex,
          explanation: `${w.hanzi} (${w.pinyin}): ${w.meaningVi}`,
          hanzi: w.hanzi,
          meaningVi: w.meaningVi,
        })
      } else if (kind === 'vi_to_zh') {
        out.push({
          id: `qz-${w.id}-v2z`,
          targetWordId: w.id,
          hskNum: w.hskNum,
          kind: 'vi_to_zh',
          badge: `${w.hskLevel} · Nghĩa Việt → Chữ Hán`,
          promptMain: w.meaningVi,
          promptSub: [w.pos, w.hanViet ? `[${w.hanViet}]` : ''].filter(Boolean).join(' · '),
          audioText: w.hanzi,
          options: options.map((o) => ({ label: o.hanzi, sub: o.pinyin })),
          correctIndex,
          explanation: `${w.hanzi} (${w.pinyin}): ${w.meaningVi}`,
          hanzi: w.hanzi,
          meaningVi: w.meaningVi,
        })
      } else {
        out.push({
          id: `qz-${w.id}-z2v`,
          targetWordId: w.id,
          hskNum: w.hskNum,
          kind: 'zh_to_vi',
          badge: `${w.hskLevel} · Chữ Hán → Nghĩa Việt`,
          promptMain: w.hanzi,
          promptSub: `${w.pinyin}${w.hanViet ? ` · [${w.hanViet}]` : ''}`,
          audioText: w.hanzi,
          options: options.map((o) => ({ label: o.meaningVi })),
          correctIndex,
          explanation: `${w.hanzi} (${w.pinyin}): ${w.meaningVi}`,
          hanzi: w.hanzi,
          meaningVi: w.meaningVi,
        })
      }
    })
  }

  return shuffleArray(out)
}

export default function QuizRunner({
  questions,
  scopeLevel,
  timedRush,
  assignmentId,
  onRestart,
}: {
  questions: BuiltQuizQuestion[]
  scopeLevel: number
  timedRush: boolean
  assignmentId?: string
  onRestart: () => void
}) {
  const { settings, recordQuizOutcome, recordStudySession, recordAssignmentCompletion } = useLms()
  const { triggerReaction } = usePetReaction()
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [score, setScore] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [missed, setMissed] = useState<BuiltQuizQuestion[]>([])
  const [secondsLeft, setSecondsLeft] = useState(12)
  const startedRef = useRef(Date.now())
  const loggedRef = useRef(false)

  useEffect(() => {
    setIdx(0)
    setPicked(null)
    setCombo(0)
    setMaxCombo(0)
    setScore(0)
    setXpEarned(0)
    setMissed([])
    startedRef.current = Date.now()
    loggedRef.current = false
  }, [questions])

  const q = questions[idx]

  useEffect(() => {
    if (!q) return
    if (q.kind === 'audio' && q.audioText) {
      speak(q.audioText, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
    } else if (settings.autoSpeak && q.kind === 'zh_to_vi' && q.audioText) {
      speak(q.audioText, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
    }
  }, [q?.id, settings.autoSpeak, settings.ttsRate, settings.ttsVoiceURI])

  useEffect(() => {
    if (!timedRush || !q || picked !== null) return
    setSecondsLeft(12)
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timer)
          handlePick(-1)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timedRush, idx, picked, questions])

  useEffect(() => {
    if (questions.length > 0 && idx >= questions.length && !loggedRef.current) {
      loggedRef.current = true
      const elapsedSec = Math.max(10, Math.round((Date.now() - startedRef.current) / 1000))
      const acc = Math.round((score / questions.length) * 100)
      recordStudySession('quiz', scopeLevel, elapsedSec, questions.length, acc)
      if (assignmentId) {
        const missWords = missed.map((m) => m.hanzi ?? m.promptMain).slice(0, 8)
        void recordAssignmentCompletion(assignmentId, acc, 100, elapsedSec, missWords).then(() => {
          toast.success('Đã nộp bài trắc nghiệm Cô giao!')
        })
      }
      if (acc >= 75 || maxCombo >= 5) {
        confetti({ particleCount: 70, spread: 65, origin: { y: 0.65 } })
      }
    }
  }, [idx, questions.length, score, maxCombo, scopeLevel, assignmentId, missed, recordStudySession, recordAssignmentCompletion])

  const handlePick = (choiceIdx: number) => {
    if (!q || picked !== null) return
    setPicked(choiceIdx)
    const ok = choiceIdx === q.correctIndex
    recordQuizOutcome(q.targetWordId, q.hskNum, ok)
    if (ok) {
      const nextCombo = combo + 1
      setCombo(nextCombo)
      setMaxCombo((m) => Math.max(m, nextCombo))
      setScore((s) => s + 1)
      const gained = nextCombo >= 5 ? 25 : nextCombo >= 3 ? 18 : 10
      setXpEarned((x) => x + gained)
      triggerReaction(nextCombo >= 3 ? 'combo' : 'correct', { xpDelta: gained, combo: nextCombo })
    } else {
      setCombo(0)
      setMissed((m) => [...m, q])
      setXpEarned((x) => x + 2)
      triggerReaction('wrong', { message: 'Xem giải thích bên dưới nhé!' })
    }
    if (q.audioText && q.kind !== 'audio') {
      speak(q.audioText, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
    }
  }

  const nextQ = () => {
    setPicked(null)
    setIdx((i) => i + 1)
  }

  const accuracy = useMemo(() => (questions.length ? Math.round((score / questions.length) * 100) : 0), [score, questions.length])

  if (!questions.length) {
    return <div className="glass-panel p-8 text-center text-sm text-muted">Chưa đủ câu hỏi cho bộ lọc hiện tại.</div>
  }

  if (idx >= questions.length) {
    return (
      <div className="glass-panel mx-auto max-w-xl p-6 sm:p-8 text-center space-y-5">
        <div className="text-4xl">{accuracy >= 80 ? '🏆' : accuracy >= 55 ? '🌿' : '📘'}</div>
        <div>
          <h2 className="text-2xl font-bold text-ink">Hoàn thành bài Trắc nghiệm</h2>
          <p className="text-sm text-muted">
            Đúng {score} / {questions.length} câu ({accuracy}%)
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="glass-subtle p-3">
            <div className="text-xl font-bold text-moss">{accuracy}%</div>
            <div className="text-xs text-muted">Độ chính xác</div>
          </div>
          <div className="glass-subtle p-3">
            <div className="text-xl font-bold text-ochre">+{xpEarned} XP</div>
            <div className="text-xs text-muted">Điểm tích lũy</div>
          </div>
          <div className="glass-subtle p-3">
            <div className="text-xl font-bold text-jade">x{maxCombo}</div>
            <div className="text-xs text-muted">Chuỗi cao nhất</div>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="glass-subtle p-4 text-left space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-terracotta">
              Đã lưu {missed.length} câu sai vào Sổ tay Ôn tập
            </div>
            <ul className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
              {missed.map((m) => (
                <li key={m.id} className="rounded-xl bg-glass px-3 py-2 border border-line">
                  <span className="hanzi font-bold">{m.hanzi ?? m.promptMain}</span>
                  {m.meaningVi && <span className="text-muted"> — {m.meaningVi}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" onClick={onRestart} className="glass-pill-btn glass-primary-btn">
          <RotateCcw size={15} /> Làm bộ câu hỏi mới
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3" data-testid="quiz-runner">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted">
          Câu {idx + 1} / {questions.length}
        </span>
        <div className="flex items-center gap-1.5">
          {combo >= 2 && (
            <span className="soft-chip !bg-ochre-soft !text-ochre">
              <Flame size={12} /> Chuỗi x{combo}
            </span>
          )}
          <span className="soft-chip !bg-moss-soft !text-moss">
            <Sparkles size={12} /> +{xpEarned} XP
          </span>
          {timedRush && (
            <span className={`soft-chip ${secondsLeft <= 4 ? '!bg-terracotta-soft !text-terracotta' : ''}`}>
              <Timer size={12} /> {secondsLeft} giây
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-jade transition-all duration-300"
          style={{ width: `${Math.round(((idx + 1) / questions.length) * 100)}%` }}
        />
      </div>

      <div key={q.id} className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="soft-chip">{q.badge}</span>
          {q.audioText && (
            <button
              type="button"
              onClick={() => speak(q.audioText!, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })}
              className="glass-pill-btn !min-h-8 !px-3 text-xs"
            >
              <Volume2 size={14} /> Nghe
            </button>
          )}
        </div>

        <div className="py-1 space-y-1">
          <div className={`${q.kind === 'zh_to_vi' ? 'hanzi hz-xl text-center' : 'hanzi text-xl font-bold'} leading-relaxed text-ink`}>
            {q.promptMain}
          </div>
          {q.promptSub && (
            <p className={`text-xs sm:text-sm text-muted ${q.kind === 'zh_to_vi' ? 'text-center' : ''}`}>{q.promptSub}</p>
          )}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {q.options.map((opt, oIdx) => {
            const letter = ['A', 'B', 'C', 'D'][oIdx] ?? String(oIdx + 1)
            const isPicked = picked === oIdx
            const isRight = oIdx === q.correctIndex
            let style = 'border-line bg-glass-subtle hover:border-jade'
            if (picked !== null) {
              if (isRight) style = 'border-moss bg-moss-soft text-moss font-semibold'
              else if (isPicked) style = 'border-terracotta bg-terracotta-soft text-terracotta'
              else style = 'border-line bg-glass-subtle opacity-55'
            }
            return (
              <button
                key={oIdx}
                type="button"
                disabled={picked !== null}
                onClick={() => handlePick(oIdx)}
                className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-left transition cursor-pointer disabled:cursor-default ${style}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-glass text-xs font-bold border border-line text-ink">
                  {letter}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="hanzi text-sm sm:text-base font-medium leading-snug text-ink">{opt.label}</div>
                  {opt.sub && <div className="text-xs text-muted mt-0.5">{opt.sub}</div>}
                </div>
                {picked !== null && isRight && <CheckCircle2 size={17} className="shrink-0 text-moss" />}
                {picked !== null && isPicked && !isRight && <XCircle size={17} className="shrink-0 text-terracotta" />}
              </button>
            )
          })}
        </div>

        {picked !== null && (
          <div className="glass-subtle p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm space-y-0.5">
              <div className={`font-bold ${picked === q.correctIndex ? 'text-moss' : 'text-terracotta'}`}>
                {picked === q.correctIndex ? 'Chính xác!' : picked === -1 ? 'Hết thời gian!' : 'Chưa đúng — Đã lưu vào Sổ tay'}
              </div>
              <div className="text-muted">{q.explanation}</div>
            </div>
            <button type="button" onClick={nextQ} className="glass-pill-btn glass-primary-btn shrink-0">
              Câu tiếp <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
