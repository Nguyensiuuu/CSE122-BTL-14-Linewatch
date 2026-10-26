import {
  mountShell,
  snapshot,
  esc,
  hhmm,
  ago,
  pill,
  PRI,
  STAT,
  errBox,
  skel,
  toast,
} from "./layout.js";
import {
  acceptIncident,
  assignIncident,
  closeIncident,
  getTasks,
} from "./api.js";

const root = document.getElementById("view");
const dlg = document.getElementById("dlg");

const COLS = ["new", "accepted", "assigned", "in_progress", "resolved"];
const CL = { resolved: "Đã xử lý" };

let sel = null;
let q = "";
let hi = false;
let line = "";
let S = null;

// ==========================================
// 1. HÀM RENDER GIAO DIỆN CHÍNH
// ==========================================
async function render() {
  // Nếu chưa có dữ liệu, hiển thị khung chờ (skeleton)
  if (!S) root.innerHTML = skel(3);

  // Lấy dữ liệu mới nhất từ hệ thống
  S = await snapshot();
  if (S.error) {
    root.innerHTML = errBox(S.error);
    S = null;
    return;
  }

  // Điều kiện lọc sự cố (theo độ ưu tiên cao, dây chuyền, hoặc từ khóa tìm kiếm)
  const m = (i) =>
    (!hi || i.priority === "high") &&
    (!line || i.lineId === line) &&
    (!q ||
      `${i.id} ${i.machineId} ${i.title} ${i.lineId} ${S.mname(i.machineId)}`
        .toLowerCase()
        .includes(q));

  // Lọc danh sách sự cố thuộc ca hiện tại thỏa mãn điều kiện
  const cur = S.incidents.filter((i) => i.shiftId === S.shift.id && m(i));
  const it = S.incidents.find((i) => i.id === sel);

  // Dựng cấu trúc HTML cho trang Bảng điều phối
  root.innerHTML = `
    <h1>Bảng điều phối sự cố</h1>
    <p class="sub">Theo dõi tiến độ theo trạng thái và phân công nhanh</p>
    
    <!-- Thanh công cụ: Tìm kiếm, Lọc ưu tiên, Lọc dây chuyền, Nút tạo sự cố -->
    <div class="bd-tools">
      <input type="search" id="q" value="${esc(q)}" placeholder="Tìm sự cố, máy, dây chuyền" aria-label="Tìm sự cố">
      <button class="chip" id="hi" aria-pressed="${hi}">Ưu tiên cao</button>
      <select id="ln" aria-label="Lọc dây chuyền">
        <option value="">Tất cả dây chuyền</option>
        ${S.lines.map((l) => `<option value="${l.id}"${l.id === line ? " selected" : ""}>${l.id}</option>`).join("")}
      </select>
      <a class="btn sp" style="margin-left:auto" href="operator-incident-create.html">+ Tạo sự cố</a>
    </div>

    <!-- Các cột trạng thái (Kanban board) -->
    <div class="cols">
      ${COLS.map((c) => {
        const x = cur.filter((i) => i.status === c);
        return `
          <section class="col-b c-${c}" aria-label="${CL[c] || STAT[c][0]}">
            <h3>${CL[c] || STAT[c][0]} <span>${x.length}</span></h3>
            ${
              x.length
                ? x
                    .map(
                      (i) => `
                  <button class="tk ${i.priority}" data-id="${i.id}" aria-pressed="${i.id === sel}">
                    <b>${i.id}</b>
                    <p>${i.machineId} · ${esc(i.title)}</p>
                    <small>${hhmm(i.reportedAt)} · ${esc(S.shift.name)}</small>
                  </button>`,
                    )
                    .join("")
                : '<p class="sub">Không có sự cố</p>'
            }
          </section>`;
      }).join("")}
    </div>

    <!-- Thanh hành động phía dưới (hiển thị khi chọn 1 sự cố) -->
    <div class="actbar">
      ${
        it
          ? `
        <div class="t">
          <b>${it.id} · ${it.status === "new" ? "Chưa nhận" : STAT[it.status][0]} · ${ago(it.reportedAt)} từ lúc tạo</b>
          <small>Mỗi lần chuyển trạng thái được ghi mốc thời gian vào chính sự cố; máy lỗi được ưu tiên trước khi bàn giao.</small>
        </div>
        <button class="btn link" data-a="accept"${it.status !== "new" ? " disabled" : ""}>Tiếp nhận</button>
        <button class="btn link" data-a="assign"${it.status !== "accepted" ? " disabled" : ""}>Phân công bảo trì</button>
        <button class="btn link" data-a="close"${it.status !== "resolved" ? " disabled" : ""}>Xác nhận hoàn thành</button>`
          : `
        <div class="t">
          <small>Chọn một sự cố để tiếp nhận, phân công hoặc xác nhận hoàn thành.</small>
        </div>`
      }
    </div>`;
}

// ==========================================
// 2. XỬ LÝ SỰ KIỆN TƯƠNG TÁC (EVENTS)
// ==========================================
const act = async (p, msg) => {
  const r = await p;
  toast(r.ok ? msg : r.error.message, r.ok ? "ok" : "err");
};

// Xử lý sự kiện click trên giao diện
root.addEventListener("click", async (e) => {
  if (e.target.dataset.retry !== undefined) return render();

  // Click chọn thẻ sự cố (ticket)
  const k = e.target.closest(".tk");
  if (k) {
    sel = k.dataset.id;
    return render();
  }

  // Click nút lọc ưu tiên cao
  const hb = e.target.closest("#hi");
  if (hb) {
    hi = !hi;
    return render();
  }

  // Xử lý các nút hành động (Tiếp nhận, Phân công, Hoàn thành)
  const a = e.target.dataset.a;
  if (!a || !sel) return;

  if (a === "accept") await act(acceptIncident(sel), `Đã tiếp nhận ${sel}`);
  if (a === "close")
    await act(closeIncident(sel), `Đã xác nhận hoàn thành ${sel}`);

  // Mở hộp thoại (Dialog) phân công bảo trì
  if (a === "assign") {
    const mt = S.users.filter((u) => u.role === "maintenance" && u.active);
    dlg.querySelector("select").innerHTML = mt
      .map((u) => `<option value="${u.id}">${esc(u.name)}</option>`)
      .join("");
    dlg.querySelector("h3").textContent = `Phân công ${sel}`;
    dlg.showModal();
  }
});

// Xử lý sự kiện gõ tìm kiếm (giữ nguyên vị trí con trỏ khi gõ)
root.addEventListener("input", (e) => {
  if (e.target.id === "q") {
    q = e.target.value.trim().toLowerCase();
    const p = e.target.selectionStart;
    render().then(() => {
      const n = document.getElementById("q");
      n.focus();
      n.setSelectionRange(p, p);
    });
  }
});

// Xử lý thay đổi bộ lọc dây chuyền
root.addEventListener("change", (e) => {
  if (e.target.id === "ln") {
    line = e.target.value;
    render();
  }
});

// Xử lý khi đóng hộp thoại phân công bảo trì (Dialog)
dlg.addEventListener("close", async () => {
  if (dlg.returnValue !== "ok") return;

  const id = sel;
  const r = await assignIncident(id, dlg.querySelector("select").value);

  if (!r.ok) return toast(r.error.message, "err");

  const t = (await getTasks()).data.find((x) => x.incidentId === id);
  toast(`Đã phân công ${id} → tạo ${t ? t.id : "nhiệm vụ"}`);
});

// ==========================================
// 3. KHỞI CHẠY ỨNG DỤNG
// ==========================================
if (await mountShell()) {
  render();
  window.addEventListener("linewatch:data-changed", render);
}
