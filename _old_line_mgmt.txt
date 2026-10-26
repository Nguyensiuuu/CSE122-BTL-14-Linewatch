/**
 * js/modules/admin/line-management.js
 * Khung 14/22 — "Quản lý dây chuyền" (vai trò admin).
 *
 * Hiển thị bảng dây chuyền, cho phép lọc, thêm mới (demo) và đổi trạng thái.
 */

import { updateLineStatus, createLine } from "../shared/api.js";
import { store } from "../shared/store.js";
import {
  $,
  $$,
  esc,
  pill,
  toast,
  showStateRow,
  skeletonBlocks,
  renderShell
} from "../shared/ui.js";

let tableBody = null;
let searchEl = null;
let statusFilter = null;
let addBtn = null;
let linesCache = [];

export function init() {
  tableBody = $("#admin-line-table");
  searchEl = $("#line-search");
  statusFilter = $("#line-status-filter");
  addBtn = $("#add-line");

  if (!tableBody) return;

  renderShell(null);
  tableBody.innerHTML = `<tr><td colspan="5">${skeletonBlocks(3)}</td></tr>`;

  store.subscribe(() => render(store.getState()));
  store
    .load()
    .then(() => {})
    .catch(() => {});
}

function render(state) {
  if (state.status === "loading" || state.status === "idle") {
    tableBody.innerHTML = `<tr><td colspan="5">${skeletonBlocks(3)}</td></tr>`;
    return;
  }

  if (state.status === "error") {
    showStateRow(tableBody, 5, {
      kind: "error",
      title: "Không tải được danh sách dây chuyền",
      message: state.error?.message || "Vui lòng thử lại.",
      actionLabel: "Thử lại",
      onAction: () => store.load({ force: true })
    });
    return;
  }

  renderShell(state.session);
  linesCache = state.lines;
  bindFilters();
  renderTable();
}

function bindFilters() {
  if (searchEl && !searchEl._bound) {
    searchEl.addEventListener("input", renderTable);
    searchEl._bound = true;
  }
  if (statusFilter && !statusFilter._bound) {
    statusFilter.addEventListener("change", renderTable);
    statusFilter._bound = true;
  }
  if (addBtn && !addBtn._bound) {
    addBtn.onclick = handleAddLine;
    addBtn._bound = true;
  }
}

function renderTable() {
  if (!tableBody) return;

  const q = (searchEl?.value || "").toLowerCase().trim();
  const f = statusFilter?.value || "all";

  const rows = linesCache.filter((l) => {
    const matchesQ = !q || `${l.id} ${l.name}`.toLowerCase().includes(q);
    const matchesF = f === "all" || l.status === f;
    return matchesQ && matchesF;
  });

  tableBody.innerHTML = rows
    .map(
      (l) => `
      <tr>
        <td>${esc(l.id)}</td>
        <td>${esc(l.name)}</td>
        <td>${l.machines ?? 0}</td>
        <td>${pill({ label: l.status, cls: l.status === "running" ? "ok" : l.status === "warning" ? "warn" : "danger" })}</td>
        <td>
          <button type="button" class="btn" data-edit="${esc(l.id)}">Đổi trạng thái</button>
        </td>
      </tr>`
    )
    .join("");

  $$("[data-edit]", tableBody).forEach((btn) => {
    btn.onclick = () => handleEditStatus(btn.dataset.edit);
  });
}

async function handleEditStatus(lineId) {
  const line = linesCache.find((x) => x.id === lineId);
  if (!line) return;

  const newStatus = prompt(
    `Trạng thái mới cho ${lineId} (running / warning / stopped):`,
    line.status
  );
  if (!["running", "warning", "stopped"].includes(newStatus)) return;

  try {
    await updateLineStatus(lineId, newStatus);
    toast(`Đã cập nhật ${lineId}`, { type: "success" });
    store.refresh();
  } catch (e) {
    toast(e.message || "Không cập nhật được.", { type: "error" });
  }
}

async function handleAddLine() {
  const id = prompt("Mã dây chuyền mới:");
  if (!id) return;
  const name = prompt("Tên dây chuyền:");
  if (!name) return;

  try {
    await createLine({ id: id.toUpperCase(), name, status: "running" });
    toast(`Đã thêm ${id}`, { type: "success" });
    store.refresh();
  } catch (e) {
    toast(e.message || "Không thêm được dây chuyền.", { type: "error" });
  }
}

init();
