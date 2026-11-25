import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const RESERVED_EMAILS = new Set(['admin@admin', 'admin@zhweb.vn'])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Thiếu cấu hình máy chủ xác thực.' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const payload = (await req.json()) as Record<string, unknown>
    const action = String(payload.action ?? '')

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
        return { ok: false, error: 'Chỉ Quản trị viên (Cô Mai) mới có quyền thực hiện thao tác này.' }
      }
      return { ok: true, adminId: prof.id }
    }

    if (action === 'student_signup') {
      const fullName = String(payload.fullName ?? '').trim()
      const email = String(payload.email ?? '').trim().toLowerCase()
      const password = String(payload.password ?? '')

      if (fullName.length < 2) {
        return jsonResponse({ ok: false, error: 'Vui lòng nhập đầy đủ họ và tên (tối thiểu 2 ký tự).' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email) || RESERVED_EMAILS.has(email)) {
        return jsonResponse({ ok: false, error: 'Địa chỉ Email/Gmail không hợp lệ.' })
      }
      if (password.length < 6) {
        return jsonResponse({ ok: false, error: 'Mật khẩu cần tối thiểu 6 ký tự.' })
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
          return jsonResponse({
            ok: false,
            error: 'Email này đã được đăng ký trước đó. Vui lòng chuyển sang Đăng nhập hoặc báo Cô Mai cấp lại mật khẩu.',
          })
        }
        return jsonResponse({ ok: false, error: createErr?.message ?? 'Không thể tạo tài khoản học viên.' })
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

      await admin.from('student_credentials').upsert(
        {
          student_id: uid,
          login_password: password,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' },
      )

      return jsonResponse({ ok: true, userId: uid })
    }

    if (action === 'admin_create_student') {
      const auth = await requireAdmin()
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, 403)

      const fullName = String(payload.fullName ?? '').trim()
      const email = String(payload.email ?? '').trim().toLowerCase()
      const password = String(payload.password ?? '')
      const currentHskLevel = Math.max(0, Math.min(9, Number(payload.currentHskLevel ?? 1)))
      const rawTarget = Math.max(1, Math.min(9, Number(payload.targetHskLevel ?? 4)))
      const targetHskLevel = Math.max(currentHskLevel || 1, rawTarget)
      const dailyGoalMinutes = Math.max(5, Math.min(240, Number(payload.dailyGoalMinutes ?? 20)))

      if (fullName.length < 2) {
        return jsonResponse({ ok: false, error: 'Họ và tên cần tối thiểu 2 ký tự.' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email) || RESERVED_EMAILS.has(email)) {
        return jsonResponse({ ok: false, error: 'Email học viên không hợp lệ.' })
      }
      if (password.length < 6) {
        return jsonResponse({ ok: false, error: 'Mật khẩu cần tối thiểu 6 ký tự.' })
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
          return jsonResponse({
            ok: false,
            error: 'Email này đã tồn tại trong hệ thống. Bạn có thể tìm học viên trong danh sách để Đổi mật khẩu.',
          })
        }
        return jsonResponse({ ok: false, error: createErr?.message ?? 'Không tạo được tài khoản mới.' })
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
        return jsonResponse({ ok: false, error: profErr.message })
      }

      await admin.from('student_credentials').upsert(
        {
          student_id: uid,
          login_password: password,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' },
      )

      return jsonResponse({ ok: true, profile: profData, login_password: password })
    }

    if (action === 'admin_reset_password') {
      const auth = await requireAdmin()
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, 403)

      const studentId = String(payload.studentId ?? '').trim()
      const newPassword = String(payload.newPassword ?? '')

      if (!studentId || newPassword.length < 6) {
        return jsonResponse({ ok: false, error: 'Mật khẩu mới cần tối thiểu 6 ký tự.' })
      }

      const { data: target } = await admin.from('profiles').select('id, role').eq('id', studentId).maybeSingle()
      if (!target || target.role !== 'student') {
        return jsonResponse({ ok: false, error: 'Không tìm thấy hồ sơ học viên hợp lệ.' })
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(studentId, {
        password: newPassword,
        email_confirm: true,
      })
      if (updErr) {
        return jsonResponse({ ok: false, error: updErr.message })
      }

      await admin.from('student_credentials').upsert(
        {
          student_id: studentId,
          login_password: newPassword,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' },
      )

      return jsonResponse({ ok: true, studentId, login_password: newPassword })
    }

    if (action === 'admin_delete_student') {
      const auth = await requireAdmin()
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, 403)

      const studentId = String(payload.studentId ?? '').trim()
      if (!studentId) return jsonResponse({ ok: false, error: 'Thiếu mã học viên cần xóa.' })

      const { data: target } = await admin.from('profiles').select('id, role').eq('id', studentId).maybeSingle()
      if (target && target.role !== 'student') {
        return jsonResponse({ ok: false, error: 'Không thể xóa tài khoản quản trị.' })
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(studentId)
      if (delErr) {
        return jsonResponse({ ok: false, error: delErr.message })
      }
      await admin.from('profiles').delete().eq('id', studentId)

      return jsonResponse({ ok: true, studentId })
    }

    return jsonResponse({ ok: false, error: `Hành động không hỗ trợ: ${action}` }, 400)
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : 'Lỗi máy chủ không xác định.' }, 500)
  }
})
