import { readStore as sharedReadStore, replaceStore } from '../../store.js';
import { getActiveSession } from '../../auth.js';
/**
 * js/modules/shared/api.js
 * Tầng nghiệp vụ của Thắng (khung 02, 03, 04, 12, 14, 22, 23) theo quy ước
 * dữ liệu chung LineWatch.
 *
 * - Một kho dữ liệu duy nhất: localStorage["linewatch.v1"], nạp seed từ
 *   assets/data/seed.json khi chưa có dữ liệu (đúng hợp đồng nhóm).
 * - Mọi hàm nghiệp vụ bất đồng bộ đều trả về { ok, data, error } với error là
 *   { code, message, field }. Mã lỗi theo quy ước chung:
 *   VALIDATION_ERROR, NOT_FOUND, FORBIDDEN, DUPLICATE_ID, INVALID_TRANSITION,
 *   STORAGE_ERROR, NO_EVIDENCE.
 * - Công nhân chỉ sửa/hủy sự cố do chính mình tạo khi status = "new";
 *   KHÔNG xuất closeIncident/startIncident cho công nhân.
 *
 * Ghi chú tích hợp: khi nhóm ghép js/api.js + js/store.js của Nguyên, chỉ cần
 * re-export các hàm cùng chữ ký bên dưới; trang/module không cần sửa lại.
 */

export const STORE_KEY = "linewatch.v1";
const SEED_URL = "../assets/data/seed.json";

/* -------------------------- Enum theo quy ước chung -------------------------- */

export const LINE_STATUSES = ["active", "paused"];
export const MACHINE_STATUSES = ["normal", "warning", "fault", "maintenance"];
export const INCIDENT_STATUSES = [
  "new",
  "accepted",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "cancelled"
];
export const INCIDENT_CATEGORIES = ["mechanical", "electrical", "quality", "other"];
export const PRIORITIES = ["low", "medium", "high"];
export const IMPACTS = ["full", "partial", "unknown"];
export const TASK_STATUSES = ["pending", "in_progress", "done"];
export const AI1_STATUSES = ["accepted", "edited", "rejected"];

/* -------------------------- Lỗi nghiệp vụ & envelope -------------------------- */

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", field = null, cause = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.field = field;
    this.cause = cause;
  }
}

export function toApiError(error, fallback = "Không xử lý được yêu cầu. Vui lòng thử lại.") {
  if (error instanceof ApiError) return error;
  return new ApiError(fallback, "UNEXPECTED", null, error);
}

export function ok(data) {
  return { ok: true, data, error: null };
}

export function fail(code, message, field = null) {
  return { ok: false, data: null, error: { code, message, field } };
}

export const nowISO = () => new Date().toISOString();

const text = (value) => String(value ?? "").trim();

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoFrom(localValue) {
  const date = toDate(localValue);
  return date ? date.toISOString() : null;
}

/* -------------------------- Lớp lưu trữ (một kho linewatch.v1) -------------------------- */

function readJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[api] Không đọc được ${key}:`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  notifyChange(key);
}

function removeKey(key) {
  window.localStorage.removeItem(key);
  notifyChange(key);
}

/** Phát sự kiện để store.js và các khung khác cập nhật giao diện. */
function notifyChange(key) {
  window.dispatchEvent(new CustomEvent("linewatch:data-changed", { detail: { key } }));
}

let seedPromise = null;

/** Tải seed.json một lần cho cả phiên, có thể thử lại sau khi lỗi. */
export function loadSeed() {
  if (!seedPromise) {
    seedPromise = (async () => {
      let response;
      try {
        response = await fetch(SEED_URL);
      } catch (error) {
        throw new ApiError(
          "Không kết nối được tệp dữ liệu mẫu. Hãy mở trang bằng Live Server (http://localhost).",
          "SEED_UNREACHABLE",
          null,
          error
        );
      }
      if (!response.ok) {
        throw new ApiError(`Không tải được dữ liệu mẫu (HTTP ${response.status}).`, "SEED_HTTP");
      }
      try {
        return await response.json();
      } catch (error) {
        throw new ApiError("Tệp dữ liệu mẫu không đúng định dạng JSON.", "SEED_JSON", null, error);
      }
    })();
  }
  return seedPromise;
}

async function readStore() { return sharedReadStore(); }
async function writeStore(store) { await replaceStore(store); }

function uniqueId(prefix, list = []) {
  const max = list.reduce((acc, item) => {
    const match = String(item?.id || "").match(/(\d+)\s*$/);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `${prefix}-${max + 1}`;
}

function uniqueLineId(lines = []) {
  const max = lines.reduce((acc, item) => {
    const num = Number(String(item?.id || "").replace(/\D/g, "")) || 0;
    return Math.max(acc, num);
  }, 0);
  return `L${String(max + 1).padStart(2, "0")}`;
}

/* -------------------------- Phiên demo (auth do Nguyên sở hữu) -------------------------- */

export function getCurrentUser() {
  const active = getActiveSession();
  return active ? { id: active.userId, role: active.role } : null;
}

export function getCurrentShift(store) {
  const session = getSession();
  if (session?.shift) return session.shift;
  const shifts = store?.shifts || [];
  const now = Date.now();
  const active = shifts.find(
    (s) => toDate(s.startsAt)?.getTime() <= now && toDate(s.endsAt)?.getTime() >= now
  );
  return active || [...shifts].sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)))[0] || null;
}

// Ca demo cũ vẫn đọc được; sự cố mới phải thuộc ca của thời điểm phát hiện.
function caCuaSuCo(store, reportedAt) {
  const time = new Date(reportedAt).getTime();
  const existed = store.shifts.find(s => new Date(s.startsAt).getTime() <= time && time < new Date(s.endsAt).getTime());
  if (existed) return existed;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(time)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const soCa = parts.hour >= 22 || parts.hour < 6 ? 3 : parts.hour >= 14 ? 2 : 1;
  const gioBatDau = [0, 6, 14, 22][soCa];
  const batDau = Date.UTC(parts.year, parts.month - 1, parts.day, gioBatDau - 7) - (parts.hour < 6 ? 86400000 : 0);
  const ngayCa = new Date(batDau + 7 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
  const shift = { id: `CA${soCa}-${ngayCa}`, name: `Ca ${soCa}`,
    startsAt: new Date(batDau).toISOString(), endsAt: new Date(batDau + 8 * 3600000).toISOString(),
    supervisorId: store.users.find(u => u.role === 'supervisor' && u.active)?.id || null };
  store.shifts.push(shift);
  return shift;
}

/* -------------------------- Dây chuyền -------------------------- */

export async function getLines() {
  const store = await readStore();
  return ok(store.lines || []);
}

export async function createLine(input = {}) {
  if (getCurrentUser()?.role !== 'admin') return fail('FORBIDDEN', 'Chỉ quản trị viên được thêm dây chuyền.');
  const store = await readStore();
  const name = text(input.name);
  if (!name) return fail("VALIDATION_ERROR", "Nhập tên dây chuyền.", "name");
  if ((store.lines || []).some((l) => text(l.name).toLowerCase() === name.toLowerCase())) {
    return fail("DUPLICATE_ID", "Đã có dây chuyền cùng tên.", "name");
  }
  const status = LINE_STATUSES.includes(input.status) ? input.status : "active";
  const line = { id: uniqueLineId(store.lines), name, status };
  store.lines = [...(store.lines || []), line];
  await writeStore(store);
  return ok(line);
}

export async function updateLineStatus(lineId, status) {
  if (getCurrentUser()?.role !== 'admin') return fail('FORBIDDEN', 'Chỉ quản trị viên được đổi trạng thái.');
  if (!LINE_STATUSES.includes(status)) {
    return fail("VALIDATION_ERROR", "Trạng thái dây chuyền không hợp lệ.", "status");
  }
  const store = await readStore();
  const idx = (store.lines || []).findIndex((l) => l.id === lineId);
  if (idx === -1) return fail("NOT_FOUND", `Không tìm thấy dây chuyền ${lineId}.`);
  const updated = { ...store.lines[idx], status };
  store.lines[idx] = updated;
  await writeStore(store);
  return ok(updated);
}

/* -------------------------- Máy -------------------------- */

export async function getMachines(lineId = null) {
  const store = await readStore();
  const machines = store.machines || [];
  return ok(lineId ? machines.filter((m) => m.lineId === lineId) : machines);
}

/* -------------------------- Sự cố -------------------------- */

export async function getIncidents(filters = {}) {
  const store = await readStore();
  let incidents = store.incidents || [];
  if (filters.shiftId) incidents = incidents.filter((i) => i.shiftId === filters.shiftId);
  if (filters.status) incidents = incidents.filter((i) => i.status === filters.status);
  if (filters.lineId) incidents = incidents.filter((i) => i.lineId === filters.lineId);
  if (filters.machineId) incidents = incidents.filter((i) => i.machineId === filters.machineId);
  return ok(incidents);
}

export function validateIncidentInput(input = {}, deps = {}) {
  const lines = deps.lines || [];
  const machines = deps.machines || [];
  const errors = {};

  const lineId = text(input.lineId);
  const machineId = text(input.machineId);
  const description = text(input.description);
  const category = input.category;
  const priority = input.priority;
  const detectedAt = input.createdAt || input.reportedAt || null;

  const line = lines.find((l) => l.id === lineId);
  if (!lineId) errors.lineId = "Chọn dây chuyền.";
  else if (!line) errors.lineId = "Dây chuyền không tồn tại.";

  const machine = machines.find((m) => m.id === machineId);
  if (!machineId) errors.machineId = "Chọn máy.";
  else if (!machine) errors.machineId = "Máy không tồn tại.";
  else if (line && machine.lineId !== lineId) {
    errors.machineId = "Máy không thuộc dây chuyền đã chọn.";
  }

  if (!detectedAt) errors.createdAt = "Chọn thời điểm phát hiện.";
  else {
    const date = toDate(detectedAt);
    if (!date) errors.createdAt = "Thời điểm phát hiện không hợp lệ.";
    else if (date.getTime() > Date.now() + 60_000) {
      errors.createdAt = "Thời điểm phát hiện không được ở tương lai.";
    }
  }

  if (!description) errors.description = "Mô tả sự cố là bắt buộc.";
  else if (description.length < 8) errors.description = "Mô tả cần ít nhất 8 ký tự.";

  if (!category) errors.category = "Chọn loại sự cố.";
  else if (!INCIDENT_CATEGORIES.includes(category)) errors.category = "Loại sự cố không hợp lệ.";

  if (!priority) errors.priority = "Chọn mức ưu tiên.";
  else if (!PRIORITIES.includes(priority)) errors.priority = "Mức ưu tiên không hợp lệ.";

  if (input.impactNote !== undefined && text(input.impactNote).length < 3)
    errors.impactNote = "Mô tả mức ảnh hưởng ít nhất 3 ký tự.";

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Chỉ giữ metadata của ảnh (không lưu base64/dataURL để tránh phình localStorage). */
function normalizeAttachments(list = []) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 3)
    .map((file) => ({
      name: text(file?.name),
      type: text(file?.type),
      size: Number(file?.size) || 0,
      addedAt: file?.addedAt || nowISO()
    }))
    .filter((file) => file.name);
}

export async function createIncident(payload = {}) {
  try {
    if (getCurrentUser()?.role !== 'operator') return fail('FORBIDDEN', 'Đăng nhập vai trò công nhân để báo sự cố.');
    const store = await readStore();
    const lines = store.lines || [];
    const machines = store.machines || [];
    const validation = validateIncidentInput(payload, { lines, machines });
    if (!validation.ok) {
      const field = Object.keys(validation.errors)[0];
      return fail("VALIDATION_ERROR", validation.errors[field], field);
    }

    const user = getCurrentUser();
    const reportedAt = payload.reportedAt || isoFrom(payload.createdAt) || nowISO();
    const shift = caCuaSuCo(store, reportedAt);
    const description = text(payload.description);
    const title = text(payload.title) || description.slice(0, 80) || "Sự cố dây chuyền";

    const incident = {
      id: uniqueId("INC", store.incidents),
      lineId: text(payload.lineId),
      machineId: text(payload.machineId),
      shiftId: shift.id,
      title,
      description,
      category: payload.category,
      priority: payload.priority,
      impact: IMPACTS.includes(payload.impact) ? payload.impact : 'unknown',
      impactNote: text(payload.impactNote).slice(0, 120),
      status: "new",
      reportedById: user.id || payload.reportedById || null,
      assignedToId: null,
      reportedAt,
      acceptedAt: null,
      assignedAt: null,
      startedAt: null,
      resolvedAt: null,
      closedAt: null,
      cancelledAt: null,
      downtimeStartAt: reportedAt,
      downtimeEndAt: null,
      notes: text(payload.notes),
      attachments: normalizeAttachments(payload.attachments),
      ai1: payload.ai1 && AI1_STATUSES.includes(payload.ai1.status) ? { ...payload.ai1 } : null
    };

    store.incidents = [incident, ...(store.incidents || [])];
    await writeStore(store);
    return ok(incident);
  } catch (error) {
    return fail("STORAGE_ERROR", "Không lưu được sự cố. Vui lòng thử lại.");
  }
}

/** Công nhân chỉ sửa sự cố của chính mình khi còn status = "new". */
export async function updateOwnIncident(id, patch = {}) {
  try {
    const store = await readStore();
    const idx = (store.incidents || []).findIndex((i) => i.id === id);
    if (idx === -1) return fail("NOT_FOUND", `Không tìm thấy sự cố ${id}.`);

    const incident = store.incidents[idx];
    const user = getCurrentUser();
    if (!user || user.role !== 'operator' || incident.reportedById !== user.id) {
      return fail("FORBIDDEN", "Bạn chỉ được sửa sự cố do chính mình tạo.");
    }
    if (incident.status !== "new") {
      return fail("INVALID_TRANSITION", "Chỉ được sửa sự cố ở trạng thái mới ghi nhận.");
    }

    const next = { ...incident };
    const editable = ["title", "description", "category", "priority", "impactNote", "notes", "attachments"];
    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
    }
    if (patch.description !== undefined && patch.title === undefined)
      next.title = text(patch.description).slice(0, 80);
    if (patch.reportedAt) next.reportedAt = patch.reportedAt;

    if (next.category && !INCIDENT_CATEGORIES.includes(next.category)) {
      return fail("VALIDATION_ERROR", "Loại sự cố không hợp lệ.", "category");
    }
    if (next.priority && !PRIORITIES.includes(next.priority)) {
      return fail("VALIDATION_ERROR", "Mức ưu tiên không hợp lệ.", "priority");
    }
    if (next.description != null && text(next.description).length < 8) {
      return fail("VALIDATION_ERROR", "Mô tả cần ít nhất 8 ký tự.", "description");
    }
    if (patch.impactNote !== undefined && (text(next.impactNote).length < 3 || text(next.impactNote).length > 120)) {
      return fail("VALIDATION_ERROR", "Mức ảnh hưởng cần từ 3 đến 120 ký tự.", "impactNote");
    }
    if (patch.impactNote !== undefined) {
      const note = text(next.impactNote);
      next.impact = /toàn bộ|toan bo|hoàn toàn/i.test(note) ? 'full'
        : /chưa rõ|chua ro/i.test(note) ? 'unknown' : 'partial';
    }

    next.attachments = normalizeAttachments(next.attachments);
    if (patch.description !== undefined && text(patch.description) !== text(incident.description))
      next.ai1 = null;
    else if (next.ai1 && (patch.category !== undefined || patch.priority !== undefined)) {
      next.ai1 = { ...next.ai1, status: 'edited',
        originalSuggestion: next.ai1.originalSuggestion || next.ai1.suggestion,
        suggestion: { ...next.ai1.suggestion, category: next.category, priority: next.priority } };
    }
    // Không cho đổi id/khóa ngoại/trạng thái qua kênh sửa của công nhân.
    next.id = incident.id;
    next.lineId = incident.lineId;
    next.machineId = incident.machineId;
    next.shiftId = incident.shiftId;
    next.reportedById = incident.reportedById;
    next.status = incident.status;

    store.incidents[idx] = next;
    await writeStore(store);
    return ok(next);
  } catch (error) {
    return fail("STORAGE_ERROR", "Không lưu được thay đổi. Vui lòng thử lại.");
  }
}

/** Công nhân hủy sự cố của chính mình khi còn status = "new"; vẫn giữ lịch sử. */
export async function cancelIncident(id) {
  try {
    const store = await readStore();
    const idx = (store.incidents || []).findIndex((i) => i.id === id);
    if (idx === -1) return fail("NOT_FOUND", `Không tìm thấy sự cố ${id}.`);

    const incident = store.incidents[idx];
    const user = getCurrentUser();
    if (!user || user.role !== 'operator' || incident.reportedById !== user.id) {
      return fail("FORBIDDEN", "Bạn chỉ được hủy sự cố do chính mình tạo.");
    }
    if (incident.status !== "new") {
      return fail("INVALID_TRANSITION", "Chỉ được hủy sự cố ở trạng thái mới ghi nhận.");
    }

    const next = { ...incident, status: "cancelled", cancelledAt: nowISO() };
    store.incidents[idx] = next;
    await writeStore(store);
    return ok(next);
  } catch (error) {
    return fail("STORAGE_ERROR", "Không hủy được sự cố. Vui lòng thử lại.");
  }
}

/* -------------------------- Bản nháp báo sự cố (trạng thái UI) -------------------------- */

const KEYS = {
  draft: "linewatch:draft",
  registrations: "linewatch:registrations",
  lastRegistration: "linewatch:last-registration",
  session: "linewatch:session",
  flash: "linewatch:flash"
};

export function readDraft() {
  return readJSON(KEYS.draft, null);
}

export function saveDraft(draft) {
  writeJSON(KEYS.draft, { ...draft, savedAt: nowISO() });
}

export function clearDraft() {
  removeKey(KEYS.draft);
}

/* -------------------------- Đăng ký (chỉ tạo yêu cầu pending) -------------------------- */

export const REGISTRATION_STATUS = { pending: "pending", approved: "approved", rejected: "rejected" };

export function listRegistrations() {
  const value = readJSON(KEYS.registrations, []);
  return Array.isArray(value) ? value : [];
}

export function validateRegistration(input = {}) {
  const existing = listRegistrations();
  const errors = {};

  const name = text(input.name);
  const email = text(input.email).toLowerCase();
  const employeeId = text(input.employeeId).toUpperCase();
  const password = input.password || "";
  const confirmPassword = input.confirmPassword ?? "";

  if (name.length < 2) errors.name = "Họ tên cần ít nhất 2 ký tự.";
  else if (name.length > 80) errors.name = "Họ tên tối đa 80 ký tự.";

  if (!email) errors.email = "Nhập email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "Email chưa đúng định dạng (ví dụ name@company.com).";
  }

  if (!employeeId) errors.employeeId = "Nhập mã nhân viên.";
  else if (!/^[A-Z0-9-]{3,20}$/.test(employeeId)) {
    errors.employeeId = "Mã nhân viên 3–20 ký tự chữ, số hoặc gạch ngang.";
  }

  if (password.length < 8) errors.password = "Mật khẩu cần ít nhất 8 ký tự.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = "Mật khẩu cần có cả chữ và số.";
  }

  if (!confirmPassword) errors.confirmPassword = "Nhập lại mật khẩu.";
  else if (confirmPassword !== password) {
    errors.confirmPassword = "Mật khẩu nhập lại không khớp.";
  }

  if (input?.terms !== true) errors.terms = "Bạn cần xác nhận thông tin đăng ký là chính xác.";

  const duplicated = existing.find(
    (item) => text(item.email).toLowerCase() === email || text(item.employeeId).toUpperCase() === employeeId
  );
  if (duplicated) {
    const message = "Email hoặc mã nhân viên đã được đăng ký.";
    if (text(duplicated.email).toLowerCase() === email) errors.email = message;
    else errors.employeeId = message;
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Gửi yêu cầu đăng ký, luôn ở trạng thái "pending" cho tới khi quản trị viên duyệt. */
export function submitRegistration(input) {
  const { ok: valid, errors } = validateRegistration(input);
  if (!valid) {
    const firstField = Object.keys(errors)[0];
    throw new ApiError(errors[firstField], "VALIDATION", firstField);
  }

  const registration = {
    id: `REG-${Date.now()}`,
    name: text(input.name),
    email: text(input.email).toLowerCase(),
    employeeId: text(input.employeeId).toUpperCase(),
    requestedAt: nowISO(),
    status: "pending"
  };

  writeJSON(KEYS.registrations, [...listRegistrations(), registration]);
  writeJSON(KEYS.lastRegistration, registration);
  return registration;
}

export function getLastRegistration() {
  const stored = readJSON(KEYS.lastRegistration, null);
  return stored && typeof stored === "object" ? stored : null;
}

export function setRegistrationStatus(registrationId, status) {
  if (!Object.prototype.hasOwnProperty.call(REGISTRATION_STATUS, status)) {
    throw new ApiError("Trạng thái đăng ký không hợp lệ.", "VALIDATION", "status");
  }
  const list = listRegistrations();
  const updated = list.map((item) =>
    item.id === registrationId ? { ...item, status, reviewedAt: nowISO() } : item
  );
  writeJSON(KEYS.registrations, updated);
  return updated.find((item) => item.id === registrationId) || null;
}

/* -------------------------- Phiên đăng nhập & thông báo chuyển trang -------------------------- */

export function getSession() {
  const active = getActiveSession();
  return active ? { ...active, user: getCurrentUser() } : null;
}

export function setSession(session) {
  if (!session) {
    removeKey(KEYS.session);
    return null;
  }
  const payload = { ...session, signedInAt: session.signedInAt || nowISO() };
  writeJSON(KEYS.session, payload);
  return payload;
}

export function clearSession() {
  removeKey(KEYS.session);
}

export function setFlash(message, type = "success") {
  if (!message) {
    removeKey(KEYS.flash);
    return;
  }
  writeJSON(KEYS.flash, { message, type, at: nowISO() });
}

export function takeFlash() {
  const flash = readJSON(KEYS.flash, null);
  if (flash) removeKey(KEYS.flash);
  return flash;
}




