import { useMemo, useState } from 'react'
import { Download, PlusCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { buildGradebookCsv } from '../../lib/lmsStore'
import type {
  Assignment,
  AssignmentSubmission,
  AssignmentTargetType,
  CustomLesson,
  UserProfile,
} from '../../types/lms'

interface AssignmentManagerProps {
  profiles: UserProfile[]
  customLessons: CustomLesson[]
  assignments: Assignment[]
  submissions: AssignmentSubmission[]
  onCreateAssignment: (input: Omit<Assignment, 'id' | 'created_by' | 'created_at'>) => Promise<void>
  onGradeSubmission: (submissionId: string, score: number, feedback: string) => Promise<void>
}

export function AssignmentManager({
  profiles,
  customLessons,
  assignments,
  submissions,
  onCreateAssignment,
  onGradeSubmission,
}: AssignmentManagerProps) {
  const students = useMemo(
    () => profiles.filter((p) => p.role === 'student' && p.account_status === 'approved'),
    [profiles],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetType, setTargetType] = useState<AssignmentTargetType>('vocab_pack')
  const [hskLevel, setHskLevel] = useState<number>(1)
  const [itemCount, setItemCount] = useState<number>(20)
  const [quizMode, setQuizMode] = useState<string>('mix')
  const [examMode, setExamMode] = useState<'full' | 'section'>('full')
  const [lessonId, setLessonId] = useState<string>(customLessons[0]?.id ?? '')
  const [requiredWordsInput, setRequiredWordsInput] = useState('')
  const [passScore, setPassScore] = useState<number>(80)
  const [dueDays, setDueDays] = useState<number>(5)
  const [assignScope, setAssignScope] = useState<'all' | 'selected'>('all')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({})

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề bài giao')
      return
    }
    if (assignScope === 'selected' && selectedStudentIds.length === 0) {
      toast.error('Hãy chọn ít nhất 1 học viên hoặc chọn Cả lớp')
      return
    }
    if (targetType === 'lesson' && !lessonId) {
      toast.error('Chưa có bài học nào để chỉ định. Hãy tạo bài ở mục Kho Bài học trước.')
      return
    }

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + Math.max(1, dueDays))
    dueDate.setHours(23, 59, 0, 0)

    const parsedWords = requiredWordsInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)

    setCreating(true)
    try {
      await onCreateAssignment({
        title: title.trim(),
        description:
          description.trim() ||
          (targetType === 'vocab_pack'
            ? `Hoàn thành tối thiểu ${itemCount} thẻ từ vựng HSK ${hskLevel}.`
            : targetType === 'quiz'
              ? `Hoàn thành ${itemCount} câu trắc nghiệm HSK ${hskLevel} (đạt từ ${passScore}%).`
              : targetType === 'mock_exam'
                ? `Thi thử HSK ${hskLevel} (${examMode === 'full' ? 'Đề đầy đủ' : 'Theo kỹ năng'}).`
                : 'Học và làm bài kiểm tra cuối bài học.'),
        target_type: targetType,
        config: {
          hskLevel,
          itemCount,
          quizMode: targetType === 'quiz' ? quizMode : undefined,
          examMode: targetType === 'mock_exam' ? examMode : undefined,
          lessonId: targetType === 'lesson' ? lessonId : undefined,
          requiredWords: parsedWords.length > 0 ? parsedWords : undefined,
        },
        assigned_to: assignScope === 'all' ? 'all' : selectedStudentIds,
        due_at: dueDate.toISOString(),
        pass_score: passScore,
      })
      toast.success('Đã giao nhiệm vụ tới học viên')
      setTitle('')
      setDescription('')
      setRequiredWordsInput('')
    } catch (err) {
      toast.error(`Lỗi khi giao bài: ${err instanceof Error ? err.message : 'Không rõ'}`)
    } finally {
      setCreating(false)
    }
  }

  const handleExportCsv = () => {
    const csv = buildGradebookCsv(profiles, assignments, submissions)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hsk-lms-bang-diem-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất bảng điểm CSV')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return { cls: 'bg-moss-soft text-moss', text: 'Đã chấm' }
      case 'submitted':
        return { cls: 'bg-periwinkle-soft text-periwinkle', text: 'Đã hoàn thành' }
      case 'overdue':
        return { cls: 'bg-terracotta-soft text-terracotta', text: 'Quá hạn' }
      default:
        return { cls: 'bg-ochre-soft text-ochre', text: 'Chờ làm' }
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-jade" />
          <div>
            <h2 className="text-base font-semibold text-ink">Giao Bài &amp; Chỉ định Nhiệm vụ</h2>
            <p className="text-xs text-muted">
              Chỉ định số từ vựng phải học, bài trắc nghiệm, bài kiểm tra hoặc bài học riêng cho cả lớp / từng học viên.
            </p>
          </div>
        </div>

        {/* 4 thẻ chọn nhanh loại nhiệm vụ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              ['vocab_pack', 'Học Từ vựng', 'Chỉ định số từ / từ khóa'],
              ['quiz', 'Trắc nghiệm', 'Số câu & dạng bài'],
              ['mock_exam', 'Kiểm tra / Thi thử', 'Thi lên cấp HSK'],
              ['lesson', 'Bài học của Cô', 'Chỉ định bài tự soạn'],
            ] as const
          ).map(([k, lbl, sub]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTargetType(k)}
              className={`rounded-2xl border p-3 text-left transition cursor-pointer ${
                targetType === k ? 'border-jade bg-jade-soft' : 'border-line bg-glass-subtle hover:border-jade'
              }`}
            >
              <div className="text-xs font-bold text-ink">{lbl}</div>
              <div className="text-[11px] text-muted mt-0.5">{sub}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-muted md:col-span-2">
            Tên bài giao
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Học 20 từ vựng chủ đề giao tiếp HSK 1"
              className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none focus:border-jade"
            />
          </label>

          <label className="text-xs font-medium text-muted">
            Cấp độ HSK
            <select
              value={hskLevel}
              onChange={(e) => setHskLevel(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>
          </label>

          {targetType === 'vocab_pack' && (
            <label className="text-xs font-medium text-muted">
              Số từ vựng phải học
              <select
                value={itemCount}
                onChange={(e) => setItemCount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
              >
                {[10, 20, 30, 40, 60, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} từ vựng
                  </option>
                ))}
              </select>
            </label>
          )}

          {targetType === 'quiz' && (
            <label className="text-xs font-medium text-muted">
              Số câu &amp; Dạng bài
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <select
                  value={itemCount}
                  onChange={(e) => setItemCount(Number(e.target.value))}
                  className="rounded-xl border border-line bg-glass-subtle px-2 py-2 text-xs text-ink outline-none"
                >
                  {[10, 20, 30, 50].map((n) => (
                    <option key={n} value={n}>{n} câu</option>
                  ))}
                </select>
                <select
                  value={quizMode}
                  onChange={(e) => setQuizMode(e.target.value)}
                  className="rounded-xl border border-line bg-glass-subtle px-2 py-2 text-xs text-ink outline-none"
                >
                  <option value="mix">Tổng hợp</option>
                  <option value="zh_to_vi">Hán → Việt</option>
                  <option value="vi_to_zh">Việt → Hán</option>
                  <option value="audio">Nghe</option>
                  <option value="cloze">Điền câu</option>
                </select>
              </div>
            </label>
          )}

          {targetType === 'mock_exam' && (
            <label className="text-xs font-medium text-muted">
              Hình thức thi thử
              <select
                value={examMode}
                onChange={(e) => setExamMode(e.target.value as 'full' | 'section')}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="full">Đề thi đầy đủ</option>
                <option value="section">Kiểm tra theo kỹ năng</option>
              </select>
            </label>
          )}

          {targetType === 'lesson' && (
            <label className="text-xs font-medium text-muted">
              Chọn Bài học của lớp
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
              >
                {customLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    HSK {l.hsk_level} · {l.title_zh} ({l.title_vi})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-xs font-medium text-muted md:col-span-2">
            Ghi chú hướng dẫn học viên
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: Học thuộc phiên âm, nghĩa và tập viết các từ trọng tâm..."
              className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
            />
          </label>

          {targetType === 'vocab_pack' && (
            <label className="text-xs font-medium text-muted md:col-span-2">
              Danh sách từ chỉ định riêng (tùy chọn, ngăn cách bằng dấu phẩy)
              <input
                type="text"
                value={requiredWordsInput}
                onChange={(e) => setRequiredWordsInput(e.target.value)}
                placeholder="Ví dụ: 认识, 高兴, 最近, 打算"
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink hanzi outline-none"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-muted">
              Mức đạt
              <input
                type="number"
                min={40}
                max={300}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-2.5 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Hạn (ngày)
              <input
                type="number"
                min={1}
                max={60}
                value={dueDays}
                onChange={(e) => setDueDays(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-2.5 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAssignScope('all')}
                className={`flex-1 rounded-xl border px-2.5 py-2 font-medium cursor-pointer ${
                  assignScope === 'all' ? 'border-jade bg-jade-soft text-jade' : 'border-line text-muted'
                }`}
              >
                Cả lớp ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setAssignScope('selected')}
                className={`flex-1 rounded-xl border px-2.5 py-2 font-medium cursor-pointer ${
                  assignScope === 'selected' ? 'border-jade bg-jade-soft text-jade' : 'border-line text-muted'
                }`}
              >
                Chọn từng bạn
              </button>
            </div>
            <button type="submit" disabled={creating} className="glass-pill-btn glass-primary-btn w-full text-xs">
              <Send className="h-3.5 w-3.5" />
              {creating ? 'Đang gửi...' : 'Giao bài ngay'}
            </button>
          </div>

          {assignScope === 'selected' && (
            <div className="flex flex-wrap gap-2 md:col-span-4">
              {students.map((st) => {
                const checked = selectedStudentIds.includes(st.id)
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleToggleStudent(st.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium cursor-pointer ${
                      checked ? 'border-jade bg-jade-soft text-jade' : 'border-line text-muted'
                    }`}
                  >
                    {st.full_name} (HSK {st.current_hsk_level} → {st.target_hsk_level})
                  </button>
                )
              })}
            </div>
          )}
        </form>
      </section>

      <section className="glass-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Theo dõi Nộp bài &amp; Bảng điểm</h2>
            <p className="text-xs text-muted">
              {assignments.length} nhiệm vụ · {students.length} học viên đang học
            </p>
          </div>
          <button type="button" onClick={handleExportCsv} className="glass-pill-btn text-xs">
            <Download className="h-4 w-4 text-jade" />
            Xuất Bảng điểm CSV
          </button>
        </div>

        <div className="space-y-4">
          {assignments.map((assignment) => {
            const targetStudents =
              assignment.assigned_to === 'all'
                ? students
                : students.filter((s) => assignment.assigned_to.includes(s.id))
            const isOverdue = new Date(assignment.due_at).getTime() < Date.now()

            return (
              <div key={assignment.id} className="glass-subtle p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{assignment.title}</h3>
                      <span className="soft-chip">HSK {assignment.config.hskLevel}</span>
                      {assignment.config.itemCount && (
                        <span className="soft-chip !bg-periwinkle-soft !text-periwinkle">
                          {assignment.config.itemCount} {assignment.target_type === 'vocab_pack' ? 'từ' : 'câu'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{assignment.description}</p>
                    {assignment.config.requiredWords && assignment.config.requiredWords.length > 0 && (
                      <p className="mt-1 text-xs text-jade hanzi">
                        Từ chỉ định: {assignment.config.requiredWords.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted">
                    <div>Hạn: {assignment.due_at.slice(0, 10)}</div>
                    <div>Mức đạt: {assignment.pass_score}</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="pb-2 font-medium">Học viên</th>
                        <th className="pb-2 font-medium">Trạng thái</th>
                        <th className="pb-2 font-medium">Kết quả</th>
                        <th className="pb-2 font-medium">Chấm điểm &amp; Nhận xét</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {targetStudents.map((st) => {
                        const sub = submissions.find((x) => x.assignment_id === assignment.id && x.user_id === st.id)
                        const statusKey = sub ? sub.status : isOverdue ? 'overdue' : 'pending'
                        const badge = getStatusBadge(statusKey)
                        const draft = sub
                          ? (gradeDrafts[sub.id] ?? { score: String(sub.score), feedback: sub.admin_feedback })
                          : null

                        return (
                          <tr key={st.id}>
                            <td className="py-2.5 pr-3 font-medium text-ink">{st.full_name}</td>
                            <td className="py-2.5 pr-3">
                              <span className={`rounded-full px-2.5 py-0.5 font-medium ${badge.cls}`}>{badge.text}</span>
                            </td>
                            <td className="py-2.5 pr-3 tabular-nums text-muted">
                              {sub ? `${sub.score} / ${sub.max_score}` : '—'}
                            </td>
                            <td className="py-2.5">
                              {sub && draft ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    value={draft.score}
                                    onChange={(e) =>
                                      setGradeDrafts((prev) => ({
                                        ...prev,
                                        [sub.id]: { ...draft, score: e.target.value },
                                      }))
                                    }
                                    className="w-16 rounded-lg border border-line bg-glass px-2 py-1 text-xs text-ink"
                                  />
                                  <input
                                    type="text"
                                    value={draft.feedback}
                                    onChange={(e) =>
                                      setGradeDrafts((prev) => ({
                                        ...prev,
                                        [sub.id]: { ...draft, feedback: e.target.value },
                                      }))
                                    }
                                    placeholder="Nhận xét cho học viên..."
                                    className="min-w-[160px] flex-1 rounded-lg border border-line bg-glass px-2 py-1 text-xs text-ink"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void onGradeSubmission(sub.id, Number(draft.score) || 0, draft.feedback)
                                        .then(() => toast.success(`Đã chấm điểm cho ${st.full_name}`))
                                        .catch((err) => toast.error(err instanceof Error ? err.message : 'Lỗi chấm bài'))
                                    }}
                                    className="rounded-lg bg-jade px-2.5 py-1 font-semibold text-white cursor-pointer"
                                  >
                                    Lưu
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted">Đang chờ học viên hoàn thành</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
