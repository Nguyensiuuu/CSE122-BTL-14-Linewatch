import { loginDemo, loginWithCredentials } from '../api.js';
import { thongBaoNoi } from '../ui.js';

const form = document.getElementById('login-form');
const error = document.getElementById('login-error');
const routes = {
  maintenance: 'maintenance-queue.html',
  operator: 'operator-line-status.html',
  supervisor: 'supervisor-shift-dashboard.html',
  admin: 'admin-line-management.html'
};

async function enter(result) {
  if (!result.ok) {
    error.textContent = result.error.message;
    error.hidden = false;
    document.getElementById('password').setAttribute('aria-invalid', 'true');
    return;
  }
  error.hidden = true;
  const target = routes[result.data.role];
  if (result.data.role === 'maintenance') { location.href = target; return; }
  try {
    const response = await fetch(target, { method: 'HEAD' });
    if (response.ok) { location.href = target; return; }
  } catch {}
  thongBaoNoi(`Đã đăng nhập vai trò ${result.data.name}. Màn hình của Thắng/Sơn sẽ xuất hiện khi ghép phần việc.`, 'success');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !form.elements.email.validity.valid || !password) {
    error.textContent = 'Nhập email hợp lệ và mật khẩu.';
    error.hidden = false;
    return;
  }
  await enter(await loginWithCredentials(email, password, document.getElementById('remember').checked));
});
document.querySelectorAll('[data-demo-role]').forEach(button => button.addEventListener('click', async () => {
  await enter(await loginDemo(button.dataset.demoRole, document.getElementById('remember').checked));
}));
document.getElementById('register-link').addEventListener('click', async event => {
  event.preventDefault();
  try {
    if ((await fetch('register.html', { method: 'HEAD' })).ok) { location.href = 'register.html'; return; }
  } catch {}
  thongBaoNoi('Form đăng ký thuộc phần của Thắng; ghép register.html để mở luồng này.');
});
form.addEventListener('input', () => { error.hidden = true; document.getElementById('password').removeAttribute('aria-invalid'); });
