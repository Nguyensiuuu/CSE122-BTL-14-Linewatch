import { getLines, getMachines, createLine, updateLineStatus } from '../shared/api.js';
import { openModal, toast, setFieldError, clearFieldError } from '../shared/ui.js';

const $ = id => document.getElementById(id);
const table = $('admin-line-table');
let lines = [], machines = [];
const label = { active: 'Đang chạy', paused: 'Tạm dừng' };

function render() {
  const q = $('line-search').value.trim().toLowerCase();
  const status = $('line-status-filter').value;
  const filtered = lines.filter(l =>
    (!q || `${l.id} ${l.name}`.toLowerCase().includes(q)) &&
    (status === 'all' || l.status === status));
  table.replaceChildren();
  if (!filtered.length) {
    const row = table.insertRow(); const cell = row.insertCell();
    cell.colSpan = 5; cell.textContent = 'Chưa có dây chuyền phù hợp. Hãy đổi bộ lọc hoặc thêm dây chuyền.';
    return;
  }
  filtered.forEach(l => {
    const row = table.insertRow();
    [l.id, l.name, String(machines.filter(m => m.lineId === l.id).length), label[l.status] || l.status]
      .forEach(value => { row.insertCell().textContent = value; });
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn'; button.dataset.lineId = l.id;
    button.textContent = l.status === 'active' ? 'Tạm dừng' : 'Cho chạy';
    row.insertCell().append(button);
  });
}
async function reload() {
  table.innerHTML = '<tr><td colspan="5">Đang tải danh sách…</td></tr>';
  try {
    const [a,b] = await Promise.all([getLines(), getMachines()]);
    if (!a.ok || !b.ok) throw new Error(a.error?.message || b.error?.message || 'Không tải được dữ liệu.');
    lines = a.data; machines = b.data; render();
  } catch (error) {
    table.innerHTML = '';
    const cell = table.insertRow().insertCell();
    cell.colSpan = 5;
    cell.textContent = error.message + ' ';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'btn'; retry.textContent = 'Thử lại';
    retry.addEventListener('click', reload);
    cell.append(retry);
  }
}
$('line-search').addEventListener('input', render);
$('line-status-filter').addEventListener('change', render);
$('add-line').addEventListener('click', async () => {
  const ketQua = await openModal({
    title: 'Thêm dây chuyền',
    description: 'Dây chuyền mới sẽ xuất hiện trong danh mục chung.',
    body: '<div class="field"><label for="ten-day-chuyen-moi">Tên dây chuyền</label><input id="ten-day-chuyen-moi" name="ten" required maxlength="80" autocomplete="off" placeholder="Ví dụ: Dây chuyền đóng gói 04"></div>',
    confirmLabel: 'Thêm dây chuyền',
    onSubmit: async ({ form }) => {
      const oTen = form.elements.ten;
      clearFieldError(oTen);
      const ten = oTen.value.trim();
      if (ten.length < 3) {
        setFieldError(oTen, 'Tên dây chuyền cần ít nhất 3 ký tự.');
        oTen.focus();
        return { ok: false, message: 'Vui lòng sửa tên dây chuyền.' };
      }
      const result = await createLine({ name: ten, status: 'active' });
      if (!result.ok) {
        setFieldError(oTen, result.error.message);
        oTen.focus();
        return { ok: false, message: result.error.message };
      }
      return { ok: true, data: result.data };
    }
  });
  if (ketQua.confirmed) { await reload(); toast(`Đã thêm ${ketQua.data.name}.`); }
});
table.addEventListener('click', async event => {
  const button = event.target.closest('[data-line-id]');
  if (!button) return;
  const line = lines.find(l => l.id === button.dataset.lineId);
  if (!line) return;
  const xacNhan = await openModal({
    title: line.status === 'active' ? 'Tạm dừng dây chuyền' : 'Cho dây chuyền hoạt động',
    description: `${line.id} · ${line.name}. Trạng thái này sẽ được cập nhật trên các màn hình vận hành.`,
    confirmLabel: line.status === 'active' ? 'Tạm dừng' : 'Cho chạy'
  });
  if (!xacNhan.confirmed) return;
  button.disabled = true;
  const result = await updateLineStatus(line.id, line.status === 'active' ? 'paused' : 'active');
  if (!result.ok) toast(result.error.message, { type: 'error' });
  else toast(`Đã đổi trạng thái ${line.id}.`);
  await reload();
});
await reload();
