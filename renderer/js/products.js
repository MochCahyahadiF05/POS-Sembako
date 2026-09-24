'use strict';

(function () {
  const user = initPage('products', 'Produk & Stok', 'Kelola daftar produk dan pantau status stok');
  if (!user) return;

  let activeCategory = 'semua';
  let searchTerm = '';

  async function loadProducts() {
    const products = (await callApi(window.api.products.list({ search: searchTerm, category: activeCategory }))) || [];
    renderTable(products);
  }

  function renderTable(products) {
    const tbody = document.getElementById('product-table-body');
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${icon('package', { size: 30 })}<div class="mt-1">Belum ada produk</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = products
      .map(
        (p) => `
        <tr>
          <td>
            <span class="flex items-center gap-2 font-semibold">
              <span style="color:var(--text-soft)">${categoryIcon(p.category, { size: 16 })}</span>
              ${p.name}
            </span>
          </td>
          <td><span class="badge badge-gray">${categoryLabel(p.category)}</span></td>
          <td>${rupiah(p.purchase_price)}</td>
          <td>${rupiah(p.selling_price)}${p.secondary_price ? `<div class="text-xs text-muted">${rupiah(p.secondary_price)}/${p.secondary_unit}</div>` : ''}</td>
          <td>${numFmt(p.stock)} ${p.unit}</td>
          <td>${stockBadge(p.status)}</td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${p.id}">Hapus</button>
          </td>
        </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openProductModal(Number(b.getAttribute('data-edit')))));
    tbody.querySelectorAll('[data-delete]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = Number(b.getAttribute('data-delete'));
        confirmDialog('Hapus produk ini?', 'Produk akan disembunyikan dari daftar dan kasir.', async () => {
          const res = await callApi(window.api.products.delete(id));
          if (res) {
            toast('Produk berhasil dihapus');
            loadProducts();
          }
        });
      })
    );
  }

  async function openProductModal(id) {
    const isEdit = !!id;
    const product = isEdit ? await callApi(window.api.products.get(id)) : null;
    if (isEdit && !product) return;
    const isGas = product && product.category === 'gas';

    const html = `
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Produk' : 'Tambah Produk'}</h3>
        <button class="modal-close" id="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nama Produk</label>
          <input class="input" id="f-name" value="${product ? product.name : ''}" placeholder="cth. Beras Premium" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Kategori</label>
            <select class="input" id="f-category" ${isEdit ? 'disabled' : ''}>
              <option value="beras" ${product && product.category === 'beras' ? 'selected' : ''}>Beras</option>
              <option value="telur" ${product && product.category === 'telur' ? 'selected' : ''}>Telur</option>
              <option value="gas" ${isGas ? 'selected' : ''}>Gas LPG</option>
            </select>
            ${isEdit ? '<div class="hint">Kategori tidak dapat diubah setelah produk dibuat.</div>' : ''}
          </div>
          <div class="form-group" id="wrap-unit">
            <label>Satuan Utama</label>
            <select class="input" id="f-unit">
              <option value="kg" ${!product || product.unit === 'kg' ? 'selected' : ''}>KG</option>
              <option value="tabung" ${isGas ? 'selected' : ''}>Tabung</option>
            </select>
          </div>
        </div>

        <div id="wrap-gas" class="${isGas ? '' : 'hidden'}">
          <div class="form-row">
            <div class="form-group">
              <label>Stok Gas Isi (tabung)</label>
              <input class="input" id="f-gas-filled" type="number" min="0" value="${isGas ? product.stock : 0}" ${isEdit ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label>Stok Gas Kosong (tabung)</label>
              <input class="input" id="f-gas-empty" type="number" min="0" value="0" ${isEdit ? 'disabled' : ''} />
            </div>
          </div>
          <div class="hint mb-3">
            ${
              isEdit
                ? 'Ubah jumlah tabung lewat halaman Manajemen Gas.'
                : 'Jenis gas baru otomatis muncul di halaman Manajemen Gas beserta riwayatnya.'
            }
          </div>
        </div>

        <div id="wrap-secondary" class="${!isEdit || product.category === 'beras' ? '' : 'hidden'}">
          <div class="form-row">
            <div class="form-group">
              <label>Satuan Kedua (opsional)</label>
              <input class="input" id="f-secondary-unit" value="${product && product.secondary_unit ? product.secondary_unit : ''}" placeholder="cth. karung" />
            </div>
            <div class="form-group">
              <label>Isi per Satuan Kedua (kg)</label>
              <input class="input" id="f-secondary-conv" type="number" min="0" value="${product && product.secondary_conversion ? product.secondary_conversion : ''}" placeholder="cth. 50" />
            </div>
          </div>
          <div class="form-group">
            <label>Harga Jual Satuan Kedua</label>
            <input class="input" id="f-secondary-price" type="number" min="0" value="${product && product.secondary_price ? product.secondary_price : ''}" placeholder="cth. 750000" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label id="lb-purchase">Harga Beli / kg</label>
            <input class="input" id="f-purchase" type="number" min="0" value="${product ? product.purchase_price : ''}" />
          </div>
          <div class="form-group">
            <label id="lb-selling">Harga Jual / kg</label>
            <input class="input" id="f-selling" type="number" min="0" value="${product ? product.selling_price : ''}" />
          </div>
        </div>
        <div class="form-group ${isGas ? '' : 'hidden'}" id="wrap-no-exchange-price">
          <label>Harga Jual Tanpa Tukar Tabung</label>
          <input class="input" id="f-no-exchange-price" type="number" min="0" value="${isGas ? product.no_exchange_price || product.selling_price : ''}" placeholder="Contoh: 25000" />
          <div class="hint">Dipakai saat pelanggan tidak menukar tabung kosong.</div>
        </div>
        <div class="form-row">
          <div class="form-group" id="wrap-stock">
            <label id="lb-stock">Stok Awal (kg)</label>
            <input class="input" id="f-stock" type="number" min="0" value="${product ? product.stock : 0}" ${isEdit ? 'disabled' : ''} />
            ${isEdit ? '<div class="hint">Ubah stok lewat menu Barang Masuk / Barang Keluar.</div>' : ''}
          </div>
          <div class="form-group">
            <label id="lb-minstock">Stok Minimum (kg)</label>
            <input class="input" id="f-minstock" type="number" min="0" value="${product ? product.minimum_stock : 10}" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-modal">Batal</button>
        <button class="btn btn-primary" id="save-product">${isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</button>
      </div>
    `;

    const overlay = openModal(html);
    overlay.querySelector('#close-modal').addEventListener('click', closeModal);
    overlay.querySelector('#cancel-modal').addEventListener('click', closeModal);

    const categorySelect = overlay.querySelector('#f-category');
    const secondaryWrap = overlay.querySelector('#wrap-secondary');
    const gasWrap = overlay.querySelector('#wrap-gas');
    const stockWrap = overlay.querySelector('#wrap-stock');

    function syncFormByCategory() {
      const cat = categorySelect.value;
      const gas = cat === 'gas';
      const satuan = gas ? 'tabung' : 'kg';

      secondaryWrap.classList.toggle('hidden', cat !== 'beras');
      gasWrap.classList.toggle('hidden', !gas);
      // Untuk gas, stok diisi lewat field Gas Isi/Kosong
      stockWrap.classList.toggle('hidden', gas);

      overlay.querySelector('#f-unit').value = satuan;
      overlay.querySelector('#lb-purchase').textContent = `Harga Beli / ${satuan}`;
      overlay.querySelector('#lb-selling').textContent = `Harga Jual / ${satuan}`;
      overlay.querySelector('#lb-stock').textContent = `Stok Awal (${satuan})`;
      overlay.querySelector('#lb-minstock').textContent = `Stok Minimum (${satuan})`;
      overlay.querySelector('#f-name').placeholder = gas ? 'cth. Gas LPG 12 KG' : 'cth. Beras Premium';
    }

    if (categorySelect && !isEdit) categorySelect.addEventListener('change', syncFormByCategory);
    syncFormByCategory();

    overlay.querySelector('#save-product').addEventListener('click', async () => {
      const category = isEdit ? product.category : categorySelect.value;
      const name = overlay.querySelector('#f-name').value.trim();
      if (!name) {
        toast('Nama produk wajib diisi', 'error');
        return;
      }

      // ---- Kategori GAS: kelola lewat tabel gas_stock ----
      if (category === 'gas') {
        if (isEdit) {
          const result = await callApi(
            window.api.gas.update(product.gas_id, {
              gas_name: name,
              purchase_price: Number(overlay.querySelector('#f-purchase').value) || 0,
              selling_price: Number(overlay.querySelector('#f-selling').value) || 0,
              no_exchange_price: Number(overlay.querySelector('#f-no-exchange-price').value) || 0,
              minimum_stock: Number(overlay.querySelector('#f-minstock').value) || 0
            })
          );
          if (result) {
            toast('Produk gas berhasil diperbarui');
            closeModal();
            loadProducts();
          }
          return;
        }

        const result = await callApi(
          window.api.gas.create({
            gas_name: name,
            filled_stock: Number(overlay.querySelector('#f-gas-filled').value) || 0,
            empty_stock: Number(overlay.querySelector('#f-gas-empty').value) || 0,
            purchase_price: Number(overlay.querySelector('#f-purchase').value) || 0,
            selling_price: Number(overlay.querySelector('#f-selling').value) || 0,
            minimum_stock: Number(overlay.querySelector('#f-minstock').value) || 0
          })
        );
        if (result) {
          toast('Jenis gas baru berhasil ditambahkan & muncul di Manajemen Gas');
          closeModal();
          loadProducts();
        }
        return;
      }

      // ---- Kategori Beras / Telur ----
      const data = {
        name,
        category,
        unit: 'kg',
        secondary_unit: overlay.querySelector('#f-secondary-unit') ? overlay.querySelector('#f-secondary-unit').value.trim() || null : null,
        secondary_conversion: overlay.querySelector('#f-secondary-conv') ? Number(overlay.querySelector('#f-secondary-conv').value) || null : null,
        secondary_price: overlay.querySelector('#f-secondary-price') ? Number(overlay.querySelector('#f-secondary-price').value) || null : null,
        purchase_price: Number(overlay.querySelector('#f-purchase').value) || 0,
        selling_price: Number(overlay.querySelector('#f-selling').value) || 0,
            no_exchange_price: Number(overlay.querySelector('#f-no-exchange-price').value) || 0,
        stock: Number(overlay.querySelector('#f-stock').value) || 0,
        minimum_stock: Number(overlay.querySelector('#f-minstock').value) || 0
      };

      const result = isEdit ? await callApi(window.api.products.update(id, data)) : await callApi(window.api.products.create(data));
      if (result) {
        toast(isEdit ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
        closeModal();
        loadProducts();
      }
    });
  }

  document.getElementById('btn-add-product').addEventListener('click', () => openProductModal(null));
  document.getElementById('search-product').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    loadProducts();
  });
  document.getElementById('category-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    activeCategory = btn.getAttribute('data-cat');
    document.querySelectorAll('#category-filter .btn-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadProducts();
  });

  loadProducts();
})();
