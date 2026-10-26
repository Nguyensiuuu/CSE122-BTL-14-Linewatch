import { getTasks, getTaskDetail, getMachineHistory, resolveTask, startTask } from '../../js/api.js';
import { tenNhomLoi, hienThiNgay, thoatHtml, tenUuTien, yeuCauTaiKhoanBaoTri, tenTrangThai, thongBaoNoi } from '../../js/ui.js';

const user = await yeuCauTaiKhoanBaoTri('detail');
if (user) {
  const queryId = new URLSearchParams(location.search).get('taskId');
  const assigned = await getTasks(user.id);
  let taskId = queryId || (assigned.ok && assigned.data[0]?.id);
  const form = document.getElementById('work-form');
  const error = document.getElementById('work-error');

  async function render() {
    if (!taskId) { document.getElementById('detail-title').textContent = 'Chưa có công việc được phân'; form.hidden = true; return; }
    const response = await getTaskDetail(taskId);
    if (!response.ok) {
      document.getElementById('detail-title').textContent = response.error.message;
      form.hidden = true;
      return;
    }
    const { task, incident, machine, line, reporter } = response.data;
    document.getElementById('detail-title').textContent = `${incident.id} · ${incident.machineId}`;
    document.getElementById('detail-subtitle').textContent = `${line?.name || incident.lineId} · Ưu tiên ${tenUuTien(incident.priority).toLowerCase()} · ${tenTrangThai(incident.status)}`;
    document.getElementById('incident-info').innerHTML = [
      ['Dây chuyền', `${incident.lineId} · ${line?.name || 'Chưa đặt tên'}`],
      ['Máy', `${incident.machineId} · ${machine?.name || 'Chưa đặt tên'}`],
      ['Người báo', `${reporter?.name || incident.reportedById} · ${hienThiNgay(incident.reportedAt)}`],
      ['Mô tả', incident.description]
    ].map(([label, value]) => `<dt>${thoatHtml(label)}</dt><dd>${thoatHtml(value)}</dd>`).join('');
    for (const key of ['cause', 'action', 'result']) form.elements[key].value = task[key] || '';
    const done = task.status === 'done';
    form.elements.cause.readOnly = done;
    form.elements.action.readOnly = done;
    form.elements.result.readOnly = done;
    document.getElementById('task-status').innerHTML = `<span class="nhan ${done ? 'green' : task.status === 'in_progress' ? 'blue' : 'amber'}">${tenTrangThai(task.status)}</span>`;
    document.getElementById('start-task').hidden = task.status !== 'pending';
    document.getElementById('resolve-task').hidden = done;
    document.getElementById('resolve-task').disabled = task.status !== 'in_progress';
    document.getElementById('timeline').innerHTML = [
      ['Báo cáo', incident.reportedAt], ['Tiếp nhận', incident.acceptedAt], ['Phân công', incident.assignedAt],
      ['Bắt đầu xử lý', task.startedAt], ['Hoàn tất kỹ thuật', task.completedAt], ['Trưởng ca đóng', incident.closedAt]
    ].filter(([, date]) => date).map(([label, date]) => `<li><time>${hienThiNgay(date)}</time><span>${label}</span></li>`).join('');
    const machineLink = document.getElementById('machine-link');
    machineLink.href = `../10-lich-su/maintenance-machine-history.html?machineId=${encodeURIComponent(incident.machineId)}&taskId=${encodeURIComponent(task.id)}`;
    const history = await getMachineHistory(incident.machineId);
    document.getElementById('history-summary').textContent = history.ok
      ? `${history.data.incidents.length} sự cố trên máy này; ${history.data.tasks.filter(item => item.status === 'done').length} công việc đã hoàn tất.`
      : history.error.message;
  }

  document.getElementById('start-task').addEventListener('click', async () => {
    const result = await startTask(taskId);
    if (!result.ok) { thongBaoNoi(result.error.message, 'error'); return; }
    thongBaoNoi('Đã bắt đầu xử lý. Sự cố liên kết cũng chuyển sang đang xử lý.', 'success');
    await render();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    const result = await resolveTask(taskId, fields);
    if (!result.ok) { error.textContent = result.error.message; error.hidden = false; return; }
    error.hidden = true;
    thongBaoNoi('Đã lưu xử lý kỹ thuật; trưởng ca có thể đóng sự cố.', 'success');
    await render();
  });
  form.addEventListener('input', () => { error.hidden = true; });
  await render();
}
