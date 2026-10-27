/**
 * Khung chung cho các trang của Sơn: sidebar, topbar, guard phiên/vai trò,
 * định dạng và thông báo nhanh.
 *
 * Phiên và theme dùng module chung của Nguyên nếu có (js/auth.js, js/theme.js);
 * thiếu file thì fallback nội bộ, KHÔNG tự đăng nhập và KHÔNG tạo file chung.
 */

import {
  getCurrentUser,
  getNotifications,
  getLines,
  getMachines,
  getIncidents,
  getUsers,
  getShifts,
  getTasks,
} from "./api.js";
import { resolveShift } from "./incident-flow.js";

const THEME_KEY = "linewatch-theme";
const tz = { timeZone: "Asia/Ho_Chi_Minh" };

// Ưu tiên bản Nguyên; vắng mặt thì đọc cùng khóa/phiên mà không tự login.
async function loadShared() {
  let theme = null;
  let auth = null;
  try {
    theme = await import("./theme.js");
  } catch {
    /* bản chung chưa ghép */
  }
  try {
    auth = await import("./auth.js");
  } catch {
    /* bản chung chưa ghép */
  }
  return {
    applyTheme() {
      if (theme?.applyTheme) return theme.applyTheme();
      document.documentElement.dataset.theme =
        localStorage.getItem(THEME_KEY) || "light";
    },
    toggleTheme() {
      if (theme?.toggleTheme) return theme.toggleTheme();
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    },
    async currentUser() {
      const fn = auth?.getCurrentUser || getCurrentUser;
      const r = await fn();
      if (!r) return null;
      if (Object.prototype.hasOwnProperty.call(r, "data")) return r.data || null;
      return r.id ? r : null;
    },
    loginHref: () => "../index.html",
  };
}

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const hhmm = (i) =>
  i
    ? new Date(i).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        ...tz,
      })
    : "—";

export const dmy = (i) =>
  new Date(i).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...tz,
  });

export const ago = (i) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(i)) / 6e4));
  return m < 60
    ? `${m} phút`
    : m < 1440
      ? `${Math.floor(m / 60)} giờ`
      : `${Math.floor(m / 1440)} ngày`;
};

export const PRI = {
  high: ["Cao", "p-high"],
  medium: ["Trung bình", "p-med"],
  low: ["Thấp", "p-low"],
};

export const STAT = {
  new: ["Mới ghi nhận", "s-new"],
  accepted: ["Đã tiếp nhận", "s-acc"],
  assigned: ["Đã phân công", "s-asg"],
  in_progress: ["Đang xử lý", "s-prog"],
  resolved: ["Đã xử lý", "s-res"],
  closed: ["Hoàn thành", "s-done"],
  cancelled: ["Đã hủy", "p-low"],
};

export const pill = (x, short) =>
  `<span class="pill ${x[1]}">${short && x[0] === "Trung bình" ? "TB" : x[0]}</span>`;

const NAV = {
  supervisor: [
    ["dashboard", "supervisor-shift-dashboard.html", "Tổng quan ca"],
    ["board", "supervisor-incident-board.html", "Bảng điều phối"],
    ["handover", "supervisor-handover-note.html", "Bản giao ca"],
  ],
  admin: [
    ["machines", "admin-machine-management.html", "Danh mục máy"],
    [
      "lines",
      "admin-line-management.html",
      "Quản lý dây chuyền",
      "Thắng · khung 12",
    ],
    ["downtime", "admin-downtime-report.html", "Báo cáo dừng máy"],
  ],
};

export function toast(msg, type = "ok") {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.append(t);
  }
  t.className = "toast " + type;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.hidden = true), 3800);
}

export async function mountShell() {
  const b = document.body;
  const { role = "", active } = b.dataset;
  const main = document.getElementById("main");
  const shared = await loadShared();
  shared.applyTheme();

  const u = await shared.currentUser();
  if (!u) {
    location.replace(shared.loginHref());
    return null;
  }

  const allowed = role
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(u.role)) {
    location.replace("403.html");
    return null;
  }
  const navRole = NAV[u.role] ? u.role : "supervisor";
  const roleLabel =
    {
      admin: "Quản trị viên",
      supervisor: "Trưởng ca",
      operator: "Công nhân vận hành",
      maintenance: "Kỹ thuật bảo trì",
    }[u.role] || "Trưởng ca";

  const sh = await getShifts();
  const info = sh.ok
    ? resolveShift({ shifts: sh.data })
    : { shift: null, demo: false };
  const s = info.shift;
  const nt = await getNotifications();
  const unread = nt.ok ? nt.data.filter((n) => !n.read).length : 0;
  const ini = u.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dark = document.documentElement.dataset.theme === "dark";

  const w = document.createElement("div");
  w.className = "shell";
  w.innerHTML = `
        <a class="skip" href="#main">Bỏ qua điều hướng</a>
        <aside class="side">
            <div class="brand">LINEWATCH</div>
            <div class="tag">Theo dõi ca sản xuất</div>
            <span class="role">${roleLabel}</span>
            <nav aria-label="Điều hướng chính">
                ${NAV[navRole].map(([k, h, l, o]) => `<a href="${h}"${o ? ` data-ext="${o}"` : ""}${k === active ? ` aria-current="page" class="on"` : ""}>${l}</a>`).join("")}
            </nav>
            <div class="cur">
                <small>${info.demo ? "Ca demo được chọn" : "Ca hiện tại"}</small>
                <strong>${s ? `${esc(s.name)} · ${hhmm(s.startsAt)}–${hhmm(s.endsAt)}` : "—"}</strong>
                <small>Tổ A · Xưởng 01</small>
            </div>
        </aside>
        <div class="col">
            <header class="top">
                <h2>${esc(b.dataset.title)}</h2>
                <span class="date">${s ? dmy(s.startsAt) : ""}</span>
                <button type="button" class="btn" data-theme-toggle aria-label="Đổi giao diện sáng/tối">${dark ? "Sáng" : "Tối"}</button>
                <a class="bell" id="bell" href="notifications.html" aria-label="${unread} thông báo chưa đọc">${unread}</a>
                <span class="user"><b>${esc(ini)}</b> ${esc(u.name)}</span>
            </header>
        </div>`;

  b.prepend(w);
  w.querySelector(".col").append(main);

  w.querySelector("[data-theme-toggle]").addEventListener("click", () => {
    shared.toggleTheme();
    w.querySelector("[data-theme-toggle]").textContent =
      document.documentElement.dataset.theme === "dark" ? "Sáng" : "Tối";
  });

  window.addEventListener("linewatch:data-changed", async () => {
    const r = await getNotifications();
    const un = r.ok ? r.data.filter((n) => !n.read).length : 0;
    const bell = w.querySelector("#bell");
    bell.textContent = un;
    bell.setAttribute("aria-label", un + " thông báo chưa đọc");
  });

  return { user: u, shift: s, shiftDemo: info.demo };
}

export async function snapshot() {
  const r = await Promise.all([
    getLines(),
    getMachines(),
    getIncidents(),
    getUsers(),
    getShifts(),
    getTasks(),
  ]);
  const e = r.find((x) => !x.ok);
  if (e) return { error: e.error.message };

  const [lines, machines, incidents, users, shifts, tasks] = r.map(
    (x) => x.data,
  );
  const { shift, demo } = resolveShift({ shifts });
  return {
    lines,
    machines,
    incidents,
    users,
    shifts,
    tasks,
    shift,
    shiftDemo: demo,
    mname: (id) => (machines.find((m) => m.id === id) || {}).name || id,
    uname: (id) => (users.find((u) => u.id === id) || {}).name || null,
  };
}

export const errBox = (m) =>
  `<div class="state err" role="alert"><p>${esc(m)}</p><button class="btn" data-retry>Thử lại</button></div>`;
export const skel = (n) =>
  `<div class="skel" aria-busy="true" aria-label="Đang tải">${"<i></i>".repeat(n || 4)}</div>`;

// Trang chưa có trong gói (khung của Thắng/Nguyên) — chỉ chặn link đánh dấu data-ext.
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-ext]");
  if (!a) return;
  e.preventDefault();
  toast(
    `Trang này do ${a.dataset.ext} làm, chưa có trong gói của Sơn. Sẽ mở được khi ghép dự án.`,
    "err",
  );
});
