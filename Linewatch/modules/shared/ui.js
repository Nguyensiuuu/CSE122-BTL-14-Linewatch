/**
 * js/modules/shared/ui.js
 * Tiện ích giao diện dùng chung cho các khung 02, 03, 04, 12, 14, 22, 23.
 * Không đọc/ghi dữ liệu nghiệp vụ — chỉ DOM, định dạng và trạng thái UI.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function fmtDate(value) {
  const date = toDate(value);
  return date ? dateFmt.format(date) : "—";
}

export function fmtTime(value) {
  const date = toDate(value);
  return date ? timeFmt.format(date) : "—";
}

export function fmtDateTime(value) {
  const date = toDate(value);
  return date ? `${timeFmt.format(date)} · ${dateFmt.format(date)}` : "—";
}

/** Giá trị cho <input type="datetime-local"> theo giờ máy người dùng. */
export function toLocalInput(value = new Date()) {
  const date = toDate(value) || new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toISOString(localValue) {
  const date = toDate(localValue);
  return date ? date.toISOString() : null;
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const PRIORITY = {
  high: { label: "Cao", cls: "danger" },
  medium: { label: "Trung bình", cls: "warn" },
  low: { label: "Thấp", cls: "neutral" }
};

export function priorityMeta(value) {
  return PRIORITY[value] || { label: value || "Chưa xác định", cls: "neutral" };
}

const STATUS = {
  new: { label: "Mới ghi nhận", cls: "warn" },
  accepted: { label: "Đã tiếp nhận", cls: "info" },
  assigned: { label: "Đã phân công", cls: "info" },
  in_progress: { label: "Đang xử lý", cls: "info" },
  resolved: { label: "Đã xử lý", cls: "ok" },
  closed: { label: "Hoàn thành", cls: "ok" },
  cancelled: { label: "Đã hủy", cls: "neutral" }
};

export function statusMeta(value) {
  return STATUS[value] || { label: value || "Chưa rõ", cls: "neutral" };
}

const LINE_STATUS = {
  active: { label: "Đang hoạt động", cls: "ok" },
  paused: { label: "Tạm dừng", cls: "danger" }
};

export function lineStatusMeta(value) {
  return LINE_STATUS[value] || { label: value || "Chưa rõ", cls: "neutral" };
}

const MACHINE_STATUS = {
  normal: { label: "Ổn định", cls: "ok" },
  warning: { label: "Cần quan sát", cls: "warn" },
  fault: { label: "Lỗi", cls: "danger" },
  maintenance: { label: "Bảo trì", cls: "info" }
};

export function machineStatusMeta(value) {
  return MACHINE_STATUS[value] || { label: value || "Chưa rõ", cls: "neutral" };
}

const CATEGORY = {
  mechanical: { label: "Cơ khí" },
  electrical: { label: "Điện" },
  quality: { label: "Chất lượng" },
  other: { label: "Khác" }
};

export function categoryMeta(value) {
  return CATEGORY[value] || { label: value || "Chưa rõ" };
}

export const OPEN_STATUSES = ["new", "accepted", "assigned", "in_progress"];
export const DONE_STATUSES = ["resolved", "closed"];

export const isOpenIncident = (incident) => OPEN_STATUSES.includes(incident?.status);
export const isDoneIncident = (incident) => DONE_STATUSES.includes(incident?.status);

export function readParam(name, fallback = null) {
  const value = new URLSearchParams(window.location.search).get(name);
  return value === null || value === "" ? fallback : value;
}
/** Trả về HTML của một nhãn trạng thái/ưu tiên. */
export function pill(meta, text) {
  return `<span class="pill ${esc(meta.cls)}">${esc(text ?? meta.label)}</span>`;
}

/* -------------------------- Thông báo nổi -------------------------- */

let toastRegion = null;

function ensureToastRegion() {
  if (!toastRegion || !toastRegion.isConnected) {
    toastRegion = document.createElement("div");
    toastRegion.className = "toast-region";
    toastRegion.setAttribute("role", "status");
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }
  return toastRegion;
}

export function toast(message, options = {}) {
  const { type = "success", timeout = 4500 } = options;
  const region = ensureToastRegion();
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.innerHTML = `<span>${esc(message)}</span><button type="button" class="toast-close" aria-label="Đóng thông báo">×</button>`;
  const remove = () => el.remove();
  $(".toast-close", el).addEventListener("click", remove);
  region.appendChild(el);
  if (timeout > 0) window.setTimeout(remove, timeout);
  return el;
}

/* -------------------------- Trạng thái tải -------------------------- */

export function setBusy(button, busy, label = "Đang xử lý…") {
  if (!button) return;
  if (busy) {
    if (!button.dataset.idleLabel) button.dataset.idleLabel = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${esc(label)}</span>`;
    return;
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.idleLabel) {
    button.innerHTML = button.dataset.idleLabel;
    delete button.dataset.idleLabel;
  }
}

export const skeletonRows = (count = 3) =>
  Array.from({ length: count }, () => '<div class="skeleton sk-row"></div>').join("");

export const skeletonBlocks = (count = 2) =>
  Array.from({ length: count }, () => '<div class="skeleton sk-block"></div>').join("");

export function showState(container, options = {}) {
  if (!container) return;
  const { kind = "empty", title = "Chưa có dữ liệu", message = "", actionLabel = "", onAction = null } = options;
  const isError = kind === "error";
  container.innerHTML = `
    <div class="state-box${isError ? " error" : ""}" role="${isError ? "alert" : "status"}">
      <strong>${esc(title)}</strong>
      ${message ? `<p>${esc(message)}</p>` : ""}
      ${actionLabel ? `<button type="button" class="btn${isError ? " primary" : ""}" data-state-action>${esc(actionLabel)}</button>` : ""}
    </div>`;
  if (actionLabel && onAction) {
    $("[data-state-action]", container).addEventListener("click", onAction);
  }
}

/** Giống showState nhưng đặt trong một hàng <tr>/<td> để giữ đúng cấu trúc bảng. */
export function showStateRow(tbody, colSpan = 5, options = {}) {
  if (!tbody) return;
  tbody.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  row.appendChild(cell);
  tbody.appendChild(row);
  showState(cell, options);
}


/* -------------------------- Hộp thoại -------------------------- */

export function openModal(options = {}) {
  const {
    title = "Xác nhận",
    description = "",
    body = "",
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy",
    danger = false,
    onSubmit = null
  } = options;

  return new Promise((resolve) => {
    let payload = null;
    const opener = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.innerHTML = `
      <form class="modal-card" novalidate>
        <h3>${esc(title)}</h3>
        ${description ? `<p class="modal-desc">${esc(description)}</p>` : ""}
        <div class="modal-body">${body}</div>
        <p class="modal-error" role="alert" hidden></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-modal-cancel>${esc(cancelLabel)}</button>
          <button type="submit" class="btn ${danger ? "danger" : "primary"}">${esc(confirmLabel)}</button>
        </div>
      </form>`;

    const form = $("form", dialog);
    const errorEl = $(".modal-error", dialog);
    const submitBtn = $('button[type="submit"]', dialog);

    dialog.addEventListener("close", () => {
      const confirmed = dialog.returnValue === "confirm";
      dialog.remove();
      if (opener?.isConnected && !opener.disabled) opener.focus();
      resolve(confirmed ? { confirmed: true, data: payload } : { confirmed: false, data: null });
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
    $("[data-modal-cancel]", dialog).addEventListener("click", () => dialog.close("cancel"));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorEl.hidden = true;
      if (!onSubmit) {
        dialog.close("confirm");
        return;
      }
      setBusy(submitBtn, true);
      try {
        const result = await onSubmit({ form, dialog, errorEl });
        if (result && result.ok === false) {
          errorEl.textContent = result.message || "Không thực hiện được. Vui lòng thử lại.";
          errorEl.hidden = false;
          return;
        }
        payload = (result && result.data) ?? null;
        dialog.close("confirm");
      } catch (error) {
        errorEl.textContent = error?.message || "Không thực hiện được. Vui lòng thử lại.";
        errorEl.hidden = false;
      } finally {
        setBusy(submitBtn, false);
      }
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    const firstField = $("input, textarea, select", dialog);
    (firstField || submitBtn).focus();
  });
}

/* -------------------------- Lỗi biểu mẫu -------------------------- */

export function setFieldError(input, message) {
  if (!input) return;
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
  let holder = document.querySelector(`[data-error-for="${input.id}"]`);
  if (!holder) {
    holder = document.createElement("p");
    holder.className = "field-error";
    holder.dataset.errorFor = input.id;
    input.insertAdjacentElement("afterend", holder);
  }
  holder.id = `${input.id}-error`;
  holder.textContent = message;
  input.setAttribute("aria-describedby", holder.id);
}

export function clearFieldError(input) {
  if (!input) return;
  input.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
  const holder = document.querySelector(`[data-error-for="${input.id}"]`);
  if (holder) holder.textContent = "";
}

export function clearFormErrors(form) {
  if (!form) return;
  $$(".invalid", form).forEach((el) => el.classList.remove("invalid"));
  $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
  $$(".field-error", form).forEach((el) => { el.textContent = ""; });
  const banner = $(".form-error", form);
  if (banner) {
    banner.textContent = "";
    banner.hidden = true;
  }
}

export function showFormError(form, message) {
  const banner = form ? $(".form-error", form) : null;
  if (!banner) {
    toast(message, { type: "error" });
    return;
  }
  banner.textContent = message;
  banner.hidden = false;
}

/* -------------------------- Khung trang theo vai trò -------------------------- */

/**
 * Đổ ngày, người dùng và thông tin ca vào topbar/sidebar để mọi trang vai trò
 * hiển thị nhất quán. `session` lấy từ api.js/store.js và có thể là null.
 */
export function renderShell(session) {
  const user = session?.user || null;
  const shift = session?.shift || null;
  const now = new Date();

  const dateEl = $("[data-shell='date']");
  if (dateEl) dateEl.textContent = fmtDate(now);

  const shiftDateEl = $("[data-shell='shift-date']");
  if (shiftDateEl) shiftDateEl.textContent = fmtDate(shift?.date || shift?.startsAt || now);

  $$("[data-shell='user']").forEach((el) => {
    const last = String(user?.name || "").trim().split(/\s+/).pop();
    el.textContent = user ? `NV ${last}` : "Khách";
  });

  $$("[data-shell='user-full']").forEach((el) => {
    el.textContent = user?.name || "Khách (chưa đăng nhập)";
  });

  $$("[data-shell='avatar']").forEach((el) => {
    el.textContent = initials(user?.name);
  });

  $$("[data-shell='shift']").forEach((el) => {
    if (shift) {
      el.innerHTML = `<b>${esc(shift.name || "Ca hiện tại")} · ${esc(fmtTime(shift.startsAt))}–${esc(fmtTime(shift.endsAt))}</b>`;
    } else {
      el.innerHTML = "<b>Chưa có ca đang mở</b>";
    }
  });
}
