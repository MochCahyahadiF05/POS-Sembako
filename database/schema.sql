-- =========================================================
-- SISTEM KASIR & MANAJEMEN USAHA - SQLite Schema
-- Beras / Telur / Gas LPG
-- =========================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,           -- hashed (sha256 + salt)
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'kasir', -- 'admin' | 'kasir'
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------
-- PRODUCTS  (Beras & Telur; Gas juga direpresentasikan di sini
-- sebagai baris "katalog" untuk kasir, namun stok riil gas
-- dikelola lewat tabel gas_stock)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,          -- 'beras' | 'telur' | 'gas'
  unit            TEXT NOT NULL,          -- 'kg' | 'karung' | 'tabung'
  secondary_unit  TEXT,                   -- e.g. beras: 'karung', with secondary_conversion
  secondary_conversion REAL,              -- e.g. 1 karung = 50 kg
  purchase_price  REAL NOT NULL DEFAULT 0,
  selling_price   REAL NOT NULL DEFAULT 0,
  no_exchange_price REAL,
  secondary_price REAL,                   -- selling price for secondary unit (e.g. per karung)
  stock           REAL NOT NULL DEFAULT 0, -- stock kept in base unit (kg for beras/telur)
  minimum_stock   REAL NOT NULL DEFAULT 0,
  gas_id          INTEGER,                -- link to gas_stock.id when category = 'gas'
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (gas_id) REFERENCES gas_stock(id)
);

-- ---------------------------------------------------------
-- TRANSACTIONS (Kasir)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number    TEXT NOT NULL UNIQUE,
  transaction_date  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  cashier_name      TEXT,
  payment_method    TEXT NOT NULL DEFAULT 'tunai', -- tunai | transfer | qris
  total_amount      REAL NOT NULL DEFAULT 0,
  discount          REAL NOT NULL DEFAULT 0,
  final_amount      REAL NOT NULL DEFAULT 0,
  paid_amount       REAL NOT NULL DEFAULT 0,
  change_amount     REAL NOT NULL DEFAULT 0,
  note              TEXT,
  status            TEXT NOT NULL DEFAULT 'selesai', -- selesai | batal
  created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  INTEGER NOT NULL,
  product_id      INTEGER,
  product_name    TEXT NOT NULL,
  category        TEXT NOT NULL,
  quantity        REAL NOT NULL,
  unit            TEXT NOT NULL,
  price           REAL NOT NULL,
  subtotal        REAL NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ---------------------------------------------------------
-- STOCK MOVEMENTS (Barang Masuk / Barang Keluar / Penjualan / Penyesuaian)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  type          TEXT NOT NULL,   -- 'masuk' | 'keluar' | 'penjualan' | 'penyesuaian'
  reason        TEXT,            -- for 'keluar': rusak, hilang, pribadi, retur, lainnya
  quantity      REAL NOT NULL,   -- always positive; sign implied by type
  unit          TEXT,
  purchase_price REAL,
  supplier      TEXT,
  total_price   REAL,
  note          TEXT,
  stock_before  REAL,
  stock_after   REAL,
  date          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ---------------------------------------------------------
-- FINANCE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL,  -- pembelian_beras | pembelian_telur | pembelian_gas | operasional | lainnya
  description   TEXT,
  amount        REAL NOT NULL,
  product_name  TEXT,
  quantity      REAL,
  unit          TEXT,
  unit_price    REAL,
  supplier      TEXT,
  date          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS income_extra (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  description   TEXT,
  amount        REAL NOT NULL,
  date          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------
-- GAS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS gas_stock (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  gas_name        TEXT NOT NULL UNIQUE,   -- e.g. 'Gas LPG 3 KG'
  filled_stock    INTEGER NOT NULL DEFAULT 0,
  empty_stock     INTEGER NOT NULL DEFAULT 0,
  total_cylinders INTEGER NOT NULL DEFAULT 0,
  purchase_price  REAL NOT NULL DEFAULT 0,
  selling_price   REAL NOT NULL DEFAULT 0,
  no_exchange_price REAL,
  minimum_stock   INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS gas_transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  gas_id            INTEGER NOT NULL,
  transaction_type  TEXT NOT NULL, -- tukar_customer | tukar_agen | penjualan_tanpa_tukar | tabung_baru | penyesuaian
  quantity          INTEGER NOT NULL,
  filled_before     INTEGER NOT NULL,
  empty_before      INTEGER NOT NULL,
  filled_after      INTEGER NOT NULL,
  empty_after       INTEGER NOT NULL,
  total_before      INTEGER NOT NULL,
  total_after       INTEGER NOT NULL,
  amount            REAL DEFAULT 0,   -- money involved (sale) if any
  description       TEXT,
  date              TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (gas_id) REFERENCES gas_stock(id)
);

-- ---------------------------------------------------------
-- SETTINGS (key-value, single row app settings)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  store_name    TEXT NOT NULL DEFAULT 'Toko Beras & Kebutuhan Pokok',
  address       TEXT,
  phone         TEXT,
  owner_name    TEXT,
  email         TEXT,
  receipt_note  TEXT DEFAULT 'Terima kasih telah berbelanja',
  printer_mode  TEXT NOT NULL DEFAULT 'windows',
  printer_name  TEXT,
  escpos_host   TEXT,
  escpos_port   INTEGER NOT NULL DEFAULT 9100,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_gas_transactions_gas ON gas_transactions(gas_id);
