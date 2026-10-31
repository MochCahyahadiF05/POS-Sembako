# Dokumentasi Sistem Kasir & Manajemen Usaha

## 1. Gambaran Umum

Sistem ini adalah aplikasi desktop offline untuk mengelola:

- Penjualan beras, telur, dan gas LPG.
- Stok barang dan pergerakan stok.
- Pembayaran tunai, transfer, dan QRIS.
- Penjualan belum lunas atau piutang pelanggan.
- Pembayaran piutang secara cicilan atau sebagian.
- Laporan penjualan, stok, keuangan, dan gas.
- Struk dengan QR invoice.
- Backup dan restore database.

Data disimpan secara lokal di komputer. Aplikasi tidak membutuhkan server atau database cloud.

## 2. Persyaratan Sistem

- Windows, macOS, atau Linux desktop.
- Node.js 18 LTS atau lebih baru.
- npm.
- Kamera laptop jika ingin menggunakan fitur scan QR.
- Printer Windows atau printer thermal ESC/POS jika ingin mencetak struk.

Koneksi internet hanya diperlukan saat memasang dependency dengan `npm install`. Setelah dependency terpasang, aplikasi dapat digunakan offline.

## 3. Instalasi dan Menjalankan Aplikasi

Buka terminal di folder project, lalu jalankan:

```bash
npm install
npm start
```

Untuk membuat installer:

```bash
npm run dist
```

Hasil build berada di folder `dist/`.

### Akun awal

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Admin |
| `kasir` | `kasir123` | Kasir |

Ganti password setelah login pertama kali melalui halaman Pengaturan jika fitur pengelolaan password tersedia pada versi aplikasi yang digunakan.

## 4. Menu Aplikasi

### Dashboard

Menampilkan ringkasan transaksi, pendapatan, pengeluaran, laba, stok, dan grafik usaha.

### Kasir

Digunakan untuk membuat transaksi baru:

1. Cari produk atau pilih kategori.
2. Klik tombol produk untuk memasukkannya ke keranjang.
3. Atur jumlah barang dengan tombol `+`, `-`, atau input jumlah.
4. Untuk beras atau telur, gunakan **Beli Rp** jika pelanggan membeli berdasarkan nominal uang.
5. Atur diskon jika diperlukan.
6. Pilih metode pembayaran: Tunai, Transfer, atau QRIS.
7. Klik status pembayaran untuk membuka modal status.
8. Klik **Selesaikan Transaksi**.

Stok barang berkurang otomatis setelah transaksi berhasil disimpan.

### Produk & Stok

Digunakan untuk:

- Menambah produk.
- Mengubah nama, kategori, harga, dan stok minimum.
- Melihat status stok aman, menipis, atau habis.
- Mengelola produk beras, telur, dan gas.

### Barang Masuk

Catat barang yang diterima dari supplier. Stok akan bertambah otomatis.

### Barang Keluar

Catat barang rusak, hilang, retur, pemakaian pribadi, atau alasan lainnya. Stok akan berkurang otomatis.

### Manajemen Gas

Mengelola stok gas isi dan gas kosong, termasuk:

- Tukar tabung dengan pelanggan.
- Tukar atau kirim ke agen.
- Jual tanpa tukar.
- Menambah tabung baru.
- Penyesuaian stok.
- Riwayat transaksi gas.

### Keuangan

Menampilkan pendapatan dari transaksi kasir, pendapatan tambahan, pengeluaran, dan laba bersih.

### Piutang

Menu Piutang digunakan untuk mengelola transaksi yang belum lunas.

Fitur yang tersedia:

- Melihat nama pelanggan dan nomor invoice.
- Melihat total transaksi, jumlah terbayar, dan sisa piutang.
- Mencatat pembayaran sebagian.
- Mencatat pembayaran cicilan berkali-kali.
- Memilih metode pembayaran setiap cicilan.
- Melihat riwayat pembayaran.
- Status otomatis berubah menjadi selesai saat seluruh saldo lunas.
- Melihat total pembayaran yang diterima hari ini.

### Laporan

Laporan menyediakan:

- Laporan penjualan.
- Laporan stok.
- Laporan keuangan.
- Laporan gas.
- Laporan barang masuk.
- Laporan barang keluar.

Laporan dapat difilter berdasarkan hari, minggu, bulan, tahun, atau rentang tanggal khusus. Laporan juga dapat dicetak atau diekspor ke PDF dan Excel.

### Pengaturan

Digunakan untuk mengatur:

- Nama dan informasi toko.
- Pengguna dan akses.
- Printer.
- Backup database.
- Restore database.
- Lokasi file data aplikasi.

## 5. Transaksi Lunas dan Piutang

### Membuat transaksi lunas

1. Pastikan status pembayaran pada kasir adalah **Lunas**.
2. Untuk Tunai, isi nominal uang dibayar.
3. Untuk Transfer atau QRIS, nominal dapat diisi otomatis sebagai total transaksi.
4. Selesaikan transaksi.

### Membuat transaksi piutang

1. Buka modal **Status Pembayaran**.
2. Pilih **Belum Bayar**.
3. Pada pilihan pelanggan:
   - Pilih nama pelanggan yang sudah pernah digunakan; atau
   - Pilih **Pelanggan Baru**, lalu isi nama pelanggan.
4. Isi nominal yang sudah dibayar jika pelanggan membayar sebagian saat transaksi dibuat.
5. Simpan status dan selesaikan transaksi.

Nama pelanggan yang sudah tersimpan akan muncul kembali pada dropdown transaksi berikutnya.

### Mencatat cicilan

1. Buka menu **Piutang**.
2. Cari nama pelanggan atau invoice.
3. Klik **Bayar** pada transaksi yang dipilih.
4. Periksa sisa piutang.
5. Isi nominal pembayaran.
6. Pilih metode pembayaran.
7. Tambahkan catatan jika diperlukan.
8. Klik **Simpan Pembayaran**.

Nominal pembayaran tidak boleh lebih besar dari sisa piutang. Jika nominal sama dengan sisa piutang, transaksi otomatis menjadi lunas.

## 6. Format Nominal Uang

Kolom pembayaran mendukung pemisah ribuan otomatis.

Contoh:

- Ketik `10000`, tampilan berubah menjadi `10.000`.
- Ketik `125000`, tampilan berubah menjadi `125.000`.

Pemisah titik hanya untuk tampilan. Database tetap menyimpan angka sebagai nilai numerik, sehingga perhitungan tetap benar.

## 7. QR Invoice dan Pencarian Transaksi

Setiap struk baru memiliki QR invoice di bawah ucapan terima kasih.

QR berisi nomor invoice, misalnya:

```text
INV-20260926-0001
```

### Scan menggunakan kamera laptop

1. Buka menu **Laporan**.
2. Pilih tab **Laporan Penjualan**.
3. Klik **Scan Kamera**.
4. Izinkan akses kamera jika diminta oleh sistem.
5. Arahkan QR pada struk ke kamera.
6. Setelah terbaca, nomor invoice otomatis masuk ke pencarian.
7. Data transaksi akan langsung tersaring.

### Scan menggunakan barcode scanner USB

Barcode scanner USB biasanya bekerja seperti keyboard:

1. Buka Laporan Penjualan.
2. Klik kolom pencarian.
3. Scan kode pada struk.
4. Nomor invoice akan masuk ke kolom pencarian.

Jika QR lebih mudah dibaca oleh perangkat, gunakan QR pada struk karena lebih toleran terhadap foto miring, pantulan, dan kualitas cetak thermal.

## 9. Struk dan Printer

Setelah transaksi berhasil, preview struk terbuka otomatis. Klik **Cetak Struk** untuk mencetak.

Struk berisi:

- Informasi toko.
- Nomor invoice.
- Tanggal transaksi.
- Daftar barang.
- Subtotal, diskon, total, pembayaran, dan kembalian.
- Ucapan terima kasih.
- QR invoice.

### Printer Windows

1. Sambungkan printer dan pastikan sudah terdaftar di Windows.
2. Buka Pengaturan Printer.
3. Pilih mode Printer Windows.
4. Pilih printer jika diperlukan.
5. Cetak struk dari preview atau detail transaksi.

### Printer thermal ESC/POS jaringan

1. Masukkan alamat IP printer.
2. Masukkan port printer, biasanya `9100`.
3. Pilih mode ESC/POS jaringan.
4. Pastikan komputer dan printer berada pada jaringan yang sama.

### Printer thermal ESC/POS USB

1. Pastikan printer sudah terlihat sebagai printer Windows.
2. Pilih mode ESC/POS langsung melalui USB.
3. Pilih printer yang sesuai.
4. Cetak struk.

Jika ukuran hasil cetak tidak sesuai, buka Printing Preferences printer dan pilih ukuran roll yang sesuai, misalnya 58 mm atau 80 mm. Gunakan skala 100%.

## 10. Backup dan Restore

Backup digunakan untuk menyalin database agar data dapat dipulihkan jika komputer rusak atau database bermasalah.

### Membuat backup

1. Buka Pengaturan.
2. Pilih **Backup Database**.
3. Tentukan lokasi penyimpanan file backup.
4. Simpan file backup di media yang aman.

### Restore database

1. Pastikan aplikasi tidak sedang memproses transaksi.
2. Buka Pengaturan.
3. Pilih **Restore Database**.
4. Pilih file backup.
5. Tunggu sampai proses selesai.
6. Restart aplikasi jika diminta.

Buat backup secara rutin, terutama sebelum restore atau update aplikasi.

## 11. Lokasi Database

Database SQLite bernama `app.db` disimpan di folder data aplikasi:

- Windows: `%APPDATA%/kasir-usaha-desktop/database/app.db`
- macOS: `~/Library/Application Support/kasir-usaha-desktop/database/app.db`
- Linux: `~/.config/kasir-usaha-desktop/database/app.db`

Jangan menghapus atau mengubah file database secara manual saat aplikasi sedang berjalan.

## 12. Troubleshooting

### Piutang menampilkan error handler tidak ditemukan

Tutup semua jendela aplikasi, lalu jalankan kembali:

```bash
npm start
```

Error ini biasanya terjadi jika renderer sudah memuat halaman baru tetapi proses Electron masih menggunakan main process lama.

### Error `no such column` atau error database

1. Tutup aplikasi.
2. Pastikan aplikasi dijalankan dari folder project yang benar.
3. Jalankan kembali `npm start` agar migrasi database otomatis berjalan.
4. Jangan menghapus database sebelum membuat backup.

### `better-sqlite3` tidak kompatibel dengan versi Node

Jalankan instalasi ulang dependency dari folder project:

```bash
npm install
```

Jika masih gagal, gunakan versi Node yang sesuai dengan versi Electron dan jalankan kembali `npm install`.

### Kamera tidak terbuka

- Izinkan akses kamera pada dialog permission.
- Pastikan kamera tidak sedang dipakai aplikasi lain.
- Tutup dan buka kembali modal Scan Kamera.
- Pastikan laptop memiliki kamera aktif di Windows.

### QR tidak terbaca

- Cetak struk baru setelah perubahan QR.
- Pastikan QR tidak terpotong.
- Gunakan pencahayaan yang cukup.
- Hindari pantulan cahaya pada kertas.
- Pegang struk agar QR berada di tengah kamera.
- Jika memakai printer thermal, pastikan tinta atau thermal head mencetak hitam dengan jelas.

### Printer tidak mencetak

- Pastikan printer online di Windows.
- Periksa printer default atau nama printer pada Pengaturan.
- Untuk printer jaringan, periksa IP dan port `9100`.
- Untuk printer USB ESC/POS, pastikan printer terdaftar di Windows.
- Cetak test page dari Windows terlebih dahulu.

## 13. Struktur Teknis

```text
main.js                    Electron main process dan IPC handler
preload.js                 API aman untuk renderer
 database/schema.sql       Struktur tabel SQLite
 database/db.js            Inisialisasi database dan migrasi
 database/transactions.js  Checkout, piutang, dan pembayaran cicilan
 database/reports.js       Data laporan
 renderer/pages/           Halaman HTML aplikasi
 renderer/js/              Logika setiap halaman
 renderer/css/app.css      Design system dan styling
 assets/                   Asset aplikasi
```

### Tabel utama

- `users`: akun pengguna.
- `products`: produk dan stok barang.
- `gas_stock`: stok gas isi dan kosong.
- `transactions`: transaksi penjualan, status pembayaran, dan pelanggan.
- `transaction_items`: detail barang pada transaksi.
- `transaction_payments`: riwayat pembayaran dan cicilan piutang.
- `expenses`: pengeluaran usaha.
- `stock_movements`: riwayat pergerakan stok.
- `gas_transactions`: riwayat transaksi gas.
- `settings`: konfigurasi toko dan printer.

Semua akses database dari renderer dilakukan melalui IPC dan `contextBridge`. Renderer tidak mengakses SQLite atau filesystem secara langsung.
