/**
 * js/modules/auth/register-status.js
 * Trang trạng thái đăng ký (register-pending.html / register-error.html).
 * Chỉ hiển thị lại thông tin yêu cầu đăng ký gần nhất do register.js lưu lại.
 */

import { getLastRegistration } from "../shared/api.js";
import { $ } from "../shared/ui.js";

export function init() {
  const pendingUser = $("#pending-user");
  if (!pendingUser) return;

  const reg = getLastRegistration();
  if (reg) {
    pendingUser.textContent = `${reg.name} · ${reg.email} · mã NV ${reg.employeeId}.`;
  }
}

init();