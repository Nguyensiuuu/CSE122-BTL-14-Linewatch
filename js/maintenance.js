import { readStore, updateStore } from './store.js';
import { getActiveSession } from './auth.js';

const success = data => ({ ok: true, data, error: null });
const failure = (code, message) => ({ ok: false, data: null, error: { code, message } });
const issue = (code, message) => Object.assign(new Error(message), { code });
const mocThoiGian = value => value ? new Date(value).getTime() : 0;

function timViecDuocGiao(data, id) {
  const task = data.maintenanceTasks.find(item => item.id === id);
  if (!task) throw issue('NOT_FOUND', 'Không tìm thấy công việc bảo trì.');
  const active = getActiveSession();
  if (!active || active.userId !== task.assigneeId)
    throw issue('FORBIDDEN', 'Công việc này không được phân cho tài khoản đang đăng nhập.');
  const incident = data.incidents.find(item => item.id === task.incidentId);
  if (!incident) throw issue('NOT_FOUND', 'Công việc chưa liên kết với sự cố hợp lệ.');
  return { task, incident };
}

function loiKetQua(error) {
  return failure(error.code || 'STORAGE_ERROR', error.message || 'Không thể lưu dữ liệu.');
}

export async function getTasks(assigneeId) {
  try {
    const active = getActiveSession();
    if (!active || active.userId !== assigneeId)
      return failure('FORBIDDEN', 'Đăng nhập bằng tài khoản kỹ thuật viên để xem hàng đợi.');
    const data = await readStore();
    const tasks = data.maintenanceTasks.filter(item => item.assigneeId === assigneeId)
      .map(task => {
        const incident = data.incidents.find(item => item.id === task.incidentId) || null;
        const machine = data.machines.find(item => item.id === incident?.machineId) || null;
        return { ...task, incident, machine };
      })
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return (rank[a.incident?.priority] ?? 3) - (rank[b.incident?.priority] ?? 3)
          || mocThoiGian(a.incident?.assignedAt) - mocThoiGian(b.incident?.assignedAt);
      });
    return success(tasks);
  } catch (error) { return loiKetQua(error); }
}

export async function getTaskDetail(taskId) {
  try {
    const data = await readStore();
    const { task, incident } = timViecDuocGiao(data, taskId);
    return success({ task, incident,
      machine: data.machines.find(item => item.id === incident.machineId) || null,
      line: data.lines.find(item => item.id === incident.lineId) || null,
      reporter: data.users.find(item => item.id === incident.reportedById) || null });
  } catch (error) { return loiKetQua(error); }
}

export async function startTask(taskId) {
  try {
    return success(await updateStore(data => {
      const { task, incident } = timViecDuocGiao(data, taskId);
      if (task.status !== 'pending' || incident.status !== 'assigned')
        throw issue('INVALID_TRANSITION', 'Chỉ bắt đầu công việc đã phân công và đang chờ xử lý.');
      const now = new Date().toISOString();
      task.status = 'in_progress'; task.startedAt = now;
      incident.status = 'in_progress'; incident.startedAt = now;
      return { task, incident };
    }));
  } catch (error) { return loiKetQua(error); }
}

export async function resolveTask(taskId, fields) {
  const cause = String(fields?.cause || '').trim();
  const action = String(fields?.action || '').trim();
  const result = String(fields?.result || '').trim();
  if (!cause || !action || !result)
    return failure('VALIDATION_ERROR', 'Nhập đủ nguyên nhân, biện pháp và kết quả trước khi hoàn tất.');
  try {
    return success(await updateStore(data => {
      const { task, incident } = timViecDuocGiao(data, taskId);
      if (task.status !== 'in_progress' || incident.status !== 'in_progress')
        throw issue('INVALID_TRANSITION', 'Cần bắt đầu xử lý trước khi đánh dấu đã xử lý.');
      const now = new Date().toISOString();
      Object.assign(task, { cause, action, result, status: 'done', completedAt: now });
      Object.assign(incident, { status: 'resolved', resolvedAt: now, downtimeEndAt: now });
      data.maintenanceLogs ||= [];
      if (!data.maintenanceLogs.some(log => log.taskId === task.id)) data.maintenanceLogs.push({
        id: `LOG-${task.id}`, machineId: incident.machineId, incidentId: incident.id,
        taskId: task.id, authorId: task.assigneeId, action, performedAt: now,
        archivedAt: null, revisions: []
      });
      return { task, incident };
    }));
  } catch (error) { return loiKetQua(error); }
}

export async function getMachineHistory(machineId) {
  try {
    const data = await readStore();
    const machine = data.machines.find(item => item.id === machineId);
    if (!machine) return failure('NOT_FOUND', 'Không tìm thấy máy này.');
    const incidents = data.incidents.filter(item => item.machineId === machineId)
      .sort((a, b) => mocThoiGian(b.reportedAt) - mocThoiGian(a.reportedAt));
    const tasks = data.maintenanceTasks.filter(item => incidents.some(incident => incident.id === item.incidentId));
    return success({ machine, line: data.lines.find(item => item.id === machine.lineId) || null,
      incidents, tasks });
  } catch (error) { return loiKetQua(error); }
}

export async function saveAi3Decision(taskId, decision, suggestion, editedSuggestion = null) {
  if (!['accepted', 'edited', 'rejected'].includes(decision))
    return failure('VALIDATION_ERROR', 'Quyết định AI-3 không hợp lệ.');
  try {
    return success(await updateStore(data => {
      const { task } = timViecDuocGiao(data, taskId);
      task.ai3 = {
        status: decision,
        suggestion: decision === 'edited' ? editedSuggestion : suggestion,
        originalSuggestion: suggestion,
        decidedAt: new Date().toISOString(),
        source: 'mock-rule'
      };
      return task;
    }));
  } catch (error) { return loiKetQua(error); }
}

function kiemTraKyThuatVien(data) {
  const session = getActiveSession();
  const user = data.users.find(item => item.id === session?.userId && item.active && item.role === 'maintenance');
  if (!user) throw issue('FORBIDDEN', 'Đăng nhập tài khoản kỹ thuật viên để ghi nhật ký.');
  return user;
}

export async function getMaintenanceLogs(machineId) {
  try {
    const data = await readStore(); kiemTraKyThuatVien(data);
    if (!data.machines.some(machine => machine.id === machineId)) throw issue('NOT_FOUND', 'Không tìm thấy máy.');
    return success((data.maintenanceLogs || []).filter(log => log.machineId === machineId)
      .sort((a, b) => mocThoiGian(b.performedAt) - mocThoiGian(a.performedAt)));
  } catch (error) { return loiKetQua(error); }
}

export async function createMaintenanceLog({ machineId, action, performedAt }) {
  action = String(action || '').trim();
  if (!action || !performedAt || !Number.isFinite(Date.parse(performedAt)))
    return failure('VALIDATION_ERROR', 'Nhập công việc và thời gian hợp lệ.');
  try {
    return success(await updateStore(data => {
      const user = kiemTraKyThuatVien(data);
      if (!data.machines.some(machine => machine.id === machineId)) throw issue('NOT_FOUND', 'Không tìm thấy máy.');
      data.maintenanceLogs ||= [];
      const id = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (data.maintenanceLogs.some(log => log.id === id)) throw issue('DUPLICATE_ID', 'Mã nhật ký đã tồn tại.');
      const log = { id, machineId, incidentId: null, taskId: null, authorId: user.id,
        action, performedAt: new Date(performedAt).toISOString(), archivedAt: null, revisions: [] };
      data.maintenanceLogs.push(log);
      return log;
    }));
  } catch (error) { return loiKetQua(error); }
}

export async function updateMaintenanceLog(logId, { action, performedAt }) {
  action = String(action || '').trim();
  if (!action || !performedAt || !Number.isFinite(Date.parse(performedAt)))
    return failure('VALIDATION_ERROR', 'Nhập công việc và thời gian hợp lệ.');
  try {
    return success(await updateStore(data => {
      const user = kiemTraKyThuatVien(data);
      const log = (data.maintenanceLogs || []).find(item => item.id === logId);
      if (!log) throw issue('NOT_FOUND', 'Không tìm thấy ghi nhận.');
      if (log.authorId !== user.id) throw issue('FORBIDDEN', 'Chỉ người ghi nhận được chỉnh sửa.');
      if (log.archivedAt) throw issue('INVALID_TRANSITION', 'Ghi nhận đã lưu trữ.');
      log.revisions ||= [];
      log.revisions.push({ action: log.action, performedAt: log.performedAt, changedAt: new Date().toISOString() });
      log.action = action; log.performedAt = new Date(performedAt).toISOString();
      return log;
    }));
  } catch (error) { return loiKetQua(error); }
}

export async function archiveMaintenanceLog(logId) {
  try {
    return success(await updateStore(data => {
      const user = kiemTraKyThuatVien(data);
      const log = (data.maintenanceLogs || []).find(item => item.id === logId);
      if (!log) throw issue('NOT_FOUND', 'Không tìm thấy ghi nhận.');
      if (log.authorId !== user.id) throw issue('FORBIDDEN', 'Chỉ người ghi nhận được lưu trữ.');
      if (log.archivedAt) throw issue('INVALID_TRANSITION', 'Ghi nhận đã lưu trữ.');
      log.archivedAt = new Date().toISOString();
      return log;
    }));
  } catch (error) { return loiKetQua(error); }
}
