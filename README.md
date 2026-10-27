# LineWatch - Theo dõi ca sản xuất và sự cố dây chuyền

**BTL-14 · CSE122 · Nhóm Phạm Quang Thắng, Lê Văn Sơn, Nguyễn Vũ Trung Nguyên**

LineWatch là nguyên mẫu website giúp công nhân, trưởng ca, kỹ thuật bảo trì và quản trị viên cùng theo dõi một sự cố máy trong ca sản xuất. Giao diện có bốn vai trò, dữ liệu mô phỏng dùng chung và ba tính năng gợi ý AI theo quy tắc. [Xem thiết kế Figma](https://www.figma.com/design/Hb7wMQduLWJliOzpJWGR98/BTL-14-LineWatch-%E2%80%93-Full-UI-Prototype?node-id=2-2).

## Ngữ cảnh

Khi máy trong dây chuyền rung, nóng, hoạt động bất thường hoặc dừng, thông tin thường đi qua trao đổi miệng và ghi chép rời rạc. Người báo, người phân công và người sửa máy cần nhìn cùng một sự cố, đúng mã máy và đúng ca.

## Phát biểu vấn đề

- Công nhân cần báo đúng máy, thời điểm, mức ảnh hưởng và theo dõi tiến độ.
- Trưởng ca cần nhận, xếp ưu tiên, phân công người xử lý và xác nhận kết quả.
- Kỹ thuật bảo trì cần nhận đúng công việc, ghi nguyên nhân, biện pháp, kết quả và tra lịch sử máy.
- Quản trị viên cần xem tình trạng máy, dây chuyền và tổng hợp thời gian dừng.

## Mục tiêu

Một sự cố có mã `INC` ổn định từ lúc báo đến lúc đóng. Công việc bảo trì `MT` được tạo khi phân công và liên kết bằng `incidentId`; `assigneeId` xác định đúng kỹ thuật viên nhận việc. Các vai trò dùng chung dữ liệu, còn quyền thao tác thay đổi theo vai trò và trạng thái. Website hỗ trợ tìm kiếm, lọc, kiểm tra biểu mẫu, trạng thái rỗng/đang tải/lỗi, sáng/tối và màn hình máy tính lẫn điện thoại.

## Các vai trò

| Vai trò | Công việc chính | Màn hình nghiệp vụ |
|---|---|---|
| Công nhân vận hành | Xem dây chuyền, báo sự cố, sửa hoặc hủy báo cáo khi còn mới | 02, 03, 04 |
| Trưởng ca | Xem tổng quan ca, tiếp nhận, phân công Minh/Tú, đóng sự cố và bàn giao | 05, 06, 07 |
| Kỹ thuật bảo trì | Xem hàng chờ đúng người được giao, xử lý và tra lịch sử máy | 08, 09, 10 |
| Quản trị viên | Xem danh mục máy, quản lý dây chuyền, lập báo cáo dừng máy | 11, 12, 13 |

Đăng nhập, đăng ký, quên mật khẩu, thông báo và các trang lỗi được dùng theo ngữ cảnh hoặc quyền truy cập.

## Luồng người dùng

1. Công nhân chọn máy từ trang trạng thái dây chuyền. Khi mở báo sự cố từ thẻ máy, form nhận sẵn dây chuyền và máy; công nhân kiểm tra, nhập mô tả và gửi một `INC` mới. AI-1 có thể gợi ý loại sự cố và ưu tiên.
2. Trưởng ca chọn ca, tiếp nhận sự cố, rồi phân công kỹ thuật viên Minh hoặc Tú. Hệ thống tạo `MT` có cùng `incidentId` và `assigneeId` của người được chọn.
3. Kỹ thuật viên được giao thấy việc ở hàng chờ của mình. Sau khi bấm **Bắt đầu xử lý**, người đó ghi nguyên nhân, biện pháp và kết quả, có thể tra lịch sử máy và tham khảo AI-3, rồi hoàn tất việc.
4. Trưởng ca xác nhận và đóng chính sự cố đó; AI-2 hỗ trợ tóm tắt ca và việc còn mở để viết bản giao ca.
5. Quản trị viên xem máy, trạng thái dây chuyền và lập báo cáo thời gian dừng dựa trên dữ liệu đã ghi.

Trạng thái sự cố: `new → accepted → assigned → in_progress → resolved → closed`. Công nhân có thể sửa hoặc hủy khi còn `new`. Không tạo thêm một sự cố mới khi chuyển sang vai trò khác.

## Bảng kiểm kê màn hình

Thiết kế có **19 giao diện độc lập** và bốn khung biến thể trạng thái. Các mã 16/17/22/23 là trạng thái của form liên quan, không phải bốn trang nghiệp vụ mới.

| Mã | Giao diện | Phụ trách |
|---|---|---|
| 01 | Đăng nhập (17: lỗi đăng nhập) | Nguyên |
| 02, 03, 04 | Trạng thái dây chuyền; báo sự cố; sự cố trong ca | Thắng |
| 05, 06, 07 | Tổng quan ca; bảng điều phối; bản giao ca | Sơn |
| 08, 09, 10 | Hàng chờ bảo trì; chi tiết công việc; lịch sử máy | Nguyên |
| 11 | Danh mục máy | Sơn |
| 12 | Quản lý dây chuyền | Thắng |
| 13 | Báo cáo dừng máy | Sơn |
| 14 | Đăng ký (22: lỗi; 23: chờ duyệt) | Thắng |
| 15 | Quên mật khẩu (16: đã gửi yêu cầu) | Nguyên |
| 18 | Không có quyền 403 | Sơn |
| 19, 20 | Không tìm thấy 404; lỗi hệ thống 500 | Nguyên |
| 21 | Thông báo | Sơn |

## Tính năng AI

| Tính năng | Dữ liệu đầu vào | Kết quả |
|---|---|---|
| AI-1 | Mô tả sự cố do công nhân nhập | Gợi ý loại sự cố, ưu tiên và lý do; người dùng chấp nhận, sửa hoặc từ chối. |
| AI-2 | Sự cố, công việc còn mở và dữ liệu ca | Gợi ý nội dung bàn giao; trưởng ca kiểm tra và chỉnh trước khi lưu. |
| AI-3 | Lịch sử sự cố của một máy trong 90 ngày | Nhận diện mẫu lỗi lặp và giải thích; khi thiếu bằng chứng, hiển thị nhánh xử lý thủ công. |

Các gợi ý được mô phỏng bằng quy tắc (`mock-rule`) trên dữ liệu ứng dụng. Website không gọi LLM API thật và người dùng quyết định nội dung nào được lưu.

## Công nghệ

- HTML5, CSS3, JavaScript ES modules; bố cục responsive và token màu dùng chung.
- `assets/data/seed.json` tạo dữ liệu mẫu; `js/store.js` giữ dữ liệu trong `localStorage['linewatch.v1']`; `js/api.js` là cổng thao tác chung.
- `js/auth.js` quản lý phiên và vai trò; `js/theme.js` xử lý sáng/tối; `js/maintenance.js` và `js/ai3.js` phục vụ luồng bảo trì.
- Đây là bản frontend mô phỏng. Quên mật khẩu không gửi email thật; dữ liệu lưu trên trình duyệt đang sử dụng.

Các thực thể chính gồm `lines`, `machines`, `incidents`, `maintenanceTasks`, `shiftNotes` và `reports`. Máy thuộc dây chuyền; sự cố gắn với máy và ca; nhiệm vụ bảo trì trỏ về sự cố bằng `incidentId`.

## Thành viên nhóm

| Thành viên | Phần việc |
|---|---|
| Phạm Quang Thắng | Công nhân, quản lý dây chuyền, đăng ký, AI-1 |
| Lê Văn Sơn | Trưởng ca, danh mục máy, báo cáo dừng máy, thông báo, AI-2 |
| Nguyễn Vũ Trung Nguyên | Đăng nhập, bảo trì, quên mật khẩu, lỗi 404/500, mã dùng chung và AI-3 |

## Phân công công việc

Thắng phụ trách khung 02/03/04/12/14 và biến thể 22/23; Sơn phụ trách 05/06/07/11/13/18/21; Nguyên phụ trách 01/08/09/10/15/19/20 và biến thể 16/17. Mỗi người thực hiện giao diện, CSS, JavaScript và dữ liệu cho phần mình; các file nền chung kết nối ba luồng thành một ứng dụng.

## Quy trình Git

Các nhánh cá nhân là [`thang`](https://github.com/Nguyensiuuu/CSE122-BTL-14-Linewatch/tree/thang), [`son-code`](https://github.com/Nguyensiuuu/CSE122-BTL-14-Linewatch/tree/son-code) và [`feature/nguyen-linewatch-screens`](https://github.com/Nguyensiuuu/CSE122-BTL-14-Linewatch/tree/feature/nguyen-linewatch-screens). Thành viên tạo commit trên nhánh mình, mở PR vào `dev` để người khác xem và góp ý. Sau khi hợp nhất và kiểm tra luồng trên `dev`, nhóm đưa bản được duyệt vào `main`.

## Figma / Canva

[LineWatch - Full UI Prototype](https://www.figma.com/design/Hb7wMQduLWJliOzpJWGR98/BTL-14-LineWatch-%E2%80%93-Full-UI-Prototype?node-id=2-2) thể hiện màn hình desktop và các trạng thái/responsive. Mỗi vai trò dùng cùng thanh điều hướng, kiểu chữ, màu, nút sáng/tối và thông báo.

## Demo

Để chạy mã nguồn từ nhánh có các tệp website, mở thư mục dự án bằng Live Server hoặc chạy `python -m http.server 8000` ở thư mục gốc, sau đó truy cập `http://localhost:8000/`. Mở bằng HTTP để JavaScript modules và dữ liệu JSON hoạt động; trang vào là `index.html`. Dùng các tài khoản demo trong dữ liệu mẫu, hoặc chọn vai trò ở trang đăng nhập để xem luồng. Có thể chạy `npm test` tại bản mã nguồn tích hợp để kiểm tra các thao tác dữ liệu.

## Minh chứng OBS

Mỗi giao diện độc lập tương ứng một video của sinh viên phụ trách. Video thể hiện bản Figma, tệp HTML/CSS/JS, giải thích bố cục và logic, chỉnh sửa trực tiếp, chạy thử tương tác và commit Git liên quan. Các biến thể trạng thái nằm trong video của trang gốc.

## Khai báo sử dụng AI

Nhóm sử dụng công cụ AI hỗ trợ thiết kế, viết và rà soát một phần mã/tài liệu. Sinh viên kiểm tra, sửa và giải thích phần mình phụ trách; báo cáo sử dụng AI của nhóm ghi công cụ, prompt, phần mã được hỗ trợ và cách kiểm chứng. Ba tính năng AI xuất hiện trong sản phẩm là logic mô phỏng theo quy tắc, độc lập với công cụ AI dùng trong quá trình phát triển.
