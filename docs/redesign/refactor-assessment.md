# Đánh giá sau refactor

Đánh giá này áp dụng cho code local trên `feature/redesign-ecommerce`, không chứng
nhận dữ liệu production. Baseline, lỗi gốc và bằng chứng cũ nằm trong
architecture-review.md và acid-weekly-accounting-review.md.

| Thuộc tính  | Cơ chế hiện tại                                                                                       | Bằng chứng và giới hạn                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomicity   | Đơn, giữ hàng, nhận hàng, biến động kho, audit và kết quả idempotency nằm trong một Mongo transaction | Lỗi dòng thứ hai hoàn tác toàn bộ; duyệt/correction không ghi một phần                                                                      |
| Consistency | Kiểm tra số lượng, tiền nguyên VND, trạng thái/version, sở hữu lô và toàn bộ lịch sử tồn              | Chặn tồn âm, bán trước nhận, nhận vượt đơn, tràn số; cần đối soát dữ liệu cũ                                                                |
| Isolation   | Snapshot reads; ghi chung revision của sản phẩm/thành viên/kỳ và SystemGuard cho posting/closure      | Tranh chấp hàng cuối, bán cùng lô khác tuần và nhận lùi ngày vs khóa tuần sau; không suy diễn snapshot thành serializable cho mọi nghiệp vụ |
| Durability  | Majority + journal khi commit                                                                         | Đổi primary trên replica 3 node giữ nguyên số bản ghi; backup/restore sang stack mới đã kiểm tra qua API/UI; chưa thử mất điện vật lý                      |

Không cần đổi toàn bộ sang một framework khác để sửa những sai lệch này. Domain
policy, application workflow, persistence/transaction và HTTP đã tách thành module;
frontend chỉ hiển thị số liệu backend. Đã benchmark và áp dụng index cùng tối ưu truy vấn; kết quả tại scale-verification.md.
Cần đo lại trước khi thêm cache hoặc thay shared posting guard; guard hiện tại giảm khả năng ghi song song
để bảo vệ tính đúng của kỳ báo cáo.

## Phương pháp tính

- Kho: khả dụng = tồn vật lý − hàng hư đang giữ − hàng đã giữ cho đơn chưa nhận.
  Đặt hàng chỉ giữ hàng; thực nhận mới chuyển kho sang thành viên. Hủy đơn chỉ
  giải phóng phần chưa nhận.
- Thành viên: hàng tốt cuối kỳ = hàng tốt đầu kỳ + thực nhận − bán − hư mới − tặng
  hàng tốt. Hàng hư cuối kỳ = hư đầu kỳ + hư mới − tặng hàng hư. Tồn vật lý là
  tổng hai trạng thái. Hàng tốt đem tặng và hàng hư đem tặng được ghi riêng.
- Doanh thu = tổng số bán × giá bán snapshot của lô. Giá vốn hàng bán = tổng số bán
  × giá vốn snapshot. Lãi đóng góp = doanh thu − giá vốn hàng bán − chi phí hư mới
  − giá vốn hàng tốt tặng; hàng hư tặng đã chịu chi phí khi ghi hư nên không trừ lần hai.
- Báo cáo là phần phát sinh. Có thể nhiều báo cáo và nhiều lần nhận trong một tuần.
  Tuần được xác định bằng thời điểm hoạt động, tách ngày nộp và hạn/gia hạn. Báo cáo
  chờ duyệt hoặc bị từ chối chưa góp doanh thu. Sửa bản đã duyệt dùng đảo và thay thế.
- KPI nhiều tuần = tổng doanh thu / tổng mục tiêu, không lấy trung bình các tỷ lệ
  tuần. Tổng tồn cuối khoảng lấy thời điểm cuối, không cộng các tồn cuối tuần.
  Chưa chốt hoặc thiếu mục tiêu thì KPI tổng chưa xác định.

Ví dụ đã kiểm tra trên trình duyệt: nhận 10, bán 4, hư 2 rồi tặng 2 hàng hư thì còn
4 hàng tốt/4 hàng vật lý. Giá bán 10.000, giá vốn 6.000: doanh thu 40.000, giá vốn
hàng bán 24.000, chi phí hư 12.000, lãi đóng góp 4.000 đồng.

Ví dụ KPI: tuần 1 đạt 80.000/100.000, tuần 2 đạt 60.000/200.000, hai tuần đã chốt:
KPI = 140.000/300.000 = 46,67%. Trung bình 80% và 30% thành 55% làm sai trọng số.

## Việc còn cần trước production

Dữ liệu gốc chưa truy cập/chuyển đổi; phải ký nhận tồn vật lý, tồn thành viên/lô,
giá vốn, ngày nghiệp vụ, đơn/báo cáo trùng hoặc mồ côi trước cutover. Ngày hết hạn
và KPI doanh thu là mặc định đề xuất, chưa có xác nhận chính sách riêng từ người dùng.
Chưa triển khai hoàn tiền/trả hàng, hoa hồng, thuế hoặc vòng đời vận chuyển riêng.

Browser test dùng directConnection tới primary test. Khi vô tình chạy browser
cùng election, thao tác ghi bị gián đoạn; lần chạy đó được giữ trong
[evidence/browser-election-interruption.txt](evidence/browser-election-interruption.txt).
Các test cuối chạy tách riêng. URI production cần replica-set discovery phù hợp
và kiểm thử phục hồi request; chưa có tuyên bố ứng dụng chịu failover end-to-end.

## Full local check mở rộng

Xem [verification.json](evidence/full-check/verification.json) và
[local-runtime.json](evidence/full-check/local-runtime.json). Bộ kiểm chứng hiện gồm
22 ca backend (4 domain, 18 Mongo/HTTP), 4 luồng nghiệp vụ và một bài responsive Chromium trên bản build, 7 startup
rejection gates, đối soát độc lập ledger/kho/reservations/doanh thu, và kiểm tra
6 trang quản trị trên dev app cùng độ bền dữ liệu qua restart Mongo local.

Đã sửa thêm lỗi payload chỉnh sửa báo cáo chứa ID nội bộ, giữ chính xác giây/mili
giây khi mở lại báo cáo, tách port/database test khỏi dev và bỏ phụ thuộc thứ trong
tuần ở fixture lịch sử. Replica local một node là môi trường phát triển, chưa phải
HA production. Đã đo tải local trên 1.000 thành viên; kết quả và giới hạn tại [scale-verification.md](scale-verification.md). Chưa có SLO tải trên VPS thật.

## Bản triển khai tối thiểu

[Runbook production](../production/README.md) bổ sung Mongo local có xác thực,
HTTPS, API không chạy root, cấu hình/secrets riêng, giới hạn log, backup có tạm
dừng writer, restore DB ứng dụng, kiểm tra sức khỏe và release/rollback bằng image
giữ lại. Đã chạy hai stack Docker thực, đối soát ledger và thử phục hồi dữ liệu,
restart và rollback. Bản này có thể dùng cho cài đặt mới trên một VPS theo phạm vi
nghiệp vụ đã mô tả; dữ liệu legacy vẫn cần chuyển đổi riêng. Chưa triển khai public
vì chưa có máy chủ/domain, và chưa có backup ngoài máy hoặc HA.
