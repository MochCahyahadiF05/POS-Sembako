'use strict';

const { nowStr, generateInvoiceNumber, round2 } = require('./helpers');
const { getProduct, adjustProductStock } = require('./products');
const { toBaseQty } = require('./stock');
const gas = require('./gas');

/**
 * items: [{ product_id, quantity, unit, price, gas_mode? ('tukar'|'tanpa_tukar') }]
 */
function checkout(db, { items, payment_method, discount = 0, paid_amount = 0, customer_name = '', cashier_name = '', note = '' }) {
  if (!items || items.length === 0) throw new Error('Keranjang belanja kosong');

  const txn = db.transaction(() => {
    let totalAmount = 0;
    const resolvedItems = [];

    // Validasi & hitung total dulu sebelum menyentuh stok
    for (const item of items) {
      const product = getProduct(db, item.product_id);
      if (!product) throw new Error(`Produk ID ${item.product_id} tidak ditemukan`);
      const qty = Number(item.quantity);
      if (qty <= 0) throw new Error(`Jumlah tidak valid untuk ${product.name}`);

      if (product.category === 'gas') {
        const gasRow = gas.getGas(db, product.gas_id);
        if (!gasRow || gasRow.filled_stock < qty) {
          throw new Error(`Stok gas isi ${product.name} tidak mencukupi (tersedia ${gasRow ? gasRow.filled_stock : 0})`);
        }
      } else {
        const baseQty = toBaseQty(product, qty, item.unit);
        if (product.stock < baseQty) {
          throw new Error(`Stok ${product.name} tidak mencukupi (tersedia ${product.stock} ${product.unit})`);
        }
      }

      const price = product.category === 'gas'
        ? (item.gas_mode === 'tanpa_tukar' ? Number(product.no_exchange_price || product.selling_price) : Number(product.selling_price))
        : Number(item.price);
      const subtotal = round2(price * qty);
      totalAmount += subtotal;
      resolvedItems.push({ product, qty, unit: item.unit || product.unit, price, subtotal, gas_mode: item.gas_mode || 'tukar' });
    }

    const finalAmount = round2(Math.max(0, totalAmount - Number(discount || 0)));
    const paid = round2(Math.max(0, Number(paid_amount) || 0));
    const change = round2(Math.max(0, paid - finalAmount));
    const status = paid >= finalAmount ? 'selesai' : 'belum_bayar';
    const invoiceNumber = generateInvoiceNumber(db);

    const txnInfo = db
      .prepare(
        `INSERT INTO transactions
           (invoice_number, transaction_date, cashier_name, customer_name, payment_method, total_amount, discount, final_amount, paid_amount, change_amount, note, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(invoiceNumber, nowStr(), cashier_name || null, customer_name || null, payment_method || 'tunai', totalAmount, Number(discount) || 0, finalAmount, paid, change, note || null, status, nowStr());

    const transactionId = txnInfo.lastInsertRowid;
    if (paid > 0) db.prepare('INSERT INTO transaction_payments (transaction_id, amount, payment_method, cashier_name) VALUES (?, ?, ?, ?)').run(transactionId, paid, payment_method || 'tunai', cashier_name || null);

    const insertItem = db.prepare(`
      INSERT INTO transaction_items (transaction_id, product_id, product_name, category, quantity, unit, price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, unit, note, stock_before, stock_after, date)
      VALUES (?, 'penjualan', ?, ?, ?, ?, ?, ?)
    `);

    for (const ri of resolvedItems) {
      insertItem.run(transactionId, ri.product.id, ri.product.name, ri.product.category, ri.qty, ri.unit, ri.price, ri.subtotal);

      if (ri.product.category === 'gas') {
        gas.processSaleFromCart(db, ri.product.gas_id, ri.qty, ri.gas_mode, ri.subtotal, invoiceNumber);
        insertMovement.run(ri.product.id, ri.qty, 'tabung', `Penjualan Kasir ${invoiceNumber} (${ri.gas_mode === 'tanpa_tukar' ? 'tanpa tukar' : 'tukar'})`, null, null, nowStr());
      } else {
        const baseQty = toBaseQty(ri.product, ri.qty, ri.unit);
        const stockBefore = ri.product.stock;
        const stockAfter = adjustProductStock(db, ri.product.id, -baseQty);
        insertMovement.run(ri.product.id, baseQty, ri.product.unit, `Penjualan Kasir ${invoiceNumber}`, stockBefore, stockAfter, nowStr());
      }
    }

    return getTransaction(db, transactionId);
  });

  return txn();
}

function getTransaction(db, id) {
  const trx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!trx) return null;
  const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(id);
  return { ...trx, items };
}

function listTransactions(db, { from, to, limit = 200 } = {}) {
  let sql = `SELECT * FROM transactions WHERE status IN ('selesai', 'belum_bayar')`;
  const params = [];
  if (from) {
    sql += ` AND date(transaction_date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    sql += ` AND date(transaction_date) <= date(?)`;
    params.push(to);
  }
  sql += ` ORDER BY transaction_date DESC, id DESC LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function listReceivables(db, { search = '' } = {}) {
  let sql = `SELECT t.*, ROUND(t.final_amount - t.paid_amount, 2) AS remaining_amount
    FROM transactions t WHERE t.status = 'belum_bayar'`;
  const params = [];
  if (search) {
    sql += ` AND (LOWER(COALESCE(t.customer_name, '')) LIKE ? OR LOWER(t.invoice_number) LIKE ?)`;
    const term = `%${String(search).toLowerCase()}%`;
    params.push(term, term);
  }
  sql += ' ORDER BY t.transaction_date ASC, t.id ASC';
  const rows = db.prepare(sql).all(...params).map((transaction) => ({
    ...transaction,
    payments: db.prepare('SELECT * FROM transaction_payments WHERE transaction_id = ? ORDER BY payment_date ASC, id ASC').all(transaction.id)
  }));
  const paidToday = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transaction_payments WHERE date(payment_date) = date('now', 'localtime')").get().total;
  return { rows, paidToday };
}

function listCustomerNames(db) {
  return db.prepare(`SELECT DISTINCT customer_name FROM transactions
    WHERE customer_name IS NOT NULL AND trim(customer_name) <> ''
    ORDER BY customer_name COLLATE NOCASE`).all().map((row) => row.customer_name);
}

function recordPayment(db, { transaction_id, amount, payment_method = 'tunai', cashier_name = '', customer_name = '', note = '' }) {
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction_id);
  if (!transaction) throw new Error('Transaksi tidak ditemukan');
  const remaining = round2(transaction.final_amount - transaction.paid_amount);
  const payment = round2(Number(amount) || 0);
  if (payment <= 0) throw new Error('Nominal pembayaran harus lebih besar dari nol');
  if (payment > remaining) throw new Error(`Pembayaran melebihi sisa piutang ${remaining}`);
  const txn = db.transaction(() => {
    const paid = round2(transaction.paid_amount + payment);
    const status = paid >= transaction.final_amount ? 'selesai' : 'belum_bayar';
    db.prepare('INSERT INTO transaction_payments (transaction_id, amount, payment_method, cashier_name, note) VALUES (?, ?, ?, ?, ?)').run(transaction_id, payment, payment_method, cashier_name || null, note || null);
    db.prepare("UPDATE transactions SET paid_amount = ?, status = ?, change_amount = 0, customer_name = COALESCE(NULLIF(?, ''), customer_name) WHERE id = ?").run(paid, status, customer_name || '', transaction_id);
  });
  txn();
  return getTransaction(db, transaction_id);
}

function voidTransaction(db, id) {
  const trx = getTransaction(db, id);
  if (!trx) throw new Error('Transaksi tidak ditemukan');
  if (trx.status === 'batal') return trx;

  const txn = db.transaction(() => {
    for (const item of trx.items) {
      const product = getProduct(db, item.product_id);
      if (!product) continue;
      if (product.category === 'gas') {
        // Kembalikan gas isi (asumsikan mode tukar dibalik)
        gas.tambahTabungBaru(db, product.gas_id, item.quantity, 0, `Pembatalan ${trx.invoice_number}`);
      } else {
        const baseQty = toBaseQty(product, item.quantity, item.unit);
        adjustProductStock(db, product.id, baseQty);
      }
    }
    db.prepare(`UPDATE transactions SET status = 'batal' WHERE id = ?`).run(id);
  });
  txn();
  return getTransaction(db, id);
}

module.exports = { checkout, getTransaction, listTransactions, listReceivables, listCustomerNames, recordPayment, voidTransaction };
