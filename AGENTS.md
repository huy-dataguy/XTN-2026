# XTN — bàn giao cho coding agent

Đọc **docs/PROJECT_STATUS.md**, rồi docs/redesign/implementation-contract.md và
docs/redesign/data-contract.md trước khi thay đổi kiến trúc/nghiệp vụ.

- Trạng thái hiện tại: backend đã chuyển sang PostgreSQL (Neon) và API/web đang
  chạy thật trên Vercel. Không còn Mongo/Mongoose. Không có localhost:8080 hay
  Mongo test; test tích hợp dùng database `xtn_test*` trên Neon qua
  `TEST_DATABASE_URL`. Xem docs/production/postgres-neon.md.
- Node 24; Express/PostgreSQL (`pg`) và React/TypeScript. Core ở
  backend/src/domain và backend/src/application; persistence ở
  backend/src/infrastructure; frontend hiển thị số liệu API, không tính lại tài chính.
- Giữ transaction/advisory write lock, snapshot giá/cost, delta report, correction
  đảo/thay thế, ownership/version/idempotency và revision/fence hiện có. Không bỏ
  guard tuần tự hóa ghi để làm test qua.
- Dự định tiếp theo: backup/restore cloud thật và kiểm chứng tải Neon; nhập dữ
  liệu cũ nếu cần. Backend nhận DATABASE_URL. Mongo Cloud doc đã lỗi thời.
- Test dùng database `xtn_test*` riêng, không seed dữ liệu mẫu vào DB thật.
  Không commit .env/.local/secrets/backup/URI có credential.
- Tái dựng và kiểm chứng theo PROJECT_STATUS.md. Evidence cũ chứng minh snapshot
  code đã kiểm tra, không chứng minh dịch vụ đang chạy sau cleanup.
- Laptop chạy thủ công; chỉ bật lại autostart/timer nếu có yêu cầu mới. Docker
  và user settings chung của máy không thuộc scope cleanup dự án.
