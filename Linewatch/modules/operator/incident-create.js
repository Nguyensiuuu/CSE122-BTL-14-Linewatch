import { getLines, getMachines, getIncidents, createIncident, saveDraft, readDraft } from '../shared/api.js';
import { suggestIncident, categoryLabel, priorityLabel } from '../shared/ai.js';
import { openModal, setFieldError, clearFieldError } from '../shared/ui.js';

const $ = id => document.getElementById(id);
const form = $('incident-form');
const state = { lines: [], machines: [], ai: null, decision: null, busy: false };
const category = $('ai-category');
const priority = $('ai-priority');
const error = $('form-error');

function notice(message) {
  error.textContent = message;
  error.hidden = !message;
}
const loaiSuCo = {
  'cơ khí': 'mechanical', 'co khi': 'mechanical', mechanical: 'mechanical',
  'điện': 'electrical', dien: 'electrical', electrical: 'electrical',
  'chất lượng': 'quality', 'chat luong': 'quality', quality: 'quality',
  'khác': 'other', khac: 'other', other: 'other'
};
function maLoaiSuCo(value) {
  return loaiSuCo[value.trim().toLocaleLowerCase('vi-VN')] || '';
}
function payload() {
  const moTaAnhHuong = $('impact').value.trim();
  return {
    lineId: $('lineId').value,
    machineId: $('machineId').value,
    createdAt: $('createdAt').value,
    description: $('description').value.trim(),
    category: maLoaiSuCo($('manual-category').value),
    priority: $('manual-priority').value,
    impact: /toàn bộ|toan bo|hoàn toàn/i.test(moTaAnhHuong) ? 'full'
      : /chưa rõ|chua ro/i.test(moTaAnhHuong) ? 'unknown' : 'partial',
    impactNote: moTaAnhHuong,
    attachments: Array.from($('attachments').files).map(f => ({
      name: f.name, type: f.type, size: f.size
    })),
    ai1: state.decision?.status === 'edited'
      ? { ...state.decision, suggestion: {
          ...state.decision.suggestion,
          category: maLoaiSuCo($('manual-category').value),
          priority: $('manual-priority').value
        } }
      : state.decision
  };
}
function renderMachines() {
  const selected = $('machineId').value;
  $('machineId').replaceChildren(new Option('Chọn máy…', ''));
  state.machines.filter(m => m.lineId === $('lineId').value).forEach(m => {
    $('machineId').add(new Option(`${m.id} · ${m.name}`, m.id));
  });
  $('machineId').value = selected;
  hienThiMayDaChon();
}
function hienThiMayDaChon() {
  const may = state.machines.find(item => item.id === $('machineId').value && item.lineId === $('lineId').value);
  const dayChuyen = state.lines.find(item => item.id === $('lineId').value);
  const thongTin = $('machine-details');
  thongTin.hidden = !may;
  if (may) thongTin.textContent = `Dây chuyền: ${dayChuyen?.name || may.lineId} · Máy: ${may.id} · ${may.name} · Tình trạng: ${
    { normal: 'Ổn định', warning: 'Cần quan sát', fault: 'Lỗi', maintenance: 'Bảo trì' }[may.status] || 'Chưa rõ'
  }.`;
}
function renderAi() {
  const ai = state.ai;
  const hienThi = state.decision?.status === 'rejected' ? null : (state.decision?.suggestion || ai?.suggestion);
  category.textContent = hienThi ? categoryLabel(hienThi.category) : ai ? 'Đã từ chối' : 'Chưa phân loại';
  priority.textContent = hienThi ? priorityLabel(hienThi.priority) : ai ? 'Nhập thủ công' : 'Chưa xác định';
  $('ai-reason').textContent = ai
    ? `${ai.reason}${state.decision?.status === 'edited' ? ' Bạn đã sửa kết quả gợi ý.' : ''}`
    : 'Nhập mô tả rồi chọn “Tạo gợi ý”.';
  $('ai-confidence').textContent = ai ? Math.round(ai.confidence * 100) + '%' : '—';
  $('ai-progress').style.width = ai ? Math.round(ai.confidence * 100) + '%' : '0%';
  ['ai-accept', 'ai-edit', 'ai-reject'].forEach(id => $(id).disabled = !ai || state.busy);
}
async function analyze() {
  notice('');
  state.decision = null;
  $('ai-feedback').textContent = '';
  const moTaLucGui = $('description').value;
  const maMayLucGui = $('machineId').value;
  state.busy = true;
  $('ai-state').textContent = 'AI đang phân tích mô tả…';
  $('ai-retry').disabled = true;
  renderAi();
  let response;
  try {
    response = await suggestIncident({ description: moTaLucGui, machineId: maMayLucGui });
  } catch (loi) {
    response = { ok: false, error: { message: loi.message || 'Không phân tích được.' } };
  } finally {
    state.busy = false;
    $('ai-retry').disabled = false;
  }
  if ($('description').value !== moTaLucGui || $('machineId').value !== maMayLucGui) {
    state.ai = null;
    $('ai-state').textContent = 'Thông tin đã đổi trong lúc phân tích. Hãy tạo gợi ý mới.';
    renderAi();
    return;
  }
  if (!response.ok) {
    state.ai = null;
    $('ai-state').textContent = response.error.message + ' Bạn vẫn có thể gửi thủ công.';
  } else {
    state.ai = response.data;
    $('ai-state').textContent = response.data.confidence < 0.6
      ? 'Gợi ý chưa chắc chắn. Hãy kiểm tra, sửa phân loại hoặc từ chối và nhập thủ công trước khi gửi.'
      : 'Đã có gợi ý. Bạn quyết định trước khi gửi.';
  }
  renderAi();
}
async function choose(status) {
  if (!state.ai) return;
  const suggestion = { ...state.ai.suggestion };
  if (status === 'edited') {
    const ketQua = await openModal({
      title: 'Sửa gợi ý AI-1',
      description: 'Kiểm tra phân loại trước khi đưa vào báo cáo.',
      body: `<div class="field"><label for="loai-ai-sua">Loại sự cố</label><input id="loai-ai-sua" name="loai" required list="incident-categories" value="${categoryLabel(suggestion.category)}"></div>
        <div class="field"><label for="uu-tien-ai-sua">Mức ưu tiên</label><select id="uu-tien-ai-sua" name="uuTien" required>
          <option value="low" ${suggestion.priority === 'low' ? 'selected' : ''}>Thấp</option>
          <option value="medium" ${suggestion.priority === 'medium' ? 'selected' : ''}>Trung bình</option>
          <option value="high" ${suggestion.priority === 'high' ? 'selected' : ''}>Cao</option></select></div>`,
      confirmLabel: 'Áp dụng bản sửa',
      onSubmit: ({ form }) => {
        const oLoai = form.elements.loai;
        clearFieldError(oLoai);
        const maLoai = maLoaiSuCo(oLoai.value);
        if (!maLoai) {
          setFieldError(oLoai, 'Nhập cơ khí, điện, chất lượng hoặc khác.');
          oLoai.focus();
          return { ok: false, message: 'Loại sự cố chưa hợp lệ.' };
        }
        return { ok: true, data: { category: maLoai, priority: form.elements.uuTien.value } };
      }
    });
    if (!ketQua.confirmed) return;
    Object.assign(suggestion, ketQua.data);
  }
  state.decision = { ...state.ai, status, suggestion };
  if (status !== 'rejected') {
    $('manual-category').value = categoryLabel(suggestion.category);
    $('manual-priority').value = suggestion.priority;
  }
  $('ai-feedback').textContent = status === 'rejected'
    ? 'Đã từ chối gợi ý. Sự cố sẽ dùng phân loại thủ công bạn nhập.'
    : 'Đã ghi nhận quyết định; kết quả sẽ lưu cùng sự cố khi bạn gửi.';
  renderAi();
}

$('lineId').addEventListener('change', renderMachines);
$('machineId').addEventListener('change', hienThiMayDaChon);
$('ai-retry').addEventListener('click', analyze);
$('ai-accept').addEventListener('click', () => choose('accepted'));
$('ai-edit').addEventListener('click', () => choose('edited'));
$('ai-reject').addEventListener('click', () => choose('rejected'));
$('manual-category').addEventListener('input', () => {
  if (state.decision && state.decision.status !== 'rejected') {
    state.decision.status = 'edited';
    state.decision.suggestion.category = maLoaiSuCo($('manual-category').value);
    renderAi();
  }
});
$('manual-priority').addEventListener('change', () => {
  if (state.decision && state.decision.status !== 'rejected') {
    state.decision.status = 'edited';
    state.decision.suggestion.priority = $('manual-priority').value;
    renderAi();
  }
});
// Mô tả/vị trí đổi thì gợi ý cũ không còn đúng với báo cáo mới.
for (const id of ['description', 'machineId', 'lineId']) {
  $(id).addEventListener(id === 'description' ? 'input' : 'change', () => {
    if (!state.ai && !state.decision) return;
    state.ai = null;
    state.decision = null;
    $('ai-state').textContent = 'Thông tin đã đổi. Hãy tạo gợi ý mới hoặc gửi thủ công.';
    $('ai-feedback').textContent = '';
    renderAi();
  });
}
$('save-draft').addEventListener('click', () => {
  saveDraft(payload()); $('ai-feedback').textContent = 'Đã lưu bản nháp trên máy này.';
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  notice('');
  for (const id of ['lineId', 'machineId', 'createdAt', 'description', 'manual-category', 'impact']) {
    clearFieldError($(id));
  }
  clearFieldError($('attachments'));
  const batBuoc = [
    ['lineId', 'Chọn dây chuyền.'], ['machineId', 'Chọn máy thuộc dây chuyền.'],
    ['createdAt', 'Chọn thời điểm phát hiện.'], ['description', 'Mô tả hiện tượng ít nhất 8 ký tự.']
  ];
  for (const [id, message] of batBuoc) {
    const input = $(id);
    if (!input.value.trim() || (id === 'description' && input.value.trim().length < 8) ||
        (id === 'createdAt' && !input.validity.valid)) {
      setFieldError(input, message);
      input.focus(); return;
    }
  }
  if (!maLoaiSuCo($('manual-category').value)) {
    setFieldError($('manual-category'), 'Nhập cơ khí, điện, chất lượng hoặc khác.');
    $('manual-category').focus(); return;
  }
  if ($('impact').value.trim().length < 3) {
    setFieldError($('impact'), 'Mô tả mức ảnh hưởng ít nhất 3 ký tự.');
    $('impact').focus(); return;
  }
  const files = Array.from($('attachments').files);
  if (files.length > 3 || files.some(f => !['image/png','image/jpeg'].includes(f.type) || f.size > 5 * 1024 * 1024)) {
    setFieldError($('attachments'), 'Chọn tối đa 3 ảnh PNG/JPG, mỗi ảnh không quá 5 MB.');
    $('attachments').focus(); return;
  }
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const result = await createIncident(payload());
    if (!result.ok) {
      const oLoi = { category: 'manual-category', impactNote: 'impact' };
      const truong = $(oLoi[result.error?.field] || result.error?.field);
      if (truong) { setFieldError(truong, result.error.message); truong.focus(); }
      else notice(result.error.message);
      return;
    }
    location.href = `operator-shift-incidents.html?created=${encodeURIComponent(result.data.id)}`;
  } finally { button.disabled = false; }
});
try {
  const [lines, machines, incidents] = await Promise.all([getLines(), getMachines(), getIncidents()]);
  if (!lines.ok || !machines.ok || !incidents.ok) {
    throw new Error(lines.error?.message || machines.error?.message || incidents.error?.message);
  }
  state.lines = lines.data; state.machines = machines.data;
  state.lines.forEach(l => $('lineId').add(new Option(`${l.id} · ${l.name}`, l.id)));
  const params = new URLSearchParams(location.search);
  const maDayChuyen = params.get('lineId');
  const maMay = params.get('machineId');
  const tuTheMay = Boolean(maDayChuyen || maMay);
  const mayDaBam = state.machines.find(may => may.id === maMay && may.lineId === maDayChuyen);
  const draft = tuTheMay ? null : readDraft();
  if (draft) for (const id of ['lineId', 'description', 'createdAt']) if (draft[id]) $(id).value = draft[id];
  if (draft?.category) $('manual-category').value = categoryLabel(draft.category);
  if (draft?.priority) $('manual-priority').value = draft.priority;
  if (draft?.impactNote) $('impact').value = draft.impactNote;
  if (mayDaBam) $('lineId').value = mayDaBam.lineId;
  renderMachines();
  if (mayDaBam) $('machineId').value = mayDaBam.id;
  else if (draft?.machineId) $('machineId').value = draft.machineId;
  hienThiMayDaChon();
  if (tuTheMay) {
    const ghiChu = $('machine-context');
    ghiChu.hidden = false;
    if (!mayDaBam) {
      ghiChu.textContent = 'Không tìm thấy máy trên thẻ vừa chọn. Hãy chọn lại dây chuyền và máy.';
      $('impact').value = '';
    } else {
      const suCo = incidents.data.find(item => item.id === params.get('incidentId') &&
        item.machineId === mayDaBam.id && item.lineId === mayDaBam.lineId);
      if (suCo) {
        $('description').value = suCo.description || suCo.title || '';
        $('manual-category').value = categoryLabel(suCo.category);
        $('manual-priority').value = suCo.priority || 'medium';
        $('impact').value = suCo.impactNote || '';
        ghiChu.textContent = `Đã điền thông tin máy ${mayDaBam.id} (${mayDaBam.name}) và tham khảo sự cố ${suCo.id}. Đây là báo cáo mới; hãy kiểm tra, cập nhật mô tả và mức ảnh hưởng trước khi gửi.`;
      } else {
        $('impact').value = '';
        ghiChu.textContent = `Đã chọn máy ${mayDaBam.id} (${mayDaBam.name}). Hãy nhập hiện tượng và mức ảnh hưởng để tạo báo cáo mới.`;
      }
    }
  }
  if (!$('createdAt').value) {
    const now = new Date();
    $('createdAt').value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
} catch (e) { notice(e.message || 'Không tải được dữ liệu. Hãy thử lại.'); }
