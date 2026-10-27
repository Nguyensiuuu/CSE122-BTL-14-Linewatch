import {
  mountShell,
  snapshot,
  esc,
  hhmm,
  pill,
  PRI,
  STAT,
  errBox,
  skel,
} from "./layout.js";
import { OPEN } from "./incident-flow.js";

const root = document.getElementById("view");

// ==========================================
// 1. HÀM RENDER TRANG TỔNG QUAN CA (DASHBOARD)
// ==========================================
async function render() {
  // Hiển thị khung chờ xương cá (skeleton) khi chưa tải xong dữ liệu
  root.innerHTML = skel(4);
  const s = await snapshot();

  if (s.error) {
    root.innerHTML = errBox(s.error);
    return;
  }

  // --- LỌC VÀ XỬ LÝ DỮ LIỆU ---
  const cur = s.incidents.filter((i) => i.shiftId === s.shift.id);
  const open = cur.filter((i) => OPEN.includes(i.status));

  const asg = open.filter((i) =>
    ["assigned", "in_progress"].includes(i.status),
  );
  const prog = open.filter((i) => i.status === "in_progress");

  const paused = s.lines.filter((l) => l.status === "paused");
  const back = s.incidents.filter(
    (i) => i.shiftId !== s.shift.id && OPEN.includes(i.status),
  );

  // Tính toán biểu đồ nhịp sự cố theo thời gian trong ca
  const t0 = new Date(s.shift.startsAt).getTime();
  const span = new Date(s.shift.endsAt) - t0;
  const N = 12; // Chia làm 12 cột mốc thời gian
  const b = Array.from({ length: N }, () => []);

  cur.forEach((i) => {
    const k = Math.min(
      N - 1,
      Math.max(0, Math.floor(((new Date(i.reportedAt) - t0) / span) * N)),
    );
    b[k].push(i);
  });

  const mx = Math.max(1, ...b.map((x) => x.length));

  // Lấy tối đa 3 sự cố cần chú ý nhất (sắp xếp theo độ ưu tiên: cao -> trung bình -> thấp, sau đó theo thời gian)
  const att = [...open]
    .sort(
      (a, c) =>
        "high,medium,low".indexOf(a.priority) -
          "high,medium,low".indexOf(c.priority) ||
        a.reportedAt.localeCompare(c.reportedAt),
    )
    .slice(0, 3);

  // --- DỰNG CẤU TRÚC HTML GIAO DIỆN ---
  root.innerHTML = `
    <h1>${esc(s.shift.name)} · Xưởng 01</h1>
    <p class="sub">Tập trung vào sự cố, công việc bảo trì và việc còn tồn</p>
    
    <!-- Các thẻ chỉ số KPI -->
    <div class="kpis">
      <div class="kpi red">
        <small>Sự cố đang mở</small>
        <strong>${open.length}</strong>
        <span>${open.filter((i) => i.priority === "high").length} ưu tiên cao</span>
      </div>
      <div class="kpi slate">
        <small>Đã phân công</small>
        <strong>${asg.length}</strong>
        <span>${prog.length} đang xử lý</span>
      </div>
      <div class="kpi amber">
        <small>Dây chuyền dừng</small>
        <strong>${paused.length}</strong>
        <span>${paused.length ? paused.map((l) => l.id + " · " + esc(l.name)).join(", ") : "Không có"}</span>
      </div>
      <div class="kpi">
        <small>Việc còn tồn</small>
        <strong>${back.length}</strong>
        <span>Từ ca trước</span>
      </div>
    </div>

    <!-- Lưới nội dung (Biểu đồ & Việc tồn từ ca trước) -->
    <div class="sd-grid">
      <!-- Biểu đồ nhịp sự cố -->
      <section class="card">
        <h2>Nhịp sự cố theo thời gian</h2>
        ${
          cur.length
            ? `<div class="chart" role="img" aria-label="Số sự cố theo khung giờ của ca">
               ${b.map((x, k) => `<i class="${!x.length ? "z" : x.some((i) => i.priority === "high") ? "h" : x.some((i) => i.priority === "medium") ? "m" : ""}" style="height:${x.length ? 30 + (x.length / mx) * 45 : 4}%" title="${x.length} sự cố"></i>`).join("")}
             </div>
             <div class="axis">
               <span>${hhmm(s.shift.startsAt)}</span>
               <span>${hhmm(s.shift.endsAt)}</span>
             </div>`
            : '<div class="state">Chưa có sự cố trong ca này.</div>'
        }
      </section>

      <!-- Danh sách việc tồn từ ca trước -->
      <section class="card">
        <h2>Việc còn tồn từ ca trước</h2>
        ${
          back.length
            ? back
                .map(
                  (i) =>
                    `<div class="li">${pill(PRI[i.priority], 1)}<a href="supervisor-incident-board.html?shiftId=${encodeURIComponent(i.shiftId)}">${esc(i.machineId)} · ${esc(i.title)} → Mở ca này</a></div>`,
                )
                .join("")
            : '<div class="state">Không có việc tồn.</div>'
        }
      </section>
    </div>

    <!-- Bảng sự cố cần chú ý -->
    <section class="card att-card">
      <h2>Sự cố cần chú ý</h2>
      ${
        att.length
          ? att
              .map(
                (i) =>
                  `<div class="att"><b>${i.id}</b><span>${i.machineId} · ${esc(i.title)}</span>${pill(PRI[i.priority])}${pill(STAT[i.status])}<span>${esc(s.uname(i.assignedToId) || (i.status === "new" ? "-" : "Chưa phân công"))}</span></div>`,
              )
              .join("")
          : '<div class="state">Không có sự cố nào cần chú ý.</div>'
      }
    </section>`;
}

// ==========================================
// 2. KHỞI CHẠY ỨNG DỤNG VÀ LẮNG NGHE SỰ KIỆN
// ==========================================
if (await mountShell()) {
  render();
  // Lắng nghe sự kiện thay đổi dữ liệu để tự động vẽ lại giao diện
  window.addEventListener("linewatch:data-changed", render);

  // Xử lý sự kiện bấm nút thử lại khi có lỗi tải dữ liệu
  root.addEventListener(
    "click",
    (e) => e.target.dataset.retry !== undefined && render(),
  );
}
