import { loginDemo, loginWithCredentials } from '../../js/api.js';

const form = document.getElementById('login-form');
const error = document.getElementById('login-error');
const routes = {
  maintenance: '../08-hang-cho/maintenance-queue.html',
  operator: '../operator-line-status.html',
  supervisor: '../supervisor-shift-dashboard.html',
  admin: '../admin-line-management.html'
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
  if (target) location.href = target;
  else { error.textContent = 'Vai trò này chưa có trang làm việc.'; error.hidden = false; }
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
form.addEventListener('input', () => { error.hidden = true; document.getElementById('password').removeAttribute('aria-invalid'); });
