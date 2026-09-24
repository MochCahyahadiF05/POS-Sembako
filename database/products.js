'use strict';

const { nowStr } = require('./helpers');

function statusOf(product) {
  if (product.stock <= 0) return 'habis';
  if (product.stock <= product.minimum_stock) return 'menipis';
  return 'aman';
}

function listProducts(db, { search = '', category = 'semua' } = {}) {
  let sql = `SELECT * FROM products WHERE active = 1`;
  const params = [];
  if (category && category !== 'semua') {
    sql += ` AND category = ?`;
    params.push(category);
  }
  if (search) {
    sql += ` AND name LIKE ?`;
    params.push(`%${search}%`);
  }
  sql += ` ORDER BY category, name`;
  const rows = db.prepare(sql).all(...params);
  return rows.map((p) => ({ ...p, status: statusOf(p) }));
}

function getProduct(db, id) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return p ? { ...p, status: statusOf(p) } : null;
}

function createProduct(db, data) {
  const stmt = db.prepare(`
    INSERT INTO products
      (name, category, unit, secondary_unit, secondary_conversion, purchase_price, selling_price, secondary_price, stock, minimum_stock, active, created_at, updated_at)
    VALUES
      (@name, @category, @unit, @secondary_unit, @secondary_conversion, @purchase_price, @selling_price, @secondary_price, @stock, @minimum_stock, 1, @now, @now)
  `);
  const now = nowStr();
  const info = stmt.run({
    name: data.name,
    category: data.category,
    unit: data.unit || 'kg',
    secondary_unit: data.secondary_unit || null,
    secondary_conversion: data.secondary_conversion || null,
    purchase_price: Number(data.purchase_price) || 0,
    selling_price: Number(data.selling_price) || 0,
    secondary_price: data.secondary_price ? Number(data.secondary_price) : null,
    stock: Number(data.stock) || 0,
    minimum_stock: Number(data.minimum_stock) || 0,
    now
  });
  return getProduct(db, info.lastInsertRowid);
}

function updateProduct(db, id, data) {
  const existing = getProduct(db, id);
  if (!existing) throw new Error('Produk tidak ditemukan');
  const stmt = db.prepare(`
    UPDATE products SET
      name = @name,
      category = @category,
      unit = @unit,
      secondary_unit = @secondary_unit,
      secondary_conversion = @secondary_conversion,
      purchase_price = @purchase_price,
      selling_price = @selling_price,
      secondary_price = @secondary_price,
      minimum_stock = @minimum_stock,
      updated_at = @now
    WHERE id = @id
  `);
  stmt.run({
    id,
    name: data.name ?? existing.name,
    category: data.category ?? existing.category,
    unit: data.unit ?? existing.unit,
    secondary_unit: data.secondary_unit ?? existing.secondary_unit,
    secondary_conversion: data.secondary_conversion ?? existing.secondary_conversion,
    purchase_price: data.purchase_price != null ? Number(data.purchase_price) : existing.purchase_price,
    selling_price: data.selling_price != null ? Number(data.selling_price) : existing.selling_price,
    secondary_price: data.secondary_price != null ? Number(data.secondary_price) : existing.secondary_price,
    minimum_stock: data.minimum_stock != null ? Number(data.minimum_stock) : existing.minimum_stock,
    now: nowStr()
  });
  return getProduct(db, id);
}

function deleteProduct(db, id) {
  const product = db.prepare('SELECT id, gas_id FROM products WHERE id = ?').get(id);
  if (!product) throw new Error('Produk tidak ditemukan');

  const run = db.transaction(() => {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
    // Produk gas terhubung ke gas_stock -> nonaktifkan juga agar hilang
    // dari halaman Manajemen Gas (data & riwayat tetap tersimpan).
    if (product.gas_id) {
      db.prepare('UPDATE gas_stock SET active = 0 WHERE id = ?').run(product.gas_id);
    }
  });
  run();

  return { success: true };
}

/** Mengaktifkan kembali produk (dan gas terkait) */
function restoreProduct(db, id) {
  const product = db.prepare('SELECT id, gas_id FROM products WHERE id = ?').get(id);
  if (!product) throw new Error('Produk tidak ditemukan');
  const run = db.transaction(() => {
    db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(id);
    if (product.gas_id) db.prepare('UPDATE gas_stock SET active = 1 WHERE id = ?').run(product.gas_id);
  });
  run();
  return { success: true };
}

/** Update stok produk secara langsung (dipakai modul lain: kasir, stok masuk/keluar) */
function adjustProductStock(db, productId, deltaQty) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!p) throw new Error('Produk tidak ditemukan');
  const newStock = Math.max(0, Number(p.stock) + Number(deltaQty));
  db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(newStock, nowStr(), productId);
  return newStock;
}

function setProductStock(db, productId, newStock) {
  db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(Math.max(0, newStock), nowStr(), productId);
}

module.exports = {
  statusOf,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  adjustProductStock,
  setProductStock
};
