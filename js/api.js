import { getTasks, startTask, resolveTask, getTaskDetail, getMachineHistory, saveAi3Decision,
  getMaintenanceLogs, createMaintenanceLog, updateMaintenanceLog, archiveMaintenanceLog } from './maintenance.js';
import { loginDemo, loginWithCredentials, getCurrentUser, requestPasswordReset, logout } from './auth.js';
import { analyzeMachine } from './ai3.js';

// Thắng/Sơn supply their own modules. Configure once in the integration entry;
// this facade keeps page imports stable without copying their business logic.
const peers = {};
export function registerModules(modules) { Object.assign(peers, modules); }
const peerFiles = ['lines.js', 'incident-create.js', 'incident-flow.js', 'shift-notes.js', 'reports.js'];
let peerLoading;
async function loadPeers() {
  if (!peerLoading) peerLoading = Promise.all(peerFiles.map(async file => {
    try { registerModules(await import(`./${file}`)); }
    catch (error) {
      // Peers can hand over their modules later; an absent file is an integration gap.
      if (!String(error.message).includes('Failed to fetch') && !String(error.message).includes('404'))
        console.warn(`Không tải được ${file}:`, error);
    }
  }));
  await peerLoading;
}
const waiting = name => ({ ok: false, data: null, error: {
  code: 'NOT_FOUND', message: `Chưa ghép mô-đun ${name} từ phần việc của Thắng/Sơn.` } });
const delegate = async (name, ...args) => {
  if (typeof peers[name] !== 'function') await loadPeers();
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

export { getTasks, startTask, resolveTask, getTaskDetail, getMachineHistory, saveAi3Decision,
  getMaintenanceLogs, createMaintenanceLog, updateMaintenanceLog, archiveMaintenanceLog,
  loginDemo, loginWithCredentials, getCurrentUser, requestPasswordReset, logout, analyzeMachine };
