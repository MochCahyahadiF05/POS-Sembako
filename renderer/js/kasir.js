'use strict';

(function () {
  const user = initPage('kasir', 'Kasir', 'Buat transaksi baru');
  if (!user) return;

  let products = [];
  let cart = []; // { key, product_id, name, category, unit, price, quantity, gas_mode, maxStock, secondary_conversion }
  let activeCategory = 'semua';
  let searchTerm = '';
  let activeMethod = 'tunai';
  let paymentStatus = 'lunas';
  let customerName = '';

  const productGrid = document.getElementById('product-grid');
  const cartItemsEl = document.getElementById('cart-items');
  const cartCountEl = document.getElementById('cart-count');

  async function loadProducts() {
    products = (await callApi(window.api.products.list({ search: searchTerm, category: activeCategory }))) || [];
    renderProducts();
  }

  function renderProducts() {
    if (!products.length) {
      productGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${icon('package', { size: 30 })}<div class="mt-1">Produk tidak ditemukan</div></div>`;
      return;
    }
    productGrid.innerHTML = products
      .map((p) => {
        const stockClass = p.status === 'habis' ? 'out' : p.status === 'menipis' ? 'low' : '';
        const stockLabel = `${numFmt(p.stock)} ${p.unit}`;
        let priceLine = `${rupiah(p.selling_price)}/${p.unit.toUpperCase()}`;
        let priceLine2 = '';
        let buttons = `<button class="btn btn-primary btn-sm" data-add="${p.id}" data-unit="${p.unit}">+ ${p.unit === 'kg' ? 'KG' : p.unit === 'tabung' ? 'Gas' : p.unit.toUpperCase()}</button>`;
        if (p.category === 'beras' && p.secondary_unit) {
          priceLine2 = `${rupiah(p.secondary_price)}/${p.secondary_unit.toUpperCase()}`;
          buttons = `
            <button class="btn btn-primary btn-sm" data-add="${p.id}" data-unit="kg">+ KG</button>
            <button class="btn btn-secondary btn-sm" data-add="${p.id}" data-unit="${p.secondary_unit}">${p.secondary_unit.charAt(0).toUpperCase() + p.secondary_unit.slice(1)}</button>
          `;
        }
        if (p.category !== 'gas' && p.unit === 'kg') {
          buttons += `<button class="btn btn-secondary btn-sm" data-money="${p.id}">Beli Rp</button>`;
        }

        const disabled = p.status === 'habis' ? 'disabled' : '';

        return `
          <div class="product-card">
            <div class="top">
              <div class="emoji-badge">${emojiHtml(p.category)}</div>
              <div class="stock-pill ${stockClass}">${stockLabel}</div>
            </div>
            <div class="pname">${p.name}</div>
            <div class="pprice">${priceLine}</div>
            ${priceLine2 ? `<div class="pprice2">${priceLine2}</div>` : ''}
            <div class="add-row">${buttons.replace(/<button/g, disabled ? '<button disabled' : '<button')}</div>
          </div>
        `;
      })
      .join('');

    productGrid.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const productId = Number(btn.getAttribute('data-add'));
        const unit = btn.getAttribute('data-unit');
        addToCart(productId, unit);
      });
    });
    productGrid.querySelectorAll('[data-money]').forEach((btn) => {
      btn.addEventListener('click', () => openMoneyModal(Number(btn.getAttribute('data-money'))));
    });
  }

  function emojiHtml(cat) {
    return categoryIcon(cat, { size: 17 });
  }

  function addQuantity(productId, unit, quantity) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const price = unit === product.secondary_unit ? product.secondary_price : product.selling_price;
    const key = `${productId}-${unit}`;
    const existing = cart.find((c) => c.key === key);

    // Hitung stok maksimum tersedia dalam satuan yang dipilih
    let maxInUnit;
    if (unit === product.secondary_unit && product.secondary_conversion) {
      maxInUnit = Math.floor(product.stock / product.secondary_conversion);
    } else {
      maxInUnit = product.stock;
    }

    const currentQty = existing ? existing.quantity : 0;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast('Jumlah harus lebih besar dari nol', 'error');
      return;
    }
    if (currentQty + quantity > maxInUnit + 0.000001) {
      toast(`Stok ${product.name} tidak mencukupi`, 'error');
      return;
    }

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        key,
        product_id: productId,
        name: product.name,
        category: product.category,
        unit,
        price,
        quantity,
        gas_mode: 'tukar',
        maxInUnit,
        secondary_conversion: product.secondary_conversion
      });
    }
    renderCart();
  }

  function addToCart(productId, unit) {
    addQuantity(productId, unit, 1);
  }

  function openMoneyModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product || product.category === 'gas') return;
    const overlay = openModal(`
      <div class="modal-header"><h3>Beli Berdasarkan Uang</h3><button class="modal-close" id="money-close">&times;</button></div>
      <div class="modal-body">
        <div class="text-sm text-muted mb-2">${escapeHtml(product.name)} - ${rupiah(product.selling_price)} / kg</div>
        <div class="form-group"><label>Uang yang dibayarkan</label><input class="input" id="money-amount" type="number" min="1" step="100" placeholder="Contoh: 7500" autofocus /></div>
        <div class="money-quantity-result" id="money-quantity-result">Masukkan nominal untuk menghitung jumlah.</div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" id="money-cancel">Batal</button><button class="btn btn-primary" id="money-add">Tambahkan</button></div>
    `);
    const amountInput = overlay.querySelector('#money-amount');
    const resultEl = overlay.querySelector('#money-quantity-result');
    const updateMoneyPreview = () => {
      const amount = Number(amountInput.value) || 0;
      const quantity = amount / Number(product.selling_price || 0);
      resultEl.textContent = amount > 0 && product.selling_price > 0 ? `Mendapat ${numFmt(quantity, 5)} kg (${rupiah(amount)})` : 'Masukkan nominal untuk menghitung jumlah.';
    };
    amountInput.addEventListener('input', updateMoneyPreview);
    overlay.querySelector('#money-close').addEventListener('click', closeModal);
    overlay.querySelector('#money-cancel').addEventListener('click', closeModal);
    overlay.querySelector('#money-add').addEventListener('click', () => {
      const amount = Number(amountInput.value) || 0;
      const quantity = amount / Number(product.selling_price || 0);
      if (amount <= 0 || !Number.isFinite(quantity)) {
        toast('Masukkan nominal uang yang valid', 'error');
        return;
      }
      addQuantity(product.id, product.unit, quantity);
      closeModal();
    });
    amountInput.focus();
  }

  function changeQty(key, delta) {
    const item = cart.find((c) => c.key === key);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      cart = cart.filter((c) => c.key !== key);
    } else if (newQty > item.maxInUnit) {
      toast('Stok tidak mencukupi', 'error');
      return;
    } else {
      item.quantity = newQty;
    }
    renderCart();
  }

  function removeItem(key) {
    cart = cart.filter((c) => c.key !== key);
    renderCart();
  }

  function renderCart() {
    cartCountEl.textContent = `${cart.length} item`;
    if (!cart.length) {
      cartItemsEl.innerHTML = `<div class="cart-empty"><div class="big-icon">${icon('cart', { size: 30 })}</div><div>Keranjang kosong</div></div>`;
    } else {
      cartItemsEl.innerHTML = cart
        .map((item) => {
          const subtotal = item.price * item.quantity;
          const gasToggle =
            item.category === 'gas'
              ? `<label class="text-xs text-muted flex items-center gap-1 mt-1" style="cursor:pointer;">
                   <input type="checkbox" data-gas-toggle="${item.key}" ${item.gas_mode === 'tanpa_tukar' ? 'checked' : ''} />
                   Tanpa tukar tabung kosong
                 </label>`
              : '';
          return `
            <div class="cart-item">
              <div class="flex-1">
                <div class="name">${item.name}</div>
                <div class="meta">${rupiah(item.price)} / ${item.unit}</div>
                ${gasToggle}
                <div class="qty-control mt-1">
                  <button class="qty-btn" data-dec="${item.key}">&minus;</button>
                  <input class="input cart-qty-input" data-qty="${item.key}" type="number" min="0.001" max="${item.maxInUnit}" step="0.001" value="${item.quantity}" aria-label="Jumlah ${escapeHtml(item.name)}" />
                  <button class="qty-btn" data-inc="${item.key}">+</button>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2">
                <div class="subtotal">${rupiah(subtotal)}</div>
                <button class="remove" data-remove="${item.key}" title="Hapus">${icon('trash', { size: 15 })}</button>
              </div>
            </div>
          `;
        })
        .join('');

      cartItemsEl.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => changeQty(b.getAttribute('data-inc'), 1)));
      cartItemsEl.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => changeQty(b.getAttribute('data-dec'), -1)));
      cartItemsEl.querySelectorAll('[data-qty]').forEach((input) =>
        input.addEventListener('change', () => {
          const item = cart.find((c) => c.key === input.getAttribute('data-qty'));
          const quantity = Number(input.value);
          if (!item || !Number.isFinite(quantity) || quantity <= 0 || quantity > item.maxInUnit + 0.000001) {
            toast('Jumlah tidak valid atau melebihi stok', 'error');
            renderCart();
            return;
          }
          item.quantity = quantity;
          renderCart();
        })
      );
      cartItemsEl.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => removeItem(b.getAttribute('data-remove'))));
      cartItemsEl.querySelectorAll('[data-gas-toggle]').forEach((b) =>
        b.addEventListener('change', () => {
          const item = cart.find((c) => c.key === b.getAttribute('data-gas-toggle'));
          if (item) {
            const product = products.find((p) => p.id === item.product_id);
            item.gas_mode = b.checked ? 'tanpa_tukar' : 'tukar';
            item.price = b.checked ? Number(product.no_exchange_price || product.selling_price) : Number(product.selling_price);
            renderCart();
          }
        })
      );
    }
    updateSummary();
  }

  function updateSummary() {
    const subtotal = cart.reduce((a, c) => a + c.price * c.quantity, 0);
    const discount = Number(document.getElementById('input-discount').value) || 0;
    const total = Math.max(0, subtotal - discount);
    const paidInput = document.getElementById('input-paid');
    const paid = parseAmountInput(paidInput.value);
    const change = paid - total;

    document.getElementById('sum-subtotal').textContent = rupiah(subtotal);
    document.getElementById('sum-total').textContent = rupiah(total);
    document.getElementById('sum-change').textContent = rupiah(Math.max(0, change));
    document.getElementById('sum-change').className = 'font-semibold ' + (change < 0 ? 'text-red' : 'text-green');
  }

  function parseAmountInput(value) {
    return Number(String(value || '').replace(/[^0-9]/g, '')) || 0;
  }

  function formatAmountInput(input) {
    const amount = parseAmountInput(input.value);
    input.value = amount ? amount.toLocaleString('id-ID') : '';
  }

  async function openPaymentStatusModal() {
    const customerNames = (await callApi(window.api.transactions.listCustomerNames(), { silent: true })) || [];
    const overlay = openModal(`
      <div class="modal-header"><h3>Status Pembayaran</h3><button class="modal-close" id="payment-status-close">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Status</label><select class="input" id="payment-status-value"><option value="lunas" ${paymentStatus === 'lunas' ? 'selected' : ''}>Lunas</option><option value="belum_bayar" ${paymentStatus === 'belum_bayar' ? 'selected' : ''}>Belum Bayar</option></select></div>
        <div class="form-group mt-2"><label>Pelanggan</label><select class="input" id="customer-name-select"><option value="__new__">Pelanggan Baru</option>${customerNames.map((name) => `<option value="${escapeHtml(name)}" ${customerName === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></div>
        <div class="form-group mt-2" id="new-customer-group"><label>Nama Pelanggan Baru</label><input class="input" id="customer-name-value" value="${customerNames.includes(customerName) ? '' : escapeHtml(customerName)}" placeholder="Wajib untuk transaksi piutang" /></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" id="payment-status-cancel">Batal</button><button class="btn btn-primary" id="payment-status-save">Simpan</button></div>
    `);
    const customerSelect = overlay.querySelector('#customer-name-select');
    const newCustomerGroup = overlay.querySelector('#new-customer-group');
    const updateCustomerField = () => { newCustomerGroup.style.display = customerSelect.value === '__new__' ? '' : 'none'; };
    customerSelect.addEventListener('change', updateCustomerField);
    updateCustomerField();
    const close = () => closeModal();
    overlay.querySelector('#payment-status-close').addEventListener('click', close);
    overlay.querySelector('#payment-status-cancel').addEventListener('click', close);
    overlay.querySelector('#payment-status-save').addEventListener('click', () => {
      paymentStatus = overlay.querySelector('#payment-status-value').value;
      customerName = customerSelect.value === '__new__' ? overlay.querySelector('#customer-name-value').value.trim() : customerSelect.value;
      if (paymentStatus === 'belum_bayar' && !customerName) {
        toast('Nama pelanggan wajib diisi untuk transaksi piutang', 'error');
        return;
      }
      document.getElementById('btn-payment-status').textContent = paymentStatus === 'belum_bayar' ? 'Belum Bayar' : 'Lunas';
      close();
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildBarcodeHtml(value) {
    const patterns = {
      '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
      '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
      A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
      G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
      M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwwn', R: 'wnnnnnwwn',
      S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
      Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
      '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
    };
    const encoded = `*${String(value || '').toUpperCase()}*`;
    const bars = [];
    for (const character of encoded) {
      const pattern = patterns[character] || patterns['-'];
      pattern.split('').forEach((size, index) => {
        const isBar = index % 2 === 0;
        bars.push(`<i class="barcode-segment ${isBar ? 'barcode-bar' : 'barcode-space'} ${size === 'w' ? 'wide' : ''}"></i>`);
      });
      if (character !== encoded[encoded.length - 1]) bars.push('<i class="barcode-gap"></i>');
    }
    return `<div class="receipt-barcode"><div class="barcode-bars">${bars.join('')}</div><div class="barcode-value">${escapeHtml(value)}</div></div>`;
  }

  function buildQrCodeHtml(value) {
    if (window.ZXingBrowser && window.ZXingBrowser.BrowserQRCodeSvgWriter) {
      const svg = new window.ZXingBrowser.BrowserQRCodeSvgWriter().write(String(value || ''), 90, 90);
      return `<div class="receipt-qrcode">${svg.outerHTML}<div class="barcode-value">${escapeHtml(value)}</div></div>`;
    }
    return buildBarcodeHtml(value);
  }

  function buildReceiptHtml(transaction, store) {
    const receiptQuantity = (quantity) => Number(quantity).toLocaleString('id-ID', { maximumFractionDigits: 5 });
    const items = transaction.items
      .map(
        (item) => `
          <div class="item"><div>${escapeHtml(item.product_name)}<br><span>${receiptQuantity(item.quantity)} ${escapeHtml(item.unit)} x ${rupiah(item.price)}</span></div><strong>${rupiah(item.subtotal)}</strong></div>`
      )
      .join('');
    const paymentLabel = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS' }[transaction.payment_method] || transaction.payment_method;
    return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><style>
      @page { size: 58mm auto; margin: 0; } * { box-sizing: border-box; }
      body { width: 50mm; margin: 0 auto; padding: 4mm 0; color: #111; font: 10px Arial, sans-serif; }
      h1 { font-size: 16px; margin: 0 0 2px; text-align: center; } p { margin: 2px 0; text-align: center; }
      .muted { color: #555; font-size: 10px; } .line { border-top: 1px dashed #555; margin: 7px 0; }
      .item, .row { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; } .item span { color: #555; font-size: 10px; }
      .item strong, .row strong { white-space: nowrap; } .total { font-size: 13px; font-weight: bold; }
      .receipt-barcode { margin: 7px 0 0; text-align: center; } .barcode-bars { display: flex; justify-content: center; align-items: stretch; height: 22px; margin: 0 10px; } .barcode-segment { display: block; flex: 0 0 1px; width: 1px; } .barcode-bar { background: #111; } .barcode-space { background: transparent; } .barcode-segment.wide { flex-basis: 3px; width: 3px; } .barcode-gap { flex: 0 0 1px; width: 1px; } .receipt-qrcode { margin: 7px 0 0; text-align: center; } .receipt-qrcode svg { width: 20mm; height: 20mm; } .barcode-value { font-size: 8px; letter-spacing: 1px; margin-top: 2px; }
      .footer { margin-top: 9px; text-align: center; white-space: pre-line; }
    </style></head><body>
      <h1>${escapeHtml(store.store_name || 'Toko')}</h1><p>${escapeHtml(store.address || '')}</p><p>${escapeHtml(store.phone || '')}</p>
      <div class="line"></div><p class="muted">${escapeHtml(transaction.invoice_number)} | ${escapeHtml(fmtDateTime(transaction.transaction_date))}</p><div class="line"></div>
      ${items}<div class="line"><div class="row"><span>Subtotal</span><span>${rupiah(transaction.total_amount)}</span></div><div class="row"><span>Diskon</span><span>${rupiah(transaction.discount)}</span></div><div class="row total"><span>Total</span><span>${rupiah(transaction.final_amount)}</span></div><div class="row"><span>${escapeHtml(paymentLabel)}</span><span>${rupiah(transaction.paid_amount)}</span></div><div class="row"><span>Kembalian</span><span>${rupiah(transaction.change_amount)}</span></div></div>
      <p class="footer">${escapeHtml(store.receipt_note || 'Terima kasih telah berbelanja')}</p>${buildQrCodeHtml(transaction.invoice_number)}
    </body></html>`;
  }

  function buildReceiptText(transaction, store) {
    const width = 32;
    const esc = '\x1b';
    const line = '-'.repeat(width);
    const center = `${esc}a\x01`;
    const left = `${esc}a\x00`;
    const bold = `${esc}E\x01`;
    const normal = `${esc}E\x00`;
    const wrap = (value) => {
      const words = String(value || '').split(/\s+/);
      const lines = [];
      let current = '';
      words.forEach((word) => {
        if (!word) return;
        if ((current + ' ' + word).trim().length > width && current) {
          lines.push(current);
          current = word;
        } else {
          current = (current + ' ' + word).trim();
        }
      });
      if (current) lines.push(current);
      return lines.length ? lines : [''];
    };
    const row = (label, value) => {
      const amount = String(value);
      const spaces = Math.max(1, width - label.length - amount.length);
      return `${label}${' '.repeat(spaces)}${amount}`;
    };
    const itemRows = transaction.items.flatMap((item) => {
      const nameLines = wrap(item.product_name);
      const detail = `${item.quantity} ${item.unit} x ${rupiah(item.price)}`;
      return [...nameLines, row(detail, rupiah(item.subtotal))];
    });
    const paymentLabel = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS' }[transaction.payment_method] || transaction.payment_method;
    const receiptDate = fmtDateTime(transaction.transaction_date).replace(', ', ' ');
    return [
      center,
      bold,
      ...wrap(store.store_name || 'Toko'),
      normal,
      ...wrap(store.address || ''),
      store.phone || '',
      left,
      line,
      `${transaction.invoice_number || ''} | ${receiptDate}`,
      '',
      line,
      ...itemRows,
      line,
      row('Subtotal', rupiah(transaction.total_amount)),
      row('Diskon', rupiah(transaction.discount)),
      bold,
      row('TOTAL', rupiah(transaction.final_amount)),
      normal,
      row(paymentLabel, rupiah(transaction.paid_amount)),
      row('Kembalian', rupiah(transaction.change_amount)),
      line,
      center,
      ...wrap(store.receipt_note || 'Terima kasih telah berbelanja'),
      left,
      ''
    ].join('\n');
  }

  async function showReceipt(transaction) {
    const store = (await callApi(window.api.settings.get(), { silent: true })) || {};
    const receiptHtml = buildReceiptHtml(transaction, store);
    const bodyMatch = receiptHtml.match(/<body>([\s\S]*)<\/body>/i);
    const overlay = openModal(`
      <div class="modal-header"><h3>Struk Transaksi</h3><button class="modal-close" id="receipt-close">&times;</button></div>
      <div class="modal-body"><div class="receipt-preview">${bodyMatch ? bodyMatch[1] : ''}</div><p class="text-xs text-muted mt-3">Printer dan mode cetak diatur dari halaman Pengaturan.</p></div>
      <div class="modal-footer"><button class="btn btn-secondary" id="receipt-close-footer">Tutup</button><button class="btn btn-primary" id="receipt-print"><span>Cetak Struk</span></button></div>
    `, { size: 'modal-lg' });
    overlay.querySelector('#receipt-close').addEventListener('click', closeModal);
    overlay.querySelector('#receipt-close-footer').addEventListener('click', closeModal);
    overlay.querySelector('#receipt-print').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      const result = await callApi(window.api.receipt.print(receiptHtml, {
        mode: store.printer_mode || 'windows',
        printerName: store.printer_name || '',
        host: store.escpos_host || '',
        port: store.escpos_port || 9100,
        text: buildReceiptText(transaction, store),
        qrValue: transaction.invoice_number
      }));
      button.disabled = false;
      if (result) toast('Struk dikirim ke printer');
    });
  }

  document.getElementById('input-discount').addEventListener('input', updateSummary);
  document.getElementById('input-paid').addEventListener('input', (event) => {
    formatAmountInput(event.currentTarget);
    updateSummary();
  });
  document.getElementById('quick-paid-amounts').addEventListener('click', (event) => {
    const button = event.target.closest('[data-paid-amount]');
    if (!button) return;
    const total = Math.max(0, cart.reduce((sum, item) => sum + item.price * item.quantity, 0) - (Number(document.getElementById('input-discount').value) || 0));
    const paidInput = document.getElementById('input-paid');
    const preset = button.getAttribute('data-paid-amount');
    const amount = preset === 'exact' ? total : parseAmountInput(paidInput.value) + Number(preset);
    paidInput.value = amount ? amount.toLocaleString('id-ID') : '';
    updateSummary();
  });
  document.getElementById('btn-payment-status').addEventListener('click', openPaymentStatusModal);

  document.getElementById('search-product').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    loadProducts();
  });

  document.getElementById('category-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    activeCategory = btn.getAttribute('data-cat');
    document.querySelectorAll('#category-filter .btn-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadProducts();
  });

  document.getElementById('payment-methods').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-method]');
    if (!btn) return;
    activeMethod = btn.getAttribute('data-method');
    document.querySelectorAll('#payment-methods .btn').forEach((b) => b.classList.remove('btn-primary'));
    document.querySelectorAll('#payment-methods .btn').forEach((b) => b.classList.add('btn-secondary'));
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
  });

  document.getElementById('btn-checkout').addEventListener('click', async () => {
    if (!cart.length) {
      toast('Keranjang masih kosong', 'error');
      return;
    }
    const discount = Number(document.getElementById('input-discount').value) || 0;
    const subtotal = cart.reduce((a, c) => a + c.price * c.quantity, 0);
    const total = Math.max(0, subtotal - discount);
    let paid = parseAmountInput(document.getElementById('input-paid').value);
    if (paymentStatus === 'lunas' && activeMethod !== 'tunai' && paid <= 0) paid = total;
    if (paymentStatus === 'belum_bayar' && paid >= total && total > 0) {
      toast('Untuk status belum bayar, uang dibayar harus kurang dari total', 'error');
      return;
    }
    if (paymentStatus === 'lunas' && paid < total) {
      toast('Uang dibayar kurang dari total belanja', 'error');
      return;
    }

    const payload = {
      items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit: c.unit, price: c.price, gas_mode: c.gas_mode })),
      payment_method: activeMethod,
      discount,
      paid_amount: paid,
      customer_name: customerName,
      cashier_name: user.full_name
    };

    const btn = document.getElementById('btn-checkout');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    const result = await callApi(window.api.transactions.checkout(payload));
    btn.disabled = false;
    btn.textContent = 'Selesaikan Transaksi';

    if (result) {
      toast(`Transaksi ${result.invoice_number} berhasil disimpan`);
      showReceipt(result);
      cart = [];
      document.getElementById('input-discount').value = 0;
      document.getElementById('input-paid').value = '';
      paymentStatus = 'lunas';
      customerName = '';
      document.getElementById('btn-payment-status').textContent = 'Lunas';
      renderCart();
      loadProducts();
    }
  });

  loadProducts();
})();
