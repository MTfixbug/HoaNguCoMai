import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const DEFAULT_ORIGINS = [
  'https://mtfixbug.github.io',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]

function resolveCorsOrigin(req: Request): string {
  const rawEnv = Deno.env.get('ALLOWED_ORIGINS') ?? ''
  const allowed = rawEnv
    ? rawEnv.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
    : DEFAULT_ORIGINS
  const origin = (req.headers.get('Origin') ?? '').trim().replace(/\/$/, '')
  if (origin && allowed.includes(origin)) return origin
  return allowed[0] ?? 'https://mtfixbug.github.io'
}

function buildCorsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(req),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function getReservedEmails(): Set<string> {
  const raw = Deno.env.get('RESERVED_EMAILS') ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

// Giới hạn tần suất theo IP (sliding window 15 phút, tối đa 5 lượt đăng ký/IP)
const SIGNUP_WINDOW_MS = 15 * 60_000
const SIGNUP_MAX_PER_IP = 5
const signupIpLog = new Map<string, number[]>()

function checkSignupRateLimit(req: Request): boolean {
  const fwd = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown'
  const ip = fwd.split(',')[0].trim() || 'unknown'
  const now = Date.now()
  const recent = (signupIpLog.get(ip) ?? []).filter((ts) => now - ts < SIGNUP_WINDOW_MS)
  if (recent.length >= SIGNUP_MAX_PER_IP) {
    signupIpLog.set(ip, recent)
    return false
  }
  recent.push(now)
  signupIpLog.set(ip, recent)
  return true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { ok: false, error: 'Thiếu cấu hình máy chủ xác thực.' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const payload = (await req.json()) as Record<string, unknown>
    const action = String(payload.action ?? '')
    const reservedEmails = getReservedEmails()

    const requireAdmin = async (): Promise<{ ok: true; adminId: string } | { ok: false; error: string }> => {
      const authHeader = req.headers.get('Authorization') ?? ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!token) return { ok: false, error: 'Phiên quản trị không hợp lệ. Vui lòng đăng nhập lại.' }

      const { data: userData, error: userErr } = await admin.auth.getUser(token)
      if (userErr || !userData.user) {
        return { ok: false, error: 'Không xác thực được quyền quản trị viên.' }
      }

      const { data: prof } = await admin
        .from('profiles')
        .select('id, role, account_status')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!prof || prof.role !== 'admin' || prof.account_status !== 'approved') {
        return { ok: false, error: 'Chỉ Quản trị viên mới có quyền thực hiện thao tác này.' }
      }
      return { ok: true, adminId: prof.id }
    }

    if (action === 'student_signup') {
      if (!checkSignupRateLimit(req)) {
        return jsonResponse(req, {
          ok: false,
          error: 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại hoặc nhờ Giáo viên cấp tài khoản.',
        })
      }

      const fullName = String(payload.fullName ?? '').trim()
      const email = String(payload.email ?? '').trim().toLowerCase()
      const password = String(payload.password ?? '')

      if (fullName.length < 2) {
        return jsonResponse(req, { ok: false, error: 'Vui lòng nhập đầy đủ họ và tên (tối thiểu 2 ký tự).' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email) || reservedEmails.has(email)) {
        return jsonResponse(req, { ok: false, error: 'Địa chỉ Email/Gmail không hợp lệ.' })
      }
      if (password.length < 6) {
        return jsonResponse(req, { ok: false, error: 'Mật khẩu cần tối thiểu 6 ký tự.' })
      }

      const emailConfirm = Deno.env.get('USE_STANDARD_EMAIL_CONFIRM') === 'true' ? false : true
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: emailConfirm,
        user_metadata: { full_name: fullName },
      })

      if (createErr || !created.user) {
        const msg = (createErr?.message ?? '').toLowerCase()
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return jsonResponse(req, {
            ok: false,
            error: 'Email này đã được đăng ký trước đó. Vui lòng chuyển sang Đăng nhập hoặc báo Giáo viên cấp lại mật khẩu.',
          })
        }
        return jsonResponse(req, { ok: false, error: createErr?.message ?? 'Không thể tạo tài khoản học viên.' })
      }

      const uid = created.user.id
      await admin.from('profiles').upsert(
        {
          id: uid,
          email,
          full_name: fullName,
          role: 'student',
          account_status: 'pending',
          onboarding_completed: false,
        },
        { onConflict: 'id' },
      )

      return jsonResponse(req, { ok: true, userId: uid, needsEmailConfirm: !emailConfirm })
    }

    if (action === 'admin_create_student') {
      const auth = await requireAdmin()
      if (!auth.ok) return jsonResponse(req, { ok: false, error: auth.error }, 403)

      const fullName = String(payload.fullName ?? '').trim()
      const email = String(payload.email ?? '').trim().toLowerCase()
      const password = String(payload.password ?? '')
      const currentHskLevel = Math.max(0, Math.min(9, Number(payload.currentHskLevel ?? 1)))
      const rawTarget = Math.max(1, Math.min(9, Number(payload.targetHskLevel ?? 4)))
      const targetHskLevel = Math.max(currentHskLevel || 1, rawTarget)
      const dailyGoalMinutes = Math.max(5, Math.min(240, Number(payload.dailyGoalMinutes ?? 20)))

      if (fullName.length < 2) {
        return jsonResponse(req, { ok: false, error: 'Họ và tên cần tối thiểu 2 ký tự.' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email) || reservedEmails.has(email)) {
        return jsonResponse(req, { ok: false, error: 'Email học viên không hợp lệ.' })
      }
      if (password.length < 6) {
        return jsonResponse(req, { ok: false, error: 'Mật khẩu cần tối thiểu 6 ký tự.' })
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (createErr || !created.user) {
        const msg = (createErr?.message ?? '').toLowerCase()
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return jsonResponse(req, {
            ok: false,
            error: 'Email này đã tồn tại trong hệ thống. Bạn có thể tìm học viên trong danh sách để Cấp mật khẩu mới.',
          })
        }
        return jsonResponse(req, { ok: false, error: createErr?.message ?? 'Không tạo được tài khoản mới.' })
      }

      const uid = created.user.id
      const { data: profData, error: profErr } = await admin
        .from('profiles')
        .upsert(
          {
            id: uid,
            email,
            full_name: fullName,
            role: 'student',
            account_status: 'approved',
            current_hsk_level: currentHskLevel,
            target_hsk_level: targetHskLevel,
            daily_goal_minutes: dailyGoalMinutes,
            onboarding_completed: true,
          },
          { onConflict: 'id' },
        )
        .select('*')
        .single()

      if (profErr) {
        return jsonResponse(req, { ok: false, error: profErr.message })
      }

      return jsonResponse(req, { ok: true, profile: profData })
    }

    if (action === 'admin_reset_password') {
      const auth = await requireAdmin()
      if (!auth.ok) return jsonResponse(req, { ok: false, error: auth.error }, 403)

      const studentId = String(payload.studentId ?? '').trim()
      const newPassword = String(payload.newPassword ?? '')

      if (!studentId || newPassword.length < 6) {
        return jsonResponse(req, { ok: false, error: 'Mật khẩu mới cần tối thiểu 6 ký tự.' })
      }

      const { data: target } = await admin.from('profiles').select('id, role').eq('id', studentId).maybeSingle()
      if (!target || target.role !== 'student') {
        return jsonResponse(req, { ok: false, error: 'Không tìm thấy hồ sơ học viên hợp lệ.' })
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(studentId, {
        password: newPassword,
        email_confirm: true,
      })
      if (updErr) {
        return jsonResponse(req, { ok: false, error: updErr.message })
      }

      return jsonResponse(req, { ok: true, studentId })
    }

    if (action === 'admin_delete_student') {
      const auth = await requireAdmin()
      if (!auth.ok) return jsonResponse(req, { ok: false, error: auth.error }, 403)

      const studentId = String(payload.studentId ?? '').trim()
      if (!studentId) return jsonResponse(req, { ok: false, error: 'Thiếu mã học viên cần xóa.' })

      const { data: target } = await admin.from('profiles').select('id, role').eq('id', studentId).maybeSingle()
      if (target && target.role !== 'student') {
        return jsonResponse(req, { ok: false, error: 'Không thể xóa tài khoản quản trị.' })
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(studentId)
      if (delErr) {
        return jsonResponse(req, { ok: false, error: delErr.message })
      }
      await admin.from('profiles').delete().eq('id', studentId)

      return jsonResponse(req, { ok: true, studentId })
    }

    return jsonResponse(req, { ok: false, error: `Hành động không hỗ trợ: ${action}` }, 400)
  } catch (err) {
    return jsonResponse(req, { ok: false, error: err instanceof Error ? err.message : 'Lỗi máy chủ không xác định.' }, 500)
  }
})
