import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { BookOpen, ChevronRight, Grid2X2, Keyboard, ListOrdered, Music2, RotateCw, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DictationLab from '../components/lab/DictationLab'
import ToneTrainerLab from '../components/lab/ToneTrainerLab'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import { usePetReaction } from '../hooks/PetReactionContext'
import { SessionDeckQueue, shuffleArray } from '../lib/randomizer'
import { speak } from '../lib/tts'
import type { DictEntry } from '../types/vocab'

type LabTab = 'tone' | 'dictation' | 'match' | 'reorder' | 'courses'

function SpeedMatchLab({ pool, level }: { pool: DictEntry[]; level: number }) {
  const { settings, recentIds, recordQuizOutcome, recordStudySession } = useLms()
  const { triggerReaction } = usePetReaction()
  const queueRef = useRef<SessionDeckQueue<DictEntry> | null>(null)
  const [round, setRound] = useState(1)

  const uniquePool = useMemo(() => {
    const seenH = new Set<string>()
    const seenM = new Set<string>()
    return pool.filter((w) => {
      const h = w.hanzi.trim()
      const m = w.meaningVi.trim().toLowerCase()
      if (!h || !m || seenH.has(h) || seenM.has(m)) return false
      seenH.add(h)
      seenM.add(m)
      return true
    })
  }, [pool])

  useEffect(() => {
    queueRef.current = new SessionDeckQueue(uniquePool, recentIds)
    setRound((r) => r + 1)
  }, [uniquePool])

  const pairs = useMemo(() => {
    const q = queueRef.current ?? new SessionDeckQueue(uniquePool, recentIds)
    queueRef.current = q
    return q.nextBatch(6)
  }, [uniquePool, round])

  const left = useMemo(() => shuffleArray(pairs), [pairs])
  const right = useMemo(() => shuffleArray(pairs), [pairs])

  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<[string, string] | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [startMs, setStartMs] = useState(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setSelL(null)
    setSelR(null)
    setMatched(new Set())
    setWrong(null)
    setMistakes(0)
    setStartMs(Date.now())
    setElapsedMs(0)
    setDone(false)
  }, [pairs])

  useEffect(() => {
    if (done || !pairs.length) return
    const id = window.setInterval(() => setElapsedMs(Date.now() - startMs), 100)
    return () => window.clearInterval(id)
  }, [done, startMs, pairs.length])

  useEffect(() => {
    if (!selL || !selR) return
    if (selL === selR) {
      const item = pairs.find((p) => p.id === selL)
      if (item) speak(item.hanzi, { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI })
      const next = new Set(matched)
      next.add(selL)
      setMatched(next)
      setSelL(null)
      setSelR(null)
      triggerReaction('correct', { message: 'Ghép chuẩn rồi!', xpDelta: 3 })
      if (next.size === pairs.length && pairs.length > 0) {
        const finalMs = Date.now() - startMs
        setElapsedMs(finalMs)
        setDone(true)
        const acc = Math.max(40, Math.round(((pairs.length - mistakes) / pairs.length) * 100))
        recordStudySession('match', level, Math.max(5, Math.round(finalMs / 1000)), pairs.length, acc)
        triggerReaction('combo', { message: 'Hoàn thành siêu tốc!', xpDelta: 15, combo: 4 })
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.65 } })
      }
    } else {
      setWrong([selL, selR])
      setMistakes((m) => m + 1)
      recordQuizOutcome(selL, level, false)
      triggerReaction('wrong', { message: 'Chưa khớp cặp này!' })
      const t = window.setTimeout(() => {
        setWrong(null)
        setSelL(null)
        setSelR(null)
      }, 400)
      return () => window.clearTimeout(t)
    }
  }, [selL, selR])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="soft-chip">
          <Timer size={13} /> {(elapsedMs / 1000).toFixed(1)} giây · Nhầm: {mistakes}
        </span>
        <button type="button" onClick={() => setRound((r) => r + 1)} className="glass-pill-btn glass-primary-btn !min-h-9 !px-3 text-xs">
          <RotateCw size={14} /> Bộ 6 cặp mới
        </button>
      </div>

      {done ? (
        <div className="glass-panel p-8 text-center space-y-3">
          <div className="text-4xl">⚡</div>
          <h3 className="text-xl font-bold">Hoàn thành trong {(elapsedMs / 1000).toFixed(2)} giây!</h3>
          <p className="text-sm text-muted">Số lần chọn nhầm: {mistakes}</p>
          <button type="button" onClick={() => setRound((r) => r + 1)} className="glass-pill-btn glass-primary-btn">
            Chơi lượt tiếp theo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {left.map((t) => {
              const isDone = matched.has(t.id)
              const active = selL === t.id
              const isW = wrong?.[0] === t.id
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  disabled={isDone}
                  animate={isDone ? { opacity: 0.2, scale: 0.92 } : isW ? { x: [-5, 5, -3, 3, 0] } : { opacity: 1, scale: active ? 1.02 : 1 }}
                  onClick={() => !isDone && !wrong && setSelL(active ? null : t.id)}
                  className={`w-full rounded-2xl border p-3.5 text-center transition cursor-pointer ${
                    isW
                      ? 'border-terracotta bg-terracotta-soft text-terracotta'
                      : active
                        ? 'border-jade bg-jade-soft text-jade'
                        : 'border-line bg-glass-subtle hover:border-jade'
                  }`}
                >
                  <div className="hanzi text-lg font-bold text-ink">{t.hanzi}</div>
                  {settings.showPinyin && <div className="text-xs text-muted">{t.pinyin}</div>}
                </motion.button>
              )
            })}
          </div>
          <div className="space-y-2">
            {right.map((t) => {
              const isDone = matched.has(t.id)
              const active = selR === t.id
              const isW = wrong?.[1] === t.id
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  disabled={isDone}
                  animate={isDone ? { opacity: 0.2, scale: 0.92 } : isW ? { x: [-5, 5, -3, 3, 0] } : { opacity: 1, scale: active ? 1.02 : 1 }}
                  onClick={() => !isDone && !wrong && setSelR(active ? null : t.id)}
                  className={`flex min-h-[68px] w-full items-center justify-center rounded-2xl border p-3 text-center text-xs sm:text-sm transition cursor-pointer ${
                    isW
                      ? 'border-terracotta bg-terracotta-soft text-terracotta'
                      : active
                        ? 'border-jade bg-jade-soft text-jade font-semibold'
                        : 'border-line bg-glass-subtle hover:border-jade'
                  }`}
                >
                  <span className="line-clamp-3 text-ink">{t.meaningVi}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SentenceReorderLab({ pool, level }: { pool: DictEntry[]; level: number }) {
  const { customLessons, recordStudySession } = useLms()
  const samples = useMemo(() => {
    const out: Array<{ id: string; tokens: string[]; target: string; vi: string }> = []
    for (const l of customLessons.filter((x) => x.is_published && x.hsk_level === level)) {
      for (const p of l.paragraphs) {
        const clean = p.zh.replace(/[，。！？、“”：]/g, '').trim()
        const chunks = clean.length >= 6 && clean.length <= 24 ? clean.match(/.{2,4}/g) ?? [] : []
        if (chunks.length >= 3 && chunks.length <= 7) {
          out.push({ id: `${l.id}-${p.id}-${out.length}`, tokens: chunks, target: chunks.join(''), vi: p.vi })
        }
      }
    }
    for (const w of pool) {
      if (!w.exampleZh || !w.exampleVi) continue
      const clean = w.exampleZh.replace(/[，。！？、“”：]/g, '').trim()
      const chunks = clean.length >= 6 && clean.length <= 24 ? clean.match(/.{2,4}/g) ?? [] : []
      if (chunks.length >= 3 && chunks.length <= 7) {
        out.push({ id: `${w.id}-${out.length}`, tokens: chunks, target: chunks.join(''), vi: w.exampleVi })
        if (out.length >= 40) break
      }
    }
    return shuffleArray(out)
  }, [customLessons, pool, level])

  const [idx, setIdx] = useState(0)
  const [pickedIndices, setPickedIndices] = useState<number[]>([])
  const [checked, setChecked] = useState(false)

  const cur = samples[idx % Math.max(1, samples.length)]
  const scrambled = useMemo(() => {
    if (!cur) return []
    return shuffleArray(cur.tokens.map((txt, origIdx) => ({ txt, origIdx })))
  }, [cur?.id])

  if (!cur) return <div className="glass-panel p-6 text-sm text-muted">Đang chuẩn bị bài tập sắp xếp câu...</div>

  const assembled = pickedIndices.map((i) => scrambled[i]?.txt ?? '').join('')
  const isOk = assembled === cur.target

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">Sắp xếp trật tự câu (连词成句)</h2>
          <p className="text-xs text-muted">Nghĩa tiếng Việt: {cur.vi}</p>
        </div>
        <span className="soft-chip">Câu {(idx % samples.length) + 1} / {samples.length}</span>
      </div>

      <div className="glass-subtle min-h-[58px] p-3 flex flex-wrap gap-2 items-center">
        {pickedIndices.length === 0 ? (
          <span className="text-xs text-muted">Bấm vào các mảnh ghép bên dưới theo đúng trật tự câu...</span>
        ) : (
          pickedIndices.map((sIdx, pos) => (
            <button
              key={`${sIdx}-${pos}`}
              type="button"
              disabled={checked}
              onClick={() => setPickedIndices((p) => p.filter((_, i) => i !== pos))}
              className="glass-pill-btn !min-h-9 !px-3 hanzi text-sm !border-jade !bg-jade-soft !text-jade"
            >
              {scrambled[sIdx].txt}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {scrambled.map((tok, sIdx) => {
          const used = pickedIndices.includes(sIdx)
          return (
            <button
              key={sIdx}
              type="button"
              disabled={used || checked}
              onClick={() => setPickedIndices((p) => [...p, sIdx])}
              className={`glass-pill-btn !min-h-9 !px-3 hanzi text-sm ${used ? 'opacity-30' : ''}`}
            >
              {tok.txt}
            </button>
          )
        })}
      </div>

      {!checked ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pickedIndices.length < scrambled.length}
            onClick={() => {
              setChecked(true)
              recordStudySession('grammar', level, 30, 1, assembled === cur.target ? 100 : 0)
            }}
            className="glass-pill-btn glass-primary-btn"
          >
            Kiểm tra đáp án
          </button>
          <button type="button" onClick={() => setPickedIndices([])} className="glass-pill-btn">
            Làm lại
          </button>
        </div>
      ) : (
        <div className="glass-subtle p-3.5 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className={`font-bold ${isOk ? 'text-moss' : 'text-terracotta'}`}>
            {isOk ? 'Hoàn toàn chính xác!' : `Thứ tự đúng: ${cur.target}`}
          </div>
          <button
            type="button"
            onClick={() => {
              setChecked(false)
              setPickedIndices([])
              setIdx((i) => i + 1)
            }}
            className="glass-pill-btn glass-primary-btn"
          >
            Câu tiếp theo
          </button>
        </div>
      )}
    </div>
  )
}

export default function LabPage() {
  const { profile } = useAuth()
  const { customLessons, loadLevelVocab } = useLms()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: LabTab =
    rawTab === 'tone' || rawTab === 'dictation' || rawTab === 'match' || rawTab === 'reorder' || rawTab === 'courses'
      ? rawTab
      : 'tone'

  const setTab = (next: LabTab) => {
    setSearchParams({ tab: next }, { replace: true })
  }

  const activeLevel = Math.max(1, profile?.current_hsk_level || 1)
  const [pool, setPool] = useState<DictEntry[]>([])

  useEffect(() => {
    let alive = true
    loadLevelVocab(activeLevel).then((rows) => alive && setPool(rows))
    return () => {
      alive = false
    }
  }, [activeLevel, loadLevelVocab])

  const stageLessons = useMemo(
    () => customLessons.filter((l) => l.is_published && l.hsk_level === activeLevel),
    [customLessons, activeLevel],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Link to="/flashcards" className="glass-pill-btn !min-h-8 !px-3.5 text-xs">
            Thẻ từ HSK {activeLevel}
          </Link>
          <Link to="/quiz" className="glass-pill-btn !min-h-8 !px-3.5 text-xs">
            Trắc nghiệm
          </Link>
          <Link to="/lab" className="glass-pill-btn glass-primary-btn !min-h-8 !px-3.5 text-xs">
            Phòng luyện &amp; Bài của Cô
          </Link>
        </div>
        <span className="soft-chip">Lộ trình: Chặng HSK {activeLevel}</span>
      </div>

      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { k: 'tone' as const, label: 'Luyện Thanh Điệu', icon: Music2 },
            { k: 'dictation' as const, label: 'Nghe – Gõ Pinyin', icon: Keyboard },
            { k: 'match' as const, label: 'Ghép cặp siêu tốc', icon: Grid2X2 },
            { k: 'reorder' as const, label: 'Sắp xếp câu', icon: ListOrdered },
            { k: 'courses' as const, label: `Bài của Cô (${stageLessons.length})`, icon: BookOpen },
          ].map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`glass-pill-btn !min-h-9 !px-3 text-xs ${tab === k ? 'glass-primary-btn' : ''}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tone' && <ToneTrainerLab pool={pool} level={activeLevel} />}

      {tab === 'dictation' && <DictationLab pool={pool} level={activeLevel} />}

      {tab === 'match' && (
        <div className="glass-panel p-4 space-y-3">
          <h2 className="text-sm font-bold text-ink">Ghép nhanh Chữ Hán ↔ Nghĩa (HSK {activeLevel})</h2>
          {pool.length > 0 && <SpeedMatchLab pool={pool} level={activeLevel} />}
        </div>
      )}

      {tab === 'reorder' && <SentenceReorderLab pool={pool} level={activeLevel} />}

      {tab === 'courses' && (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {stageLessons.map((l, idx) => (
            <li key={l.id} className="min-w-0">
              <Link
                to={`/lessons/${l.id}`}
                className="glass-panel flex w-full min-w-0 items-center gap-3 overflow-hidden p-3.5 hover:border-jade transition"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-jade-soft font-bold text-jade text-sm">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="hanzi block truncate font-bold text-sm text-ink">{l.title_zh}</span>
                  <span className="block truncate text-xs text-muted">
                    {l.title_vi} · {l.vocab_items.length} từ mới
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted shrink-0" />
              </Link>
            </li>
          ))}
          {stageLessons.length === 0 && (
            <li className="glass-panel p-8 text-center text-sm text-muted sm:col-span-2">
              Hiện chưa có bài học riêng ở chặng HSK {activeLevel}. Bạn có thể luyện Ghép cặp hoặc Sắp xếp câu ngay bên trên.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
