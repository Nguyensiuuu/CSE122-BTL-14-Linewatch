/**
 * TẠM THỜI (Nguyên sở hữu store.js/api.js):
 * Bản tối thiểu để các trang của Sơn chạy độc lập. Giữ nguyên chữ ký khi thay thế.
 */

const STORAGE_KEY = "linewatch.v1";

export class LwError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const ok = (data) => ({
  ok: true,
  data,
  error: null,
});

export const fail = (code, message) => ({
  ok: false,
  data: null,
  error: { code, message },
});

export async function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);

  const response = await fetch(
    new URL("../assets/data/seed.json", import.meta.url),
  );
  if (!response.ok) {
    throw new LwError(
      "STORAGE_ERROR",
      "Không tải được seed.json (hãy chạy bằng Live Server/HTTP)",
    );
  }

  const data = await response.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("linewatch:data-changed"));
}

const handleError = (e) =>
  e instanceof LwError
    ? fail(e.code, e.message)
    : fail("STORAGE_ERROR", e.message || "Lỗi lưu trữ");

export async function wrap(fn) {
  try {
    return ok(fn(await load()));
  } catch (e) {
    return handleError(e);
  }
}

// Kiểm tra hết rồi mới lưu một lần; lỗi thì không lưu nửa chừng.
export async function mutate(fn) {
  try {
    const data = structuredClone(await load());
    const result = fn(data);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("linewatch:data-changed"));

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
