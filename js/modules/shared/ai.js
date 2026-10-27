/**
 * js/modules/shared/ai.js
 * AI-1 (mock, rule-based) cho khung báo sự cố.
 *
 * Hợp đồng trả về: { ok, data: { kind, suggestion: { category, priority },
 * reason, confidence, source, references }, error }.
 * Loại sự cố dùng enum chung: mechanical / electrical / quality / other.
 * Ưu tiên dùng enum chung: low / medium / high.
 * `confidence` trong khoảng 0..1, `source = "mock-rule"`.
 */

import { ok, fail } from "./api.js";

export const AI1_KIND = "incident-classifier";
export const AI1_SOURCE = "mock-rule";

export const AI1_CATEGORIES = [
  { value: "mechanical", label: "Cơ khí" },
  { value: "electrical", label: "Điện" },
  { value: "quality", label: "Chất lượng" },
  { value: "other", label: "Khác" }
];

export const AI1_PRIORITIES = [
  { value: "high", label: "Cao" },
  { value: "medium", label: "Trung bình" },
  { value: "low", label: "Thấp" }
];

export function categoryLabel(value) {
  const found = AI1_CATEGORIES.find((item) => item.value === value);
  return found ? found.label : value || "Chưa xác định";
}

export function priorityLabel(value) {
  const found = AI1_PRIORITIES.find((item) => item.value === value);
  return found ? found.label : value || "Chưa xác định";
}

const STRONG = ["khói", "cháy", "khét", "chập", "mất nguồn", "kẹt", "gãy", "vỡ", "nổ"];

const RULES = [
  {
    category: "mechanical",
    keywords: [
      "rung", "va đập", "ổ trục", "bạc", "kẹt", "kêu", "ma sát", "lỏng",
      "trục", "băng tải", "quá tải", "khói", "cháy", "khét", "nhiệt", "nóng", "nhiệt độ"
    ],
    priority: "high",
    reason: "Mô tả có dấu hiệu cơ khí (rung, va đập, nhiệt độ bất thường)."
  },
  {
    category: "electrical",
    keywords: [
      "điện", "mất nguồn", "chập", "cầu chì", "cảm biến", "sensor", "phần mềm",
      "hmi", "plc", "tín hiệu", "nguồn", "màn hình", "lập trình"
    ],
    priority: "high",
    reason: "Mô tả có dấu hiệu về điện/điều khiển hoặc cảm biến."
  },
  {
    category: "quality",
    keywords: [
      "nguyên liệu", "phôi", "vật liệu", "khuôn", "móp", "lệch", "nhãn",
      "in", "mực", "bụi", "màu", "kích thước", "sai", "đóng gói"
    ],
    priority: "medium",
    reason: "Mô tả liên quan tới chất lượng sản phẩm hoặc nguyên liệu."
  }
];

function matchRule(description) {
  const normalized = String(description || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((word) => normalized.includes(word))) {
      const strong = STRONG.some((word) => normalized.includes(word));
      return {
        category: rule.category,
        priority: rule.priority,
        reason: rule.reason,
        confidence: strong ? 0.85 : 0.68
      };
    }
  }
  return {
    category: "other",
    priority: "low",
    reason: "Không khớp quy tắc rõ ràng, đề xuất mức ưu tiên thấp để bạn tự điều chỉnh.",
    confidence: 0.4
  };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Gợi ý loại sự cố và mức ưu tiên từ mô tả.
 * @param {{ description: string, machineId?: string }} input
 */
export async function suggestIncident({ description = "", machineId = null } = {}, options = {}) {
  try {
    const delay = options.delay === undefined ? 700 : options.delay;
    if (delay > 0) await wait(delay);

    const normalized = String(description || "").trim();
    if (normalized.length < 8) {
      return fail("NO_EVIDENCE", "Chưa đủ mô tả để phân tích (cần ít nhất 8 ký tự).", "description");
    }

    const match = matchRule(normalized);
    return ok({
      kind: AI1_KIND,
      suggestion: { category: match.category, priority: match.priority },
      reason: match.reason,
      confidence: match.confidence,
      source: AI1_SOURCE,
      references: machineId ? [machineId] : []
    });
  } catch (error) {
    return fail("NO_EVIDENCE", "Không phân tích được. Bạn có thể nhập tay loại và mức ưu tiên.", "description");
  }
}
