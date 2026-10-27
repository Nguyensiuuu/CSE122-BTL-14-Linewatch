import { getCurrentUser } from './auth.js';
import { readStore } from './store.js';

export const thoatHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export const hienThiNgay = value => value ? new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh'
}).format(new Date(value)) : 'Chưa có';

export function thongBaoNoi(message, type = '') {
  const region = document.getElementById('toasts');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `thong-bao-noi ${type}`;
  item.setAttribute('role', 'status');
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 5000);
}

export const tenTrangThai = status => ({
  pending: 'Chờ xử lý', in_progress: 'Đang xử lý', done: 'Đã hoàn tất',
  assigned: 'Đã phân công', resolved: 'Đã xử lý', closed: 'Đã đóng',
  cancelled: 'Đã hủy', reported: 'Đã báo cáo', accepted: 'Đã tiếp nhận'
})[status] || status || 'Chưa rõ';

export const tenUuTien = priority => ({ high: 'Cao', medium: 'Trung bình', low: 'Thấp' })[priority] || priority || '—';
export const tenNhomLoi = category => ({ mechanical: 'Cơ khí', electrical: 'Điện', quality: 'Chất lượng', other: 'Khác' })[category] || category || 'Khác';

export async function yeuCauTaiKhoanBaoTri(active = 'queue') {
  const result = await getCurrentUser();
  if (!result.ok) { location.href = '../20-loi-500/500.html'; return null; }
  if (!result.data || result.data.role !== 'maintenance') {
    location.href = '../01-dang-nhap/login.html'; return null;
  }
  const user = result.data;
  const data = await readStore();
  const shift = [...(data.shifts || [])].sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)))[0];
  const hour = value => value ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—';
  const links = [
    ['queue', 'Hàng chờ bảo trì', '../08-hang-cho/maintenance-queue.html'],
    ['detail', 'Chi tiết sự cố', '../09-chi-tiet/maintenance-incident-detail.html'],
    ['history', 'Lịch sử máy', '../10-lich-su/maintenance-machine-history.html']
  ];
  document.getElementById('sidebar').innerHTML = `
    <div class="thuong-hieu"><strong>LINEWATCH</strong><small>Theo dõi ca sản xuất</small><span class="nhan-vai-tro">Kỹ thuật bảo trì</span></div>
    <nav class="danh-sach-dieu-huong" aria-label="Điều hướng bảo trì">${links.map(([id, title, href]) =>
      `<a class="muc-dieu-huong ${id === active ? 'active' : ''}" href="${href}" ${id === active ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav>
    <div class="thong-tin-ca"><span>Ca mẫu</span><strong>${thoatHtml(shift?.name || 'Ca 2')} · ${hour(shift?.startsAt)}–${hour(shift?.endsAt)}</strong><span>Tổ A · Xưởng 01</span></div>`;
  const pageTitle = ({ queue: 'Hàng chờ bảo trì', detail: 'Chi tiết sự cố', history: 'Lịch sử máy' })[active];
  document.getElementById('topbar').innerHTML = `
    <div class="tieu-de-tren">${pageTitle}</div>
    <div class="thao-tac-tren"><span class="ngay-hom-nay">${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}</span>
    </div>`;
  return user;
}
