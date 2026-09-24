'use strict';

/**
 * database/db.js
 * ---------------------------------------------------------
 * Membuka koneksi SQLite lokal (better-sqlite3, synchronous),
 * menjalankan schema.sql jika tabel belum ada, dan melakukan
 * seeding data awal (settings + user admin default) hanya
 * sekali (idempotent).
 *
 * Database HANYA diakses dari Main Process. Renderer harus
 * selalu lewat IPC (lihat main.js & preload.js).
 * ---------------------------------------------------------
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

let db = null;

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function initDatabase(userDataPath) {
  const dbDir = path.join(userDataPath, 'database');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, 'app.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  runMigrations();
  seedDefaults();

  return db;
}

/**
 * Migrasi ringan untuk database yang sudah terlanjur dibuat versi sebelumnya.
 * Menambahkan kolom yang belum ada tanpa menghapus data pengguna.
 */
function runMigrations() {
  const addColumnIfMissing = (table, column, definition) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  addColumnIfMissing('gas_stock', 'active', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('gas_stock', 'no_exchange_price', 'REAL');
  addColumnIfMissing('products', 'no_exchange_price', 'REAL');
  addColumnIfMissing('expenses', 'product_name', 'TEXT');
  addColumnIfMissing('expenses', 'quantity', 'REAL');
  addColumnIfMissing('expenses', 'unit', 'TEXT');
  addColumnIfMissing('expenses', 'unit_price', 'REAL');
  addColumnIfMissing('expenses', 'supplier', 'TEXT');
  addColumnIfMissing('settings', 'printer_mode', "TEXT NOT NULL DEFAULT 'windows'");
  addColumnIfMissing('settings', 'printer_name', 'TEXT');
  addColumnIfMissing('settings', 'escpos_host', 'TEXT');
  addColumnIfMissing('settings', 'escpos_port', 'INTEGER NOT NULL DEFAULT 9100');
  addColumnIfMissing('transactions', 'note', 'TEXT');

  // Selaraskan status aktif gas dengan produknya.
  // Dijalankan setiap start (idempoten & murah) agar database yang dibuat
  // versi sebelumnya ikut diperbaiki: jenis gas yang produknya sudah dihapus
  // tidak boleh lagi muncul di halaman Manajemen Gas.
  db.exec(`
    UPDATE gas_stock SET active = 0
    WHERE active = 1 AND id IN (
      SELECT g.id FROM gas_stock g
      JOIN products p ON p.gas_id = g.id
      WHERE p.active = 0
    )
  `);
}

function seedDefaults() {
  // Settings row (id = 1)
  const settingsRow = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!settingsRow) {
    db.prepare(
      `INSERT INTO settings (id, store_name, address, phone, owner_name, email, receipt_note)
       VALUES (1, ?, ?, ?, ?, ?, ?)`
    ).run(
      'Toko Beras & Kebutuhan Pokok',
      'Jl. Pasar Baru No. 12, Jakarta',
      '0812-3456-7890',
      'Pemilik Toko',
      'toko@berasjaya.id',
      'Terima kasih telah berbelanja'
    );
  }

  // Default admin user
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const salt = makeSalt();
    const hash = hashPassword('admin123', salt);
    db.prepare(
      `INSERT INTO users (username, password, full_name, role, active)
       VALUES (?, ?, ?, 'admin', 1)`
    ).run('admin', `${salt}:${hash}`, 'Administrator');

    const salt2 = makeSalt();
    const hash2 = hashPassword('kasir123', salt2);
    db.prepare(
      `INSERT INTO users (username, password, full_name, role, active)
       VALUES (?, ?, ?, 'kasir', 1)`
    ).run('kasir', `${salt2}:${hash2}`, 'Rina Kasir');
  }

  // Seed gas types + sample products only on very first run (no products yet)
  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (productCount === 0) {
    const insertGas = db.prepare(
      `INSERT INTO gas_stock (gas_name, filled_stock, empty_stock, total_cylinders, purchase_price, selling_price, minimum_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const g1 = insertGas.run('Gas LPG 3 KG', 50, 30, 80, 18000, 22000, 10);
    const g2 = insertGas.run('Gas LPG 12 KG', 15, 8, 23, 140000, 165000, 5);
    const g3 = insertGas.run('Gas LPG 5.5 KG', 20, 10, 30, 75000, 88000, 5);

    const insertProduct = db.prepare(
      `INSERT INTO products
        (name, category, unit, secondary_unit, secondary_conversion, purchase_price, selling_price, secondary_price, stock, minimum_stock, gas_id)
       VALUES (@name, @category, @unit, @secondary_unit, @secondary_conversion, @purchase_price, @selling_price, @secondary_price, @stock, @minimum_stock, @gas_id)`
    );

    const seedProducts = [
      { name: 'Beras Premium', category: 'beras', unit: 'kg', secondary_unit: 'karung', secondary_conversion: 50, purchase_price: 13000, selling_price: 15000, secondary_price: 750000, stock: 500, minimum_stock: 50, gas_id: null },
      { name: 'Beras Medium', category: 'beras', unit: 'kg', secondary_unit: 'karung', secondary_conversion: 50, purchase_price: 11000, selling_price: 13000, secondary_price: 630000, stock: 780, minimum_stock: 50, gas_id: null },
      { name: 'Beras Setra Ramos', category: 'beras', unit: 'kg', secondary_unit: 'karung', secondary_conversion: 50, purchase_price: 14000, selling_price: 16500, secondary_price: 820000, stock: 45, minimum_stock: 50, gas_id: null },
      { name: 'Beras IR64', category: 'beras', unit: 'kg', secondary_unit: 'karung', secondary_conversion: 50, purchase_price: 10000, selling_price: 12000, secondary_price: 590000, stock: 12, minimum_stock: 25, gas_id: null },
      { name: 'Telur Ayam', category: 'telur', unit: 'kg', secondary_unit: null, secondary_conversion: null, purchase_price: 27000, selling_price: 30000, secondary_price: null, stock: 85, minimum_stock: 15, gas_id: null },
      { name: 'Telur Bebek', category: 'telur', unit: 'kg', secondary_unit: null, secondary_conversion: null, purchase_price: 32000, selling_price: 36000, secondary_price: null, stock: 30, minimum_stock: 10, gas_id: null },
      { name: 'Gas LPG 3 KG', category: 'gas', unit: 'tabung', secondary_unit: null, secondary_conversion: null, purchase_price: 18000, selling_price: 22000, secondary_price: null, stock: 50, minimum_stock: 10, gas_id: g1.lastInsertRowid },
      { name: 'Gas LPG 12 KG', category: 'gas', unit: 'tabung', secondary_unit: null, secondary_conversion: null, purchase_price: 140000, selling_price: 165000, secondary_price: null, stock: 15, minimum_stock: 5, gas_id: g2.lastInsertRowid },
      { name: 'Gas LPG 5.5 KG', category: 'gas', unit: 'tabung', secondary_unit: null, secondary_conversion: null, purchase_price: 75000, selling_price: 88000, secondary_price: null, stock: 20, minimum_stock: 5, gas_id: g3.lastInsertRowid }
    ];
    for (const p of seedProducts) insertProduct.run(p);
  }
}

function getDb() {
  if (!db) throw new Error('Database belum diinisialisasi. Panggil initDatabase() dulu.');
  return db;
}

module.exports = { initDatabase, getDb, hashPassword, makeSalt };
