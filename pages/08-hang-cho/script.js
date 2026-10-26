import { getTasks } from '../../js/api.js';
import { resetStore } from '../../js/store.js';
import { hienThiNgay, thoatHtml, tenUuTien, yeuCauTaiKhoanBaoTri, tenTrangThai, thongBaoNoi } from '../../js/ui.js';

const list = document.getElementById('task-list');
const search = document.getElementById('task-search');
let tasks = [];

function hienThiCongViec() {
  const query = search.value.trim().toLocaleLowerCase('vi-VN');
  const shown = tasks.filter(task => [task.id, task.incident?.id, task.incident?.title, task.machine?.name]
    .some(value => String(value || '').toLocaleLowerCase('vi-VN').includes(query)));
  document.getElementById('assigned-count').textContent = tasks.filter(task => task.status === 'pending').length;
  document.getElementById('progress-count').textContent = tasks.filter(task => task.status === 'in_progress').length;
  document.getElementById('high-count').textContent = `${tasks.filter(task => task.status === 'pending' && task.incident?.priority === 'high').length} ưu tiên cao`;
  document.getElementById('waiting-count').textContent = tasks.filter(task => task.status === 'pending' &&
    Date.now() - new Date(task.incident?.assignedAt || task.incident?.reportedAt).getTime() > 30 * 60 * 1000).length;
  list.className = shown.length ? '' : 'empty';
  list.innerHTML = shown.length ? shown.map(task => `<article class="dong-cong-viec ${thoatHtml(task.incident?.priority)}">
    <div><span class="ma-cong-viec">${thoatHtml(task.id)} · ${thoatHtml(task.incidentId)}</span>
    <strong>${thoatHtml(task.incident?.title || 'Sự cố chưa đặt tên')}</strong><span class="chu-phu">${thoatHtml(task.machine?.name || task.incident?.machineId || 'Chưa có máy')}</span></div>
    <span class="nhan ${task.incident?.priority === 'high' ? 'red' : 'amber'}">${tenUuTien(task.incident?.priority)}</span>
    <span class="chu-phu">${tenTrangThai(task.status)}<br>${hienThiNgay(task.incident?.assignedAt)}</span>
    <a class="nut phu" href="../09-chi-tiet/maintenance-incident-detail.html?taskId=${encodeURIComponent(task.id)}">${task.status === 'done' ? 'Xem lại' : 'Xem công việc'}</a>
  </article>`).join('') : query ? 'Không tìm thấy công việc phù hợp.' : 'Chưa có công việc được phân cho tài khoản này.';
}

async function taiCongViec(user) {
  const response = await getTasks(user.id);
  if (!response.ok) { list.className = 'thong-bao error'; list.textContent = response.error.message; return; }
  tasks = response.data;
  hienThiCongViec();
}
const user = await yeuCauTaiKhoanBaoTri('queue');
if (user) {
  await taiCongViec(user);
  search.addEventListener('input', hienThiCongViec);
  window.addEventListener('linewatch:data-changed', () => taiCongViec(user));
  document.getElementById('reset-data').addEventListener('click', async () => {
    try { await resetStore(); thongBaoNoi('Đã nạp lại dữ liệu mẫu.', 'success'); }
    catch (error) { thongBaoNoi(error.message, 'error'); }
  });
}
