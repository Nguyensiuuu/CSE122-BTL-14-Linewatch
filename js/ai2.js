/**
 * ============================================================================
 * MODULE MÔ PHỎNG AI-2: TÓM TẮT CA SẢN XUẤT & VIỆC TỒN (AI2.JS)
 * Phân tích dữ liệu sự cố trong ca để đưa ra gợi ý tóm tắt bàn giao ca.
 * ============================================================================
 */

import { load, ok, fail } from "./store.js";

// Hàm giả lập độ trễ thời gian xử lý của AI (miliseconds)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Hàm tóm tắt ca sản xuất
 * @param {Object} params - Gồm shiftId (mã ca) và incidentIds (danh sách sự cố)
 * @param {Object} options - Tùy chọn variant (kiểu văn bản tóm tắt chẵn/lẻ)
 */
export async function summarizeShift(
  { shiftId, incidentIds } = {},
  { variant = 0 } = {},
) {
  // 1. Kiểm tra tính hợp lệ của dữ liệu đầu vào
  if (!shiftId || !Array.isArray(incidentIds)) {
    return fail("VALIDATION_ERROR", "Thiếu ca hoặc danh sách sự cố");
  }

  // Giả lập độ trễ suy luận của AI (700ms)
  await wait(700);

  try {
    // Cho phép giả lập lỗi nếu trên URL có gắn tham số ?ai2=error
    if (new URLSearchParams(location.search).get("ai2") === "error") {
      return fail("STORAGE_ERROR", "Không thể xử lý yêu cầu lúc này.");
    }

    // Tải dữ liệu hệ thống và tìm ca làm việc tương ứng
    const d = await load();
    const sh = d.shifts.find((s) => s.id === shiftId);
    if (!sh) return fail("NOT_FOUND", "Không tìm thấy ca làm việc");

    // Lọc các sự cố thuộc ca hiện có trong danh sách yêu cầu
    const inc = d.incidents.filter(
      (i) => i.shiftId === shiftId && incidentIds.includes(i.id),
    );
    // Việc còn mở từ các ca trước vẫn phải xuất hiện trong bản giao ca.
    const inherited = d.incidents.filter((i) => {
      const otherShift = d.shifts.find((s) => s.id === i.shiftId);
      return otherShift && new Date(otherShift.startsAt) < new Date(sh.startsAt) &&
        !["resolved", "closed", "cancelled"].includes(i.status);
    });
    if (!inc.length && !inherited.length)
      return fail("NO_EVIDENCE", "Không đủ dữ liệu để đưa ra đề xuất.");

    // Thống kê trạng thái sự cố
    const done = inc.filter((i) =>
      ["resolved", "closed"].includes(i.status),
    ).length;
    // Đã xử lý xong thì không còn là việc tồn, dù trưởng ca chưa đóng sự cố.
    const currentPending = inc.filter((i) => !["resolved", "closed", "cancelled"].includes(i.status));
    const pend = [...currentPending, ...inherited];

    // Lọc ra các dây chuyền có việc tồn và đếm số sự cố ưu tiên cao
    const lines = [...new Set(pend.map((i) => i.lineId))];
    const high = pend.filter((i) => i.priority === "high").length;

    // 2. Tạo nội dung tóm tắt theo 2 biến thể văn bản (chẵn / lẻ)
    const text =
      variant % 2 === 0
        ? `${sh.name} phát sinh ${inc.length} sự cố, ${done} đã hoàn thành. Còn ${currentPending.length} việc trong ca và ${inherited.length} việc từ ca trước cần bàn giao${high ? `, trong đó ${high} ưu tiên cao` : ""}. ${lines.length ? `Khu vực cần theo dõi: ${lines.join(", ")}.` : "Không còn việc cần theo dõi."}`
        : `Trong ${sh.name}: ${inc.length} sự cố ghi nhận, ${done} đã hoàn thành. Ca sau tiếp nhận ${pend.length} việc còn mở (${currentPending.length} trong ca, ${inherited.length} từ ca trước)${high ? `; ${high} ưu tiên cao` : ""}. ${lines.length ? `Ưu tiên các dây chuyền ${lines.join(", ")}.` : ""}`;

    // 3. Trả về kết quả phân tích chuẩn cấu trúc
    return ok({
      kind: "shift-summary",
      suggestion: {
        text,
        pendingIncidentIds: pend.map((i) => i.id),
      },
      reason: `Tổng hợp ${inc.length} sự cố của ${sh.name} và ${inherited.length} việc còn mở từ ca trước; việc đã xử lý hoặc đóng không tính là tồn.`,
      confidence: Math.min(
        0.9,
        Math.round((0.5 + 0.05 * inc.length) * 100) / 100,
      ),
      source: "mock-rule",
      references: [...inc, ...inherited].map((i) => i.id),
    });
  } catch (e) {
    return fail("STORAGE_ERROR", e.message);
  }
}
