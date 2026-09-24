'use strict';

(function () {
  const user = initPage('gas', 'Manajemen Gas', 'Monitor dan kelola stok tabung gas');
  if (!user) return;

  let gasList = [];
  let activeGasId = null;
  let historyPage = 1;
  const HISTORY_PAGE_SIZE = 20;

  const TYPE_LABEL = {
    tukar_customer: 'Tukar Gas Customer',
    tukar_agen_kirim: 'Kirim Kosong ke Agen',
    tukar_agen_terima: 'Terima Isi dari Agen',
    penjualan_tanpa_tukar: 'Jual Tanpa Tukar',
    tabung_baru: 'Tabung Baru',
    penyesuaian: 'Penyesuaian Stok'
  };
  const TYPE_ICON = {
    tukar_customer: 'refreshSwap',
    tukar_agen_kirim: 'truck',
    tukar_agen_terima: 'truck',
    penjualan_tanpa_tukar: 'banknote',
    tabung_baru: 'plusCircle',
    penyesuaian: 'sliders'
  };

  async function loadGasList() {
    gasList = (await callApi(window.api.gas.list())) || [];
    if (!gasList.length) return;
    if (!activeGasId) activeGasId = gasList[0].id;
    renderTabs();
    renderStats();
    loadHistory();
  }

  function renderTabs() {
    const tabsEl = document.getElementById('gas-tabs');
    tabsEl.innerHTML = gasList
      .map((g) => `<button class="btn ${g.id === activeGasId ? 'btn-primary' : 'btn-secondary'} btn-sm" data-gas="${g.id}">${g.gas_name}</button>`)
      .join('');
    tabsEl.querySelectorAll('[data-gas]').forEach((b) =>
      b.addEventListener('click', () => {
        activeGasId = Number(b.getAttribute('data-gas'));
        historyPage = 1;
        renderTabs();
        renderStats();
        loadHistory();
      })
    );
  }

  function activeGas() {
    return gasList.find((g) => g.id === activeGasId);
  }

  function renderStats() {
    const g = activeGas();
    if (!g) return;
    const total = g.total_cylinders || 1;
    document.getElementById('stat-filled').textContent = numFmt(g.filled_stock);
    document.getElementById('stat-empty').textContent = numFmt(g.empty_stock);
    document.getElementById('stat-total').textContent = numFmt(g.total_cylinders);
    const pctFilled = total ? Math.round((g.filled_stock / total) * 100) : 0;
    const pctEmpty = total ? Math.round((g.empty_stock / total) * 100) : 0;
    document.getElementById('bar-filled').style.width = pctFilled + '%';
    document.getElementById('bar-empty').style.width = pctEmpty + '%';
    document.getElementById('pct-filled').textContent = pctFilled + '% dari total';
    document.getElementById('pct-empty').textContent = pctEmpty + '% dari total';
  }

  async function loadHistory() {
    const rows = (await callApi(window.api.gas.history(activeGasId, 5000))) || [];
    const tbody = document.getElementById('history-body');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${icon('flame', { size: 30 })}<div class="mt-1">Belum ada riwayat aktivitas gas</div></div></td></tr>`;
      return;
    }
    historyPage = Math.min(historyPage, Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE)));
    tbody.innerHTML = rows.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
      .map((r) => {
        const filledChange = r.filled_after - r.filled_before;
        const emptyChange = r.empty_after - r.empty_before;
        const changeStr = `<span class="${filledChange > 0 ? 'text-green' : filledChange < 0 ? 'text-red' : 'text-muted'}">Isi ${filledChange >= 0 ? '+' : ''}${filledChange}</span> &nbsp; <span class="${emptyChange > 0 ? 'text-green' : emptyChange < 0 ? 'text-red' : 'text-muted'}">Kosong ${emptyChange >= 0 ? '+' : ''}${emptyChange}</span>`;
        return `
          <tr>
            <td class="text-sm">${fmtDateTime(r.date)}</td>
            <td>
              <span class="font-semibold flex items-center gap-2">
                ${icon(TYPE_ICON[r.transaction_type] || 'box', { size: 15 })}
                ${TYPE_LABEL[r.transaction_type] || r.transaction_type}
              </span>
            </td>
            <td>${r.filled_before}</td>
            <td>${r.empty_before}</td>
            <td class="text-sm">${changeStr}</td>
            <td class="font-semibold">${r.filled_after}</td>
            <td class="font-semibold">${r.empty_after}</td>
            <td class="text-sm text-muted">${r.description || '-'}</td>
          </tr>`;
      })
      .join('');
    const totalPages = Math.ceil(rows.length / HISTORY_PAGE_SIZE);
    const pagination = document.getElementById('history-pagination');
    pagination.innerHTML = totalPages > 1 ? `<button class="btn btn-secondary btn-sm" data-p="prev" ${historyPage === 1 ? 'disabled' : ''}>Sebelumnya</button><span class="text-sm text-muted">Halaman ${historyPage} dari ${totalPages}</span><button class="btn btn-secondary btn-sm" data-p="next" ${historyPage === totalPages ? 'disabled' : ''}>Berikutnya</button>` : '';
    pagination.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { historyPage += b.dataset.p === 'next' ? 1 : -1; loadHistory(); }));
  }

  function qtyModal({ title, fields, onSubmit }) {
    const fieldsHtml = fields
      .map(
        (f) => `
        <div class="form-group">
          <label>${f.label}</label>
          <input class="input" type="${f.type || 'number'}" id="qm-${f.key}" ${f.allowNegative ? '' : 'min="0"'} placeholder="${f.placeholder || ''}" />
          ${f.hint ? `<div class="hint">${f.hint}</div>` : ''}
        </div>`
      )
      .join('');

    const html = `
      <div class="modal-header"><h3>${title}</h3><button class="modal-close" id="m-close">&times;</button></div>
      <div class="modal-body">
        <div class="hint mb-3">Jenis Gas: <b>${activeGas() ? activeGas().gas_name : '-'}</b></div>
        ${fieldsHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="m-cancel">Batal</button>
        <button class="btn btn-primary" id="m-save">Simpan</button>
      </div>
    `;
    const overlay = openModal(html);
    overlay.querySelector('#m-close').addEventListener('click', closeModal);
    overlay.querySelector('#m-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#m-save').addEventListener('click', () => {
      const values = {};
      for (const f of fields) {
        const el = overlay.querySelector(`#qm-${f.key}`);
        values[f.key] = f.type === 'text' ? el.value.trim() : Number(el.value) || 0;
      }
      onSubmit(values, overlay);
    });
  }

  // A. Tukar Customer: bawa 1 tabung kosong, terima 1 tabung isi
  document.getElementById('btn-tukar-customer').addEventListener('click', () => {
    const g = activeGas();
    if (!g) return;
    qtyModal({
      title: 'Transaksi Tukar Customer',
      fields: [
        { key: 'qty', label: 'Jumlah Tabung Ditukar', placeholder: '1' },
        { key: 'amount', label: 'Nilai Transaksi (Rp)', placeholder: String(g.selling_price || 0) },
        { key: 'note', label: 'Catatan', type: 'text', placeholder: 'Opsional' }
      ],
      onSubmit: async (v) => {
        if (v.qty <= 0) return toast('Jumlah harus lebih dari 0', 'error');
        const res = await callApi(window.api.gas.tukarCustomerTransaction(activeGasId, v.qty, v.amount, user.full_name, v.note));
        if (res) {
          toast(`Tukar gas customer berhasil dicatat: ${res.invoice_number}`);
          closeModal();
          loadGasList();
        }
      }
    });
  });

  // B. Tukar dengan Agen (kirim kosong -> terima isi, dieksekusi sekaligus)
  document.getElementById('btn-agen').addEventListener('click', () => {
    const g = activeGas();
    if (!g) return;
    qtyModal({
      title: 'Tukar Tabung Kosong dengan Agen',
      fields: [
        { key: 'qty', label: 'Jumlah Tabung Ditukar', hint: `Tersedia ${g.empty_stock} tabung kosong`, placeholder: '1' },
        { key: 'purchase_price', label: 'Biaya ke Pertamina/Agen per Tabung (Rp)', placeholder: String(g.purchase_price || 0) },
        { key: 'supplier', label: 'Nama Pertamina/Agen', type: 'text', placeholder: 'Pertamina / nama agen' },
        { key: 'note', label: 'Catatan', type: 'text', placeholder: 'cth. Agen Pertamina' }
      ],
      onSubmit: async (v) => {
        if (v.qty <= 0) return toast('Jumlah harus lebih dari 0', 'error');
        if (v.qty > g.empty_stock) return toast('Stok gas kosong tidak mencukupi', 'error');
        if (v.purchase_price <= 0) return toast('Biaya per tabung harus lebih dari 0', 'error');
        const result = await callApi(window.api.gas.exchangeWithAgentPurchase(activeGasId, v.qty, v.purchase_price, v.note, v.supplier || 'Pertamina/Agen'));
        if (result) {
          toast(`Tukar dengan agen berhasil. Pengeluaran ${rupiah(result.total_price)} dicatat`);
          closeModal();
          loadGasList();
        }
      }
    });
  });

  // C. Penjualan tanpa tukar tabung
  document.getElementById('btn-tanpa-tukar').addEventListener('click', () => {
    const g = activeGas();
    if (!g) return;
    qtyModal({
      title: 'Penjualan Gas Tanpa Tukar Tabung',
      fields: [
        { key: 'qty', label: 'Jumlah Tabung Terjual', hint: `Tersedia ${g.filled_stock} tabung isi`, placeholder: '1' },
        { key: 'amount', label: 'Nilai Transaksi (Rp)', placeholder: String(g.selling_price || 0) },
        { key: 'note', label: 'Catatan', type: 'text', placeholder: 'Opsional' }
      ],
      onSubmit: async (v) => {
        if (v.qty <= 0) return toast('Jumlah harus lebih dari 0', 'error');
        if (v.qty > g.filled_stock) return toast('Stok gas isi tidak mencukupi', 'error');
        const res = await callApi(window.api.gas.jualTanpaTukarTransaction(activeGasId, v.qty, v.amount, user.full_name, v.note));
        if (res) {
          toast(`Penjualan tanpa tukar berhasil dicatat: ${res.invoice_number}`);
          closeModal();
          loadGasList();
        }
      }
    });
  });

  // D. Tambah tabung baru (beli tabung + isi baru)
  document.getElementById('btn-tabung-baru').addEventListener('click', () => {
    qtyModal({
      title: 'Tambah Tabung Baru',
      fields: [
        { key: 'filled', label: 'Tabung Isi Baru', placeholder: '0' },
        { key: 'empty', label: 'Tabung Kosong Baru', placeholder: '0' },
        { key: 'note', label: 'Catatan', type: 'text', placeholder: 'cth. Pembelian tabung baru' }
      ],
      onSubmit: async (v) => {
        if (v.filled <= 0 && v.empty <= 0) return toast('Isi minimal salah satu jumlah tabung', 'error');
        const res = await callApi(window.api.gas.tambahTabungBaru(activeGasId, v.filled, v.empty, v.note || 'Tambah Tabung Baru'));
        if (res) {
          toast('Tabung baru berhasil ditambahkan');
          closeModal();
          loadGasList();
        }
      }
    });
  });

  // E. Penyesuaian stok manual (opname)
  document.getElementById('btn-penyesuaian').addEventListener('click', () => {
    qtyModal({
      title: 'Penyesuaian Stok Gas',
      fields: [
        { key: 'filledDelta', label: 'Perubahan Tabung Isi (+/-)', placeholder: '0', allowNegative: true },
        { key: 'emptyDelta', label: 'Perubahan Tabung Kosong (+/-)', placeholder: '0', allowNegative: true },
        { key: 'note', label: 'Alasan Penyesuaian', type: 'text', placeholder: 'cth. Hasil stok opname' }
      ],
      onSubmit: async (v) => {
        const res = await callApi(window.api.gas.penyesuaian(activeGasId, v.filledDelta, v.emptyDelta, v.note || 'Penyesuaian Stok Gas'));
        if (res) {
          toast('Penyesuaian stok berhasil disimpan');
          closeModal();
          loadGasList();
        }
      }
    });
  });

  loadGasList();
})();
