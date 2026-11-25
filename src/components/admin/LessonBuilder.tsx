import { BookPlus, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { CustomLesson, CustomLessonGrammar, CustomLessonQuiz, CustomLessonVocab } from '../../types/lms'

interface LessonBuilderProps {
  lessons: CustomLesson[]
  onCreateLesson: (input: Omit<CustomLesson, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<void>
  onTogglePublished: (lessonId: string, published: boolean) => Promise<void>
  onDeleteLesson: (lessonId: string) => Promise<void>
}

export function LessonBuilder({
  lessons,
  onCreateLesson,
  onTogglePublished,
  onDeleteLesson,
}: LessonBuilderProps) {
  const [hskLevel, setHskLevel] = useState(1)
  const [titleZh, setTitleZh] = useState('')
  const [titlePinyin, setTitlePinyin] = useState('')
  const [titleVi, setTitleVi] = useState('')
  const [summary, setSummary] = useState('')

  const [paraZh, setParaZh] = useState('')
  const [paraPinyin, setParaPinyin] = useState('')
  const [paraVi, setParaVi] = useState('')

  const [vocabItems, setVocabItems] = useState<CustomLessonVocab[]>([])
  const [vHanzi, setVHanzi] = useState('')
  const [vPinyin, setVPinyin] = useState('')
  const [vHanViet, setVHanViet] = useState('')
  const [vPos, setVPos] = useState('Động từ')
  const [vMeaning, setVMeaning] = useState('')

  const [gTitle, setGTitle] = useState('')
  const [gPattern, setGPattern] = useState('')
  const [gExplain, setGExplain] = useState('')

  const [quizItems, setQuizItems] = useState<CustomLessonQuiz[]>([])
  const [qPrompt, setQPrompt] = useState('')
  const [qOpts, setQOpts] = useState(['', '', '', ''])
  const [qAns, setQAns] = useState(0)
  const [qExplain, setQExplain] = useState('')

  const [saving, setSaving] = useState(false)

  const addVocab = () => {
    if (!vHanzi.trim() || !vMeaning.trim()) {
      toast.error('Nhập ít nhất Chữ Hán và Nghĩa tiếng Việt cho từ mới.')
      return
    }
    setVocabItems((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}-${prev.length}`,
        hanzi: vHanzi.trim(),
        pinyin: vPinyin.trim() || '-',
        hanViet: vHanViet.trim() || '-',
        pos: vPos.trim() || 'Từ vựng',
        meaningVi: vMeaning.trim(),
      },
    ])
    setVHanzi('')
    setVPinyin('')
    setVHanViet('')
    setVMeaning('')
  }

  const addQuiz = () => {
    if (!qPrompt.trim() || qOpts.some((o) => !o.trim())) {
      toast.error('Điền câu hỏi và đủ 4 đáp án A/B/C/D trước khi thêm.')
      return
    }
    setQuizItems((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}-${prev.length}`,
        prompt: qPrompt.trim(),
        options: qOpts.map((o) => o.trim()),
        answer: qAns,
        explanationVi: qExplain.trim() || 'Đáp án đúng theo nội dung bài học.',
      },
    ])
    setQPrompt('')
    setQOpts(['', '', '', ''])
    setQExplain('')
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titleZh.trim() || !titleVi.trim()) {
      toast.error('Cần nhập Tiêu đề tiếng Trung và Tiêu đề tiếng Việt.')
      return
    }
    setSaving(true)
    try {
      const paragraphs = paraZh.trim()
        ? [{ id: `p-${Date.now()}`, zh: paraZh.trim(), pinyin: paraPinyin.trim(), vi: paraVi.trim() }]
        : []
      const grammar_notes: CustomLessonGrammar[] = gTitle.trim()
        ? [
            {
              id: `g-${Date.now()}`,
              title: gTitle.trim(),
              pattern: gPattern.trim(),
              explanationVi: gExplain.trim(),
              examples: [],
            },
          ]
        : []

      await onCreateLesson({
        hsk_level: hskLevel,
        title_zh: titleZh.trim(),
        title_pinyin: titlePinyin.trim(),
        title_vi: titleVi.trim(),
        summary: summary.trim() || `Bài học HSK ${hskLevel} do Giáo viên biên soạn.`,
        paragraphs,
        vocab_items: vocabItems,
        grammar_notes,
        quiz_items: quizItems,
        is_published: true,
      })

      toast.success('Đã xuất bản bài học mới lên hệ thống!')
      setTitleZh('')
      setTitlePinyin('')
      setTitleVi('')
      setSummary('')
      setParaZh('')
      setParaPinyin('')
      setParaVi('')
      setVocabItems([])
      setGTitle('')
      setGPattern('')
      setGExplain('')
      setQuizItems([])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BookPlus className="h-5 w-5 text-[var(--jade)]" />
          <div>
            <h2 className="text-base font-semibold text-ink">Soạn &amp; Xuất bản Bài học mới</h2>
            <p className="text-xs text-muted">
              Học viên đã duyệt sẽ học ngay bài này trong Phòng luyện, Thẻ nhớ và Quiz.
            </p>
          </div>
        </div>

        <form onSubmit={handlePublish} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-muted">
              Cấp độ HSK
              <select
                value={hskLevel}
                onChange={(e) => setHskLevel(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-2 text-sm text-ink"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    HSK {lvl}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              Tiêu đề tiếng Trung
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                placeholder="VD: 周末你打算做什么"
                className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-2 text-sm text-ink hanzi"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Phiên âm (Pinyin)
              <input
                value={titlePinyin}
                onChange={(e) => setTitlePinyin(e.target.value)}
                placeholder="VD: Zhōumò nǐ dǎsuàn zuò shénme"
                className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Tiêu đề tiếng Việt
              <input
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                placeholder="VD: Cuối tuần bạn dự định làm gì"
                className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-muted">
            Mô tả ngắn nội dung bài
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Mục tiêu ngữ pháp, từ vựng trọng tâm của bài..."
              className="mt-1 w-full rounded-xl border border-line bg-glass-strong px-3 py-2 text-sm text-ink"
            />
          </label>

          {/* Đoạn bài khóa */}
          <div className="glass-subtle rounded-2xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-ink">Đoạn bài khóa / Hội thoại mẫu (tùy chọn)</div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <textarea
                rows={2}
                value={paraZh}
                onChange={(e) => setParaZh(e.target.value)}
                placeholder="Đoạn văn tiếng Trung..."
                className="rounded-xl border border-line bg-glass-strong p-2.5 text-sm text-ink hanzi"
              />
              <textarea
                rows={2}
                value={paraPinyin}
                onChange={(e) => setParaPinyin(e.target.value)}
                placeholder="Phiên âm Pinyin..."
                className="rounded-xl border border-line bg-glass-strong p-2.5 text-sm text-ink"
              />
              <textarea
                rows={2}
                value={paraVi}
                onChange={(e) => setParaVi(e.target.value)}
                placeholder="Nghĩa tiếng Việt..."
                className="rounded-xl border border-line bg-glass-strong p-2.5 text-sm text-ink"
              />
            </div>
          </div>

          {/* Từ vựng đính kèm */}
          <div className="glass-subtle rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-ink">Từ vựng trong bài ({vocabItems.length} từ đã thêm)</div>
              <button type="button" onClick={addVocab} className="glass-pill-btn !min-h-8 !px-3 text-xs">
                <Plus size={13} /> Thêm từ vựng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <input
                value={vHanzi}
                onChange={(e) => setVHanzi(e.target.value)}
                placeholder="Chữ Hán (VD: 打算)"
                className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink hanzi"
              />
              <input
                value={vPinyin}
                onChange={(e) => setVPinyin(e.target.value)}
                placeholder="Pinyin (dǎsuàn)"
                className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
              />
              <input
                value={vHanViet}
                onChange={(e) => setVHanViet(e.target.value)}
                placeholder="Hán-Việt (đả toán)"
                className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
              />
              <input
                value={vPos}
                onChange={(e) => setVPos(e.target.value)}
                placeholder="Từ loại"
                className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
              />
              <input
                value={vMeaning}
                onChange={(e) => setVMeaning(e.target.value)}
                placeholder="Nghĩa tiếng Việt"
                className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink col-span-2 md:col-span-1"
              />
            </div>
            {vocabItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {vocabItems.map((v) => (
                  <span key={v.id} className="soft-chip">
                    <span className="hanzi font-bold">{v.hanzi}</span> ({v.meaningVi})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ngữ pháp + Câu hỏi */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-subtle rounded-2xl p-4 space-y-2">
              <div className="text-xs font-semibold text-ink">Điểm ngữ pháp chính (tùy chọn)</div>
              <input
                value={gTitle}
                onChange={(e) => setGTitle(e.target.value)}
                placeholder="Tên điểm ngữ pháp (VD: Cấu trúc 打算 + Động từ)"
                className="w-full rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
              />
              <input
                value={gPattern}
                onChange={(e) => setGPattern(e.target.value)}
                placeholder="Công thức câu..."
                className="w-full rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink hanzi"
              />
              <textarea
                rows={2}
                value={gExplain}
                onChange={(e) => setGExplain(e.target.value)}
                placeholder="Giải thích cách dùng bằng tiếng Việt..."
                className="w-full rounded-xl border border-line bg-glass-strong p-2 text-xs text-ink"
              />
            </div>

            <div className="glass-subtle rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-ink">Câu hỏi trắc nghiệm ({quizItems.length} câu đã thêm)</div>
                <button type="button" onClick={addQuiz} className="glass-pill-btn !min-h-8 !px-3 text-xs">
                  <Plus size={13} /> Thêm câu hỏi
                </button>
              </div>
              <input
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
                placeholder="Đề câu hỏi tiếng Trung / Việt..."
                className="w-full rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
              />
              <div className="grid grid-cols-2 gap-1.5">
                {qOpts.map((val, i) => (
                  <input
                    key={i}
                    value={val}
                    onChange={(e) =>
                      setQOpts((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder={`Đáp án ${['A', 'B', 'C', 'D'][i]}`}
                    className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={qAns}
                  onChange={(e) => setQAns(Number(e.target.value))}
                  className="rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
                >
                  {[0, 1, 2, 3].map((idx) => (
                    <option key={idx} value={idx}>
                      Đáp án đúng: {['A', 'B', 'C', 'D'][idx]}
                    </option>
                  ))}
                </select>
                <input
                  value={qExplain}
                  onChange={(e) => setQExplain(e.target.value)}
                  placeholder="Giải thích đáp án..."
                  className="flex-1 rounded-xl border border-line bg-glass-strong px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="glass-pill-btn glass-primary-btn">
              <BookPlus size={15} /> {saving ? 'Đang lưu lên Supabase...' : 'Xuất bản bài học mới'}
            </button>
          </div>
        </form>
      </section>

      {/* Danh sách bài học đã tạo */}
      <section className="glass-panel rounded-3xl p-5 space-y-3">
        <h2 className="text-base font-semibold text-ink">Kho bài học riêng của lớp ({lessons.length} bài)</h2>
        <div className="space-y-2">
          {lessons.map((l) => (
            <div key={l.id} className="glass-subtle rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="soft-chip !bg-periwinkle-soft !text-periwinkle">HSK {l.hsk_level}</span>
                  <span className="hanzi font-bold text-sm text-ink">{l.title_zh}</span>
                  <span className="text-xs text-muted">· {l.title_vi}</span>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {l.vocab_items.length} từ vựng · {l.grammar_notes.length} ngữ pháp · {l.quiz_items.length} câu hỏi
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Link to={`/lessons/${l.id}`} className="glass-pill-btn !min-h-8 !px-3 text-xs">
                  Xem bài
                </Link>
                <button
                  type="button"
                  onClick={() => void onTogglePublished(l.id, !l.is_published)}
                  className="glass-pill-btn !min-h-8 !px-3 text-xs"
                >
                  {l.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
                  {l.is_published ? 'Đang mở' : 'Đang ẩn'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onDeleteLesson(l.id)
                    toast.info('Đã xóa bài học')
                  }}
                  className="glass-pill-btn !min-h-8 !px-2.5 text-xs !text-terracotta"
                  aria-label="Xóa bài học"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {lessons.length === 0 && (
            <p className="text-xs text-muted py-6 text-center">Chưa có bài học nào do giáo viên tạo.</p>
          )}
        </div>
      </section>
    </div>
  )
}
