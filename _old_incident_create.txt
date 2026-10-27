/**
 * js/modules/operator/incident-create.js
 * Khung 03 — "Tạo báo cáo sự cố".
 *
 * Điểm cốt lõi theo hợp đồng: AI-1 chỉ ĐỀ XUẤT. Gợi ý chỉ được ghi vào sự cố khi
 * người dùng bấm "Chấp nhận" (hoặc "Sửa" rồi tự chọn loại lỗi / ưu tiên).
 * Nếu người dùng chưa quyết định mà bấm gửi, khung sẽ hỏi lại bằng hộp thoại.
 *
 * Trạng thái UI: đang tải (skeleton) → sẵn sàng → lỗi (có nút thử lại).
 */

import {
  createIncident,
  readDraft,
  saveDraft,
  clearDraft,
  setFlash,
  toApiError,
  validateIncidentInput
} from "../shared/api.js";
import { classifyIncident, priorityLabel, AI1_CATEGORIES, AI1_PRIORITIES } from "../shared/ai.js";
import { store } from "../shared/store.js";
import {
  $,
  $$,
  esc,
  toast,
  setBusy,
  openModal,
  setFieldError,
  clearFieldError,
  clearFormErrors,
  showFormError,
  skeletonBlocks,
  showState,
  renderShell,
  toLocalInput,
  toISOString,
  readParam
} from "../shared/ui.js";

const MAX_FILES = 3;
const MAX_FILE_MB = 5;

let form = null;
let stateEl = null;
let lines = [];
let machines = [];
let suggestion = null; // gợi ý AI-1 đang chờ người dùng quyết định
let decision = null; // null | "accepted" | "edited" | "rejected"

const el = {};

export function init() {
  form = $("#incident-form");
  if (!form) return;

  Object.assign(el, {
    line: $("#lineId"),
    machine: $("#machineId"),
    createdAt: $("#createdAt"),
    description: $("#description"),
    attachments: $("#attachments"),
    fileHelp: $("#file-help"),
    formError: $("#form-error"),
    saveDraft: $("#save-draft"),
    aiState: $("#ai-state"),
    aiCategory: $("#ai-category"),
    aiPriority: $("#ai-priority"),
    aiReason: $("#ai-reason"),
    aiConfidence: $("#ai-confidence"),
    aiProgress: $("#ai-progress"),
    aiFeedback: $("#ai-feedback"),
    aiRetry: $("#ai-retry"),
    aiAccept: $("#ai-accept"),
    aiEdit: $("#ai-edit"),
    aiReject: $("#ai-reject")
  });

  renderShell(null);
  if (el.createdAt && !el.createdAt.value) el.createdAt.value = toLocalInput();
  setAiButtons("idle");
  bindEvents();
  loadData();
}

/* ------------------------------ Nạp dữ liệu ------------------------------ */

function loadData() {
  stateEl = document.createElement("div");
  stateEl.id = "incident-form-state";
  form.insertBefore(stateEl, form.firstChild);
  stateEl.innerHTML = `<div class="skeleton-wrap">${skeletonBlocks(2)}</div>`;
  if (el.line) el.line.disabled = true;
  if (el.machine) el.machine.disabled = true;

  store
    .load()
    .then((state) => {
      lines = state.lines;
      machines = state.machines;
      renderShell(state.session);
      stateEl.innerHTML = "";
      if (el.line) el.line.disabled = false;
      if (el.machine) el.machine.disabled = false;
      fillLines();
      applyPrefill();
    })
    .catch((error) => {
      const apiError = toApiError(error, "Không tải được danh sách dây chuyền và máy.");
      showState(stateEl, {
        kind: "error",
        title: "Không tải được dữ liệu",
        message: apiError.message,
        actionLabel: "Thử lại",
        onAction: () => loadData()
      });
      disableSubmit(true);
    });
}

function fillLines() {
  if (!el.line) return;
  el.line.innerHTML = lines
    .map((line) => `<option value="${esc(line.id)}">${esc(line.id)} · ${esc(line.name)}</option>`)
    .join("");
  fillMachines(el.line.value);
}

function fillMachines(lineId, selectedId = null) {
  if (!el.machine) return;
  const list = machines.filter((machine) => machine.lineId === lineId);
  el.machine.innerHTML = list.length
    ? list.map((machine) => `<option value="${esc(machine.id)}">${esc(machine.id)} · ${esc(machine.name)}</option>`).join("")
    : '<option value="">Dây chuyền chưa có máy</option>';
  if (selectedId && list.some((machine) => machine.id === selectedId)) el.machine.value = selectedId;
}

/** Điền sẵn dây chuyền/máy khi đến từ khung 02, hoặc khôi phục bản nháp. */
function applyPrefill() {
  const draft = readDraft();
  if (draft) {
    if (draft.lineId && lines.some((line) => line.id === draft.lineId)) {
      el.line.value = draft.lineId;
      fillMachines(draft.lineId, draft.machineId);
    }
    if (draft.createdAt) el.createdAt.value = toLocalInput(draft.createdAt);
    if (draft.description) el.description.value = draft.description;
    const impact = form.querySelector(`[name="impact"][value="${draft.impact}"]`);
    if (impact) impact.checked = true;
    toast("Đã khôi phục bản nháp đã lưu trong trình duyệt.", { type: "success" });
  }

  const paramLine = readParam("lineId");
  const paramMachine = readParam("machineId");
  if (paramLine && lines.some((line) => line.id === paramLine)) {
    el.line.value = paramLine;
    fillMachines(paramLine, paramMachine);
  }

  if (draft || paramLine) {
    resetSuggestion();
    el.description.focus();
  }
}

/* ------------------------------ Sự kiện ------------------------------ */

function bindEvents() {
  el.line?.addEventListener("change", () => {
    fillMachines(el.line.value);
    resetSuggestion();
  });
  el.machine?.addEventListener("change", () => resetSuggestion());
  el.createdAt?.addEventListener("input", () => clearFieldError(el.createdAt));
  el.description?.addEventListener("input", () => {
    clearFieldError(el.description);
    if (suggestion) resetSuggestion();
  });
  $$('[name="impact"]', form).forEach((input) =>
    input.addEventListener("change", () => {
      if (suggestion) resetSuggestion();
    })
  );
  el.attachments?.addEventListener("change", validateAttachments);
  el.saveDraft?.addEventListener("click", onSaveDraft);
  el.aiRetry?.addEventListener("click", requestSuggestion);
  el.aiAccept?.addEventListener("click", acceptSuggestion);
  el.aiEdit?.addEventListener("click", startEditingSuggestion);
  el.aiReject?.addEventListener("click", rejectSuggestion);
  form.addEventListener("submit", onSubmit);
}

function currentImpact() {
  return form.querySelector('[name="impact"]:checked')?.value || "";
}

function currentPayload() {
  return {
    lineId: el.line?.value || "",
    machineId: el.machine?.value || "",
    createdAt: el.createdAt?.value || "",
    description: el.description?.value ?? "",
    impact: currentImpact()
  };
}

/* ------------------------------ AI-1: chỉ đề xuất, không tự áp dụng ------------------------------ */

async function requestSuggestion() {
  const payload = currentPayload();
  if (payload.description.trim().length < 8) {
    setFieldError(el.description, "Cần mô tả hiện tượng ít nhất 8 ký tự trước khi nhờ AI-1 phân loại.");
    aiFeedback("AI-1 chưa thể phân loại vì mô tả còn quá ngắn.", true);
    el.description?.focus();
    return;
  }

  const machine = machines.find((item) => item.id === payload.machineId) || null;
  const line = lines.find((item) => item.id === payload.lineId) || null;

  setBusy(el.aiRetry, true, "Đang phân tích…");
  setAiButtons("loading");
  if (el.aiState) el.aiState.textContent = "AI-1 đang phân tích rà soát sự cố....";
  aiFeedback("");

  try {
    const result = await classifyIncident(
      { description: payload.description, impact: payload.impact, machine, line },
      { latency: 620 }
    );
    suggestion = result;
    decision = null;
    paintSuggestion(result);
    aiFeedback("Nguồn: mock-rule · Gợi ý chỉ mang tính tham khảo. Hãy Chấp nhận, Sửa hoặc Từ chối trước khi gửi.");
  } catch (error) {
    resetSuggestion();
    if (el.aiReason) el.aiReason.textContent = error.message;
    aiFeedback(error.message, true);
  } finally {
    setBusy(el.aiRetry, false);
    if (el.aiRetry) el.aiRetry.textContent = suggestion ? "Tạo lại gợi ý" : "Tạo gợi ý";
    setAiButtons(suggestion ? "proposed" : "idle");
  }
}

function paintSuggestion(result) {
  if (el.aiState) el.aiState.textContent = "Đã có gợi ý — chờ bạn xác nhận.";
  if (el.aiCategory) el.aiCategory.textContent = result.category;
  if (el.aiPriority) el.aiPriority.textContent = priorityLabel(result.priority);
  if (el.aiReason) el.aiReason.textContent = `${result.reason}${result.impactNote ? ` ${result.impactNote}` : ""}`;
  if (el.aiConfidence) el.aiConfidence.textContent = `${Math.round(result.confidence * 100)}%`;
  if (el.aiProgress) el.aiProgress.style.width = `${Math.round(result.confidence * 100)}%`;
  const box = el.aiCategory?.closest(".ai-result");
  if (box) box.classList.toggle("uncertain", Boolean(result.lowConfidence));
}

function resetSuggestion() {
  suggestion = null;
  decision = null;
  if (el.aiState) el.aiState.textContent = "Gợi ý mô phỏng dựa trên mô tả bạn nhập.";
  if (el.aiCategory) el.aiCategory.textContent = "Chưa phân loại";
  if (el.aiPriority) {
    el.aiPriority.textContent = "Chưa xác định";
    el.aiPriority.className = "pill neutral";
  }
  if (el.aiReason) el.aiReason.textContent = "Nhập mô tả rồi chọn “Tạo gợi ý”.";
  if (el.aiConfidence) el.aiConfidence.textContent = "—";
  if (el.aiProgress) el.aiProgress.style.width = "0";
  el.aiCategory?.closest(".ai-result")?.classList.remove("uncertain");
  removeManualEditor();
  setAiButtons("idle");
}

function setAiButtons(mode) {
  const hasSuggestion = mode === "proposed" || mode === "editing";
  [el.aiAccept, el.aiEdit, el.aiReject].forEach((btn) => {
    if (!btn) return;
    btn.disabled = !hasSuggestion;
    btn.setAttribute("aria-disabled", String(!hasSuggestion));
  });
  if (el.aiEdit) {
    el.aiEdit.textContent = mode === "editing" ? "Đang sửa" : "Sửa";
    el.aiEdit.classList.toggle("primary", mode === "editing");
  }
  if (el.aiAccept) el.aiAccept.classList.toggle("primary", mode !== "editing");
  if (el.aiRetry) el.aiRetry.disabled = mode === "loading";
}

function aiFeedback(message, isError = false) {
  if (!el.aiFeedback) return;
  el.aiFeedback.textContent = message || "";
  el.aiFeedback.classList.toggle("error", Boolean(isError));
  el.aiFeedback.classList.toggle("hidden", !message);
}

/** Chấp nhận gợi ý: ghi loại lỗi + ưu tiên của AI-1 vào báo cáo (do người dùng chủ động). */
function acceptSuggestion() {
  if (!suggestion) return;
  decision = "accepted";
  removeManualEditor();
  if (el.aiPriority) {
    el.aiPriority.textContent = priorityLabel(suggestion.priority);
    el.aiPriority.className = `pill ${priorityClass(suggestion.priority)}`;
  }
  setAiButtons("proposed");
  aiFeedback(
    `Đã áp dụng gợi ý: ${suggestion.category} · ưu tiên ${priorityLabel(suggestion.priority)}. Bạn vẫn có thể Sửa hoặc Từ chối.`
  );
  toast("Đã áp dụng gợi ý của AI-1 vào báo cáo.", { type: "success" });
}

/** Mở ô chọn tay để người dùng tự quyết định loại lỗi và ưu tiên. */
function startEditingSuggestion() {
  if (!suggestion) return;
  removeManualEditor();
  decision = "edited";

  const box = el.aiCategory?.closest(".ai-result");
  if (!box) return;

  const editor = document.createElement("div");
  editor.className = "ai-editor";
  editor.dataset.aiEditor = "true";
  editor.innerHTML = `
    <div class="field">
      <label for="ai-manual-category">Loại lỗi (bạn chọn)</label>
      <select id="ai-manual-category">
        ${AI1_CATEGORIES.map(
          (category) =>
            `<option value="${esc(category)}"${category === suggestion.category ? " selected" : ""}>${esc(category)}</option>`
        ).join("")}
      </select>
    </div>
    <div class="field">
      <label for="ai-manual-priority">Mức ưu tiên (bạn chọn)</label>
      <select id="ai-manual-priority">
        ${AI1_PRIORITIES.map(
          (item) =>
            `<option value="${esc(item.value)}"${item.value === suggestion.priority ? " selected" : ""}>${esc(item.label)}</option>`
        ).join("")}
      </select>
    </div>
    <p class="hint">Gợi ý của AI-1 chỉ là tham khảo — lựa chọn cuối cùng là của bạn.</p>`;

  box.insertAdjacentElement("afterend", editor);

  const categoryInput = $("#ai-manual-category", editor);
  const priorityInput = $("#ai-manual-priority", editor);
  categoryInput?.focus();

  const sync = () => {
    if (el.aiCategory) el.aiCategory.textContent = categoryInput.value;
    if (el.aiPriority) {
      el.aiPriority.textContent = priorityLabel(priorityInput.value);
      el.aiPriority.className = `pill ${priorityClass(priorityInput.value)}`;
    }
    decision = "edited";
    setAiButtons("editing");
    aiFeedback("Bạn đang tự chọn phân loại. Bấm “Chấp nhận” để chốt, hoặc Từ chối để bỏ gợi ý.");
  };
  categoryInput?.addEventListener("change", sync);
  priorityInput?.addEventListener("change", sync);

  setAiButtons("editing");
  aiFeedback("Chọn loại lỗi và mức ưu tiên bạn thấy đúng, rồi bấm “Chấp nhận”.");
}

function removeManualEditor() {
  $$("[data-ai-editor]", document).forEach((node) => node.remove());
}

/** Từ chối gợi ý: báo cáo vẫn được gửi nhưng không kèm dữ liệu AI-1. */
function rejectSuggestion() {
  if (!suggestion) return;
  const rejected = suggestion;
  decision = "rejected";
  removeManualEditor();
  if (el.aiPriority) {
    el.aiPriority.textContent = "Chưa xác định";
    el.aiPriority.className = "pill neutral";
  }
  setAiButtons("proposed");
  aiFeedback(
    `Đã từ chối gợi ý (${rejected.category}). Sự cố sẽ được gửi ở trạng thái “Mới” và chờ điều phối xử lý.`
  );
  toast("Đã bỏ gợi ý AI-1. Bạn vẫn có thể gửi báo cáo.", { type: "success" });
}

function priorityClass(priority) {
  if (priority === "high") return "danger";
  if (priority === "low") return "ok";
  return "warn";
}

/* ------------------------------ Tệp đính kèm ------------------------------ */

function validateAttachments() {
  const files = Array.from(el.attachments?.files || []);
  const errors = [];

  if (files.length > MAX_FILES) errors.push(`Chỉ gửi tối đa ${MAX_FILES} ảnh.`);
  const wrongType = files.filter((file) => !["image/png", "image/jpeg"].includes(file.type));
  if (wrongType.length) errors.push("Chỉ nhận ảnh PNG hoặc JPG.");
  const tooBig = files.filter((file) => file.size > MAX_FILE_MB * 1024 * 1024);
  if (tooBig.length) errors.push(`Mỗi ảnh tối đa ${MAX_FILE_MB} MB.`);

  if (errors.length) {
    setFieldError(el.attachments, errors.join(" "));
    if (el.attachments) el.attachments.value = "";
  } else {
    clearFieldError(el.attachments);
  }

  if (el.fileHelp) {
    el.fileHelp.textContent = errors.length
      ? errors.join(" ")
      : files.length
        ? `Đã chọn ${files.length}/${MAX_FILES} ảnh.`
        : `Tối đa ${MAX_FILES} ảnh PNG/JPG, mỗi ảnh ≤ ${MAX_FILE_MB} MB.`;
  }
}

/* ------------------------------ Lưu nháp & gửi ------------------------------ */

function onSaveDraft() {
  const payload = currentPayload();
  if (!payload.description.trim() && !payload.lineId) {
    showFormError(form, "Chưa có gì để lưu nháp. Hãy nhập ít nhất dây chuyền hoặc mô tả.");
    return;
  }

  setBusy(el.saveDraft, true, "Đang lưu…");
  try {
    const saved = saveDraft(payload);
    setFlash("Đã lưu bản nháp báo cáo sự cố.", "success");
    toast(`Đã lưu nháp lúc ${new Date(saved.savedAt).toLocaleTimeString("vi-VN")}.`, { type: "success" });
  } catch (error) {
    showFormError(form, toApiError(error, "Không lưu được bản nháp.").message);
  } finally {
    setBusy(el.saveDraft, false);
  }
}

function disableSubmit(disabled) {
  const submit = form?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = disabled;
}

function paintFieldErrors(errors) {
  const map = {
    lineId: el.line,
    machineId: el.machine,
    createdAt: el.createdAt,
    description: el.description
  };

  Object.entries(errors).forEach(([field, message]) => {
    if (field === "impact") {
      const holder = form.querySelector(".field:has([name='impact'])") || form.querySelector('[name="impact"]')?.closest(".field");
      if (!holder) return;
      let p = holder.querySelector(".field-error");
      if (!p) {
        p = document.createElement("p");
        p.className = "field-error";
        holder.appendChild(p);
      }
      p.textContent = message;
      return;
    }
    const input = map[field];
    if (input) setFieldError(input, message);
  });

  const firstField = Object.keys(errors)[0];
  const target = map[firstField];
  if (target && typeof target.focus === "function") target.focus();
}

async function onSubmit(event) {
  event.preventDefault();
  clearFormErrors(form);
  aiFeedback("");

  const payload = currentPayload();
  const { ok, errors } = validateIncidentInput(payload, { lines, machines });

  if (!ok) {
    paintFieldErrors(errors);
    showFormError(form, "Vui lòng kiểm tra lại các trường được đánh dấu.");
    return;
  }

  // Hợp đồng AI-1: gợi ý phải được người dùng quyết định trước khi ghi vào sự cố.
  if (suggestion && !decision) {
    const answer = await openModal({
      title: "Gợi ý AI-1 chưa được xác nhận",
      description: "Bạn có một gợi ý phân loại chưa xử lý. Chọn cách gửi báo cáo:",
      body: `
        <div class="notice">
          <b>${esc(suggestion.category)}</b> · ưu tiên ${esc(priorityLabel(suggestion.priority))}<br>
          ${esc(suggestion.reason)}
        </div>
        <p class="hint">Chấp nhận để ghi gợi ý vào sự cố, hoặc gửi không kèm gợi ý.</p>`,
      confirmLabel: "Gửi kèm gợi ý",
      cancelLabel: "Gửi không kèm gợi ý",
      onSubmit: async () => ({ ok: true, data: { apply: true } })
    });

    decision = answer.confirmed ? "accepted" : "rejected";
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Đang gửi…");
  disableSubmit(true);

  const ai1 = decision === "accepted" || decision === "edited" ? buildAiPayload(payload) : null;

  try {
    const incident = await createIncident({
      ...payload,
      createdAt: toISOString(payload.createdAt),
      priority: ai1?.priority || "medium",
      ai1
    });

    clearDraft();
    setFlash(
      ai1
        ? `Đã gửi sự cố ${incident.id} kèm gợi ý AI-1 (${ai1.category}).`
        : `Đã gửi sự cố ${incident.id}.`,
      "success"
    );
    toast(`Đã gửi sự cố ${incident.id}.`, { type: "success" });
    window.setTimeout(() => {
      window.location.href = "operator-shift-incidents.html";
    }, 600);
  } catch (error) {
    const apiError = toApiError(error, "Không gửi được báo cáo sự cố.");
    if (apiError.field) paintFieldErrors({ [apiError.field]: apiError.message });
    showFormError(form, apiError.message);
    setBusy(submitBtn, false);
    disableSubmit(false);
  }
}

/** Dữ liệu AI-1 lưu kèm sự cố — luôn có dấu xác nhận của người dùng. */
function buildAiPayload(payload) {
  const category = el.aiCategory?.textContent?.trim() || suggestion?.category || "Chưa xác định";
  const priorityValue =
    AI1_PRIORITIES.find((item) => item.label === el.aiPriority?.textContent?.trim())?.value ||
    suggestion?.priority ||
    "medium";

  return {
    source: suggestion?.source || "mock-rule",
    category,
    priority: priorityValue,
    reason: suggestion?.reason || "",
    confidence: suggestion?.confidence ?? null,
    decision, // accepted | edited
    confirmedByUser: true,
    confirmedAt: new Date().toISOString(),
    suggested: suggestion
      ? { category: suggestion.category, priority: suggestion.priority, confidence: suggestion.confidence }
      : null,
    input: { impact: payload.impact }
  };
}

init();