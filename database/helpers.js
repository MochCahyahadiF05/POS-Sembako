'use strict';

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Menghasilkan rentang tanggal [from, to] (inclusive, format 'YYYY-MM-DD')
 * berdasarkan preset: 'today' | 'week' | 'month' | 'year' | 'custom'
 */
function resolveRange(preset, customFrom, customTo) {
  const now = new Date();
  const to = customTo || todayStr();
  let from = customFrom;

  if (preset === 'today') {
    from = todayStr();
  } else if (preset === 'week') {
    const d = new Date(now);
    const day = d.getDay() === 0 ? 7 : d.getDay(); // Monday = 1
    d.setDate(d.getDate() - (day - 1));
    from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } else if (preset === 'month') {
    from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  } else if (preset === 'year') {
    from = `${now.getFullYear()}-01-01`;
  } else if (preset === 'custom') {
    from = customFrom || todayStr();
  } else {
    from = customFrom || todayStr();
  }
  return { from, to: customTo || todayStr() };
}

function generateInvoiceNumber(db) {
  const d = new Date();
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM transactions WHERE invoice_number LIKE ?`
    )
    .get(`INV-${datePart}-%`);
  const seq = pad((row.c || 0) + 1, 4);
  return `INV-${datePart}-${seq}`;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = { pad, todayStr, nowStr, resolveRange, generateInvoiceNumber, round2 };
