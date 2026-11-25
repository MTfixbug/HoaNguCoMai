import { Dices, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QuizRunner, { buildQuizQuestions, type QuizMode } from '../components/quiz/QuizRunner'
import { useAuth } from '../hooks/AuthContext'
import { useLms } from '../hooks/LmsContext'
import type { DictEntry } from '../types/vocab'

export default function QuizPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const { customLessons, assignments, loadLevelVocab, progressMap, recentIds } = useLms()

  const assignmentId = params.get('assignment') ?? undefined
  const activeAssignment = assignmentId ? assignments.find((a) => a.id === assignmentId) : undefined

  const activeLevel = activeAssignment?.config.hskLevel ?? Math.max(1, profile?.current_hsk_level || 1)
  const defaultCount = activeAssignment?.config.itemCount ?? (Number(params.get('count')) || 10)

  const [mode, setMode] = useState<QuizMode>(
    () => (activeAssignment?.config.quizMode as QuizMode) || (params.get('mode') as QuizMode) || 'mix',
  )
  const [count, setCount] = useState<number>(defaultCount)
  const [timedRush, setTimedRush] = useState(false)
  const [vocabPool, setVocabPool] = useState<DictEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [seed, setSeed] = useState(1)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadLevelVocab(activeLevel)
      .then((rows) => {
        if (alive) {
          setVocabPool(rows)
          setLoading(false)
        }
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [activeLevel, loadLevelVocab])

  const stageLessons = useMemo(
    () => customLessons.filter((l) => l.is_published && l.hsk_level === activeLevel),
    [customLessons, activeLevel],
  )

  const questions = useMemo(
    () =>
      buildQuizQuestions({
        vocabPool,
        customLessons: stageLessons,
        mode,
        count,
        progressMap,
        recentIds,
      }),
    [vocabPool, stageLessons, mode, count, seed],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Link to="/flashcards" className="glass-pill-btn !min-h-8 !px-3.5 text-xs">
            Thẻ từ HSK {activeLevel}
          </Link>
          <Link to="/quiz" className="glass-pill-btn glass-primary-btn !min-h-8 !px-3.5 text-xs">
            Trắc nghiệm
          </Link>
          <Link to="/lab" className="glass-pill-btn !min-h-8 !px-3.5 text-xs">
            Ghép cặp &amp; Bài của Cô
          </Link>
        </div>
        <span className="soft-chip">Lộ trình: Chặng HSK {activeLevel}</span>
      </div>

      {activeAssignment && (
        <div className="glass-panel p-3.5 border-jade/40 bg-jade-soft text-xs">
          <strong className="text-jade">Nhiệm vụ Cô giao:</strong> {activeAssignment.title} ({defaultCount} câu)
        </div>
      )}

      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            aria-label="Dạng bài tập"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as QuizMode)
              setSeed((s) => s + 1)
            }}
            className="glass-subtle px-3 py-2 font-semibold outline-none"
          >
            <option value="mix">Tổng hợp (HSK {activeLevel})</option>
            <option value="zh_to_vi">Chữ Hán → Nghĩa Việt</option>
            <option value="vi_to_zh">Nghĩa Việt → Chữ Hán</option>
            <option value="audio">Nghe → Chọn chữ Hán</option>
            <option value="pinyin">Pinyin → Chọn chữ Hán</option>
            <option value="cloze">Điền từ vào câu</option>
            {stageLessons.some((l) => l.quiz_items.length > 0) && (
              <option value="class_quiz">Bài tập riêng của Cô</option>
            )}
          </select>

          <select
            aria-label="Số lượng câu"
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value))
              setSeed((s) => s + 1)
            }}
            className="glass-subtle px-3 py-2 font-semibold outline-none"
          >
            <option value={10}>10 câu</option>
            <option value={20}>20 câu</option>
            <option value={30}>30 câu</option>
            <option value={50}>50 câu</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTimedRush((v) => !v)}
            className={`glass-pill-btn !min-h-9 !px-3 text-xs ${timedRush ? '!border-terracotta !bg-terracotta-soft !text-terracotta' : ''}`}
          >
            <Timer size={14} /> {timedRush ? 'Đếm 12 giây: BẬT' : 'Không giới hạn giờ'}
          </button>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="glass-pill-btn glass-primary-btn !min-h-9 !px-3.5 text-xs"
          >
            <Dices size={14} /> Bộ câu hỏi mới
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-8 text-center text-sm text-muted">Đang tạo bộ câu hỏi HSK {activeLevel}...</div>
      ) : (
        <QuizRunner
          key={`${activeLevel}-${mode}-${count}-${seed}`}
          questions={questions}
          scopeLevel={activeLevel}
          timedRush={timedRush}
          assignmentId={assignmentId}
          onRestart={() => setSeed((s) => s + 1)}
        />
      )}
    </div>
  )
}
