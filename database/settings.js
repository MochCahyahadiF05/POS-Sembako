'use strict';

const { nowStr } = require('./helpers');

function getSettings(db) {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function updateSettings(db, data) {
  const existing = getSettings(db);
  db.prepare(`
    UPDATE settings SET
      store_name = @store_name,
      address = @address,
      phone = @phone,
      owner_name = @owner_name,
      email = @email,
      receipt_note = @receipt_note,
      printer_mode = @printer_mode,
      printer_name = @printer_name,
      escpos_host = @escpos_host,
      escpos_port = @escpos_port,
      updated_at = @now
    WHERE id = 1
  `).run({
    store_name: data.store_name ?? existing.store_name,
    address: data.address ?? existing.address,
    phone: data.phone ?? existing.phone,
    owner_name: data.owner_name ?? existing.owner_name,
    email: data.email ?? existing.email,
    receipt_note: data.receipt_note ?? existing.receipt_note,
    printer_mode: data.printer_mode ?? existing.printer_mode ?? 'windows',
    printer_name: data.printer_name ?? existing.printer_name ?? null,
    escpos_host: data.escpos_host ?? existing.escpos_host ?? null,
    escpos_port: Number(data.escpos_port ?? existing.escpos_port ?? 9100),
    now: nowStr()
  });
  return getSettings(db);
}

module.exports = { getSettings, updateSettings };
