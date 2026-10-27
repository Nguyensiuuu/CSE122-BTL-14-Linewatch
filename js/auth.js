import { readStore } from './store.js';

const SESSION_KEY = 'linewatch.session.v1';
const RESET_KEY = 'linewatch.reset.v1';
const DEMO_EMAILS = {
  operator: 'thang@linewatch.vn',
  supervisor: 'son@linewatch.vn',
  maintenance: 'nguyen@linewatch.vn',
  admin: 'admin@linewatch.vn'
};
// Hai người cùng một nghiệp vụ bảo trì; chọn người bằng tài khoản đăng nhập,
// còn menu Vai trò vẫn chỉ có một mục “Kỹ thuật bảo trì”.
const EMAIL_MINH = 'minh@linewatch.vn';
const success = data => ({ ok: true, data, error: null });
const failure = (code, message) => ({ ok: false, data: null, error: { code, message } });

function session() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getActiveSession() { return session(); }

export async function getCurrentUser() {
  try {
    const active = session();
    if (!active) return success(null);
    const data = await readStore();
    const user = data.users.find(item => item.id === active.userId && item.active);
    return success(user || null);
  } catch (error) { return failure('STORAGE_ERROR', error.message); }
}

export async function loginDemo(role, remember = false, userId = null) {
  try {
    const data = await readStore();
    const user = data.users.find(item => item.role === role && item.active && (!userId || item.id === userId));
    if (!user) return failure('NOT_FOUND', 'Không có tài khoản demo cho vai trò này.');
    const value = JSON.stringify({ userId: user.id, role: user.role });
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, value);
    return success(user);
  } catch (error) { return failure('STORAGE_ERROR', error.message); }
}

export async function loginWithCredentials(email, password, remember = false) {
  const normalized = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !password)
    return failure('VALIDATION_ERROR', 'Nhập email hợp lệ và mật khẩu.');
  const role = Object.keys(DEMO_EMAILS).find(key => DEMO_EMAILS[key] === normalized);
  if ((!role && normalized !== EMAIL_MINH) || password !== '123456')
    return failure('FORBIDDEN', 'Email hoặc mật khẩu không đúng. Hãy kiểm tra và thử lại.');
  return normalized === EMAIL_MINH
    ? loginDemo('maintenance', remember, 'USR-MT-02')
    : loginDemo(role, remember);
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export async function requestPasswordReset(email) {
  const normalized = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    return failure('VALIDATION_ERROR', 'Nhập địa chỉ email hợp lệ.');
  try {
    const role = Object.keys(DEMO_EMAILS).find(key => DEMO_EMAILS[key] === normalized);
    if (!role && normalized !== EMAIL_MINH)
      return failure('NOT_FOUND', 'Email này chưa có trong tài khoản demo.');
    sessionStorage.setItem(RESET_KEY, JSON.stringify({ email: normalized, requestedAt: Date.now() }));
    return success({ email: normalized, simulated: true });
  } catch (error) { return failure('STORAGE_ERROR', error.message); }
}

export function lastPasswordReset() {
  try { return JSON.parse(sessionStorage.getItem(RESET_KEY) || 'null'); }
  catch { return null; }
}
