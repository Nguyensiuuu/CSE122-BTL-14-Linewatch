LineWatch – phần của Sơn (khung 05,06,07,11,13,18,21) theo hợp đồng v1.
Chạy: bấm đúp chay.bat (Windows) hoặc chạy chay.sh, hoặc Live Server; rồi mở http://localhost:8000/ (KHÔNG mở file bằng double-click vì module/fetch cần HTTP).
Dữ liệu: assets/data/seed.json (chung, đã bổ sung bản ghi, không đổi schema). Khóa localStorage: linewatch.v1. Reset: localStorage.removeItem('linewatch.v1').
js/store.js, api.js: BẢN TẠM của Nguyên để chạy độc lập; Nguyên thay thế, giữ nguyên chữ ký hàm.
Mô-đun của Sơn: incident-flow.js, shift-notes.js, reports.js, ai2.js. Demo lỗi AI-2: thêm ?ai2=error vào URL trang bàn giao.
