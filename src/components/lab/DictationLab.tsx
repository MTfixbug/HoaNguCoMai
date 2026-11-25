import confetti from 'canvas-confetti'
import { ArrowRight, CheckCircle2, Eye, Flame, Keyboard, RotateCw, Volume2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { evaluatePinyinAnswer } from '../../lib/pinyinTools'
import { shuffleArray } from '../../lib/randomizer'
import { speak } from '../../lib/tts'
import type { DictEntry } from '../../types/vocab'

export default function DictationLab({ pool, level }: { pool: DictEntry[]; level: number }) {
  const { settings, recordQuizOutcome, recordStudySession } = useLms()
  const { triggerReaction } = usePetReaction()
  const [roundSeed, setRoundSeed] = useState(0)

  const candidates = useMemo(() => pool.filter((w) => Boolean(w.pinyin && w.hanzi)), [pool])
  const deck = useMemo(() => shuffleArray(candidates).slice(0, 10), [candidates, roundSeed])

  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [showHintHanzi, setShowHintHanzi] = useState(false)
  const [result, setResult] = useState<{ match: 'exact' | 'toneless' | 'wrong'; expectedDisplay: string; expectedNumbered: string } | null>(null)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const startedRef = useRef(Date.now())
  const loggedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIdx(0)
    setAnswer('')
    setShowHintHanzi(false)
    setResult(null)
    setScore(0)
    setCombo(0)
    startedRef.current = Date.now()
    loggedRef.current = false
  }, [deck])

  const current = deck[idx]

  useEffect(() => {
    if (!current || idx >= deck.length) return
    const t = window.setTimeout(() => {
      speak(current.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
      inputRef.current?.focus()
    }, 180)
    return () => window.clearTimeout(t)
  }, [current?.id, idx, deck.length, settings.ttsRate, settings.ttsVoiceURI])

  useEffect(() => {
    if (deck.length > 0 && idx >= deck.length && !loggedRef.current) {
      loggedRef.current = true
      const dur = Math.max(10, Math.round((Date.now() - startedRef.current) / 1000))
      const acc = Math.round((score / deck.length) * 100)
      recordStudySession('dictation', level, dur, deck.length, acc)
      if (acc >= 70) confetti({ particleCount: 55, spread: 60, origin: { y: 0.65 } })
    }
  }, [idx, deck.length, score, level, recordStudySession])

  if (!candidates.length) {
    return <div className="glass-panel p-6 text-sm text-muted">Đang tải bộ từ luyện nghe – gõ Pinyin...</div>
  }

  if (idx >= deck.length) {
    const acc = Math.round((score / Math.max(1, deck.length)) * 100)
    return (
      <div className="glass-panel mx-auto max-w-md p-7 text-center space-y-4">
        <div className="text-4xl">⌨️</div>
        <h3 className="text-xl font-bold text-ink">Hoàn thành Nghe – Gõ Pinyin!</h3>
        <p className="text-sm text-muted">
          Đúng {score}/{deck.length} từ ({acc}%) · Phản xạ nghe và gõ bàn phím tiếng Trung tiến bộ rõ rệt!
        </p>
        <button type="button" onClick={() => setRoundSeed((s) => s + 1)} className="glass-pill-btn glass-primary-btn">
          <RotateCw size={15} /> Luyện tiếp 10 từ mới
        </button>
      </div>
    )
  }

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault()
    if (result || !answer.trim()) return
    const ev = evaluatePinyinAnswer(answer, current.pinyin)
    setResult(ev)
    const ok = ev.match !== 'wrong'
    recordQuizOutcome(current.id, current.hskNum, ok)
    if (ok) {
      const nc = combo + 1
      setCombo(nc)
      setScore((s) => s + 1)
      triggerReaction(nc >= 3 ? 'combo' : 'correct', {
        xpDelta: ev.match === 'exact' ? 8 : 5,
        combo: nc,
      })
    } else {
      setCombo(0)
      triggerReaction('wrong', { message: `Đáp án là ${current.pinyin}` })
    }
  }

  const handleNext = () => {
    setAnswer('')
    setResult(null)
    setShowHintHanzi(false)
    setIdx((i) => i + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="dictation-lab">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted">
          Câu {idx + 1} / {deck.length} · Hỗ trợ gõ có dấu hoặc số thanh (ví dụ: ni3 hao3)
        </span>
        <div className="flex items-center gap-2">
          {combo >= 2 && (
            <span className="soft-chip !bg-ochre-soft !text-ochre">
              <Flame size={12} /> Chuỗi x{combo}
            </span>
          )}
          <span className="soft-chip">HSK {level}</span>
        </div>
      </div>

      <div className="glass-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="soft-chip !bg-glass-subtle !text-muted border border-line">{current.pos || 'Từ vựng'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHintHanzi((v) => !v)}
              className="glass-pill-btn !min-h-8 !px-3 text-xs"
            >
              <Eye size={13} /> {showHintHanzi ? 'Ẩn chữ Hán' : 'Gợi ý chữ Hán'}
            </button>
            <button
              type="button"
              onClick={() => speak(current.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })}
              className="glass-pill-btn !min-h-8 !px-3 text-xs"
            >
              <Volume2 size={14} /> Nghe lại
            </button>
          </div>
        </div>

        <div className="glass-subtle p-4 text-center space-y-1.5">
          <div className="text-xs text-muted">Nghĩa tiếng Việt</div>
          <div className="text-lg font-bold text-ink">{current.meaningVi}</div>
          {(showHintHanzi || result) && (
            <div className="hanzi pt-1 text-3xl font-bold text-jade">{current.hanzi}</div>
          )}
        </div>

        <form onSubmit={handleCheck} className="space-y-3">
          <label className="block text-xs font-semibold text-muted">
            Gõ Pinyin bạn nghe được
            <div className="mt-1.5 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                disabled={Boolean(result)}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Ví dụ: ni3 hao3 hoặc ni hao..."
                data-testid="dictation-input"
                className="flex-1 rounded-xl border border-line bg-glass px-3.5 py-2.5 text-sm font-medium text-ink outline-none focus:border-jade"
              />
              {!result && (
                <button
                  type="submit"
                  disabled={!answer.trim()}
                  data-testid="dictation-submit"
                  className="glass-pill-btn glass-primary-btn shrink-0"
                >
                  <Keyboard size={15} /> Kiểm tra
                </button>
              )}
            </div>
          </label>
        </form>

        {result && (
          <div className="glass-subtle p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              {result.match !== 'wrong' ? (
                <CheckCircle2 size={18} className="text-moss shrink-0" />
              ) : (
                <XCircle size={18} className="text-terracotta shrink-0" />
              )}
              <div>
                <div
                  className={`font-bold ${
                    result.match === 'exact'
                      ? 'text-moss'
                      : result.match === 'toneless'
                        ? 'text-ochre'
                        : 'text-terracotta'
                  }`}
                >
                  {result.match === 'exact'
                    ? 'Chuẩn cả thanh điệu!'
                    : result.match === 'toneless'
                      ? 'Đúng âm rồi — chú ý thêm thanh điệu nhé!'
                      : 'Chưa đúng — hãy nghe lại từ này'}
                </div>
                <div className="text-xs text-muted">
                  Đáp án: <strong className="text-jade">{result.expectedDisplay}</strong> ({result.expectedNumbered}) ·{' '}
                  <span className="hanzi font-semibold text-ink">{current.hanzi}</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={handleNext} className="glass-pill-btn glass-primary-btn text-xs">
              Từ tiếp theo <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
