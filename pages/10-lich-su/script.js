import { analyzeMachine, archiveMaintenanceLog, createMaintenanceLog, getMachineHistory,
  getMaintenanceLogs, getTasks, getUsers, saveAi3Decision, updateMaintenanceLog } from '../../js/api.js';
import { tenNhomLoi, hienThiNgay, thoatHtml, yeuCauTaiKhoanBaoTri, thongBaoNoi } from '../../js/ui.js';
import { setFieldError, clearFieldError } from '../../js/modules/shared/ui.js';

const user = await yeuCauTaiKhoanBaoTri('history');
if (user) {
  const params = new URLSearchParams(location.search);
  const ownTasks = await getTasks(user.id);
  const requestedTask = ownTasks.ok && ownTasks.data.find(item => item.id === params.get('taskId'));
  const taskId = requestedTask?.id || null;
  const machineId = params.get('machineId') || requestedTask?.incident?.machineId ||
    (ownTasks.ok && ownTasks.data[0]?.incident?.machineId) || 'M-202';
  // Chỉ lưu kết quả phân tích vào công việc của chính máy đang xem.
  const taskForMachine = requestedTask?.incident?.machineId === machineId ? taskId : null;
  const matchingTasks = ownTasks.ok ? ownTasks.data.filter(item => item.incident?.machineId === machineId) : [];
  const taskSelect = document.getElementById('ai-task-select');
  for (const item of matchingTasks) {
    const option = new Option(`${item.incidentId} · ${item.incident?.description || item.incident?.title || 'Công việc bảo trì'} (${item.status === 'done' ? 'đã xử lý' : item.status === 'in_progress' ? 'đang xử lý' : 'chờ xử lý'})`, item.id);
    taskSelect.add(option);
  }
  taskSelect.value = taskForMachine || '';
  taskSelect.addEventListener('change', () => {
    const next = new URL(location.href);
    next.searchParams.set('machineId', machineId);
    if (taskSelect.value) next.searchParams.set('taskId', taskSelect.value);
    else next.searchParams.delete('taskId');
    location.href = next.href;
  });
  const khungLichSu = document.getElementById('history-content');
  const khungGoiY = document.getElementById('ai-content');
  const cacNutGoiY = document.getElementById('ai-actions');
  const loiNhanGoiY = document.getElementById('ai-message');
  const mauSuaGoiY = document.getElementById('ai-edit-form');
  const khungNhatKy = document.getElementById('journal-content');
  const mauNhatKy = document.getElementById('journal-form');
  document.getElementById('journal-context').textContent = taskForMachine
    ? `Ghi nhận này sẽ liên kết với sự cố ${requestedTask.incidentId} của máy ${machineId}.`
    : `Ghi nhận chung cho máy ${machineId}; chọn công việc ở khung AI-3 nếu cần liên kết với sự cố.`;
  let analysis;
  let savedDecision = requestedTask?.ai3 || null;
  let logs = [];
  let dangLuuNhatKy = false;
  const allUsers = await getUsers();
  const userNames = new Map((allUsers.ok ? allUsers.data : []).map(item => [item.id, item.name]));

  const history = await getMachineHistory(machineId);
  if (!history.ok) {
    document.getElementById('machine-title').textContent = history.error.message;
    khungLichSu.className = 'thong-bao error'; khungLichSu.textContent = history.error.message;
  } else {
    const { machine, incidents, tasks } = history.data;
    document.getElementById('machine-title').textContent = `${machine.id} · ${machine.name}`;
    document.getElementById('journal-machine').textContent = machine.id;
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recent = incidents.filter(incident => new Date(incident.reportedAt).getTime() >= cutoff);
    khungLichSu.className = 'cac-su-co';
    khungLichSu.innerHTML = recent.length ? recent.map(incident => {
      const task = tasks.find(item => item.incidentId === incident.id);
      const start = new Date(incident.downtimeStartAt).getTime();
      const end = new Date(incident.downtimeEndAt).getTime();
      const duration = incident.downtimeStartAt && incident.downtimeEndAt && end >= start
        ? `${Math.round((end - start) / 60000)} phút` : 'Chưa kết thúc';
      const shortDate = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(incident.reportedAt));
      return `<article class="dong-su-co">
        <span class="cham-su-co ${thoatHtml(incident.priority || 'low')}"></span>
        <time title="${hienThiNgay(incident.reportedAt)}">${shortDate}</time>
        <strong>${thoatHtml(incident.title)}</strong><span class="bien-phap">${thoatHtml(task?.action || 'Chưa ghi biện pháp')}</span>
        <span class="thoi-gian-dung">${duration}</span>
      </article>`;
    }).join('') : '<p class="trong">Không có sự cố trong 90 ngày gần đây.</p>';
    const frequencies = [...new Set(recent.map(incident => incident.category || 'other'))]
      .map(category => [category, recent.filter(incident => (incident.category || 'other') === category).length]);
    const max = Math.max(1, ...frequencies.map(([, count]) => count));
    document.getElementById('frequency').innerHTML = frequencies.length ? frequencies.map(([category, count]) =>
      `<div class="dong-bieu-do ${thoatHtml(category)}"><span>${tenNhomLoi(category)}</span><div class="nen-thanh">
          <span style="width:${Math.round(count / max * 100)}%"></span></div><strong>${count}</strong></div>`).join('')
      : '<p class="chu-phu">Chưa có số liệu để vẽ biểu đồ.</p>';
  }

  function gioDiaPhuong(value) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  async function hienThiNhatKy() {
    const response = await getMaintenanceLogs(machineId);
    if (!response.ok) { khungNhatKy.className = 'thong-bao error'; khungNhatKy.textContent = response.error.message; return; }
    logs = response.data;
    const active = logs.filter(log => !log.archivedAt);
    khungNhatKy.className = '';
    khungNhatKy.innerHTML = active.length ? active.map(log => `<div class="dong-nhat-ky">
      <p>${hienThiNgay(log.performedAt)} · ${thoatHtml(log.action)} · ${thoatHtml(userNames.get(log.authorId) || log.authorId)}${log.incidentId ? ` · Sự cố ${thoatHtml(log.incidentId)}` : ' · Ghi nhận chung của máy'}</p>
      ${log.authorId === user.id ? `<div class="thao-tac-nhat-ky"><button type="button" data-edit="${thoatHtml(log.id)}">Sửa ghi nhận</button>
      <button type="button" class="nut-luu-tru" data-archive="${thoatHtml(log.id)}">Lưu trữ</button></div>` : ''}</div>`).join('')
      : '<p class="chu-phu nhat-ky-rong">Chưa có ghi nhận bảo trì. Hãy thêm công việc đã thực hiện.</p>';
  }
  document.getElementById('journal-add').addEventListener('click', () => {
    mauNhatKy.reset();
    document.getElementById('journal-id').value = '';
    document.getElementById('journal-time').value = gioDiaPhuong(new Date());
    mauNhatKy.hidden = false;
    document.getElementById('journal-action-text').focus();
  });
  document.getElementById('journal-cancel').addEventListener('click', () => { mauNhatKy.hidden = true; });
  khungNhatKy.addEventListener('click', async event => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    const archiveId = event.target.closest('[data-archive]')?.dataset.archive;
    if (editId) {
      const log = logs.find(item => item.id === editId);
      if (!log) return;
      document.getElementById('journal-id').value = log.id;
      document.getElementById('journal-action-text').value = log.action;
      document.getElementById('journal-time').value = gioDiaPhuong(log.performedAt);
      mauNhatKy.hidden = false;
    }
    if (archiveId) {
      const result = await archiveMaintenanceLog(archiveId);
      thongBaoNoi(result.ok ? 'Đã lưu trữ ghi nhận, vẫn giữ dấu vết lịch sử.' : result.error.message, result.ok ? 'success' : 'error');
      if (result.ok) await hienThiNhatKy();
    }
  });
  mauNhatKy.addEventListener('submit', async event => {
    event.preventDefault();
    if (dangLuuNhatKy) return;
    const oCongViec = document.getElementById('journal-action-text');
    const oThoiGian = document.getElementById('journal-time');
    clearFieldError(oCongViec); clearFieldError(oThoiGian);
    const action = document.getElementById('journal-action-text').value.trim();
    const performedAt = document.getElementById('journal-time').value;
    if (action.length < 3) { setFieldError(oCongViec, 'Ghi công việc đã làm (ít nhất 3 ký tự).'); oCongViec.focus(); return; }
    if (!performedAt || !Number.isFinite(Date.parse(performedAt))) {
      setFieldError(oThoiGian, 'Chọn thời gian thực hiện hợp lệ.'); oThoiGian.focus(); return;
    }
    const id = document.getElementById('journal-id').value;
    dangLuuNhatKy = true;
    const nutLuu = mauNhatKy.querySelector('[type="submit"]');
    nutLuu.disabled = true;
    try {
      const result = id ? await updateMaintenanceLog(id, { action, performedAt })
        : await createMaintenanceLog({ machineId, taskId: taskForMachine, action, performedAt });
      const error = document.getElementById('journal-error');
      if (!result.ok) { error.textContent = result.error.message; error.hidden = false; return; }
      error.hidden = true; mauNhatKy.hidden = true;
      thongBaoNoi(id ? 'Đã sửa ghi nhận.' : 'Đã thêm công việc.', 'success');
      await hienThiNhatKy();
    } catch (loi) { thongBaoNoi(loi.message, 'error'); }
    finally { dangLuuNhatKy = false; nutLuu.disabled = false; }
  });
  await hienThiNhatKy();

  async function phanTichLai() {
    cacNutGoiY.hidden = true; mauSuaGoiY.hidden = true;
    khungGoiY.className = 'dang-tai'; khungGoiY.textContent = 'Đang phân tích dữ liệu…';
    analysis = await analyzeMachine({ machineId });
    if (!analysis.ok) {
      khungGoiY.className = 'goi-y-thieu-du-lieu';
      khungGoiY.innerHTML = `<span class="nhan amber">Chưa đủ bằng chứng</span>
        <p>${thoatHtml(analysis.error.message)}</p>
        <p class="chu-phu">${analysis.error.code === 'NO_EVIDENCE'
          ? requestedTask?.status === 'done' ? 'Công việc đã hoàn tất; biện pháp xử lý được lưu trong chi tiết sự cố.'
            : taskForMachine ? 'Mở công việc để bắt đầu xử lý và ghi biện pháp thủ công.'
              : 'Chưa có đủ sự cố tương tự để đưa ra khuyến nghị.'
          : 'Hãy thử lại sau khi dữ liệu có sẵn.'}</p>
        <button type="button" class="nut phu" data-ai-retry>Thử lại phân tích</button>`;
      loiNhanGoiY.textContent = '';
      if (taskForMachine && analysis.error.code === 'NO_EVIDENCE') {
        khungGoiY.insertAdjacentHTML('beforeend', ` <a href="../09-chi-tiet/maintenance-incident-detail.html?taskId=${encodeURIComponent(taskForMachine)}">${requestedTask?.status === 'done' ? 'Xem công việc đã hoàn tất' : 'Mở công việc để xử lý thủ công'} →</a>`);
      }
      return;
    }
    const { suggestion, reason, references } = analysis.data;
    khungGoiY.className = 'ket-qua-goi-y';
    khungGoiY.innerHTML = `<span class="nhan amber">Mẫu lặp đáng chú ý</span>
      <p class="tom-tat-goi-y">${thoatHtml(reason)}</p>
      <p class="chu-phu">Độ tin cậy ${Math.round(analysis.data.confidence * 100)}% · Dựa trên lịch sử 90 ngày của máy này.</p>
      <p class="nhan-goi-y">Bằng chứng</p>
      <ul class="bang-chung-goi-y">${references.map(id => {
        const item = history.ok && history.data.incidents.find(incident => incident.id === id);
        return `<li>${thoatHtml(id)}${item ? ` · ${thoatHtml(hienThiNgay(item.reportedAt))} · ${thoatHtml(item.description || item.title)}` : ''}</li>`;
      }).join('')}</ul>
      <p class="nhan-goi-y">Khuyến nghị kiểm tra</p><p>${thoatHtml(suggestion.recommendation)}</p>`;
    cacNutGoiY.hidden = false;
    loiNhanGoiY.textContent = taskForMachine
      ? savedDecision ? `Đã lưu lựa chọn ${savedDecision.status === 'accepted' ? 'chấp nhận' : savedDecision.status === 'edited' ? 'đã sửa' : 'từ chối'} vào ${taskForMachine}.${savedDecision.status === 'edited' ? ` Khuyến nghị đã sửa: ${savedDecision.suggestion?.recommendation || ''}` : ''}`
        : 'Chưa lưu quyết định. Chọn Chấp nhận, Sửa hoặc Từ chối.'
      : matchingTasks.length ? 'Chọn công việc được giao ở trên để lưu quyết định.' : 'Bạn chưa được phân công việc trên máy này; chỉ xem phân tích.';
    cacNutGoiY.querySelectorAll('[data-decision]').forEach(button => { button.disabled = !taskForMachine; });
  }
  async function decide(decision, edited = null) {
    if (!taskForMachine) { thongBaoNoi('Mở lịch sử từ công việc được phân cho đúng máy để lưu AI-3.', 'error'); return; }
    const result = await saveAi3Decision(taskForMachine, decision, analysis.data.suggestion, edited);
    if (!result.ok) { thongBaoNoi(result.error.message, 'error'); return; }
    savedDecision = result.data.ai3;
    mauSuaGoiY.hidden = true;
    loiNhanGoiY.textContent = `Đã lưu lựa chọn ${decision === 'accepted' ? 'chấp nhận' : decision === 'edited' ? 'đã sửa' : 'từ chối'} vào ${taskForMachine}.`;
    thongBaoNoi('Đã lưu lựa chọn AI-3.', 'success');
  }
  cacNutGoiY.addEventListener('click', event => {
    const decision = event.target.closest('[data-decision]')?.dataset.decision;
    if (decision === 'edited') {
      mauSuaGoiY.hidden = false;
      document.getElementById('ai-edit-text').value = analysis.data.suggestion.recommendation;
    } else if (decision) decide(decision);
  });
  mauSuaGoiY.addEventListener('submit', event => {
    event.preventDefault();
    const recommendation = document.getElementById('ai-edit-text').value.trim();
    if (!recommendation) { thongBaoNoi('Nhập khuyến nghị đã chỉnh.', 'error'); return; }
    decide('edited', { ...analysis.data.suggestion, recommendation });
  });
  document.getElementById('regenerate').addEventListener('click', phanTichLai);
  khungGoiY.addEventListener('click', event => { if (event.target.closest('[data-ai-retry]')) phanTichLai(); });
  await phanTichLai();
}
