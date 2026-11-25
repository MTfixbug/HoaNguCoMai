# Nguồn dữ liệu & Ghi công (Data Sources & Attribution)

Bản **Hoa Ngữ Cô Mai v1.2** sử dụng hoàn toàn dữ liệu mở đã kiểm chứng kết hợp phần biên soạn tĩnh tiếng Việt gắn nhãn `reviewed: false` (chờ giáo viên duyệt). Không có giáo trình có bản quyền hoặc đề thi chính thức của CTI bị sao chép trực tiếp vào kho dữ liệu công khai; đề chính thức chỉ dẫn liên kết tham khảo.

## 1. Danh mục từ vựng HSK 3.0 & HSK 2.0
- **Đề cương HSK 3.0 chính thức (ban hành 11/2025, áp dụng từ 13/12/2026)**:
  - Nguồn tham chiếu: *《国际中文教育中文水平等级标准》 / 新版 HSK 考试大纲* (Chinese Testing International / Bộ Giáo dục Trung Quốc).
  - Bảng từ vựng cộng đồng đối chiếu theo chuẩn 11/2025 (`standard: "hsk-syllabus-2025"`): [`krmanik/HSK-3.0`](https://github.com/krmanik/HSK-3.0) (`New HSK (2025)` — phần ngữ pháp và danh mục từ theo giấy phép nguồn mở của kho lưu trữ).
- **Ánh xạ song song HSK 2.0 (`o1`–`o6`) & Pinyin / Phồn thể / Nghĩa tiếng Anh**:
  - [`drkameleon/complete-hsk-vocabulary`](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT License).
- **Nghĩa tiếng Anh & Từ điển gốc**:
  - **CC-CEDICT** (MDBG Chinese-English Dictionary) — cấp phép theo [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Nghĩa tiếng Việt & Âm Hán-Việt**:
  - **CVDICT** (Từ điển Trung–Việt cộng đồng phát triển từ CC-CEDICT, dùng làm dữ liệu nền cho nghĩa tiếng Việt cốt lõi).
  - Bảng đối chiếu **Hán-Việt** (`hanviet.csv`) — từ điển chữ Hán–Việt nguồn mở.
- **Lớp từ mở rộng (`source: "extra"`) & Từ lóng mạng (`Từ lóng mạng`)**:
  - Trích lọc tần suất phổ thông từ bộ từ điển nguồn mở `jieba` + CVDICT + CC-CEDICT kết hợp nhóm từ lóng hiện đại do hệ thống biên soạn tĩnh (`reviewed: false`).

## 2. Câu ví dụ & Audio người bản xứ
- **Tatoeba Project** ([tatoeba.org](https://tatoeba.org)) — cấp phép theo [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/):
  - Dữ liệu câu tiếng Trung Quan Thoại (`cmn_sentences.tsv.bz2`), câu tiếng Việt (`vie_sentences.tsv.bz2`), câu tiếng Anh (`eng_sentences.tsv.bz2`), liên kết dịch (`links.tar.bz2`), và danh sách câu có bản thu âm người bản xứ (`cmn_sentences_with_audio.tsv.bz2` / `https://audio.tatoeba.org/sentences/cmn/<id>.mp3`).
  - Đối với các câu có cặp `cmn-vie` trực tiếp trên Tatoeba, nhãn nguồn là `tatoeba-vi` (`reviewed: true`). Các câu từ cặp `cmn-eng` được dịch tĩnh ngoại tuyến sang tiếng Việt mang nguồn `tatoeba-en-vi` kèm nhãn `reviewed: false` cho đến khi giáo viên bấm duyệt.

## 3. Ngữ pháp HSK 1–3 & Đề thi thử HSK 3–6
- Danh mục điểm ngữ pháp HSK 1–3 tham chiếu cấu trúc chủ điểm từ `HSK 语法大纲` (`krmanik/HSK-3.0`, bản 2025).
- Toàn bộ giải thích ngữ pháp, so sánh trật tự câu với tiếng Việt, cặp dễ nhầm, bài tập tự chấm, đề thi thử HSK 3–6 và coaching 3 lớp (`Bẫy` / `Mẹo sát đề` / `Ví dụ tương tự`) được **biên soạn mới hoàn toàn** ở dạng JSON tĩnh (`reviewed: false`), kèm liên kết tham khảo tới đề mẫu chính thức của CTI tại [chinesetest.cn](https://www.chinesetest.cn/).
