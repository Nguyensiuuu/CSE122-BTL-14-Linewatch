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
    if (!inc.length)
      return fail("NO_EVIDENCE", "Không đủ dữ liệu để đưa ra đề xuất.");

    // Thống kê trạng thái sự cố
    const done = inc.filter((i) =>
      ["resolved", "closed"].includes(i.status),
    ).length;
    const pend = inc.filter((i) => !["closed", "cancelled"].includes(i.status));

    // Lọc ra các dây chuyền có việc tồn và đếm số sự cố ưu tiên cao
    const lines = [...new Set(pend.map((i) => i.lineId))];
    const high = pend.filter((i) => i.priority === "high").length;

    // 2. Tạo nội dung tóm tắt theo 2 biến thể văn bản (chẵn / lẻ)
    const text =
      variant % 2 === 0
        ? `${sh.name} phát sinh ${inc.length} sự cố, ${done} đã hoàn thành. ${lines.length ? lines.join(", ") + " là khu vực cần theo dõi tiếp" : "Không còn khu vực cần theo dõi"}; còn ${pend.length} việc tồn${high ? `, trong đó ${high} ưu tiên cao` : ""}.`
        : `Trong ${sh.name}: ${inc.length} sự cố ghi nhận, ${pend.length} chưa đóng${high ? ` (${high} ưu tiên cao)` : ""}. Ca sau cần ưu tiên ${lines.join(", ") || "các việc phát sinh mới"}.`;

    // 3. Trả về kết quả phân tích chuẩn cấu trúc
    return ok({
      kind: "shift-summary",
      suggestion: {
        text,
        pendingIncidentIds: pend.map((i) => i.id),
      },
      reason: `Tổng hợp ${inc.length} sự cố cùng ca ${sh.name}, lọc theo trạng thái chưa đóng/chưa hủy.`,
      confidence: Math.min(
        0.9,
        Math.round((0.5 + 0.05 * inc.length) * 100) / 100,
      ),
      source: "mock-rule",
      references: inc.map((i) => i.id),
    });
  } catch (e) {
    return fail("STORAGE_ERROR", e.message);
  }
}
