'use strict';

(async function () {
  const user = initPage('dashboard', 'Dashboard', `Selamat datang, ${(requireAuth() || {}).full_name || ''}`);
  if (!user) return;

  const summary = await callApi(window.api.dashboard.summary());
  if (summary) {
    document.getElementById('stat-income-today').textContent = rupiah(summary.incomeToday);
    document.getElementById('stat-txn-today').textContent = `${summary.transactionsToday} transaksi`;
    document.getElementById('stat-income-month').textContent = rupiah(summary.incomeMonth);
    document.getElementById('stat-month-label').textContent = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    document.getElementById('stat-expense').textContent = rupiah(summary.expenseTotal);
    document.getElementById('stat-profit').textContent = (summary.netProfit < 0 ? '-' : '') + rupiah(Math.abs(summary.netProfit));
    document.getElementById('stat-txn-count').textContent = summary.transactionsToday;
    document.getElementById('stat-items-sold').textContent = numFmt(summary.itemsSoldToday);
    document.getElementById('stat-best-product').textContent = summary.bestProduct || '-';
    document.getElementById('stat-stock-beras').textContent = numFmt(summary.stockBeras);
    document.getElementById('stat-stock-telur').textContent = numFmt(summary.stockTelur);
    document.getElementById('stat-gas-filled').textContent = `${numFmt(summary.gasFilled)} Tabung`;
    document.getElementById('stat-gas-empty').textContent = `${numFmt(summary.gasEmpty)} Tabung`;
    document.getElementById('stat-gas-total').textContent = `${numFmt(summary.gasFilled + summary.gasEmpty)} Tabung`;
  }

  document.getElementById('chart-year').textContent = new Date().getFullYear();

  const CHART_GREEN = '#16a34a';
  const CHART_AMBER = '#d97706';
  const PALETTE = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#9aa3b2'];

  const daily = await callApi(window.api.dashboard.dailyChart(7), { silent: true });
  if (daily) {
    new Chart(document.getElementById('chart-daily'), {
      type: 'line',
      data: {
        labels: daily.labels,
        datasets: [
          { label: 'Pendapatan', data: daily.income, borderColor: CHART_GREEN, backgroundColor: 'rgba(22,163,74,0.08)', tension: 0.35, fill: true, pointRadius: 3 },
          { label: 'Pengeluaran', data: daily.expense, borderColor: CHART_AMBER, backgroundColor: 'rgba(217,119,6,0.06)', tension: 0.35, fill: true, pointRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { y: { ticks: { callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v) } } }
      }
    });
  }

  const products = await callApi(window.api.dashboard.productChart(), { silent: true });
  if (products && products.labels.length) {
    new Chart(document.getElementById('chart-products'), {
      type: 'doughnut',
      data: { labels: products.labels, datasets: [{ data: products.data, backgroundColor: PALETTE, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } }, cutout: '65%' }
    });
  } else {
    document.getElementById('chart-products').parentElement.innerHTML = `<div class="empty-state">${icon('barChart', { size: 30 })}<div class="mt-1">Belum ada penjualan bulan ini</div></div>`;
  }

  const monthly = await callApi(window.api.dashboard.monthlyChart(), { silent: true });
  if (monthly) {
    new Chart(document.getElementById('chart-monthly'), {
      type: 'bar',
      data: { labels: monthly.labels, datasets: [{ label: 'Pendapatan', data: monthly.data, backgroundColor: CHART_GREEN, borderRadius: 6, maxBarThickness: 32 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : v) } } }
      }
    });
  }
})();
