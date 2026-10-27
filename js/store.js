const KHOA_DU_LIEU = 'linewatch.v1';
const DUONG_DAN_DU_LIEU = new URL('../assets/data/seed.json', import.meta.url);

function baoDuLieuDoi() {
  window.dispatchEvent(new CustomEvent('linewatch:data-changed'));
}

// Các mô-đun của Sơn dùng cùng kho này; không có bản store thứ hai.
export class LwError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const ok = data => ({ ok: true, data, error: null });
export const fail = (code, message) => ({ ok: false, data: null, error: { code, message } });
export const load = readStore;
export async function wrap(fn) {
  try { return ok(await fn(await readStore())); }
  catch (error) { return fail(error.code || 'STORAGE_ERROR', error.message); }
}
export async function mutate(fn) {
  try { return ok(await updateStore(fn)); }
  catch (error) { return fail(error.code || 'STORAGE_ERROR', error.message); }
}
export async function replaceStore(data) {
  if (!data || !Array.isArray(data.lines) || !Array.isArray(data.incidents))
    throw new LwError('VALIDATION_ERROR', 'Dữ liệu lưu không hợp lệ.');
  localStorage.setItem(KHOA_DU_LIEU, JSON.stringify(data));
  baoDuLieuDoi();
}

export async function loadSeed() {
  const response = await fetch(DUONG_DAN_DU_LIEU);
  if (!response.ok) throw new Error('Không tải được dữ liệu mẫu. Hãy chạy dự án qua Live Server.');
  return response.json();
}

export async function readStore() {
  const raw = localStorage.getItem(KHOA_DU_LIEU);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      // Đổi nhãn demo cũ, giữ nguyên công việc và sự cố đã lưu trong trình duyệt.
      let doiTen = false;
      for (const user of data.users || []) {
        if (user.id === 'USR-MT-01' && user.name === 'Kỹ thuật viên mẫu') {
          user.name = 'Kỹ thuật viên Tú'; doiTen = true;
        }
        if (user.id === 'USR-MT-02' && user.name === 'KTV Minh') {
          user.name = 'Kỹ thuật viên Minh'; doiTen = true;
        }
      }
      // Bản dữ liệu demo đã lưu trước đây có thể mới có Tú.
      // Bổ sung Minh vào danh sách phân công mà không xóa sự cố/công việc cũ.
      if (Array.isArray(data.users) && !data.users.some(user => user.id === 'USR-MT-02')) {
        data.users.push({ id: 'USR-MT-02', name: 'Kỹ thuật viên Minh', role: 'maintenance', active: true });
        doiTen = true;
      }
      if (doiTen) localStorage.setItem(KHOA_DU_LIEU, JSON.stringify(data));
      return data;
    }
    catch { throw new Error('Dữ liệu demo đã hỏng. Hãy dùng nút Đặt lại dữ liệu.'); }
  }
  const seed = await loadSeed();
  localStorage.setItem(KHOA_DU_LIEU, JSON.stringify(seed));
  return structuredClone(seed);
}

// Mutator edits one copy. Nothing is saved if it throws or returns an error.
export async function updateStore(mutator) {
  const next = structuredClone(await readStore());
  const result = await mutator(next);
  localStorage.setItem(KHOA_DU_LIEU, JSON.stringify(next));
  baoDuLieuDoi();
  return result;
}

export async function resetStore() {
  const seed = await loadSeed();
  localStorage.setItem(KHOA_DU_LIEU, JSON.stringify(seed));
  baoDuLieuDoi();
  return structuredClone(seed);
}
