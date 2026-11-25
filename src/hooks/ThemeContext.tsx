import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setTheme: (next: ThemePreference) => void
  toggleTheme: () => void
}

const ThemeCtx = createContext<ThemeContextValue | null>(null)

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStoredScheme(): ThemePreference {
  try {
    const v = localStorage.getItem('color-scheme')
    if (v === 'light' || v === 'dark') return v
  } catch {
    // ignore
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStoredScheme)
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark)

  const resolvedTheme: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  const syncDom = useCallback((pref: ThemePreference, resolved: 'light' | 'dark') => {
    const meta = document.querySelector('meta[name="color-scheme"]')
    const content = pref === 'system' ? 'light dark' : pref
    if (meta) meta.setAttribute('content', content)
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [])

  useEffect(() => {
    syncDom(preference, resolvedTheme)
  }, [preference, resolvedTheme, syncDom])

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') setPreference(readStoredScheme())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem('color-scheme')
      else localStorage.setItem('color-scheme', next)
    } catch {
      // ignore
    }
    setPreference(next)
  }, [])

  const toggleTheme = useCallback(() => {
    // Per modern-web-guidance: compute opposite of rendered scheme; remove key if returning to system match
    const target: 'light' | 'dark' = resolvedTheme === 'dark' ? 'light' : 'dark'
    const sysMatchesTarget = (target === 'dark') === getSystemDark()
    setTheme(sysMatchesTarget ? 'system' : target)
  }, [resolvedTheme, setTheme])

  return (
    <ThemeCtx.Provider value={{ preference, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  const c = useContext(ThemeCtx)
  if (!c) throw new Error('useTheme must be inside ThemeProvider')
  return c
}
