# ZHWeb — Nền tảng Lớp học Tiếng Trung HSK 1–9 (Cô Khánh Mai)

Hệ thống học tiếng Trung & luyện thi **HSK 1–9** thuần **Tiếng Việt – Tiếng Trung**, kết nối Supabase (`ZHWeb`) để quản lý lớp học thực tế:

- **Tách biệt hoàn toàn khỏi giáo trình PDF HSK 6 cũ**: sử dụng kho từ vựng chuẩn HSK 1–9 (**11.488 từ** qua 7 gói tải lười) kết hợp kho bài học do Giáo viên/Admin tự biên soạn ngay trên web.
- **Đăng nhập & Kiểm duyệt tài khoản chặt chẽ**:
  - Học viên mới bắt buộc đăng ký kèm **Họ tên + Gmail** và xác nhận Gmail; trạng thái mặc định là `pending` (**Chờ duyệt**).
  - Giáo viên / Quản trị (**Cô Khánh Mai**, tài khoản mặc định `Admin@Admin`) duyệt cho học hoặc khóa quyền truy cập bất kỳ lúc nào (bảo vệ bằng Postgres RLS `private.is_approved_user()` & `private.is_admin()`).
- **Lộ trình cá nhân Trình độ hiện tại → Trình độ mục tiêu**: ngay khi được duyệt lần đầu, học viên chọn cấp HSK hiện tại (hoặc làm bài test xếp lớp nhanh 8 câu) và chọn cấp HSK muốn học lên đến (`HSK 1`..`HSK 9`).
- **Tính năng học tập & Quản trị**:
  - Thẻ nhớ SM-2, luyện viết thứ tự nét chữ Hán (`hanzi-writer`), Đấu trường Trắc nghiệm (Fisher-Yates + Anti-Streak), Ghép cặp, Sắp xếp câu, Phòng thi thử chuẩn HSK 1–9 (`2x`/`1x` lượt nghe), Từ điển 11.488 từ.
  - Bảng điều khiển Quản trị 4 tab: **Duyệt & Khóa Học viên**, **Tổng quan Lớp & Biểu đồ nhiệt**, **Tạo Bài học mới**, và **Giao bài & Bảng điểm CSV**.

## Kiểm tra & Chạy local

```powershell
# Kiểm tra dữ liệu HSK 1–9 (9 file)
node scripts/validate-data.mjs

# Typecheck + Unit tests (Vitest) + Production build
npx tsc --noEmit && npm test -- --run && npm run build

# Chạy dev server
npm run dev
```
