import {
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AccountStatus, UserProfile } from '../../types/lms'
import GlassDialog from '../common/GlassDialog'

export interface CreateStudentPayload {
  fullName: string
  email: string
  password: string
  currentHskLevel: number
  targetHskLevel: number
  dailyGoalMinutes: number
}

interface StudentApprovalPanelProps {
  profiles: UserProfile[]
  studentPasswords: Record<string, string>
  onUpdateStatus: (userId: string, status: AccountStatus) => Promise<void>
  onUpdateRoadmap: (
    userId: string,
    patch: { current_hsk_level: number; target_hsk_level: number; daily_goal_minutes: number },
  ) => Promise<void>
  onCreateStudent: (input: CreateStudentPayload) => Promise<{ profile: UserProfile; password: string }>
  onResetPassword: (studentId: string, newPassword: string) => Promise<void>
  onDeleteStudent: (userId: string) => Promise<void>
  onInspectStudent: (student: UserProfile) => void
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = 'Mai@'
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function StudentApprovalPanel({
  profiles,
  studentPasswords,
  onUpdateStatus,
  onUpdateRoadmap,
  onCreateStudent,
  onResetPassword,
  onDeleteStudent,
  onInspectStudent,
}: StudentApprovalPanelProps) {
  const [filter, setFilter] = useState<'all' | AccountStatus>('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})

  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null)
  const [editCurrent, setEditCurrent] = useState(1)
  const [editTarget, setEditTarget] = useState(4)
  const [editGoal, setEditGoal] = useState(20)

  const [createOpen, setCreateOpen] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState(() => generateRandomPassword())
  const [showNewPw, setShowNewPw] = useState(true)
  const [newCurrentLevel, setNewCurrentLevel] = useState(1)
  const [newTargetLevel, setNewTargetLevel] = useState(4)
  const [newDailyGoal, setNewDailyGoal] = useState(20)
  const [creating, setCreating] = useState(false)
  const [createdSummary, setCreatedSummary] = useState<{ fullName: string; email: string; password: string } | null>(null)

  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetConfirmPw, setResetConfirmPw] = useState('')
  const [showResetPw, setShowResetPw] = useState(true)
  const [resetting, setResetting] = useState(false)

  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<UserProfile | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const handleCopyText = async (idKey: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(idKey)
      toast.success(`Đã sao chép ${label}`)
      window.setTimeout(() => setCopiedId((cur) => (cur === idKey ? null : cur)), 1500)
    } catch {
      toast.info(text)
    }
  }

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

  const openCreateModal = () => {
    setCreatedSummary(null)
    setNewFullName('')
    setNewEmail('')
    setNewPassword(generateRandomPassword())
    setNewCurrentLevel(1)
    setNewTargetLevel(4)
    setNewDailyGoal(20)
    setCreateOpen(true)
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newFullName.trim().length < 2) {
      toast.error('Vui lòng nhập họ tên học viên.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(newEmail.trim())) {
      toast.error('Vui lòng nhập địa chỉ Email hợp lệ.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu cần tối thiểu 6 ký tự.')
      return
    }
    setCreating(true)
    try {
      const res = await onCreateStudent({
        fullName: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        currentHskLevel: newCurrentLevel,
        targetHskLevel: Math.max(1, Math.max(newCurrentLevel, newTargetLevel)),
        dailyGoalMinutes: newDailyGoal,
      })
      setCreatedSummary({
        fullName: res.profile.full_name,
        email: res.profile.email,
        password: res.password,
      })
      toast.success(`Đã cấp tài khoản thẳng cho ${res.profile.full_name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo tài khoản mới.')
    } finally {
      setCreating(false)
    }
  }

  const openResetModal = (st: UserProfile) => {
    const gen = generateRandomPassword()
    setResetTarget(st)
    setResetPw(gen)
    setResetConfirmPw(gen)
    setShowResetPw(true)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    if (resetPw.length < 6) {
      toast.error('Mật khẩu mới cần tối thiểu 6 ký tự.')
      return
    }
    if (resetPw !== resetConfirmPw) {
      toast.error('Mật khẩu xác nhận không khớp.')
      return
    }
    setResetting(true)
    try {
      await onResetPassword(resetTarget.id, resetPw)
      setRevealedIds((r) => ({ ...r, [resetTarget.id]: true }))
      toast.success(`Đã đổi mật khẩu mới cho ${resetTarget.full_name}`)
      setResetTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đổi được mật khẩu.')
    } finally {
      setResetting(false)
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
              Cấp thẳng tài khoản không cần xác thực mail, xem/đổi mật khẩu, duyệt lớp và chỉnh lộ trình HSK.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={openCreateModal}
              data-testid="admin-create-student-btn"
              className="glass-pill-btn glass-primary-btn !min-h-8 !px-3.5 text-xs"
            >
              <UserPlus size={14} /> Cấp tài khoản học viên
            </button>
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
          <table className="w-full min-w-[900px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <th className="pb-3 font-medium">Học viên &amp; Email</th>
                <th className="pb-3 font-medium">Mật khẩu</th>
                <th className="pb-3 font-medium">Lộ trình HSK</th>
                <th className="pb-3 font-medium">Chuỗi &amp; XP</th>
                <th className="pb-3 font-medium">Trạng thái</th>
                <th className="pb-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((st) => {
                const isPending = st.account_status === 'pending'
                const isLocked = st.account_status === 'locked'
                const curLabel = st.current_hsk_level === 0 ? 'Mới bắt đầu' : `HSK ${st.current_hsk_level}`
                const savedPw = studentPasswords[st.id]
                const isShown = Boolean(revealedIds[st.id])
                return (
                  <tr key={st.id} className="hover:bg-jade-soft/50 transition">
                    <td className="py-3.5 pr-3">
                      <div className="font-semibold text-ink">{st.full_name}</div>
                      <div className="text-xs text-muted">{st.email}</div>
                    </td>
                    <td className="py-3.5 pr-3">
                      {savedPw ? (
                        <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-glass-subtle px-2 py-1 text-xs">
                          <span className="font-mono font-semibold text-ink" data-testid={`pw-text-${st.id}`}>
                            {isShown ? savedPw : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealedIds((r) => ({ ...r, [st.id]: !r[st.id] }))}
                            aria-label={`Xem mật khẩu ${st.full_name}`}
                            className="p-0.5 text-muted hover:text-jade cursor-pointer"
                          >
                            {isShown ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyText(st.id, `${st.email} / ${savedPw}`, 'Email & Mật khẩu')}
                            aria-label={`Sao chép mật khẩu ${st.full_name}`}
                            className="p-0.5 text-muted hover:text-jade cursor-pointer"
                          >
                            {copiedId === st.id ? <Check size={13} className="text-moss" /> : <Copy size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Chưa lưu</span>
                      )}
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
                          onClick={() => openResetModal(st)}
                          aria-label={`Đổi mật khẩu ${st.full_name}`}
                          className="glass-pill-btn !min-h-8 !px-3 text-xs"
                        >
                          <KeyRound size={13} /> {savedPw ? 'Đổi MK' : 'Cấp MK'}
                        </button>
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

      {/* Hộp thoại Cấp thẳng tài khoản mới không cần xác thực mail */}
      <GlassDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cấp tài khoản học viên mới"
        subtitle="Kích hoạt vào học ngay — không cần học viên xác nhận email"
        maxWidthClass="max-w-lg"
      >
        {createdSummary ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-moss/35 bg-moss-soft p-4 space-y-2 text-xs sm:text-sm">
              <div className="font-bold text-moss flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Đã tạo và kích hoạt tài khoản thành công!
              </div>
              <div className="space-y-1 text-ink">
                <div>Học viên: <strong>{createdSummary.fullName}</strong></div>
                <div>Email đăng nhập: <strong className="font-mono">{createdSummary.email}</strong></div>
                <div>Mật khẩu: <strong className="font-mono text-jade">{createdSummary.password}</strong></div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  void handleCopyText(
                    'created',
                    `Tài khoản Hoa Ngữ Cô Mai:\nEmail: ${createdSummary.email}\nMật khẩu: ${createdSummary.password}`,
                    'thông tin đăng nhập',
                  )
                }
                className="glass-pill-btn glass-primary-btn text-xs"
              >
                <Copy size={14} /> Sao chép để gửi học viên
              </button>
              <button type="button" onClick={openCreateModal} className="glass-pill-btn text-xs">
                Tạo thêm học viên khác
              </button>
              <button type="button" onClick={() => setCreateOpen(false)} className="glass-pill-btn text-xs">
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateStudent} className="space-y-3.5">
            <label className="block text-xs font-semibold text-muted">
              Họ và tên học viên
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Minh Anh"
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none focus:border-jade"
              />
            </label>

            <label className="block text-xs font-semibold text-muted">
              Email / Gmail đăng nhập
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="tenhocvien@gmail.com"
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm text-ink outline-none focus:border-jade"
              />
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-muted">
                <span>Mật khẩu cấp cho học viên</span>
                <button
                  type="button"
                  onClick={() => setNewPassword(generateRandomPassword())}
                  className="inline-flex items-center gap-1 text-jade hover:underline cursor-pointer"
                >
                  <Sparkles size={12} /> Tạo nhanh
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-glass-subtle pl-3 pr-9 py-2 text-sm font-mono text-ink outline-none focus:border-jade"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-ink cursor-pointer"
                >
                  {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-muted">
                Hiện tại
                <select
                  value={newCurrentLevel}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setNewCurrentLevel(v)
                    if (newTargetLevel < Math.max(1, v)) setNewTargetLevel(Math.max(1, v))
                  }}
                  className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-2.5 py-2 text-xs text-ink outline-none"
                >
                  <option value={0}>Mới (HSK 1)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                    <option key={lvl} value={lvl}>HSK {lvl}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-muted">
                Mục tiêu
                <select
                  value={newTargetLevel}
                  onChange={(e) => setNewTargetLevel(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-2.5 py-2 text-xs text-ink outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                    <option key={lvl} value={lvl} disabled={lvl < Math.max(1, newCurrentLevel)}>
                      HSK {lvl}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-muted">
                Mỗi ngày
                <select
                  value={newDailyGoal}
                  onChange={(e) => setNewDailyGoal(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-2.5 py-2 text-xs text-ink outline-none"
                >
                  {[10, 15, 20, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>{m} phút</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="glass-pill-btn text-xs">
                Hủy
              </button>
              <button type="submit" disabled={creating} className="glass-pill-btn glass-primary-btn text-xs">
                <UserPlus size={14} /> {creating ? 'Đang tạo...' : 'Tạo & Kích hoạt ngay'}
              </button>
            </div>
          </form>
        )}
      </GlassDialog>

      {/* Hộp thoại Đổi / Cấp lại mật khẩu học viên */}
      <GlassDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={resetTarget ? `Đổi mật khẩu · ${resetTarget.full_name}` : 'Đổi mật khẩu'}
        subtitle={resetTarget ? `${resetTarget.email} · Học viên dùng mật khẩu mới này để đăng nhập ngay` : undefined}
        maxWidthClass="max-w-md"
      >
        {resetTarget && (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-muted">
                <span>Mật khẩu mới</span>
                <button
                  type="button"
                  onClick={() => {
                    const g = generateRandomPassword()
                    setResetPw(g)
                    setResetConfirmPw(g)
                  }}
                  className="inline-flex items-center gap-1 text-jade hover:underline cursor-pointer"
                >
                  <Sparkles size={12} /> Tạo ngẫu nhiên
                </button>
              </div>
              <div className="relative">
                <input
                  type={showResetPw ? 'text' : 'password'}
                  required
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  className="w-full rounded-xl border border-line bg-glass-subtle pl-3 pr-9 py-2 text-sm font-mono text-ink outline-none focus:border-jade"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw((v) => !v)}
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-ink cursor-pointer"
                >
                  {showResetPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <label className="block text-xs font-semibold text-muted">
              Xác nhận mật khẩu mới
              <input
                type={showResetPw ? 'text' : 'password'}
                required
                value={resetConfirmPw}
                onChange={(e) => setResetConfirmPw(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-glass-subtle px-3 py-2 text-sm font-mono text-ink outline-none focus:border-jade"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResetTarget(null)} className="glass-pill-btn text-xs">
                Hủy
              </button>
              <button type="submit" disabled={resetting} className="glass-pill-btn glass-primary-btn text-xs">
                <KeyRound size={14} /> {resetting ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
              </button>
            </div>
          </form>
        )}
      </GlassDialog>

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
