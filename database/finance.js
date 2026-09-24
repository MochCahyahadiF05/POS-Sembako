'use strict';

const { nowStr } = require('./helpers');

function hydratePurchaseDetails(db, expenses) {
  const findMovement = db.prepare(`
    SELECT sm.quantity, sm.unit, sm.purchase_price, sm.supplier, p.name AS product_name
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    WHERE sm.type = 'masuk'
      AND sm.total_price = ?
      AND date(sm.date) = date(?)
      AND ? LIKE 'Pembelian ' || p.name || '%'
    ORDER BY sm.id DESC
    LIMIT 1
  `);
  const updateExpense = db.prepare(`
    UPDATE expenses
    SET product_name = ?, quantity = ?, unit = ?, unit_price = ?, supplier = ?
    WHERE id = ?
  `);

  for (const expense of expenses) {
    if (expense.product_name || !expense.description) continue;
    const movement = findMovement.get(expense.amount, expense.date, expense.description);
    if (!movement) continue;
    Object.assign(expense, movement);
    updateExpense.run(movement.product_name, movement.quantity, movement.unit, movement.purchase_price, movement.supplier, expense.id);
  }
  return expenses;
}

function listExpenses(db, { from, to } = {}) {
  let sql = `SELECT * FROM expenses WHERE 1=1`;
  const params = [];
  if (from) {
    sql += ` AND date(date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    sql += ` AND date(date) <= date(?)`;
    params.push(to);
  }
  sql += ` ORDER BY date DESC, id DESC`;
  return hydratePurchaseDetails(db, db.prepare(sql).all(...params));
}

function createExpense(db, data) {
  const info = db
    .prepare(`INSERT INTO expenses (category, description, amount, date, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(data.category, data.description || '', Number(data.amount), data.date || nowStr(), nowStr());
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
}

function deleteExpense(db, id) {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return { success: true };
}

function listIncomeExtra(db, { from, to } = {}) {
  let sql = `SELECT * FROM income_extra WHERE 1=1`;
  const params = [];
  if (from) {
    sql += ` AND date(date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    sql += ` AND date(date) <= date(?)`;
    params.push(to);
  }
  sql += ` ORDER BY date DESC, id DESC`;
  return db.prepare(sql).all(...params);
}

function createIncomeExtra(db, data) {
  const info = db
    .prepare(`INSERT INTO income_extra (description, amount, date, created_at) VALUES (?, ?, ?, ?)`)
    .run(data.description || '', Number(data.amount), data.date || nowStr(), nowStr());
  return db.prepare('SELECT * FROM income_extra WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Riwayat pendapatan gabungan:
 *  - penjualan dari kasir (tabel transactions)
 *  - pendapatan lainnya (tabel income_extra)
 * Dikembalikan terurut dari yang terbaru.
 */
function listIncomes(db, { from, to } = {}) {
  const salesParams = [];
  let salesSql = `
    SELECT
      t.id                AS ref_id,
      'penjualan'          AS source,
      t.transaction_date    AS date,
      t.invoice_number       AS reference,
      t.payment_method        AS payment_method,
      t.final_amount           AS amount,
      t.cashier_name            AS cashier_name,
      (SELECT GROUP_CONCAT(ti.product_name, ', ')
         FROM transaction_items ti WHERE ti.transaction_id = t.id) AS description
    FROM transactions t
    WHERE t.status = 'selesai'`;
  if (from) {
    salesSql += ` AND date(t.transaction_date) >= date(?)`;
    salesParams.push(from);
  }
  if (to) {
    salesSql += ` AND date(t.transaction_date) <= date(?)`;
    salesParams.push(to);
  }
  const sales = db.prepare(salesSql).all(...salesParams);

  const extraParams = [];
  let extraSql = `
    SELECT
      id          AS ref_id,
      'lainnya'    AS source,
      date          AS date,
      NULL           AS reference,
      NULL            AS payment_method,
      amount           AS amount,
      NULL              AS cashier_name,
      description        AS description
    FROM income_extra
    WHERE 1=1`;
  if (from) {
    extraSql += ` AND date(date) >= date(?)`;
    extraParams.push(from);
  }
  if (to) {
    extraSql += ` AND date(date) <= date(?)`;
    extraParams.push(to);
  }
  const extras = db.prepare(extraSql).all(...extraParams);

  return [...sales, ...extras].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function deleteIncomeExtra(db, id) {
  db.prepare('DELETE FROM income_extra WHERE id = ?').run(id);
  return { success: true };
}

function financeSummary(db, { from, to } = {}) {
  let salesSql = `SELECT COALESCE(SUM(final_amount),0) AS total FROM transactions WHERE status = 'selesai'`;
  const params = [];
  if (from) {
    salesSql += ` AND date(transaction_date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    salesSql += ` AND date(transaction_date) <= date(?)`;
    params.push(to);
  }
  const salesTotal = db.prepare(salesSql).get(...params).total;

  const salesByCategory = db
    .prepare(
      `SELECT ti.category, COALESCE(SUM(ti.subtotal),0) AS total
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.status = 'selesai'
       ${from ? "AND date(t.transaction_date) >= date(?)" : ''}
       ${to ? "AND date(t.transaction_date) <= date(?)" : ''}
       GROUP BY ti.category`
    )
    .all(...[from, to].filter(Boolean));

  const extraIncome = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM income_extra WHERE 1=1
       ${from ? "AND date(date) >= date(?)" : ''}
       ${to ? "AND date(date) <= date(?)" : ''}`
    )
    .get(...[from, to].filter(Boolean)).total;

  const expensesByCategory = db
    .prepare(
      `SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses WHERE 1=1
       ${from ? "AND date(date) >= date(?)" : ''}
       ${to ? "AND date(date) <= date(?)" : ''}
       GROUP BY category`
    )
    .all(...[from, to].filter(Boolean));

  const totalExpense = expensesByCategory.reduce((a, b) => a + b.total, 0);
  const totalIncome = salesTotal + extraIncome;
  const netProfit = totalIncome - totalExpense;

  return {
    totalIncome,
    salesTotal,
    extraIncome,
    salesByCategory,
    totalExpense,
    expensesByCategory,
    netProfit
  };
}

module.exports = {
  listExpenses,
  createExpense,
  deleteExpense,
  listIncomeExtra,
  createIncomeExtra,
  deleteIncomeExtra,
  listIncomes,
  financeSummary
};
