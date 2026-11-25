import { Clock, Eye, EyeOff, Lock, LogOut, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const wasLoggedInRef = useRef(false)

  useEffect(() => {
    const isLoggedIn = Boolean(profile)
    if (wasLoggedInRef.current && !isLoggedIn) {
      setMode('login')
      setPassword('')
      setConfirmPassword('')
      setErrorMsg('')
    }
    wasLoggedInRef.current = isLoggedIn
  }, [profile])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-panel p-8 text-center text-sm text-muted">Đang tải Hoa Ngữ Cô Mai...</div>
      </div>
    )
  }

  if (configured && !profile) {
    const switchMode = (next: 'login' | 'signup') => {
      setMode(next)
      setErrorMsg('')
      setConfirmPassword('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setErrorMsg('')
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
          if (password !== confirmPassword) {
            setErrorMsg('Mật khẩu xác nhận không khớp.')
            return
          }
          const res = await signUpWithPassword(fullName, identifier, password)
          if (res.error) setErrorMsg(res.error)
          else toast.success('Đăng ký thành công, tài khoản đang chờ Cô Mai duyệt.')
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
            <h1 className="text-xl font-bold tracking-tight text-ink">Hoa Ngữ Cô Mai</h1>
          </div>

          <div className="grid grid-cols-2 rounded-2xl border border-line bg-glass-subtle p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                mode === 'login' ? 'bg-glass-strong text-jade shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
              className={`rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                mode === 'signup' ? 'bg-glass-strong text-jade shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Đăng ký
            </button>
          </div>

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
              Email / Gmail
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
              <div className="relative mt-1.5">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-line bg-glass pl-3.5 pr-10 py-2.5 text-sm text-ink outline-none focus:border-jade"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-ink cursor-pointer"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {mode === 'signup' && (
              <label className="block text-xs font-semibold text-ink">
                Xác nhận mật khẩu
                <div className="relative mt-1.5">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-line bg-glass pl-3.5 pr-10 py-2.5 text-sm text-ink outline-none focus:border-jade"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    aria-label={showConfirmPw ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                    className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-ink cursor-pointer"
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-terracotta/30 bg-terracotta-soft px-3 py-2 text-xs font-medium text-terracotta">
                {errorMsg}
              </div>
            )}

            <button type="submit" disabled={busy} className="glass-pill-btn glass-primary-btn w-full">
              {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </button>
          </form>
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
