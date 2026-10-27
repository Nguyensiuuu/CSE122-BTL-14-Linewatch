// Sơn: ghi chú bàn giao (shiftNotes). Bản đã chốt (saved) chỉ đổi bằng phiên bản mới hoặc lưu trữ.
import { mutate, wrap, LwError as E } from "./store.js";
import { now } from "./incident-flow.js";
import { getActiveSession } from './auth.js';

/**
 * Lấy danh sách ghi chú bàn giao, có thể lọc theo ca làm việc (shiftId)
 */
export const getShiftNotes = (shiftId) =>
  wrap((d) => d.shiftNotes.filter((n) => !shiftId || n.shiftId === shiftId));

/**
 * Tạo mới hoặc cập nhật ghi chú bàn giao ca
 */
export const saveShiftNote = (p) =>
  mutate((d) => {
    const session = getActiveSession();
    if (session?.role !== 'supervisor' || session.userId !== p.supervisorId)
      throw new E('FORBIDDEN', 'Chỉ trưởng ca đang đăng nhập được lưu bản giao ca của mình.');
    // 1. Kiểm tra trạng thái ghi chú hợp lệ
    if (!["draft", "saved", "archived"].includes(p.status)) {
      throw new E("VALIDATION_ERROR", "Trạng thái ghi chú không hợp lệ");
    }

    // 3. Kiểm tra sự tồn tại của ca làm việc (shift)
    if (!d.shifts.some((s) => s.id === p.shiftId)) {
      throw new E("NOT_FOUND", "Không tìm thấy ca làm việc");
    }

    // 4. Kiểm tra sự tồn tại của trưởng ca (supervisor)
    if (!d.users.some((u) => u.id === p.supervisorId)) {
      throw new E("NOT_FOUND", "Không tìm thấy trưởng ca");
    }

    // 5. Kiểm tra danh sách sự cố tồn đọng (pending incidents) có tồn tại không
    const ids = p.pendingIncidentIds || [];
    if (ids.some((x) => !d.incidents.some((i) => i.id === x))) {
      throw new E("NOT_FOUND", "Có sự cố tồn không tồn tại");
    }

    // 6. Tìm ghi chú cũ (nếu đang cập nhật)
    let n = p.id ? d.shiftNotes.find((x) => x.id === p.id) : null;
    if (p.id && !n) throw new E("NOT_FOUND", `Không tìm thấy ghi chú ${p.id}`);
    if (p.status === "archived" && !n)
      throw new E("INVALID_TRANSITION", "Chỉ lưu trữ được bản bàn giao đã tạo.");
    // Hủy bản nháp là lưu trữ, không lấy ô nhập vừa xóa để ghi đè lịch sử.
    const text = p.status === "archived" ? n.text : (p.text || "").trim();
    if (!text)
      throw new E("VALIDATION_ERROR", "Nội dung bàn giao không được để trống");

    // 7. Kiểm tra quy tắc chuyển đổi trạng thái (State Transition)
    // - Nếu không phải nháp (draft), ngoại trừ trường hợp chuyển từ 'saved' sang 'archived', thì không cho phép sửa trực tiếp mà bắt buộc phải tạo phiên bản mới.
    if (
      n &&
      n.status !== "draft" &&
      !(n.status === "saved" && p.status === "archived")
    ) {
      throw new E(
        "INVALID_TRANSITION",
        "Bàn giao đã chốt, hãy tạo phiên bản mới",
      );
    }

    const t = now();

    // 8. Tạo mới ghi chú nếu chưa tồn tại
    if (!n) {
      n = {
        id: `SN-${p.shiftId}-${String(d.shiftNotes.filter((x) => x.shiftId === p.shiftId).length + 1).padStart(2, "0")}`,
        shiftId: p.shiftId,
        supervisorId: p.supervisorId,
        createdAt: t,
      };
      d.shiftNotes.push(n);
    }

    // 9. Cập nhật thông tin ghi chú
    Object.assign(n, {
      text,
      pendingIncidentIds: p.status === "archived" ? n.pendingIncidentIds : ids,
      status: p.status,
      ai2: p.ai2 ?? n.ai2 ?? null,
      updatedAt: t,
    });

    return n;
  });
