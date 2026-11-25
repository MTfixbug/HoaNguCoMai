-- Hoa Ngữ Cô Mai V1.2: Gỡ bỏ bảng lưu mật khẩu plaintext; mật khẩu chỉ nằm trong Supabase Auth (đã băm)
DROP TABLE IF EXISTS public.student_credentials;
