import confetti from 'canvas-confetti'
import { CheckCircle2, Flame, RotateCw, Volume2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { extractSyllableTones, type PinyinTone, type SyllableToneInfo } from '../../lib/pinyinTools'
import { shuffleArray } from '../../lib/randomizer'
import { speak } from '../../lib/tts'
import type { DictEntry } from '../../types/vocab'

const TONE_OPTIONS: Array<{ tone: PinyinTone; label: string; mark: string; path: string }> = [
  { tone: 1, label: 'Thanh 1', mark: 'ˉ', path: 'M6 10 L34 10' },
  { tone: 2, label: 'Thanh 2', mark: 'ˊ', path: 'M6 22 L34 8' },
  { tone: 3, label: 'Thanh 3', mark: 'ˇ', path: 'M6 12 L19 24 L34 9' },
  { tone: 4, label: 'Thanh 4', mark: 'ˋ', path: 'M6 7 L34 23' },
  { tone: 5, label: 'Thanh nhẹ', mark: '·', path: 'M18 15 A2 2 0 1 0 22 15 A2 2 0 1 0 18 15' },
]

interface ToneItem {
  word: DictEntry
  syllables: SyllableToneInfo[]
}

export default function ToneTrainerLab({ pool, level }: { pool: DictEntry[]; level: number }) {
  const { settings, recordQuizOutcome, recordStudySession } = useLms()
  const { triggerReaction } = usePetReaction()
  const [roundSeed, setRoundSeed] = useState(0)

  const candidates = useMemo<ToneItem[]>(() => {
    const valid: ToneItem[] = []
    for (const w of pool) {
      if (!w.pinyin) continue
      const syllables = extractSyllableTones(w.pinyin)
      if (syllables.length >= 1 && syllables.length <= 2) {
        valid.push({ word: w, syllables })
      }
    }
    return valid
  }, [pool])

  const deck = useMemo(() => shuffleArray(candidates).slice(0, 10), [candidates, roundSeed])

  const [idx, setIdx] = useState(0)
  const [pickedTones, setPickedTones] = useState<PinyinTone[]>([])
  const [checked, setChecked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [combo, setCombo] = useState(0)
  const startedRef = useRef(Date.now())
  const loggedRef = useRef(false)

  useEffect(() => {
    setIdx(0)
    setPickedTones([])
    setChecked(false)
    setCorrectCount(0)
    setCombo(0)
    startedRef.current = Date.now()
    loggedRef.current = false
  }, [deck])

  const current = deck[idx]

  useEffect(() => {
    if (!current || idx >= deck.length) return
    const t = window.setTimeout(() => {
      speak(current.word.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
    }, 180)
    return () => window.clearTimeout(t)
  }, [current?.word.id, idx, deck.length, settings.ttsRate, settings.ttsVoiceURI])

  useEffect(() => {
    if (deck.length > 0 && idx >= deck.length && !loggedRef.current) {
      loggedRef.current = true
      const dur = Math.max(10, Math.round((Date.now() - startedRef.current) / 1000))
      const acc = Math.round((correctCount / deck.length) * 100)
      recordStudySession('tone', level, dur, deck.length, acc)
      if (acc >= 70) confetti({ particleCount: 55, spread: 60, origin: { y: 0.65 } })
    }
  }, [idx, deck.length, correctCount, level, recordStudySession])

  if (!candidates.length) {
    return <div className="glass-panel p-6 text-sm text-muted">Đang chuẩn bị dữ liệu luyện thanh điệu...</div>
  }

  if (idx >= deck.length) {
    const acc = Math.round((correctCount / Math.max(1, deck.length)) * 100)
    return (
      <div className="glass-panel mx-auto max-w-md p-7 text-center space-y-4">
        <div className="text-4xl">🎵</div>
        <h3 className="text-xl font-bold text-ink">Hoàn thành vòng Luyện Thanh Điệu!</h3>
        <p className="text-sm text-muted">
          Đúng {correctCount}/{deck.length} từ ({acc}%) · Tai nghe thanh điệu ngày càng chuẩn hơn!
        </p>
        <button type="button" onClick={() => setRoundSeed((s) => s + 1)} className="glass-pill-btn glass-primary-btn">
          <RotateCw size={15} /> Luyện vòng 10 từ mới
        </button>
      </div>
    )
  }

  const expected = current.syllables.map((s) => s.tone)
  const isAllCorrect = checked && expected.every((t, i) => pickedTones[i] === t)

  const handleSelectTone = (tone: PinyinTone) => {
    if (checked) return
    const nextPicked = [...pickedTones, tone]
    setPickedTones(nextPicked)

    if (nextPicked.length === expected.length) {
      setChecked(true)
      const ok = expected.every((t, i) => nextPicked[i] === t)
      recordQuizOutcome(current.word.id, current.word.hskNum, ok)
      if (ok) {
        const nc = combo + 1
        setCombo(nc)
        setCorrectCount((c) => c + 1)
        triggerReaction(nc >= 3 ? 'combo' : 'correct', { xpDelta: 8, combo: nc })
      } else {
        setCombo(0)
        triggerReaction('wrong', { message: `Đáp án là ${current.word.pinyin}` })
      }
    }
  }

  const nextQuestion = () => {
    setPickedTones([])
    setChecked(false)
    setIdx((i) => i + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="tone-trainer-lab">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted">
          Từ {idx + 1} / {deck.length} · Chọn đúng thanh điệu theo thứ tự từng âm tiết
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

      <div className="glass-panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{current.word.meaningVi}</span>
          <button
            type="button"
            onClick={() => speak(current.word.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })}
            className="glass-pill-btn !min-h-8 !px-3 text-xs"
          >
            <Volume2 size={14} /> Nghe lại
          </button>
        </div>

        <div className="text-center space-y-2 py-2">
          <div className="hanzi hz-xl text-ink">{current.word.hanzi}</div>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            {current.syllables.map((syl, sIdx) => {
              const chosen = pickedTones[sIdx]
              const isSlotActive = !checked && sIdx === pickedTones.length
              const isSlotOk = checked && chosen === syl.tone
              return (
                <div
                  key={`${syl.plain}-${sIdx}`}
                  className={`min-w-[84px] rounded-2xl border px-3.5 py-2 text-center transition ${
                    checked
                      ? isSlotOk
                        ? 'border-moss bg-moss-soft text-moss'
                        : 'border-terracotta bg-terracotta-soft text-terracotta'
                      : isSlotActive
                        ? 'border-jade bg-jade-soft text-jade'
                        : 'border-line bg-glass-subtle text-ink'
                  }`}
                >
                  <div className="text-base font-bold">{checked ? syl.syllable : syl.plain}</div>
                  <div className="text-[11px] text-muted">
                    {chosen ? `Thanh ${chosen === 5 ? 'nhẹ' : chosen}` : isSlotActive ? 'Đang chọn...' : 'Chờ chọn'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 5 nút thanh điệu trực quan với đường cao độ */}
        <div className="grid grid-cols-5 gap-2">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.tone}
              type="button"
              disabled={checked}
              onClick={() => handleSelectTone(opt.tone)}
              data-testid={`tone-btn-${opt.tone}`}
              className="glass-pill-btn !rounded-2xl !h-auto flex-col py-2.5 px-1 text-center hover:!bg-jade-soft"
            >
              <svg width="36" height="26" viewBox="0 0 40 30" className="text-jade" aria-hidden="true">
                <path d={opt.path} stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="text-sm font-extrabold text-ink">{opt.mark}</span>
              <span className="text-[10px] font-semibold text-muted">{opt.label}</span>
            </button>
          ))}
        </div>

        {!checked && pickedTones.length > 0 && (
          <div className="flex justify-center">
            <button type="button" onClick={() => setPickedTones([])} className="text-xs font-semibold text-muted hover:text-ink cursor-pointer">
              Chọn lại âm tiết
            </button>
          </div>
        )}

        {checked && (
          <div className="glass-subtle p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              {isAllCorrect ? <CheckCircle2 size={18} className="text-moss shrink-0" /> : <XCircle size={18} className="text-terracotta shrink-0" />}
              <div>
                <div className={`font-bold ${isAllCorrect ? 'text-moss' : 'text-terracotta'}`}>
                  {isAllCorrect ? 'Quá chuẩn!' : `Thanh điệu đúng: ${expected.map((t) => (t === 5 ? 'nhẹ' : t)).join(' - ')}`}
                </div>
                <div className="text-xs text-muted">
                  {current.word.hanzi} · <strong className="text-jade">{current.word.pinyin}</strong> ({current.word.meaningVi})
                </div>
              </div>
            </div>
            <button type="button" onClick={nextQuestion} className="glass-pill-btn glass-primary-btn text-xs">
              Từ tiếp theo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
