# LineWatch · phần code Nguyễn Vũ Trung Nguyên

Bản này hiện thực các khung **01, 08, 09, 10, 15, 16, 17, 19, 20** của Figma. Quy ước nhóm nằm trong `sources/LineWatch_PhanCong_23Khung_QuyUocDuLieu_HuongDanGhep.docx`; dữ liệu chung là `assets/data/seed.json`. Ảnh tài khoản duy nhất là `assets/images/linewatch-auth-hero.png` (1199 × 1312 px), được tham chiếu trực tiếp ở đăng nhập và khôi phục mật khẩu. Khung 16 là trạng thái gửi thành công của khung 15; khung 17 là lỗi nhập của khung 01.

## Chạy

Mở thư mục này bằng Live Server hoặc chạy `python -m http.server 8000`, rồi vào `http://localhost:8000/`. Không mở `file://`, vì trình duyệt cần tải `seed.json` bằng `fetch` và ES modules.

## Tìm đúng code để quay từng khung

Mỗi thư mục dưới `pages/` chứa HTML của trang, `style.css` chỉ cho trang ấy và `script.js` xử lý tương tác. Mở ba tệp trong cùng thư mục để xem/quay OBS:

| Thư mục | Khung Figma | HTML |
|---|---|---|
| `pages/01-dang-nhap/` | 01; lỗi sai thông tin 17 | `login.html` |
| `pages/08-hang-cho/` | 08 | `maintenance-queue.html` |
| `pages/09-chi-tiet/` | 09 | `maintenance-incident-detail.html` |
| `pages/10-lich-su/` | 10 | `maintenance-machine-history.html` |
| `pages/15-quen-mat-khau/` | 15; đã gửi 16 | `forgot-password.html` |
| `pages/19-loi-404/` | 19 | `404.html` |
| `pages/20-loi-500/` | 20 | `500.html` |

Chỉ `css/style.css` và các mô-đun gốc trong `js/` dùng chung. Các tệp HTML nằm trực tiếp tại `pages/` là đường dẫn chuyển tiếp rất ngắn để liên kết cũ của nhóm vẫn chạy, kể cả tham số trên URL; khi đọc code giao diện hãy mở thư mục có số khung.

Tài khoản kỹ thuật viên demo: `nguyen@linewatch.vn` / `123456`. Các nút vai trò demo cũng đăng nhập được. Màn của vai trò khác được chuyển tới HTML do Thắng/Sơn phụ trách khi các tệp đó được ghép vào `pages/`. Màn hình đăng ký cũng do Thắng bàn giao. Không có gửi email thật trong luồng quên mật khẩu.

## API và điểm ghép

- `js/store.js` là cổng đọc/ghi chung cho toàn nhóm: `readStore()`, `updateStore(mutator)`, `resetStore()`. Duy nhất một khóa dữ liệu `linewatch.v1` trong `localStorage`. `updateStore` ghi một bản sao sau khi thao tác thành công rồi phát sự kiện `linewatch:data-changed`. Không tạo kho riêng cho từng màn.
- `js/api.js` xuất toàn bộ hàm trong bảng hợp đồng Word. Hàm của phần Nguyên đã hoạt động; facade tự tải `js/lines.js`, `js/incident-create.js`, `js/incident-flow.js`, `js/shift-notes.js`, `js/reports.js` khi các bạn đặt đúng tệp vào `js/`. Có thể gọi `registerModules({ getLines, ..., closeIncident })` lúc khởi động nếu cần tên tệp khác. Chưa có tệp của bạn khác thì lời gọi trả `{ok:false,error:{code:'NOT_FOUND',message:...}}`, không bịa dữ liệu hoặc sửa phần nghiệp vụ của họ.
- Mọi hàm bất đồng bộ trả `{ok,data,error}`. Các thao tác của kỹ thuật viên tìm `maintenanceTasks` bằng `assigneeId`, kiểm tra phiên, rồi thay đổi task và chính `incidents` có `task.incidentId`. `startTask` chuyển `pending/assigned` → `in_progress/in_progress`; `resolveTask` cần đủ `cause/action/result`, chuyển `done/resolved`, ghi mốc kết thúc downtime. Sơn tiếp tục `closeIncident` sau khi xác nhận.
- `analyzeMachine({machineId})` dùng lịch sử sự cố **đã xử lý** cùng máy/cùng nhóm. Khi dưới hai bản ghi phù hợp, trả `NO_EVIDENCE`, giao diện chỉ dẫn nhập kỹ thuật thủ công. Khi đủ dữ liệu, giao diện hỗ trợ chấp nhận, chỉnh, từ chối, tạo lại; lựa chọn lưu ở `task.ai3`. Dữ liệu seed ban đầu chỉ có một sự cố đang chờ, nên nhánh thiếu dữ liệu xuất hiện đúng thực tế. AI-3 là quy tắc mô phỏng, không gọi LLM.
- Khung 10 hiển thị dòng sự cố trong 90 ngày, thanh tần suất theo nhóm và thẻ nhật ký bảo trì theo bố cục Figma. `maintenanceLogs` là danh sách mở rộng trong cùng `linewatch.v1`: thêm/sửa/lưu trữ không xóa dấu vết; hoàn tất MT tạo một ghi nhận liên kết. Dữ liệu seed chỉ có `INC-240`, nên số dòng lịch sử và gợi ý AI sẽ ít hơn nội dung minh họa tĩnh trên Figma cho đến khi nhóm tạo các sự cố lịch sử thật.
- Ảnh, dữ liệu và ID giữ theo tài liệu nhóm. Không dùng tên "hợp đồng" cho chức năng hoặc nhãn sản phẩm; Word chỉ là quy ước tích hợp của nhóm.

## Token và chế độ sáng/tối

Các trang phải nạp `js/theme.js` trong `<head>` trước `css/style.css`, đặt nút `data-theme-toggle`, sau đó dùng các token `--page`, `--surface`, `--surface-soft`, `--sidebar`, `--text`, `--muted`, `--border`, `--green`, `--red`, `--amber`, `--blue` cùng các biến `*-tint`. Lựa chọn `light`/`dark` lưu trong `linewatch-theme`, áp dụng trên `<html data-theme>`. Không tạo một khóa/theme riêng ở trang của Thắng/Sơn. Ảnh nhà máy giữ nguyên màu. `css/style.css` cũng có nút, form, thẻ, chip, toast và trạng thái chung; CSS từng trang dùng token này.

Các trang của Nguyên đã có nút chuyển, gồm login, forgot, queue, detail, history, 404 và 500. Khi ghép trang của Thắng/Sơn, chính chủ màn cần kiểm tra tất cả trạng thái, bảng, biểu đồ và lỗi form ở cả hai chế độ. Chỉ sau khi tất cả trang hiện diện mới có thể xác nhận kiểm tra xuyên **toàn bộ 23 khung**.

Tên lớp bố cục và hàm hỗ trợ giao diện dùng tiếng Việt không dấu để dễ đọc, chẳng hạn `khung-ung-dung`, `thanh-ben`, `noi-dung-trang`, `dong-su-co`, `hienThiNhatKy`. Giữ nguyên tên tệp, hàm API công khai (`getTasks`, `resolveTask`...), khóa lưu, ID và tên trường (`incidentId`, `assigneeId`...) theo Word; đổi chúng trong một nhánh riêng sẽ làm hỏng điểm ghép với Thắng/Sơn.

## Kiểm tra nhanh

1. Vào đăng nhập, nhập sai mật khẩu để thấy biến thể 17; nhập `123456` hoặc chọn Bảo trì.
2. Ở hàng chờ tìm `MT-240`, mở chi tiết; `Lưu hoàn tất` bị khóa cho đến khi chọn `Bắt đầu xử lý`. Nhập ba trường rồi lưu; quay về hàng chờ và lịch sử để thấy cùng `INC-240` đã chuyển trạng thái.
3. Mở lịch sử `M-202`: seed chưa đủ hai sự cố hoàn tất cùng nhóm, nên AI-3 báo `NO_EVIDENCE` và liên kết nhập thủ công. Khi các màn khác bổ sung lịch sử hợp lệ, kiểm tra các lựa chọn AI-3.
4. Chuyển tối ở một trang, sang các trang còn lại và tải lại; giao diện vẫn tối. Chuyển về sáng. Kiểm tra ở màn hình rộng và điện thoại.
5. Nút `Đặt lại dữ liệu demo` tại hàng chờ nạp lại seed, hữu ích trước lần quay OBS kế tiếp.

Các trang của Thắng/Sơn, PR, Trello và OBS chưa nằm trong ZIP code này. Phần nhóm được ghép và xác minh sau khi họ bàn giao; đừng coi bộ mã riêng này là sản phẩm đầy đủ.
