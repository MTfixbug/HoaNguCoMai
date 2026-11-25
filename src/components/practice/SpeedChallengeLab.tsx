import { Flame, Play, RotateCcw, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AntiStreakTracker, generateMCQOptions, shuffleArray } from '../../lib/randomizer'
import type { DictEntry } from '../../types/vocab'

interface SpeedChallengeLabProps {
  pool: DictEntry[]
  leaderboardOptIn: boolean
  currentUserId?: string
  profiles: Array<{ id: string; full_name: string; xp_points?: number; streak_days?: number; role: string }>
  onFinishRound: (score: number, accuracyPct: number, itemsCompleted: number) => void
}

const HIGH_SCORE_KEY = 'hsk_speed_60s_best_v1'

export function SpeedChallengeLab({
  pool,
  leaderboardOptIn,
  currentUserId,
  profiles,
  onFinishRound,
}: SpeedChallengeLabProps) {
  const corePool = useMemo(() => {
    const core = pool.filter((w) => w.source !== 'extra')
    return core.length >= 8 ? core : pool
  }, [pool])

  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [hits, setHits] = useState(0)
  const [idx, setIdx] = useState(0)
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEY) || '0') || 0
    } catch {
      return 0
    }
  })

  const questions = useMemo(() => {
    if (corePool.length < 4) return []
    const tracker = new AntiStreakTracker()
    const picked = shuffleArray(corePool).slice(0, 60)
    return picked.map((w) => ({ word: w, ...generateMCQOptions(w, corePool, 4, tracker) }))
  }, [corePool, running])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false)
          setFinished(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!finished) return
    const acc = attempts > 0 ? Math.round((hits / attempts) * 100) : 0
    if (score > bestScore) {
      setBestScore(score)
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score))
      } catch {
        // ignore storage
      }
    }
    if (attempts > 0) {
      onFinishRound(score, acc, attempts)
    }
  }, [finished])

  const startGame = () => {
    setScore(0)
    setCombo(0)
    setAttempts(0)
    setHits(0)
    setIdx(0)
    setTimeLeft(60)
    setFinished(false)
    setRunning(true)
  }

  const current = questions[idx % Math.max(1, questions.length)]

  const pickOption = (optIdx: number) => {
    if (!running || !current) return
    const ok = optIdx === current.correctIndex
    setAttempts((a) => a + 1)
    if (ok) {
      const nextCombo = combo + 1
      setCombo(nextCombo)
      setHits((h) => h + 1)
      setScore((s) => s + 10 + Math.min(20, nextCombo * 2))
    } else {
      setCombo(0)
    }
    setIdx((i) => i + 1)
  }

  const rankedPeers = useMemo(() => {
    if (!leaderboardOptIn) return []
    return [...profiles]
      .filter((p) => p.role === 'student')
      .sort((a, b) => (b.xp_points ?? 0) - (a.xp_points ?? 0))
      .slice(0, 6)
  }, [leaderboardOptIn, profiles])

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Flame size={18} className="text-ochre" /> Thử thách phản xạ 60 giây
            </h2>
            <p className="text-xs text-muted">Chọn nhanh nghĩa tiếng Việt đúng · Combo liên tiếp cộng thêm XP!</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
            <span className="rounded-xl bg-ochre/15 px-3 py-1.5 text-ochre">Kỷ lục: {bestScore} đ</span>
            <span className="rounded-xl bg-jade/15 px-3 py-1.5 text-jade">⏱ {timeLeft}s</span>
          </div>
        </div>

        {!running && !finished && (
          <button
            type="button"
            disabled={corePool.length < 4}
            onClick={startGame}
            className="glass-pill-btn glass-primary-btn w-full min-h-12 text-sm"
          >
            <Play size={16} /> Bắt đầu thử thách 60s
          </button>
        )}

        {running && current && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-jade">Điểm: {score}</span>
              <span className="text-ochre">{combo > 1 ? `Combo x${combo} 🔥` : 'Giữ nhịp nào!'}</span>
              <span className="text-muted">Đúng {hits}/{attempts}</span>
            </div>

            <div className="glass-subtle rounded-2xl p-6 text-center space-y-1">
              <div className="hanzi text-4xl font-bold text-ink">{current.word.hanzi}</div>
              <div className="text-sm text-jade">{current.word.pinyin}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {current.options.map((opt, oi) => (
                <button
                  key={`${current.word.id}-${opt.id}-${oi}`}
                  type="button"
                  onClick={() => pickOption(oi)}
                  className="glass-pill-btn min-h-12 justify-start text-left px-4 py-3 text-sm"
                >
                  {opt.meaningVi.split(';')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {finished && (
          <div className="glass-subtle rounded-2xl p-5 text-center space-y-3">
            <div className="text-lg font-bold text-ink">Hết giờ! Đạt {score} điểm 🎉</div>
            <div className="text-xs text-muted">
              Trả lời đúng {hits}/{attempts} câu ({attempts > 0 ? Math.round((hits / attempts) * 100) : 0}%)
            </div>
            <button type="button" onClick={startGame} className="glass-pill-btn glass-primary-btn min-h-11 px-6 text-xs">
              <RotateCcw size={15} /> Chơi lại vòng mới
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel p-5 space-y-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Trophy size={16} className="text-ochre" /> Bảng xếp hạng lớp (tự chọn tham gia)
        </h3>
        {!leaderboardOptIn ? (
          <p className="text-xs text-muted">
            Bạn đang tắt chia sẻ bảng xếp hạng. Bật tùy chọn “Tham gia bảng xếp hạng lớp” trong Cài đặt để xem thứ hạng cùng bạn học.
          </p>
        ) : (
          <div className="space-y-2">
            {rankedPeers.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                  p.id === currentUserId ? 'bg-jade/15 font-bold text-ink' : 'bg-glass-subtle text-ink'
                }`}
              >
                <span>
                  #{idx + 1} · {p.full_name} {p.id === currentUserId ? '(Bạn)' : ''}
                </span>
                <span className="tabular-nums text-jade font-bold">
                  {p.xp_points ?? 0} XP · 🔥 {p.streak_days ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
