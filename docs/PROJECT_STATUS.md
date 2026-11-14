# Trạng thái và bàn giao XTN

Cập nhật 2026-11-14: backend đã chuyển sang **PostgreSQL (Neon)** và **đang chạy
thật** trên Vercel: API https://xtn-api.vercel.app, web
https://volunteer-vovinam-hcmute.vercel.app. Không còn dùng MongoDB/Mongoose.
Xem [PostgreSQL (Neon) + Vercel](production/postgres-neon.md). Phần lịch sử
Mongo bên dưới giữ làm bằng chứng của snapshot trước khi chuyển đổi.

Cập nhật 2026-10-10. Nhánh chuẩn **main**. Người dùng yêu cầu dọn laptop, xóa dữ
liệu XTN và lưu source để sau này clone lại. Dự án hiện **không chạy**; không còn
DB local, volume/chứng chỉ, backup, secrets, admin credential hoặc lịch backup/
health của dự án. Giữ source và bằng chứng đã commit. Xem [cleanup.json](production/cleanup.json).

## Đã hoàn thiện và kiểm chứng

- Backend domain/application/persistence/HTTP; Express `/api/v1`, PostgreSQL
  transaction + advisory write lock, Zod; frontend React 19/TypeScript/TanStack
  Query/Vite.
- Đặt/đổi/hủy đơn giữ hàng nguyên tử; nhận một phần/nhiều đợt; lô snapshot
  giá bán/giá vốn. Bán, hư, tặng hàng tốt/hư; kiểm tra sở hữu/lịch sử chặn tồn âm.
- Nhiều báo cáo delta mỗi tuần, duyệt và correction đảo/thay thế; audit,
  optimistic version/idempotency. Tuần Việt Nam theo hoạt động, tách deadline/
  gia hạn/ngày nộp; chốt/mở lại. Guard/revision chống write skew đã kiểm chứng.
- Doanh thu/lãi đóng góp tuần và nhiều tuần; KPI có trọng số theo tổng mục tiêu,
  thiếu dữ liệu trả chưa xác định. Thu/chi độc lập, nhãn/lọc/hủy giao dịch;
  thành viên/mục tiêu/task. Auth theo account/version DB; thu hồi phiên khi
  reset/disable/logout, tách rate limit login khỏi refresh phiên.
- 23 index query bằng migration rõ ràng, không autoIndex startup. Tối ưu query
  nhóm/phân trang, giữ tổng tổ chức độc lập trang chi tiết.
- Responsive 320–1920px, vùng cuộn bảng/focus bàn phím, form/nút mobile và
  sidebar/kanban linh hoạt. 231 lượt trang/viewport trên Chromium/Firefox/WebKit,
  cho quản trị/thành viên; browser thật với viewport mô phỏng.
- Kit Docker một máy: Mongo xác thực, API nonroot/read-only, Caddy, secrets
  riêng, backup dừng writer, restore thay DB ứng dụng, release/rollback image.
  Laptop HTTP loopback; VPS có cấu hình HTTPS/domain riêng.

Baseline nghiệp vụ/responsive đã kiểm chứng ở `84749e9`; cấu hình laptop thủ công
ở `bd35afe`. [CI xanh](https://github.com/huy-dataguy/XTN-2026/actions/runs/38041473953)
gồm 22 backend tests, 4 luồng nghiệp vụ + responsive Chromium, cross-browser và
container HTTPS/giao dịch/backup/restore/restart/release/rollback trên runner sạch.
Evidence: [full-check](redesign/evidence/full-check/verification.json),
[responsive](production/responsive/verification.json), [production](production/README.md).

Benchmark local: 1.000 thành viên, 52.100 báo cáo, 104.400 biến động lịch sử tổng
hợp + giao dịch HTTP/Chromium thực; xem [scale-verification.md](redesign/scale-verification.md).
Không suy rộng thành SLO cloud/mọi tải. Chưa thử mất điện vật lý/OS reboot.

## Giới hạn và việc tiếp theo

Lãi đóng góp chưa trừ hoa hồng, chi phí vận hành và thuế. Chưa có quy trình trả
hàng/hoàn tiền, thuế và vận chuyển bán lẻ đầy đủ. Dữ liệu legacy chưa chuyển đổi;
cleanup xóa cả backup local nên không có dữ liệu đó để tự phục hồi. Mặc định hạn
nộp thứ Hai 23:59, KPI doanh thu; quản trị có thể gia hạn. Đổi chính sách cần sửa
hợp đồng và kiểm chứng số liệu, không sửa rải rác UI.

Cloud hiện tại: PostgreSQL Neon + API/web Vercel, schema và admin đã khởi tạo.
Việc tiếp theo là backup/restore cloud thật, theo dõi lỗi serverless, kiểm chứng
tải trên Neon và nhập dữ liệu cũ nếu cần (chưa chuyển tự động). Xem
[PostgreSQL (Neon) + Vercel](production/postgres-neon.md). Không dùng
[Kế hoạch MongoDB Cloud](production/mongodb-cloud.md) đã lỗi thời.

## Clone và tái dựng

```bash
git clone https://github.com/huy-dataguy/XTN-2026.git
cd XTN-2026
git switch main
# Node 24 (.nvmrc), Docker Compose v2, Python 3.
npm ci --prefix backend
npm ci --prefix frontend
```

Bản laptop cũ (Mongo) chỉ còn là lịch sử, không dùng nữa. Dựng lại cloud:

```bash
cd backend && npm ci
DATABASE_URL=... npm run migrate
BOOTSTRAP_ADMIN=true ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run bootstrap:admin
vercel --prod --yes   # API
cd .. && vercel --prod --yes   # web (Root Directory = frontend)
```

Xem [PostgreSQL (Neon) + Vercel](production/postgres-neon.md) cho biến môi trường
và lệnh test. Không commit secret/URI có credential; không dùng fixture/evidence
làm dữ liệu thật.

Kiểm chứng hiện tại:

```bash
cd backend
npm test
TEST_DATABASE_URL=postgresql://.../xtn_test?sslmode=require npm run test:integration
cd ../frontend && npm run build
```

Test tích hợp Postgres chạy trên database tên `xtn_test*`, truncate bảng trước
mỗi lần và đã pass 8 nhóm (auth, idempotency, tồn kho đồng thời, nhận hàng, báo
cáo/sửa, chốt/mở kỳ, thu chi). Các script `verify-*.py` và Mongo local là lịch
sử, không còn dùng.

Các hướng dẫn runtime cũ mô tả lần chạy trước. laptop-operations.json,
laptop-autostart.json, credential links và ảnh chụp là lịch sử; ưu tiên trạng thái
ở tài liệu này và cleanup.json. Các file/runtime private đã xóa, không clone về được.
