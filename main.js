'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { execFile } = require('child_process');

const { initDatabase, getDb } = require('./database/db');
const products = require('./database/products');
const stock = require('./database/stock');
const transactions = require('./database/transactions');
const gas = require('./database/gas');
const finance = require('./database/finance');
const dashboard = require('./database/dashboard');
const reports = require('./database/reports');
const settingsModule = require('./database/settings');
const auth = require('./database/auth');
const backup = require('./database/backup');
const { exportToExcel, exportToPDF } = require('./database/export');
const { resolveRange } = require('./database/helpers');

let mainWindow = null;
let dbPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#eef1f6',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'login.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  initDatabase(userDataPath);
  dbPath = path.join(userDataPath, 'database', 'app.db');

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// -----------------------------------------------------------
// Helper: bungkus handler agar error tertangkap rapi & konsisten
// -----------------------------------------------------------
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const db = getDb();
      const result = await fn(db, ...args);
      return { ok: true, data: result };
    } catch (err) {
      console.error(`[IPC:${channel}]`, err);
      return { ok: false, error: err.message || String(err) };
    }
  });
}

function printRawToWindowsPrinter(printerName, text) {
  if (process.platform !== 'win32') {
    throw new Error('Cetak ESC/POS USB melalui Windows hanya tersedia di Windows');
  }
  if (!printerName) throw new Error('Printer Windows belum dipilih');

  const payload = Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    Buffer.from(text, 'utf8'),
    Buffer.from('\n\n\n\x1d\x56\x00', 'binary')
  ]).toString('base64');
  const printer = Buffer.from(printerName, 'utf8').toString('base64');
  const script = `
    Add-Type @'
    using System;
    using System.Runtime.InteropServices;
    public class RawPrinter {
      [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
      public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
      [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
      [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
      public static extern bool StartDocPrinter(IntPtr handle, int level, IntPtr docInfo);
      [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);
      [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);
      [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);
      [DllImport("winspool.drv", SetLastError=true)]
      public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
      [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
      public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
      public static void Send(string name, byte[] data) {
        IntPtr handle;
        if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw new Exception("Printer tidak dapat dibuka");
        try {
          var doc = new DOCINFO { pDocName = "Kasir ESC/POS", pDataType = "RAW" };
          IntPtr docPtr = Marshal.AllocHGlobal(Marshal.SizeOf(doc));
          Marshal.StructureToPtr(doc, docPtr, false);
          if (!StartDocPrinter(handle, 1, docPtr)) throw new Exception("Gagal memulai dokumen printer");
          try { StartPagePrinter(handle); int written; if (!WritePrinter(handle, data, data.Length, out written) || written != data.Length) throw new Exception("Data ESC/POS gagal dikirim"); EndPagePrinter(handle); }
          finally { EndDocPrinter(handle); Marshal.FreeHGlobal(docPtr); }
        } finally { ClosePrinter(handle); }
      }
    }
'@
    [RawPrinter]::Send([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${printer}')), [Convert]::FromBase64String('${payload}'))
  `;

  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve();
    });
  });
}

function isLikelyThermalPrinter(printerName) {
  return /pos\s*58|pos58b|thermal|kasir/i.test(String(printerName || ''));
}

function registerIpcHandlers() {
  // ---------- AUTH ----------
  handle('auth:login', (db, username, password) => auth.login(db, username, password));
  handle('auth:listUsers', (db) => auth.listUsers(db));
  handle('auth:createUser', (db, data) => auth.createUser(db, data));
  handle('auth:setUserActive', (db, id, active) => auth.setUserActive(db, id, active));
  handle('auth:changePassword', (db, id, pw) => auth.changePassword(db, id, pw));

  // ---------- PRODUCTS ----------
  handle('products:list', (db, filter) => products.listProducts(db, filter));
  handle('products:get', (db, id) => products.getProduct(db, id));
  handle('products:create', (db, data) => products.createProduct(db, data));
  handle('products:update', (db, id, data) => products.updateProduct(db, id, data));
  handle('products:delete', (db, id) => products.deleteProduct(db, id));

  // ---------- KASIR / TRANSACTIONS ----------
  handle('transactions:checkout', (db, payload) => transactions.checkout(db, payload));
  handle('transactions:list', (db, filter) => transactions.listTransactions(db, filter));
  handle('transactions:get', (db, id) => transactions.getTransaction(db, id));
  handle('transactions:void', (db, id) => transactions.voidTransaction(db, id));

  ipcMain.handle('receipt:listPrinters', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return {
        ok: true,
        data: printers
          .map((printer) => ({ name: printer.name, displayName: printer.displayName || printer.name, status: printer.status }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
      };
    } catch (err) {
      console.error('[IPC:receipt:listPrinters]', err);
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('receipt:print', async (event, receiptHtml, options = {}) => {
    if (typeof receiptHtml !== 'string' || !receiptHtml.trim()) throw new Error('Data struk tidak valid');

    let printerName = options.printerName || '';
    if (!printerName && options.mode === 'windows') {
      const printers = await mainWindow.webContents.getPrintersAsync();
      const thermalPrinter = printers.find((printer) => isLikelyThermalPrinter(printer.name) || isLikelyThermalPrinter(printer.displayName));
      if (thermalPrinter) printerName = thermalPrinter.name;
    }

    if (options.mode === 'escpos') {
      if (!options.host) throw new Error('Alamat IP printer ESC/POS belum diatur');
      if (!options.text) throw new Error('Data teks struk ESC/POS tidak valid');
      const port = Number(options.port) || 9100;
      const payload = Buffer.concat([
        Buffer.from([0x1b, 0x40]),
        Buffer.from(options.text, 'utf8'),
        Buffer.from('\n\n\n\x1d\x56\x00', 'binary')
      ]);
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: options.host, port });
        socket.setTimeout(5000);
        socket.once('connect', () => socket.end(payload, resolve));
        socket.once('timeout', () => socket.destroy(new Error('Koneksi ke printer ESC/POS timeout')));
        socket.once('error', reject);
      });
      return { ok: true, data: { success: true } };
    }

    const useRawUsb = options.mode === 'escpos-usb' || (options.mode === 'windows' && isLikelyThermalPrinter(printerName));
    if (useRawUsb) {
      if (!printerName) throw new Error('Printer USB belum dipilih');
      if (!options.text) throw new Error('Data teks struk ESC/POS tidak valid');
      await printRawToWindowsPrinter(printerName, options.text);
      return { ok: true, data: { success: true } };
    }

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });

    try {
      await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(receiptHtml)}`);
      return await new Promise((resolve, reject) => {
        const printOptions = { silent: Boolean(options.printerName), printBackground: true };
        if (printerName) printOptions.deviceName = printerName;
        printWindow.webContents.print(printOptions, (success, reason) => {
          if (!success) reject(new Error(reason || 'Pencetakan dibatalkan'));
          else resolve({ ok: true, data: { success: true } });
        });
      });
    } finally {
      if (!printWindow.isDestroyed()) printWindow.close();
    }
  });

  // ---------- STOCK IN / OUT ----------
  handle('stock:in:create', (db, data) => stock.createStockIn(db, data));
  handle('stock:in:list', (db, filter) => stock.listStockIn(db, filter));
  handle('stock:in:update', (db, id, data) => stock.updateStockIn(db, id, data));
  handle('stock:in:delete', (db, id) => stock.deleteStockIn(db, id));
  handle('stock:out:create', (db, data) => stock.createStockOut(db, data));
  handle('stock:out:list', (db, filter) => stock.listStockOut(db, filter));
  handle('stock:out:update', (db, id, data) => stock.updateStockOut(db, id, data));
  handle('stock:out:delete', (db, id) => stock.deleteStockOut(db, id));

  // ---------- GAS ----------
  handle('gas:list', (db) => gas.listGas(db));
  handle('gas:get', (db, id) => gas.getGas(db, id));
  handle('gas:create', (db, data) => gas.createGasType(db, data));
  handle('gas:update', (db, gasId, data) => gas.updateGasType(db, gasId, data));
  handle('gas:tukarCustomer', (db, id, qty, amount, note) => gas.tukarCustomer(db, id, qty, amount, note));
  handle('gas:tukarCustomerTransaction', (db, id, qty, amount, cashierName, note) => gas.tukarCustomerAsTransaction(db, id, qty, amount, cashierName, note));
  handle('gas:kirimKeAgen', (db, id, qty, note) => gas.kirimKeAgen(db, id, qty, note));
  handle('gas:terimaDariAgen', (db, id, qty, note) => gas.terimaDariAgen(db, id, qty, note));
  handle('gas:exchangeWithAgentPurchase', (db, id, qty, purchasePrice, note, supplier) => gas.exchangeWithAgentPurchase(db, id, qty, purchasePrice, note, supplier));
  handle('gas:jualTanpaTukar', (db, id, qty, amount, note) => gas.jualTanpaTukar(db, id, qty, amount, note));
  handle('gas:jualTanpaTukarTransaction', (db, id, qty, amount, cashierName, note) => gas.jualTanpaTukarAsTransaction(db, id, qty, amount, cashierName, note));
  handle('gas:tambahTabungBaru', (db, id, filled, empty, note) => gas.tambahTabungBaru(db, id, filled, empty, note));
  handle('gas:penyesuaian', (db, id, filledDelta, emptyDelta, note) => gas.penyesuaian(db, id, filledDelta, emptyDelta, note));
  handle('gas:history', (db, id, limit) => gas.history(db, id, limit));

  // ---------- FINANCE ----------
  handle('finance:listExpenses', (db, filter) => finance.listExpenses(db, filter));
  handle('finance:createExpense', (db, data) => finance.createExpense(db, data));
  handle('finance:deleteExpense', (db, id) => finance.deleteExpense(db, id));
  handle('finance:listIncomeExtra', (db, filter) => finance.listIncomeExtra(db, filter));
  handle('finance:createIncomeExtra', (db, data) => finance.createIncomeExtra(db, data));
  handle('finance:deleteIncomeExtra', (db, id) => finance.deleteIncomeExtra(db, id));
  handle('finance:listIncomes', (db, filter) => finance.listIncomes(db, filter));
  handle('finance:summary', (db, filter) => finance.financeSummary(db, filter));

  // ---------- DASHBOARD ----------
  handle('dashboard:summary', (db) => dashboard.getSummary(db));
  handle('dashboard:dailyChart', (db, days) => dashboard.dailyIncomeChart(db, days));
  handle('dashboard:monthlyChart', (db) => dashboard.monthlyIncomeChart(db));
  handle('dashboard:productChart', (db) => dashboard.productSalesChart(db));

  // ---------- REPORTS ----------
  handle('reports:sales', (db, filter) => reports.salesReport(db, filter));
  handle('reports:stock', (db) => reports.stockReport(db));
  handle('reports:finance', (db, filter) => reports.financeReport(db, filter));
  handle('reports:gas', (db, filter) => reports.gasReport(db, filter));
  handle('reports:stockIn', (db, filter) => reports.stockInReport(db, filter));
  handle('reports:stockOut', (db, filter) => reports.stockOutReport(db, filter));
  handle('reports:resolveRange', (db, preset, from, to) => resolveRange(preset, from, to));

  // Export generik: payload = { format: 'excel'|'pdf', fileName, title, subtitle, columns, rows }
  handle('reports:export', async (db, payload) => {
    const ext = payload.format === 'pdf' ? 'pdf' : 'xlsx';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Simpan Laporan',
      defaultPath: `${payload.fileName || 'laporan'}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    if (payload.format === 'pdf') {
      await exportToPDF(result.filePath, payload.title, payload.columns, payload.rows, payload.subtitle);
    } else {
      await exportToExcel(result.filePath, payload.title || 'Laporan', payload.columns, payload.rows, payload.title);
    }
    shell.showItemInFolder(result.filePath);
    return { success: true, path: result.filePath };
  });

  // ---------- SETTINGS ----------
  handle('settings:get', (db) => settingsModule.getSettings(db));
  handle('settings:update', (db, data) => settingsModule.updateSettings(db, data));

  // ---------- BACKUP / RESTORE ----------
  handle('backup:create', async (db) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Simpan Backup Database',
      defaultPath: `backup-kasir-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return backup.backupTo(db, result.filePath);
  });

  handle('backup:restore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Pilih File Backup untuk Restore',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    backup.prepareRestore(dbPath, result.filePaths[0]);
    // Restart aplikasi agar koneksi database dibuka ulang dari file baru
    app.relaunch();
    app.exit(0);
    return { success: true };
  });

  handle('backup:openFolder', async () => {
    shell.showItemInFolder(dbPath);
    return { success: true };
  });

  // ---------- APP INFO ----------
  ipcMain.handle('app:getPaths', () => ({ dbPath, userData: app.getPath('userData') }));
}
