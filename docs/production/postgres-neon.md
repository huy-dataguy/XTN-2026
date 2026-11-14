# PostgreSQL (Neon) + Vercel

Cập nhật 2026-11-14. Backend đã chuyển từ MongoDB/Mongoose sang PostgreSQL
(`pg`) và chạy thật trên Neon + Vercel. Không còn phụ thuộc Mongo hay tiến trình
local.

## Kiến trúc hiện tại

- Database: Neon PostgreSQL 18, database `neondb`, schema `public`; kết nối qua
  pooled endpoint với `sslmode=require` (bỏ tham số `channel_binding` khi tạo
  pool vì `pg` không dùng libpq).
- API: Express `/api/v1` chạy serverless trên Vercel tại
  https://xtn-api.vercel.app. Biến môi trường production/preview:
  `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `TRUST_PROXY_HOPS=1`,
  `NODE_ENV=production`. Secret không nằm trong Git.
- Web: React/Vite trên Vercel tại https://volunteer-vovinam-hcmute.vercel.app,
  build với `VITE_API_BASE_URL=https://xtn-api.vercel.app/api/v1`.
- Persistence: `src/infrastructure/db.js` (pool, transaction, ObjectId tương
  thích 24 hex), `repository.js` (truy vấn), `schema.sql` (DDL + index).

## Giao dịch và đồng thời

Mỗi lệnh ghi chạy trong transaction và lấy `pg_advisory_xact_lock` dùng chung,
giữ nguyên mô hình "shared guard" đã kiểm chứng: tuần tự hóa ghi để chống write
skew giữa nhận hàng/báo cáo ngược ngày và chốt kỳ. Đọc phân tích dùng
`REPEATABLE READ READ ONLY`. Idempotency lưu ở bảng `commands` với ràng buộc
khóa chính; version/optimistic vẫn kiểm tra trong transaction.

## Vận hành

```bash
cd backend
npm ci
DATABASE_URL=... npm run migrate        # idempotent, tạo schema + index
BOOTSTRAP_ADMIN=true ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run bootstrap:admin
npm test                                # domain; integration cần TEST_DATABASE_URL
```

Test tích hợp chỉ chấp nhận database có tên `xtn_test*`:

```bash
TEST_DATABASE_URL=postgresql://.../xtn_test?sslmode=require npm run test:integration
```

Triển khai lại API (từ `backend/`):

```bash
vercel env add DATABASE_URL production --value "..." --yes
vercel --prod --yes
```

Triển khai lại web (từ root repo, vì Root Directory của project là `frontend`):

```bash
vercel env add VITE_API_BASE_URL production --value https://xtn-api.vercel.app/api/v1 --yes
vercel --prod --yes
```

## Giới hạn

- Chưa thiết lập backup/restore tự động cho Neon; chưa có evidence phục hồi cloud.
- Rate limit dùng memory của từng instance serverless, không dùng chung toàn cụm.
- Dữ liệu Mongo local cũ không được chuyển tự động; database thật bắt đầu trắng
  với quản trị tạo bằng bootstrap. Cần kế hoạch đối soát riêng nếu muốn nhập lại.
- Benchmark/scale cũ chạy trên Mongo local, không dùng làm cam kết cho Neon.
