-- Hoa Ngữ Cô Mai V1.1: Bảng lưu mật khẩu cấp cho học viên (chỉ Admin có quyền RLS đọc/ghi)

CREATE TABLE IF NOT EXISTS public.student_credentials (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_password text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_credentials_admin_select ON public.student_credentials
  FOR SELECT USING (private.is_admin());

CREATE POLICY student_credentials_admin_insert ON public.student_credentials
  FOR INSERT WITH CHECK (private.is_admin());

CREATE POLICY student_credentials_admin_update ON public.student_credentials
  FOR UPDATE USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE POLICY student_credentials_admin_delete ON public.student_credentials
  FOR DELETE USING (private.is_admin());
