/* Giao diện và thanh thao tác chung cho bốn vai trò LineWatch. */
(() => {
  if (window.__linewatchThemeReady) return;
  window.__linewatchThemeReady = true;
  const khoa = 'linewatch-theme';
  const gocDuAn = new URL('../', document.currentScript?.src || location.href);
  const vaiTro = [
    ['operator', 'Công nhân vận hành', 'pages/operator-line-status.html'],
    ['supervisor', 'Trưởng ca', 'pages/supervisor-shift-dashboard.html'],
    ['maintenance', 'Kỹ thuật bảo trì', 'pages/08-hang-cho/maintenance-queue.html'],
    ['admin', 'Quản trị viên', 'pages/admin-machine-management.html']
  ];
  let mau = 'light';
  try { mau = localStorage.getItem(khoa) === 'dark' ? 'dark' : 'light'; } catch {}
  document.documentElement.dataset.theme = mau;

  function capNhatNut() {
    const toi = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(nut => {
      nut.textContent = toi ? '☀ Chế độ sáng' : '◐ Chế độ tối';
      nut.setAttribute('aria-pressed', String(toi));
    });
  }

  async function capNhatCa() {
    const sidebar = document.querySelector('.sidebar, .side, .thanh-ben');
    const vung = sidebar?.querySelector('.shift, .cur, .thong-tin-ca');
    if (!vung || vung.dataset.caDaGan) return;
    vung.dataset.caDaGan = 'true';
    try {
      const { getShifts } = await import(new URL('js/api.js', gocDuAn));
      const ketQua = await getShifts();
      if (!ketQua.ok || !vung.isConnected) return;
      const bayGio = Date.now();
      const cacCa = ketQua.data || [];
      const dangMo = cacCa.find(ca => new Date(ca.startsAt).getTime() <= bayGio &&
        bayGio < new Date(ca.endsAt).getTime());
      const ganNhat = [...cacCa].sort((a, b) =>
        String(b.startsAt).localeCompare(String(a.startsAt)))[0];
      const ca = dangMo || ganNhat;
      const gio = ngay => new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
      }).format(new Date(ngay));
      const nhan = document.createElement('small');
      nhan.textContent = dangMo ? 'Ca hiện tại' : 'Ca demo được chọn';
      const tenCa = document.createElement('strong');
      tenCa.textContent = ca ? `${ca.name} · ${gio(ca.startsAt)}–${gio(ca.endsAt)}` : 'Chưa có ca';
      const xuong = document.createElement('small');
      xuong.textContent = 'Tổ A · Xưởng 01';
      vung.replaceChildren(nhan, tenCa, xuong);
    } catch (loi) {
      vung.dataset.caDaGan = '';
      console.warn('Không tải được thông tin ca:', loi);
    }
  }

  function taoThanhTren(header) {
    if (header.dataset.chungDaGan) return;
    const vung = header.querySelector('.thao-tac-tren, .topbar-meta') || header;
    // Chờ tiêu đề của header động được dựng xong.
    if (!header.querySelector('h1, h2, .tieu-de-tren') || !vung) return;
    header.dataset.chungDaGan = 'true';
    const ngay = header.querySelector('.date, .ngay-hom-nay');
    if (ngay) ngay.textContent = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date());
    if (document.querySelector('.sidebar, .side, .thanh-ben')) {
      const nutMenu = document.createElement('button');
      nutMenu.type = 'button'; nutMenu.className = 'nut-chung nut-menu';
      nutMenu.textContent = '☰ Menu'; nutMenu.setAttribute('aria-expanded', 'false');
      nutMenu.setAttribute('aria-label', 'Mở menu điều hướng');
      header.insertBefore(nutMenu, header.firstChild);
    }
    vung.querySelectorAll('[data-theme-toggle], #logout, .ho-so, .user, .icon-btn, .bell').forEach(nut => nut.remove());

    const nhom = document.createElement('div');
    nhom.className = 'thao-tac-chung';
    nhom.innerHTML = `<button type="button" data-theme-toggle class="nut-chung"></button>
      <a class="nut-chung thong-bao-chung" href="${new URL('pages/notifications.html', gocDuAn).href}" aria-label="Thông báo">Thông báo <span data-so-thong-bao>0</span></a>
      <details class="chon-vai-tro"><summary class="nut-chung" aria-label="Chọn vai trò">Vai trò</summary>
        <div class="menu-vai-tro" role="group" aria-label="Chuyển vai trò"></div></details>
      <button type="button" class="nut-chung dang-xuat-chung">Đăng xuất</button>`;
    const menu = nhom.querySelector('.menu-vai-tro');
    for (const [ma, ten] of vaiTro) {
      const nut = document.createElement('button');
      nut.type = 'button'; nut.dataset.chuyenVaiTro = ma; nut.textContent = ten;
      menu.append(nut);
    }
    vung.append(nhom);
    capNhatNut();
    capNhatTaiKhoan(nhom);
    capNhatThongBao(nhom);
    capNhatCa();
  }

  async function capNhatTaiKhoan(nhom) {
    try {
      const { getCurrentUser } = await import(new URL('js/auth.js', gocDuAn));
      const ketQua = await getCurrentUser();
      if (!nhom.isConnected || !ketQua.ok || !ketQua.data) return;
      const nguoi = ketQua.data;
      nhom.querySelector('.chon-vai-tro summary').textContent = '● ' +
        (vaiTro.find(([ma]) => ma === nguoi.role)?.[1] || nguoi.role) +
        (nguoi.role === 'maintenance' ? ` · ${nguoi.name.replace(/^Kỹ thuật viên\s*/, '')}` : '');
      nhom.querySelectorAll('[data-chuyen-vai-tro]').forEach(nut => {
        nut.disabled = nut.dataset.chuyenVaiTro === nguoi.role && nguoi.role !== 'maintenance';
        if (nut.dataset.chuyenVaiTro === 'maintenance' && nguoi.role === 'maintenance') {
          nut.textContent = 'Đổi kỹ thuật viên bảo trì';
        }
        if (nut.disabled) nut.setAttribute('aria-current', 'true');
      });
    } catch (loi) { console.warn('Không đọc được phiên:', loi); }
  }

  async function capNhatThongBao(nhom) {
    try {
      const { getNotifications } = await import(new URL('js/api.js', gocDuAn));
      const ketQua = await getNotifications();
      if (!nhom.isConnected || !ketQua.ok) return;
      const so = ketQua.data.filter(tin => !tin.read).length;
      nhom.querySelector('[data-so-thong-bao]').textContent = String(so);
      nhom.querySelector('.thong-bao-chung').setAttribute('aria-label', `${so} thông báo chưa đọc`);
    } catch (loi) { console.warn('Không tải được thông báo:', loi); }
  }

  function khoiTao() {
    capNhatNut();
    const xuLyHeader = () => document.querySelectorAll('.thanh-tren, .topbar, .top').forEach(taoThanhTren);
    xuLyHeader();
    const theoDoi = new MutationObserver(xuLyHeader);
    theoDoi.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('linewatch:data-changed', () => {
      document.querySelectorAll('.thao-tac-chung').forEach(capNhatThongBao);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoiTao, { once: true });
  else khoiTao();

  document.addEventListener('click', async event => {
    const nutMenu = event.target.closest('.nut-menu');
    if (nutMenu) {
      const sidebar = document.querySelector('.sidebar, .side, .thanh-ben');
      const mo = sidebar?.classList.toggle('menu-mo') || false;
      nutMenu.setAttribute('aria-expanded', String(mo));
      nutMenu.setAttribute('aria-label', mo ? 'Đóng menu điều hướng' : 'Mở menu điều hướng');
      if (mo) {
        sidebar.scrollIntoView({ block: 'start' });
        sidebar.querySelector('nav a, .danh-sach-dieu-huong a')?.focus();
      }
      return;
    }
    if (!event.target.closest('.chon-vai-tro')) {
      document.querySelectorAll('.chon-vai-tro[open]').forEach(menu => menu.open = false);
    }
    const chuyen = event.target.closest('[data-chuyen-vai-tro]');
    if (chuyen) {
      const ma = chuyen.dataset.chuyenVaiTro;
      chuyen.disabled = true;
      try {
        const { loginDemo } = await import(new URL('js/auth.js', gocDuAn));
        let nguoiDuocChon = null;
        if (ma === 'maintenance') {
          const { getUsers } = await import(new URL('js/api.js', gocDuAn));
          const { openModal, esc } = await import(new URL('js/modules/shared/ui.js', gocDuAn));
          const danhSach = await getUsers();
          if (!danhSach.ok) throw new Error(danhSach.error.message);
          const kyThuatVien = danhSach.data.filter(nguoi => nguoi.role === 'maintenance' && nguoi.active);
          if (!kyThuatVien.length) throw new Error('Chưa có kỹ thuật viên bảo trì đang hoạt động.');
          const ketQuaChon = await openModal({
            title: 'Chọn tài khoản bảo trì',
            description: 'Hàng chờ chỉ hiện công việc giao cho đúng kỹ thuật viên được chọn.',
            body: `<div class="field"><label for="chon-ky-thuat-vien">Kỹ thuật viên</label>
              <select id="chon-ky-thuat-vien" name="kyThuatVien">${kyThuatVien.map(nguoi =>
                `<option value="${esc(nguoi.id)}">${esc(nguoi.name)}</option>`).join('')}</select></div>`,
            confirmLabel: 'Vào hàng chờ',
            onSubmit: ({ form }) => ({ ok: true, data: form.elements.kyThuatVien.value })
          });
          if (!ketQuaChon.confirmed) { chuyen.disabled = false; chuyen.focus(); return; }
          nguoiDuocChon = ketQuaChon.data;
        }
        const ketQua = await loginDemo(ma, false, nguoiDuocChon);
        if (!ketQua.ok) throw new Error(ketQua.error.message);
        location.href = new URL(vaiTro.find(([vai]) => vai === ma)[2], gocDuAn).href;
      } catch (loi) {
        const { toast } = await import(new URL('js/modules/shared/ui.js', gocDuAn));
        toast(loi.message, { type: 'error' });
        chuyen.disabled = false;
      }
      return;
    }
    if (event.target.closest('.dang-xuat-chung')) {
      const { logout } = await import(new URL('js/auth.js', gocDuAn));
      logout();
      location.href = new URL('pages/01-dang-nhap/login.html', gocDuAn).href;
      return;
    }
    const nut = event.target.closest('[data-theme-toggle]');
    if (!nut) return;
    const moi = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = moi;
    try { localStorage.setItem(khoa, moi); } catch {}
    capNhatNut();
    window.dispatchEvent(new CustomEvent('linewatch:theme-changed', { detail: moi }));
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    // Dialog tự xử lý Esc. Không chuyển focus ra menu nằm phía sau dialog.
    if (document.querySelector('dialog[open]')) return;
    document.querySelectorAll('.sidebar.menu-mo, .side.menu-mo, .thanh-ben.menu-mo').forEach(sidebar => {
      sidebar.classList.remove('menu-mo');
      const nut = document.querySelector('.nut-menu');
      if (nut) { nut.setAttribute('aria-expanded', 'false'); nut.focus(); }
    });
    document.querySelectorAll('.chon-vai-tro[open]').forEach(menu => {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    });
  });
})();
