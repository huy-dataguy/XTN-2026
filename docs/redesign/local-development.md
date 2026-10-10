# Chạy toàn dự án với MongoDB local

MongoDB phát triển: **127.0.0.1:27017**, replica set `xtn-local`, database `xtn_local`.
Volume Docker `xtn-local_mongo-data` giữ dữ liệu khi restart/stop container. Không dùng
Mongo cloud trong cấu hình hiện tại. Đây là replica một node để hỗ trợ transaction;
không phải cấu hình high availability.

```bash
# Từ thư mục XTN-2026
bash scripts/start-local-mongo.sh
cd backend
npm ci
# Lần đầu: cp .env.example .env và đặt JWT_SECRET ngẫu nhiên >=32 ký tự.
# Lần đầu database trống: bootstrap admin bằng credential riêng, xem runbook.
npm start
```

Migration index từ repository root (đã áp dụng trên local hiện tại):

```bash
node scripts/migrate-indexes.cjs          # kiểm tra, không thay đổi
node scripts/migrate-indexes.cjs --apply  # tạo index còn thiếu, chạy lại an toàn
```

Trong shell khác:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Frontend http://127.0.0.1:5173, API http://127.0.0.1:5000/api/v1,
readiness http://127.0.0.1:5000/health/ready. Tài khoản quản trị local đã được cấp
trong lần kiểm chứng này; thông tin nằm ở `.local/admin-credentials.json` (quyền 600,
không đưa vào Git). `.env` cũng không đưa vào Git. Database local chưa có dữ liệu
nghiệp vụ cũ; không giả định đây là dữ liệu đã chuyển đổi từ hệ thống trước.

## Full check trên hạ tầng thật

Kiểm thử dùng **27028**, database `xtn_refactor_test_*`, API **5001**, frontend build
preview **5174**. Tách toàn bộ khỏi database phát triển và frontend 5173. Script yêu
cầu Docker, Node 24 và Chromium của Playwright đã cài.

```bash
bash scripts/start-test-mongo.sh
cd frontend
npx playwright install chromium
cd ..
python3 scripts/verify-full.py
```

Script kiểm tra startup sai cấu hình/Mongo standalone, backend integration trên
Mongo replica set, typecheck, lint, build, dependency audit, Chromium dùng bản build
thật migration index/chạy lại migration và election sau khi browser kết thúc. Exit khác 0 là fail, không bỏ qua.
Các database mỗi lần dùng suffix mới; không drop database phát triển.
Kiểm tra trực tiếp phiên bản dev và dữ liệu giữ sau restart Mongo:

```bash
node scripts/verify-local.cjs
```

Bằng chứng và exit codes nằm ở `docs/redesign/evidence/full-check/verification.json`.

Dừng dịch vụ local bằng Ctrl+C ở shell tương ứng, dừng Mongo bằng:

```bash
docker compose -f infra/compose.local.yml stop
```

Không dùng `down -v` nếu muốn giữ dữ liệu. `start-local-mongo.sh` có thể chạy lại
mà không reset replica set đã cấu hình. Hạ tầng test có thể giữ lại để chạy suite
lần sau; `start-test-mongo.sh` từ chối thay thế container đã có, nên khi đã chạy chỉ
cần chạy `verify-full.py` với các container đang hoạt động.

## Sau này chuyển Mongo cloud

Chỉ đổi `MONGO_URI` trong môi trường backend sang URI `mongodb+srv` của cluster đã
hỗ trợ transaction. Không đặt URI/password database trong frontend. Cấu hình TLS,
network access và user quyền phù hợp tại cloud; đối soát/chuyển dữ liệu là bước riêng,
đổi URI không tự di chuyển dữ liệu local. Giữ API/frontend và quy tắc nghiệp vụ.
Kiểm chứng lại startup, transaction, latency, failover và backup/restore trên cluster
mới trước khi sử dụng số liệu chính thức.
