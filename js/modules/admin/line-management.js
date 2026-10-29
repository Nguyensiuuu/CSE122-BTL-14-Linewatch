/**
 * js/modules/admin/line-management.js
 * Khung 14 — "Quản lý dây chuyền" (vai trò quản trị viên).
 *
 * Trách nhiệm:
 *  - Liệt kê dây chuyền, lọc theo trạng thái (active/paused).
 *  - Tạo dây chuyền mới (nhập tên, trạng thái mặc định active).
 *  - Chuyển trạng thái active ⇄ paused.
 *  - Dùng getLines / createLine / updateLineStatus từ api.js.
 */

import { createLine, updateLineStatus } from "../shared/api.js";
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
  lineStatusMeta,
  openModal
} from "../shared/ui.js";

let bodyEl = null;
let searchEl = null;
let filterEl = null;
let allLines = [];

export function init() {
  bodyEl = $("#admin-line-table");
  searchEl = $("#line-search");
  filterEl = $("#line-status-filter");

  if (!bodyEl) return;

  renderShell(null);
  bodyEl.innerHTML = `<tr><td colspan="5">${skeletonBlocks(2)}</td></tr>`;

  store.subscribe(() => render(store.getState()));
  store.load().catch(() => {});

  const addBtn = $("#add-line");
  if (addBtn) addBtn.onclick = () => openAddModal();
}

function render(state) {
  if (state.status === "loading" || state.status === "idle") {
    bodyEl.innerHTML = `<tr><td colspan="5">${skeletonBlocks(2)}</td></tr>`;
    return;
  }

  if (state.status === "error") {
    showStateRow(bodyEl, 5, {
      kind: "error",
      title: "Không tải được dữ liệu",
      message: state.error?.message || "Vui lòng thử lại.",
      actionLabel: "Thử lại",
      onAction: () => store.load({ force: true })
    });
    return;
  }

  renderShell(state.session);
  allLines = [...state.lines];
  bindFilters();
  renderTable(state);
}

function bindFilters() {
  if (searchEl && !searchEl._bound) {
    searchEl.addEventListener("input", () => renderTable(store.getState()));
    searchEl._bound = true;
  }
  if (filterEl && !filterEl._bound) {
    filterEl.addEventListener("change", () => renderTable(store.getState()));
    filterEl._bound = true;
  }
}

function renderTable(state) {
  if (!bodyEl) return;

  const q = (searchEl?.value || "").toLowerCase().trim();
  const f = filterEl?.value || "all";

  const machines = state.machines || [];
  const rows = allLines.filter((line) => {
    const matchesQuery = !q || `${line.id} ${line.name}`.toLowerCase().includes(q);
    const matchesFilter = f === "all" || line.status === f;
    return matchesQuery && matchesFilter;
  });

  if (!rows.length) {
    showStateRow(bodyEl, 5, { kind: "empty", title: "Không tìm thấy dây chuyền nào" });
    return;
  }

  bodyEl.innerHTML = rows
    .map((line) => {
      const machineCount = machines.filter((m) => m.lineId === line.id).length;
      const meta = lineStatusMeta(line.status);
      const nextStatus = line.status === "active" ? "paused" : "active";
      const nextLabel = line.status === "active" ? "Tạm dừng" : "Kích hoạt";

      return `
        <tr data-id="${esc(line.id)}">
          <td><b>${esc(line.id)}</b></td>
          <td>${esc(line.name)}</td>
          <td>${machineCount}</td>
          <td>${pill(meta)}</td>
          <td class="cell-right">
            <button type="button" class="btn" data-toggle="${esc(line.id)}" data-next="${esc(nextStatus)}">${esc(nextLabel)}</button>
          </td>
        </tr>`;
    })
    .join("");

  $$("[data-toggle]", bodyEl).forEach((btn) => {
    btn.onclick = () => toggleStatus(btn.dataset.toggle, btn.dataset.next);
  });
}

function toggleStatus(lineId, nextStatus) {
  const line = allLines.find((l) => l.id === lineId);
  if (!line) return;

  const meta = lineStatusMeta(nextStatus);
  openModal({
    title: `Chuyển trạng thái ${lineId}?`,
    description: `Dây chuyền "${line.name}" sẽ chuyển sang trạng thái ${meta.label}.`,
    confirmLabel: "Xác nhận",
    onSubmit: async () => {
      const res = await updateLineStatus(lineId, nextStatus);
      if (!res.ok) return { ok: false, message: res.error?.message || "Không cập nhật được." };
      return { ok: true, data: res.data };
    }
  }).then((result) => {
    if (result.confirmed) {
      toast(`Đã cập nhật ${lineId}.`, { type: "success" });
      store.refresh();
    }
  });
}

function openAddModal() {
  openModal({
    title: "Thêm dây chuyền mới",
    body: `
      <div class="field">
        <label for="new-line-name">Tên dây chuyền</label>
        <input id="new-line-name" type="text" required autofocus placeholder="Ví dụ: Đóng gói A">
      </div>
      <div class="field">
        <label for="new-line-status">Trạng thái</label>
        <select id="new-line-status">
          <option value="active" selected>Đang hoạt động</option>
          <option value="paused">Tạm dừng</option>
        </select>
      </div>`,
    confirmLabel: "Thêm dây chuyền",
    onSubmit: async ({ form }) => {
      const name = form.querySelector("#new-line-name").value.trim();
      const status = form.querySelector("#new-line-status").value;
      if (!name) return { ok: false, message: "Nhập tên dây chuyền." };
      const res = await createLine({ name, status });
      if (!res.ok) return { ok: false, message: res.error?.message || "Không thêm được." };
      return { ok: true, data: res.data };
    }
  }).then((result) => {
    if (result.confirmed) {
      toast(`Đã thêm dây chuyền ${result.data.id}.`, { type: "success" });
      store.refresh();
    }
  });
}

init();
