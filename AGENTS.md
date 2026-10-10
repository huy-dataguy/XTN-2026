# XTN — bàn giao cho coding agent

Đọc **docs/PROJECT_STATUS.md**, rồi docs/redesign/implementation-contract.md và
docs/redesign/data-contract.md trước khi thay đổi kiến trúc/nghiệp vụ.

- Trạng thái hiện tại: chỉ giữ source và evidence trong Git. Đã dừng/xóa container,
  DB local, backup, secrets và lịch tự chạy theo yêu cầu người dùng. Không giả
  định localhost:8080, admin credentials hoặc Mongo test vẫn tồn tại.
- Node 24; Express/Mongoose và React/TypeScript. Core ở backend/src/domain và
  backend/src/application; frontend hiển thị số liệu API, không tính lại tài chính.
- Mongo phải hỗ trợ transaction. Giữ snapshot giá/cost, delta report, correction
  đảo/thay thế, ownership/version/idempotency và revision/fence hiện có. Snapshot
  isolation không tự chống mọi write skew; không bỏ guard để làm test qua.
- Dự định tiếp theo: MongoDB Cloud, đọc docs/production/mongodb-cloud.md.
  Backend nhận MONGO_URI; compose.production.yml hiện vẫn dựng Mongo local.
  Chưa có cloud credentials, kết nối thực, backup hay benchmark cloud.
- Test dùng DB/port riêng, không seed dữ liệu mẫu vào DB thật. Không autoIndex
  startup, không commit .env/.local/secrets/backup/URI có credential.
- Tái dựng và kiểm chứng theo PROJECT_STATUS.md. Evidence cũ chứng minh snapshot
  code đã kiểm tra, không chứng minh dịch vụ đang chạy sau cleanup.
- Laptop chạy thủ công; chỉ bật lại autostart/timer nếu có yêu cầu mới. Docker
  và user settings chung của máy không thuộc scope cleanup dự án.
