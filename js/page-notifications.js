// Khung 21: trang thông báo độc lập — danh sách, lọc, đánh dấu đọc.
import {
  mountShell,
  esc,
  hhmm,
  pill,
  PRI,
  STAT,
  errBox,
  skel,
  toast,
} from "./layout.js";
import { getNotifications, markNotificationsRead } from "./api.js";

const root = document.getElementById("view");
let N = [],
  f = "all",
  err = null;

async function load() {
  root.innerHTML = skel(5);
  const r = await getNotifications();
  err = r.ok ? null : r.error.message;
  if (r.ok) N = r.data;
  draw();
}

function draw() {
  if (err) {
    root.innerHTML = errBox(err);
    return;
  }
  const un = N.filter((n) => !n.read);
  const hi = N.filter((n) => n.priority === "high");
  const L = f === "unread" ? un : f === "high" ? hi : N;

  root.innerHTML = `
    <h1>Thông báo</h1>
    <p class="sub">${N.length} thông báo trong ca · ${un.length} chưa đọc. Ưu tiên việc cần xử lý trước.</p>
    <div class="nt-f" role="group" aria-label="Bộ lọc thông báo">
      ${[
        ["all", "Tất cả", N.length],
        ["unread", "Chưa đọc", un.length],
        ["high", "Ưu tiên cao", hi.length],
      ]
        .map(
          ([k, t, n]) =>
            `<button class="btn" data-f="${k}" aria-pressed="${f === k}">${t} ${n}</button>`,
        )
        .join("")}
      <button class="btn" data-all${un.length ? "" : " disabled"}>Đánh dấu tất cả đã đọc</button>
    </div>
    ${
      L.length
        ? `<div class="nt-l">${L.map(
            (n) =>
              `<div class="nt-i${n.read ? "" : " un"}"><b>${n.incidentId}</b><span>${n.machineId} · ${esc(n.title)}</span>${pill(PRI[n.priority])}${pill(STAT[n.status])}<time>${hhmm(n.at)}</time></div>`,
          ).join("")}</div>`
        : `<div class="empty"><h3>${!N.length ? "Chưa có thông báo" : f === "high" ? "Không có thông báo ưu tiên cao" : "Đã theo dõi hết thông báo"}</h3><p>${
            f === "unread" || !N.length
              ? "Không có thông báo chưa đọc. Bạn có thể quay lại bảng điều phối để tiếp tục theo dõi ca."
              : "Hiện chưa có thông báo nào trong bộ lọc này."
          }</p>${f !== "all" ? '<a href="#" data-f="all">Xem tất cả thông báo →</a>' : ""}</div>`
    }`;
}

root.addEventListener("click", async (e) => {
  if (e.target.dataset.retry !== undefined) return load();
  const b = e.target.closest("[data-f]");
  if (b) {
    e.preventDefault();
    f = b.dataset.f;
    return draw();
  }
  if (e.target.matches("[data-all]")) {
    const r = await markNotificationsRead();
    toast(r.ok ? "Đã đánh dấu tất cả đã đọc" : r.error.message, r.ok ? "ok" : "err");
  }
});

if (await mountShell()) {
  load();
  window.addEventListener("linewatch:data-changed", load);
}
