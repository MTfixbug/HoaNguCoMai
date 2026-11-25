import { BookOpen, FileSpreadsheet, Flame, Home, Layers, LogOut, PawPrint, Search, Settings, Sparkles } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '../../hooks/AuthContext'
import { useLms } from '../../hooks/LmsContext'
import ThemeToggle from '../common/ThemeToggle'
import PetCompanion from '../gamification/PetCompanion'
import StickerBurst from '../gamification/StickerBurst'

const STUDENT_TABS = [
  { to: '/', label: 'Trang chủ', icon: Home, end: true },
  { to: '/flashcards', label: 'Luyện tập', icon: Layers, end: false },
  { to: '/exams', label: 'Thi thử', icon: FileSpreadsheet, end: false },
  { to: '/vocab', label: 'Từ điển', icon: Search, end: false },
]

export default function AppShell() {
  const { configured, profile, signOut } = useAuth()
  const { dataLoading, profiles, settings, updatePetPreferences } = useLms()

  const liveProfile = profiles.find((p) => p.id === profile?.id) ?? profile
  const activeLevel = liveProfile ? Math.max(1, liveProfile.current_hsk_level || 1) : 1
  const streakDays = liveProfile?.streak_days ?? 0
  const xpPoints = liveProfile?.xp_points ?? 0

  return (
    <div className="min-h-dvh pb-24 md:pb-12 bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-glass/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
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
                    `flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
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
            <span className="soft-chip !bg-ochre-soft !text-ochre whitespace-nowrap" title="Chuỗi ngày học liên tiếp">
              <Flame size={13} /> <span className="tabular-nums">{streakDays}</span>
              <span className="hidden sm:inline"> ngày</span>
            </span>

            <span className="soft-chip whitespace-nowrap" title="Điểm tích lũy XP">
              <Sparkles size={13} /> <span className="tabular-nums">{xpPoints} XP</span>
            </span>

            {liveProfile && (
              <span className="soft-chip hidden lg:inline-flex whitespace-nowrap">
                <BookOpen size={12} /> HSK {activeLevel} · {liveProfile.full_name}
              </span>
            )}

            <button
              type="button"
              onClick={() => void updatePetPreferences(settings.petType, !settings.petEnabled)}
              className={`glass-pill-btn !min-h-9 !px-2.5 ${settings.petEnabled ? '!border-jade !bg-jade-soft !text-jade' : ''}`}
              aria-label="Bật hoặc tắt thú cưng đồng hành"
              title={settings.petEnabled ? 'Đang bật bạn đồng hành (bấm để tắt)' : 'Đang tắt bạn đồng hành (bấm để bật)'}
            >
              <PawPrint size={15} />
            </button>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `glass-pill-btn !min-h-9 !px-2.5 ${isActive ? '!border-jade !bg-jade-soft !text-jade' : ''}`
              }
              aria-label="Cài đặt"
              title="Cài đặt"
            >
              <Settings size={16} />
            </NavLink>
            <ThemeToggle />
            {configured && profile && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="glass-pill-btn !min-h-9 !px-2.5"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-6">
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

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-line bg-glass md:hidden" aria-label="Điều hướng di động">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-1.5">
          {STUDENT_TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-semibold transition ${
                  isActive ? 'bg-jade-soft text-jade' : 'text-muted'
                }`
              }
            >
              <Icon size={17} />
              <span className="mt-0.5 truncate max-w-full">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Toaster position="top-center" richColors />
    </div>
  )
}
