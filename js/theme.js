// Loaded before the stylesheet on every page to avoid a light-theme flash.
(() => {
  const key = 'linewatch-theme';
  let saved = 'light';
  try { saved = localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch {}
  document.documentElement.dataset.theme = saved;

  function capNhatNutGiaoDien() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.textContent = dark ? '☀ Chế độ sáng' : '◐ Chế độ tối';
      button.setAttribute('aria-pressed', String(dark));
    });
  }
  document.addEventListener('DOMContentLoaded', capNhatNutGiaoDien);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(key, next); } catch {}
    capNhatNutGiaoDien();
    window.dispatchEvent(new CustomEvent('linewatch:theme-changed', { detail: next }));
  });
})();
