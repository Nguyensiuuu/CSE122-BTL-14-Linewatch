const KHOA_DU_LIEU = 'linewatch.v1';
const DUONG_DAN_DU_LIEU = new URL('../assets/data/seed.json', import.meta.url);

function baoDuLieuDoi() {
  window.dispatchEvent(new CustomEvent('linewatch:data-baoDuLieuDoi'));
}

export async function loadSeed() {
  const response = await fetch(DUONG_DAN_DU_LIEU);
  if (!response.ok) throw new Error('Không tải được dữ liệu mẫu. Hãy chạy dự án qua Live Server.');
  return response.json();
}

export async function readStore() {
  const raw = localStorage.getItem(KHOA_DU_LIEU);
  if (raw) {
    try { return JSON.parse(raw); }
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
