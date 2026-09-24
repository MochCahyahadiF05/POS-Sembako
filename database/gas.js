'use strict';

const { nowStr, generateInvoiceNumber, round2 } = require('./helpers');
const { setProductStock, getProduct } = require('./products');

/**
 * database/gas.js
 * ---------------------------------------------------------
 * Logika inti stok Gas LPG (Isi vs Kosong) sesuai spesifikasi:
 *
 *  A. Tukar Customer      : Isi -qty, Kosong +qty, Total tetap
 *  B. Tukar dengan Agen   : dilakukan 2 langkah (kirim & terima)
 *       - Kirim ke Agen   : Kosong -qty, Total -qty (keluar toko)
 *       - Terima dari Agen: Isi +qty,   Total +qty (masuk toko)
 *     (round-trip penuh => total kembali sama seperti semula)
 *  C. Jual Tanpa Tukar    : Isi -qty, Total -qty
 *  D. Tabung Baru         : Isi/Kosong bertambah, Total bertambah
 *  E. Penyesuaian Stok    : koreksi manual
 * ---------------------------------------------------------
 */

function syncProductStock(db, gasId) {
  const gas = db.prepare('SELECT * FROM gas_stock WHERE id = ?').get(gasId);
  if (!gas) return;
  const product = db.prepare('SELECT id FROM products WHERE gas_id = ?').get(gasId);
  if (product) setProductStock(db, product.id, gas.filled_stock);
}

function weightedPurchasePrice(currentQuantity, currentPrice, addedQuantity, addedPrice) {
  const totalQuantity = Number(currentQuantity) + Number(addedQuantity);
  if (totalQuantity <= 0) return 0;
  return round2(
    (Number(currentQuantity) * Number(currentPrice || 0) + Number(addedQuantity) * Number(addedPrice || 0)) /
      totalQuantity
  );
}

function listGas(db, { includeInactive = false } = {}) {
  const sql = includeInactive
    ? 'SELECT * FROM gas_stock ORDER BY gas_name'
    : 'SELECT * FROM gas_stock WHERE active = 1 ORDER BY gas_name';
  return db.prepare(sql).all();
}

function getGas(db, id) {
  return db.prepare('SELECT * FROM gas_stock WHERE id = ?').get(id);
}

function createGasType(db, data) {
  // Jika jenis gas dengan nama sama pernah dibuat lalu dihapus (active = 0),
  // aktifkan kembali beserta produknya daripada menolak karena UNIQUE constraint.
  const existing = db.prepare('SELECT * FROM gas_stock WHERE gas_name = ?').get(data.gas_name);
  if (existing) {
    if (existing.active === 1) throw new Error('Jenis gas dengan nama tersebut sudah ada');
    const reactivate = db.transaction(() => {
      db.prepare('UPDATE gas_stock SET active = 1 WHERE id = ?').run(existing.id);
      const prod = db.prepare('SELECT id FROM products WHERE gas_id = ?').get(existing.id);
      if (prod) {
        db.prepare('UPDATE products SET active = 1, updated_at = ? WHERE id = ?').run(nowStr(), prod.id);
      } else {
        db.prepare(
           `INSERT INTO products (name, category, unit, purchase_price, selling_price, no_exchange_price, stock, minimum_stock, gas_id, created_at, updated_at)
            VALUES (?, 'gas', 'tabung', ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(existing.gas_name, existing.purchase_price, existing.selling_price, existing.no_exchange_price, existing.filled_stock, existing.minimum_stock, existing.id, nowStr(), nowStr());
      }
    });
    reactivate();
    return getGas(db, existing.id);
  }

  const filled = Number(data.filled_stock) || 0;
  const empty = Number(data.empty_stock) || 0;
  const purchase = Number(data.purchase_price) || 0;
  const selling = Number(data.selling_price) || 0;
  const noExchange = Number(data.no_exchange_price) || selling;
  const minStock = Number(data.minimum_stock) || 0;

  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO gas_stock (gas_name, filled_stock, empty_stock, total_cylinders, purchase_price, selling_price, no_exchange_price, minimum_stock)
         VALUES (@gas_name, @filled_stock, @empty_stock, @total_cylinders, @purchase_price, @selling_price, @no_exchange_price, @minimum_stock)`
      )
      .run({
        gas_name: data.gas_name,
        filled_stock: filled,
        empty_stock: empty,
        total_cylinders: filled + empty,
        purchase_price: purchase,
        selling_price: selling,
        no_exchange_price: noExchange,
        minimum_stock: minStock
      });
    const gasId = info.lastInsertRowid;

    // Buat juga entri produk agar tampil di Kasir & Produk/Stok
    db.prepare(
      `INSERT INTO products (name, category, unit, purchase_price, selling_price, no_exchange_price, stock, minimum_stock, gas_id, created_at, updated_at)
       VALUES (?, 'gas', 'tabung', ?, ?, ?, ?, ?, ?, ?, ?)`
     ).run(data.gas_name, purchase, selling, noExchange, filled, minStock, gasId, nowStr(), nowStr());

    // Catat stok awal sebagai riwayat "Tabung Baru" agar tidak kosong
    if (filled + empty > 0) {
      logGasTransaction(
        db,
        gasId,
        'tabung_baru',
        filled + empty,
        { filled_stock: 0, empty_stock: 0, total_cylinders: 0 },
        { filled_stock: filled, empty_stock: empty, total_cylinders: filled + empty },
        0,
        `Stok awal jenis gas baru (${filled} isi, ${empty} kosong)`
      );
    }

    return gasId;
  });

  const newId = create();
  return getGas(db, newId);
}

function logGasTransaction(db, gasId, type, qty, before, after, amount, description) {
  db.prepare(`
    INSERT INTO gas_transactions
      (gas_id, transaction_type, quantity, filled_before, empty_before, filled_after, empty_after, total_before, total_after, amount, description, date)
    VALUES (@gas_id, @type, @qty, @filled_before, @empty_before, @filled_after, @empty_after, @total_before, @total_after, @amount, @description, @date)
  `).run({
    gas_id: gasId,
    type,
    qty,
    filled_before: before.filled_stock,
    empty_before: before.empty_stock,
    filled_after: after.filled_stock,
    empty_after: after.empty_stock,
    total_before: before.total_cylinders,
    total_after: after.total_cylinders,
    amount: amount || 0,
    description: description || '',
    date: nowStr()
  });
}

function applyGasChange(db, gasId, { filledDelta = 0, emptyDelta = 0 }, type, amount, description) {
  const before = getGas(db, gasId);
  if (!before) throw new Error('Jenis gas tidak ditemukan');

  const newFilled = Math.max(0, before.filled_stock + filledDelta);
  const newEmpty = Math.max(0, before.empty_stock + emptyDelta);
  const newTotal = newFilled + newEmpty;

  db.prepare(`UPDATE gas_stock SET filled_stock = ?, empty_stock = ?, total_cylinders = ? WHERE id = ?`)
    .run(newFilled, newEmpty, newTotal, gasId);

  const after = getGas(db, gasId);
  logGasTransaction(db, gasId, type, Math.max(Math.abs(filledDelta), Math.abs(emptyDelta)), before, after, amount, description);
  syncProductStock(db, gasId);
  return after;
}

/** A. Customer menukar tabung kosong dengan tabung isi */
function tukarCustomer(db, gasId, qty, amount = 0, description = 'Tukar Gas Customer') {
  qty = Number(qty);
  const gas = getGas(db, gasId);
  if (!gas) throw new Error('Jenis gas tidak ditemukan');
  if (gas.filled_stock < qty) throw new Error('Stok gas isi tidak mencukupi');
  return applyGasChange(db, gasId, { filledDelta: -qty, emptyDelta: +qty }, 'tukar_customer', amount, description);
}

/** B1. Kirim tabung kosong ke agen (keluar dari toko, menunggu ditukar) */
function kirimKeAgen(db, gasId, qty, description = 'Kirim Gas Kosong ke Agen') {
  qty = Number(qty);
  const gas = getGas(db, gasId);
  if (!gas) throw new Error('Jenis gas tidak ditemukan');
  if (gas.empty_stock < qty) throw new Error('Stok gas kosong tidak mencukupi');
  // Kosong berkurang DAN keluar dari total (tabung sedang di agen)
  const before = getGas(db, gasId);
  const newEmpty = Math.max(0, before.empty_stock - qty);
  const newTotal = Math.max(0, before.total_cylinders - qty);
  db.prepare(`UPDATE gas_stock SET empty_stock = ?, total_cylinders = ? WHERE id = ?`).run(newEmpty, newTotal, gasId);
  const after = getGas(db, gasId);
  logGasTransaction(db, gasId, 'tukar_agen_kirim', qty, before, after, 0, description);
  syncProductStock(db, gasId);
  return after;
}

/** B2. Terima tabung isi dari agen (masuk ke toko, menambah kembali total) */
function terimaDariAgen(db, gasId, qty, description = 'Terima Gas Isi dari Agen') {
  qty = Number(qty);
  const before = getGas(db, gasId);
  if (!before) throw new Error('Jenis gas tidak ditemukan');
  const newFilled = before.filled_stock + qty;
  const newTotal = before.total_cylinders + qty;
  db.prepare(`UPDATE gas_stock SET filled_stock = ?, total_cylinders = ? WHERE id = ?`).run(newFilled, newTotal, gasId);
  const after = getGas(db, gasId);
  logGasTransaction(db, gasId, 'tukar_agen_terima', qty, before, after, 0, description);
  syncProductStock(db, gasId);
  return after;
}

function exchangeWithAgentPurchase(db, gasId, qty, purchasePrice, note = '', supplier = 'Pertamina/Agen') {
  qty = Number(qty);
  purchasePrice = Number(purchasePrice) || 0;
  const gas = getGas(db, gasId);
  const product = db.prepare('SELECT * FROM products WHERE gas_id = ? AND active = 1').get(gasId);
  if (!gas || !product) throw new Error('Jenis gas tidak ditemukan');
  if (qty <= 0) throw new Error('Jumlah tabung harus lebih dari 0');
  if (purchasePrice <= 0) throw new Error('Biaya per tabung harus lebih dari 0');
  if (gas.empty_stock < qty) throw new Error(`Stok tabung kosong tidak mencukupi (tersedia ${gas.empty_stock})`);

  const exchange = db.transaction(() => {
    const before = getGas(db, gasId);
    kirimKeAgen(db, gasId, qty, note || 'Tukar tabung kosong dengan agen - kirim');
    const after = terimaDariAgen(db, gasId, qty, note || 'Tukar tabung kosong dengan agen - terima');
    const totalPrice = purchasePrice * qty;
    const averagePurchasePrice = weightedPurchasePrice(before.filled_stock, product.purchase_price, qty, purchasePrice);

    db.prepare('UPDATE products SET purchase_price = ? WHERE id = ?').run(averagePurchasePrice, product.id);
    db.prepare('UPDATE gas_stock SET purchase_price = ? WHERE id = ?').run(averagePurchasePrice, gasId);
    db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, unit, purchase_price, supplier, total_price, note, stock_before, stock_after, date)
      VALUES (?, 'masuk', ?, 'tabung', ?, ?, ?, ?, ?, ?, ?)
    `).run(product.id, qty, purchasePrice, supplier, totalPrice, note || 'Tukar tabung kosong dengan agen', before.filled_stock, after.filled_stock, nowStr());
    db.prepare(`
      INSERT INTO expenses (category, description, amount, product_name, quantity, unit, unit_price, supplier, date, created_at)
      VALUES ('Pembelian Gas', ?, ?, ?, ?, 'tabung', ?, ?, ?, ?)
    `).run(`Pembelian ${product.name} | Supplier: ${supplier}${note ? ` | Catatan: ${note}` : ''}`, totalPrice, product.name, qty, purchasePrice, supplier, nowStr(), nowStr());

    return { after, total_price: totalPrice };
  });
  return exchange();
}

/** C. Penjualan gas tanpa tukar tabung kosong -> tabung keluar permanen dari toko */
function jualTanpaTukar(db, gasId, qty, amount = 0, description = 'Penjualan Gas Tanpa Tukar') {
  qty = Number(qty);
  const gas = getGas(db, gasId);
  if (!gas) throw new Error('Jenis gas tidak ditemukan');
  if (gas.filled_stock < qty) throw new Error('Stok gas isi tidak mencukupi');
  const before = getGas(db, gasId);
  const newFilled = Math.max(0, before.filled_stock - qty);
  const newTotal = Math.max(0, before.total_cylinders - qty);
  db.prepare(`UPDATE gas_stock SET filled_stock = ?, total_cylinders = ? WHERE id = ?`).run(newFilled, newTotal, gasId);
  const after = getGas(db, gasId);
  logGasTransaction(db, gasId, 'penjualan_tanpa_tukar', qty, before, after, amount, description);
  syncProductStock(db, gasId);
  return after;
}

/** D. Tambah tabung baru (beli tabung + isi baru, menambah total kepemilikan toko) */
function tambahTabungBaru(db, gasId, filledQty = 0, emptyQty = 0, description = 'Tambah Tabung Baru') {
  filledQty = Number(filledQty) || 0;
  emptyQty = Number(emptyQty) || 0;
  return applyGasChange(db, gasId, { filledDelta: filledQty, emptyDelta: emptyQty }, 'tabung_baru', 0, description);
}

/** E. Penyesuaian stok manual (opname) */
function penyesuaian(db, gasId, filledDelta = 0, emptyDelta = 0, description = 'Penyesuaian Stok Gas') {
  return applyGasChange(db, gasId, { filledDelta: Number(filledDelta) || 0, emptyDelta: Number(emptyDelta) || 0 }, 'penyesuaian', 0, description);
}

/** Dipakai oleh Kasir saat checkout (mode 'tukar' atau 'tanpa_tukar') */
function processSaleFromCart(db, gasId, qty, mode, amount, invoiceNumber) {
  if (mode === 'tanpa_tukar') {
    return jualTanpaTukar(db, gasId, qty, amount, `Penjualan Kasir - ${invoiceNumber}`);
  }
  return tukarCustomer(db, gasId, qty, amount, `Penjualan Kasir - ${invoiceNumber}`);
}

function recordQuickSale(db, gasId, qty, amount, mode, description, cashierName = '', note = '') {
  qty = Number(qty);
  amount = Number(amount) || 0;
  const product = db.prepare('SELECT * FROM products WHERE gas_id = ? AND active = 1').get(gasId);
  if (!product) throw new Error('Produk gas tidak ditemukan');
  if (qty <= 0 || amount <= 0) throw new Error('Jumlah dan nilai transaksi harus lebih dari 0');

  const transaction = db.transaction(() => {
    const invoiceNumber = generateInvoiceNumber(db);
    const gas = mode === 'tanpa_tukar'
      ? jualTanpaTukar(db, gasId, qty, amount, `${description} - ${invoiceNumber}`)
      : tukarCustomer(db, gasId, qty, amount, `${description} - ${invoiceNumber}`);
    const price = round2(amount / qty);
    const transactionInfo = db.prepare(`
      INSERT INTO transactions
        (invoice_number, transaction_date, cashier_name, payment_method, total_amount, discount, final_amount, paid_amount, change_amount, note, status, created_at)
      VALUES (?, ?, ?, 'tunai', ?, 0, ?, ?, 0, ?, 'selesai', ?)
    `).run(invoiceNumber, nowStr(), cashierName || null, amount, amount, amount, note || null, nowStr());
    db.prepare(`
      INSERT INTO transaction_items (transaction_id, product_id, product_name, category, quantity, unit, price, subtotal)
      VALUES (?, ?, ?, 'gas', ?, 'tabung', ?, ?)
    `).run(transactionInfo.lastInsertRowid, product.id, product.name, qty, price, amount);
    return { invoice_number: invoiceNumber, gas, transaction_id: transactionInfo.lastInsertRowid };
  });
  return transaction();
}

function tukarCustomerAsTransaction(db, gasId, qty, amount, cashierName = '', note = '') {
  return recordQuickSale(db, gasId, qty, amount, 'tukar', 'Tukar Gas Customer', cashierName, note);
}

function jualTanpaTukarAsTransaction(db, gasId, qty, amount, cashierName = '', note = '') {
  return recordQuickSale(db, gasId, qty, amount, 'tanpa_tukar', 'Penjualan Gas Tanpa Tukar', cashierName, note);
}

function history(db, gasId, limit = 100) {
  if (gasId) {
    return db.prepare('SELECT * FROM gas_transactions WHERE gas_id = ? ORDER BY date DESC, id DESC LIMIT ?').all(gasId, limit);
  }
  return db
    .prepare(
      `SELECT gt.*, gs.gas_name FROM gas_transactions gt
       JOIN gas_stock gs ON gs.id = gt.gas_id
       ORDER BY gt.date DESC, gt.id DESC LIMIT ?`
    )
    .all(limit);
}

/**
 * Perbarui data jenis gas (nama & harga) sekaligus produk terkait,
 * agar halaman Produk/Kasir dan Manajemen Gas selalu konsisten.
 * Jumlah tabung TIDAK diubah di sini - gunakan aksi di Manajemen Gas.
 */
function updateGasType(db, gasId, data) {
  const existing = getGas(db, gasId);
  if (!existing) throw new Error('Jenis gas tidak ditemukan');

  if (data.gas_name && data.gas_name !== existing.gas_name) {
    const dup = db.prepare('SELECT id FROM gas_stock WHERE gas_name = ? AND id != ?').get(data.gas_name, gasId);
    if (dup) throw new Error('Jenis gas dengan nama tersebut sudah ada');
  }

  const payload = {
    id: gasId,
    gas_name: data.gas_name ?? existing.gas_name,
    purchase_price: data.purchase_price != null ? Number(data.purchase_price) : existing.purchase_price,
    selling_price: data.selling_price != null ? Number(data.selling_price) : existing.selling_price,
    no_exchange_price: data.no_exchange_price != null ? Number(data.no_exchange_price) : (existing.no_exchange_price || existing.selling_price),
    minimum_stock: data.minimum_stock != null ? Number(data.minimum_stock) : existing.minimum_stock
  };

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE gas_stock SET gas_name = @gas_name, purchase_price = @purchase_price,
      selling_price = @selling_price, no_exchange_price = @no_exchange_price, minimum_stock = @minimum_stock WHERE id = @id`
    ).run(payload);

    const prod = db.prepare('SELECT id FROM products WHERE gas_id = ?').get(gasId);
    if (prod) {
      db.prepare(
        `UPDATE products SET name = ?, purchase_price = ?, selling_price = ?, no_exchange_price = ?, minimum_stock = ?, updated_at = ? WHERE id = ?`
      ).run(payload.gas_name, payload.purchase_price, payload.selling_price, payload.no_exchange_price, payload.minimum_stock, nowStr(), prod.id);
    }
  });
  run();

  return getGas(db, gasId);
}

module.exports = {
  listGas,
  getGas,
  weightedPurchasePrice,
  createGasType,
  updateGasType,
  tukarCustomer,
  kirimKeAgen,
  terimaDariAgen,
  exchangeWithAgentPurchase,
  jualTanpaTukar,
  tambahTabungBaru,
  penyesuaian,
  processSaleFromCart,
  tukarCustomerAsTransaction,
  jualTanpaTukarAsTransaction,
  history,
  syncProductStock
};
