'use strict';

(function () {
  const user = initPage('settings', 'Pengaturan', 'Konfigurasi aplikasi dan toko');
  if (!user) return;

  const isAdmin = user.role === 'admin';

  function updatePrinterFields() {
    const mode = document.getElementById('f-printer-mode').value;
    const networkEscpos = mode === 'escpos';
    const usbEscpos = mode === 'escpos-usb';
    document.getElementById('windows-printer-group').style.display = networkEscpos ? 'none' : '';
    document.getElementById('escpos-printer-group').style.display = networkEscpos ? '' : 'none';
    document.getElementById('usb-printer-help').style.display = usbEscpos ? '' : 'none';
  }

  async function loadPrinters(selectedName) {
    const printers = (await callApi(window.api.receipt.listPrinters(), { silent: true })) || [];
    const select = document.getElementById('f-printer-name');
    select.innerHTML = '<option value="">Pilih printer saat mencetak</option>' + printers.map((printer) => `<option value="${String(printer.name).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${String(printer.displayName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`).join('');
    select.value = selectedName || '';
  }

  async function loadSettings() {
    const s = await callApi(window.api.settings.get());
    if (!s) return;
    document.getElementById('f-store-name').value = s.store_name || '';
    document.getElementById('f-address').value = s.address || '';
    document.getElementById('f-phone').value = s.phone || '';
    document.getElementById('f-email').value = s.email || '';
    document.getElementById('f-owner').value = s.owner_name || '';
    document.getElementById('f-note').value = s.receipt_note || '';
    document.getElementById('f-printer-mode').value = s.printer_mode || 'windows';
    document.getElementById('f-escpos-host').value = s.escpos_host || '';
    document.getElementById('f-escpos-port').value = s.escpos_port || 9100;
    await loadPrinters(s.printer_name);
    updatePrinterFields();
  }

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const payload = {
      store_name: document.getElementById('f-store-name').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      owner_name: document.getElementById('f-owner').value.trim(),
      receipt_note: document.getElementById('f-note').value.trim(),
      printer_mode: document.getElementById('f-printer-mode').value,
      printer_name: document.getElementById('f-printer-name').value,
      escpos_host: document.getElementById('f-escpos-host').value.trim(),
      escpos_port: Number(document.getElementById('f-escpos-port').value) || 9100
    };
    const res = await callApi(window.api.settings.update(payload));
    if (res) toast('Pengaturan berhasil disimpan');
  });

  document.getElementById('f-printer-mode').addEventListener('change', updatePrinterFields);

  /* ---------------- USERS ---------------- */
  async function loadUsers() {
    const users = (await callApi(window.api.auth.listUsers())) || [];
    const listEl = document.getElementById('user-list');
    listEl.innerHTML = users
      .map(
        (u) => `
        <div class="flex items-center justify-between" style="padding:10px 0; border-bottom:1px solid var(--border);">
          <div class="flex items-center gap-3">
            <div class="avatar">${initials(u.full_name)}</div>
            <div>
              <div class="font-semibold text-sm">${u.full_name}</div>
              <div class="text-xs text-muted">@${u.username} &bull; ${u.role === 'admin' ? 'Admin' : 'Kasir'}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${u.active ? 'badge-green' : 'badge-gray'}">${u.active ? 'Aktif' : 'Nonaktif'}</span>
            ${
              isAdmin && u.id !== user.id
                ? `<button class="btn btn-secondary btn-sm" data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Nonaktifkan' : 'Aktifkan'}</button>`
                : ''
            }
          </div>
        </div>`
      )
      .join('');

    listEl.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = Number(b.getAttribute('data-toggle'));
        const active = b.getAttribute('data-active') === '1' || b.getAttribute('data-active') === 'true';
        const res = await callApi(window.api.auth.setUserActive(id, !active));
        if (res) {
          toast('Status pengguna berhasil diperbarui');
          loadUsers();
        }
      })
    );
  }

  document.getElementById('btn-add-user').addEventListener('click', () => {
    if (!isAdmin) {
      toast('Hanya admin yang dapat menambah pengguna', 'error');
      return;
    }
    const html = `
      <div class="modal-header"><h3>Tambah Pengguna</h3><button class="modal-close" id="m-close">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Nama Lengkap</label><input class="input" id="f-fullname" /></div>
        <div class="form-group"><label>Username</label><input class="input" id="f-username" /></div>
        <div class="form-group"><label>Password</label><input class="input" type="password" id="f-password" /></div>
        <div class="form-group">
          <label>Role</label>
          <select class="input" id="f-role"><option value="kasir">Kasir</option><option value="admin">Admin</option></select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="m-cancel">Batal</button>
        <button class="btn btn-primary" id="m-save">Simpan</button>
      </div>
    `;
    const overlay = openModal(html);
    overlay.querySelector('#m-close').addEventListener('click', closeModal);
    overlay.querySelector('#m-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#m-save').addEventListener('click', async () => {
      const payload = {
        full_name: overlay.querySelector('#f-fullname').value.trim(),
        username: overlay.querySelector('#f-username').value.trim(),
        password: overlay.querySelector('#f-password').value,
        role: overlay.querySelector('#f-role').value
      };
      if (!payload.full_name || !payload.username || !payload.password) {
        toast('Semua field wajib diisi', 'error');
        return;
      }
      const res = await callApi(window.api.auth.createUser(payload));
      if (res) {
        toast('Pengguna berhasil ditambahkan');
        closeModal();
        loadUsers();
      }
    });
  });

  /* ---------------- BACKUP / RESTORE ---------------- */
  document.getElementById('btn-backup').addEventListener('click', async () => {
    const res = await callApi(window.api.backup.create());
    if (res && !res.canceled) toast('Backup database berhasil disimpan');
  });

  document.getElementById('btn-restore').addEventListener('click', () => {
    confirmDialog(
      'Restore Database?',
      'Data saat ini akan digantikan dengan data dari file backup yang dipilih. Aplikasi akan dimuat ulang secara otomatis.',
      async () => {
        const res = await callApi(window.api.backup.restore());
        if (res && !res.canceled) toast('Database berhasil dipulihkan, memuat ulang aplikasi...');
      }
    );
  });

  document.getElementById('btn-open-folder').addEventListener('click', () => window.api.backup.openFolder());

  loadSettings();
  loadUsers();
})();
