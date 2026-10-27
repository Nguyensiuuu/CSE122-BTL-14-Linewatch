/**
 * js/modules/auth/register.js
 * Khung đăng ký tài khoản (register.html).
 */

import { submitRegistration, setFlash } from "../shared/api.js";
import { $, toast, clearFormErrors, showFormError, setFieldError } from "../shared/ui.js";

export function init() {
  const form = $("#register-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const payload = {
      name: $("#fullName")?.value.trim(),
      email: $("#email")?.value.trim(),
      employeeId: $("#employeeId")?.value.trim(),
      password: $("#password")?.value || "",
      confirmPassword: $("#confirmPassword")?.value || "",
      terms: $("#terms")?.checked
    };

    try {
      const reg = submitRegistration(payload);
      setFlash(`Yêu cầu đăng ký của ${reg.name} đã được gửi.`, "success");
      window.location.href = "register-pending.html";
    } catch (err) {
      // API trả về field dạng "name" — trang dùng id "fullName", nên cần ánh xạ.
      const FIELD_IDS = {
        name: "fullName",
        email: "email",
        employeeId: "employeeId",
        password: "password",
        confirmPassword: "confirmPassword",
        terms: "terms"
      };
      const input = $(`#${FIELD_IDS[err.field] || err.field}`);
      if (input) setFieldError(input, err.message);
      showFormError(form, err.message || "Đăng ký thất bại.");
    }
  });
}

init();
