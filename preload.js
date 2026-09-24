'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Semua pemanggilan mengembalikan { ok: true, data } atau { ok: false, error }.
 * unwrap() dipakai di sisi renderer supaya kode halaman tetap ringkas dan
 * error selalu ditangani secara konsisten (lihat renderer/js/common.js).
 */
function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (u, p) => invoke('auth:login', u, p),
    listUsers: () => invoke('auth:listUsers'),
    createUser: (data) => invoke('auth:createUser', data),
    setUserActive: (id, active) => invoke('auth:setUserActive', id, active),
    changePassword: (id, pw) => invoke('auth:changePassword', id, pw)
  },
  products: {
    list: (filter) => invoke('products:list', filter),
    get: (id) => invoke('products:get', id),
    create: (data) => invoke('products:create', data),
    update: (id, data) => invoke('products:update', id, data),
    delete: (id) => invoke('products:delete', id)
  },
  transactions: {
    checkout: (payload) => invoke('transactions:checkout', payload),
    list: (filter) => invoke('transactions:list', filter),
    get: (id) => invoke('transactions:get', id),
    void: (id) => invoke('transactions:void', id)
  },
  receipt: {
    listPrinters: () => invoke('receipt:listPrinters'),
    print: (html, options) => invoke('receipt:print', html, options)
  },
  stock: {
    createIn: (data) => invoke('stock:in:create', data),
    listIn: (filter) => invoke('stock:in:list', filter),
    updateIn: (id, data) => invoke('stock:in:update', id, data),
    deleteIn: (id) => invoke('stock:in:delete', id),
    createOut: (data) => invoke('stock:out:create', data),
    listOut: (filter) => invoke('stock:out:list', filter)
    ,updateOut: (id, data) => invoke('stock:out:update', id, data),
    deleteOut: (id) => invoke('stock:out:delete', id)
  },
  gas: {
    list: () => invoke('gas:list'),
    get: (id) => invoke('gas:get', id),
    create: (data) => invoke('gas:create', data),
    update: (gasId, data) => invoke('gas:update', gasId, data),
    tukarCustomer: (id, qty, amount, note) => invoke('gas:tukarCustomer', id, qty, amount, note),
    tukarCustomerTransaction: (id, qty, amount, cashierName, note) => invoke('gas:tukarCustomerTransaction', id, qty, amount, cashierName, note),
    kirimKeAgen: (id, qty, note) => invoke('gas:kirimKeAgen', id, qty, note),
    terimaDariAgen: (id, qty, note) => invoke('gas:terimaDariAgen', id, qty, note),
    exchangeWithAgentPurchase: (id, qty, purchasePrice, note, supplier) => invoke('gas:exchangeWithAgentPurchase', id, qty, purchasePrice, note, supplier),
    jualTanpaTukar: (id, qty, amount, note) => invoke('gas:jualTanpaTukar', id, qty, amount, note),
    jualTanpaTukarTransaction: (id, qty, amount, cashierName, note) => invoke('gas:jualTanpaTukarTransaction', id, qty, amount, cashierName, note),
    tambahTabungBaru: (id, filled, empty, note) => invoke('gas:tambahTabungBaru', id, filled, empty, note),
    penyesuaian: (id, filledDelta, emptyDelta, note) => invoke('gas:penyesuaian', id, filledDelta, emptyDelta, note),
    history: (id, limit) => invoke('gas:history', id, limit)
  },
  finance: {
    listExpenses: (filter) => invoke('finance:listExpenses', filter),
    createExpense: (data) => invoke('finance:createExpense', data),
    deleteExpense: (id) => invoke('finance:deleteExpense', id),
    listIncomeExtra: (filter) => invoke('finance:listIncomeExtra', filter),
    createIncomeExtra: (data) => invoke('finance:createIncomeExtra', data),
    deleteIncomeExtra: (id) => invoke('finance:deleteIncomeExtra', id),
    listIncomes: (filter) => invoke('finance:listIncomes', filter),
    summary: (filter) => invoke('finance:summary', filter)
  },
  dashboard: {
    summary: () => invoke('dashboard:summary'),
    dailyChart: (days) => invoke('dashboard:dailyChart', days),
    monthlyChart: () => invoke('dashboard:monthlyChart'),
    productChart: () => invoke('dashboard:productChart')
  },
  reports: {
    sales: (filter) => invoke('reports:sales', filter),
    stock: () => invoke('reports:stock'),
    finance: (filter) => invoke('reports:finance', filter),
    gas: (filter) => invoke('reports:gas', filter),
    stockIn: (filter) => invoke('reports:stockIn', filter),
    stockOut: (filter) => invoke('reports:stockOut', filter),
    resolveRange: (preset, from, to) => invoke('reports:resolveRange', preset, from, to),
    export: (payload) => invoke('reports:export', payload)
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (data) => invoke('settings:update', data)
  },
  backup: {
    create: () => invoke('backup:create'),
    restore: () => invoke('backup:restore'),
    openFolder: () => invoke('backup:openFolder')
  },
  app: {
    getPaths: () => invoke('app:getPaths')
  }
});
