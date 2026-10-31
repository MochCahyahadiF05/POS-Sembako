'use strict';

(function () {
  const user = initPage('receivables', 'Piutang', 'Kelola pembayaran pelanggan dan cicilan');
  if (!user) return;

  let rows = [];
  let search = '';
  let paidToday = 0;
  const body = document.getElementById('receivable-body');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function parseAmountInput(value) {
    return Number(String(value || '').replace(/[^0-9]/g, '')) || 0;
  }

  function formatAmountInput(input) {
    const amount = parseAmountInput(input.value);
    input.value = amount ? amount.toLocaleString('id-ID') : '';
  }

  async function loadReceivables() {
    const data = (await callApi(window.api.transactions.listReceivables({ search }))) || { rows: [], paidToday: 0 };
    rows = data.rows || [];
    paidToday = Number(data.paidToday || 0);
    render();
  }

  function render() {
    const total = rows.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0);
    document.getElementById('receivable-count').textContent = numFmt(rows.length);
    document.getElementById('receivable-total').textContent = rupiah(total);
    document.getElementById('receivable-paid-today').textContent = rupiah(paidToday);
    body.innerHTML = rows.map((row) => `
      <tr>
        <td class="font-semibold">${escapeHtml(row.customer_name || 'Tanpa Nama')}</td>
        <td>${escapeHtml(row.invoice_number)}</td>
        <td class="text-sm">${fmtDateTime(row.transaction_date)}</td>
        <td>${rupiah(row.final_amount)}</td>
        <td>${rupiah(row.paid_amount)}</td>
        <td class="font-semibold text-red">${rupiah(row.remaining_amount)}</td>
        <td><button class="btn btn-primary btn-sm" data-pay="${row.id}">Bayar</button></td>
      </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state">Tidak ada piutang aktif</div></td></tr>`;
    body.querySelectorAll('[data-pay]').forEach((button) => button.addEventListener('click', () => openPaymentModal(rows.find((row) => row.id === Number(button.dataset.pay)))));
  }

  function openPaymentModal(row) {
    if (!row) return;
    const remaining = Number(row.remaining_amount || 0);
    const history = row.payments.map((payment) => `<tr><td>${fmtDateTime(payment.payment_date)}</td><td>${rupiah(payment.amount)}</td><td>${escapeHtml(payment.payment_method)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-muted">Belum ada riwayat cicilan</td></tr>';
    const overlay = openModal(`
      <div class="modal-header"><div><h3>Bayar Piutang</h3><div class="text-xs text-muted mt-1">${escapeHtml(row.customer_name || 'Tanpa Nama')} - ${escapeHtml(row.invoice_number)}</div></div><button class="modal-close" id="payment-close">&times;</button></div>
      <div class="modal-body">
        <div class="transaction-total-box mb-3"><div><span>Total Transaksi</span><span>${rupiah(row.final_amount)}</span></div><div><span>Sudah Dibayar</span><span>${rupiah(row.paid_amount)}</span></div><div class="total"><strong>Sisa Piutang</strong><strong class="text-red">${rupiah(remaining)}</strong></div></div>
        <div class="form-group"><label>Nama Pelanggan</label><input class="input" id="payment-customer-name" value="${escapeHtml(row.customer_name || '')}" placeholder="Nama pelanggan" /></div>
        <div class="form-group"><label>Nominal Pembayaran</label><input class="input" id="payment-amount" type="text" inputmode="numeric" placeholder="Boleh dicicil" autofocus /></div>
        <div class="form-group mt-2"><label>Metode Pembayaran</label><select class="input" id="payment-method"><option value="tunai">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option></select></div>
        <div class="form-group mt-2"><label>Catatan</label><input class="input" id="payment-note" placeholder="Opsional" /></div>
        <div class="section-title mt-4 mb-2">Riwayat Pembayaran</div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Nominal</th><th>Metode</th></tr></thead><tbody>${history}</tbody></table></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" id="payment-cancel">Batal</button><button class="btn btn-primary" id="payment-save">Simpan Pembayaran</button></div>
    `, { size: 'modal-lg' });
    const close = () => closeModal();
    overlay.querySelector('#payment-close').addEventListener('click', close);
    overlay.querySelector('#payment-cancel').addEventListener('click', close);
    overlay.querySelector('#payment-amount').addEventListener('input', (event) => formatAmountInput(event.currentTarget));
    overlay.querySelector('#payment-save').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const amount = parseAmountInput(overlay.querySelector('#payment-amount').value);
      if (amount <= 0 || amount > remaining) {
        toast(`Nominal harus di antara Rp 1 dan ${rupiah(remaining)}`, 'error');
        return;
      }
      button.disabled = true;
      const result = await callApi(window.api.transactions.recordPayment({
        transaction_id: row.id,
        amount,
        payment_method: overlay.querySelector('#payment-method').value,
        customer_name: overlay.querySelector('#payment-customer-name').value.trim(),
        note: overlay.querySelector('#payment-note').value.trim(),
        cashier_name: user.full_name
      }));
      button.disabled = false;
      if (result) {
        close();
        toast(result.status === 'selesai' ? 'Piutang sudah lunas' : 'Pembayaran cicilan tersimpan');
        loadReceivables();
      }
    });
    overlay.querySelector('#payment-amount').focus();
  }

  document.getElementById('receivable-search').addEventListener('input', (event) => {
    search = event.target.value.trim();
    loadReceivables();
  });

  loadReceivables();
})();
