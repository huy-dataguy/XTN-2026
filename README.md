# XTN 2026

**Trạng thái hiện tại:** đã dừng và dọn dữ liệu/runtime trên laptop theo yêu cầu.
Source trên `main`, evidence giữ trong Git; chưa triển khai MongoDB Cloud.
Đọc [bàn giao cho coding agent](docs/PROJECT_STATUS.md) và [hướng MongoDB Cloud](docs/production/mongodb-cloud.md).

Hệ thống cấp hàng cho thành viên, ghi nhận bán/hư/tặng theo lô thực nhận và thống kê theo tuần Việt Nam.

Bản refactor đã merge vào `main`. Dữ liệu cũ cần được kiểm kê, đối soát và chuyển đổi trước khi sử dụng số liệu mới. Không chạy migration tự động khi khởi động.

## Chạy và kiểm thử

Node 24, MongoDB replica set; Express API `/api/v1`, React + TypeScript + Vite.

Chạy nhanh: [MongoDB local + toàn dự án](docs/redesign/local-development.md).

Triển khai tối thiểu: [Docker + Mongo local + HTTPS, backup và rollback](docs/production/README.md).
Đã chạy và kiểm chứng stack production trên máy local; chưa triển khai lên VPS public.

Bản laptop sau khi dựng lại dùng **http://localhost:8080**; hiện đã dừng và xóa dữ liệu.
Xem [vận hành laptop, tài khoản và backup thủ công](docs/production/laptop.md).

Đọc [runbook](docs/redesign/refactor-runbook.md) để cấu hình, tạo quản trị ban đầu, chạy backend/frontend và kiểm thử. Xem [hồ sơ phân tích](docs/redesign/README.md), [quy tắc nghiệp vụ](docs/redesign/implementation-contract.md), [hợp đồng dữ liệu](docs/redesign/data-contract.md) và [bằng chứng kiểm chứng](docs/redesign/evidence/full-check/verification.json).

Đơn có thể nhận nhiều đợt; báo cáo ghi phần phát sinh, không ghi tổng lũy kế. Tuần hoạt động tách riêng ngày nộp báo cáo và gia hạn. Giá bán/giá vốn lưu tại lô nhận, thiếu giá vốn trả kết quả chưa xác định. KPI nhiều tuần = tổng doanh thu / tổng mục tiêu, chỉ kết luận khi dữ liệu đầy đủ.

Lãi đóng góp chưa trừ hoa hồng, chi phí vận hành hoặc thuế. Thu/chi ngân hàng theo dõi riêng; nhãn giao dịch là bộ lọc không cộng gộp.

Đã chạy benchmark local với 1.000 thành viên, 52.100 báo cáo và 104.400 biến động lịch sử, cùng giao dịch HTTP và trình duyệt thật. Xem [kết quả và giới hạn tải](docs/redesign/scale-verification.md); đây chưa phải cam kết khả năng chịu tải production.
