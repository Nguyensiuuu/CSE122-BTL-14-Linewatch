import { getTasks as maintenanceGetTasks, startTask, resolveTask, getTaskDetail, getMachineHistory, saveAi3Decision,
  getMaintenanceLogs, createMaintenanceLog, updateMaintenanceLog, archiveMaintenanceLog } from './maintenance.js';
import { loginDemo, loginWithCredentials, getCurrentUser, requestPasswordReset, logout } from './auth.js';
import { analyzeMachine } from './ai3.js';
import { readStore, wrap } from './store.js';
import * as thang from './modules/shared/api.js';
import { acceptIncident as sonAccept, assignIncident as sonAssign, closeIncident as sonClose,
  getNotifications, markNotificationsRead } from './incident-flow.js';
import { saveShiftNote as sonSaveNote, getShiftNotes } from './shift-notes.js';
import { saveReport as sonSaveReport, getReports } from './reports.js';
import { summarizeShift } from './ai2.js';

// Các hàm nghiệp vụ giữ nguyên từ phần Thắng/Sơn, trang chỉ gọi cổng này.
const peers = {
  getLines: thang.getLines, getMachines: thang.getMachines,
  getIncidents: thang.getIncidents, createIncident: thang.createIncident,
  updateOwnIncident: thang.updateOwnIncident, cancelIncident: thang.cancelIncident,
  acceptIncident: sonAccept, assignIncident: sonAssign, closeIncident: sonClose,
  saveShiftNote: sonSaveNote, saveReport: sonSaveReport,
  requestRegistration: thang.submitRegistration
};
export function registerModules(modules) { Object.assign(peers, modules); }
const waiting = name => ({ ok: false, data: null, error: {
  code: 'NOT_FOUND', message: `Thiếu chức năng ${name} trong bản ghép.` } });
const delegate = async (name, ...args) => {
  return typeof peers[name] === 'function' ? peers[name](...args) : waiting(name);
};

export const getLines = () => delegate('getLines');
export const getMachines = () => delegate('getMachines');
export const getIncidents = filters => delegate('getIncidents', filters);
export const createIncident = payload => delegate('createIncident', payload);
export const updateOwnIncident = (id, patch) => delegate('updateOwnIncident', id, patch);
export const cancelIncident = id => delegate('cancelIncident', id);
export const acceptIncident = id => delegate('acceptIncident', id);
export const assignIncident = (id, assigneeId) => delegate('assignIncident', id, assigneeId);
export const closeIncident = id => delegate('closeIncident', id);
export const saveShiftNote = payload => delegate('saveShiftNote', payload);
export const saveReport = payload => delegate('saveReport', payload);
export const requestRegistration = payload => delegate('requestRegistration', payload);

export const getTasks = assigneeId => assigneeId ? maintenanceGetTasks(assigneeId) : getAllTasks();
export { startTask, resolveTask, getTaskDetail, getMachineHistory, saveAi3Decision,
  getMaintenanceLogs, createMaintenanceLog, updateMaintenanceLog, archiveMaintenanceLog,
  loginDemo, loginWithCredentials, getCurrentUser, requestPasswordReset, logout, analyzeMachine };
export { getNotifications, markNotificationsRead, getShiftNotes, getReports, summarizeShift };
export const getUsers = () => wrap(data => data.users);
export const getShifts = () => wrap(data => data.shifts);
// Sơn cần xem mọi nhiệm vụ trên bảng điều phối; hàng chờ kỹ thuật vẫn gọi getTasks(id).
export const getAllTasks = () => wrap(data => data.maintenanceTasks);
