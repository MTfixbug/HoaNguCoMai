# Hướng dẫn phát hành & bảo mật bản 1.2 (Chủ app thực hiện tay)

> Tài liệu này không chứa email, mật khẩu hay mã bí mật thật.

## 1. Xóa bảng lưu mật khẩu plaintext trên Supabase
Chạy nội dung tệp `supabase/migrations/005_drop_plaintext_passwords.sql` trong **Supabase Dashboard → SQL Editor**:

```sql
DROP TABLE IF EXISTS public.student_credentials;
```

*(Từ bản 1.2 trở đi, mật khẩu chỉ tồn tại dạng băm trong Supabase Auth. Khi Admin tạo mới hoặc đặt lại mật khẩu, mật khẩu hiển thị đúng một lần trên màn hình xác nhận để sao chép gửi học viên.)*

## 2. Cấu hình Secrets cho Edge Function `auth-manager`
Vào **Supabase Dashboard → Edge Functions → `auth-manager` → Secrets** và thiết lập:

- `RESERVED_EMAILS`: danh sách email quản trị (ngăn tự đăng ký trùng), cách nhau bởi dấu phẩy.
- `ALLOWED_ORIGINS`: danh sách origin được phép gọi CORS, ví dụ:
  `https://mtfixbug.github.io,http://127.0.0.1:5173,http://localhost:5173`
- `USE_STANDARD_EMAIL_CONFIRM` *(tùy chọn)*: đặt `true` nếu muốn bật lại xác thực email chuẩn của Supabase cho tự đăng ký học viên (mặc định `false` để tránh giới hạn SMTP gói miễn phí, có kèm rate limit theo IP trong Edge Function).

Nếu deploy Edge Function qua CLI:

```bash
supabase functions deploy auth-manager --no-verify-jwt
```

## 3. Tạo mới hoặc đổi tài khoản Admin + bật MFA
1. Đăng ký hoặc tạo user bình thường trong **Supabase Dashboard → Authentication → Users**.
2. Nâng quyền bằng SQL (thay UUID/email thật của quản trị viên):

```sql
UPDATE public.profiles
SET role = 'admin', account_status = 'approved'
WHERE email = '<admin-email>';
```

3. Bật xác thực 2 bước (MFA / TOTP) cho tài khoản Admin trong Supabase Auth (Authentication → Providers / MFA) để bảo vệ quyền quản trị lớp học.

## 4. Các điểm cần Chủ app quyết định (Audit)
1. **Lịch sử Git (`git log`) trước bản 1.2:**
   - Hai commit trước đây (`b774e01` và `63d9935`) từng lưu bí danh/email quản trị cũ và hàm ghi plaintext trong lịch sử Git công khai (`src/lib/supabase.ts`, `src/lib/lmsStore.ts`, `supabase/functions/auth-manager/index.ts`, `README.md`, `supabase/migrations/004_student_credentials.sql`).
   - Mã nguồn hiện tại và `dist/` bản 1.2 đã dọn sạch 100%, nhưng nếu muốn xóa khỏi lịch sử commit cũ, Chủ app cần quyết định chạy `git filter-repo` (force-push `main`) hoặc đổi hẳn email đăng nhập Admin mới.
2. **Dữ liệu gắn nhãn `bookLesson` (922 mục từ giáo trình):**
   - Kiểm tra tự động ghi nhận **922** mục từ mang trường `bookLesson` phân bổ ở:
     - `public/data/vocab/hsk-2.json` (`1` mục)
     - `public/data/vocab/hsk-3.json` (`20` mục)
     - `public/data/vocab/hsk-4.json` (`43` mục)
     - `public/data/vocab/hsk-5.json` (`148` mục)
     - `public/data/vocab/hsk-6.json` (`710` mục)
     - Tham chiếu mã nguồn: `scripts/build-hsk-data.py` (dòng 180, 239, 262, 292, 299) và `src/types/vocab.ts` (dòng 14, 29, 44).
   - Toàn bộ các mục từ này đều là từ vựng chuẩn trong bộ dữ liệu mở, không chứa đoạn bài khóa hay trang sách PDF; tuy nhiên nếu muốn gỡ hẳn trường `bookLesson` hoặc chuyển repo sang Private, Chủ app xác nhận để cập nhật ở bước kế tiếp.
