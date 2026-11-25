import { CheckCircle2, Clock, Compass, Eye, Lock, Search, Trash2, Unlock, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AccountStatus, UserProfile } from '../../types/lms'
import GlassDialog from '../common/GlassDialog'

interface StudentApprovalPanelProps {
  profiles: UserProfile[]
  onUpdateStatus: (userId: string, status: AccountStatus) => Promise<void>
  onUpdateRoadmap: (
    userId: string,
    patch: { current_hsk_level: number; target_hsk_level: number; daily_goal_minutes: number },
  ) => Promise<void>
  onDeleteStudent: (userId: string) => Promise<void>
  onInspectStudent: (student: UserProfile) => void
}

export function StudentApprovalPanel({
  profiles,
  onUpdateStatus,
  onUpdateRoadmap,
  onDeleteStudent,
  onInspectStudent,
}: StudentApprovalPanelProps) {
  const [filter, setFilter] = useState<'all' | AccountStatus>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null)
  const [editCurrent, setEditCurrent] = useState(1)
  const [editTarget, setEditTarget] = useState(4)
  const [editGoal, setEditGoal] = useState(20)

  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<UserProfile | null>(null)

  const students = useMemo(() => profiles.filter((p) => p.role === 'student'), [profiles])

  const counts = useMemo(
    () => ({
      all: students.length,
      pending: students.filter((s) => s.account_status === 'pending').length,
      approved: students.filter((s) => s.account_status === 'approved').length,
      locked: students.filter((s) => s.account_status === 'locked').length,
    }),
    [students],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((s) => {
      if (filter !== 'all' && s.account_status !== filter) return false
      if (!q) return true
      return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    })
  }, [students, filter, query])

  const handleStatusChange = async (st: UserProfile, next: AccountStatus, label: string) => {
    setBusyId(st.id)
    try {
      await onUpdateStatus(st.id, next)
      toast.success(`${label}: ${st.full_name}`)
    } catch (err) {
      toast.error(`Không thể cập nhật: ${err instanceof Error ? err.message : 'Lỗi máy chủ'}`)
    } finally {
      setBusyId(null)
    }
  }

  const openRoadmapModal = (st: UserProfile) => {
    setEditingStudent(st)
    setEditCurrent(st.current_hsk_level)
    setEditTarget(Math.max(1, Math.max(st.current_hsk_level, st.target_hsk_level)))
    setEditGoal(st.daily_goal_minutes || 20)
  }

  const handleSaveRoadmap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent) return
    setBusyId(editingStudent.id)
    try {
      await onUpdateRoadmap(editingStudent.id, {
        current_hsk_level: editCurrent,
        target_hsk_level: Math.max(1, Math.max(editCurrent, editTarget)),
        daily_goal_minutes: editGoal,
      })
      toast.success(`Đã cập nhật lộ trình cho ${editingStudent.full_name}`)
      setEditingStudent(null)
    } catch (err) {
      toast.error(`Lỗi cập nhật lộ trình: ${err instanceof Error ? err.message : 'Không rõ'}`)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDeleteStudent) return
    setBusyId(confirmDeleteStudent.id)
    try {
      await onDeleteStudent(confirmDeleteStudent.id)
      toast.success(`Đã xóa học viên ${confirmDeleteStudent.full_name}`)
      setConfirmDeleteStudent(null)
    } catch (err) {
      toast.error(`Lỗi xóa học viên: ${err instanceof Error ? err.message : 'Không rõ'}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Quản lý Học viên &amp; Lộ trình</h2>
            <p className="text-xs text-muted">
              Duyệt vào lớp, khóa/mở khóa, chỉ định chặng HSK và kiểm tra tiến độ từng học viên.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['all', `Tất cả (${counts.all})`],
                ['pending', `Chờ duyệt (${counts.pending})`],
                ['approved', `Đang học (${counts.approved})`],
                ['locked', `Đã khóa (${counts.locked})`],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`glass-pill-btn !min-h-8 !px-3 text-xs ${filter === k ? 'glass-primary-btn' : ''}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-subtle flex items-center gap-2 px-3">
          <Search size={15} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo họ tên hoặc địa chỉ Gmail học viên..."
            className="w-full bg-transparent py-2 text-sm text-ink outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="pb-3 font-medium">Học viên &amp; Gmail</th>
                <th className="pb-3 font-medium">Lộ trình HSK</th>
                <th className="pb-3 font-medium">Chuỗi &amp; XP</th>
                <th className="pb-3 font-medium">Trạng thái</th>
                <th className="pb-3 font-medium">Ngày tham gia</th>
                <th className="pb-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((st) => {
                const isPending = st.account_status === 'pending'
                const isLocked = st.account_status === 'locked'
                const curLabel = st.current_hsk_level === 0 ? 'Mới bắt đầu' : `HSK ${st.current_hsk_level}`
                return (
                  <tr key={st.id} className="hover:bg-jade-soft/50 transition">
                    <td className="py-3.5 pr-3">
                      <div className="font-semibold text-ink">{st.full_name}</div>
                      <div className="text-xs text-muted">{st.email}</div>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="soft-chip">
                        {curLabel} → HSK {st.target_hsk_level}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3 text-xs font-bold tabular-nums">
                      <span className="text-ochre mr-2">🔥 {st.streak_days ?? 0}</span>
                      <span className="text-jade">{st.xp_points ?? 0} XP</span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span
                        className={`soft-chip ${
                          isPending
                            ? '!bg-ochre-soft !text-ochre'
                            : isLocked
                              ? '!bg-terracotta-soft !text-terracotta'
                              : '!bg-moss-soft !text-moss'
                        }`}
                      >
                        {isPending ? <Clock size={12} /> : isLocked ? <Lock size={12} /> : <CheckCircle2 size={12} />}
                        {isPending ? 'Chờ duyệt' : isLocked ? 'Đã khóa' : 'Đang học'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3 text-xs tabular-nums text-muted">{st.created_at.slice(0, 10)}</td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {(isPending || isLocked) && (
                          <button
                            type="button"
                            disabled={busyId === st.id}
                            onClick={() => void handleStatusChange(st, 'approved', isLocked ? 'Đã mở khóa' : 'Đã duyệt vào học')}
                            className="glass-pill-btn glass-primary-btn !min-h-8 !px-3 text-xs"
                          >
                            {isLocked ? <Unlock size={13} /> : <UserCheck size={13} />}
                            {isLocked ? 'Mở khóa' : 'Duyệt'}
                          </button>
                        )}
                        {st.account_status !== 'locked' && (
                          <button
                            type="button"
                            disabled={busyId === st.id}
                            onClick={() => void handleStatusChange(st, 'locked', 'Đã khóa tài khoản')}
                            className="glass-pill-btn !min-h-8 !px-3 text-xs !border-terracotta/40 !text-terracotta"
                          >
                            <Lock size={13} /> Khóa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openRoadmapModal(st)}
                          className="glass-pill-btn !min-h-8 !px-3 text-xs"
                        >
                          <Compass size={13} /> Đổi lộ trình
                        </button>
                        <button
                          type="button"
                          onClick={() => onInspectStudent(st)}
                          className="glass-pill-btn !min-h-8 !px-3 text-xs"
                        >
                          <Eye size={13} /> Phân tích
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteStudent(st)}
                          className="glass-pill-btn !min-h-8 !px-2.5 text-xs !text-terracotta"
                          aria-label={`Xóa ${st.full_name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted">
                    Không có học viên nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hộp thoại Đổi lộ trình học viên */}
      <GlassDialog
        open={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        title={editingStudent ? `Điều chỉnh lộ trình · ${editingStudent.full_name}` : 'Điều chỉnh lộ trình'}
        subtitle="Thiết lập chặng đang học và mục tiêu đầu ra cho học viên"
        maxWidthClass="max-w-md"
      >
        {editingStudent && (
          <form onSubmit={handleSaveRoadmap} className="space-y-4">
            <label className="block text-xs font-semibold text-muted">
              Chặng đang học (Hiện tại)
              <select
                value={editCurrent}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setEditCurrent(val)
                  if (editTarget < val) setEditTarget(Math.max(1, val))
                }}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
              >
                <option value={0}>Mới bắt đầu (sẽ học HSK 1)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    HSK {lvl}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-muted">
              Trình độ mục tiêu muốn đạt
              <select
                value={editTarget}
                onChange={(e) => setEditTarget(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                  <option key={lvl} value={lvl} disabled={lvl < Math.max(1, editCurrent)}>
                    HSK {lvl}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-muted">
              Mục tiêu phút học / ngày
              <select
                value={editGoal}
                onChange={(e) => setEditGoal(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none"
              >
                {[10, 15, 20, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} phút / ngày
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingStudent(null)} className="glass-pill-btn">
                Hủy
              </button>
              <button type="submit" disabled={busyId === editingStudent.id} className="glass-pill-btn glass-primary-btn">
                {busyId === editingStudent.id ? 'Đang lưu...' : 'Lưu lộ trình'}
              </button>
            </div>
          </form>
        )}
      </GlassDialog>

      {/* Xác nhận xóa học viên */}
      <GlassDialog
        open={Boolean(confirmDeleteStudent)}
        onClose={() => setConfirmDeleteStudent(null)}
        title="Xác nhận xóa hồ sơ học viên?"
        maxWidthClass="max-w-md"
      >
        {confirmDeleteStudent && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Hồ sơ và toàn bộ lịch sử học tập của <strong>{confirmDeleteStudent.full_name}</strong> ({confirmDeleteStudent.email}) sẽ bị xóa khỏi lớp.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeleteStudent(null)} className="glass-pill-btn">
                Hủy
              </button>
              <button
                type="button"
                disabled={busyId === confirmDeleteStudent.id}
                onClick={() => void handleDelete()}
                className="glass-pill-btn !bg-terracotta !text-white !border-transparent"
              >
                Xóa học viên
              </button>
            </div>
          </div>
        )}
      </GlassDialog>
    </div>
  )
}
