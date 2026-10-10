# UI/UX trên điện thoại, tablet và máy tính

Giao diện dùng layout linh hoạt, không có phiên bản nghiệp vụ riêng cho mobile.
Các trang quản trị và thành viên được kiểm tra tại 320, 375, 390, 768, 1024,
1440 và 1920 CSS pixel bằng Chromium, Firefox và WebKit. Đây là kiểm chứng bằng
engine trình duyệt thật với viewport mô phỏng, không phải thử trên mọi thiết bị
vật lý. Kết quả chi tiết tại [responsive/verification.json](responsive/verification.json)
và [browser-results.json](responsive/browser-results.json).

Các thay đổi:

- Cột nội dung co được ở tablet/desktop; màn hình nhỏ không bị bảng đẩy rộng
  toàn bộ trang. Tất cả bảng có vùng cuộn ngang riêng và nhận focus bằng bàn phím.
- Điện thoại dùng menu ngang có thể cuộn, form một cột khi cần, nút/input/menu
  tối thiểu 44px, input 16px để tránh phóng to tự động khi nhập trên iOS.
- KPI, tên dài và nội dung xuống dòng; card thống kê về một cột ở điện thoại
  rất nhỏ. Sidebar cuộn được khi chiều cao máy tính thấp; Kanban chuyển 4 → 2 → 1 cột.
- Bộ lọc và hành động tự xuống dòng; trạng thái lỗi và thao tác cần thiết vẫn có
  trên màn hình nhỏ. Hỗ trợ focus rõ ràng và tùy chọn giảm chuyển động của hệ điều hành.

Bài responsive duyệt 7 trang quản trị và 4 trang thành viên ở 7 độ rộng trên
3 browser engine: **231 lượt trang/kích thước**. Kiểm tra đăng nhập, tải dữ liệu,
tràn ngang, vùng chạm, focus bảng và lỗi JavaScript; dữ liệu có đơn/báo cáo thực
trong fixture riêng. Các thao tác tạo/duyệt/nhận/báo cáo/correction/thu chi được
kiểm tra bằng luồng E2E nghiệp vụ riêng trong [full-check](../redesign/evidence/full-check/verification.json).

Trong quá trình kiểm tra đã phát hiện `/auth/me` chịu cùng giới hạn 20 lần/phút
với đăng nhập. Đã tách giới hạn: login/register giữ 20 lần/phút/IP, endpoint phiên
đã xác thực theo tài khoản. Bài backend kiểm tra 30 lần refresh vẫn được phép,
đồng thời đăng nhập sai vẫn bị giới hạn; tránh khóa nhầm người tải lại trang.

Lặp lại kiểm chứng: cài Playwright Chromium/Firefox/WebKit và dependencies, chạy
`python3 scripts/verify-full.py`, rồi `python3 scripts/verify-responsive.py`.
Các bài này dùng database/port riêng, không tạo đơn giả trong production laptop.
