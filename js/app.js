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

async function boot() {
  const page = location.pathname.split("/").pop();
  const loader = ROUTES[page];
  if (!loader) {
    console.warn(`[app] No module registered for ${page}`);
    return;
  }

  try {
    await loader();
    console.log(`[app] Loaded module for ${page}`);
  } catch (err) {
    console.error(`[app] Failed to load module for ${page}`, err);
    const container = document.querySelector("#content, main, body");
    if (container) {
      container.innerHTML = `
        <div class="notice error">
          <b>Không tải được module.</b><br>
          ${err.message || "Vui lòng thử lại."}
        </div>`;
    }
  }
}

boot();
