const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );

export function openModal(options = {}) {
  const {
    title = "Xác nhận",
    description = "",
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy",
    danger = false,
  } = options;

  return new Promise((resolve) => {
    const opener = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-labelledby", "confirm-title");
    dialog.innerHTML = `
      <form method="dialog">
        <h3 id="confirm-title">${esc(title)}</h3>
        ${description ? `<p class="modal-desc">${esc(description)}</p>` : ""}
        <div class="modal-actions">
          <button type="submit" class="btn" value="cancel">${esc(cancelLabel)}</button>
          <button type="submit" class="btn ${danger ? "danger" : "pri"}" value="confirm">${esc(confirmLabel)}</button>
        </div>
      </form>`;

    dialog.addEventListener(
      "close",
      () => {
        const confirmed = dialog.returnValue === "confirm";
        dialog.remove();
        if (opener?.isConnected && !opener.disabled) opener.focus();
        resolve({ confirmed });
      },
      { once: true },
    );
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });

    document.body.append(dialog);
    dialog.showModal();
  });
}
