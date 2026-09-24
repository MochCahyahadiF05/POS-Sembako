'use strict';

(function () {
  const user = initPage('stock-out', 'Barang Keluar', 'Catat barang rusak, hilang, retur, atau keperluan lain');
  if (!user) return;

  const REASONS = [
    { value: 'rusak', label: 'Barang Rusak' },
    { value: 'hilang', label: 'Barang Hilang' },
    { value: 'pribadi', label: 'Penggunaan Pribadi' },
    { value: 'retur', label: 'Barang Dikembalikan' },
    { value: 'lainnya', label: 'Lainnya' }
  ];

  function reasonLabel(v) {
    return (REASONS.find((r) => r.value === v) || {}).label || v;
  }

  let products = [];
  let rows = [], page = 1, search = '';
  const PAGE_SIZE = 20;
  const tbody = document.getElementById('table-body');

  async function loadTable() {
    rows = (await callApi(window.api.stock.listOut({}))) || [];
    const filtered = rows.filter((r) => `${r.product_name} ${reasonLabel(r.reason)} ${r.note || ''}`.toLowerCase().includes(search));
    page = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${icon('package', { size: 30 })}<div class="mt-1">Belum ada catatan barang keluar</div></div></td></tr>`;
      renderPagination(0);
      return;
    }
    tbody.innerHTML = visible
      .map(
        (r) => `
        <tr>
          <td class="text-sm">${fmtDate(r.date)}</td>
          <td class="font-semibold">${r.product_name}</td>
          <td><span class="badge badge-gray">${categoryLabel(r.category)}</span></td>
          <td>${numFmt(r.quantity)} ${r.unit}</td>
          <td><span class="badge badge-amber">${reasonLabel(r.reason)}</span></td>
          <td class="text-sm text-muted">${r.note || '-'}</td>
          <td class="text-right"><button class="btn btn-secondary btn-sm" data-edit="${r.id}">Edit</button> <button class="btn btn-danger btn-sm" data-delete="${r.id}">Hapus</button></td>
        </tr>`
      )
      .join('');
    tbody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(rows.find((r) => r.id === Number(b.dataset.edit)))));
    tbody.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => confirmDialog('Hapus barang keluar ini?', 'Stok akan dikembalikan.', async () => { if (await callApi(window.api.stock.deleteOut(Number(b.dataset.delete)))) { toast('Barang keluar dihapus'); loadTable(); loadProducts(); } })));
    renderPagination(filtered.length);
  }

  function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_SIZE), el = document.getElementById('table-pagination');
    el.innerHTML = totalPages > 1 ? `<button class="btn btn-secondary btn-sm" data-p="prev" ${page === 1 ? 'disabled' : ''}>Sebelumnya</button><span class="text-sm text-muted">Halaman ${page} dari ${totalPages}</span><button class="btn btn-secondary btn-sm" data-p="next" ${page === totalPages ? 'disabled' : ''}>Berikutnya</button>` : '';
    el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { page += b.dataset.p === 'next' ? 1 : -1; loadTable(); }));
  }

  async function loadProducts() {
    // Gas tidak ditampilkan; perubahan gas lewat Manajemen Gas
    const all = (await callApi(window.api.products.list({ category: 'semua' }))) || [];
    products = all.filter((p) => p.category !== 'gas');
  }

  function openForm(editRow = null) {
    const html = `
      <div class="modal-header">
        <h3>${editRow ? 'Edit Barang Keluar' : 'Catat Barang Keluar'}</h3>
        <button class="modal-close" id="m-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Produk</label>
          <select class="input" id="f-product">
            ${products.map((p) => `<option value="${p.id}" ${editRow && p.id === editRow.product_id ? 'selected' : ''} data-unit="${p.unit}" data-stock="${p.stock}">${p.name} &mdash; Stok: ${numFmt(p.stock)} ${p.unit}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Jumlah</label>
            <input class="input" type="number" min="0" id="f-qty" value="${editRow ? editRow.quantity : ''}" placeholder="0" />
          </div>
          <div class="form-group">
            <label>Satuan</label>
            <input class="input" id="f-unit" disabled />
          </div>
        </div>
        <div class="form-group">
          <label>Alasan</label>
          <select class="input" id="f-reason">
            ${REASONS.map((r) => `<option value="${r.value}" ${editRow && r.value === editRow.reason ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Catatan</label>
          <textarea class="input" id="f-note" rows="2" placeholder="Opsional">${editRow ? editRow.note || '' : ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="m-cancel">Batal</button>
        <button class="btn btn-primary" id="m-save">${editRow ? 'Simpan Perubahan' : 'Simpan'}</button>
      </div>
    `;
    const overlay = openModal(html);
    overlay.querySelector('#m-close').addEventListener('click', closeModal);
    overlay.querySelector('#m-cancel').addEventListener('click', closeModal);

    const select = overlay.querySelector('#f-product');
    function syncUnit() {
      overlay.querySelector('#f-unit').value = select.selectedOptions[0].getAttribute('data-unit');
    }
    select.addEventListener('change', syncUnit);
    syncUnit();

    overlay.querySelector('#m-save').addEventListener('click', async () => {
      const qty = Number(overlay.querySelector('#f-qty').value);
      const maxStock = Number(select.selectedOptions[0].getAttribute('data-stock')) + (editRow && editRow.product_id === Number(select.value) ? Number(editRow.quantity) : 0);
      if (!qty || qty <= 0) {
        toast('Jumlah harus lebih dari 0', 'error');
        return;
      }
      if (qty > maxStock) {
        toast('Jumlah melebihi stok yang tersedia', 'error');
        return;
      }
      const payload = {
        product_id: Number(select.value),
        quantity: qty,
        unit: select.selectedOptions[0].getAttribute('data-unit'),
        reason: overlay.querySelector('#f-reason').value,
        note: overlay.querySelector('#f-note').value.trim()
      };
      const res = await callApi(editRow ? window.api.stock.updateOut(editRow.id, payload) : window.api.stock.createOut(payload));
      if (res) {
        toast(editRow ? 'Barang keluar diperbarui' : 'Barang keluar berhasil dicatat, stok telah diperbarui');
        closeModal();
        loadTable();
        loadProducts();
      }
    });
  }

  document.getElementById('btn-add').addEventListener('click', async () => {
    if (!products.length) await loadProducts();
    if (!products.length) {
      toast('Belum ada produk non-gas yang tersedia', 'error');
      return;
    }
    openForm();
  });
  document.getElementById('table-search').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); page = 1; loadTable(); });

  loadProducts();
  loadTable();
})();
