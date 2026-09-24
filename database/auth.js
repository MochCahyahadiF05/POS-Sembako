'use strict';

const { hashPassword, makeSalt } = require('./db');
const { nowStr } = require('./helpers');

function login(db, username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user) return { success: false, message: 'Username tidak ditemukan' };
  const [salt, hash] = user.password.split(':');
  const computed = hashPassword(password, salt);
  if (computed !== hash) return { success: false, message: 'Password salah' };
  const { password: _pw, ...safeUser } = user;
  return { success: true, user: safeUser };
}

function listUsers(db) {
  return db.prepare('SELECT id, username, full_name, role, active, created_at FROM users ORDER BY id').all();
}

function createUser(db, data) {
  const salt = makeSalt();
  const hash = hashPassword(data.password, salt);
  const info = db
    .prepare(`INSERT INTO users (username, password, full_name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`)
    .run(data.username, `${salt}:${hash}`, data.full_name, data.role || 'kasir', nowStr());
  return db.prepare('SELECT id, username, full_name, role, active FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function setUserActive(db, id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  return { success: true };
}

function changePassword(db, id, newPassword) {
  const salt = makeSalt();
  const hash = hashPassword(newPassword, salt);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(`${salt}:${hash}`, id);
  return { success: true };
}

module.exports = { login, listUsers, createUser, setUserActive, changePassword };
