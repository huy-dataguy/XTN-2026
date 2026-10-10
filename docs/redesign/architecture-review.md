# Đánh giá kiến trúc XTN-2026

Ngày: 2026-10-09. Baseline: `ecbac8b`. Nhánh làm việc: `feature/redesign-ecommerce`.

## Kết luận

Dự án hiện là công cụ vận hành bán hàng qua cộng tác viên: cấp hàng, duyệt đơn,
báo cáo tuần, sao kê, công việc nội bộ. Chưa đủ bằng chứng nghiệp vụ để coi đây
là cửa hàng bán trực tiếp cho khách. Có thể kế thừa các màn hình và chức năng,
nhưng lõi quyền truy cập, tồn kho, báo cáo và đối soát cần thiết kế lại trước
khi mở rộng. Build thành công không chứng minh các luồng hàng/tiền đúng.

Phạm vi lần này: đọc toàn bộ models/routes/middleware backend; entrypoint,
App, services, types, cấu hình frontend và logic báo cáo/dashboard; kiểm tra
các trang vận hành liên quan. Chưa thực hiện audit hình ảnh UI trong browser,
load test, penetration test hay kiểm tra dữ liệu thật.

## Phương pháp và giới hạn chứng cứ

- Phát hiện tĩnh dẫn tới file và dòng của baseline.
- `scripts/audit-probes.cjs` chạy handler thật, thay persistence bằng fake trong
  process riêng, bỏ qua middleware xác thực và cấp `req.user` đại diện token hợp lệ.
- P04 giả lập thao tác save; chứng minh nhánh kiểm tra mã mời bị vượt khi cấu hình
  thiếu. Chưa biết production có thiếu cấu hình hay không.
- P07 chạy validation thật của Mongoose, không kết nối database.
- Exit code 0 của probes nghĩa là **tái hiện đúng lỗi baseline**, không phải hệ
  thống đạt tiêu chuẩn. Harness này sẽ phải đổi thành regression tests khi sửa.
- Chưa chứng minh race condition bằng MongoDB thật; nhận định concurrency là rủi ro
  suy ra từ chuỗi read-modify-save không có transaction/điều kiện atomic.
- Không khởi chạy `backend/server.js` vì nó nối MongoDB qua môi trường vận hành;
  không dùng endpoint API đang deploy, không thay đổi dữ liệu hay schema.

## Phát hiện ưu tiên

P0: quyền quản trị hoặc tính toàn vẹn hàng/tiền có thể bị phá vỡ.
P1: sai quy trình, thiếu truy vết hoặc thiếu kiểm chứng trước phát hành.
P2: khó bảo trì, trải nghiệm và hiệu năng cần cải thiện.

| ID | Mức | Bằng chứng | Tác động và cách tái hiện |
| --- | --- | --- | --- |
| A01 | P0 | `backend/routes/auth.js:13-23` | Mã môi trường và mã request cùng undefined thì so sánh cho phép đăng ký ADMIN. P04 trả 200. Phải fail startup nếu thiếu config, quản trị qua invitation có hạn/quyền rõ ràng. |
| A02 | P0 | `backend/routes/orders.js:39-57`; `backend/models/Order.js:5-11` | quantity không được kiểm tra nguyên dương. P01 quantity=-2 khiến kho 10→12, tiền=-200. P07 schema cũng chấp nhận. |
| A03 | P0 | `backend/routes/orders.js:39-67` | Lưu từng product trước khi lưu order. P02 product thứ hai không tồn tại: 404 nhưng product đầu đã mất 2. Crash/save-order fail có cùng cửa sổ mất dữ liệu. |
| A04 | P0 | `backend/routes/orders.js:93-102` | Có auth nhưng thiếu role/owner/state check. P03 distributor sửa order người khác. UI admin không thay thế phân quyền API. |
| A05 | P0 | `backend/routes/reports.js:44-69,93-101`; `backend/models/Report.js:6-16` | Backend lưu revenue, sold, damaged, remaining do client gửi. P05 tổng 999999 với details rỗng và damaged âm vẫn qua handler. P07 schema chấp nhận damaged âm. |
| A06 | P1 | `backend/routes/tasks.js:8,22,45,61` | Task được mô tả là công việc admin nhưng mọi token hợp lệ có thể đọc/tạo/sửa/xóa; P06 distributor xóa task người khác. Cần chốt policy quyền nội bộ. |
| A07 | P1 | `backend/routes/orders.js:75-83,135-145` | Status cập nhật tùy ý, không runValidators/transition guard; REJECTED không trả reservation. Xóa đơn hoàn kho kể cả khi đã giao, không atomic, concurrent delete có rủi ro hoàn hai lần. |
| A08 | P1 | `frontend/src/pages/distributor/ReportPage.tsx:81-137,158-182` | Hàng nhận tính từ APPROVED và createdAt, không xét isReceived/receivedAt. Revenue dùng giá product hiện tại. Tồn đầu lấy một report gần nhất, chưa có ledger để đảm bảo đúng khi nhiều report/tuần hoặc bỏ kỳ. |
| A09 | P1 | `backend/routes/reports.js:54-56,118-122,137-164` | Kiểm tra trùng tuần bị comment; report đã duyệt vẫn được admin sửa/xóa, không revision/audit. Cập nhật user: nhiều báo cáo/tuần hợp lệ; cần delta/revision/idempotency, không unique mỗi submission theo member-week. |
| A10 | P1 | `backend/routes/users.js:43-49,67-90`; `backend/middleware/auth.js:10-12` | Mật khẩu mặc định 123; trả document gồm password hash; token role có hạn 1 ngày không kiểm tra trạng thái tài khoản. Đổi password/xóa user không tự vô hiệu token còn hạn. |
| A11 | P1 | `backend/routes/auth.js:95-136`; `backend/routes/users.js:58`; `backend/routes/orders.js:164-174` | Impersonation không lưu actor gốc; quyền đặc biệt dựa username admin0; có thể sửa createdAt. Thiếu audit actor/action/reason và tách ngày nghiệp vụ khỏi thời điểm tạo bất biến. |
| A12 | P1 | `backend/models/Statement.js:5-25`; `backend/routes/statements.js:30-39,59,74-85` | Sao kê nhập balance thủ công, không link payment/report/order, không external transaction ID chống trùng; sửa/xóa mất lịch sử. Model tên Statement1 cần khảo sát collection thật trước migrate. |
| A13 | P1 | `backend/server.js:10-16,27-28`; `backend/package.json` | Listen trước DB ready; connect lỗi chỉ log. Không health/readiness, config validation, structured error/log, start/test script. Auth chưa có rate limiter trong repo; CORS mở mọi origin. |
| A14 | P1 | `frontend/eslint.config.js:10`; `frontend/package.json`; `frontend/src/services/mockBackend.ts:13-15` | Lint bỏ TS/TSX; build chỉ bundle/transpile, không tsc gate; không tsconfig/TypeScript dependency khai báo. Mock còn tham chiếu enum GOLD/SILVER/NEW đã mất. Không thấy tests hoặc CI được tracked. |
| A15 | P2 | `frontend/src/App.tsx:47-69`; `backend/routes/orders.js:16`; `backend/routes/reports.js:18` | Tải toàn bộ products/orders/reports/users và refetch toàn bộ sau thao tác; không pagination. Một API fail làm Promise.all không cập nhật cả nhóm; thiếu lỗi/retry riêng từng trang. |
| A16 | P2 | `frontend/src/types.ts:65,77`; `backend/routes/orders.js:16-22`; `backend/routes/reports.js:20-28` | Contract khai báo ID string nhưng API populate object; UI phải any/_id/id fallback. API errors trộn text/msg, UI có nơi đọc message. Thiếu DTO/schema thống nhất. |
| A17 | P2 | `frontend/src/main.jsx:4,7-14`; `frontend/src/redux/store.js:19-24`; `frontend/src/routers/router.jsx` | Entry import App.jsx trong khi file thật App.tsx (Vite hiện resolve được), router phụ không dùng, Redux reducer rỗng, mock không import vào luồng chính. Dọn sau khi có gates. |
| A18 | P2 | `frontend/src/pages/admin/AdminDashboard.tsx:44,93,119`; `frontend/src/pages/distributor/OrderPage.tsx:87`; `frontend/src/pages/admin/StatementPage.tsx:22` | USD/VND và ngôn ngữ không nhất quán; key biểu đồ tuần bỏ năm. Cần currency/timezone thống nhất, khóa theo period ID đầy đủ. |

## Những phần có thể giữ

Giá đơn được lấy từ server và có snapshot tên/giá; login hash bcrypt;
GET orders/reports giới hạn distributor theo token; nhiều endpoint admin đã
kiểm tra role; frontend tách một số services khỏi UI. Các điểm này là nền để
refactor theo lát cắt thay vì vứt bỏ toàn bộ cùng lúc.

## Đánh giá khả năng e-commerce

| Năng lực | Hiện trạng |
| --- | --- |
| Identity và phân quyền | Có hai role, policy chưa đầy đủ |
| Catalog | Có CRUD, thiếu SKU/variant, active/archive, lịch sử giá |
| Inventory | Một stock trên product, thiếu reservations/movements/location |
| Order allocation | Có PENDING/APPROVED/REJECTED, thiếu state machine và idempotency |
| Fulfillment | Boolean isReceived, không thời điểm nhận/partial delivery |
| Sales reporting | Tổng client gửi, thiếu nguồn giao dịch kiểm chứng |
| Settlement | Sao kê thủ công tách khỏi hàng và công nợ |
| Customer checkout/payment/refund | Chưa thấy model/API tương ứng; chỉ cần bổ sung nếu chốt bán trực tiếp |
| Operations | Thiếu gates khởi động, health, audit và integration tests |

## Kết quả chạy

Node v24.15.0, npm 11.12.1; dependencies cài bằng npm ci từ lockfile.

| Lệnh | Exit | Ý nghĩa |
| --- | --- | --- |
| `node scripts/audit-probes.cjs` | 0 | 7 lỗi baseline được tái hiện ở chế độ cô lập |
| `node --check backend/server.js` | 0 | Syntax hợp lệ, chưa boot/integration |
| `cd frontend && npm run build` | 0 | 2399 modules; JS bundle ~862 kB, có warning kích thước và browser-data cũ |
| `cd frontend && npm run lint` | 0 | Chỉ JS/JSX theo config hiện tại |
| `cd frontend && npx eslint --print-config src/App.tsx` | 0 | Output undefined: TSX chưa thuộc lint config |

Artifacts: `evidence/baseline-probes.json`, `evidence/frontend-build.log`,
`evidence/frontend-lint.log`, `evidence/verification.json`.

## Tài liệu kỹ thuật đối chiếu

- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html): rollback nhiều thao tác bằng session/transaction; không chạy song song các thao tác bên trong một transaction.
- [Mongoose validation](https://mongoosejs.com/docs/validation.html): update validators cần bật rõ và có giới hạn; không thay thế validation nghiệp vụ/state transition.
- [TypeScript compiler options](https://www.typescriptlang.org/docs/handbook/compiler-options.html): thiết lập một bước typecheck riêng với noEmit cho code TypeScript.

Đọc tài liệu hiện hành để đối chiếu nguyên tắc; khi triển khai phải kiểm tra
hành vi trên chính phiên bản trong lockfile và DB topology của dự án.
