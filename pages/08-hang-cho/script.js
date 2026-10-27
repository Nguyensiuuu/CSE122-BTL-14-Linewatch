import { getTasks } from '../../js/api.js';
import { resetStore } from '../../js/store.js';
import { hienThiNgay, thoatHtml, tenUuTien, yeuCauTaiKhoanBaoTri, tenTrangThai, thongBaoNoi } from '../../js/ui.js';

const list = document.getElementById('task-list');
const search = document.getElementById('task-search');
let tasks = [];

function hienThiCongViec() {
  const query = search.value.trim().toLocaleLowerCase('vi-VN');
  const status = document.getElementById('task-status').value;
  const priority = document.getElementById('task-priority').value;
  const sort = document.getElementById('task-sort').value;
  const shown = tasks.filter(task =>
    (!status || task.status === status) && (!priority || task.incident?.priority === priority) &&
    [task.id, task.incident?.id, task.incident?.title, task.incident?.description, task.incident?.machineId, task.machine?.name]
      .some(value => String(value || '').toLocaleLowerCase('vi-VN').includes(query)))
    .sort((a, b) => sort === 'priority' ?
      ({ high: 0, medium: 1, low: 2 }[a.incident?.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.incident?.priority] ?? 3) :
      (sort === 'newest' ? -1 : 1) * (new Date(a.incident?.assignedAt || a.incident?.reportedAt) - new Date(b.incident?.assignedAt || b.incident?.reportedAt)));
  document.getElementById('assigned-count').textContent = tasks.filter(task => task.status === 'pending').length;
  document.getElementById('progress-count').textContent = tasks.filter(task => task.status === 'in_progress').length;
  document.getElementById('high-count').textContent = `${tasks.filter(task => task.status === 'pending' && task.incident?.priority === 'high').length} ưu tiên cao`;
  document.getElementById('waiting-count').textContent = tasks.filter(task => task.status === 'pending' &&
    Date.now() - new Date(task.incident?.assignedAt || task.incident?.reportedAt).getTime() > 30 * 60 * 1000).length;
  list.className = shown.length ? '' : 'empty';
  list.innerHTML = shown.length ? shown.map(task => `<article class="dong-cong-viec ${thoatHtml(task.incident?.priority)}">
    <div><strong>${thoatHtml(task.incident?.machineId || 'Chưa rõ máy')} · ${thoatHtml(task.machine?.name || 'Máy chưa có tên')}</strong>
    <span class="chu-phu">Sự cố: ${thoatHtml(task.incident?.description || task.incident?.title || 'Chưa có mô tả')}</span>
    <span class="ma-cong-viec">Mã sự cố ${thoatHtml(task.incidentId)} · Việc bảo trì ${thoatHtml(task.id)}</span></div>
    <span class="nhan ${task.incident?.priority === 'high' ? 'red' : 'amber'}">${tenUuTien(task.incident?.priority)}</span>
    <span class="chu-phu">${tenTrangThai(task.status)}<br>${hienThiNgay(task.incident?.assignedAt)}</span>
    <a class="nut phu" href="../09-chi-tiet/maintenance-incident-detail.html?taskId=${encodeURIComponent(task.id)}">${task.status === 'done' ? 'Xem lại' : 'Xem công việc'}</a>
  </article>`).join('') : tasks.length ? '<p>Không có việc phù hợp. Hãy đổi từ khóa hoặc bộ lọc.</p><button type="button" class="nut phu" id="clear-task-filters">Xóa bộ lọc</button>' : 'Chưa có công việc được phân cho tài khoản này. Khi trưởng ca phân công, việc sẽ hiện tại đây.';
}

async function taiCongViec(user) {
  const response = await getTasks(user.id);
  if (!response.ok) {
    list.className = 'thong-bao error';
    list.replaceChildren();
    const message = document.createElement('p');
    message.textContent = response.error.message;
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'nut phu'; retry.textContent = 'Thử lại';
    retry.addEventListener('click', () => taiCongViec(user));
    list.append(message, retry);
    return;
  }
  tasks = response.data;
  hienThiCongViec();
}
const user = await yeuCauTaiKhoanBaoTri('queue');
if (user) {
  await taiCongViec(user);
  search.addEventListener('input', hienThiCongViec);
  for (const id of ['task-status', 'task-priority', 'task-sort']) document.getElementById(id).addEventListener('change', hienThiCongViec);
  list.addEventListener('click', event => {
    if (!event.target.closest('#clear-task-filters')) return;
    search.value = '';
    document.getElementById('task-status').value = '';
    document.getElementById('task-priority').value = '';
    document.getElementById('task-sort').value = 'priority';
    hienThiCongViec();
  });
  window.addEventListener('linewatch:data-changed', () => taiCongViec(user));
  document.getElementById('reset-data').addEventListener('click', async () => {
    try { await resetStore(); thongBaoNoi('Đã nạp lại dữ liệu mẫu.', 'success'); }
    catch (error) { thongBaoNoi(error.message, 'error'); }
  });
}
