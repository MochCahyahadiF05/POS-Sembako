'use strict';

(function () {
  const user = initPage('finance', 'Keuangan', 'Pencatatan pendapatan, pengeluaran, dan laba bersih');
  if (!user) return;

  const EXPENSE_CATEGORIES = ['Pembelian Beras', 'Pembelian Telur', 'Pembelian Gas', 'Biaya Operasional', 'Pengeluaran Lainnya'];

  let activePeriod = 'today';
  let range = { from: null, to: null };
  const PAGE_SIZE = 10;
  let incomePage = 1;
  let expensePage = 1;

  function renderPagination(containerId, page, total, onPageChange) {
    const container = document.getElementById(containerId);
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <button class="btn btn-secondary btn-sm" data-page-action="prev" ${page === 1 ? 'disabled' : ''}>Sebelumnya</button>
      <span class="text-sm text-muted">Halaman ${page} dari ${totalPages}</span>
      <button class="btn btn-secondary btn-sm" data-page-action="next" ${page === totalPages ? 'disabled' : ''}>Berikutnya</button>`;
    container.querySelectorAll('[data-page-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextPage = button.dataset.pageAction === 'next' ? page + 1 : page - 1;
        onPageChange(nextPage);
      });
    });
  }

  function showExpenseDetail(expense) {
    const hasPurchaseDetail = expense.product_name && expense.quantity != null;
    const expenseQuantity = hasPurchaseDetail ? Number(expense.quantity).toLocaleString('id-ID', { maximumFractionDigits: 3 }) : '-';
    const overlay = openModal(`
      <div class="modal-header">
        <div><h3>Detail Pengeluaran</h3><div class="text-xs text-muted mt-1">${fmtDateTime(expense.date)}</div></div>
        <button class="modal-close" id="expense-detail-close">&times;</button>
      </div>
      <div class="modal-body transaction-detail-body">
        <div class="transaction-detail-grid">
          <div><span class="detail-label">Tanggal</span><strong>${fmtDateTime(expense.date)}</strong></div>
          <div><span class="detail-label">Kategori</span><strong>${expense.category}</strong></div>
          <div><span class="detail-label">Nominal</span><strong class="text-red">${rupiah(expense.amount)}</strong></div>
          <div><span class="detail-label">ID Catatan</span><strong>#${expense.id}</strong></div>
        </div>
        <div class="section-title mt-4 mb-2">Rincian Pembelian</div>
        <div class="transaction-detail-grid">
          <div><span class="detail-label">Barang</span><strong>${expense.product_name || '-'}</strong></div>
          <div><span class="detail-label">Jumlah</span><strong>${expenseQuantity} ${expense.unit || ''}</strong></div>
          <div><span class="detail-label">Harga per Satuan</span><strong>${expense.unit_price != null ? rupiah(expense.unit_price) : '-'}</strong></div>
          <div><span class="detail-label">Supplier</span><strong>${expense.supplier || '-'}</strong></div>
        </div>
        <div class="section-title mt-4 mb-2">Keterangan</div>
        <div class="card" style="background:#f8fafc; box-shadow:none; border:1px solid var(--border);">
          <div class="text-sm">${expense.description || 'Tidak ada keterangan'}</div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" id="expense-detail-close-footer">Tutup</button></div>
    `, { size: 'modal-lg' });
    overlay.querySelector('#expense-detail-close').addEventListener('click', closeModal);
    overlay.querySelector('#expense-detail-close-footer').addEventListener('click', closeModal);
  }

  async function resolveAndLoad() {
    range = (await callApi(window.api.reports.resolveRange(activePeriod), { silent: true })) || {};
    await load();
  }

  async function load() {
    const summary = await callApi(window.api.finance.summary(range));
    if (summary) {
      document.getElementById('stat-income').textContent = rupiah(summary.totalIncome);
      document.getElementById('stat-expense').textContent = rupiah(summary.totalExpense);
      const profit = summary.netProfit;
      const profitEl = document.getElementById('stat-profit');
      profitEl.textContent = (profit < 0 ? '-' : '') + rupiah(Math.abs(profit));
      profitEl.style.color = profit < 0 ? 'var(--red-600)' : 'var(--purple-600)';

      const incomeRows = [{ label: 'Penjualan Beras', cat: 'beras' }, { label: 'Penjualan Telur', cat: 'telur' }, { label: 'Penjualan Gas', cat: 'gas' }]
        .map((r) => {
          const found = summary.salesByCategory.find((s) => s.category === r.cat);
          return `<div class="flex justify-between text-sm"><span class="text-muted">${r.label}</span><span class="font-semibold">${rupiah(found ? found.total : 0)}</span></div>`;
        })
        .join('');
      document.getElementById('income-breakdown').innerHTML =
        incomeRows + `<div class="flex justify-between text-sm" style="border-top:1px solid var(--border);padding-top:8px;"><span class="text-muted">Pendapatan Lainnya</span><span class="font-semibold">${rupiah(summary.extraIncome)}</span></div>`;

      document.getElementById('expense-breakdown').innerHTML = EXPENSE_CATEGORIES.map((cat) => {
        const found = summary.expensesByCategory.find((e) => e.category === cat);
        return `<div class="flex justify-between text-sm"><span class="text-muted">${cat}</span><span class="font-semibold">${rupiah(found ? found.total : 0)}</span></div>`;
      }).join('');
    }

    // ---- Riwayat Pendapatan ----
    const incomes = (await callApi(window.api.finance.listIncomes(range))) || [];
    const incomeBody = document.getElementById('income-body');
    const incomeTotal = incomes.reduce((a, b) => a + Number(b.amount || 0), 0);
    document.getElementById('income-total-inline').textContent = rupiah(incomeTotal);
    incomePage = Math.min(incomePage, Math.max(1, Math.ceil(incomes.length / PAGE_SIZE)));
    const incomeStart = (incomePage - 1) * PAGE_SIZE;
    const visibleIncomes = incomes.slice(incomeStart, incomeStart + PAGE_SIZE);

    if (!incomes.length) {
      incomeBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${icon('trendingUp', { size: 30 })}<div class="mt-1">Belum ada pendapatan pada periode ini</div></div></td></tr>`;
    } else {
      incomeBody.innerHTML = visibleIncomes
        .map((r) => {
          const isSale = r.source === 'penjualan';
          return `
          <tr>
            <td class="text-sm">${fmtDateTime(r.date)}</td>
            <td><span class="badge ${isSale ? 'badge-green' : 'badge-blue'}">${isSale ? 'Penjualan' : 'Lainnya'}</span></td>
            <td class="text-sm font-semibold">${r.reference || '-'}</td>
            <td class="text-sm text-muted">${r.description || '-'}</td>
            <td class="text-sm">${r.payment_method ? paymentBadge(r.payment_method) : '-'}</td>
            <td class="font-semibold text-green">${rupiah(r.amount)}</td>
            <td class="text-right">${isSale ? '' : `<button class="btn btn-danger btn-sm" data-del-income="${r.ref_id}">Hapus</button>`}</td>
          </tr>`;
        })
        .join('');

      incomeBody.querySelectorAll('[data-del-income]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = Number(b.getAttribute('data-del-income'));
          confirmDialog('Hapus pendapatan ini?', 'Catatan pendapatan lainnya akan dihapus permanen.', async () => {
            const res = await callApi(window.api.finance.deleteIncomeExtra(id));
            if (res) {
              toast('Pendapatan berhasil dihapus');
              load();
            }
          });
        })
      );
    }
    renderPagination('income-pagination', incomePage, incomes.length, (page) => {
      incomePage = page;
      load();
    });

    const expenses = (await callApi(window.api.finance.listExpenses(range))) || [];
    const tbody = document.getElementById('expense-body');
    expensePage = Math.min(expensePage, Math.max(1, Math.ceil(expenses.length / PAGE_SIZE)));
    const expenseStart = (expensePage - 1) * PAGE_SIZE;
    const visibleExpenses = expenses.slice(expenseStart, expenseStart + PAGE_SIZE);
    if (!expenses.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">${icon('banknote', { size: 30 })}<div class="mt-1">Belum ada pengeluaran pada periode ini</div></div></td></tr>`;
    } else {
      tbody.innerHTML = visibleExpenses
        .map(
          (e) => `
          <tr>
            <td class="text-sm">${fmtDate(e.date)}</td>
            <td><span class="badge badge-amber">${e.category}</span></td>
            <td class="text-sm">${e.description || '-'}</td>
            <td class="font-semibold text-red">${rupiah(e.amount)}</td>
            <td class="text-right"><button class="btn btn-secondary btn-sm" data-detail-expense="${e.id}">Detail</button> <button class="btn btn-danger btn-sm" data-del="${e.id}">Hapus</button></td>
          </tr>`
        )
        .join('');
      tbody.querySelectorAll('[data-detail-expense]').forEach((b) =>
        b.addEventListener('click', () => {
          const expense = expenses.find((item) => item.id === Number(b.getAttribute('data-detail-expense')));
          if (expense) showExpenseDetail(expense);
        })
      );
      tbody.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = Number(b.getAttribute('data-del'));
          confirmDialog('Hapus catatan pengeluaran ini?', '', async () => {
            const res = await callApi(window.api.finance.deleteExpense(id));
            if (res) {
              toast('Pengeluaran berhasil dihapus');
              load();
            }
          });
        })
      );
    }
    renderPagination('expense-pagination', expensePage, expenses.length, (page) => {
      expensePage = page;
      load();
    });
  }

  document.getElementById('period-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    activePeriod = btn.getAttribute('data-period');
    incomePage = 1;
    expensePage = 1;
    document.querySelectorAll('#period-filter .btn-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    resolveAndLoad();
  });

  document.getElementById('btn-add-expense').addEventListener('click', () => {
    const html = `
      <div class="modal-header"><h3>Catat Pengeluaran</h3><button class="modal-close" id="m-close">&times;</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>Kategori</label>
          <select class="input" id="f-cat">${EXPENSE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Jumlah (Rp)</label><input class="input" type="number" min="0" id="f-amount" /></div>
        <div class="form-group"><label>Deskripsi</label><textarea class="input" id="f-desc" rows="2" placeholder="Opsional"></textarea></div>
        <div class="form-group"><label>Tanggal</label><input class="input" type="date" id="f-date" value="${new Date().toISOString().slice(0, 10)}" /></div>
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
      const amount = Number(overlay.querySelector('#f-amount').value);
      if (!amount || amount <= 0) return toast('Jumlah harus lebih dari 0', 'error');
      const payload = {
        category: overlay.querySelector('#f-cat').value,
        amount,
        description: overlay.querySelector('#f-desc').value.trim(),
        date: overlay.querySelector('#f-date').value
      };
      const res = await callApi(window.api.finance.createExpense(payload));
      if (res) {
        toast('Pengeluaran berhasil dicatat');
        closeModal();
        load();
      }
    });
  });

  document.getElementById('btn-add-income').addEventListener('click', () => {
    const html = `
      <div class="modal-header"><h3>Catat Pendapatan Lainnya</h3><button class="modal-close" id="m-close">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Jumlah (Rp)</label><input class="input" type="number" min="0" id="f-amount" /></div>
        <div class="form-group"><label>Deskripsi</label><textarea class="input" id="f-desc" rows="2" placeholder="cth. Sewa gudang"></textarea></div>
        <div class="form-group"><label>Tanggal</label><input class="input" type="date" id="f-date" value="${new Date().toISOString().slice(0, 10)}" /></div>
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
      const amount = Number(overlay.querySelector('#f-amount').value);
      if (!amount || amount <= 0) return toast('Jumlah harus lebih dari 0', 'error');
      const payload = {
        amount,
        description: overlay.querySelector('#f-desc').value.trim(),
        date: overlay.querySelector('#f-date').value
      };
      const res = await callApi(window.api.finance.createIncomeExtra(payload));
      if (res) {
        toast('Pendapatan lain berhasil dicatat');
        closeModal();
        load();
      }
    });
  });

  resolveAndLoad();
})();
