/**
 * js/modules/shared/api.js
 * Lớp truy cập dữ liệu dùng chung (hợp đồng v1) cho toàn bộ khung LineWatch.
 *
 * Đây là ĐIỂM DUY NHẤT trong mã nguồn chạm vào tầng dữ liệu: đọc seed.json,
 * đọc/ghi localStorage, kiểm tra hợp lệ và ném lỗi thống nhất. Mọi khung
 * (trạng thái dây chuyền, báo sự cố, sự cố trong ca, quản lý dây chuyền,
 * đăng ký) đều import từ đây, không tự gọi fetch/localStorage.
 *
 * Ghi chú tích hợp: kho mã dùng chung của nhóm
 * (LineWatch_NguonChung_ChoNhomCode/js/api.js, store.js) KHÔNG có trong
 * workspace này. Khi nhóm bổ sung tệp đó, chỉ cần thay phần thân của các hàm
 * dưới đây bằng re-export, ví dụ:
 *   export * from "../../../LineWatch_NguonChung_ChoNhomCode/js/api.js";
 * Không khung nào phải sửa vì tất cả đều đi qua tệp này.
 *
 * Khóa localStorage giữ nguyên như bản mẫu js/app.js để dữ liệu cũ vẫn dùng được.
 */

export const KEYS = {
  incidents: "linewatch:incidents",
  lines: "linewatch:lines",
  draft: "linewatch:draft",
  registrations: "linewatch:registrations",
  lastRegistration: "linewatch:last-registration",
  session: "linewatch:session",
  flash: "linewatch:flash"
};

const SEED_URL = "../assets/data/seed.json";

export const LINE_STATUSES = ["running", "warning", "stopped"];
export const INCIDENT_STATUSES = ["new", "in_progress", "closed"];
export const IMPACTS = ["full", "partial", "unknown"];

/** Lỗi nghiệp vụ có mã và thông điệp tiếng Việt hiển thị được cho người dùng. */
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

export const nowISO = () => new Date().toISOString();

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

/** Phát sự kiện để store.js và các khung khác cập nhật lại giao diện. */
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
        throw new ApiError("Tệp dữ liệu mẫu không đúng định dạng JSON.", "SEED_PARSE", null, error);
      }
    })();
    seedPromise.catch(() => {
      seedPromise = null;
    });
  }
  return seedPromise;
}

export function resetSeedCache() {
  seedPromise = null;
}

const text = (value) => String(value ?? "").trim();

/* -------------------------- Dây chuyền & máy -------------------------- */

export async function listLines() {
  const seed = await loadSeed();
  const stored = readJSON(KEYS.lines, null);
  return Array.isArray(stored) && stored.length ? stored : seed.lines;
}

export async function listMachines(lineId = null) {
  const seed = await loadSeed();
  const machines = Array.isArray(seed.machines) ? seed.machines : [];
  return lineId ? machines.filter((machine) => machine.lineId === lineId) : machines;
}

export async function getLine(lineId) {
  return (await listLines()).find((line) => line.id === lineId) || null;
}

export async function createLine(input) {
  const id = text(input?.id).toUpperCase();
  const name = text(input?.name);
  if (!/^[A-Z0-9-]{2,10}$/.test(id)) {
    throw new ApiError("Mã dây chuyền gồm 2–10 ký tự chữ, số hoặc gạch ngang (ví dụ L04).", "VALIDATION", "lineId");
  }
  if (name.length < 2) {
    throw new ApiError("Tên dây chuyền cần ít nhất 2 ký tự.", "VALIDATION", "lineName");
  }
  const lines = (await listLines()).slice();
  if (lines.some((line) => line.id === id)) {
    throw new ApiError(`Mã ${id} đã tồn tại trong danh sách dây chuyền.`, "DUPLICATE", "lineId");
  }
  const line = {
    id,
    name,
    status: LINE_STATUSES.includes(input?.status) ? input.status : "running",
    machines: 0,
    createdAt: nowISO()
  };
  lines.push(line);
  writeJSON(KEYS.lines, lines);
  return line;
}

export async function updateLineStatus(lineId, status) {
  if (!LINE_STATUSES.includes(status)) {
    throw new ApiError("Trạng thái dây chuyền không hợp lệ.", "VALIDATION", "lineStatus");
  }
  const lines = await listLines();
  if (!lines.some((line) => line.id === lineId)) {
    throw new ApiError(`Không tìm thấy dây chuyền ${lineId}.`, "NOT_FOUND");
  }
  const updated = lines.map((line) => (line.id === lineId ? { ...line, status, updatedAt: nowISO() } : line));
  writeJSON(KEYS.lines, updated);
  return updated.find((line) => line.id === lineId);
}

/* -------------------------- Sự cố -------------------------- */

export async function listIncidents() {
  const seed = await loadSeed();
  const stored = readJSON(KEYS.incidents, null);
  return Array.isArray(stored) ? stored : seed.incidents;
}

/** Kiểm tra dữ liệu biểu mẫu báo sự cố; trả về lỗi theo từng trường. */
export function validateIncidentInput(input, { lines = [], machines = [] } = {}) {
  const errors = {};
  const lineId = text(input?.lineId);
  const machineId = text(input?.machineId);
  const description = text(input?.description);
  const createdAt = text(input?.createdAt);

  if (!lines.some((line) => line.id === lineId)) errors.lineId = "Chọn dây chuyền đang gặp sự cố.";

  const machine = machines.find((item) => item.id === machineId);
  if (!machine) errors.machineId = "Chọn máy gặp sự cố.";
  else if (lineId && machine.lineId !== lineId) errors.machineId = "Máy không thuộc dây chuyền đã chọn.";

  if (description.length < 8) errors.description = "Mô tả cần ít nhất 8 ký tự để AI-1 phân loại.";
  else if (description.length > 500) errors.description = "Mô tả tối đa 500 ký tự.";

  if (!IMPACTS.includes(input?.impact)) errors.impact = "Chọn mức ảnh hưởng của sự cố.";

  const time = createdAt ? new Date(createdAt) : null;
  if (!createdAt) errors.createdAt = "Chọn thời điểm phát hiện sự cố.";
  else if (Number.isNaN(time.getTime())) errors.createdAt = "Thời điểm không hợp lệ.";
  else if (time.getTime() > Date.now() + 60_000) errors.createdAt = "Thời điểm không được ở tương lai.";

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Tạo báo cáo sự cố. Đây là điểm uỷ quyền cho hàm createIncident dùng chung
 * của nhóm — các khung gọi qua api.js, không tự ghi localStorage.
 */
export async function createIncident(input) {
  const [lines, machines] = await Promise.all([listLines(), listMachines()]);
  const { ok, errors } = validateIncidentInput(input, { lines, machines });
  if (!ok) {
    const firstField = Object.keys(errors)[0];
    throw new ApiError(errors[firstField], "VALIDATION", firstField);
  }

  const incidents = await listIncidents();
  const incident = {
    id: `INC-${Date.now()}`,
    lineId: text(input.lineId),
    machineId: text(input.machineId),
    description: text(input.description),
    impact: input.impact,
    status: "new",
    priority: input.priority || input.ai1?.priority || "medium",
    createdAt: input.createdAt,
    reportedAt: nowISO(),
    attachments: Array.isArray(input.attachments) ? input.attachments.slice(0, 3) : [],
    ai1: input.ai1 ? { ...input.ai1, appliedAt: nowISO() } : null
  };

  writeJSON(KEYS.incidents, [incident, ...incidents]);
  return incident;
}

export async function updateIncidentStatus(incidentId, status, note = "") {
  if (!INCIDENT_STATUSES.includes(status)) {
    throw new ApiError("Trạng thái sự cố không hợp lệ.", "VALIDATION", "status");
  }
  const incidents = await listIncidents();
  if (!incidents.some((incident) => incident.id === incidentId)) {
    throw new ApiError(`Không tìm thấy sự cố ${incidentId}.`, "NOT_FOUND");
  }
  const updated = incidents.map((incident) =>
    incident.id === incidentId
      ? { ...incident, status, note: note || incident.note || "", updatedAt: nowISO() }
      : incident
  );
  writeJSON(KEYS.incidents, updated);
  return updated.find((incident) => incident.id === incidentId);
}

export const closeIncident = (incidentId, note = "") => updateIncidentStatus(incidentId, "closed", note);
export const startIncident = (incidentId, note = "") => updateIncidentStatus(incidentId, "in_progress", note);

/* -------------------------- Bản nháp báo sự cố (khung 04) -------------------------- */

export function readDraft() {
  const draft = readJSON(KEYS.draft, null);
  if (!draft || typeof draft !== "object") return null;
  if (!text(draft.description) && !text(draft.lineId)) return null;
  return draft;
}

export function saveDraft(draft) {
  const payload = {
    lineId: text(draft?.lineId),
    machineId: text(draft?.machineId),
    createdAt: draft?.createdAt || "",
    description: String(draft?.description ?? ""),
    impact: IMPACTS.includes(draft?.impact) ? draft.impact : "partial",
    savedAt: nowISO()
  };
  writeJSON(KEYS.draft, payload);
  return payload;
}

export function clearDraft() {
  removeKey(KEYS.draft);
}

/* -------------------------- Đăng ký tài khoản (khung 14, 22, 23) -------------------------- */

export const REGISTRATION_STATUS = {
  pending: { label: "Chờ duyệt", cls: "warn" },
  approved: { label: "Đã duyệt", cls: "ok" },
  rejected: { label: "Bị từ chối", cls: "danger" }
};

export function listRegistrations() {
  const list = readJSON(KEYS.registrations, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Kiểm tra yêu cầu đăng ký. Trả về `{ ok, errors }` với khóa theo id trường
 * trong biểu mẫu để khung 14 hiển thị lỗi ngay dưới ô nhập.
 */
export function validateRegistration(input, { existing = listRegistrations() } = {}) {
  const errors = {};
  const name = text(input?.name);
  const email = text(input?.email).toLowerCase();
  const employeeId = text(input?.employeeId).toUpperCase();
  const password = String(input?.password ?? "");
  const confirmPassword = String(input?.confirmPassword ?? "");

  if (name.length < 2) errors.fullName = "Nhập họ tên đầy đủ (ít nhất 2 ký tự).";
  else if (name.length > 60) errors.fullName = "Họ tên tối đa 60 ký tự.";

  if (!email) errors.email = "Nhập email công ty.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Email chưa đúng định dạng (ví dụ name@company.com).";

  if (!employeeId) errors.employeeId = "Nhập mã nhân viên.";
  else if (!/^[A-Z0-9-]{3,20}$/.test(employeeId)) errors.employeeId = "Mã nhân viên 3–20 ký tự chữ, số hoặc gạch ngang.";

  if (password.length < 8) errors.password = "Mật khẩu cần ít nhất 8 ký tự.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = "Mật khẩu cần có cả chữ và số.";

  if (confirmPassword !== "" && confirmPassword !== password) errors.confirmPassword = "Mật khẩu nhập lại không khớp.";

  if (input?.terms === false) errors.terms = "Bạn cần xác nhận thông tin đăng ký là chính xác.";

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
  const { ok, errors } = validateRegistration(input);
  if (!ok) {
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
  const updated = list.map((item) => (item.id === registrationId ? { ...item, status, reviewedAt: nowISO() } : item));
  writeJSON(KEYS.registrations, updated);
  return updated.find((item) => item.id === registrationId) || null;
}

/* -------------------------- Phiên đăng nhập & thông báo chuyển trang -------------------------- */

export function getSession() {
  const session = readJSON(KEYS.session, null);
  return session && typeof session === "object" ? session : null;
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

/** Thông báo ngắn dùng sau khi chuyển trang (vì toast không sống qua trang mới). */
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