/**
 * js/app.js
 * Dynamic router / boot loader for LineWatch.
 * Loads the correct module based on the current HTML page.
 */

const ROUTES = {
  "operator-line-status.html": () =>
    import("./modules/operator/line-status.js"),
  "operator-incident-create.html": () =>
    import("./modules/operator/incident-create.js"),
  "operator-shift-incidents.html": () =>
    import("./modules/operator/shift-incidents.js"),
  "admin-line-management.html": () =>
    import("./modules/admin/line-management.js"),
  "register.html": () => import("./modules/auth/register.js"),
  "register-pending.html": () => import("./modules/auth/register-status.js"),
  "register-error.html": () => import("./modules/auth/register-status.js")
};

export function pageFromPath(pathname) {
  // Netlify có thể chuyển /pages/ten.html thành /pages/ten; cả hai phải nạp cùng module.
  const segment = pathname.split("/").filter(Boolean).pop() || "";
  return segment.endsWith(".html") ? segment : `${segment}.html`;
}

async function boot() {
  const page = pageFromPath(location.pathname);
  const loader = ROUTES[page];
  if (!loader) {
    console.warn(`[app] No module registered for ${page}`);
    return;
  }

  const role = page.startsWith('operator-') ? 'operator' : page.startsWith('admin-') ? 'admin' : null;
  if (role) {
    const { getCurrentUser } = await import('./auth.js');
    const current = await getCurrentUser();
    if (!current.ok || !current.data) {
      location.replace('../pages/01-dang-nhap/login.html'); return;
    }
    if (current.data.role !== role) { location.replace('../pages/403.html'); return; }
  }

  try {
    await loader();
    console.log(`[app] Loaded module for ${page}`);
  } catch (err) {
    console.error(`[app] Failed to load module for ${page}`, err);
    const container = document.querySelector("#content, main, body");
    if (container) {
      const notice = document.createElement('div');
      notice.className = 'notice error';
      notice.textContent = 'Không tải được trang: ' + (err.message || 'Vui lòng thử lại.');
      container.replaceChildren(notice);
    }
  }
}

if (typeof document !== 'undefined') boot();
