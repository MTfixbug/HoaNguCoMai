import {
  BookOpen,
  FileSpreadsheet,
  Flame,
  Home,
  Layers,
  LogOut,
  PawPrint,
  Settings,
  Sparkles,
  UserCircle2,
  WifiOff,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '../../hooks/AuthContext'
import { useLms } from '../../hooks/LmsContext'
import ThemeToggle from '../common/ThemeToggle'
import PetCompanion from '../gamification/PetCompanion'
import StickerBurst from '../gamification/StickerBurst'

const STUDENT_TABS = [
  { to: '/', label: 'Hôm nay', icon: Home, end: true },
  { to: '/vocab', label: 'Từ vựng', icon: BookOpen, end: false },
  { to: '/practice', label: 'Luyện tập', icon: Layers, end: false },
  { to: '/exams', label: 'Thi thử', icon: FileSpreadsheet, end: false },
]

export default function AppShell() {
  const { configured, profile, signOut } = useAuth()
  const { dataLoading, profiles, settings, updatePetPreferences, updateSettings } = useLms()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  const liveProfile = profiles.find((p) => p.id === profile?.id) ?? profile
  const activeLevel = liveProfile ? Math.max(1, liveProfile.current_hsk_level || 1) : 1
  const streakDays = liveProfile?.streak_days ?? 0
  const xpPoints = liveProfile?.xp_points ?? 0

  return (
    <div className="min-h-dvh pb-24 md:pb-12 bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-glass/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 sm:px-4 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <NavLink to="/" className="flex items-center gap-2 shrink-0 min-h-11">
              <span className="hanzi flex h-9 w-9 items-center justify-center rounded-xl bg-jade text-sm font-bold text-white shadow-sm">
                华
              </span>
              <div className="hidden sm:block">
                <div className="text-sm font-bold tracking-tight text-ink">Hoa Ngữ Cô Mai</div>
              </div>
            </NavLink>

            <nav className="hidden md:flex items-center gap-1" aria-label="Điều hướng học viên">
              {STUDENT_TABS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition min-h-10 ${
                      isActive ? 'bg-jade-soft text-jade' : 'text-muted hover:text-ink hover:bg-glass-subtle'
                    }`
                  }
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!online && (
              <span className="soft-chip !bg-ochre-soft !text-ochre text-[11px]" title="Đang học ngoại tuyến">
                <WifiOff size={12} /> <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            <span className="soft-chip !bg-ochre-soft !text-ochre whitespace-nowrap" title="Chuỗi ngày học liên tiếp">
              <Flame size={13} /> <span className="tabular-nums">{streakDays}</span>
            </span>

            <span className="soft-chip whitespace-nowrap" title="Điểm tích lũy XP">
              <Sparkles size={13} /> <span className="tabular-nums">{xpPoints}</span>
            </span>

            <span className="soft-chip hidden sm:inline-flex whitespace-nowrap">
              HSK {activeLevel} ({settings.hskStandard ?? '3.0'})
            </span>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="glass-pill-btn !min-h-11 !px-3 gap-1.5"
                aria-label="Menu cá nhân và cài đặt"
                aria-expanded={menuOpen}
              >
                <UserCircle2 size={18} />
                <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate">
                  {liveProfile?.full_name ?? 'Tài khoản'}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-glass-strong p-3 shadow-xl space-y-2.5 z-50">
                  <div className="border-b border-line pb-2 text-xs">
                    <div className="font-bold text-ink truncate">{liveProfile?.full_name ?? 'Học viên'}</div>
                    <div className="text-muted truncate">{liveProfile?.email}</div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Giao diện</span>
                    <ThemeToggle />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted flex items-center gap-1.5">
                      <PawPrint size={13} /> Thú cưng
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextEnabled = !settings.petEnabled
                        updateSettings({ petMotion: nextEnabled ? 'still' : 'off' })
                        void updatePetPreferences(settings.petType, nextEnabled)
                      }}
                      className="glass-pill-btn !min-h-8 !px-3 text-[11px]"
                    >
                      {settings.petEnabled ? 'Đang bật' : 'Đã tắt'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings')
                    }}
                    className="glass-pill-btn w-full justify-start !min-h-11 px-3 text-xs"
                  >
                    <Settings size={15} /> Cài đặt học &amp; Lộ trình
                  </button>

                  {configured && profile && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        void signOut()
                      }}
                      className="glass-pill-btn w-full justify-start !min-h-11 px-3 text-xs !border-terracotta/40 !text-terracotta"
                    >
                      <LogOut size={15} /> Đăng xuất
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-6">
        {dataLoading ? (
          <div className="glass-panel p-10 text-center text-sm text-muted" role="status">
            Đang tải dữ liệu học tập...
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <StickerBurst />
      <PetCompanion />

      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-line bg-glass/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]"
        aria-label="Điều hướng di động"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-1.5 py-1">
          {STUDENT_TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center rounded-xl py-1.5 min-h-12 text-[11px] font-semibold transition ${
                  isActive ? 'bg-jade-soft text-jade' : 'text-muted'
                }`
              }
            >
              <Icon size={18} />
              <span className="mt-0.5 truncate max-w-full">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Toaster position="top-center" richColors />
    </div>
  )
}
