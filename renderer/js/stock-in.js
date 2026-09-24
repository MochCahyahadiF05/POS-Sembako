'use strict';

(function () {
  const user = initPage('stock-in', 'Barang Masuk', 'Catat penerimaan barang dari supplier');
  if (!user) return;

  let products = [];
  let rows = [], page = 1, search = '';
  const PAGE_SIZE = 20;
  const tbody = document.getElementById('table-body');

  async function loadTable() {
    rows = (await callApi(window.api.stock.listIn({}))) || [];
    const filtered = rows.filter((r) => `${r.product_name} ${r.supplier || ''} ${r.note || ''}`.toLowerCase().includes(search));
    page = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">${icon('truck', { size: 30 })}<div class="mt-1">Belum ada catatan barang masuk</div></div></td></tr>`;
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
          <td>${rupiah(r.purchase_price)}</td>
          <td class="text-green font-semibold">${rupiah(r.total_price)}</td>
          <td class="text-sm">${r.supplier || '-'}</td>
          <td class="text-sm text-muted">${r.note || '-'}</td>
          <td class="text-right"><button class="btn btn-secondary btn-sm" data-edit="${r.id}">Edit</button> <button class="btn btn-danger btn-sm" data-delete="${r.id}">Hapus</button></td>
        </tr>`
      )
      .join('');
    tbody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(rows.find((r) => r.id === Number(b.dataset.edit)))));
    tbody.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => confirmDialog('Hapus barang masuk ini?', 'Stok dan pengeluaran terkait akan dibalik.', async () => { if (await callApi(window.api.stock.deleteIn(Number(b.dataset.delete)))) { toast('Barang masuk dihapus'); loadTable(); loadProducts(); } })));
    renderPagination(filtered.length);
  }

  function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_SIZE), el = document.getElementById('table-pagination');
    el.innerHTML = totalPages > 1 ? `<button class="btn btn-secondary btn-sm" data-p="prev" ${page === 1 ? 'disabled' : ''}>Sebelumnya</button><span class="text-sm text-muted">Halaman ${page} dari ${totalPages}</span><button class="btn btn-secondary btn-sm" data-p="next" ${page === totalPages ? 'disabled' : ''}>Berikutnya</button>` : '';
    el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { page += b.dataset.p === 'next' ? 1 : -1; loadTable(); }));
  }

  async function loadProducts() {
    products = (await callApi(window.api.products.list({ category: 'semua' }))) || [];
  }

  function openForm(editRow = null) {
    const html = `
      <div class="modal-header">
        <h3>${editRow ? 'Edit Barang Masuk' : 'Catat Barang Masuk'}</h3>
        <button class="modal-close" id="m-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Produk</label>
          <select class="input" id="f-product">
            ${products.map((p) => `<option value="${p.id}" ${editRow && p.id === editRow.product_id ? 'selected' : ''} data-category="${p.category}" data-unit="${p.category === 'gas' ? 'tabung' : p.unit}" data-price="${p.purchase_price}">${p.name} (${categoryLabel(p.category)})</option>`).join('')}
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
        <div class="form-row">
          <div class="form-group">
            <label>Harga Beli / Satuan</label>
            <input class="input" type="number" min="0" id="f-price" value="${editRow ? editRow.purchase_price : ''}" />
          </div>
          <div class="form-group">
            <label>Supplier</label>
            <input class="input" id="f-supplier" value="${editRow ? editRow.supplier || '' : ''}" placeholder="Nama supplier" />
          </div>
        </div>
        <div class="form-group">
          <label>Catatan</label>
          <textarea class="input" id="f-note" rows="2" placeholder="Opsional">${editRow ? editRow.note || '' : ''}</textarea>
        </div>
        <div class="hint" id="gas-hint" style="display:none;">Produk Gas: barang masuk dicatat sebagai <b>tukar tabung kosong dengan Pertamina/agen</b>. Stok tabung kosong harus mencukupi dan biaya pembelian masuk ke Pengeluaran.</div>
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
    function syncFields() {
      const opt = select.selectedOptions[0];
      overlay.querySelector('#f-unit').value = opt.getAttribute('data-unit');
      overlay.querySelector('#f-price').value = opt.getAttribute('data-price');
      overlay.querySelector('#gas-hint').style.display = opt.getAttribute('data-category') === 'gas' ? 'block' : 'none';
    }
    select.addEventListener('change', syncFields);
    syncFields();

    overlay.querySelector('#m-save').addEventListener('click', async () => {
      const productId = Number(select.value);
      const qty = Number(overlay.querySelector('#f-qty').value);
      if (!qty || qty <= 0) {
        toast('Jumlah harus lebih dari 0', 'error');
        return;
      }
      const payload = {
        product_id: productId,
        quantity: qty,
        unit: select.selectedOptions[0].getAttribute('data-unit'),
        purchase_price: Number(overlay.querySelector('#f-price').value) || 0,
        supplier: overlay.querySelector('#f-supplier').value.trim(),
        note: overlay.querySelector('#f-note').value.trim()
      };
      const res = await callApi(editRow ? window.api.stock.updateIn(editRow.id, payload) : window.api.stock.createIn(payload));
      if (res) {
        toast(editRow ? 'Barang masuk diperbarui' : 'Barang masuk dicatat, stok dan pengeluaran pembelian telah diperbarui');
        closeModal();
        loadTable();
        loadProducts();
      }
    });
  }

  document.getElementById('btn-add').addEventListener('click', async () => {
    if (!products.length) await loadProducts();
    openForm();
  });
  document.getElementById('table-search').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); page = 1; loadTable(); });

  loadProducts();
  loadTable();
})();
