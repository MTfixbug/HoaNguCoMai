import { Clock, Lock, LogOut, MailCheck, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/AuthContext'
import { useLms } from '../../hooks/LmsContext'
import OnboardingWizard from './OnboardingWizard'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { configured, loading, profile, signInWithPassword, signUpWithPassword, signOut, refreshProfile } = useAuth()
  const { completeOnboarding } = useLms()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmNotice, setConfirmNotice] = useState('')

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-panel p-8 text-center text-sm text-muted">Đang tải Hoa Ngữ Cô Mai...</div>
      </div>
    )
  }

  if (configured && !profile) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setErrorMsg('')
      setConfirmNotice('')
      setBusy(true)
      try {
        if (mode === 'login') {
          if (!identifier.trim() || !password) {
            setErrorMsg('Vui lòng nhập email và mật khẩu.')
            return
          }
          const err = await signInWithPassword(identifier, password)
          if (err) setErrorMsg(err)
          else toast.success('Đăng nhập thành công')
        } else {
          const res = await signUpWithPassword(fullName, identifier, password)
          if (res.error) setErrorMsg(res.error)
          else if (res.needsEmailConfirm) {
            setConfirmNotice('Đã gửi email xác thực đến Gmail của bạn. Sau khi xác nhận, vui lòng chờ duyệt để vào lớp.')
            setMode('login')
          } else {
            toast.success('Đăng ký thành công, tài khoản đang chờ duyệt.')
          }
        }
      } finally {
        setBusy(false)
      }
    }

    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-sm p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-center gap-2.5">
            <span className="hanzi flex h-10 w-10 items-center justify-center rounded-2xl bg-jade text-base font-bold text-white shadow-sm">
              华
            </span>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {mode === 'login' ? 'Hoa Ngữ Cô Mai' : 'Đăng ký học viên'}
            </h1>
          </div>

          {confirmNotice && (
            <div className="rounded-xl border border-moss/30 bg-moss-soft p-3 text-xs text-moss flex items-start gap-2">
              <MailCheck size={15} className="shrink-0 mt-0.5" />
              <span>{confirmNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <label className="block text-xs font-semibold text-ink">
                Họ và tên
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                  className="mt-1.5 w-full rounded-xl border border-line bg-glass px-3.5 py-2.5 text-sm text-ink outline-none focus:border-jade"
                />
              </label>
            )}

            <label className="block text-xs font-semibold text-ink">
              {mode === 'signup' ? 'Gmail' : 'Email'}
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === 'signup' ? 'example@gmail.com' : 'Nhập email...'}
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border border-line bg-glass px-3.5 py-2.5 text-sm text-ink outline-none focus:border-jade"
              />
            </label>

            <label className="block text-xs font-semibold text-ink">
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="mt-1.5 w-full rounded-xl border border-line bg-glass px-3.5 py-2.5 text-sm text-ink outline-none focus:border-jade"
              />
            </label>

            {errorMsg && (
              <div className="rounded-xl border border-terracotta/30 bg-terracotta-soft px-3 py-2 text-xs font-medium text-terracotta">
                {errorMsg}
              </div>
            )}

            <button type="submit" disabled={busy} className="glass-pill-btn glass-primary-btn w-full">
              {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          <div className="text-center text-xs text-muted">
            {mode === 'login' ? (
              <>
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setErrorMsg('')
                  }}
                  className="font-semibold text-jade hover:underline cursor-pointer"
                >
                  Đăng ký
                </button>
              </>
            ) : (
              <>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMsg('')
                  }}
                  className="font-semibold text-jade hover:underline cursor-pointer"
                >
                  Đăng nhập
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (profile && profile.account_status === 'pending') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md p-7 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ochre-soft text-ochre">
            <Clock size={26} />
          </div>
          <h1 className="text-xl font-bold">Tài khoản đang chờ phê duyệt</h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Xin chào <strong>{profile.full_name}</strong> ({profile.email}). Tài khoản của bạn đang chờ giáo viên phê duyệt để vào lớp.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button type="button" onClick={() => void refreshProfile()} className="glass-pill-btn glass-primary-btn">
              <RefreshCw size={15} /> Kiểm tra lại
            </button>
            <button type="button" onClick={() => void signOut()} className="glass-pill-btn">
              <LogOut size={15} /> Đăng xuất
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (profile && profile.account_status === 'locked') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md p-7 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-soft text-terracotta">
            <Lock size={26} />
          </div>
          <h1 className="text-xl font-bold">Tài khoản đã bị khóa</h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Tài khoản <strong>{profile.email}</strong> hiện đã bị khóa quyền học tập.
          </p>
          <button type="button" onClick={() => void signOut()} className="glass-pill-btn">
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      </div>
    )
  }

  if (profile && profile.role === 'student' && !profile.onboarding_completed) {
    return (
      <OnboardingWizard
        studentName={profile.full_name}
        onComplete={(curLvl, tgtLvl, mins) => completeOnboarding(curLvl, tgtLvl, mins)}
      />
    )
  }

  return <>{children}</>
}
