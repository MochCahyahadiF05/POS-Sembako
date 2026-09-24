# Sistem Kasir & Manajemen Usaha

Aplikasi desktop **offline** untuk usaha penjualan Beras, Telur, dan Tabung Gas LPG.
Dibangun dengan **Electron + HTML/CSS/JS (Tailwind-style custom CSS) + SQLite (better-sqlite3)**.
Tidak membutuhkan internet, server, maupun database cloud — semua data tersimpan
di komputer Anda sendiri.

---

## 1. Persyaratan

- [Node.js](https://nodejs.org) versi 18 LTS atau lebih baru (sudah termasuk npm).
- Windows / macOS / Linux desktop.
- Koneksi internet **hanya diperlukan sekali** saat `npm install` (mengunduh Electron
  dan dependency dari npm registry). Setelah itu aplikasi berjalan 100% offline.

## 2. Instalasi

Buka terminal / Command Prompt di folder project ini, lalu jalankan:

```bash
npm install
```

Perintah ini akan:
1. Mengunduh Electron, better-sqlite3, chart.js, exceljs, pdfkit, dll.
2. Menjalankan `electron-rebuild` secara otomatis (lewat script `postinstall`)
   agar modul native `better-sqlite3` dikompilasi ulang agar kompatibel dengan
   versi Node.js yang dipakai Electron.

> Jika `postinstall` gagal karena tidak ada compiler C++ di komputer Anda:
> - **Windows**: install "Desktop development with C++" dari Visual Studio
>   Build Tools, atau jalankan `npm install --global windows-build-tools` (Node lama).
> - **macOS**: jalankan `xcode-select --install`.
> - **Linux**: install `build-essential` dan `python3` (`sudo apt install build-essential python3`).

## 3. Menjalankan Aplikasi

```bash
npm start
```

Jendela aplikasi akan terbuka dengan halaman **Login**.

### Akun Demo (dibuat otomatis saat pertama kali dijalankan)

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |
| kasir    | kasir123  | Kasir |

Silakan ganti password ini lewat halaman **Pengaturan → Pengguna & Akses**
setelah login pertama kali (fitur ubah password bisa dikembangkan lebih lanjut
lewat `window.api.auth.changePassword`).

## 4. Lokasi Database

Database SQLite (`app.db`) disimpan secara otomatis di folder data aplikasi
milik pengguna (bukan di folder project), sehingga aman dari proses build/reinstall:

- **Windows**: `%APPDATA%/kasir-usaha-desktop/database/app.db`
- **macOS**: `~/Library/Application Support/kasir-usaha-desktop/database/app.db`
- **Linux**: `~/.config/kasir-usaha-desktop/database/app.db`

Anda bisa membuka lokasi file ini langsung lewat tombol
**Pengaturan → Buka Lokasi File**.

## 5. Build Installer (opsional)

Untuk membuat file installer (.exe / .dmg / .AppImage) agar bisa dibagikan
ke komputer lain tanpa perlu install Node.js:

```bash
npm run dist
```

Hasilnya akan muncul di folder `dist/`.

## 6. Struktur Project

```
kasir-app/
├── main.js                 # Electron main process: window + semua IPC handler
├── preload.js               # contextBridge - jembatan aman renderer <-> main
├── package.json
├── database/
│   ├── schema.sql            # struktur seluruh tabel SQLite
│   ├── db.js                 # inisialisasi DB + seed data awal
│   ├── auth.js                # login, manajemen user
│   ├── products.js            # CRUD produk (Beras/Telur) + status stok
│   ├── stock.js                # barang masuk & barang keluar
│   ├── transactions.js          # logika kasir/checkout (transaksional)
│   ├── gas.js                    # LOGIKA UTAMA stok Gas (isi/kosong/tukar/agen)
│   ├── finance.js                 # pengeluaran, pendapatan lain, ringkasan keuangan
│   ├── dashboard.js                # data ringkasan & grafik dashboard
│   ├── reports.js                   # data laporan (penjualan/stok/keuangan/gas)
│   ├── export.js                     # export laporan ke Excel (.xlsx) & PDF
│   ├── settings.js                    # info toko
│   ├── backup.js                       # backup & restore database
│   └── helpers.js                       # util tanggal, invoice number, dll
├── renderer/
│   ├── css/app.css            # semua styling (design system custom)
│   ├── js/common.js            # sidebar, header, toast, modal, formatting
│   ├── js/*.js                  # logic tiap halaman
│   └── pages/*.html              # tiap modul (dashboard, kasir, produk, dst.)
└── assets/
```

## 7. Modul Aplikasi

1. **Dashboard** — ringkasan keuangan, transaksi, stok, dan grafik.
2. **Kasir** — transaksi cepat, keranjang, pembayaran (Tunai/Transfer/QRIS), stok otomatis berkurang.
3. **Produk & Stok** — CRUD Beras (per KG & Karung) dan Telur (per KG), status stok otomatis.
4. **Barang Masuk** — catat penerimaan dari supplier, stok otomatis bertambah.
5. **Barang Keluar** — catat barang rusak/hilang/retur/dsb, stok otomatis berkurang.
6. **Manajemen Gas** — modul terpenting: stok Gas Isi & Gas Kosong terpisah, dengan
   5 jenis transaksi (Tukar Customer, Tukar dengan Agen, Jual Tanpa Tukar, Tabung
   Baru, Penyesuaian), lengkap dengan riwayat.
7. **Keuangan** — pendapatan (otomatis dari kasir) & pengeluaran manual, laba bersih.
8. **Laporan** — 6 jenis laporan dengan filter periode, cetak, export PDF & Excel.
9. **Pengaturan** — info toko, manajemen pengguna, backup & restore database.

## 8. Struk & Printer

Setelah transaksi berhasil, aplikasi otomatis menampilkan preview struk. Klik **Cetak Struk** untuk membuka dialog printer Windows. Format struk sudah disiapkan untuk printer thermal 80 mm, dan tetap dapat dicetak ke printer biasa melalui dialog tersebut.

### Menyambungkan printer

1. Sambungkan printer thermal melalui USB, Bluetooth, atau jaringan sesuai buku panduan printer.
2. Di Windows buka **Settings > Bluetooth & devices > Printers & scanners**, pilih **Add device**, lalu pastikan printer berstatus siap/online.
3. Untuk printer USB, pasang driver resmi dari merek printer bila Windows belum mengenalinya. Cetak **Print test page** dari Windows untuk memastikan koneksi dan ukuran kertas benar.
4. Untuk printer thermal ESC/POS USB, buka **Pengaturan > Pengaturan Printer**, pilih mode **ESC/POS langsung melalui USB**, lalu pilih printer yang sudah terdaftar di Windows. Mode ini mengirim data ESC/POS mentah melalui Windows spooler.
5. Jalankan aplikasi, selesaikan transaksi, lalu klik **Cetak Struk**.
6. Jika hasil terpotong atau terlalu kecil, buka **Printing preferences** printer, pilih ukuran kertas 80 mm (atau ukuran roll yang sesuai), matikan header/footer browser bila tersedia, dan pastikan skala 100%.

Jika memakai printer Bluetooth, lakukan pairing terlebih dahulu di Windows. Jika memakai printer jaringan, tambahkan printer menggunakan alamat IP-nya melalui **Add device manually**. Aplikasi tidak membutuhkan kabel atau driver khusus karena menggunakan daftar printer yang terdaftar di Windows.

### Pembelian pecahan dan berdasarkan uang

- Untuk beras atau telur, klik **Beli Rp** pada kartu produk, masukkan nominal, lalu aplikasi menghitung jumlah kilogram berdasarkan harga jual per kg.
- Untuk jumlah seperti `1/4 kg`, masukkan `0.25` pada kolom jumlah di keranjang. Untuk `1/2 kg`, masukkan `0.5`. Jumlah desimal lain juga dapat digunakan selama stok mencukupi.
- Gas tetap menggunakan jumlah bilangan tabung dan tidak dapat dibeli berdasarkan pecahan uang.

## 9. Keamanan Arsitektur

- `contextIsolation: true`, `nodeIntegration: false` — renderer **tidak** memiliki
  akses langsung ke Node.js / filesystem / database.
- Semua akses database hanya lewat `ipcMain.handle` di `main.js`, dipanggil dari
  renderer lewat `window.api.*` yang diekspos oleh `preload.js` via `contextBridge`.
- Password pengguna di-hash dengan `crypto.scrypt` + salt acak (tidak disimpan plain text).
- Setiap operasi kasir/checkout dan perubahan stok gas dibungkus dalam
  SQLite transaction (`db.transaction`) agar tidak ada data korup jika terjadi error
  di tengah proses.

## 10. Catatan Versi

### v1.1
- **Riwayat Pendapatan** ditambahkan di halaman Keuangan, menggabungkan penjualan
  dari kasir dan pendapatan lainnya dalam satu tabel (lengkap dengan no. invoice,
  keterangan produk, metode bayar, dan total).
- **Perbaikan bug**: menghapus produk Gas di halaman Produk & Stok kini ikut
  menghilangkan jenis gas tersebut dari halaman Manajemen Gas dan dari
  perhitungan Dashboard. Sebelumnya gas masih tertinggal karena disimpan di
  tabel terpisah (`gas_stock`). Riwayat transaksi gas tetap tersimpan.
  Jika jenis gas dengan nama sama ditambahkan lagi, data lamanya diaktifkan kembali.
- **Sidebar** kini penuh setinggi layar, blok pengguna menempel di dasar, dan
  menu aktif diberi penanda chevron.
- **Semua emoji diganti dengan ikon SVG** bergaya garis. Ikon disematkan langsung
  di dalam kode (`renderer/js/common.js`), jadi aplikasi tetap 100% offline tanpa
  dependency tambahan. Gunakan `icon('namaIkon')` di JS atau atribut
  `data-icon="namaIkon"` di HTML.
- **Migrasi database otomatis**: database lama tetap dipakai tanpa perlu dihapus.

### v1.2
- **Perbaikan lanjutan**: jenis gas yang produknya sudah dihapus pada versi lama
  (sebelum v1.1) kini ikut hilang dari halaman Manajemen Gas. Aplikasi
  menyelaraskan status ini otomatis setiap kali dijalankan, jadi database yang
  sudah terlanjur tidak sinkron akan diperbaiki sendiri.
- **Menambah jenis Gas baru lewat halaman Produk & Stok**: pilih kategori
  "Gas LPG" pada form Tambah Produk, lalu isi jumlah Tabung Isi dan Tabung
  Kosong. Sistem otomatis membuat entri di Manajemen Gas, di daftar produk
  Kasir, serta mencatat stok awal ke riwayat gas.
- Mengedit produk gas (nama, harga beli/jual, stok minimum) kini menyinkronkan
  tabel `gas_stock` dan `products` sekaligus. Jumlah tabung tetap hanya bisa
  diubah lewat aksi di halaman Manajemen Gas agar riwayat selalu tercatat.
