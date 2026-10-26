/**
 * ============================================================================
 * LUỒNG NGHIỆP VỤ XỬ LÝ SỰ CỐ & THÔNG BÁO (INCIDENT FLOW)
 * Quản lý vòng đời sự cố: Tiếp nhận -> Phân công (tạo Task MT) -> Đóng.
 * ============================================================================
 */

import { mutate, wrap, LwError as E } from "./store.js";

// Danh sách các trạng thái sự cố được coi là "Đang mở"
export const OPEN = ["new", "accepted", "assigned", "in_progress"];

// Lấy thời gian hiện tại theo định dạng chuẩn ISO
export const now = () => new Date().toISOString();

// Xác định ca làm việc theo giờ thực; không khớp thì chọn ca đầu tiên và
// đánh dấu demo để giao diện ghi rõ "Ca demo được chọn" (không giả là ca đang chạy).
export const resolveShift = (d) => {
  const t = Date.now();
  const hit = d.shifts.find(
    (s) => new Date(s.startsAt) <= t && t < new Date(s.endsAt),
  );
  if (hit) return { shift: hit, demo: false };
  const near = [...d.shifts].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  )[0];
  return { shift: near || null, demo: true };
};

// Hàm tìm sự cố theo ID, ném lỗi nếu không tìm thấy
const find = (d, id) => {
  const i = d.incidents.find((x) => x.id === id);
  if (!i) throw new E("NOT_FOUND", `Không tìm thấy sự cố ${id}`);
  return i;
};

// Kiểm tra tính hợp lệ của trạng thái trước khi thực hiện hành động
const need = (i, st, verb) => {
  if (i.status !== st)
    throw new E(
      "INVALID_TRANSITION",
      `${i.id} đang ở trạng thái "${i.status}", chỉ ${verb} được khi là "${st}"`,
    );
};

/* ==========================================================================
 * 1. CÁC HÀNH ĐỘNG XỬ LÝ SỰ CỐ (ACTIONS)
 * ========================================================================== */

// Tiếp nhận sự cố (Chuyển từ 'new' -> 'accepted')
export const acceptIncident = (id) =>
  mutate((d) => {
    const i = find(d, id);
    need(i, "new", "tiếp nhận");
    i.status = "accepted";
    i.acceptedAt = now();
    return i;
  });

// Phân công kỹ thuật viên xử lý sự cố (Chuyển từ 'accepted' -> 'assigned')
export const assignIncident = (id, assigneeId) =>
  mutate((d) => {
    const i = find(d, id);
    need(i, "accepted", "phân công");

    // Kiểm tra kỹ thuật viên có tồn tại, đang hoạt động và đúng vai trò không
    const u = d.users.find(
      (x) => x.id === assigneeId && x.active && x.role === "maintenance",
    );
    if (!u)
      throw new E(
        "VALIDATION_ERROR",
        "Hãy chọn một kỹ thuật viên đang hoạt động",
      );

    // Tạo mã nhiệm vụ bảo trì tương ứng (VD: INC-001 -> MT-001)
    const tid = "MT-" + id.replace(/^INC-/, "");
    if (d.maintenanceTasks.some((t) => t.id === tid || t.incidentId === id)) {
      throw new E("DUPLICATE_ID", `Đã có nhiệm vụ ${tid}`);
    }

    // Thêm nhiệm vụ bảo trì mới vào danh sách
    d.maintenanceTasks.push({
      id: tid,
      incidentId: id,
      assigneeId,
      status: "pending",
      cause: null,
      action: null,
      result: null,
      startedAt: null,
      completedAt: null,
      ai3: null,
    });

    i.status = "assigned";
    i.assignedAt = now();
    i.assignedToId = assigneeId;
    return i;
  });

// Đóng sự cố hoàn toàn (Chuyển từ 'resolved' -> 'closed')
export const closeIncident = (id) =>
  mutate((d) => {
    const i = find(d, id);
    need(i, "resolved", "xác nhận hoàn thành");
    i.status = "closed";
    i.closedAt = now();

    // Tự động chốt thời gian kết thúc dừng máy nếu chưa có
    if (!i.downtimeEndAt && i.downtimeStartAt) {
      i.downtimeEndAt = i.resolvedAt || i.closedAt;
    }
    return i;
  });

/* ==========================================================================
 * 2. HỆ THỐNG THÔNG BÁO TỰ ĐỘNG TỪ SỰ CỐ (NOTIFICATIONS)
 * ========================================================================== */

// Ánh xạ trạng thái sự cố với trường thời gian tương ứng
const FIELD = {
  new: "reportedAt",
  accepted: "acceptedAt",
  assigned: "assignedAt",
  in_progress: "startedAt",
  resolved: "resolvedAt",
  closed: "closedAt",
  cancelled: "cancelledAt",
};

const RK = "linewatch.v1.notifRead";

// Lấy danh sách ID thông báo đã đọc từ localStorage
const readSet = () => {
  try {
    return JSON.parse(localStorage.getItem(RK) || "[]");
  } catch {
    return [];
  }
};

// Lấy danh sách thông báo được tổng hợp trực tiếp từ danh sách sự cố trong ca
export const getNotifications = () =>
  wrap((d) => {
    const rd = readSet(),
      { shift: sh } = resolveShift(d);
    if (!sh) return [];

    return d.incidents
      .filter((i) => i.shiftId === sh.id)
      .map((i) => ({
        id: `${i.id}:${i.status}`,
        incidentId: i.id,
        status: i.status,
        priority: i.priority,
        machine:
          (d.machines.find((m) => m.id === i.machineId) || {}).name ||
          i.machineId,
        machineId: i.machineId,
        title: i.title,
        at: i[FIELD[i.status]] || i.reportedAt,
      }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((n) => ({ ...n, read: rd.includes(n.id) }));
  });

// Đánh dấu thông báo đã đọc
export const markNotificationsRead = async (ids) => {
  try {
    const r = await getNotifications();
    const all = r.data.map((n) => n.id);
    localStorage.setItem(
      RK,
      JSON.stringify([...new Set([...readSet(), ...(ids || all)])]),
    );
    window.dispatchEvent(new Event("linewatch:data-changed"));
    return { ok: true, data: true, error: null };
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: { code: "STORAGE_ERROR", message: e.message },
    };
  }
};
