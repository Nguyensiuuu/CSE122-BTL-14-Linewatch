/**
 * js/modules/operator/incident-create.js
 * Khung 03 — "Báo sự cố" (vai trò công nhân vận hành).
 *
 * Trách nhiệm:
 *  - Form nhập lineId / machineId / createdAt / description / impact.
 *  - Chọn ảnh (lưu metadata tối đa 3, không lưu base64).
 *  - AI-1: gọi suggestIncident(description, machineId), hiển thị category/priority gợi ý.
 *  - Người dùng Chấp nhận / Sửa / Từ chối gợi ý; AI lỗi vẫn cho nhập tay.
 *  - Gọi createIncident với payload đầy đủ (shiftId/title/category/priority/reportedById/reportedAt),
 *    kiểm tra qua validateIncidentInput trước khi gọi.
 *  - Lưu nháp vào localStorage riêng (không ảnh hưởng store chính).
 */

import { createIncident, validateIncidentInput, getCurrentUser } from "../shared/api.js";
import { suggestIncident, categoryLabel } from "../shared/ai.js";
import { store } from "../shared/store.js";
import {
  $,
  esc,
  toast,
  renderShell,
  toLocalInput,
  toISOString,
  setFieldError,
  clearFormErrors,
  showFormError,
  priorityMeta
} from "../shared/ui.js";

const DRAFT_KEY = "linewatch.draft.incident";
const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

let formEl = null;
let lineSelect = null;
let machineSelect = null;
let descEl = null;
let aiStateEl = null;
let aiCategoryEl = null;
let aiPriorityEl = null;
let aiReasonEl = null;
let aiConfidenceEl = null;
let aiProgressEl = null;
let aiFeedbackEl = null;
let aiAcceptBtn = null;
let aiEditBtn = null;
let aiRejectBtn = null;
let aiRetryBtn = null;
let attachmentsInput = null;

let aiState = "idle"; // idle | loading | success | error
let aiResult = null; // { kind, suggestion: { category, priority }, reason, confidence, source }
let aiDecision = null; // null | "accepted" | "edited" | "rejected"
let selectedFiles = [];

export function init() {
  formEl = $("#incident-form");
  lineSelect = $("#lineId");
  machineSelect = $("#machineId");
  descEl = $("#description");
  aiStateEl = $("#ai-state");
  aiCategoryEl = $("#ai-category");
  aiPriorityEl = $("#ai-priority");
  aiReasonEl = $("#ai-reason");
  aiConfidenceEl = $("#ai-confidence");
  aiProgressEl = $("#ai-progress");
  aiFeedbackEl = $("#ai-feedback");
  aiAcceptBtn = $("#ai-accept");
  aiEditBtn = $("#ai-edit");
  aiRejectBtn = $("#ai-reject");
  aiRetryBtn = $("#ai-retry");
  attachmentsInput = $("#attachments");

  if (!formEl) return;

  renderShell(null);

  store.subscribe(() => {
    const state = store.getState();
    if (state.status === "ready") {
      renderShell(state.session);
      populateSelects(state);
    }
  });
  store.load().catch(() => {});

  $("#createdAt").value = toLocalInput();
  loadDraft();
  bindEvents();
}

function populateSelects(state) {
  const lines = state.lines || [];
  const machines = state.machines || [];
  const params = new URLSearchParams(window.location.search);
  const preLineId = params.get("lineId") || "";
  const preMachineId = params.get("machineId") || "";

  if (lineSelect && !lineSelect._populated) {
    lineSelect.innerHTML = '<option value="">Chọn dây chuyền…</option>' +
      lines.map((l) => `<option value="${esc(l.id)}">${esc(l.id)} · ${esc(l.name)}</option>`).join("");
    if (preLineId && lines.some((l) => l.id === preLineId)) lineSelect.value = preLineId;
    lineSelect._populated = true;
  }

  if (machineSelect) {
    const lineId = lineSelect?.value || "";
    const filtered = lineId ? machines.filter((m) => m.lineId === lineId) : machines;
    machineSelect.innerHTML = '<option value="">Chọn máy…</option>' +
      filtered.map((m) => `<option value="${esc(m.id)}">${esc(m.id)} · ${esc(m.name)}</option>`).join("");
    if (preMachineId && filtered.some((m) => m.id === preMachineId)) machineSelect.value = preMachineId;
  }
}

function bindEvents() {
  if (lineSelect) {
    lineSelect.addEventListener("change", () => {
      machineSelect.value = "";
      populateSelects(store.getState());
    });
  }

  if (attachmentsInput) {
    attachmentsInput.addEventListener("change", () => {
      const files = Array.from(attachmentsInput.files || []);
      selectedFiles = files.slice(0, MAX_ATTACHMENTS).filter((f) => {
        if (f.size > MAX_FILE_SIZE) {
          toast(`File "${f.name}" vượt 5MB.`, { type: "error" });
          return false;
        }
        if (!["image/png", "image/jpeg"].includes(f.type)) {
          toast(`File "${f.name}" không phải PNG/JPG.`, { type: "error" });
          return false;
        }
        return true;
      });
      const help = $("#file-help");
      if (help) help.textContent = selectedFiles.length ? `${selectedFiles.length} ảnh đã chọn (tối đa 3)` : "Tối đa 3 ảnh PNG/JPG";
    });
  }

  if (aiAcceptBtn) aiAcceptBtn.onclick = () => acceptAI();
  if (aiEditBtn) aiEditBtn.onclick = () => editAI();
  if (aiRejectBtn) aiRejectBtn.onclick = () => rejectAI();
  if (aiRetryBtn) aiRetryBtn.onclick = () => runAI();

  const saveDraftBtn = $("#save-draft");
  if (saveDraftBtn) saveDraftBtn.onclick = () => saveDraft();

  if (formEl) {
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      await submitIncident();
    });
  }
}

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (lineSelect && draft.lineId) lineSelect.value = draft.lineId;
    if (machineSelect && draft.machineId) machineSelect.value = draft.machineId;
    if (descEl && draft.description) descEl.value = draft.description;
    if (draft.createdAt) $("#createdAt").value = toLocalInput(draft.createdAt);
    if (draft.impact) {
      const radio = document.querySelector(`input[name="impact"][value="${draft.impact}"]`);
      if (radio) radio.checked = true;
    }
    toast("Đã nạp bản nháp.", { type: "success" });
  } catch (error) {
    console.warn("[incident-create] Không đọc được nháp:", error);
  }
}

function saveDraft() {
  const draft = {
    lineId: lineSelect?.value || "",
    machineId: machineSelect?.value || "",
    description: descEl?.value || "",
    createdAt: toISOString($("#createdAt").value),
    impact: document.querySelector('input[name="impact"]:checked')?.value || "unknown"
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  toast("Đã lưu nháp.", { type: "success" });
}

async function runAI() {
  const description = descEl?.value.trim() || "";
  const machineId = machineSelect?.value || "";

  if (description.length < 8) {
    toast("Nhập ít nhất 8 ký tự mô tả để AI phân tích.", { type: "error" });
    return;
  }

  aiState = "loading";
  aiResult = null;
  aiDecision = null;
  renderAI();

  const res = await suggestIncident({ description, machineId });

  if (!res.ok) {
    aiState = "error";
    aiResult = null;
    renderAI(res.error?.message || "AI không phân tích được.");
    return;
  }

  aiState = "success";
  aiResult = res.data;
  renderAI();
}

function renderAI(errorMsg = "") {
  if (aiState === "idle") {
    if (aiStateEl) aiStateEl.textContent = "Nhập mô tả hiện tượng, AI-1 sẽ gợi ý loại lỗi và mức ưu tiên.";
    if (aiCategoryEl) aiCategoryEl.textContent = "Chưa phân loại";
    if (aiPriorityEl) aiPriorityEl.innerHTML = '<span class="pill neutral">Chưa xác định</span>';
    if (aiReasonEl) aiReasonEl.textContent = 'Nhập mô tả rồi chọn “Tạo gợi ý”.';
    if (aiConfidenceEl) aiConfidenceEl.textContent = "—";
    if (aiProgressEl) aiProgressEl.style.width = "0%";
    if (aiFeedbackEl) aiFeedbackEl.textContent = "";
    [aiAcceptBtn, aiEditBtn, aiRejectBtn].forEach((btn) => { if (btn) btn.disabled = true; });
    if (aiRetryBtn) aiRetryBtn.disabled = false;
    return;
  }

  if (aiState === "loading") {
    if (aiStateEl) aiStateEl.textContent = "Đang phân tích…";
    if (aiCategoryEl) aiCategoryEl.textContent = "Đang xử lý";
    if (aiPriorityEl) aiPriorityEl.innerHTML = '<span class="pill neutral">Đang xử lý</span>';
    if (aiReasonEl) aiReasonEl.textContent = "AI-1 đang phân tích mô tả của bạn.";
    if (aiConfidenceEl) aiConfidenceEl.textContent = "—";
    if (aiProgressEl) aiProgressEl.style.width = "50%";
    [aiAcceptBtn, aiEditBtn, aiRejectBtn, aiRetryBtn].forEach((btn) => { if (btn) btn.disabled = true; });
    return;
  }

  if (aiState === "error") {
    if (aiStateEl) aiStateEl.textContent = "AI không phân tích được.";
    if (aiCategoryEl) aiCategoryEl.textContent = "Lỗi";
    if (aiPriorityEl) aiPriorityEl.innerHTML = '<span class="pill neutral">Lỗi</span>';
    if (aiReasonEl) aiReasonEl.textContent = errorMsg || "AI gặp lỗi. Bạn có thể nhập tay.";
    if (aiConfidenceEl) aiConfidenceEl.textContent = "—";
    if (aiProgressEl) aiProgressEl.style.width = "0%";
    if (aiFeedbackEl) aiFeedbackEl.textContent = "AI lỗi không ảnh hưởng việc gửi sự cố — hãy nhập tay.";
    [aiAcceptBtn, aiEditBtn, aiRejectBtn].forEach((btn) => { if (btn) btn.disabled = true; });
    if (aiRetryBtn) aiRetryBtn.disabled = false;
    return;
  }

  if (aiState === "success" && aiResult) {
    const cat = aiResult.suggestion?.category || "other";
    const pri = aiResult.suggestion?.priority || "low";
    const conf = aiResult.confidence != null ? Math.round(aiResult.confidence * 100) : 0;

    if (aiStateEl) aiStateEl.textContent = "AI-1 đã phân tích xong.";
    if (aiCategoryEl) aiCategoryEl.textContent = categoryLabel(cat);
    if (aiPriorityEl) {
      const meta = priorityMeta(pri);
      aiPriorityEl.innerHTML = `<span class="pill ${esc(meta.cls)}">${esc(meta.label)}</span>`;
    }
    if (aiReasonEl) aiReasonEl.textContent = aiResult.reason || "Không có lý do cụ thể.";
    if (aiConfidenceEl) aiConfidenceEl.textContent = `${conf}%`;
    if (aiProgressEl) aiProgressEl.style.width = `${conf}%`;

    if (aiDecision === "accepted") {
      if (aiFeedbackEl) aiFeedbackEl.textContent = "Bạn đã chấp nhận gợi ý này.";
      [aiAcceptBtn, aiEditBtn, aiRejectBtn].forEach((btn) => { if (btn) btn.disabled = true; });
    } else if (aiDecision === "edited") {
      if (aiFeedbackEl) aiFeedbackEl.textContent = "Bạn đã sửa gợi ý. Hãy chọn thủ công bên form.";
      [aiAcceptBtn, aiEditBtn, aiRejectBtn].forEach((btn) => { if (btn) btn.disabled = true; });
    } else if (aiDecision === "rejected") {
      if (aiFeedbackEl) aiFeedbackEl.textContent = "Bạn đã từ chối gợi ý. Hãy nhập thủ công.";
      [aiAcceptBtn, aiEditBtn, aiRejectBtn].forEach((btn) => { if (btn) btn.disabled = true; });
    } else {
      if (aiFeedbackEl) aiFeedbackEl.textContent = "";
      [aiAcceptBtn, aiEditBtn, aiRejectBtn].forEach((btn) => { if (btn) btn.disabled = false; });
    }
    if (aiRetryBtn) aiRetryBtn.disabled = false;
  }
}

function acceptAI() {
  if (!aiResult) return;
  aiDecision = "accepted";
  renderAI();
  toast("Đã chấp nhận gợi ý AI-1.", { type: "success" });
}

function editAI() {
  if (!aiResult) return;
  aiDecision = "edited";
  renderAI();
  toast("Hãy chọn loại và ưu tiên thủ công trước khi gửi.", { type: "info" });
}

function rejectAI() {
  if (!aiResult) return;
  aiDecision = "rejected";
  renderAI();
  toast("Đã từ chối gợi ý. Hãy nhập thủ công.", { type: "info" });
}

async function submitIncident() {
  clearFormErrors(formEl);

  const state = store.getState();
  const lines = state.lines || [];
  const machines = state.machines || [];

  const lineId = lineSelect?.value || "";
  const machineId = machineSelect?.value || "";
  const createdAt = toISOString($("#createdAt").value);
  const description = descEl?.value.trim() || "";
  const impact = document.querySelector('input[name="impact"]:checked')?.value || "unknown";

  const manualCategory = $("#category", formEl)?.value || "";
  const manualPriority = $("#priority", formEl)?.value || "";
  let category = manualCategory;
  let priority = manualPriority;

  // Chỉ dùng gợi ý AI khi người dùng đã chấp nhận; Sửa/Từ chối phải dùng giá trị nhập tay.
  if (aiDecision === "accepted" && aiResult?.suggestion) {
    category = aiResult.suggestion.category;
    priority = aiResult.suggestion.priority;
    if ($("#category", formEl)) $("#category", formEl).value = category;
    if ($("#priority", formEl)) $("#priority", formEl).value = priority;
  }

  if (!category || !priority) {
    showFormError(formEl, "Chọn loại sự cố và mức ưu tiên, hoặc chấp nhận gợi ý AI-1.");
    return;
  }

  const input = { lineId, machineId, createdAt, description, category, priority };
  const validation = validateIncidentInput(input, { lines, machines });
  if (!validation.ok) {
    const firstField = Object.keys(validation.errors)[0];
    const fieldEl = $(`#${firstField}`, formEl);
    if (fieldEl) setFieldError(fieldEl, validation.errors[firstField]);
    showFormError(formEl, validation.errors[firstField]);
    return;
  }

  const user = getCurrentUser();
  const title = description.slice(0, 50) + (description.length > 50 ? "…" : "");
  const attachments = selectedFiles.map((f) => ({
    name: f.name,
    type: f.type,
    size: f.size,
    addedAt: new Date().toISOString()
  }));

  const payload = {
    lineId,
    machineId,
    reportedAt: createdAt,
    title,
    description,
    category,
    priority,
    reportedById: user.id,
    impact,
    notes: "",
    attachments,
    ai1: aiResult && aiDecision
      ? { status: aiDecision, ...aiResult }
      : null
  };

  const res = await createIncident(payload);
  if (!res.ok) {
    showFormError(formEl, res.error?.message || "Không gửi được sự cố.");
    return;
  }

  window.localStorage.removeItem(DRAFT_KEY);
  toast(`Đã gửi sự cố ${res.data.id}.`, { type: "success" });
  window.location.href = "operator-shift-incidents.html";
}

init();

