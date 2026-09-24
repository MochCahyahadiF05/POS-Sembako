'use strict';

const { nowStr } = require('./helpers');
const { adjustProductStock, getProduct } = require('./products');
const gas = require('./gas');

/**
 * Konversi jumlah dari satuan yang dipilih ke satuan dasar (base unit)
 * produk. Untuk Beras: base unit = kg, jika unit = 'karung' dikalikan
 * secondary_conversion.
 */
function toBaseQty(product, quantity, unit) {
  quantity = Number(quantity);
  if (unit && product.secondary_unit && unit === product.secondary_unit && product.secondary_conversion) {
    return quantity * Number(product.secondary_conversion);
  }
  return quantity;
}

function recordPurchaseExpense(db, product, amount, supplier, note, details = {}) {
  const categoryByProduct = {
    beras: 'Pembelian Beras',
    telur: 'Pembelian Telur',
    gas: 'Pembelian Gas'
  };
  const category = categoryByProduct[product.category] || 'Pengeluaran Lainnya';
  const supplierText = supplier ? `Supplier: ${supplier}` : '';
  const noteText = note ? `Catatan: ${note}` : '';
  const description = [`Pembelian ${product.name}`, supplierText, noteText].filter(Boolean).join(' | ');
  db.prepare(`
    INSERT INTO expenses (category, description, amount, product_name, quantity, unit, unit_price, supplier, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(category, description, Number(amount) || 0, product.name, details.quantity ?? null, details.unit || null, details.unitPrice ?? null, supplier || null, nowStr(), nowStr());
}

function createStockIn(db, data) {
  const product = getProduct(db, data.product_id);
  if (!product) throw new Error('Produk tidak ditemukan');

  if (product.category === 'gas') {
    const quantity = Number(data.quantity) || 0;
    const purchasePrice = Number(data.purchase_price) || product.purchase_price;
    const totalPrice = purchasePrice * quantity;
    const before = gas.getGas(db, product.gas_id);
    if (!before) throw new Error('Data stok gas tidak ditemukan');

    const saveGasExchange = db.transaction(() => {
      // Barang masuk gas adalah tukar tabung kosong dengan agen, bukan tabung baru.
      gas.kirimKeAgen(db, product.gas_id, quantity, data.note || 'Tukar Gas dengan Agen - Kirim Kosong');
      const after = gas.terimaDariAgen(db, product.gas_id, quantity, data.note || 'Tukar Gas dengan Agen - Terima Isi');
      const averagePurchasePrice = gas.weightedPurchasePrice(
        before.filled_stock,
        product.purchase_price,
        quantity,
        purchasePrice
      );

      db.prepare('UPDATE products SET purchase_price = ? WHERE id = ?').run(averagePurchasePrice, product.id);
      db.prepare('UPDATE gas_stock SET purchase_price = ? WHERE id = ?').run(averagePurchasePrice, product.gas_id);
      db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, unit, purchase_price, supplier, total_price, note, stock_before, stock_after, date)
        VALUES (?, 'masuk', ?, 'tabung', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.product_id,
        quantity,
        purchasePrice,
        data.supplier || 'Pertamina/Agen',
        totalPrice,
        data.note || 'Tukar tabung kosong dengan agen',
        before.filled_stock,
        after.filled_stock,
        nowStr()
      );
      recordPurchaseExpense(db, product, totalPrice, data.supplier || 'Pertamina/Agen', data.note || 'Tukar tabung kosong dengan agen', {
        quantity,
        unit: 'tabung',
        unitPrice: purchasePrice
      });
      return after;
    });

    const after = saveGasExchange();
    return { success: true, stock_after: after.filled_stock };
  }

  const baseQty = toBaseQty(product, data.quantity, data.unit);
  const stockBefore = product.stock;
  const stockAfter = adjustProductStock(db, data.product_id, baseQty);

  if (data.purchase_price) {
    db.prepare('UPDATE products SET purchase_price = ? WHERE id = ?').run(Number(data.purchase_price), data.product_id);
  }

  const totalPrice = (Number(data.purchase_price) || product.purchase_price) * Number(data.quantity);
  db.prepare(`
    INSERT INTO stock_movements (product_id, type, quantity, unit, purchase_price, supplier, total_price, note, stock_before, stock_after, date)
    VALUES (?, 'masuk', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.product_id,
    Number(data.quantity),
    data.unit || product.unit,
    Number(data.purchase_price) || product.purchase_price,
    data.supplier || null,
    totalPrice,
    data.note || null,
    stockBefore,
    stockAfter,
    nowStr()
  );
  recordPurchaseExpense(db, product, totalPrice, data.supplier, data.note, {
    quantity: Number(data.quantity),
    unit: data.unit || product.unit,
    unitPrice: Number(data.purchase_price) || product.purchase_price
  });

  return { success: true, stock_after: stockAfter };
}

function createStockOut(db, data) {
  const product = getProduct(db, data.product_id);
  if (!product) throw new Error('Produk tidak ditemukan');
  if (product.category === 'gas') {
    throw new Error('Gunakan halaman Manajemen Gas untuk mencatat perubahan stok gas');
  }

  const baseQty = toBaseQty(product, data.quantity, data.unit);
  const stockBefore = product.stock;
  if (stockBefore < baseQty) throw new Error('Stok tidak mencukupi untuk barang keluar ini');
  const stockAfter = adjustProductStock(db, data.product_id, -baseQty);

  db.prepare(`
    INSERT INTO stock_movements (product_id, type, reason, quantity, unit, note, stock_before, stock_after, date)
    VALUES (?, 'keluar', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.product_id,
    data.reason || 'lainnya',
    Number(data.quantity),
    data.unit || product.unit,
    data.note || null,
    stockBefore,
    stockAfter,
    nowStr()
  );

  return { success: true, stock_after: stockAfter };
}

function listStockIn(db, { from, to } = {}) {
  let sql = `
    SELECT sm.*, p.name AS product_name, p.category
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    WHERE sm.type = 'masuk'
  `;
  const params = [];
  if (from) {
    sql += ` AND date(sm.date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    sql += ` AND date(sm.date) <= date(?)`;
    params.push(to);
  }
  sql += ` ORDER BY sm.date DESC, sm.id DESC`;
  return db.prepare(sql).all(...params);
}

function listStockOut(db, { from, to } = {}) {
  let sql = `
    SELECT sm.*, p.name AS product_name, p.category
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    WHERE sm.type = 'keluar'
  `;
  const params = [];
  if (from) {
    sql += ` AND date(sm.date) >= date(?)`;
    params.push(from);
  }
  if (to) {
    sql += ` AND date(sm.date) <= date(?)`;
    params.push(to);
  }
  sql += ` ORDER BY sm.date DESC, sm.id DESC`;
  return db.prepare(sql).all(...params);
}

function getMovement(db, id, type) {
  return db.prepare(`
    SELECT sm.*, p.name AS product_name, p.category, p.stock AS current_stock
    FROM stock_movements sm JOIN products p ON p.id = sm.product_id
    WHERE sm.id = ? AND sm.type = ?
  `).get(id, type);
}

function removeMovement(db, id, type) {
  const movement = getMovement(db, id, type);
  if (!movement) throw new Error('Catatan stok tidak ditemukan');
  if (movement.category === 'gas') throw new Error('Riwayat stok gas dikelola dari halaman Manajemen Gas');
  const product = getProduct(db, movement.product_id);
  const baseQty = toBaseQty(product, movement.quantity, movement.unit);
  const delta = type === 'masuk' ? -baseQty : baseQty;
  if (type === 'masuk' && product.stock < baseQty) throw new Error('Stok saat ini tidak cukup untuk membatalkan barang masuk');
  adjustProductStock(db, movement.product_id, delta);
  db.prepare('DELETE FROM stock_movements WHERE id = ?').run(id);
  if (type === 'masuk') {
    db.prepare(`DELETE FROM expenses WHERE id = (SELECT id FROM expenses WHERE product_name = ? AND amount = ? AND date(date) = date(?) ORDER BY id DESC LIMIT 1)`)
      .run(movement.product_name, movement.total_price, movement.date);
  }
  return { success: true };
}

function updateMovement(db, id, type, data) {
  const old = getMovement(db, id, type);
  if (!old) throw new Error('Catatan stok tidak ditemukan');
  if (old.category === 'gas' || (data.product_id && Number(data.product_id) !== old.product_id)) {
    throw new Error('Edit stok gas atau perubahan produk tidak didukung');
  }
  const product = getProduct(db, old.product_id);
  const oldBase = toBaseQty(product, old.quantity, old.unit);
  const newQty = Number(data.quantity);
  if (newQty <= 0) throw new Error('Jumlah harus lebih dari 0');
  const newBase = toBaseQty(product, newQty, data.unit || product.unit);
  const stockDelta = type === 'masuk' ? newBase - oldBase : oldBase - newBase;
  if (stockDelta < 0 && product.stock < Math.abs(stockDelta)) throw new Error('Stok tidak mencukupi untuk perubahan ini');
  const stockBefore = product.stock;
  const stockAfter = adjustProductStock(db, product.id, stockDelta);
  const price = type === 'masuk' ? Number(data.purchase_price) || product.purchase_price : null;
  const total = type === 'masuk' ? price * newQty : null;
  db.prepare(`UPDATE stock_movements SET quantity = ?, unit = ?, ${type === 'masuk' ? 'purchase_price = ?, supplier = ?, total_price = ?, note = ?' : 'reason = ?, note = ?'}, stock_before = ?, stock_after = ?, date = ? WHERE id = ?`)
    .run(...(type === 'masuk'
      ? [newQty, data.unit || product.unit, price, data.supplier || null, total, data.note || null, stockBefore, stockAfter, data.date || old.date, id]
      : [newQty, data.unit || product.unit, data.reason || 'lainnya', data.note || null, stockBefore, stockAfter, data.date || old.date, id]));
  if (type === 'masuk') {
    db.prepare(`UPDATE expenses SET amount = ?, quantity = ?, unit = ?, unit_price = ?, supplier = ?, date = ?, description = ? WHERE product_name = ? AND amount = ? AND date(date) = date(?)`)
      .run(total, newQty, data.unit || product.unit, price, data.supplier || null, data.date || old.date, `Pembelian ${product.name}${data.supplier ? ` | Supplier: ${data.supplier}` : ''}${data.note ? ` | Catatan: ${data.note}` : ''}`, product.name, old.total_price, old.date);
  }
  return { success: true };
}

function updateStockIn(db, id, data) { return db.transaction(() => updateMovement(db, id, 'masuk', data))(); }
function deleteStockIn(db, id) { return db.transaction(() => removeMovement(db, id, 'masuk'))(); }
function updateStockOut(db, id, data) { return db.transaction(() => updateMovement(db, id, 'keluar', data))(); }
function deleteStockOut(db, id) { return db.transaction(() => removeMovement(db, id, 'keluar'))(); }

module.exports = { createStockIn, createStockOut, listStockIn, listStockOut, updateStockIn, deleteStockIn, updateStockOut, deleteStockOut, toBaseQty };
