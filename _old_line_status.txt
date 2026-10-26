/**
 * js/modules/operator/line-status.js
 * Khung 02 — "Trạng thái dây chuyền" (vai trò công nhân vận hành).
 *
 * Trách nhiệm của khung:
 *  - Hiển thị KPI: số dây chuyền đang chạy, số máy cảnh báo, số sự cố đang mở.
 *  - Vẽ sơ đồ dây chuyền → máy, đánh dấu máy đang có sự cố.
 *  - Có trạng thái đang tải (skeleton), trạng thái lỗi (thử lại) và trạng thái rỗng.
 *  - Bấm vào một máy sẽ chuyển sang khung 03 kèm sẵn dây chuyền + máy.
 *
 * Toàn bộ dữ liệu đi qua shared/store.js và shared/api.js, không đọc trực tiếp.
 */

import { store } from "../shared/store.js";
import { takeFlash } from "../shared/api.js";
import {
  $,
  $$,
  esc,
  pill,
  toast,
  showState,
  skeletonBlocks,
  renderShell,
  isOpenIncident
} from "../shared/ui.js";

const LINE_STATUS = {
  running: { label: "Đang chạy", cls: "" },
  warning: { label: "Cảnh báo", cls: "warn" },
  stopped: { label: "Đã dừng", cls: "danger" }
};

const MACHINE_STATUS = {
  running: { label: "Ổn định", cls: "normal" },
  warning: { label: "Cần quan sát", cls: "warning" },
  stopped: { label: "Đã dừng", cls: "incident" }
};

let listEl = null;


export function init() {
  listEl = $("#line-list");
  if (!listEl) return;

  renderShell(null);
  listEl.innerHTML = `<div class="skeleton-wrap">${skeletonBlocks(3)}</div>`;

  store.subscribe(() => render(store.getState()));

  store
    .load()
    .then(() => {
      const flash = takeFlash();
      if (flash?.message) toast(flash.message, { type: flash.type });
    })
    .catch(() => {
      /* lỗi đã được vẽ trong render() theo state.error */
    });
}

function render(state) {
  if (state.status === "loading" || state.status === "idle") {
    listEl.innerHTML = `<div class="skeleton-wrap">${skeletonBlocks(state.lines?.length || 3)}</div>`;
    return;
  }

  if (state.status === "error") {
    showState(listEl, {
      kind: "error",
      title: "Không tải được dữ liệu dây chuyền",
      message: `${state.error?.message || "Vui lòng thử lại."} Nếu đang mở trực tiếp bằng file://, hãy dùng Live Server.`,
      actionLabel: "Thử lại",
      onAction: () => {
        store.load({ force: true }).catch(() => {});
      }
    });
    return;
  }

  renderShell(state.session);
  renderKpis(state);
  renderLines(state);
}

/* ------------------------------ KPI ------------------------------ */

function renderKpis(state) {
  const { lines, machines, incidents } = state;
  const running = lines.filter((line) => line.status === "running");
  const warningMachines = machines.filter((machine) => machine.status === "warning");
  const openIncidents = incidents.filter(isOpenIncident);
  const highPriority = openIncidents.filter((incident) => incident.priority === "high");

  const runningEl = $("#running-count");
  if (runningEl) runningEl.textContent = `${running.length} / ${lines.length}`;
  setNote(runningEl, running.length ? `${running.map((l) => l.id).join(", ")} ổn định` : "Chưa có dây chuyền nào đang chạy");

  const warningEl = $("#warning-count");
  if (warningEl) warningEl.textContent = String(warningMachines.length);
  setNote(
    warningEl,
    warningMachines.length
      ? `${warningMachines.slice(0, 3).map((m) => m.id).join(", ")}${warningMachines.length > 3 ? "…" : ""}`
      : "Không có máy nào cần theo dõi"
  );

  const incidentEl = $("#incident-count");
  if (incidentEl) incidentEl.textContent = String(openIncidents.length);
  setNote(
    incidentEl,
    highPriority.length ? `${highPriority.length} sự cố ưu tiên cao cần xem` : "Không có sự cố ưu tiên cao"
  );
}

function setNote(el, text) {
  const note = el?.closest(".stat")?.querySelector("small");
  if (note && text) note.textContent = text;
}

/* ------------------------------ Sơ đồ dây chuyền ------------------------------ */

function renderLines(state) {
  const { lines, machines, incidents } = state;

  if (!lines.length) {
    showState(listEl, {
      kind: "empty",
      title: "Chưa có dây chuyền nào",
      message: "Chưa có dây chuyền nào được cấu hình trong hệ thống."
    });
    return;
  }

  const html = lines
    .map((line) => {
      const lineMachines = machines.filter((machine) => machine.lineId === line.id);
      const lineIncidents = incidents.filter((incident) => incident.lineId === line.id && isOpenIncident(incident));
      const meta = LINE_STATUS[line.status] || { label: line.status || "Chưa rõ", cls: "" };

      return `
        <div class="line-block">
          <div class="line-label">
            <b>${esc(line.id)} · ${esc(line.name)}</b>
            <span class="sub">${lineMachines.length} máy · ${lineIncidents.length} sự cố đang mở</span>
            <span class="sub">${pill(meta)}</span>
          </div>
          <div class="machine-grid">
            ${
              lineMachines.map((machine) => machineCard(machine, lineIncidents)).join("") ||
              '<p class="machine-meta">Dây chuyền chưa được gán máy.</p>'
            }
          </div>
        </div>`;
    })
    .join("");

  listEl.innerHTML = `${html}${legend()}`;

  $$(".machine-card", listEl).forEach((card) => {
    card.addEventListener("click", () => {
      const params = new URLSearchParams({ lineId: card.dataset.lineId, machineId: card.dataset.machineId });
      window.location.href = `operator-incident-create.html?${params.toString()}`;
    });
  });
}

function machineCard(machine, lineIncidents) {
  const incident = lineIncidents.find((item) => item.machineId === machine.id);
  const kind = incident ? "incident" : machine.status;
  const meta = incident
    ? { label: "Đang có sự cố", cls: "incident" }
    : MACHINE_STATUS[kind] || { label: machine.status || "Chưa rõ", cls: "normal" };

  // Thẻ máy là một nút: bấm bất kỳ đâu trên thẻ cũng mở khung báo sự cố.
  // Vì vậy không cần dòng chữ "Báo sự cố cho máy này" chiếm chỗ — chỉ để huy hiệu ＋ ở góc thẻ.
  return `
    <button type="button" class="machine-card ${esc(kind)}" data-line-id="${esc(machine.lineId)}"
      data-machine-id="${esc(machine.id)}" title="Báo sự cố cho máy ${esc(machine.id)}"
      aria-label="Báo sự cố cho máy ${esc(machine.id)}">
      <span class="machine-add" aria-hidden="true">＋</span>
      <b>${esc(machine.id)}</b>
      <small>${esc(machine.name)}</small>
      <span class="state ${esc(meta.cls)}">${esc(meta.label)}</span>
      ${incident ? `<small class="machine-inc">${esc(incident.id)}</small>` : ""}
    </button>`;
}

function legend() {
  return `
    <div class="legend">
      <span class="item"><span class="dot normal"></span> Ổn định</span>
      <span class="item"><span class="dot warning"></span> Cần quan sát</span>
      <span class="item"><span class="dot incident"></span> Đang có sự cố</span>
    </div>`;
}

init();