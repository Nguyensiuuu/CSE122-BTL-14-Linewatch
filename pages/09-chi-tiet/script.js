import { getTasks, getTaskDetail, getMachineHistory, resolveTask, startTask } from '../../js/api.js';
import { tenNhomLoi, hienThiNgay, thoatHtml, tenUuTien, yeuCauTaiKhoanBaoTri, tenTrangThai, thongBaoNoi } from '../../js/ui.js';
import { setFieldError, clearFieldError } from '../../js/modules/shared/ui.js';

const user = await yeuCauTaiKhoanBaoTri('detail');
if (user) {
  const queryId = new URLSearchParams(location.search).get('taskId');
  const assigned = await getTasks(user.id);
  let taskId = queryId || (assigned.ok && assigned.data[0]?.id);
  const form = document.getElementById('work-form');
  const error = document.getElementById('work-error');
  let dangGui = false;

  async function render() {
    if (!taskId) { document.getElementById('detail-title').textContent = 'Chưa có công việc được phân'; form.hidden = true; return; }
    const response = await getTaskDetail(taskId);
    if (!response.ok) {
      document.getElementById('detail-title').textContent = response.error.message;
      form.hidden = true;
      return;
    }
    const { task, incident, machine, line, reporter } = response.data;
    document.getElementById('detail-title').textContent = `${incident.machineId} · ${machine?.name || 'Máy chưa có tên'}`;
    document.getElementById('detail-subtitle').textContent = `Sự cố: ${incident.description || incident.title || 'Chưa có mô tả'} · ${incident.id} · Việc bảo trì ${task.id} · Ưu tiên ${tenUuTien(incident.priority).toLowerCase()} · ${tenTrangThai(incident.status)}`;
    document.getElementById('incident-info').innerHTML = [
      ['Dây chuyền', `${incident.lineId} · ${line?.name || 'Chưa đặt tên'}`],
      ['Máy', `${incident.machineId} · ${machine?.name || 'Chưa đặt tên'}`],
      ['Người báo', `${reporter?.name || incident.reportedById} · ${hienThiNgay(incident.reportedAt)}`],
      ['Mô tả', incident.description],
      ['Mức ảnh hưởng', incident.impactNote || 'Chưa ghi']
    ].map(([label, value]) => `<dt>${thoatHtml(label)}</dt><dd>${thoatHtml(value)}</dd>`).join('');
    for (const key of ['cause', 'action', 'result']) form.elements[key].value = task[key] || '';
    const done = task.status === 'done';
    const editable = task.status === 'in_progress';
    for (const key of ['cause', 'action', 'result']) {
      form.elements[key].readOnly = !editable;
      form.elements[key].title = editable ? '' : done
        ? 'Công việc đã hoàn tất, không thể sửa tại đây.'
        : 'Bấm “Bắt đầu xử lý” trước khi ghi cập nhật kỹ thuật.';
      form.elements[key].setAttribute('aria-disabled', String(!editable));
    }
    document.getElementById('work-hint').textContent = editable
      ? 'Đang xử lý: nhập nguyên nhân, biện pháp và kết quả rồi lưu hoàn tất.'
      : done ? 'Công việc đã hoàn tất. Các ghi nhận đã được khóa.'
        : 'Bấm “Bắt đầu xử lý” để mở các ô cập nhật.';
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
    const nut = document.getElementById('start-task');
    nut.disabled = true;
    let result;
    try { result = await startTask(taskId); }
    catch (loi) { result = { ok: false, error: { message: loi.message } }; }
    finally { nut.disabled = false; }
    if (!result.ok) { thongBaoNoi(result.error.message, 'error'); return; }
    thongBaoNoi('Đã bắt đầu xử lý. Sự cố liên kết cũng chuyển sang đang xử lý.', 'success');
    await render();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (dangGui) return;
    for (const key of ['cause', 'action', 'result']) clearFieldError(form.elements[key]);
    if (form.elements.cause.readOnly) return;
    for (const key of ['cause', 'action', 'result']) {
      const oNhap = form.elements[key];
      if (oNhap.value.trim().length < 3) {
        setFieldError(oNhap, 'Nhập ít nhất 3 ký tự trước khi lưu hoàn tất.');
        oNhap.focus(); return;
      }
    }
    dangGui = true;
    const nut = document.getElementById('resolve-task');
    nut.disabled = true;
    try {
      const fields = Object.fromEntries(new FormData(form));
      const result = await resolveTask(taskId, fields);
      if (!result.ok) { error.textContent = result.error.message; error.hidden = false; return; }
      error.hidden = true;
      thongBaoNoi('Đã lưu xử lý kỹ thuật; trưởng ca có thể đóng sự cố.', 'success');
      await render();
    } catch (loi) { error.textContent = loi.message; error.hidden = false; }
    finally { dangGui = false; if (!nut.hidden && !form.elements.cause.readOnly) nut.disabled = false; }
  });
  form.addEventListener('input', event => { error.hidden = true; if (event.target.id) clearFieldError(event.target); });
  await render();
}
