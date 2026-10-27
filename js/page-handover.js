import {
  mountShell,
  snapshot,
  esc,
  pill,
  PRI,
  STAT,
  errBox,
  skel,
  toast,
} from "./layout.js";
import { OPEN } from "./incident-flow.js";
import { getShiftNotes, saveShiftNote, summarizeShift } from "./api.js";
import { openModal } from "./modules/shared/ui.js";

const root = document.getElementById("view");
let U,
  S,
  note = null,
  ai = null,
  aiState = "idle",
  variant = 0,
  editing = false;
let dangLuu = false;
let noiDungAIDaChen = '';

// Lọc các việc còn tồn (đang mở hoặc đã xử lý trong ca hiện tại)
const pend = () =>
  S.incidents.filter(
    (i) =>
      OPEN.includes(i.status),
  );

// Tạo danh sách các dòng ghi chú sự cố
const bullets = (ids) =>
  ids.map((id) => {
    const i = S.incidents.find((x) => x.id === id);
    return i ? `${i.machineId}: ${i.title}` : id;
  });

// ==========================================
// 1. TẢI DỮ LIỆU BAN ĐẦU
// ==========================================
async function load() {
  root.innerHTML = skel(4);
  S = await snapshot();

  if (S.error) {
    root.innerHTML = errBox(S.error);
    return;
  }

  const n = await getShiftNotes(S.shift.id);
  if (!n.ok) {
    root.innerHTML = errBox(n.error.message);
    return;
  }

  note = [...n.data].reverse().find((x) => x.status !== "archived") || null;
  ai = note?.ai2 || null;
  noiDungAIDaChen = ai?.appliedText || '';
  aiState = ai ? ai.status === 'rejected' ? 'rejected' : 'done' : 'idle';
  draw(false);

  // Nếu AI chưa chạy, tiến hành gọi AI tóm tắt ca
  if (aiState === "idle" && note?.status !== "saved") runAI();
}

// ==========================================
// 2. GỌI DỊCH VỤ AI (AI-2 TÓM TẮT CA)
// ==========================================
async function runAI() {
  aiState = "loading";
  draw();

  const ids = S.incidents
    .filter((i) => i.shiftId === S.shift.id)
    .map((i) => i.id);
  const r = await summarizeShift(
    { shiftId: S.shift.id, incidentIds: ids },
    { variant },
  );

  if (r.ok) {
    ai = r.data;
    aiState = "success";
  } else {
    ai = { error: r.error };
    aiState = "error";
  }
  draw();
}

// ==========================================
// 3. GIAO DIỆN KHU VỰC AI PANEL
// ==========================================
function aiPanel() {
  if (note?.status === 'saved')
    return ai?.status === 'rejected'
      ? '<p>Gợi ý AI-2 đã bị từ chối trong bản bàn giao này. Nội dung đã chốt chỉ đọc.</p>'
      : `<p>${ai?.suggestion ? `Đã lưu quyết định ${ai.status === 'edited' ? 'sửa' : 'chấp nhận'} gợi ý AI-2 cùng bản bàn giao.` : 'Bản bàn giao này không dùng gợi ý AI-2.'} Tạo phiên bản mới nếu cần sửa.</p>`;
  if (aiState === "loading") return skel(3);
  if (aiState === "error")
    return `<p role="alert">${esc(ai.error.message)}</p><div class="acts"><button class="btn" data-a="retry">Thử lại</button><button class="btn" data-a="manual">Nhập tay</button></div>`;
  if (aiState === "rejected")
    return `<p>Đã từ chối gợi ý. Bạn có thể nhập nội dung bàn giao bằng tay.</p><div class="acts"><button class="btn" data-a="retry">Tạo lại</button></div>`;
  if (aiState === "done")
    return `<p>Đã ${ai.status === "edited" ? "áp dụng bản sửa" : "chấp nhận"} gợi ý và đưa vào nội dung bàn giao.</p><div class="acts"><button class="btn" data-a="retry">Tạo lại</button></div>`;
  if (aiState !== "success")
    return `<button class="btn pri" data-a="retry">Tạo tóm tắt</button>`;

  const sg = ai.suggestion;
  return `
    <small>Tóm tắt đề xuất</small>
    ${editing ? `<textarea id="aiedit" aria-label="Sửa tóm tắt">${esc(sg.text)}</textarea>` : `<p>${esc(sg.text)}</p>`}
    <small>Điểm cần chú ý</small>
    <ul>${
      bullets(sg.pendingIncidentIds)
        .map((b) => `<li>${esc(b)}</li>`)
        .join("") || "<li>Không có việc tồn</li>"
    }</ul>
    <small>Vì sao có kết quả này? ${ai.confidence != null ? `(độ tin cậy ${Math.round(ai.confidence * 100)}% · ${esc(ai.source)})` : ""}</small>
    <p>${esc(ai.reason)}</p>
    <div class="acts">
      ${editing ? '<button class="btn pri" data-a="saveedit">Lưu sửa</button>' : '<button class="btn pri" data-a="accept">Chấp nhận</button><button class="btn" data-a="edit">Sửa</button>'}
      <button class="btn" data-a="reject">Từ chối</button>
      <button class="btn" data-a="retry">Tạo lại</button>
    </div>`;
}

// ==========================================
// 4. VẼ GIAO DIỆN CHÍNH (DRAW)
// ==========================================
function draw(keep = true) {
  const prev = keep ? document.getElementById("txt")?.value : undefined;
  const locked = note?.status === "saved";
  const soCa = Number(S.shift.name.match(/\d+/)?.[0]);
  const nx = soCa === 3 ? 'Ca 1 (ngày tiếp theo)' : Number.isFinite(soCa) ? `Ca ${soCa + 1}` : 'ca tiếp theo';
  const p = pend();

  root.innerHTML = `
    <h1>Bàn giao cuối ca</h1>
    <p class="sub">Chốt việc còn tồn và nội dung cần theo dõi cho ca tiếp theo</p>
    <div class="ho">
      <section class="card">
        <h2>Ghi chú bàn giao · ${esc(S.shift.name)} → ${esc(nx)}</h2>
        <p class="sub" style="margin-top:14px">Việc đang mở, gồm cả ca trước</p>
        <div class="pend">${p.length ? p.map((i) => `<div class="li">${pill(PRI[i.priority], 1)}<span>${i.id} · ${i.machineId} · ${STAT[i.status][0]}</span></div>`).join("") : '<div class="state">Không còn việc tồn.</div>'}</div>
        
        <label for="txt" class="sub">Nội dung bàn giao</label>
        <textarea id="txt"${locked ? " readonly" : ""} placeholder="Nhập nội dung bàn giao…">${esc(prev ?? note?.text ?? "")}</textarea>
        <p id="msg" class="sub" role="status"></p>
        
        <div class="foot">
          ${locked ? '<button class="btn pri" data-a="newver">Tạo phiên bản mới</button>' : '<button class="btn danger" data-a="cancel">Hủy bản nháp</button><span class="sp"></span><button class="btn" data-a="draft">Lưu nháp</button><button class="btn pri" data-a="final">Chốt bàn giao</button>'}
        </div>
        <p class="sub">Bàn giao đã chốt chỉ mở lại bằng phiên bản mới; lưu người sửa và thời điểm.${note?.id ? ` Phiên bản hiện tại: ${esc(note.id)} (${note.status === "saved" ? "đã chốt" : "nháp"}).` : ""}</p>
      </section>
      
      <aside class="card ai" aria-label="AI-2 Tóm tắt ca">
        <h2>AI-2 · Tóm tắt ca</h2>
        ${aiPanel()}
      </aside>
    </div>`;
}

const say = (m, t) => {
  toast(m, t);
};

// ==========================================
// 5. HÀM LƯU GHI CHÚ BÀN GIAO
// ==========================================
async function save(status) {
  if (dangLuu) return;
  dangLuu = true;
  const text = document.getElementById("txt").value;
  root.querySelectorAll('[data-a="draft"], [data-a="final"], [data-a="cancel"]').forEach(nut => nut.disabled = true);
  try {
  const r = await saveShiftNote({
    id: note?.id,
    shiftId: S.shift.id,
    supervisorId: U.id,
    text,
    pendingIncidentIds: pend().map((i) => i.id),
    status,
    ai2: ai && ['accepted', 'edited', 'rejected'].includes(ai.status)
      ? { ...ai }
      : undefined,
  });

  if (!r.ok) {
    document.getElementById("msg").textContent = r.error.message;
    return say(r.error.message, "err");
  }

  note = r.data;
  if (status === 'saved' && ai?.status) aiState = ai.status === 'rejected' ? 'rejected' : 'done';
  say(
    status === "saved"
      ? "Đã chốt bàn giao"
      : status === "draft"
        ? "Đã lưu nháp"
        : "Đã hủy bản nháp",
  );
  if (status === "archived") { note = null; ai = null; aiState = 'idle'; }
  draw(false);
  } finally {
    dangLuu = false;
    root.querySelectorAll('[data-a="draft"], [data-a="final"], [data-a="cancel"]').forEach(nut => nut.disabled = false);
  }
}

// ==========================================
// 6. LẮNG NGHE SỰ KIỆN TƯƠNG TÁC (EVENTS)
// ==========================================
root.addEventListener("click", async (e) => {
  const a = e.target.dataset.a;
  if (e.target.dataset.retry !== undefined) return load();
  if (!a) return;

  if (a === "retry") {
    if (["success", "done", "rejected"].includes(aiState)) variant++;
    editing = false;
    return runAI();
  }
  if (a === "manual") {
    aiState = "rejected";
    return draw();
  }
  if (a === "edit") {
    editing = true;
    return draw();
  }

  if (a === "accept" || a === "saveedit") {
    const t = document.getElementById("txt");
    const sg = ai.suggestion;
    if (a === "saveedit") {
      sg.text = document.getElementById("aiedit").value;
      ai.status = "edited";
      editing = false;
    } else {
      ai.status = "accepted";
    }
    const body = `${sg.text}\n${bullets([...new Set([...sg.pendingIncidentIds, ...pend().map(i => i.id)])])
      .map((b, k) => `${k + 1}. ${b}`)
      .join("\n")}`;
    const noiDungHienTai = t.value.trim();
    const noiDungGoc = noiDungAIDaChen && noiDungHienTai.endsWith(noiDungAIDaChen)
      ? noiDungHienTai.slice(0, -noiDungAIDaChen.length).trimEnd()
      : noiDungHienTai;
    note = {
      ...(note || {}),
      text: noiDungGoc ? `${noiDungGoc}\n${body}` : body,
    };
    noiDungAIDaChen = body;
    ai.appliedText = body;
    aiState = "done";
    draw(false);
    return;
  }

  if (a === "reject") {
    const current = document.getElementById('txt')?.value.trim() || '';
    if (noiDungAIDaChen && current.endsWith(noiDungAIDaChen)) {
      note = { ...(note || {}), text: current.slice(0, -noiDungAIDaChen.length).trimEnd() };
      document.getElementById('txt').value = note.text;
    }
    noiDungAIDaChen = '';
    if (ai) { ai.status = "rejected"; ai.appliedText = ''; }
    aiState = "rejected";
    return draw();
  }

  if (a === "draft") return save("draft");
  if (a === "final") {
    const ketQua = await openModal({
      title: 'Chốt bàn giao', description: 'Sau khi chốt chỉ có thể tạo phiên bản mới.',
      confirmLabel: 'Chốt bàn giao'
    });
    if (ketQua.confirmed) return save("saved");
    return;
  }
  if (a === "cancel") {
    if (!note?.id) {
      document.getElementById("txt").value = "";
      return;
    }
    const ketQua = await openModal({
      title: 'Hủy bản nháp', description: 'Bản nháp hiện tại sẽ chuyển sang lưu trữ.',
      confirmLabel: 'Hủy bản nháp', danger: true
    });
    if (ketQua.confirmed) return save("archived");
  }
  if (a === "newver") {
    note = { text: note.text, status: "draft" };
    ai = null; aiState = 'idle'; editing = false; noiDungAIDaChen = '';
    draw(false);
    runAI();
  }
});

// ==========================================
// 7. KHỞI CHẠY ỨNG DỤNG
// ==========================================
if ((U = (await mountShell())?.user)) {
  load();
}
