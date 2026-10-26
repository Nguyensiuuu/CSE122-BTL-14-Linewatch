import { requestPasswordReset } from '../../js/api.js';
import { thongBaoNoi } from '../../js/ui.js';

const form = document.getElementById('reset-form');
const input = document.getElementById('reset-email');
const error = document.getElementById('reset-error');
async function send() {
  const result = await requestPasswordReset(input.value);
  if (!result.ok) { error.textContent = result.error.message; error.hidden = false; return; }
  error.hidden = true;
  document.getElementById('request-panel').hidden = true;
  document.getElementById('sent-panel').hidden = false;
  document.getElementById('sent-email').textContent = result.data.email;
}
form.addEventListener('submit', event => { event.preventDefault(); send(); });
document.getElementById('resend').addEventListener('click', async () => {
  const result = await requestPasswordReset(input.value);
  thongBaoNoi(result.ok ? 'Đã ghi nhận lại yêu cầu mô phỏng.' : result.error.message, result.ok ? 'success' : 'error');
});
input.addEventListener('input', () => { error.hidden = true; });
