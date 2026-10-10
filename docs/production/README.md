# Production tối thiểu trên một VPS

Bản này phù hợp hệ thống nội bộ cấp hàng, bán hàng và báo cáo của nhóm: một VPS,
MongoDB local có xác thực và replica set một node, API Express và giao diện qua
Caddy HTTPS. Không yêu cầu Mongo Cloud. Mongo/API không mở cổng ra Internet.
Máy chủ hỏng thì dịch vụ dừng; phục hồi bằng backup, không có HA.

**Đã chạy stack thật trên máy local, chưa triển khai lên VPS public.** Bằng chứng:
[verification.json](verification.json), [giao dịch và trình duyệt](production-app.json),
[đối soát độc lập](reconciliation.json), [khôi phục sang stack riêng](restore-app.json),
[restart và rollback](operations.json). Tập nhỏ gồm 20 đơn, 40 lần nhận, 40 báo cáo,
một correction, 20 yêu cầu tạo trùng; 512 request HTTPS, đọc liên tục 60 giây với
5 thành viên, p95 288 ms. Sáu trang quản trị được kiểm tra bằng Chromium.
Sau restore/restart/rollback, kho 77, tồn thành viên 41, doanh thu 390.000,
lãi đóng góp −102.000 và thu ròng 150.000 đồng đều khớp.
Đây là số liệu fixture, không phải doanh thu thật. Benchmark lịch sử 1.000 thành viên
được mô tả riêng trong [scale-verification.md](../redesign/scale-verification.md).

## Cài đặt mới

VPS Linux có Docker Engine, Compose v2, Python 3 và `flock`. Mốc khởi đầu vận hành:
2 vCPU, 4 GB RAM, SSD 40 GB; theo dõi thực tế để tăng tài nguyên. Đây là đề xuất
khởi đầu, chưa phải chứng nhận tải trên cấu hình VPS đó. Chỉ mở cổng SSH, 80 và 443.
Domain A/AAAA phải trỏ đúng máy chủ; bỏ AAAA nếu chưa phục vụ IPv6.

Đặt mã nguồn đã kiểm chứng tại `/opt/XTN-2026` (hoặc sửa đường dẫn trong các unit).
Không dùng image/mã nguồn của nhánh cũ. Tại thư mục dự án:

```bash
python3 scripts/prepare-production.py --domain xtn.example.com
bash scripts/production.sh init
bash scripts/production.sh status
bash scripts/production.sh backup
python3 scripts/production-health.py
```

Thay domain bằng domain thật. Caddy tự xin chứng chỉ public khi DNS/cổng đúng.
Đọc tài khoản quản trị tại `.local/production/admin-credentials.json` trên máy chủ;
mật khẩu được sinh ngẫu nhiên, không có đăng ký quản trị công khai. Các file
`.local/production/env` và `secrets/` có quyền riêng tư và bị loại khỏi Git/Docker
build context. Không gửi chúng qua chat hoặc commit. Không chạy lại script prepare
để đổi mật khẩu DB; nó cố ý không ghi đè cấu hình cũ.

`init` tạo DB mới, replica set, tài khoản DB giới hạn `readWrite`, index đã định
nghĩa và admin. Không sửa/xóa DB cũ của dự án. Kiểm tra HTTPS từ một thiết bị bên
ngoài, đăng nhập, và tạo một giao dịch nhỏ trước khi cho nhóm sử dụng. Chứng chỉ
public, DNS và firewall sẽ chỉ được xác nhận khi có máy chủ/domain thật.

Đối với dữ liệu thật: kiểm kê kho và hàng đã giao, khai báo số lượng mở đầu và
giá vốn chính xác, tạo thành viên/mục tiêu tuần rồi mới ghi giao dịch. **Chưa có
chương trình tự chuyển đổi lịch sử legacy**. Nếu cần mang lịch sử cũ sang, phải
đối soát và chuyển đổi riêng; không import collection cũ trực tiếp vào schema mới.

## Quy tắc vận hành nghiệp vụ

Đặt hàng giữ kho; từng lần thực nhận mới chuyển hàng sang thành viên. Cho phép
nhiều đơn và nhiều đợt nhận/báo cáo trong tuần. Báo cáo ghi phần phát sinh; không
nhập tổng lũy kế thành báo cáo mới. Tuần tính theo ngày hoạt động ở Việt Nam;
ngày nộp/hạn nộp/gia hạn tách riêng, nên báo cáo muộn không tự chuyển sang tuần sau.
Mặc định hạn nộp là thứ Hai 23:59; quản trị có thể gia hạn, chốt và mở lại kỳ.
KPI mặc định theo doanh thu, nhiều tuần dùng tổng doanh thu / tổng mục tiêu.

Phân biệt hàng hư đang giữ, tặng hàng tốt và tặng hàng hư; tặng hàng hư không tính
chi phí lần hai. Thiếu giá vốn hoặc mục tiêu thì hiển thị chưa xác định.
“Lãi đóng góp” chưa trừ chi phí vận hành, hoa hồng và thuế; thu/chi tiền theo dõi
riêng. Phiên bản nội bộ này chưa có quy trình trả hàng/hoàn tiền, thuế hay vận
chuyển kiểu cửa hàng bán lẻ đầy đủ. Chi tiết tại
[hợp đồng nghiệp vụ](../redesign/implementation-contract.md).

## Cập nhật và quay lại phiên bản trước

```bash
bash scripts/production.sh backup
bash scripts/production.sh release 2026-10-10-v1
bash scripts/production.sh status
python3 scripts/production-health.py
# Khi cần quay lại image còn lưu trên máy:
bash scripts/production.sh rollback local
```

Mỗi release dùng tag mới; script từ chối ghi đè image đã có để giữ đường rollback.
Release hiện tại lưu ở `.local/production/current-release`. Ghi lại tag trước khi
cập nhật. Chỉ rollback bằng image tương thích dữ liệu; quy trình này đã kiểm tra
cơ chế thay image và giữ dữ liệu, không bảo đảm mọi thay đổi schema tương lai đều
có thể rollback. Bản hiện tại dùng index migration không phá dữ liệu.
Không prune các image còn cần rollback và không chạy `docker compose down -v`.

## Backup và phục hồi

`backup` tạm dừng API trong lúc dump để có ảnh dữ liệu nhất quán trên một node,
sau đó bật lại API. Trong khoảng này người dùng có thể thấy lỗi tạm thời; lịch
02:30 nhằm giảm ảnh hưởng. Không có writer trực tiếp Mongo khác trong lúc backup.
Archive gzip và manifest SHA-256 lưu trong `.local/production/backups/`.
Đây là backup DB ứng dụng, không sao chép tài khoản quản trị Mongo.

Sao chép archive **cùng manifest** và cấu hình/secrets riêng sang nơi khác máy chủ,
giữ quyền truy cập hạn chế. Việc sao chép ngoài máy chủ chưa được cấu hình vì chưa
có đích lưu trữ. Giữ ít nhất 7 bản ngày và 4 bản tuần; hiện việc giữ/xóa bản cũ là
thao tác vận hành, chưa có retention tự động. Theo dõi dung lượng ổ đĩa.

```bash
# Thay đường dẫn bằng archive thật; lệnh này thay toàn bộ DB ứng dụng được chọn.
bash scripts/production.sh restore /path/xtn-backup.archive.gz --replace-database
bash scripts/production.sh status
python3 scripts/production-health.py
```

Script kiểm tra loại archive, checksum và gzip trước khi dừng dịch vụ. Trong restore
API/web dừng; nếu restore lỗi chúng giữ trạng thái dừng để không phục vụ dữ liệu
dở dang. Đọc log, sửa nguyên nhân và restore lại bản hợp lệ trước `up`.
Nếu máy chủ mất hoàn toàn, dựng stack mới, khôi phục cấu hình/secrets đúng đường
dẫn/UID, chạy `init`, rồi restore archive. Backup DB không chứa lịch sử thu hồi
image hay chứng chỉ Caddy; Caddy có thể xin chứng chỉ mới. Đã thử restore DB
ứng dụng vào volume mới và kiểm tra qua HTTPS/UI, không chỉ thử tạo file dump.

## Lịch backup và kiểm tra sức khỏe

Các unit mẫu dùng `/opt/XTN-2026`. Sau khi đã backup lần đầu, trên VPS:

```bash
sudo install -m 644 infra/production/xtn-backup.service infra/production/xtn-backup.timer infra/production/xtn-health.service infra/production/xtn-health.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now xtn-backup.timer xtn-health.timer
systemctl list-timers 'xtn-*'
journalctl -u xtn-backup.service -u xtn-health.service --since today
```

Unit chạy với quyền root; cấu hình tạo bởi root dùng UID/GID 0 để bootstrap đọc
secret, còn API luôn chạy user `node`. Nếu triển khai bằng tài khoản khác, tạo
config bằng chính tài khoản đó. Health check mỗi 5 phút kiểm tra HTTPS/readiness
và backup thành công không quá 48 giờ; lỗi trả exit 1 và vào journal. Chưa tích
hợp cảnh báo gửi email/chat. Các timer mới là template, chưa được bật trên VPS.
Log container giới hạn 10 MB × 3 mỗi service. Dùng `production.sh logs`, kiểm tra
`df -h`, backup ngoài máy và một bài restore định kỳ; single-host vẫn có thời gian
ngừng dịch vụ khi reboot, backup hoặc cập nhật.

Mongo được đặt `nofile` 64.000 theo [hướng dẫn MongoDB](https://www.mongodb.com/docs/v7.0/reference/ulimit/).
Chạy lặp nhiều database/index đã thực tế làm node test dừng với mặc định 1.024;
cấu hình test/local/production hiện đều ghi rõ giới hạn, không phụ thuộc Docker host.

## Lặp lại kiểm chứng local

Máy kiểm chứng cần thêm Node 24, `npm ci --prefix frontend` và
`cd frontend && npx playwright install --with-deps chromium`. Trên workspace mới:

```bash
python3 scripts/verify-production.py
```

Script tạo hai stack riêng ở cổng local 18443/18444, chạy giao dịch/UI, backup,
restore, restart, release/rollback và đối soát trực tiếp ledger. Không nhắm vào
`.local/production`. Từ chối xóa/ghi đè sandbox đã tồn tại. Để kiểm tra lại sandbox
được giữ cùng bằng chứng đã đạt: `python3 scripts/verify-production.py --existing`.
Chế độ này xác nhận lại dữ liệu/UI/restore/health, không tạo lại fixture hoặc diễn
lại restart/release. HTTPS Node kiểm tra CA local; Chromium chấp nhận ngoại lệ
CA local riêng cho bài test. Không áp dụng ngoại lệ TLS đó cho người dùng public.
