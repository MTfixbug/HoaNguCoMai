import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { ArrowLeft, ArrowRight, Bookmark, Ear, PenTool, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/AuthContext'
import { useLms } from '../../hooks/LmsContext'
import { usePetReaction } from '../../hooks/PetReactionContext'
import { createInitialProgress, previewIntervals } from '../../lib/srs'
import { requeueForgottenCard } from '../../lib/todayQueue'
import { speak } from '../../lib/tts'
import type { Rating } from '../../types/lms'
import SpeakButton from '../common/SpeakButton'
import StrokeWriterStudio from './StrokeWriterStudio'

export interface FlashcardEntry {
  id: string
  hanzi: string
  pinyin: string
  hanViet: string
  pos: string
  meaningVi: string
  hskNum: number
  hskLevel: string
  source?: 'core' | 'extra'
  topic?: string
  reviewed?: boolean
  lessonTitle?: string
  exampleZh?: string
  exampleVi?: string
  audioUrl?: string
}

const RATINGS: { key: Rating; label: string; tone: string }[] = [
  { key: 'again', label: 'Quên', tone: 'hover:!border-terracotta hover:!text-terracotta' },
  { key: 'hard', label: 'Khó', tone: 'hover:!border-ochre hover:!text-ochre' },
  { key: 'good', label: 'Nhớ', tone: 'hover:!border-moss hover:!text-moss' },
  { key: 'easy', label: 'Quá dễ', tone: 'hover:!border-periwinkle hover:!text-periwinkle' },
]

const STATUS_LABEL: Record<string, string> = {
  new: 'Thẻ mới',
  learning: 'Đang học',
  familiar: 'Quen thuộc',
  mastered: 'Thành thạo',
}

function summarizeMeaning(raw: string): { short: string; hasMore: boolean } {
  const parts = raw
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length <= 2 && raw.length <= 75) {
    return { short: raw, hasMore: false }
  }
  const short = parts.slice(0, 2).join('; ')
  const clipped = short.length > 78 ? `${short.slice(0, 75)}…` : short
  return { short: clipped, hasMore: raw.length > clipped.length }
}

export default function FlashcardDeck({
  cards,
  scopeLevel,
  assignmentId,
  requeueAgain = true,
  onCompleteSession,
  onRestart,
}: {
  cards: FlashcardEntry[]
  scopeLevel: number
  assignmentId?: string
  requeueAgain?: boolean
  onCompleteSession?: (stats: { count: number; accuracyPct: number }) => void
  onRestart: () => void
}) {
  const { profile } = useAuth()
  const { settings, progressMap, rateWord, toggleHardWord, recordStudySession, recordAssignmentCompletion } = useLms()
  const { triggerReaction } = usePetReaction()

  const [deckCards, setDeckCards] = useState<FlashcardEntry[]>(cards)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [expandedMeaning, setExpandedMeaning] = useState(false)
  const [blindAudio, setBlindAudio] = useState(false)
  const [showWriter, setShowWriter] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [combo, setCombo] = useState(0)
  const [requeuedIds, setRequeuedIds] = useState<Record<string, number>>({})

  const [guardWarned, setGuardWarned] = useState(false)
  const [guardBroomTick, setGuardBroomTick] = useState(0)

  const startedRef = useRef(Date.now())
  const shownAtRef = useRef(Date.now())
  const loggedRef = useRef(false)
  const draggingRef = useRef(false)

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 0, 220], [-11, 0, 11])
  const rightStampOpacity = useTransform(x, [25, 110], [0, 1])
  const leftStampOpacity = useTransform(x, [-110, -25], [1, 0])

  useEffect(() => {
    setDeckCards(cards)
    setIdx(0)
    setFlipped(false)
    setExpandedMeaning(false)
    setCorrectCount(0)
    setCombo(0)
    setRequeuedIds({})
    setGuardWarned(false)
    setGuardBroomTick(0)
    startedRef.current = Date.now()
    shownAtRef.current = Date.now()
    loggedRef.current = false
    x.set(0)
  }, [cards, x])

  const current = deckCards[idx]
  const nextPreview = deckCards[idx + 1]
  const approvedSet = useMemo(() => new Set(settings.approvedContentIds ?? []), [settings.approvedContentIds])

  useEffect(() => {
    shownAtRef.current = Date.now()
    setExpandedMeaning(false)
    setGuardWarned(false)
    setGuardBroomTick(0)
    x.set(0)
  }, [idx, current?.id, x])

  useEffect(() => {
    if (!current || !settings.autoSpeak) return
    const t = window.setTimeout(() => {
      speak(current.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
    }, 180)
    return () => window.clearTimeout(t)
  }, [current?.id, idx, settings.autoSpeak, settings.ttsRate, settings.ttsVoiceURI])

  useEffect(() => {
    if (deckCards.length > 0 && idx >= deckCards.length && !loggedRef.current) {
      loggedRef.current = true
      const elapsedSec = Math.max(10, Math.round((Date.now() - startedRef.current) / 1000))
      const acc = Math.round((correctCount / deckCards.length) * 100)
      recordStudySession('flashcard', scopeLevel, elapsedSec, deckCards.length, acc)
      if (assignmentId) {
        void recordAssignmentCompletion(assignmentId, acc, 100, elapsedSec).then(() => {
          toast.success('Đã tự động ghi nhận hoàn thành bài học từ vựng!')
        })
      }
      onCompleteSession?.({ count: deckCards.length, accuracyPct: acc })
    }
  }, [idx, deckCards.length, correctCount, scopeLevel, assignmentId, recordStudySession, recordAssignmentCompletion, onCompleteSession])

  const handleRate = useCallback(
    (rating: Rating) => {
      if (!current) return
      rateWord(current.id, current.hskNum, rating)
      if (rating !== 'again') {
        setCorrectCount((c) => c + 1)
        const nextCombo = combo + 1
        setCombo(nextCombo)
        triggerReaction(nextCombo >= 3 ? 'combo' : 'correct', { xpDelta: 5, combo: nextCombo })
      } else {
        setCombo(0)
        // Requeue forgotten card inside the active session (cap at 2 replays per word in one session)
        const countRequeued = requeuedIds[current.id] ?? 0
        if (requeueAgain && countRequeued < 2) {
          setDeckCards((prev) => requeueForgottenCard(prev, idx, 4))
          setRequeuedIds((prev) => ({ ...prev, [current.id]: countRequeued + 1 }))
          triggerReaction('wrong', { message: 'Sẽ nhắc lại sau vài thẻ nhé!' })
        } else {
          triggerReaction('wrong', { message: 'Ôn lại để nhớ lâu nhé!' })
        }
      }
      setFlipped(false)
      setIdx((i) => i + 1)
    },
    [current, combo, idx, requeueAgain, requeuedIds, rateWord, triggerReaction],
  )

  const attemptSwipe = useCallback(
    async (dir: 'left' | 'right' | 'up') => {
      if (!current) return
      if (dir === 'up') {
        toggleHardWord(current.id, current.hskNum, true)
        toast.info(`Đã ghim "${current.hanzi}" vào mục từ khó`)
        return
      }

      if (dir === 'left') {
        await animate(x, -260, { duration: 0.18 })
        handleRate('again')
        return
      }

      const tooFast = Date.now() - shownAtRef.current < 1500
      if ((!flipped || tooFast) && !guardWarned) {
        setGuardWarned(true)
        setGuardBroomTick((t) => t + 1)
        triggerReaction('swipe_guard', { message: 'Khoan đã, chắc nhớ chưa nè? 👀' })
        await animate(x, [0, -14, 14, -9, 9, 0], { duration: 0.36 })
        return
      }

      await animate(x, 260, { duration: 0.18 })
      handleRate('good')
    },
    [current, flipped, guardWarned, handleRate, toggleHardWord, triggerReaction, x],
  )

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    window.setTimeout(() => {
      draggingRef.current = false
    }, 90)
    // Require clear horizontal dominance so vertical touch-scroll on mobile never triggers swipe
    const absX = Math.abs(info.offset.x)
    const absY = Math.abs(info.offset.y)
    const horizontalIntent = absX > 85 && absX > absY * 1.4
    if (horizontalIntent && (info.offset.x > 100 || info.velocity.x > 520)) {
      void attemptSwipe('right')
    } else if (horizontalIntent && (info.offset.x < -100 || info.velocity.x < -520)) {
      void attemptSwipe('left')
    } else if (info.offset.y < -115 && absX < 55) {
      void attemptSwipe('up')
      void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 420, damping: 28 })
    }
  }

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((v) => !v)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        void attemptSwipe('left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        void attemptSwipe('right')
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        const map: Record<string, Rating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }
        handleRate(map[e.key])
      } else if (e.key.toLowerCase() === 's') {
        speak(current.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, flipped, handleRate, attemptSwipe, settings.ttsRate, settings.ttsVoiceURI])

  if (!deckCards.length) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center text-sm text-muted">
        Không có thẻ nào khớp bộ lọc đã chọn.
      </div>
    )
  }

  if (idx >= deckCards.length) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center space-y-4">
        <div className="text-4xl">✨</div>
        <h2 className="text-xl font-bold text-ink">Hoàn thành {deckCards.length} thẻ nhớ!</h2>
        <p className="text-sm text-muted">
          Tỉ lệ nhớ: <strong>{Math.round((correctCount / deckCards.length) * 100)}%</strong> · Lịch ôn tập SM-2 đã được cập nhật.
        </p>
        <button type="button" onClick={onRestart} className="glass-pill-btn glass-primary-btn min-h-11 px-5">
          <RotateCw size={15} /> Ôn tiếp bộ thẻ mới
        </button>
      </div>
    )
  }

  const cardState =
    progressMap[current.id] ?? createInitialProgress(profile?.id ?? 'local', current.id, current.hskNum)
  const intervals = previewIntervals(cardState)
  const rawMeaning = settings.contentOverrides?.[current.id]?.meaningVi ?? current.meaningVi
  const meaningInfo = summarizeMeaning(rawMeaning)
  const isWaitingReview = current.reviewed === false && !approvedSet.has(current.id)

  return (
    <div className="mx-auto max-w-xl space-y-3.5" data-testid="flashcard-deck">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="font-semibold">
          Thẻ {idx + 1} / {deckCards.length} · <span className="text-jade">{STATUS_LABEL[cardState.mastery_status]}</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`glass-pill-btn !min-h-9 !px-3 text-xs ${blindAudio ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            onClick={() => setBlindAudio((v) => !v)}
          >
            <Ear size={13} /> Nghe đoán chữ
          </button>
          <button
            type="button"
            className={`glass-pill-btn !min-h-9 !px-3 text-xs ${showWriter ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
            onClick={() => setShowWriter((v) => !v)}
          >
            <PenTool size={13} /> Tập viết nét
          </button>
          <button
            type="button"
            className={`glass-pill-btn !min-h-9 !px-3 text-xs ${cardState.is_flagged_hard ? '!border-terracotta !bg-terracotta-soft !text-terracotta' : ''}`}
            onClick={() => toggleHardWord(current.id, current.hskNum)}
          >
            <Bookmark size={13} /> {cardState.is_flagged_hard ? 'Đã ghim khó' : 'Ghim khó'}
          </button>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-jade transition-all duration-300"
          style={{ width: `${Math.round(((idx + 1) / deckCards.length) * 100)}%` }}
        />
      </div>

      <AnimatePresence>
        {guardWarned && (
          <motion.div
            key={`guard-${guardBroomTick}`}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            data-testid="swipe-broom-guard"
            className="rounded-2xl border border-ochre/45 bg-ochre-soft px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm"
          >
            <div className="flex items-center gap-2.5 text-xs font-bold text-ink">
              <motion.span
                key={`broom-${guardBroomTick}`}
                initial={{ x: -8, rotate: -25 }}
                animate={{ x: [0, 18, -4, 14, 0], rotate: [-20, 22, -15, 18, 0] }}
                transition={{ duration: 0.7 }}
                className="text-xl inline-block"
              >
                🧹
              </motion.span>
              <span>Khoan đã, chắc nhớ chưa nè? 👀 Lật xem đáp án hoặc quẹt phải lần nữa!</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="glass-pill-btn !min-h-9 !px-3 text-xs !border-ochre/50 !bg-glass-strong"
              >
                Lật xem thử
              </button>
              <button
                type="button"
                onClick={() => void attemptSwipe('right')}
                className="glass-pill-btn glass-primary-btn !min-h-9 !px-3 text-xs"
              >
                Chắc chắn nhớ rồi!
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative pt-1">
        {nextPreview && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-3 bottom-[-6px] rounded-[20px] border border-line bg-glass-subtle opacity-75"
          />
        )}

        <motion.div
          key={`${current.id}-${idx}`}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.85}
          onDragStart={() => {
            draggingRef.current = true
          }}
          onDragEnd={handleDragEnd}
          style={{ x, rotate, touchAction: 'pan-y' }}
          onClick={() => {
            if (!draggingRef.current) setFlipped((v) => !v)
          }}
          className="relative glass-panel min-h-[296px] cursor-grab active:cursor-grabbing select-none p-5 sm:p-8 flex flex-col justify-between transition hover:border-jade"
          role="button"
          tabIndex={0}
          aria-label="Lật thẻ nhớ"
        >
          <motion.span
            style={{ opacity: leftStampOpacity }}
            className="pointer-events-none absolute top-5 left-5 rounded-xl border-2 border-terracotta bg-terracotta-soft px-3 py-1 text-xs font-extrabold tracking-wider text-terracotta -rotate-12"
          >
            ÔN LẠI ↺
          </motion.span>
          <motion.span
            style={{ opacity: rightStampOpacity }}
            className="pointer-events-none absolute top-5 right-14 rounded-xl border-2 border-jade bg-jade-soft px-3 py-1 text-xs font-extrabold tracking-wider text-jade rotate-12"
          >
            ĐÃ THUỘC ✓
          </motion.span>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="soft-chip">{current.hskLevel}</span>
              <span
                className={`soft-chip text-[11px] ${
                  current.source === 'extra' ? '!bg-ochre-soft !text-ochre' : '!bg-jade-soft !text-jade'
                }`}
              >
                {current.source === 'extra' ? 'Mở rộng' : 'Trong đề'}
              </span>
              {current.pos && <span className="soft-chip !bg-glass-subtle !text-muted border border-line">{current.pos}</span>}
              {isWaitingReview && (
                <span className="soft-chip !bg-ochre-soft !text-ochre text-[10px]">Đang chờ cô duyệt</span>
              )}
            </div>
            <SpeakButton text={current.hanzi} />
          </div>

          {!flipped ? (
            <div className="my-auto py-5 text-center space-y-2.5">
              {blindAudio ? (
                <>
                  <div className="text-4xl">🎧</div>
                  <p className="text-xs text-muted">Nghe phát âm tiếng Trung và nhớ mặt chữ + nghĩa</p>
                </>
              ) : (
                <div className="hanzi hz-xl text-ink" data-testid="flashcard-hanzi">
                  {current.hanzi}
                </div>
              )}
              {!blindAudio && settings.showPinyin && (
                <div className="text-lg font-medium text-jade">{current.pinyin}</div>
              )}
              {!blindAudio && settings.showHanViet && current.hanViet && (
                <div className="inline-block rounded-full bg-ochre-soft px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-ochre">
                  Hán-Việt: {current.hanViet}
                </div>
              )}
            </div>
          ) : (
            <div className="my-auto py-4 text-center space-y-2.5">
              <div className="hanzi text-3xl font-bold text-ink">{current.hanzi}</div>
              <div className="text-base font-medium text-jade">{current.pinyin}</div>
              {current.hanViet && (
                <div className="inline-block rounded-full bg-ochre-soft px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-ochre">
                  Hán-Việt: {current.hanViet}
                </div>
              )}
              <div className="glass-subtle mx-auto max-w-md px-4 py-3 text-base font-semibold text-ink space-y-1">
                <div>{expandedMeaning ? rawMeaning : meaningInfo.short}</div>
                {meaningInfo.hasMore && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedMeaning((v) => !v)
                    }}
                    className="text-xs font-bold text-jade hover:underline"
                  >
                    {expandedMeaning ? 'Thu gọn' : 'Xem thêm nghĩa'}
                  </button>
                )}
              </div>
              {current.exampleZh && (
                <div
                  className="glass-subtle mx-auto max-w-md px-3.5 py-2.5 text-left text-xs flex items-start justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <div className="hanzi font-medium text-ink">{current.exampleZh}</div>
                    {current.exampleVi && <div className="text-muted mt-0.5">{current.exampleVi}</div>}
                  </div>
                  <SpeakButton text={current.exampleZh} size={14} />
                </div>
              )}
            </div>
          )}

          <div className="text-center text-[11px] text-muted">
            {flipped
              ? 'Quẹt Trái (Ôn lại) · Quẹt Phải (Đã thuộc) · Hoặc chọn 1–4 bên dưới'
              : 'Chạm thẻ để lật · Kéo Trái/Phải để phân loại nhanh · Phím S để nghe'}
          </div>
        </motion.div>
      </div>

      {!flipped ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void attemptSwipe('left')}
            data-testid="swipe-left-btn"
            className="glass-pill-btn min-h-11 !border-terracotta/40 !text-terracotta text-xs shrink-0"
          >
            <ArrowLeft size={14} /> Quên
          </button>
          <button type="button" onClick={() => setFlipped(true)} className="glass-pill-btn glass-primary-btn flex-1 min-h-11">
            Xem đáp án
          </button>
          <button
            type="button"
            onClick={() => void attemptSwipe('right')}
            data-testid="swipe-right-btn"
            className="glass-pill-btn min-h-11 !border-jade/40 !text-jade text-xs shrink-0"
          >
            Đã nhớ <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => handleRate(r.key)}
              className={`glass-pill-btn !rounded-2xl !h-auto flex-col py-2.5 min-h-12 ${r.tone}`}
            >
              <span className="text-xs font-bold">{r.label}</span>
              <span className="text-[10px] text-muted">{intervals[r.key]}</span>
            </button>
          ))}
        </div>
      )}

      {showWriter && <StrokeWriterStudio word={current.hanzi} />}
    </div>
  )
}
