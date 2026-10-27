/**
 * js/modules/operator/shift-incidents.js
 * Khung 04 — "Sự cố trong ca" (vai trò công nhân vận hành).
 *
 * Hiển thị danh sách sự cố đang mở trong ca hiện tại, hỗ trợ tìm kiếm,
 * lọc trạng thái, và đóng nhanh sự cố (demo).
 */

import { updateIncidentStatus } from "../shared/api.js";
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
  isOpenIncident,
  priorityMeta,
  statusMeta
} from "../shared/ui.js";

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
  allIncidents = state.incidents.filter(isOpenIncident);
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
      `${i.id} ${i.lineId} ${i.machineId} ${i.description}`.toLowerCase().includes(q);
    const matchesFilter = f === "all" || i.status === f;
    return matchesQuery && matchesFilter;
  });

  if (!rows.length) {
    bodyEl.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  bodyEl.innerHTML = rows
    .map(
      (i) => `
      <tr data-id="${esc(i.id)}">
        <td>${esc(i.id)}</td>
        <td>${esc(i.lineId)} / ${esc(i.machineId)}</td>
        <td>${esc(i.description)}</td>
        <td>${pill(priorityMeta(i.priority))}</td>
        <td>${pill(statusMeta(i.status))}</td>
        <td>
          <button type="button" class="btn danger" data-close="${esc(i.id)}">Đóng</button>
        </td>
      </tr>`
    )
    .join("");

  $$("[data-close]", bodyEl).forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.close;
      if (!confirm(`Đóng sự cố ${id}?`)) return;

      try {
        await updateIncidentStatus(id, "closed");
        toast(`Đã đóng ${id}`, { type: "success" });
        store.refresh();
      } catch (e) {
        toast(e.message || "Không đóng được sự cố.", { type: "error" });
      }
    };
  });
}

init();
