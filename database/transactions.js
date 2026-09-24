'use strict';

const { nowStr, generateInvoiceNumber, round2 } = require('./helpers');
const { getProduct, adjustProductStock } = require('./products');
const { toBaseQty } = require('./stock');
const gas = require('./gas');

/**
 * items: [{ product_id, quantity, unit, price, gas_mode? ('tukar'|'tanpa_tukar') }]
 */
function checkout(db, { items, payment_method, discount = 0, paid_amount = 0, cashier_name = '', note = '' }) {
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
    const paid = Number(paid_amount) || finalAmount;
    const change = round2(paid - finalAmount);
    const invoiceNumber = generateInvoiceNumber(db);

    const txnInfo = db
      .prepare(
        `INSERT INTO transactions
           (invoice_number, transaction_date, cashier_name, payment_method, total_amount, discount, final_amount, paid_amount, change_amount, note, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'selesai', ?)`
        )
        .run(invoiceNumber, nowStr(), cashier_name || null, payment_method || 'tunai', totalAmount, Number(discount) || 0, finalAmount, paid, change, note || null, nowStr());

    const transactionId = txnInfo.lastInsertRowid;

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
  let sql = `SELECT * FROM transactions WHERE status = 'selesai'`;
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

module.exports = { checkout, getTransaction, listTransactions, voidTransaction };
