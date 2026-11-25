# Lịch sử phiên bản — Hoa Ngữ Cô Mai

## [1.2.0] - 2026-11-25
### Bảo mật & Quyền riêng tư
- Xác định quyền quản trị hoàn toàn qua `profiles.role = 'admin'` ở phía máy chủ; gỡ bỏ bí danh đăng nhập mẫu, dữ liệu demo trong bản build công khai và loại bỏ toàn bộ định danh/tên thật khỏi mã nguồn.
- Thêm migration `005_drop_plaintext_passwords.sql` xóa bảng lưu mật khẩu dạng văn bản thuần; cập nhật `auth-manager` Edge Function để chỉ trả mật khẩu tạm 1 lần khi tạo mới hoặc đặt lại mật khẩu.
- Giới hạn CORS `auth-manager` theo `ALLOWED_ORIGINS` env/secret, đưa danh sách email giữ chỗ sang secret, thêm giới hạn tần suất theo IP (5 lượt/15 phút) cho `student_signup`.
- Chuyển khóa lưu cục bộ sang `hsk_lms_state_v4` (kèm đoạn di chuyển dữ liệu cũ để không mất tiến độ học viên).

### Dữ liệu HSK 3.0 (Bản chốt 11/2025) & Từ mở rộng
- Chuẩn hóa **10.896 từ cốt lõi** (`source: 'core'`) theo đúng đề cương HSK 3.0 bản chốt 11/2025 (tích lũy cấp 1–6: 300 / 497 / 988 / 1.978 / 3.557 / 5.334), giữ ánh xạ song song `hsk2Level` (4.991 từ) và cho phép chuyển đổi `3.0` / `2.0`.
- Bổ sung **3.683 từ mở rộng thực dụng** (`source: 'extra'`, tổng **14.579 từ**), bao gồm **62 Từ lóng mạng** gắn nhãn chờ cô duyệt (`reviewed: false`), điền đủ 100% từ loại (`pos`) và nghĩa tiếng Anh.
- Xây dựng **4.716 câu ví dụ phân cấp** từ Tatoeba (bao gồm 915 cặp `cmn-vie` trực tiếp, 3.801 câu `cmn-eng` dịch tĩnh và 1.772 câu có âm thanh người bản xứ); ưu tiên phát âm Tatoeba audio → Web Speech `zh-CN` → Google/Baidu fallback.

### Ngữ pháp HSK 1–3, Đề thi thử & Duyệt nội dung
- Bổ sung bộ **86 bài ngữ pháp HSK 1–3** (tương ứng **430 bài tập tự chấm** dạng trắc nghiệm, điền khuyết, sắp xếp câu) có so sánh trật tự câu Việt–Trung, gắn nhãn `Đang chờ cô duyệt` và kết nối chung hàng đợi SRS khi làm sai.
- Hỗ trợ cấu trúc phòng thi **HSK 3.0** (40/60/70/70/72/82 câu, chấm % đúng + điểm ước lượng tham khảo) và **HSK 2.0**, màn hình `"Xu hướng ra đề"`, **12 đề thi thử soạn mới cho HSK 3–6** kèm coaching 3 lớp (`Bẫy` / `Mẹo sát đề` / `Ví dụ tương tự`) và tab Quản trị `"Duyệt nội dung"`.

### Trải nghiệm di động, Học hôm nay, PWA & Tính năng tương tác
- Rút gọn điều hướng học viên còn 4 mục (`Hôm nay`, `Từ vựng`, `Luyện tập`, `Thi thử`) + menu Avatar, tối ưu 1 chạm từ trang chủ tới thẻ đầu tiên (`/today`).
- Giới hạn tối đa 100 thẻ ôn/ngày (ưu tiên quá hạn lâu nhất), mặc định 10 từ mới (`5/10/15/20`), nhắc lại thẻ `Quên` trong cùng phiên, tự gắn nhóm `"Từ khó"` ở ngưỡng sai ≥ 8 lần, xen kẽ câu điền khuyết Cloze và chế độ thú cưng dịu (`still` / `slow` / `off`).
- Thêm chia sẻ ảnh thành tích Canvas 1080×1350, thử thách 60s + bảng xếp hạng opt-in, luyện phát âm `zh-CN`, Workbox PWA offline cache (loại trừ `search-index.json`) và đồng bộ `updated_at` kèm hàng đợi offline.
