'use strict';

(function () {
  const user = initPage('reports', 'Laporan', 'Analisis dan ekspor laporan usaha');
  if (!user) return;

  let activeType = 'sales';
  let activePeriod = 'month';
  let range = {};
  let chartInstance = null;
  let exportData = null; // { title, subtitle, columns: [{header,key}], rows: [] }
  const reportPages = {};
  const REPORT_PAGE_SIZE = 20;

  const content = document.getElementById('report-content');

  async function resolveAndLoad() {
    if (activePeriod === 'custom') {
      range = {
        from: document.getElementById('custom-from').value || undefined,
        to: document.getElementById('custom-to').value || undefined
      };
    } else {
      range = (await callApi(window.api.reports.resolveRange(activePeriod), { silent: true })) || {};
    }
    await loadReport();
  }

  async function loadReport() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    if (activeType === 'sales') return loadSales();
    if (activeType === 'stock') return loadStock();
    if (activeType === 'finance') return loadFinance();
    if (activeType === 'gas') return loadGas();
    if (activeType === 'stockIn') return loadStockIn();
    if (activeType === 'stockOut') return loadStockOut();
  }

  /* ---------------- LAPORAN PENJUALAN ---------------- */
  async function loadSales() {
    const data = await callApi(window.api.reports.sales(range));
    if (!data) return;
    content.innerHTML = `
      <div class="grid grid-3 mb-4">
        <div class="card stat-card"><div class="label">Total Transaksi</div><div class="value" id="s-count">0</div><div class="foot">Periode ini</div></div>
        <div class="card stat-card"><div class="label">Total Penjualan</div><div class="value text-green" id="s-total">Rp 0</div><div class="foot">Semua produk</div></div>
        <div class="card stat-card"><div class="label">Rata-rata / Transaksi</div><div class="value" id="s-avg">Rp 0</div><div class="foot">Per transaksi</div></div>
      </div>
      <div class="card mb-4">
        <div class="section-title mb-2">Grafik Penjualan Harian</div>
        <div class="chart-box"><canvas id="s-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="section-title mb-3">Daftar Transaksi</div>
        <div class="mb-3"><input class="input table-search" id="report-search" placeholder="Cari invoice, kasir, metode, atau status..." /></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Kasir</th><th>Metode</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody id="s-body"></tbody>
          </table>
        </div>
        <div class="pagination" id="sales-pagination"></div>
      </div>
    `;
    document.getElementById('s-count').textContent = numFmt(data.totalTransactions);
    document.getElementById('s-total').textContent = rupiah(data.totalSales);
    document.getElementById('s-avg').textContent = rupiah(data.avgPerTransaction);

    const tbody = document.getElementById('s-body');
    let salesSearch = '';
    const renderSales = () => {
      const filtered = data.transactions.filter((t) => `${t.invoice_number} ${t.cashier_name || ''} ${t.payment_method} ${t.status}`.toLowerCase().includes(salesSearch));
      const totalPages = Math.ceil(filtered.length / REPORT_PAGE_SIZE);
      reportPages.sales = Math.min(reportPages.sales || 1, Math.max(1, totalPages));
      const visible = filtered.slice((reportPages.sales - 1) * REPORT_PAGE_SIZE, reportPages.sales * REPORT_PAGE_SIZE);
      if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${icon('barChart', { size: 30 })}<div class="mt-1">Tidak ada transaksi pada periode ini</div></div></td></tr>`;
      } else {
      tbody.innerHTML = visible
        .map(
          (t) => `
          <tr>
            <td class="font-semibold">${t.invoice_number}</td>
            <td class="text-sm">${fmtDateTime(t.transaction_date)}</td>
            <td class="text-sm">${t.cashier_name || '-'}</td>
            <td><span class="badge badge-gray">${t.payment_method}</span></td>
            <td class="font-semibold text-green">${rupiah(t.final_amount)}</td>
            <td>${t.status === 'batal' ? '<span class="badge badge-red">Batal</span>' : '<span class="badge badge-green">Selesai</span>'}</td>
            <td><button class="btn btn-secondary btn-sm" data-transaction-detail="${t.id}">Detail</button></td>
          </tr>`
        )
        .join('');
      tbody.querySelectorAll('[data-transaction-detail]').forEach((button) => {
        button.addEventListener('click', () => showTransactionDetail(Number(button.getAttribute('data-transaction-detail'))));
      });
      }
      renderReportPagination('sales-pagination', reportPages.sales || 1, filtered.length, (next) => { reportPages.sales = next; renderSales(); });
    };
    document.getElementById('report-search').addEventListener('input', (e) => { salesSearch = e.target.value.trim().toLowerCase(); reportPages.sales = 1; renderSales(); });
    renderSales();

    chartInstance = new Chart(document.getElementById('s-chart'), {
      type: 'bar',
      data: { labels: data.daily.map((d) => fmtDate(d.d)), datasets: [{ label: 'Pendapatan', data: data.daily.map((d) => d.total), backgroundColor: '#16a34a', borderRadius: 6, maxBarThickness: 36 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v) } } } }
    });

    exportData = {
      title: 'Laporan Penjualan',
      subtitle: `Periode: ${range.from || '-'} s/d ${range.to || '-'}`,
      columns: [
        { header: 'No. Invoice', key: 'invoice_number', width: 20 },
        { header: 'Tanggal', key: 'transaction_date', width: 20 },
        { header: 'Kasir', key: 'cashier_name', width: 16 },
        { header: 'Metode', key: 'payment_method', width: 14 },
        { header: 'Total', key: 'final_amount', width: 16 },
        { header: 'Status', key: 'status', width: 12 }
      ],
      rows: data.transactions
    };
  }

  async function showTransactionDetail(id) {
    const transaction = await callApi(window.api.transactions.get(id));
    if (!transaction) return;
    const paymentLabel = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS' }[transaction.payment_method] || transaction.payment_method;
    const detailQuantity = (quantity) => Number(quantity).toLocaleString('id-ID', { maximumFractionDigits: 3 });
    const itemsTotal = transaction.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const overlay = openModal(`
      <div class="modal-header">
        <div><h3>Detail Transaksi</h3><div class="text-xs text-muted mt-1">${transaction.invoice_number}</div></div>
        <button class="modal-close" id="transaction-detail-close">&times;</button>
      </div>
      <div class="modal-body transaction-detail-body">
        <div class="transaction-detail-grid">
          <div><span class="detail-label">Tanggal</span><strong>${fmtDateTime(transaction.transaction_date)}</strong></div>
          <div><span class="detail-label">Kasir</span><strong>${transaction.cashier_name || '-'}</strong></div>
          <div><span class="detail-label">Catatan</span><strong>${transaction.note || '-'}</strong></div>
          <div><span class="detail-label">Metode Pembayaran</span><strong>${paymentLabel}</strong></div>
          <div><span class="detail-label">Status</span><strong class="${transaction.status === 'batal' ? 'text-red' : 'text-green'}">${transaction.status === 'batal' ? 'Batal' : 'Selesai'}</strong></div>
        </div>
        <div class="section-title mt-4 mb-2">Barang yang Dibeli</div>
        <div class="table-wrap">
          <table class="table transaction-detail-table">
            <thead><tr><th>Produk</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead>
            <tbody>${transaction.items.map((item) => `<tr><td class="font-semibold">${item.product_name}</td><td>${detailQuantity(item.quantity)} ${item.unit}</td><td>${rupiah(item.price)}</td><td class="text-right">${rupiah(item.subtotal)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="transaction-total-box">
          <div><span>Subtotal</span><span>${rupiah(itemsTotal)}</span></div>
          <div><span>Diskon</span><span>${rupiah(transaction.discount)}</span></div>
          <div class="total"><strong>Total</strong><strong>${rupiah(transaction.final_amount)}</strong></div>
          <div><span>Dibayar</span><span>${rupiah(transaction.paid_amount)}</span></div>
          <div><span>Kembalian</span><span>${rupiah(transaction.change_amount)}</span></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" id="transaction-detail-close-footer">Tutup</button></div>
    `, { size: 'modal-lg' });
    overlay.querySelector('#transaction-detail-close').addEventListener('click', closeModal);
    overlay.querySelector('#transaction-detail-close-footer').addEventListener('click', closeModal);
  }

  /* ---------------- LAPORAN STOK ---------------- */
  async function loadStock() {
    const data = await callApi(window.api.reports.stock());
    if (!data) return;
    content.innerHTML = `
      <div class="card mb-4">
        <div class="section-title mb-3">Stok Produk (Beras &amp; Telur)</div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nama Produk</th><th>Kategori</th><th>Stok</th><th>Min. Stok</th><th>Status</th></tr></thead>
            <tbody id="st-body"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="section-title mb-3">Stok Gas</div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Jenis Gas</th><th>Gas Isi</th><th>Gas Kosong</th><th>Total Tabung</th></tr></thead>
            <tbody id="gt-body"></tbody>
          </table>
        </div>
      </div>
    `;
    const nonGas = data.products.filter((p) => p.category !== 'gas');
    document.getElementById('st-body').innerHTML =
      nonGas
        .map(
          (p) => `
        <tr>
          <td class="font-semibold">${p.name}</td>
          <td><span class="badge badge-gray">${categoryLabel(p.category)}</span></td>
          <td>${numFmt(p.stock)} ${p.unit}</td>
          <td>${numFmt(p.minimum_stock)} ${p.unit}</td>
          <td>${stockBadge(p.status)}</td>
        </tr>`
        )
        .join('') || `<tr><td colspan="5"><div class="empty-state">Belum ada produk</div></td></tr>`;

    document.getElementById('gt-body').innerHTML = data.gasList
      .map(
        (g) => `
        <tr>
          <td class="font-semibold">${g.gas_name}</td>
          <td class="text-red">${numFmt(g.filled_stock)} Tabung</td>
          <td>${numFmt(g.empty_stock)} Tabung</td>
          <td class="font-semibold text-green">${numFmt(g.total_cylinders)} Tabung</td>
        </tr>`
      )
      .join('');

    exportData = {
      title: 'Laporan Stok',
      subtitle: `Per tanggal ${fmtDate(new Date().toISOString())}`,
      columns: [
        { header: 'Nama Produk', key: 'name', width: 24 },
        { header: 'Kategori', key: 'category', width: 14 },
        { header: 'Stok', key: 'stock', width: 12 },
        { header: 'Satuan', key: 'unit', width: 10 },
        { header: 'Min. Stok', key: 'minimum_stock', width: 12 },
        { header: 'Status', key: 'status', width: 14 }
      ],
      rows: nonGas
    };
  }

  /* ---------------- LAPORAN KEUANGAN ---------------- */
  async function loadFinance() {
    const data = await callApi(window.api.reports.finance(range));
    if (!data) return;
    content.innerHTML = `
      <div class="grid grid-3 mb-4">
        <div class="card stat-card"><div class="label">Total Pendapatan</div><div class="value text-green" id="f-income">Rp 0</div></div>
        <div class="card stat-card"><div class="label">Total Pengeluaran</div><div class="value text-amber" id="f-expense">Rp 0</div></div>
        <div class="card stat-card"><div class="label">Laba Bersih</div><div class="value" id="f-profit" style="color:var(--purple-600)">Rp 0</div></div>
      </div>
      <div class="card">
        <div class="section-title mb-3">Riwayat Pengeluaran</div>
        <div class="mb-3"><input class="input table-search" id="report-search" placeholder="Cari kategori atau deskripsi..." /></div>
        <div class="table-wrap">
          <table class="table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th>Jumlah</th></tr></thead><tbody id="fe-body"></tbody></table>
        </div>
        <div class="pagination" id="finance-pagination"></div>
      </div>
    `;
    document.getElementById('f-income').textContent = rupiah(data.totalIncome);
    document.getElementById('f-expense').textContent = rupiah(data.totalExpense);
    document.getElementById('f-profit').textContent = rupiah(data.netProfit);

    const financeBody = document.getElementById('fe-body');
    let financeSearch = '';
    const renderFinance = () => {
      const filtered = data.expenses.filter((e) => `${e.category} ${e.description || ''}`.toLowerCase().includes(financeSearch));
      const totalPages = Math.ceil(filtered.length / REPORT_PAGE_SIZE);
      reportPages.finance = Math.min(reportPages.finance || 1, Math.max(1, totalPages));
      const visible = filtered.slice((reportPages.finance - 1) * REPORT_PAGE_SIZE, reportPages.finance * REPORT_PAGE_SIZE);
      financeBody.innerHTML = visible
        .map(
          (e) => `
        <tr>
          <td class="text-sm">${fmtDate(e.date)}</td>
          <td><span class="badge badge-amber">${e.category}</span></td>
          <td class="text-sm">${e.description || '-'}</td>
          <td class="font-semibold text-red">${rupiah(e.amount)}</td>
        </tr>`
        )
        .join('') || `<tr><td colspan="4"><div class="empty-state">Belum ada pengeluaran</div></td></tr>`;
      renderReportPagination('finance-pagination', reportPages.finance || 1, filtered.length, (next) => { reportPages.finance = next; renderFinance(); });
    };
    document.getElementById('report-search').addEventListener('input', (e) => { financeSearch = e.target.value.trim().toLowerCase(); reportPages.finance = 1; renderFinance(); });
    renderFinance();

    exportData = {
      title: 'Laporan Keuangan',
      subtitle: `Periode: ${range.from || '-'} s/d ${range.to || '-'} | Laba Bersih: ${rupiah(data.netProfit)}`,
      columns: [
        { header: 'Tanggal', key: 'date', width: 18 },
        { header: 'Kategori', key: 'category', width: 20 },
        { header: 'Deskripsi', key: 'description', width: 28 },
        { header: 'Jumlah', key: 'amount', width: 16 }
      ],
      rows: data.expenses
    };
  }

  /* ---------------- LAPORAN GAS ---------------- */
  async function loadGas() {
    const data = await callApi(window.api.reports.gas(range));
    if (!data) return;
    content.innerHTML = `
      <div class="card mb-4">
        <div class="section-title mb-3">Ringkasan Stok Gas</div>
        <div class="table-wrap">
          <table class="table"><thead><tr><th>Jenis Gas</th><th>Gas Isi</th><th>Gas Kosong</th><th>Total</th></tr></thead><tbody id="g-summary"></tbody></table>
        </div>
      </div>
      <div class="card">
        <div class="section-title mb-3">Riwayat Transaksi Gas</div>
        <div class="mb-3"><input class="input table-search" id="report-search" placeholder="Cari jenis gas, transaksi, atau keterangan..." /></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tanggal</th><th>Jenis Gas</th><th>Jenis Transaksi</th><th>Isi Sebelum</th><th>Kosong Sebelum</th><th>Isi Sesudah</th><th>Kosong Sesudah</th><th>Keterangan</th></tr></thead>
            <tbody id="g-body"></tbody>
          </table>
        </div>
        <div class="pagination" id="gas-pagination"></div>
      </div>
    `;
    document.getElementById('g-summary').innerHTML = data.gasList
      .map((g) => `<tr><td class="font-semibold">${g.gas_name}</td><td class="text-red">${numFmt(g.filled_stock)}</td><td>${numFmt(g.empty_stock)}</td><td class="font-semibold text-green">${numFmt(g.total_cylinders)}</td></tr>`)
      .join('');

    const TYPE_LABEL = {
      tukar_customer: 'Tukar Customer',
      tukar_agen_kirim: 'Kirim ke Agen',
      tukar_agen_terima: 'Terima dari Agen',
      penjualan_tanpa_tukar: 'Jual Tanpa Tukar',
      tabung_baru: 'Tabung Baru',
      penyesuaian: 'Penyesuaian'
    };

    const gasBody = document.getElementById('g-body');
    let gasSearch = '';
    const renderGas = () => {
      const filtered = data.history.filter((h) => `${h.gas_name || ''} ${TYPE_LABEL[h.transaction_type] || h.transaction_type} ${h.description || ''}`.toLowerCase().includes(gasSearch));
      const totalPages = Math.ceil(filtered.length / REPORT_PAGE_SIZE);
      reportPages.gas = Math.min(reportPages.gas || 1, Math.max(1, totalPages));
      const visible = filtered.slice((reportPages.gas - 1) * REPORT_PAGE_SIZE, reportPages.gas * REPORT_PAGE_SIZE);
      gasBody.innerHTML = visible
        .map(
          (h) => `
        <tr>
          <td class="text-sm">${fmtDateTime(h.date)}</td>
          <td class="font-semibold">${h.gas_name}</td>
          <td>${TYPE_LABEL[h.transaction_type] || h.transaction_type}</td>
          <td>${h.filled_before}</td><td>${h.empty_before}</td><td>${h.filled_after}</td><td>${h.empty_after}</td>
          <td class="text-sm text-muted">${h.description || '-'}</td>
        </tr>`
        )
        .join('') || `<tr><td colspan="8"><div class="empty-state">Belum ada riwayat</div></td></tr>`;
      renderReportPagination('gas-pagination', reportPages.gas || 1, filtered.length, (next) => { reportPages.gas = next; renderGas(); });
    };
    document.getElementById('report-search').addEventListener('input', (e) => { gasSearch = e.target.value.trim().toLowerCase(); reportPages.gas = 1; renderGas(); });
    renderGas();

    exportData = {
      title: 'Laporan Gas',
      subtitle: `Periode: ${range.from || '-'} s/d ${range.to || '-'}`,
      columns: [
        { header: 'Tanggal', key: 'date', width: 20 },
        { header: 'Jenis Gas', key: 'gas_name', width: 18 },
        { header: 'Jenis Transaksi', key: 'transaction_type', width: 20 },
        { header: 'Isi Sebelum', key: 'filled_before', width: 12 },
        { header: 'Kosong Sebelum', key: 'empty_before', width: 14 },
        { header: 'Isi Sesudah', key: 'filled_after', width: 12 },
        { header: 'Kosong Sesudah', key: 'empty_after', width: 14 },
        { header: 'Keterangan', key: 'description', width: 26 }
      ],
      rows: data.history
    };
  }

  /* ---------------- BARANG MASUK / KELUAR ---------------- */
  async function loadStockIn() {
    const rows = (await callApi(window.api.reports.stockIn(range))) || [];
    content.innerHTML = simpleTable(
      'Laporan Barang Masuk',
      ['Tanggal', 'Produk', 'Kategori', 'Jumlah', 'Harga Beli', 'Total', 'Supplier'],
      rows.map((r) => [fmtDate(r.date), r.product_name, categoryLabel(r.category), `${numFmt(r.quantity)} ${r.unit}`, rupiah(r.purchase_price), rupiah(r.total_price), r.supplier || '-'])
    );
    setupSimpleReportTable(rows.map((r) => [fmtDate(r.date), r.product_name, categoryLabel(r.category), `${numFmt(r.quantity)} ${r.unit}`, rupiah(r.purchase_price), rupiah(r.total_price), r.supplier || '-']));
    exportData = {
      title: 'Laporan Barang Masuk',
      subtitle: `Periode: ${range.from || '-'} s/d ${range.to || '-'}`,
      columns: [
        { header: 'Tanggal', key: 'date', width: 18 },
        { header: 'Produk', key: 'product_name', width: 20 },
        { header: 'Kategori', key: 'category', width: 12 },
        { header: 'Jumlah', key: 'quantity', width: 10 },
        { header: 'Satuan', key: 'unit', width: 10 },
        { header: 'Harga Beli', key: 'purchase_price', width: 14 },
        { header: 'Total', key: 'total_price', width: 14 },
        { header: 'Supplier', key: 'supplier', width: 18 }
      ],
      rows
    };
  }

  async function loadStockOut() {
    const rows = (await callApi(window.api.reports.stockOut(range))) || [];
    content.innerHTML = simpleTable(
      'Laporan Barang Keluar',
      ['Tanggal', 'Produk', 'Kategori', 'Jumlah', 'Alasan', 'Catatan'],
      rows.map((r) => [fmtDate(r.date), r.product_name, categoryLabel(r.category), `${numFmt(r.quantity)} ${r.unit}`, r.reason || '-', r.note || '-'])
    );
    setupSimpleReportTable(rows.map((r) => [fmtDate(r.date), r.product_name, categoryLabel(r.category), `${numFmt(r.quantity)} ${r.unit}`, r.reason || '-', r.note || '-']));
    exportData = {
      title: 'Laporan Barang Keluar',
      subtitle: `Periode: ${range.from || '-'} s/d ${range.to || '-'}`,
      columns: [
        { header: 'Tanggal', key: 'date', width: 18 },
        { header: 'Produk', key: 'product_name', width: 20 },
        { header: 'Kategori', key: 'category', width: 12 },
        { header: 'Jumlah', key: 'quantity', width: 10 },
        { header: 'Satuan', key: 'unit', width: 10 },
        { header: 'Alasan', key: 'reason', width: 16 },
        { header: 'Catatan', key: 'note', width: 22 }
      ],
      rows
    };
  }

  function simpleTable(title, headers, rowsArr) {
    return `
      <div class="card">
        <div class="section-title mb-3">${title}</div>
        <div class="mb-3"><input class="input table-search" id="report-search" placeholder="Cari data laporan..." /></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody id="simple-report-body"></tbody>
          </table>
        </div>
        <div class="pagination" id="simple-report-pagination"></div>
      </div>
    `;
  }

  function setupSimpleReportTable(source) {
    const body = document.getElementById('simple-report-body');
    let search = '';
    let page = 1;
    const render = () => {
      const filtered = source.filter((row) => row.join(' ').toLowerCase().includes(search));
      page = Math.min(page, Math.max(1, Math.ceil(filtered.length / REPORT_PAGE_SIZE)));
      const visible = filtered.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE);
      body.innerHTML = visible.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${source[0] ? source[0].length : 1}"><div class="empty-state">Tidak ada data pada periode ini</div></td></tr>`;
      renderReportPagination('simple-report-pagination', page, filtered.length, (next) => { page = next; render(); });
    };
    document.getElementById('report-search').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); page = 1; render(); });
    render();
  }

  function renderReportPagination(containerId, page, total, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.ceil(total / REPORT_PAGE_SIZE);
    container.innerHTML = totalPages > 1 ? `<button class="btn btn-secondary btn-sm" data-p="prev" ${page === 1 ? 'disabled' : ''}>Sebelumnya</button><span class="text-sm text-muted">Halaman ${page} dari ${totalPages}</span><button class="btn btn-secondary btn-sm" data-p="next" ${page === totalPages ? 'disabled' : ''}>Berikutnya</button>` : '';
    container.querySelectorAll('[data-p]').forEach((button) => button.addEventListener('click', () => onPageChange(button.dataset.p === 'next' ? page + 1 : page - 1)));
  }

  /* ---------------- EVENTS ---------------- */
  document.getElementById('type-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    activeType = btn.getAttribute('data-type');
    document.querySelectorAll('#type-filter .btn-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadReport();
  });

  document.getElementById('period-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    activePeriod = btn.getAttribute('data-period');
    document.querySelectorAll('#period-filter .btn-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('custom-range').style.display = activePeriod === 'custom' ? 'flex' : 'none';
    if (activePeriod !== 'custom') resolveAndLoad();
  });

  document.getElementById('btn-apply-custom').addEventListener('click', resolveAndLoad);

  document.getElementById('btn-print').addEventListener('click', () => window.print());

  document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    if (!exportData) return;
    const res = await callApi(window.api.reports.export({ format: 'pdf', fileName: exportData.title.replace(/\s+/g, '_'), title: exportData.title, subtitle: exportData.subtitle, columns: exportData.columns, rows: exportData.rows }));
    if (res && !res.canceled) toast('Laporan PDF berhasil disimpan');
  });

  document.getElementById('btn-export-excel').addEventListener('click', async () => {
    if (!exportData) return;
    const res = await callApi(window.api.reports.export({ format: 'excel', fileName: exportData.title.replace(/\s+/g, '_'), title: exportData.title, subtitle: exportData.subtitle, columns: exportData.columns, rows: exportData.rows }));
    if (res && !res.canceled) toast('Laporan Excel berhasil disimpan');
  });

  resolveAndLoad();
})();
