import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export const ADMIN_ALIAS_DISPLAY = 'Admin@Admin'
export const ADMIN_AUTH_EMAIL = 'admin@zhweb.vn'

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-id'))

export function normalizeLoginEmail(input: string): string {
  const cleaned = input.trim().toLowerCase()
  if (cleaned === 'admin@admin') return ADMIN_AUTH_EMAIL
  return cleaned
}

export function formatDisplayEmail(email: string): string {
  if (!email) return ''
  return email.trim().toLowerCase() === ADMIN_AUTH_EMAIL ? ADMIN_ALIAS_DISPLAY : email
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return client
}

export function getOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '/'
  const base = (import.meta.env.BASE_URL as string | undefined) || '/'
  return `${window.location.origin}${base.endsWith('/') ? base : `${base}/`}`
}
