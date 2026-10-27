/**
 * js/modules/operator/shift-incidents.js
 * Khung 04 — "Sự cố trong ca" (vai trò công nhân vận hành).
 *
 * - Danh sách sự cố đọc từ store chung (cùng seed), có tìm kiếm và lọc theo enum mới.
 * - Sự cố của chính mình và còn status = "new": cho Sửa / Hủy.
 * - Sự cố khác hoặc đã qua "new": chỉ cho Xem (read-only).
 * - Hủy giữ lịch sử (chuyển status = "cancelled", không xóa bản ghi).
 */

import { updateOwnIncident, cancelIncident, getCurrentUser } from "../shared/api.js";
import { store } from "../shared/store.js";
import {
  $,
  $$,
  esc,
  pill,
  toast,
  showStateRow,
  skeletonBlocks,
  renderShell,
  priorityMeta,
  statusMeta,
  categoryMeta,
  openModal,
  fmtDateTime
} from "../shared/ui.js";

const CATEGORY_OPTIONS = [
  { value: "mechanical", label: "Cơ khí" },
  { value: "electrical", label: "Điện" },
  { value: "quality", label: "Chất lượng" },
  { value: "other", label: "Khác" }
];

const PRIORITY_OPTIONS = [
  { value: "high", label: "Cao" },
  { value: "medium", label: "Trung bình" },
  { value: "low", label: "Thấp" }
];

let bodyEl = null;
let searchEl = null;
let filterEl = null;
let emptyEl = null;
let allIncidents = [];

export function init() {
  bodyEl = $("#incident-table");
  searchEl = $("#incident-search");
  filterEl = $("#incident-filter");
  emptyEl = $("#incident-empty");

  if (!bodyEl) return;

  renderShell(null);
  bodyEl.innerHTML = `<tr><td colspan="6">${skeletonBlocks(3)}</td></tr>`;

  store.subscribe(() => render(store.getState()));
  store.load().catch(() => {});
}

function render(state) {
  if (state.status === "loading" || state.status === "idle") {
    bodyEl.innerHTML = `<tr><td colspan="6">${skeletonBlocks(3)}</td></tr>`;
    return;
  }

  if (state.status === "error") {
    showStateRow(bodyEl, 6, {
      kind: "error",
      title: "Không tải được danh sách sự cố",
      message: state.error?.message || "Vui lòng thử lại.",
      actionLabel: "Thử lại",
      onAction: () => store.load({ force: true })
    });
    return;
  }

  renderShell(state.session);
  allIncidents = [...state.incidents].sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt)));
  bindFilters();
  renderTable();
}

function bindFilters() {
  if (searchEl && !searchEl._bound) {
    searchEl.addEventListener("input", renderTable);
    searchEl._bound = true;
  }
  if (filterEl && !filterEl._bound) {
    filterEl.addEventListener("change", renderTable);
    filterEl._bound = true;
  }
}

function renderTable() {
  if (!bodyEl) return;

  const q = (searchEl?.value || "").toLowerCase().trim();
  const f = filterEl?.value || "all";

  const rows = allIncidents.filter((i) => {
    const matchesQuery =
      !q ||
      `${i.id} ${i.lineId} ${i.machineId} ${i.shiftId} ${i.title || ""} ${i.description} ${i.reportedById}`
        .toLowerCase()
        .includes(q);
    const matchesFilter = f === "all" || i.status === f;
    return matchesQuery && matchesFilter;
  });

  if (!rows.length) {
    bodyEl.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  bodyEl.innerHTML = rows.map((i) => rowHtml(i)).join("");

  $$("[data-edit]", bodyEl).forEach((btn) => {
    btn.onclick = () => openEditModal(allIncidents.find((x) => x.id === btn.dataset.edit));
  });
  $$("[data-cancel]", bodyEl).forEach((btn) => {
    btn.onclick = () => confirmCancel(btn.dataset.cancel);
  });
  $$("[data-view]", bodyEl).forEach((btn) => {
    btn.onclick = () => openViewModal(allIncidents.find((x) => x.id === btn.dataset.view));
  });
}

function rowHtml(incident) {
  const me = getCurrentUser();
  const isMine = incident.reportedById === me.id;
  const canEdit = isMine && incident.status === "new";

  const reporter = isMine ? "Bạn" : incident.reportedById || "—";
  const actions = canEdit
    ? `<button type="button" class="btn" data-edit="${esc(incident.id)}">Sửa</button>
       <button type="button" class="btn danger" data-cancel="${esc(incident.id)}">Hủy</button>`
    : `<button type="button" class="btn" data-view="${esc(incident.id)}">Xem</button>`;

  return `
    <tr data-id="${esc(incident.id)}">
      <td>${esc(incident.id)}</td>
      <td>${esc(incident.lineId)} / ${esc(incident.machineId)}</td>
      <td>
        ${esc(incident.title || incident.description)}
        <small class="sub">${esc(incident.description)} · Người báo: ${esc(reporter)}</small>
      </td>
      <td>${pill(priorityMeta(incident.priority))} ${pill(categoryMeta(incident.category))}</td>
      <td>${pill(statusMeta(incident.status))}</td>
      <td>${actions}</td>
    </tr>`;
}

function openEditModal(incident) {
  if (!incident) return;

  openModal({
    title: `Sửa sự cố ${incident.id}`,
    description: `Dây chuyền ${incident.lineId} · máy ${incident.machineId}.`,
    body: `
      <div class="field">
        <label for="edit-desc">Mô tả sự cố</label>
        <textarea id="edit-desc" rows="4">${esc(incident.description)}</textarea>
      </div>
      <div class="field">
        <label for="edit-category">Loại sự cố</label>
        <select id="edit-category">
          ${CATEGORY_OPTIONS.map((o) => `<option value="${o.value}" ${incident.category === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="edit-priority">Mức ưu tiên</label>
        <select id="edit-priority">
          ${PRIORITY_OPTIONS.map((o) => `<option value="${o.value}" ${incident.priority === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="edit-notes">Ghi chú</label>
        <textarea id="edit-notes" rows="2">${esc(incident.notes || "")}</textarea>
      </div>`,
    confirmLabel: "Lưu thay đổi",
    onSubmit: async ({ form }) => {
      const patch = {
        description: form.querySelector("#edit-desc").value.trim(),
        category: form.querySelector("#edit-category").value,
        priority: form.querySelector("#edit-priority").value,
        notes: form.querySelector("#edit-notes").value.trim()
      };
      const res = await updateOwnIncident(incident.id, patch);
      if (!res.ok) return { ok: false, message: res.error?.message || "Không lưu được." };
      return { ok: true, data: res.data };
    }
  }).then((result) => {
    if (result.confirmed) {
      toast(`Đã cập nhật ${incident.id}.`, { type: "success" });
      store.refresh();
    }
  });
}

function confirmCancel(id) {
  const incident = allIncidents.find((x) => x.id === id);
  if (!incident) return;

  openModal({
    title: `Hủy sự cố ${id}?`,
    description: "Sự cố sẽ chuyển sang trạng thái “Đã hủy” và vẫn được giữ lại trong lịch sử.",
    confirmLabel: "Hủy sự cố",
    cancelLabel: "Giữ lại",
    danger: true,
    onSubmit: async () => {
      const res = await cancelIncident(id);
      if (!res.ok) return { ok: false, message: res.error?.message || "Không hủy được." };
      return { ok: true, data: res.data };
    }
  }).then((result) => {
    if (result.confirmed) {
      toast(`Đã hủy ${id}.`, { type: "success" });
      store.refresh();
    }
  });
}

function openViewModal(incident) {
  if (!incident) return;

  openModal({
    title: `Sự cố ${incident.id}`,
    body: `
      <div class="modal-summary">
        <div class="row"><span>Dây chuyền / máy</span><b>${esc(incident.lineId)} / ${esc(incident.machineId)}</b></div>
        <div class="row"><span>Ca</span><b>${esc(incident.shiftId || "—")}</b></div>
        <div class="row"><span>Loại</span><b>${esc(categoryMeta(incident.category).label)}</b></div>
        <div class="row"><span>Ưu tiên</span><b>${esc(priorityMeta(incident.priority).label)}</b></div>
        <div class="row"><span>Trạng thái</span><b>${esc(statusMeta(incident.status).label)}</b></div>
        <div class="row"><span>Người báo</span><b>${esc(incident.reportedById || "—")}</b></div>
        <div class="row"><span>Thời điểm báo</span><b>${esc(fmtDateTime(incident.reportedAt))}</b></div>
      </div>
      <div class="modal-desc" style="margin-top:14px"><b>Mô tả:</b><br>${esc(incident.description)}</div>
      ${incident.notes ? `<div class="modal-desc" style="margin-top:8px"><b>Ghi chú:</b><br>${esc(incident.notes)}</div>` : ""}
      ${(incident.attachments || []).length ? `<div class="modal-desc" style="margin-top:8px"><b>Ảnh đính kèm:</b><br>${(incident.attachments || []).map((a) => esc(a.name)).join(", ")}</div>` : ""}`,
    confirmLabel: "Đóng",
    cancelLabel: ""
  });
}

init();



