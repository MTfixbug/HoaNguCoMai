import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/ThemeContext'

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="glass-pill-btn !min-h-9 !px-2.5"
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
