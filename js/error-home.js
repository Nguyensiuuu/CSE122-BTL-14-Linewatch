// Trở về trang đúng với vai trò đang đăng nhập, kể cả khi gặp lỗi 404/500.
import { getCurrentUser } from './auth.js';
const duongDan = {
  operator: 'pages/operator-line-status.html',
  supervisor: 'pages/supervisor-shift-dashboard.html',
  maintenance: 'pages/08-hang-cho/maintenance-queue.html',
  admin: 'pages/admin-machine-management.html'
};
const ketQua = await getCurrentUser();
const trang = duongDan[ketQua.data?.role] || 'pages/01-dang-nhap/login.html';
document.querySelectorAll('[data-home-link]').forEach(link => {
  link.href = new URL('../' + trang, import.meta.url).href;
  link.textContent = ketQua.data ? 'Về trang của tôi' : 'Về đăng nhập';
});
