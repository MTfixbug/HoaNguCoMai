import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEMO_STUDENT_ID, loadLocalStore } from '../lib/lmsStore'
import { getOAuthRedirectUrl, getSupabase, isSupabaseConfigured, normalizeLoginEmail } from '../lib/supabase'
import type { UserProfile } from '../types/lms'

interface AuthContextValue {
  configured: boolean
  isDemoMode: boolean
  loading: boolean
  profile: UserProfile | null
  signInWithPassword: (identifier: string, password: string) => Promise<string | null>
  signUpWithPassword: (fullName: string, email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthCtx = createContext<AuthContextValue | null>(null)

function mapAuthErrorVi(message?: string): string {
  if (!message) return 'Thao tác không thành công. Vui lòng thử lại.'
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Sai tên đăng nhập hoặc mật khẩu.'
  if (m.includes('email not confirmed')) return 'Tài khoản chưa được kích hoạt. Vui lòng báo Cô Mai kiểm tra hoặc cấp lại mật khẩu.'
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Hệ thống đang bận trong giây lát. Vui lòng thử lại sau 1 phút.'
  if (m.includes('user already registered')) return 'Email này đã được đăng ký trước đó. Hãy chuyển sang tab Đăng nhập.'
  if (m.includes('password should be at least')) return 'Mật khẩu cần tối thiểu 6 ký tự.'
  if (m.includes('unable to validate email')) return 'Địa chỉ email không hợp lệ.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(configured)
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (configured || !import.meta.env.DEV) return null
    const st = loadLocalStore()
    return st.profiles.find((p) => p.id === DEMO_STUDENT_ID) ?? st.profiles[0] ?? null
  })

  const fetchSupabaseProfile = useCallback(async (uid: string) => {
    const sb = getSupabase()
    if (!sb) return
    const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (data) {
      setProfile(data as UserProfile)
      if ((data as UserProfile).account_status === 'approved') {
        void sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid)
      }
    }
  }, [])

  useEffect(() => {
    if (!configured) return
    const sb = getSupabase()
    if (!sb) {
      setLoading(false)
      return
    }
    let alive = true
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!alive) return
      if (session?.user) await fetchSupabaseProfile(session.user.id)
      else setProfile(null)
      setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return
      if (session?.user) await fetchSupabaseProfile(session.user.id)
      else setProfile(null)
      setLoading(false)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [configured, fetchSupabaseProfile])

  const signInWithPassword = useCallback(
    async (identifier: string, password: string) => {
      const sb = getSupabase()
      if (!sb) return 'Chưa cấu hình kết nối Supabase.'
      const email = normalizeLoginEmail(identifier)
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) return mapAuthErrorVi(error.message)
      if (data.user) await fetchSupabaseProfile(data.user.id)
      return null
    },
    [fetchSupabaseProfile],
  )

  const signUpWithPassword = useCallback(
    async (fullName: string, rawEmail: string, password: string) => {
      const nameClean = fullName.trim()
      const emailClean = rawEmail.trim().toLowerCase()
      if (nameClean.length < 2) {
        return { error: 'Vui lòng nhập đầy đủ họ và tên.', needsEmailConfirm: false }
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(emailClean)) {
        return { error: 'Vui lòng nhập địa chỉ Email / Gmail hợp lệ.', needsEmailConfirm: false }
      }
      if (password.length < 6) {
        return { error: 'Mật khẩu cần tối thiểu 6 ký tự.', needsEmailConfirm: false }
      }

      const sb = getSupabase()
      if (!sb) return { error: 'Chưa cấu hình kết nối Supabase.', needsEmailConfirm: false }

      const { data: fnData, error: fnErr } = await sb.functions.invoke<{ ok?: boolean; error?: string }>('auth-manager', {
        body: {
          action: 'student_signup',
          fullName: nameClean,
          email: emailClean,
          password,
        },
      })

      if (fnErr) {
        return { error: mapAuthErrorVi(fnErr.message), needsEmailConfirm: false }
      }
      if (!fnData?.ok) {
        return { error: fnData?.error ?? 'Không thể đăng ký tài khoản.', needsEmailConfirm: false }
      }

      const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({
        email: emailClean,
        password,
      })
      if (loginErr) return { error: mapAuthErrorVi(loginErr.message), needsEmailConfirm: false }
      if (loginData.user) await fetchSupabaseProfile(loginData.user.id)
      return { error: null, needsEmailConfirm: false }
    },
    [fetchSupabaseProfile],
  )

  const signInWithGoogle = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) return 'Chưa cấu hình kết nối Supabase.'
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirectUrl(),
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    return error ? mapAuthErrorVi(error.message) : null
  }, [])

  const signOut = useCallback(async () => {
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) return
    if (profile) {
      await fetchSupabaseProfile(profile.id)
      return
    }
    const { data: { session } } = await sb.auth.getSession()
    if (session?.user) await fetchSupabaseProfile(session.user.id)
  }, [profile, fetchSupabaseProfile])

  return (
    <AuthCtx.Provider
      value={{
        configured,
        isDemoMode: !configured && import.meta.env.DEV,
        loading,
        profile,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth phải dùng bên trong AuthProvider')
  return c
}
