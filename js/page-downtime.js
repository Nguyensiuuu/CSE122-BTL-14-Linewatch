import {
  mountShell,
  snapshot,
  esc,
  dmy,
  hhmm,
  errBox,
  skel,
  toast,
} from "./layout.js";
import { downtimeMinutes } from "./reports.js";
import { saveReport, getReports } from "./api.js";

const root = document.getElementById("view");
const dlg = document.getElementById("dlg");

// Hàm lấy định dạng ngày (YYYY-MM-DD) từ chuỗi ISO
const day = (iso) => iso.slice(0, 10);
// Trạng thái của báo cáo
const RS = { draft: "Bản nháp", ready: "Sẵn sàng", archived: "Đã lưu trữ" };

let S,
  R = [],
  F = { date: "", shiftId: "", line: "" },
  editId = null,
  inc = false;

// ==========================================
// 1. TẢI DỮ LIỆU BAN ĐẦU (LOAD)
// ==========================================
async function load() {
  root.innerHTML = skel(4);
  S = await snapshot();
  const r = await getReports();

  if (S.error || !r.ok) {
    root.innerHTML = errBox(S.error || r.error.message);
    return;
  }

  R = r.data;
  if (!F.date) {
    F.date = day(S.shift.startsAt);
    F.shiftId = S.shift.id;
  }
  draw();
}

// ==========================================
// 2. TÍNH TOÁN DỮ LIỆU BÁO CÁO (CALCULATE)
// ==========================================
function calc() {
  const sh = S.shifts.filter((s) => day(s.startsAt) === F.date);
  const shift = sh.find((s) => s.id === F.shiftId) || sh[0];

  const list = shift
    ? S.incidents.filter(
        (i) =>
          i.shiftId === shift.id &&
          (!F.line || i.lineId === F.line) &&
          downtimeMinutes(i) != null,
      )
    : [];

  // Tổng hợp thời gian dừng theo máy (machineId)
  const by = {};
  list.forEach(
    (i) => (by[i.machineId] = (by[i.machineId] || 0) + downtimeMinutes(i)),
  );
  const bm = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const tot = bm.reduce((a, x) => a + x[1], 0);

  // Tổng hợp thời gian dừng theo dây chuyền (lineId)
  const bl = {};
  list.forEach(
    (i) => (bl[i.lineId] = (bl[i.lineId] || 0) + downtimeMinutes(i)),
  );

  return {
    sh,
    shift,
    list,
    bm,
    tot,
    topLine: Object.entries(bl).sort((a, b) => b[1] - a[1])[0],
    nl: Object.keys(bl).length,
  };
}

// ==========================================
// 3. VẼ GIAO DIỆN (DRAW)
// ==========================================
function draw() {
  const c = calc();
  const top = c.bm[0];
  const ids = c.list.map((i) => i.id);

  const ai3 =
    top &&
    S.tasks.find(
      (t) =>
        t.ai3 &&
        S.incidents.find((i) => i.id === t.incidentId)?.machineId === top[0],
    );

  root.innerHTML = `
    <h1>Báo cáo thời gian dừng máy</h1>
    <p class="sub">Tổng hợp theo dây chuyền, máy và nguyên nhân</p>
    
    <!-- Form bộ lọc và nút thao tác -->
    <form class="card dr-f" id="f">
      <input type="date" id="d" value="${F.date}" aria-label="Ngày">
      <select id="s" aria-label="Ca">
        ${c.sh.map((s) => `<option value="${s.id}"${s.id === c.shift?.id ? " selected" : ""}>${esc(s.name)}</option>`).join("") || "<option>Không có ca</option>"}
      </select>
      <select id="l" aria-label="Dây chuyền">
        <option value="">Tất cả dây chuyền</option>
        ${S.lines.map((l) => `<option value="${l.id}"${l.id === F.line ? " selected" : ""}>${l.id} · ${esc(l.name)}</option>`).join("")}
      </select>
      <button class="btn" type="button" id="csv"${ids.length ? "" : " disabled"}>Xuất CSV</button>
      <button class="btn pri" type="submit"${c.shift ? "" : " disabled"}>${editId ? "Cập nhật báo cáo" : "Tạo báo cáo"}</button>
    </form>

    ${
      !c.shift
        ? '<div class="card state">Không có ca nào trong ngày đã chọn.</div>'
        : !ids.length
          ? '<div class="card state">Không có sự cố nào có mốc dừng/chạy lại hợp lệ trong bộ lọc này.</div>'
          : `
      <!-- Các chỉ số KPI -->
      <div class="kpis">
        <div class="kpi">
          <small>Tổng thời gian dừng</small>
          <strong>${c.tot} phút</strong>
          <span>Từ mốc dừng/chạy lại hợp lệ</span>
        </div>
        <div class="kpi red">
          <small>Sự cố gây dừng</small>
          <strong>${ids.length}</strong>
          <span>${c.list.filter((i) => i.priority === "high").length} ưu tiên cao</span>
        </div>
        <div class="kpi amber">
          <small>Dây chuyền ảnh hưởng</small>
          <strong>${c.nl} / ${S.lines.length}</strong>
          <span>${c.topLine ? c.topLine[0] + " cao nhất" : ""}</span>
        </div>
        <div class="kpi slate">
          <small>Thời gian dừng TB</small>
          <strong>${Math.round(c.tot / ids.length)} phút</strong>
          <span>Mỗi sự cố</span>
        </div>
      </div>

      <!-- Biểu đồ phân tích và Nhận định AI -->
      <div class="dr-g">
        <section class="card">
          <h3>Thời gian dừng theo máy</h3>
          ${c.bm.map(([m, v], k) => `<div class="bar"><span>${m}</span><div><i class="${k === 0 ? "r" : k < 3 ? "a" : ""}" style="width:${(v / c.bm[0][1]) * 100}%"></i></div><b>${v} phút</b></div>`).join("")}
        </section>
        
        <aside class="card ai">
          <h3>Nhận định hỗ trợ</h3>
          <p><b>${top[0]} chiếm ${Math.round((top[1] / c.tot) * 100)}% thời gian dừng của ca.</b></p>
          <p>${ai3 ? esc(ai3.ai3.suggestion?.pattern || ai3.ai3.reason || "Có kết quả AI-3 đã lưu.") : "Chưa có kết quả AI-3 đã lưu cho máy này (báo cáo chỉ đọc kết quả đã lưu)."}</p>
          <small>Đề xuất báo cáo</small>
          <ul>
            <li>Ưu tiên kiểm tra ${top[0]}</li>
            ${c.bm[1] ? `<li>Theo dõi ${c.bm[1][0]} trong ca tiếp theo</li>` : ""}
          </ul>
          <div class="acts">
            <button class="btn" id="inc" aria-pressed="${inc}">${inc ? "✓ Đã đưa vào báo cáo" : "Đưa vào báo cáo"}</button>
          </div>
        </aside>
      </div>`
    }

    <!-- Danh sách báo cáo đã lưu -->
    <section class="card saved">
      <h3>Báo cáo đã lưu</h3>
      ${
        R.length
          ? R.map(
              (r) => `
        <div class="row">
          <strong>${r.id} · Downtime ${esc((S.shifts.find((s) => s.id === r.shiftId) || {}).name || r.shiftId)} · ${RS[r.status]}</strong>
          <span class="sub" style="margin:0">${r.totalDowntimeMinutes} phút</span>
          <button class="btn link" data-v="${r.id}">Xem</button>
          ${r.status === "archived" ? "" : `<button class="btn link" data-e="${r.id}">Sửa bộ lọc</button><button class="btn danger" data-x="${r.id}">Lưu trữ</button>`}
        </div>`,
            ).join("")
          : '<div class="state">Chưa có báo cáo nào được lưu.</div>'
      }
      <p class="sub">Xuất CSV là thao tác riêng; lưu bộ lọc và phiên bản báo cáo để tái kiểm tra.</p>
    </section>`;
}

// ==========================================
// 4. XỬ LÝ XUẤT CSV
// ==========================================
const csv = (c) => {
  const rows = [
    ["id", "machineId", "lineId", "priority", "downtimeMinutes"],
    ...c.list.map((i) => [
      i.id,
      i.machineId,
      i.lineId,
      i.priority,
      downtimeMinutes(i),
    ]),
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + rows.map((r) => r.join(",")).join("\n")], {
      type: "text/csv",
    }),
  );
  a.download = `downtime-${c.shift.id}.csv`;
  a.click();
};

// ==========================================
// 5. LẮNG NGHE SỰ KIỆN (EVENTS)
// ==========================================
root.addEventListener("change", (e) => {
  const i = e.target.id;
  if (i === "d") {
    F.date = e.target.value;
    F.shiftId = "";
  }
  if (i === "s") F.shiftId = e.target.value;
  if (i === "l") F.line = e.target.value;
  if (i) draw();
});

root.addEventListener("submit", async (e) => {
  e.preventDefault();
  const c = calc();
  if (!c.shift) return;

  const r = await saveReport({
    id: editId || undefined,
    shiftId: c.shift.id,
    from: c.shift.startsAt,
    to: c.shift.endsAt,
    incidentIds: c.list.map((i) => i.id),
    status: "draft",
  });

  toast(r.ok ? `Đã lưu ${r.data.id}` : r.error.message, r.ok ? "ok" : "err");
  if (r.ok) editId = null;
});

root.addEventListener("click", async (e) => {
  const d = e.target.dataset;
  if (d.retry !== undefined) return load();
  if (e.target.id === "csv") return csv(calc());
  if (e.target.id === "inc") {
    inc = !inc;
    return draw();
  }

  // Sửa bộ lọc báo cáo
  if (d.e) {
    const r = R.find((x) => x.id === d.e);
    editId = r.id;
    F.date = day(r.from);
    F.shiftId = r.shiftId;
    return draw();
  }

  // Lưu trữ báo cáo
  if (d.x) {
    const r = R.find((x) => x.id === d.x);
    const s = await saveReport({ ...r, status: "archived" });
    return toast(
      s.ok ? `Đã lưu trữ ${r.id}` : s.error.message,
      s.ok ? "ok" : "err",
    );
  }

  // Xem chi tiết báo cáo qua Dialog
  if (d.v) {
    const r = R.find((x) => x.id === d.v);
    dlg.querySelector("div").innerHTML = `
      <h3>${r.id}</h3>
      <p>${RS[r.status]} · ${r.totalDowntimeMinutes} phút · ${r.incidentIds.length} sự cố</p>
      <ul>${r.incidentIds.map((i) => `<li>${i} · ${esc((S.incidents.find((x) => x.id === i) || {}).title || "")}</li>`).join("")}</ul>`;
    dlg.showModal();
  }
});

// ==========================================
// 6. KHỞI CHẠY ỨNG DỤNG
// ==========================================
if (await mountShell()) {
  load();
  window.addEventListener("linewatch:data-changed", load);
}
