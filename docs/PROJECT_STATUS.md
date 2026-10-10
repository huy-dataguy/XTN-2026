# Trạng thái và bàn giao XTN

Cập nhật 2026-10-10. Nhánh chuẩn **main**. Người dùng yêu cầu dọn laptop, xóa dữ
liệu XTN và lưu source để sau này clone lại. Dự án hiện **không chạy**; không còn
DB local, volume/chứng chỉ, backup, secrets, admin credential hoặc lịch backup/
health của dự án. Giữ source và bằng chứng đã commit. Xem [cleanup.json](production/cleanup.json).

## Đã hoàn thiện và kiểm chứng

- Backend domain/application/persistence/HTTP; Express `/api/v1`, Mongoose
  transaction, Zod; frontend React 19/TypeScript/TanStack Query/Vite.
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

Ưu tiên tiếp theo là [MongoDB Cloud](production/mongodb-cloud.md): cấu hình URI/
secrets và deployment API/web không phụ thuộc Mongo local; explicit index/admin
bootstrap, kiểm tra transaction/workflow/backup/restore/tải trên cloud thật.
Chưa thực hiện những việc này. Không cần đổi domain model chỉ để đổi Mongo host.

## Clone và tái dựng

```bash
git clone https://github.com/huy-dataguy/XTN-2026.git
cd XTN-2026
git switch main
# Node 24 (.nvmrc), Docker Compose v2, Python 3.
npm ci --prefix backend
npm ci --prefix frontend
```

Bản laptop với DB mới, chỉ dựng khi cần:

```bash
python3 scripts/prepare-production.py --laptop
bash scripts/production.sh init
# http://localhost:8080; credential mới: .local/production/admin-credentials.json.
bash scripts/production.sh stop
# Các lần sau: bash scripts/production.sh up
```

Không có tự khởi động. Không chạy install-laptop-timers.py nếu chưa cần lịch;
không dùng fixture/evidence làm dữ liệu thật.

Kiểm chứng trên clone sạch, DB/port riêng:

```bash
bash scripts/start-test-mongo.sh
cd frontend
npx playwright install --with-deps chromium firefox webkit
cd ..
python3 scripts/verify-full.py
python3 scripts/verify-responsive.py
python3 scripts/verify-production.py
```

Full-check dùng Mongo 27028, API 5001, preview 5174; election sau browser.
Responsive dùng fixture vừa tạo. Production verifier tạo hai sandbox, từ chối
ghi đè sandbox đã tồn tại. Không chạy scale cùng election; dừng test containers
khi xong. Giữ failure evidence khi điều tra, báo đúng phạm vi kiểm tra.

Các hướng dẫn runtime cũ mô tả lần chạy trước. laptop-operations.json,
laptop-autostart.json, credential links và ảnh chụp là lịch sử; ưu tiên trạng thái
ở tài liệu này và cleanup.json. Các file/runtime private đã xóa, không clone về được.
