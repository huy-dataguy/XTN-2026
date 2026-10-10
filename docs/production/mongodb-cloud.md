# Hướng chuyển sang MongoDB Cloud

Kế hoạch cho lần phát triển tiếp theo, **chưa kết nối/kiểm chứng cloud**. Local DB,
backup/secrets đã xóa theo yêu cầu; bắt đầu DB cloud mới. Nhập legacy từ nguồn
khác cần migration/đối soát riêng.

Backend đọc MONGO_URI và kiểm tra topology hỗ trợ transaction. Nếu chọn Atlas,
cần database user, IP access list cho nơi chạy API và URI driver do Atlas cấp.
Tài khoản console khác database user.
[Hướng dẫn chính thức](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

Ví dụ cấu trúc (placeholder, không phải credential dùng được):

```text
mongodb+srv://<db-user>:<encoded-password>@<cluster>/xtn_production?retryWrites=true&w=majority
```

Giữ tùy chọn nhà cung cấp, encode ký tự đặc biệt, TLS và discovery topology;
không mang directConnection=true của primary test sang cloud.
[Connection string options](https://www.mongodb.com/docs/manual/reference/connection-string-options/).

## Công việc của agent tiếp theo

1. Tạo cloud sandbox riêng; kiểm tra topology/tier hỗ trợ transaction và quyền
   cần cho index migration. Không kết luận chỉ dựa trên tên tier.
2. Cấu hình private MONGO_URI, JWT_SECRET mới, NODE_ENV=production, CORS_ORIGINS,
   PORT. TRUST_PROXY_HOPS=0 nếu trực tiếp hoặc 1 sau một reverse proxy. DB user
   chỉ có quyền cần trên DB ứng dụng; không đưa secrets vào frontend/Git/image.
3. **Thêm deployment config cloud** cho API/web. compose.production.yml hiện
   dựng Mongo local và URI/dependency mongo-init/migrate; chỉ sửa env của compose
   đó chưa chuyển sang cloud. Config mới cần nhận MONGO_URI, bỏ Mongo local.
4. Explicit index migration: script hỗ trợ --production và mongodb+srv;
   NODE_ENV=production, MIGRATION_DATABASE phải trùng DB trong URI. Inspect rồi
   apply; không autoIndex/drop collection. Bootstrap admin với password mới qua
   ADMIN_PASSWORD_FILE hoặc env riêng, không tái dùng credential đã xóa.

Sau khi cấu hình backend/.env (ignored) đầy đủ và private:

```bash
node scripts/migrate-indexes.cjs --production
node scripts/migrate-indexes.cjs --production --apply
cd backend
BOOTSTRAP_ADMIN=true npm run bootstrap:admin
npm start
```

5. Test cloud sandbox thật: nhận nhiều đợt, duplicate requests, tranh chấp tồn,
   correction/backdate vs chốt kỳ, báo cáo muộn/gia hạn, hư/tặng, KPI nhiều tuần,
   lỗi kết nối/retry. Đối soát ledger/API, đo lại network/tải; không dùng benchmark
   local làm kết luận cloud. Không seed fixture vào DB thật.
6. Thử backup/restore theo provider. production.sh backup/restore hiện exec Mongo
   container local, **không dùng nguyên script cho Atlas**. Cần kiểm chứng phục
   hồi thực và giữ secrets/image release riêng; chưa có backup cloud hiện tại.
7. Ghi evidence và cập nhật PROJECT_STATUS.md khi cloud thật đạt. URI kết nối
   được chưa đủ để kết luận cloud production đã hoàn thiện.

Giữ snapshot giá/cost, delta report, period fence, version/idempotency và công
thức KPI khi đổi host. Dùng lại domain/contract; thay cấu hình triển khai và
kiểm chứng môi trường mới.
