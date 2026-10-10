# Sử dụng thật trên laptop hiện tại

Ứng dụng chạy tại **http://localhost:8080** (hoặc http://127.0.0.1:8080).
Đây là stack `xtn-prod`, dùng Mongo local có xác thực và volume riêng
`xtn-prod_mongo-data`. API/Mongo không mở cổng host. Web chỉ bind loopback,
không mở ra LAN/Internet. HTTP trong phạm vi cùng laptop giúp sử dụng trực tiếp
không cần domain/chứng chỉ local; nếu mở ra máy khác phải cấu hình HTTPS riêng.

Tài khoản quản trị nằm tại `.local/production/admin-credentials.json` trong dự án.
Không có mật khẩu mặc định. Database mới có admin, chưa có đơn/báo cáo/sản phẩm
thật; không đưa fixture hoặc dữ liệu legacy vào đây. Nhập thành viên, kiểm kê kho,
giá vốn và mục tiêu tuần trước khi sử dụng. Các quy tắc kỳ/báo cáo/tặng/hư/KPI
vẫn theo [hợp đồng nghiệp vụ](../redesign/implementation-contract.md).

Đã kiểm tra đăng nhập, chặn truy cập không đăng nhập, API và sáu trang giao diện
bằng Chromium trên chính bản này: [laptop-runtime.json](laptop-runtime.json).

Layout điện thoại/tablet/desktop và kiểm chứng nhiều browser:
[UI/UX responsive](responsive.md).
Bộ test giao dịch có ghi dữ liệu chạy trong DB riêng; không tạo đơn giả trong DB
sử dụng thật. Xem [kiểm chứng nghiệp vụ/khôi phục](README.md).

Sau kiểm chứng, các stack sandbox và replica test được dừng để nhường tài nguyên;
volume và bằng chứng được giữ. Muốn chạy lại `verify-full.py` trên workspace này,
bật lại replica test trước:

```bash
docker start xtn-refactor-test xtn-refactor-secondary-1 xtn-refactor-secondary-2
# Chờ Mongo primary sẵn sàng rồi chạy:
python3 scripts/verify-full.py
```

## Khởi động và vận hành

Ứng dụng trên laptop dùng `restart: "no"`: không tự bật khi mở máy hoặc khi Docker
khởi động lại. Các lịch backup/health đã được tắt theo yêu cầu. Docker và thiết lập
user manager chung của máy giữ nguyên để phục vụ các dự án khác.
Khi cần sử dụng, chạy thủ công tại thư mục dự án:

```bash
bash scripts/production.sh up
bash scripts/production.sh status
bash scripts/production.sh logs
python3 scripts/production-health.py
# Dừng khi dùng xong:
bash scripts/production.sh stop
```

Mongo giữ `nofile` 64.000; dữ liệu lưu trong volume qua các lần restart.
Không chạy `docker compose down -v`, không xóa volume. Đã thử restart container
và đăng nhập/đọc lại bản chạy thật; chưa reboot toàn bộ laptop trong lúc làm việc.
Sau khi tắt/bật máy, chạy `up` để sử dụng lại. Đổi chế độ laptop đã cấu hình trước:
`python3 scripts/disable-laptop-autostart.py`; lệnh giữ nguyên dữ liệu và các
container đang chạy, chỉ tắt restart policy cùng lịch tự động.

## Backup thủ công trên laptop

`xtn-laptop-backup.timer` và `xtn-laptop-health.timer` hiện disabled và inactive.
Trạng thái hiện tại được kiểm chứng tại [laptop-autostart.json](laptop-autostart.json).
Các bằng chứng bật lịch/restart trước đây trong `laptop-operations.json` là lịch sử,
không phải cấu hình hiện tại. Chạy backup/health khi cần:

```bash
bash scripts/production.sh backup
python3 scripts/production-health.py
```

Backup lưu ở `.local/production/backups/`, kèm manifest SHA-256. API tạm dừng trong
lúc dump để nhất quán và được bật lại sau đó. Đã tạo backup đầu tiên và chạy
service thật. Backup cùng ổ đĩa chỉ phục hồi sai thao tác; hãy chép archive cùng
manifest sang ổ ngoài nếu cần phục hồi khi laptop/ổ đĩa hỏng. Chưa có đích sao
chép ngoài máy tự động hoặc gửi cảnh báo. Theo dõi journal và dung lượng ổ đĩa.

Khôi phục và release/rollback theo [runbook](README.md); mặc định mọi lệnh
`production.sh` hiện nhắm vào bản dùng thật ở `.local/production`.

## Dựng lại trên laptop khác

```bash
python3 scripts/prepare-production.py --laptop
bash scripts/production.sh init
bash scripts/production.sh backup
```

Không chạy prepare trên cấu hình đã tồn tại; script không ghi đè secrets. Nếu
chuyển máy và cần dữ liệu, dùng backup/restore thay vì tạo dữ liệu mẫu.
