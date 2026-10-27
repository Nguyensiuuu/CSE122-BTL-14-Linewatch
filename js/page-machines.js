// Khung 11: CHỈ ĐỌC — không có thao tác ghi nào trong tệp này.
import { mountShell, snapshot, esc, hhmm, dmy, STAT, errBox, skel } from "./layout.js";
import { OPEN } from "./incident-flow.js";
import { getMachineHistory } from "./api.js";

const root = document.getElementById("view");

// Định nghĩa trạng thái hiển thị của máy (Tên hiển thị, Class CSS)
const ST = {
  normal: ["Bình thường", "s-done"],
  warning: ["Cảnh báo", "p-med"],
  fault: ["Sự cố", "s-new"],
  maintenance: ["Bảo trì", "s-asg"],
};

let S,
  q = "",
  ln = "",
  act = true,
  selectedMachine = "";

// ==========================================
// 1. TẢI DỮ LIỆU BAN ĐẦU (LOAD)
// ==========================================
async function load() {
  root.innerHTML = skel(5);
  S = await snapshot();

  if (S.error) {
    root.innerHTML = errBox(S.error);
  } else {
    draw();
  }
}

// ==========================================
// 2. VẼ GIAO DIỆN DANH MỤC MÁY (DRAW)
// ==========================================
function draw() {
  // Kiểm tra dây chuyền có đang ở trạng thái active hay không
  const act_ = (l) =>
    (S.lines.find((x) => x.id === l) || {}).status === "active";

  // Lọc danh sách máy theo dây chuyền, trạng thái hoạt động và từ khóa tìm kiếm
  const rows = S.machines.filter(
    (m) =>
      (!ln || m.lineId === ln) &&
      (!act || act_(m.lineId)) &&
      (!q || `${m.id} ${m.name}`.toLowerCase().includes(q)),
  );

  // Lấy mốc thời gian cập nhật sự cố gần nhất của máy
  const last = (m) => {
    const t = S.incidents
      .filter((i) => i.machineId === m.id)
      .flatMap((i) => [
        i.reportedAt,
        i.acceptedAt,
        i.assignedAt,
        i.startedAt,
        i.resolvedAt,
        i.closedAt,
      ])
      .filter(Boolean)
      .sort()
      .pop();
    return t ? `${dmy(t)} · ${hhmm(t)}` : "—";
  };

  // Dựng cấu trúc HTML trang danh mục máy
  root.innerHTML = `
    <h1>Danh mục máy</h1>
    <p class="sub">Tra cứu dữ liệu máy để đối chiếu với sự cố và báo cáo</p>
    
    <!-- Thanh công cụ lọc và tìm kiếm -->
    <div class="mm-t">
      <input type="search" id="q" value="${esc(q)}" placeholder="Tìm mã máy hoặc tên máy" aria-label="Tìm máy">
      <select id="ln" aria-label="Dây chuyền">
        <option value="">Tất cả dây chuyền</option>
        ${S.lines.map((l) => `<option value="${l.id}"${l.id === ln ? " selected" : ""}>${l.id} · ${esc(l.name)}</option>`).join("")}
      </select>
      <button class="chip g" id="act" aria-pressed="${act}">Đang hoạt động</button>
    </div>

    <!-- Bảng danh sách máy -->
    <div class="card scroll">
      ${
        rows.length
          ? `
        <table>
          <thead>
            <tr>
              <th>Mã máy</th>
              <th>Tên máy</th>
              <th>Dây chuyền</th>
              <th>Trạng thái</th>
              <th>Sự cố mở</th>
              <th>Cập nhật gần nhất</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (m) => `
              <tr>
                <td><b>${m.id}</b></td>
                <td>${esc(m.name)}</td>
                <td>${m.lineId}</td>
                <td><span class="pill ${ST[m.status][1]}">${ST[m.status][0]}</span></td>
                <td>${S.incidents.filter((i) => i.machineId === m.id && OPEN.includes(i.status)).length}</td>
                <td>${last(m)}</td>
                <td><button type="button" class="btn link" data-machine="${esc(m.id)}" aria-label="Xem lịch sử máy ${esc(m.id)}">Xem →</button></td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>`
          : '<div class="state">Không có máy phù hợp bộ lọc.</div>'
      }
    </div>
    <section id="machine-detail" class="card machine-detail" aria-live="polite" ${selectedMachine ? "" : "hidden"}>
      <div class="section-head"><h2>Lịch sử máy</h2><button type="button" class="btn" data-close-machine>Đóng</button></div>
      <div id="machine-detail-body" class="dang-tai">Đang tải lịch sử…</div>
    </section>`;
  if (selectedMachine) showMachine(selectedMachine);
}

// Quản trị viên xem lịch sử ngay trong danh mục; trang bảo trì chỉ dành cho kỹ thuật viên.
async function showMachine(id) {
  const region = document.getElementById("machine-detail-body");
  if (!region) return;
  const response = await getMachineHistory(id);
  if (!region.isConnected || selectedMachine !== id) return;
  if (!response.ok) {
    region.innerHTML = `<p role="alert">${esc(response.error.message)}</p><button type="button" class="btn" data-machine="${esc(id)}">Thử lại</button>`;
    return;
  }
  const { machine, line, incidents, tasks } = response.data;
  region.innerHTML = `<p><strong>${esc(machine.id)} · ${esc(machine.name)}</strong> · ${esc(line?.name || machine.lineId)} · ${esc(ST[machine.status]?.[0] || machine.status)}</p>
    <h3>Sự cố liên quan (${incidents.length})</h3>
    ${incidents.length ? `<div class="scroll"><table><thead><tr><th>Mã sự cố</th><th>Nội dung</th><th>Trạng thái</th><th>Báo lúc</th><th>Biện pháp bảo trì</th></tr></thead><tbody>${incidents.map(i => {
      const task = tasks.find(t => t.incidentId === i.id);
      return `<tr><td>${esc(i.id)}</td><td>${esc(i.title)}</td><td>${esc(STAT[i.status]?.[0] || i.status)}</td><td>${i.reportedAt ? `${dmy(i.reportedAt)} · ${hhmm(i.reportedAt)}` : "—"}</td><td>${esc(task?.action || "Chưa ghi nhận")}</td></tr>`;
    }).join("")}</tbody></table></div>` : '<p>Máy này chưa có sự cố.</p>'}`;
}

// ==========================================
// 3. XỬ LÝ SỰ KIỆN TƯƠNG TÁC (EVENTS)
// ==========================================
// Sự kiện tìm kiếm (giữ nguyên vị trí con trỏ khi gõ)
root.addEventListener("input", (e) => {
  if (e.target.id === "q") {
    q = e.target.value.trim().toLowerCase();
    const p = e.target.selectionStart;
    draw();
    const n = document.getElementById("q");
    n.focus();
    n.setSelectionRange(p, p);
  }
});

// Sự kiện thay đổi lọc dây chuyền
root.addEventListener("change", (e) => {
  if (e.target.id === "ln") {
    ln = e.target.value;
    draw();
  }
});

// Sự kiện click (nút thử lại khi lỗi hoặc nút lọc đang hoạt động)
root.addEventListener("click", (e) => {
  const machine = e.target.closest("[data-machine]")?.dataset.machine;
  if (machine) {
    selectedMachine = machine;
    draw();
    document.getElementById("machine-detail")?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (e.target.closest("[data-close-machine]")) {
    selectedMachine = "";
    draw();
    return;
  }
  if (e.target.dataset.retry !== undefined) load();
  if (e.target.id === "act") {
    act = !act;
    draw();
  }
});

// ==========================================
// 4. KHỞI CHẠY ỨNG DỤNG
// ==========================================
if (await mountShell()) {
  load();
  window.addEventListener("linewatch:data-changed", load);
}
