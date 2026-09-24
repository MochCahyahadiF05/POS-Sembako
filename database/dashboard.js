'use strict';

const { todayStr, pad } = require('./helpers');

function getSummary(db) {
  const today = todayStr();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

  const incomeToday = db
    .prepare(`SELECT COALESCE(SUM(final_amount),0) AS t, COUNT(*) AS c FROM transactions WHERE status='selesai' AND date(transaction_date) = date(?)`)
    .get(today);

  const incomeMonth = db
    .prepare(`SELECT COALESCE(SUM(final_amount),0) AS t FROM transactions WHERE status='selesai' AND date(transaction_date) >= date(?)`)
    .get(monthStart);

  const expenseMonth = db
    .prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE date(date) >= date(?)`)
    .get(monthStart);

  const itemsSoldToday = db
    .prepare(
      `SELECT COALESCE(SUM(ti.quantity),0) AS t FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.status='selesai' AND date(t.transaction_date) = date(?)`
    )
    .get(today);

  const bestProduct = db
    .prepare(
      `SELECT ti.product_name, SUM(ti.quantity) AS qty FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.status='selesai' AND date(t.transaction_date) >= date(?)
       GROUP BY ti.product_id ORDER BY qty DESC LIMIT 1`
    )
    .get(monthStart);

  const stockBeras = db.prepare(`SELECT COALESCE(SUM(stock),0) AS t FROM products WHERE category='beras' AND active=1`).get().t;
  const stockTelur = db.prepare(`SELECT COALESCE(SUM(stock),0) AS t FROM products WHERE category='telur' AND active=1`).get().t;
  const gasTotals = db.prepare(`SELECT COALESCE(SUM(filled_stock),0) AS isi, COALESCE(SUM(empty_stock),0) AS kosong FROM gas_stock WHERE active = 1`).get();

  const netProfit = incomeMonth.t - expenseMonth.t;

  return {
    incomeToday: incomeToday.t,
    transactionsToday: incomeToday.c,
    incomeMonth: incomeMonth.t,
    expenseTotal: expenseMonth.t,
    netProfit,
    itemsSoldToday: itemsSoldToday.t,
    bestProduct: bestProduct ? bestProduct.product_name : '-',
    stockBeras,
    stockTelur,
    gasFilled: gasTotals.isi,
    gasEmpty: gasTotals.kosong
  };
}

function dailyIncomeChart(db, days = 7) {
  const rows = db
    .prepare(
      `SELECT date(transaction_date) AS d, COALESCE(SUM(final_amount),0) AS income
       FROM transactions WHERE status='selesai' AND date(transaction_date) >= date('now', ?)
       GROUP BY date(transaction_date)`
    )
    .all(`-${days - 1} days`);

  const expenseRows = db
    .prepare(
      `SELECT date(date) AS d, COALESCE(SUM(amount),0) AS expense
       FROM expenses WHERE date(date) >= date('now', ?)
       GROUP BY date(date)`
    )
    .all(`-${days - 1} days`);

  const labels = [];
  const income = [];
  const expense = [];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(dayNames[d.getDay()]);
    const inc = rows.find((r) => r.d === key);
    const exp = expenseRows.find((r) => r.d === key);
    income.push(inc ? inc.income : 0);
    expense.push(exp ? exp.expense : 0);
  }
  return { labels, income, expense };
}

function monthlyIncomeChart(db) {
  const now = new Date();
  const year = now.getFullYear();
  const rows = db
    .prepare(
      `SELECT strftime('%m', transaction_date) AS m, COALESCE(SUM(final_amount),0) AS income
       FROM transactions WHERE status='selesai' AND strftime('%Y', transaction_date) = ?
       GROUP BY m`
    )
    .all(String(year));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const data = monthNames.map((_, idx) => {
    const key = String(idx + 1).padStart(2, '0');
    const found = rows.find((r) => r.m === key);
    return found ? found.income : 0;
  });
  return { labels: monthNames, data };
}

function productSalesChart(db, limit = 5) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const rows = db
    .prepare(
      `SELECT ti.product_name, SUM(ti.subtotal) AS total FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.status='selesai' AND date(t.transaction_date) >= date(?)
       GROUP BY ti.product_id ORDER BY total DESC`
    )
    .all(monthStart);

  const top = rows.slice(0, limit);
  const othersTotal = rows.slice(limit).reduce((a, b) => a + b.total, 0);
  const labels = top.map((r) => r.product_name);
  const data = top.map((r) => r.total);
  if (othersTotal > 0) {
    labels.push('Lainnya');
    data.push(othersTotal);
  }
  return { labels, data };
}

module.exports = { getSummary, dailyIncomeChart, monthlyIncomeChart, productSalesChart };
