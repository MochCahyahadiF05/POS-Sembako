'use strict';

const { listStockIn, listStockOut } = require('./stock');
const { financeSummary } = require('./finance');

function salesReport(db, { from, to } = {}) {
  const transactions = require('./transactions').listTransactions(db, { from, to, limit: 5000 });
  const totalTransactions = transactions.length;
  const totalSales = transactions.reduce((a, t) => a + t.final_amount, 0);
  const avg = totalTransactions ? totalSales / totalTransactions : 0;

  let dailySql = `SELECT date(transaction_date) AS d, COALESCE(SUM(final_amount),0) AS total
    FROM transactions WHERE status='selesai'`;
  const params = [];
  if (from) {
    dailySql += ` AND date(transaction_date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    dailySql += ` AND date(transaction_date) <= date(?)`;
    params.push(to);
  }
  dailySql += ` GROUP BY d ORDER BY d`;
  const daily = db.prepare(dailySql).all(...params);

  return { transactions, totalTransactions, totalSales, avgPerTransaction: avg, daily };
}

function stockReport(db) {
  const products = require('./products').listProducts(db, { category: 'semua' });
  const gasList = require('./gas').listGas(db);
  return { products, gasList };
}

function financeReport(db, { from, to } = {}) {
  const summary = financeSummary(db, { from, to });
  const expenses = require('./finance').listExpenses(db, { from, to });
  const incomeExtra = require('./finance').listIncomeExtra(db, { from, to });
  return { ...summary, expenses, incomeExtra };
}

function gasReport(db, { from, to } = {}) {
  let sql = `SELECT gt.*, gs.gas_name FROM gas_transactions gt JOIN gas_stock gs ON gs.id = gt.gas_id WHERE 1=1`;
  const params = [];
  if (from) {
    sql += ` AND date(gt.date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    sql += ` AND date(gt.date) <= date(?)`;
    params.push(to);
  }
  sql += ` ORDER BY gt.date DESC, gt.id DESC`;
  const history = db.prepare(sql).all(...params);
  const gasList = require('./gas').listGas(db);
  return { history, gasList };
}

function stockInReport(db, { from, to } = {}) {
  return listStockIn(db, { from, to });
}

function stockOutReport(db, { from, to } = {}) {
  return listStockOut(db, { from, to });
}

module.exports = { salesReport, stockReport, financeReport, gasReport, stockInReport, stockOutReport };
