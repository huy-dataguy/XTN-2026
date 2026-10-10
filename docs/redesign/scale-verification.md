# Kiểm chứng dữ liệu lớn và chạy thực tế

Kết luận: bản refactor chạy và đối soát đúng trong những tình huống đã kiểm chứng.
Chưa thể cam kết mọi chức năng đúng với mọi dữ liệu hoặc đạt hiệu năng production.
Đợt này đã phát hiện và sửa lỗi thuật toán mà bộ test chức năng nhỏ không phát hiện:
báo cáo từng quét lại toàn bộ lịch sử cho mỗi thành viên × tuần.

## Phạm vi và dữ liệu

Chạy Node 24.15.0, MongoDB 7 replica set 3 node trên cùng một máy, HTTP thật và
Chromium thật, không mock. Database benchmark có prefix `xtn_refactor_test_scale_`
trên cổng 27028, tách khỏi database dev `xtn_local` trên 27017.

Lịch sử tổng hợp: 1.000 thành viên, 200 sản phẩm, 26 tuần, 26.000 lô nhận,
52.100 báo cáo, 104.400 biến động và 26.000 trạng thái thành viên/tuần. Dữ liệu lịch
sử được tạo bằng ODM bulk writes để đo tải, không phải dữ liệu kinh doanh thực tế
và không giả định mọi bản ghi seed đã đi qua API. Các luồng ghi riêng bên dưới đi
qua đúng API nghiệp vụ và transaction thật. Không dùng Mongo cloud.

Fixture có báo cáo bổ sung, sửa/đảo báo cáo, hàng hư, tặng hàng tốt/hư, nộp trễ,
gia hạn, thiếu giá vốn, thiếu mục tiêu và chưa chốt đủ. Công thức độc lập xác định:
doanh thu 779.000.000 đồng, bán 77.900 sản phẩm; 91 lượt thiếu mục tiêu và 59 lượt
chưa chốt. Lãi/KPI tổng phải chưa xác định khi thiếu dữ liệu. Tồn thành viên là
130 hoặc 131 tùy correction, không cộng tồn cuối các tuần lại với nhau.

## Sửa nguyên nhân gốc

- Thay quét lặp thành nhóm biến động theo thành viên/tuần trong MongoDB và map cho
  báo cáo/trạng thái. Tất cả truy vấn nằm trong cùng snapshot transaction; giữ
  timezone Việt Nam, chi phí chưa biết và loại báo cáo đã bị thay thế.
- Phân trang chi tiết thành viên: API mặc định 50, tối đa 200; dashboard 20. Tổng
  tổ chức vẫn tính trên toàn phạm vi, không chỉ trang đang xem. Có regression test
  cho trang trống, giới hạn và tồn đầu kỳ khi đổi khoảng tuần.
- Tồn theo lô dùng một lượt lịch sử thay vì lặp toàn lịch sử cho từng lô.
  Dashboard chỉ tái dựng tồn theo trang thành viên được chọn; tổng tổ chức vẫn
  bao gồm tất cả thành viên. Lịch tuần được tính một lần cho mỗi request.
- Áp dụng 23 index bằng migration rõ ràng, kiểm tra trước khi tạo và giữ index
  sẵn có; chạy lại an toàn. AutoIndex vẫn tắt ở startup.
- Khóa tuần lấy trạng thái thành viên bằng một truy vấn thay vì N+1; giữ shared
  posting guard để không đánh đổi tính đúng khi ghi lùi ngày.
- Thu/chi dùng projected cursor thay vì nạp toàn document vào bộ nhớ.

## Kết quả đo

| Phép đo | Kết quả quan sát |
| --- | --- |
| Code trước sửa, chỉ 100 thành viên / 26 tuần | Request bị timeout ở ngưỡng 30 giây, exit 1; giữ nguyên log fail |
| Sau sửa, 100 thành viên, stream v2 | 355–420 ms, 3 request đơn lẻ |
| Aggregate trước index, 1.000 thành viên | 2.574–2.851 ms, 3 request đơn lẻ; RSS API 391–485 MB |
| 5 client đồng thời, 10 request, bản stream v2 | p95 quan sát 9.599 ms |
| 5 client đồng thời, aggregate trước index | p50 6.722 ms; p95 7.613 ms; max 7.672 ms |
| Sau 8 index đầu, cùng dataset và code aggregate | 2.272–2.600 ms, 3 request đơn lẻ |
| 8 index + tồn theo trang, 1.000 thành viên | 1.683–1.904 ms; RSS API 360–424 MB |
| 5 client đồng thời, 10 request, bản 8 index | p50 4.625 ms; p95 5.436 ms; max 5.446 ms |
| Bản cuối 23 index + tồn theo trang | 1.866–2.367 ms; RSS API 370–428 MB |
| 5 client đồng thời, 10 request, bản cuối 23 index | p50 4.931 ms; p95 5.838 ms; max 5.853 ms |
| Tạo đơn, 40 request gồm gửi trùng | p95 660 ms |
| Duyệt đơn, 20 request | p95 72 ms |
| Nhận hàng, 20 request | p95 798 ms |
| Tạo báo cáo, 20 request | p95 358 ms |
| Duyệt báo cáo, 20 request | p95 955 ms; max 1.123 ms |
| Khóa một tuần có 1.000 thành viên | 44 ms |
| Chromium tải và render báo cáo 26 tuần | 2.497 ms; 20 thành viên / 520 dòng chi tiết |

Các percentile là thống kê mẫu nhỏ trong burst concurrency=5, không phải soak test
hoặc SLO đã ký nhận. Payload API mặc định 50 thành viên vẫn khoảng 816 KB cho 26
tuần. Phân trang giới hạn dữ liệu hiển thị nhưng chưa giới hạn chi phí tính tổng
trên toàn tổ chức.

## Giao dịch và trình duyệt thực tế

20 đơn mới, mỗi đơn 6 sản phẩm; mỗi request tạo đơn được gửi đồng thời hai lần với
cùng idempotency key. Chỉ có 20 đơn. Duyệt và nhận đủ, sau đó mỗi báo cáo bán 2,
hư 1, tặng tốt 1 và tặng hư 1; duyệt 20 báo cáo. Kho đầu 200 còn 80, reservation
bằng 0. Mỗi thành viên trong nhóm 5 người còn thêm 8 hàng vật lý. Doanh thu mới
400.000, lãi đóng góp −80.000 đồng; giá vốn/hư/tặng không bị trừ hai lần.

Chromium đăng nhập, mở dashboard 1.000 thành viên, đổi sang trang 2 và xác nhận
779.000.000 đồng tổng doanh thu không đổi. Có 540 dòng DOM gồm bảng tổng thành
viên và chi tiết tuần. Không có JS error; màn hình 390px không tràn ngang trang.
Ảnh viewport đã kiểm tra: [dashboard-1000.png](evidence/scale/dashboard-1000.png).

Full check bản cuối: 21/21 backend tests (4 domain, 17 Mongo/HTTP), 4/4 workflow
Chromium trên frontend build, 5 startup rejection gates, TypeScript/lint/build,
2 dependency audits, migration index/chạy lại migration và election đều exit 0. App dev cũng được kiểm tra đăng nhập,
6 trang quản trị, API trả dữ liệu đúng dạng, giữ tài khoản và 23 index sau restart Mongo.

## Giới hạn và công việc trước production

Query plan trước index: trả 88 biến động nhưng quét 104.461 document, 0 index key.
Sau index: trả 88 biến động, đọc 88 document và 88 index key. Index đã được áp dụng
trên database local và benchmark; người dùng xác nhận bỏ gate từ skill cũ. Migration
[scripts/migrate-indexes.cjs](../../scripts/migrate-indexes.cjs) tạo 23 index theo
[001-query-indexes.plan.json](../../backend/migrations/001-query-indexes.plan.json) và
[002-list-query-indexes.plan.json](../../backend/migrations/002-list-query-indexes.plan.json),
không xóa index/dữ liệu. Full harness tạo index trên database test mới và kiểm tra
chạy lại migration. Bằng chứng áp dụng:
[local-index-apply-all.json](evidence/scale/local-index-apply-all.json),
[indexed-fixture-migration-all.json](evidence/scale/indexed-fixture-migration-all.json).

Danh sách báo cáo quản trị trước index phải quét 52.120 document và SORT để trả
51 dòng; sau migration 002 đọc 51 document/51 index key, không SORT. Danh sách
thành viên quản trị giảm từ quét 1.001 document xuống 51. Xem
[list-plans-before.json](evidence/scale/list-plans-before.json) và
[list-plans-after.json](evidence/scale/list-plans-after.json).

Tồn chi tiết chỉ tính theo trang giảm phase inventory từ khoảng 534 ms xuống 36 ms;
tổng tài chính vẫn tính trên toàn tổ chức trong cùng snapshot. Đọc toàn 26 tuần
ở concurrency=5 vẫn có p95 khoảng 5,8 giây: cần SLO và workload thực tế trước khi
kết luận đáp ứng yêu cầu production. Index không loại bỏ chi phí tính toàn bộ tổng.

Shared posting guard bảo vệ chống write skew nhưng là điểm tranh chấp ghi. Chưa
đo sustained throughput, số lượng client lớn hơn, dữ liệu triệu bản ghi, tổ chức
nhiều tenant hoặc tải đọc/ghi hỗn hợp kéo dài. Khi workload vượt mức đã đo cần SLO,
benchmark tương ứng và thiết kế incremental aggregate/checkpoint có đối soát ledger
trước khi thêm cache hoặc chia nhỏ guard. Không bỏ guard chỉ để tăng throughput.

Dev một-node replica set chưa có HA. Election trên test 3-node chứng minh dữ liệu
đã commit còn tồn tại trong tình huống đó; không chứng minh app phục hồi request
trong mọi failover. Chưa diễn tập backup/restore hoặc mất điện. Dữ liệu cũ và các
chính sách chi phí/KPI/gia hạn vẫn cần đối soát/xác nhận trước cutover. Hoàn tiền,
thuế, hoa hồng và vận chuyển riêng chưa nằm trong phạm vi đã triển khai.

## Bằng chứng và chạy lại

- [verification.json](evidence/full-check/verification.json): exit codes và hash code full check.
- [traffic-1000.json](evidence/scale/traffic-1000.json): giao dịch/concurrency/browser cuối.
- [aggregate-before-index](evidence/scale/aggregate-before-index/traffic-1000.json): baseline trước index.
- [final-indexed-1000.json](evidence/scale/final-indexed-1000.json): đo bản cuối đơn lẻ.
- [indexed-eight](evidence/scale/indexed-eight/traffic-1000.json): đo sau 8 index đầu, trước migration danh sách.
- [indexed-1000.json](evidence/scale/indexed-1000.json): so sánh chỉ thêm index trên cùng dataset.
- [fixture-1000.json](evidence/scale/fixture-1000.json): số liệu kỳ vọng độc lập cho fixture cuối.
- [before-100-run.txt](evidence/scale/before-100-run.txt): timeout trước sửa, không xóa thất bại.
- [stream-v2-traffic](evidence/scale/stream-v2-traffic/traffic-1000.json): lần đo trước aggregate.
- [local-runtime.json](evidence/full-check/local-runtime.json): app dev thật và persistence.

Khi test Mongo 3 node đang chạy, dùng database test **mới**; seeder từ chối database
đã có thành viên. Không chạy election đồng thời với benchmark vì API benchmark
kết nối trực tiếp node primary. Không chạy lại workflow trên fixture đã dùng rồi
coi số lượng giao dịch cũ là dữ liệu mới.

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/xtn_refactor_test_scale_<unique_suffix>?directConnection=true' SCALE_MEMBERS=1000 node scripts/seed-scale.cjs
MIGRATION_MONGO_URI='mongodb://127.0.0.1:27028/xtn_refactor_test_scale_<unique_suffix>?directConnection=true' node scripts/migrate-indexes.cjs --apply
TEST_MONGO_URI='mongodb://127.0.0.1:27028/xtn_refactor_test_scale_<unique_suffix>?directConnection=true' SCALE_MEMBERS=1000 SCALE_LABEL=rerun node scripts/measure-scale.cjs
TEST_MONGO_URI='mongodb://127.0.0.1:27028/xtn_refactor_test_scale_<unique_suffix>?directConnection=true' node scripts/exercise-scale.cjs
python3 scripts/verify-full.py
node scripts/verify-local.cjs
```

Thay `<unique_suffix>` bằng chữ/số/gạch dưới; lưu evidence cũ trước khi chạy lại.

Lần đo 8 index đầu có nhãn no-secondary-indexes cũ trong raw stdout; JSON lưu ở
indexed-eight/traffic-1000.json đã bổ sung annotation cho đúng với queryPlan,
timings/counts giữ nguyên. Lần đo cuối chạy lại fixture mới với đủ 23 index,
raw stdout ở traffic-indexed-final-run.txt có nhãn đúng và không cần sửa metadata.
