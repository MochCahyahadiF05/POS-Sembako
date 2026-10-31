'use strict';

/* =========================================================
   common.js - dipakai di semua halaman renderer
   ========================================================= */

/* ---------------- Icon system (SVG, bukan emoji) ---------------- */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  cart: '<circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/><path d="M2.5 3h2l2.3 12a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.6L21 8H6.2"/>',
  package: '<path d="M21 8.2 12 3.2 3 8.2v7.2L12 20.5l9-5.1z"/><path d="M3 8.2 12 13.4l9-5.2"/><path d="M12 13.4V20.5"/>',
  arrowDownCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v8"/><path d="M8.3 12 12 15.7 15.7 12"/>',
  arrowUpCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-8"/><path d="M8.3 12 12 8.3 15.7 12"/>',
  flame: '<path d="M12 2.7c1.1 2.8-2.7 4.6-2.7 8.1a2.7 2.7 0 0 0 5.4 0c0-1-.6-1.8-1-2.5.8.4 2 1.7 2 4.1a4.7 4.7 0 0 1-9.4 0c0-4.3 3.3-5.9 5.7-9.7z"/>',
  wallet: '<path d="M4 6.2A1.8 1.8 0 0 1 5.8 4.4h11.4A1.8 1.8 0 0 1 19 6.2v1h1a1.8 1.8 0 0 1 1.8 1.8v7A1.8 1.8 0 0 1 20 17.8H5.8A1.8 1.8 0 0 1 4 16z"/><path d="M16.3 12.8h2.4"/>',
  barChart: '<path d="M4 20.5V10.5"/><path d="M11 20.5V4"/><path d="M18 20.5v-7"/><path d="M2.5 20.5h19"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.7v2.5M12 18.8v2.5M4.3 6.3l1.8 1.8M17.9 17.9l1.8 1.8M2.7 12h2.5M18.8 12h2.5M4.3 17.7l1.8-1.8M17.9 6.1l1.8-1.8"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.3V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.3"/><path d="M9.5 21v-6.2h5V21"/>',
  bell: '<path d="M6 8.3a6 6 0 0 1 12 0c0 4.8 1.9 5.9 1.9 5.9H4.1S6 13.1 6 8.3z"/><path d="M10.1 18.8a1.9 1.9 0 0 0 3.8 0"/>',
  logOut: '<path d="M9.3 20.5H5.3a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h4"/><path d="M15.8 16.5l4.5-4.5-4.5-4.5"/><path d="M20.3 12h-11.8"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.3"/><circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3 10.5 15 16 9.3"/>',
  alertTriangle: '<path d="M12 3.3 22 20.3H2z"/><path d="M12 9.5v4.8"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>',
  helpCircle: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.4a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
  wheat: '<path d="M12 21.5V5"/><path d="M12 8.3c-1.6-1.6-4-1.6-5.6 0M12 8.3c1.6-1.6 4-1.6 5.6 0"/><path d="M12 12.3c-1.6-1.6-4-1.6-5.6 0M12 12.3c1.6-1.6 4-1.6 5.6 0"/><path d="M12 16.3c-1.6-1.6-4-1.6-5.6 0M12 16.3c1.6-1.6 4-1.6 5.6 0"/>',
  egg: '<path d="M12 22c4.4 0 7-3.7 7-8.6C19 7.6 15.4 2 12 2S5 7.6 5 13.4C5 17.6 7.6 22 12 22z"/>',
  search: '<circle cx="10.3" cy="10.3" r="6.3"/><path d="M20 20l-4.6-4.6"/>',
  refreshSwap: '<path d="M3.5 12a8.5 8.5 0 0 1 14.5-6"/><path d="M18 2.8v4.7h-4.7"/><path d="M20.5 12a8.5 8.5 0 0 1-14.5 6"/><path d="M6 21.2v-4.7h4.7"/>',
  banknote: '<rect x="2.3" y="6.2" width="19.4" height="11.6" rx="1.8"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 9v0M18.5 15v0"/>',
  plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7.8v8.4M7.8 12h8.4"/>',
  sliders: '<path d="M4 6h8.5M16.5 6h3.5"/><circle cx="14" cy="6" r="2"/><path d="M4 12h3M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h8.5M16.5 18h3.5"/><circle cx="14" cy="18" r="2"/>',
  truck: '<rect x="1.7" y="7" width="12" height="9.3" rx="1.1"/><path d="M13.7 10h3.8l3.1 3.2v3.1h-6.9"/><circle cx="6.3" cy="18.2" r="1.7"/><circle cx="17.3" cy="18.2" r="1.7"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/><path d="M6.5 7 7.3 19.6a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  printer: '<path d="M6.3 9V3.3h11.4V9"/><rect x="4.5" y="9" width="15" height="7" rx="1.3"/><path d="M6.3 14.5h11.4V20.7H6.3z"/>',
  fileText: '<path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/><path d="M14 2.5V7h4"/><path d="M8 12.6h8M8 16h8M8 9.2h3"/>',
  fileSpreadsheet: '<path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/><path d="M14 2.5V7h4"/><path d="M8 12.2h8M8 16h8M11 12.2v7.8"/>',
  folder: '<path d="M3 6.7a1.5 1.5 0 0 1 1.5-1.5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.7v8.8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5"/><path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12"/>',
  upload: '<path d="M12 15.3V4"/><path d="M8 8.2 12 4l4 4.2"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v11.3"/><path d="M8 10.8l4 4.2 4-4.2"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3A4.5 4.5 0 0 1 15 18.5V20"/><circle cx="17.2" cy="8.5" r="2.4"/><path d="M16.3 14.2c2.5.4 4.2 1.9 4.2 4.3V20"/>',
  star: '<path d="M12 2.6l2.9 5.9 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6-4.8-4.6 6.6-.9z"/>',
  trendingUp: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  trendingDown: '<path d="M3 7l6 6 4-4 8 9"/><path d="M15 18h6v-6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  box: '<path d="M21 7.8 12 3 3 7.8v8.4L12 21l9-4.8z"/><path d="M3 7.8 12 12.5l9-4.7"/><path d="M12 12.5V21"/>',
  edit: '<path d="M4 17.3V20h2.7L17.8 8.9l-2.7-2.7z"/><path d="M15.9 5 18.6 7.7"/>',
  gasDrop: '<path d="M12 2.7c1.1 2.8-2.7 4.6-2.7 8.1a2.7 2.7 0 0 0 5.4 0c0-1-.6-1.8-1-2.5.8.4 2 1.7 2 4.1a4.7 4.7 0 0 1-9.4 0c0-4.3 3.3-5.9 5.7-9.7z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.2"/><path d="M8 7h1.4M8 11h1.4M8 15h1.4M14.6 7H16M14.6 11H16M14.6 15H16"/><path d="M10 21v-4h4v4"/>'
};

function icon(name, opts = {}) {
  const size = opts.size || 18;
  const strokeWidth = opts.strokeWidth || 1.8;
  const cls = opts.class || '';
  const path = ICON_PATHS[name] || ICON_PATHS.box;
  return `<svg class="icon-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${path}</svg>`;
}


const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: 'dashboard.html' },
  { key: 'kasir', label: 'Kasir', icon: 'cart', href: 'kasir.html' },
  { key: 'products', label: 'Produk & Stok', icon: 'package', href: 'products.html' },
  { key: 'stock-in', label: 'Barang Masuk', icon: 'arrowDownCircle', href: 'stock-in.html' },
  { key: 'stock-out', label: 'Barang Keluar', icon: 'arrowUpCircle', href: 'stock-out.html' },
  { key: 'gas', label: 'Manajemen Gas', icon: 'flame', href: 'gas.html' },
  { key: 'finance', label: 'Keuangan', icon: 'wallet', href: 'finance.html' },
  { key: 'receivables', label: 'Piutang', icon: 'wallet', href: 'receivables.html' },
  { key: 'reports', label: 'Laporan', icon: 'barChart', href: 'reports.html' },
  { key: 'settings', label: 'Pengaturan', icon: 'settings', href: 'settings.html' }
];

function currentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  } catch (e) {
    return null;
  }
}

function requireAuth() {
  const user = currentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function logout() {
  sessionStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function renderSidebar(activeKey) {
  const user = currentUser();
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  const navHtml = NAV_ITEMS.map(
    (item) => `
      <a class="nav-item ${item.key === activeKey ? 'active' : ''}" href="${item.href}">
        <span class="icon">${icon(item.icon)}</span>
        <span class="label">${item.label}</span>
        ${item.key === activeKey ? '<span class="chevron">&rsaquo;</span>' : ''}
      </a>`
  ).join('');

  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="logo">${icon('home', { size: 19 })}</div>
        <div>
          <div class="name">Kasir &amp; Usaha</div>
          <div class="sub">Manajemen Toko</div>
        </div>
      </div>
      <nav class="nav">${navHtml}</nav>
      <div class="sidebar-user">
        <div class="avatar">${initials(user ? user.full_name : '?')}</div>
        <div class="info">
          <div class="uname">${user ? user.full_name : 'Tamu'}</div>
          <div class="urole">${user ? (user.role === 'admin' ? 'Admin' : 'Kasir') : ''}</div>
        </div>
        <button class="logout" id="btn-logout" title="Keluar">${icon('logOut', { size: 17 })}</button>
      </div>
    </aside>
  `;

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => confirmDialog('Keluar dari aplikasi?', 'Anda perlu login kembali untuk mengakses sistem.', logout));
}

function renderHeader(title, subtitle) {
  const container = document.getElementById('header-container');
  if (!container) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${title}</h1>
        <div class="subtitle">${subtitle || ''}</div>
      </div>
      <div class="right">
        <div class="date">${dateStr}</div>
        <div class="bell"><span class="dot"></span>${icon('bell', { size: 17 })}</div>
      </div>
    </div>
  `;
}

/* ---------------- Formatting ---------------- */
function rupiah(n) {
  n = Number(n) || 0;
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function numFmt(n, decimals = null) {
  n = Number(n) || 0;
  const fractionDigits = decimals == null ? 2 : decimals;
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: decimals == null ? 0 : decimals,
    maximumFractionDigits: fractionDigits
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/* ---------------- API wrapper ---------------- */
async function callApi(promise, { silent = false } = {}) {
  try {
    const res = await promise;
    if (!res.ok) {
      if (!silent) toast(res.error || 'Terjadi kesalahan', 'error');
      return null;
    }
    return res.data;
  } catch (err) {
    if (!silent) toast(err.message || 'Terjadi kesalahan', 'error');
    return null;
  }
}

/* ---------------- Toast ---------------- */
function ensureToastContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

function toast(message, type = 'success') {
  const c = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const iconName = type === 'error' ? 'xCircle' : type === 'info' ? 'info' : 'checkCircle';
  el.innerHTML = `<span class="toast-icon">${icon(iconName, { size: 17 })}</span><span>${message}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s ease';
    setTimeout(() => el.remove(), 200);
  }, 2800);
}

/* ---------------- Modal helpers ---------------- */
function openModal(innerHtml, { size = '' } = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal-overlay';
  overlay.innerHTML = `<div class="modal ${size}">${innerHtml}</div>`;
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal() {
  const existing = document.getElementById('active-modal-overlay');
  if (existing) existing.remove();
}

function confirmDialog(title, message, onConfirm, { confirmLabel = 'Ya, Lanjutkan', danger = true } = {}) {
  const html = `
    <div class="modal-body" style="text-align:center;">
      <div class="confirm-icon" style="margin:0 auto 12px;">${icon(danger ? 'alertTriangle' : 'helpCircle', { size: 22 })}</div>
      <h3 style="margin-bottom:6px;">${title}</h3>
      <p class="text-muted text-sm">${message || ''}</p>
    </div>
    <div class="modal-footer" style="justify-content:center;">
      <button class="btn btn-secondary" id="confirm-cancel">Batal</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${confirmLabel}</button>
    </div>
  `;
  const overlay = openModal(html);
  overlay.querySelector('#confirm-cancel').addEventListener('click', closeModal);
  overlay.querySelector('#confirm-ok').addEventListener('click', () => {
    closeModal();
    onConfirm && onConfirm();
  });
}

/* ---------------- Stock status badge ---------------- */
function stockBadge(status) {
  if (status === 'habis') return `<span class="badge badge-red"><span class="dot-status" style="background:#dc2626"></span> Stok Habis</span>`;
  if (status === 'menipis') return `<span class="badge badge-amber"><span class="dot-status" style="background:#d97706"></span> Stok Menipis</span>`;
  return `<span class="badge badge-green"><span class="dot-status" style="background:#16a34a"></span> Stok Aman</span>`;
}

function paymentBadge(method) {
  const key = String(method || '').toLowerCase();
  const labels = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS' };
  const classes = { tunai: 'badge-payment-cash', transfer: 'badge-payment-transfer', qris: 'badge-payment-qris' };
  const label = labels[key] || method || '-';
  return `<span class="badge ${classes[key] || 'badge-gray'}">${label}</span>`;
}

function categoryLabel(cat) {
  return { beras: 'Beras', telur: 'Telur', gas: 'Gas' }[cat] || cat;
}

function categoryIconName(cat) {
  return { beras: 'wheat', telur: 'egg', gas: 'flame' }[cat] || 'box';
}

function categoryIcon(cat, opts = {}) {
  return icon(categoryIconName(cat), opts);
}

// alias lama agar kode yang masih memanggil categoryEmoji tetap berfungsi
function categoryEmoji(cat) {
  return categoryIcon(cat, { size: 16 });
}

/* ---------------- Icon hydration ----------------
   Semua elemen dengan atribut data-icon="namaIkon" otomatis diisi SVG.
   Contoh: <div class="icon-badge" data-icon="wallet"></div>
   Bisa dipanggil ulang setelah render konten dinamis. */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconDone === '1') return;
    const size = Number(el.getAttribute('data-icon-size')) || 18;
    el.insertAdjacentHTML('afterbegin', icon(el.getAttribute('data-icon'), { size }));
    el.dataset.iconDone = '1';
  });
}

/* ---------------- Init page boilerplate ---------------- */
function initPage(activeKey, title, subtitle) {
  const user = requireAuth();
  if (!user) return null;
  renderSidebar(activeKey);
  renderHeader(title, subtitle);
  hydrateIcons();
  return user;
}
