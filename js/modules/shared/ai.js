/**
 * js/modules/shared/ai.js
 * Trợ lý AI-1 — phân loại sự cố (dùng cho khung "Tạo báo cáo sự cố").
 *
 * Nguyên tắc bắt buộc của hợp đồng: AI-1 chỉ ĐỀ XUẤT. Kết quả trả về luôn có
 * `requiresConfirmation: true` và KHÔNG được ghi thẳng vào sự cố. Khung gọi phải
 * để người dùng chọn Chấp nhận / Sửa / Từ chối trước khi gửi báo cáo.
 *
 * Bản này chạy bằng luật mô phỏng (mock-rule) để demo. Khi nhóm có endpoint
 * thật, chỉ cần đổi phần thân `classifyIncident` sang lời gọi API; phần còn lại
 * giữ nguyên.
 */

import { ApiError } from "./api.js";

export const AI1_SOURCE = "mock-rule";

export const AI1_CATEGORIES = [
  "Lỗi cơ khí",
  "Lỗi nhiệt",
  "Lỗi điện",
  "Lỗi cảm biến / phần mềm",
  "Lỗi nguyên liệu",
  "Chưa xác định"
];

export const AI1_PRIORITIES = [
  { value: "high", label: "Cao" },
  { value: "medium", label: "Trung bình" },
  { value: "low", label: "Thấp" }
];

const RULES = [
  {
    category: "Lỗi cơ khí",
    priority: "high",
    confidence: 0.78,
    pattern: /(rung|va đập|ổ trục|kẹt|kêu to|ma sát|long|bạc|trục|băng tải)/i,
    reason: "Mô tả có rung, va đập hoặc kẹt máy; cần kiểm tra cụm cơ khí trước khi vận hành tiếp."
  },
  {
    category: "Lỗi nhiệt",
    priority: "high",
    confidence: 0.82,
    pattern: /(nhiệt|nóng|quá nhiệt|tỏa nhiệt|nhiệt độ|cháy khét|khét|bốc khói|khói)/i,
    reason: "Mô tả nhắc tới nhiệt độ bất thường; nguy cơ hỏng chi tiết và mất an toàn."
  },
  {
    category: "Lỗi điện",
    priority: "high",
    confidence: 0.8,
    pattern: /(điện|mất nguồn|nguồn|chập|đấu dây|aptomat|cầu chì|phóng điện|giật)/i,
    reason: "Có dấu hiệu liên quan nguồn hoặc hệ thống điện; cần cách ly và kiểm tra trước khi reset."
  },
  {
    category: "Lỗi cảm biến / phần mềm",
    priority: "medium",
    confidence: 0.68,
    pattern: /(cảm biến|sensor|báo lỗi|màn hình|phần mềm|hmi|plc|tín hiệu|không nhận|sai số)/i,
    reason: "Mô tả nghi vấn ở cảm biến, tín hiệu hoặc phần mềm điều khiển; nên kiểm tra log và hiệu chuẩn."
  },
  {
    category: "Lỗi nguyên liệu",
    priority: "medium",
    confidence: 0.64,
    pattern: /(nguyên liệu|phôi|vật liệu|kẹt liệu|thiếu liệu|đầu vào|khuôn|cấp liệu)/i,
    reason: "Mô tả liên quan dòng nguyên liệu hoặc phôi đầu vào; thường xử lý được ngay tại vị trí."
  },
  {
    category: "Lỗi khác / thao tác",
    priority: "low",
    confidence: 0.58,
    pattern: /(vệ sinh|thao tác|nhãn|dán|hộp|đóng gói|in|mực|bụi|móp)/i,
    reason: "Mô tả thiên về thao tác, vệ sinh hoặc lỗi bề mặt sản phẩm; ảnh hưởng cục bộ."
  }
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gợi ý phân loại cho một mô tả sự cố.
 * @returns {Promise<{category:string, priority:string, reason:string, confidence:number,
 *   source:string, requiresConfirmation:boolean, impactNote:string}>}
 */
export async function classifyIncident(input = {}, options = {}) {
  const description = String(input.description ?? "").trim();
  if (description.length < 8) {
    throw new ApiError(
      "Cần mô tả hiện tượng ít nhất 8 ký tự để AI-1 phân loại.",
      "AI1_INPUT",
      "description"
    );
  }

  const latency = Number.isFinite(options.latency) ? options.latency : 620;
  if (latency > 0) await delay(latency);

  if (options.forceError) {
    throw new ApiError("AI-1 tạm thời không phản hồi. Bạn có thể tự chọn loại lỗi hoặc thử lại.", "AI1_UNAVAILABLE");
  }

  const matched = RULES.find((rule) => rule.pattern.test(description));
  const fallback = !matched;

  let category = matched ? matched.category : "Chưa xác định";
  let priority = matched ? matched.priority : "medium";
  let reason = matched
    ? matched.reason
    : "Chưa đủ từ khóa để xác định nhóm lỗi. Vui lòng kiểm tra thủ công và chọn lại mức ưu tiên.";
  let confidence = matched ? matched.confidence : 0.45;

  const impactNote = impactNoteFor(input.impact, priority);
  if (input.impact === "full" && priority !== "high") {
    priority = "high";
    confidence = Math.min(0.9, confidence + 0.08);
  }

  if (input.machine?.status === "stopped") {
    confidence = Math.min(0.95, confidence + 0.05);
  }

  return {
    category,
    priority,
    reason,
    confidence: Number(confidence.toFixed(2)),
    source: AI1_SOURCE,
    lowConfidence: fallback,
    impactNote,
    inputEcho: {
      lineId: input.line?.id || null,
      machineId: input.machine?.id || null,
      description
    },
    requiresConfirmation: true
  };
}

function impactNoteFor(impact, priority) {
  if (impact === "full") return "Mức ảnh hưởng: dừng toàn bộ dây chuyền — nên xử lý trước các việc khác.";
  if (impact === "partial") return "Mức ảnh hưởng: dừng một phần — vẫn có thể chạy tiếp phần còn lại.";
  if (impact === "unknown")
    return priority === "high"
      ? "Chưa rõ mức ảnh hưởng nhưng ưu tiên cao — cần xác minh sớm."
      : "Chưa rõ mức ảnh hưởng — theo dõi thêm trong ca.";
  return "";
}

/** Nhãn hiển thị cho mức ưu tiên mà AI-1 đề xuất. */
export function priorityLabel(value) {
  return (AI1_PRIORITIES.find((item) => item.value === value) || { label: "Chưa xác định" }).label;
}