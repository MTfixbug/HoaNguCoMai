import { ArrowRight, CheckCircle2, Compass, GraduationCap, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { loadVocabChunk, levelToChunkKey } from '../../lib/dataLoader'
import { generateMCQOptions, shuffleArray } from '../../lib/randomizer'

interface PlacementQ {
  level: number
  hanzi: string
  pinyin: string
  options: string[]
  correctIndex: number
}

const LEVELS_CURRENT = [
  { v: 0, label: 'Chưa biết gì (Mới bắt đầu)', desc: 'Làm quen từ chữ Hán & thanh điệu cơ bản' },
  { v: 1, label: 'HSK 1', desc: 'Biết ~500 từ vựng giao tiếp đơn giản' },
  { v: 2, label: 'HSK 2', desc: 'Giao tiếp tình huống hằng ngày cơ bản' },
  { v: 3, label: 'HSK 3', desc: 'Đọc hiểu & trò chuyện đời sống tự nhiên' },
  { v: 4, label: 'HSK 4', desc: 'Trao đổi công việc & học tập độc lập' },
  { v: 5, label: 'HSK 5', desc: 'Đọc báo chí, hiểu hội thoại dài' },
  { v: 6, label: 'HSK 6', desc: 'Sử dụng thành thạo tiếng Trung nâng cao' },
  { v: 7, label: 'HSK 7–9', desc: 'Nghiên cứu chuyên sâu học thuật' },
]

const LEVELS_TARGET = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function OnboardingWizard({
  studentName,
  onComplete,
}: {
  studentName: string
  onComplete: (currentLevel: number, targetLevel: number, dailyMinutes: number) => Promise<void>
}) {
  const [step, setStep] = useState<'current' | 'quiz' | 'target'>('current')
  const [currentLevel, setCurrentLevel] = useState<number>(0)
  const [targetLevel, setTargetLevel] = useState<number>(4)
  const [dailyMinutes, setDailyMinutes] = useState<number>(20)
  const [saving, setSaving] = useState(false)

  // Trắc nghiệm xếp lớp nhanh 8 câu trải đều HSK 1 -> HSK 6
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<PlacementQ[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [hitsByLevel, setHitsByLevel] = useState<number[]>([])

  const startPlacementQuiz = async () => {
    setQuizLoading(true)
    try {
      const targetLevels = [1, 1, 2, 3, 4, 5, 6, 6]
      const chunks = await Promise.all([1, 2, 3, 4, 5, 6].map((l) => loadVocabChunk(levelToChunkKey(l))))
      const built: PlacementQ[] = []

      for (const lvl of targetLevels) {
        const pool = chunks[lvl - 1] ?? []
        const picked = shuffleArray(pool)[0]
        if (!picked) continue
        const { options, correctIndex } = generateMCQOptions(picked, pool, 4)
        built.push({
          level: lvl,
          hanzi: picked.hanzi,
          pinyin: picked.pinyin,
          options: options.map((o) => o.meaningVi),
          correctIndex,
        })
      }
      setQuizQuestions(built)
      setQIdx(0)
      setHitsByLevel([])
      setStep('quiz')
    } catch {
      toast.error('Không tải được bộ câu hỏi xếp lớp.')
    } finally {
      setQuizLoading(false)
    }
  }

  const handleAnswerPlacement = (optIdx: number) => {
    const q = quizQuestions[qIdx]
    if (!q) return
    const nextHits = optIdx === q.correctIndex ? [...hitsByLevel, q.level] : [...hitsByLevel]
    setHitsByLevel(nextHits)
    if (qIdx + 1 < quizQuestions.length) {
      setQIdx((i) => i + 1)
    } else {
      const highestPass = nextHits.length === 0 ? 0 : Math.min(6, Math.round(nextHits.reduce((a, b) => a + b, 0) / nextHits.length + 0.3))
      setCurrentLevel(highestPass)
      setTargetLevel(Math.max(highestPass + 1, Math.min(9, highestPass + 2)))
      toast.success(`Đánh giá nhanh: Trình độ hiện tại đề xuất là ${highestPass === 0 ? 'Mới bắt đầu' : `HSK ${highestPass}`}`)
      setStep('target')
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      await onComplete(currentLevel, Math.max(1, Math.max(currentLevel, targetLevel)), dailyMinutes)
      toast.success('Đã lưu lộ trình học tập riêng của bạn!')
    } finally {
      setSaving(false)
    }
  }

  const stages = Array.from(
    { length: Math.max(1, targetLevel - currentLevel + (currentLevel === 0 ? 0 : 1)) },
    (_, i) => (currentLevel === 0 ? i + 1 : currentLevel + i),
  ).filter((lvl) => lvl <= 9)

  return (
    <div className="relative min-h-dvh flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-jade-soft text-jade">
            <Compass size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Hoa Ngữ Cô Mai · Lộ trình của {studentName}</h1>
            <p className="text-xs text-muted">
              Chọn trình độ hiện tại và cấp độ HSK mục tiêu để hệ thống cá nhân hóa bài học cho bạn
            </p>
          </div>
        </div>

        {step === 'current' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Bước 1: Trình độ tiếng Trung hiện tại của bạn?</h2>
              <button
                type="button"
                disabled={quizLoading}
                onClick={() => void startPlacementQuiz()}
                className="glass-pill-btn !min-h-8 !px-3 text-xs !border-periwinkle !bg-periwinkle-soft !text-periwinkle"
              >
                <Sparkles size={13} /> {quizLoading ? 'Đang tạo đề...' : 'Làm test xếp lớp nhanh (8 câu)'}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {LEVELS_CURRENT.map((item) => (
                <button
                  key={item.v}
                  type="button"
                  onClick={() => {
                    setCurrentLevel(item.v)
                    if (targetLevel <= item.v) setTargetLevel(Math.min(9, Math.max(1, item.v + 1)))
                  }}
                  className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                    currentLevel === item.v
                      ? 'border-jade bg-jade-soft'
                      : 'border-line bg-glass-subtle hover:border-jade'
                  }`}
                >
                  <div className="text-sm font-bold text-ink">{item.label}</div>
                  <div className="text-xs text-muted mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setStep('target')} className="glass-pill-btn glass-primary-btn">
                Tiếp tục chọn Mục tiêu <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 'quiz' && quizQuestions[qIdx] && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Kiểm tra xếp lớp nhanh · Câu {qIdx + 1}/{quizQuestions.length}</span>
              <span className="soft-chip">Cấp thử: HSK {quizQuestions[qIdx].level}</span>
            </div>
            <div className="glass-subtle p-5 text-center space-y-1">
              <div className="hanzi text-3xl font-bold">{quizQuestions[qIdx].hanzi}</div>
              <div className="text-xs text-jade">{quizQuestions[qIdx].pinyin}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {quizQuestions[qIdx].options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAnswerPlacement(idx)}
                  className="glass-pill-btn !rounded-2xl !justify-start text-left text-xs py-3"
                >
                  <span className="font-bold mr-1.5">{['A', 'B', 'C', 'D'][idx]}.</span> {opt}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep('current')} className="text-xs text-muted hover:text-ink">
              ← Quay lại tự chọn trình độ
            </button>
          </div>
        )}

        {step === 'target' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold">Bước 2: Bạn muốn học lên đến trình độ nào?</h2>
              <p className="text-xs text-muted mt-0.5">
                Trình độ hiện tại đang chọn: <strong>{currentLevel === 0 ? 'Mới bắt đầu' : `HSK ${currentLevel}`}</strong>
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {LEVELS_TARGET.map((lvl) => {
                const disabled = lvl < Math.max(1, currentLevel)
                return (
                  <button
                    key={lvl}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTargetLevel(lvl)}
                    className={`glass-pill-btn !rounded-2xl text-xs ${
                      targetLevel === lvl ? 'glass-primary-btn' : ''
                    }`}
                  >
                    {lvl >= 7 ? `HSK ${lvl}` : `HSK ${lvl}`}
                  </button>
                )
              })}
            </div>

            <label className="block text-xs font-semibold text-muted">
              Mục tiêu thời gian học mỗi ngày
              <select
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-2 text-sm text-ink outline-none"
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>{m} phút / ngày</option>
                ))}
              </select>
            </label>

            <div className="glass-subtle p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-jade">
                <GraduationCap size={15} /> Lộ trình từng chặng dự kiến của bạn:
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="soft-chip">{currentLevel === 0 ? 'Mới bắt đầu' : `Hiện tại: HSK ${currentLevel}`}</span>
                {stages.map((st) => (
                  <span key={st} className="inline-flex items-center gap-1">
                    <ArrowRight size={12} className="text-muted" />
                    <span className={`soft-chip ${st === targetLevel ? '!bg-moss-soft !text-moss font-bold' : ''}`}>
                      Chặng HSK {st}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setStep('current')} className="glass-pill-btn">
                Quay lại
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleFinish()}
                className="glass-pill-btn glass-primary-btn"
              >
                <CheckCircle2 size={16} /> {saving ? 'Đang lưu...' : 'Xác nhận lộ trình & Vào học'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
