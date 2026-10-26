/**
 * ============================================================================
 * API FACADE TRUNG TÂM (API.JS)
 * Cổng giao tiếp chung giữa giao diện và kho lưu trữ dữ liệu (Store).
 * ============================================================================
 */

import { wrap, load, ok, fail } from "./store.js";

// Re-export các hàm nghiệp vụ từ các module chuyên biệt
export {
  acceptIncident,
  assignIncident,
  closeIncident,
  getNotifications,
  markNotificationsRead,
} from "./incident-flow.js";
export { saveShiftNote, getShiftNotes } from "./shift-notes.js";
export { saveReport, getReports } from "./reports.js";
export { summarizeShift } from "./ai2.js";

/* ==========================================================================
 * 1. CÁC HÀM TRUY VẤN DỮ LIỆU CƠ BẢN (QUERIES)
 * ========================================================================== */

export const getLines = () => wrap((d) => d.lines);
export const getMachines = () => wrap((d) => d.machines);
export const getUsers = () => wrap((d) => d.users);
export const getShifts = () => wrap((d) => d.shifts);

// Lấy danh sách nhiệm vụ bảo trì (Có thể lọc theo mã kỹ thuật viên assigneeId)
export const getTasks = (a) =>
  wrap((d) => d.maintenanceTasks.filter((t) => !a || t.assigneeId === a));

// Lấy danh sách sự cố với bộ lọc linh hoạt (truyền vào object điều kiện f)
export const getIncidents = (f = {}) =>
  wrap((d) =>
    d.incidents.filter((i) =>
      Object.entries(f).every(([k, v]) => v == null || i[k] === v),
    ),
  );

/* ==========================================================================
 * 2. QUẢN LÝ PHIÊN ĐĂNG NHẬP & XÁC THỰC DEMO (AUTH)
 * ========================================================================== */

const SK = "linewatch.v1.session";

// Đăng nhập demo theo vai trò (supervisor / admin / maintenance)
export async function loginDemo(role) {
  try {
    const u = (await load()).users.find((x) => x.role === role && x.active);
    if (!u) return fail("NOT_FOUND", "Không có tài khoản demo");

    // Lưu ID người dùng vào localStorage
    localStorage.setItem(SK, JSON.stringify({ userId: u.id }));
    return ok(u);
  } catch (e) {
    return fail("STORAGE_ERROR", e.message);
  }
}

// Lấy thông tin người dùng đang đăng nhập hiện tại
export async function getCurrentUser() {
  try {
    const s = JSON.parse(localStorage.getItem(SK) || "null");
    const u = s && (await load()).users.find((x) => x.id === s.userId);
    return ok(u || null);
  } catch (e) {
    return fail("STORAGE_ERROR", e.message);
  }
}
