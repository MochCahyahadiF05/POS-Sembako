'use strict';

const fs = require('fs');
const path = require('path');

/** Backup database ke lokasi yang dipilih user (menggunakan VACUUM INTO agar konsisten meski WAL aktif) */
function backupTo(db, destPath) {
  if (!destPath.endsWith('.db')) destPath += '.db';
  // Hapus file lama jika ada (VACUUM INTO gagal jika file sudah ada)
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);
  return { success: true, path: destPath };
}

/**
 * Restore memerlukan aplikasi ditutup & database ditutup dulu.
 * Fungsi ini mengembalikan path tujuan; main.js yang akan menutup
 * koneksi db, mengganti file, lalu merestart aplikasi.
 */
function prepareRestore(currentDbPath, sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new Error('File backup tidak ditemukan');
  const backupOfCurrent = currentDbPath + '.before-restore.bak';
  fs.copyFileSync(currentDbPath, backupOfCurrent);
  fs.copyFileSync(sourcePath, currentDbPath);
  // Bersihkan WAL/SHM lama agar tidak konflik dengan file baru
  for (const ext of ['-wal', '-shm']) {
    const p = currentDbPath + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return { success: true };
}

module.exports = { backupTo, prepareRestore };
