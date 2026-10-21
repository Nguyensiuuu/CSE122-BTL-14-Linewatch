# Kiểm kê màn hình Nguyên – BTL-14 LineWatch

Căn cứ `BTL-14_linewatch-theo-doi-ca-san-xuat-va-su-co-day-chuyen.md` và phân công 23 khung Figma.

**Chín khung Figma của Nguyên tương ứng bảy trang độc lập**; khung 16 là trạng thái thành công của quên mật khẩu 15, khung 17 là trạng thái lỗi của đăng nhập 01. Không tách thêm trang khi chưa được duyệt.

| Khung | Trang độc lập | Video dự kiến | Git commit / PR |
|---|---|---|---|
| 01, 17 | pages/login.html | SV3-01-login.mp4 | Chưa có |
| 08 | pages/maintenance-queue.html | SV3-02-maintenance-queue.mp4 | Chưa có |
| 09 | pages/maintenance-incident-detail.html | SV3-03-maintenance-incident-detail.mp4 | Chưa có |
| 10 | pages/maintenance-machine-history.html | SV3-04-maintenance-machine-history.mp4 | Chưa có |
| 15, 16 | pages/forgot-password.html | SV3-05-forgot-password.mp4 | Chưa có |
| 19 | pages/404.html | SV3-06-404.mp4 | Chưa có |
| 20 | pages/500.html | SV3-07-500.mp4 | Chưa có |

**Mỗi video phải có:** sinh viên xuất hiện, Figma, HTML/CSS/JS, giải thích logic, chỉnh code trực tiếp, demo tương tác, commit thật, thông báo mã task/nhánh/commit. Tên SV3 chỉ là tên mẫu cần đối chiếu số thành viên của nhóm.

Các tệp `js/store.js`, `js/api.js`, `js/theme.js`, `css/style.css` và `assets/data/seed.json` dùng chung, không sao chép thành bảy bộ riêng.

**Trạng thái:** Đây mới là commit tài liệu chuẩn bị OBS, chưa phải commit mã nguồn của từng màn hình và chưa có video. Khi đưa mã lên nhánh này, commit từng phần có ý nghĩa, tạo PR vào `dev` và nhờ thành viên khác đánh giá trước khi hợp nhất.
