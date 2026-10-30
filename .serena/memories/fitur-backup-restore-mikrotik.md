# Dokumentasi Fitur Backup & Restore Otomatis & Manual MikroTik RouterOS

## 1. Ringkasan Fitur
Fitur Backup & Restore komprehensif untuk RouterOS MikroTik yang menyediakan pencadangan manual (on-demand) dan terjadwal otomatis (weekly/daily scheduler). Sistem mengarsipkan file konfigurasi langsung dari RouterOS ke penyimpanan internal server melalui protokol API RouterOS dan transfer FTP.

Dukungan tipe backup:
1. **RouterOS Export Script (`.rsc`)**: Script teks konfigurasi human-readable (`/export compact`) yang aman dibaca, ditinjau ulang, dan dieksekusi sebagian atau seluruhnya pada router pengganti/baru.
2. **Binary System Backup (`.backup`)**: Backup biner lengkap sistem RouterOS (`/system/backup/save`) mencakup seluruh konfigurasi, user database, sertifikat SSL/TLS, dan konfigurasi interface.
3. **Dual Backup (Keduanya)**: Menjalankan kedua metode sekaligus dalam satu aksi untuk redundansi maksimal.

---

## 2. Alur Kerja Teknis & Eksekusi

### A. Eksekusi Export `.rsc` di RouterOS
1. Backend membuat script sementara di RouterOS via API path `/system/script` dengan nama acak `bexp_<timestamp>`.
2. Script membungkus perintah `/export` dengan error handling:
   ```routeros
   :do { /export compact file="exp_<router>_<ts>" } on-error={ /export file="exp_<router>_<ts>" }
   ```
3. Hak akses script diberikan policy `ftp,read,write,policy,test,password,sniff,sensitive` dengan atribut `dont-require-permissions=yes`.
4. Eksekusi script dikirimkan via API dan dipastikan terkirim dengan mengonsumsi generator tuple: `tuple(script_path("run", number=...))`.
5. Polling file di `/file` RouterOS hingga ukuran file stabil (tidak bertambah lagi) sebelum melanjutkan ke transfer FTP.
6. Script sementara di `/system/script` otomatis dihapus setelah file terbentuk.

### B. Eksekusi System Backup `.backup` di RouterOS
1. Backend mengeksekusi perintah backup via API:
   ```python
   tuple(backup_path("save", name="bak_<router>_<ts>", **{"dont-encrypt": "yes"}))
   ```
2. Jika parameter `dont-encrypt` tidak didukung oleh versi RouterOS tertentu, fallback otomatis dijalankan tanpa enkripsi atau via rawCmd `/system/backup/save`.
3. Polling file di `/file` RouterOS hingga selesai ditulis.

### C. Penarikan File melalui FTP (`_download_via_ftp`)
1. Backend mendeteksi port dan status service FTP router melalui API `/ip/service`.
2. Koneksi FTP dibuka ke host router dengan kredensial user admin MikroTik.
3. Mendukung transfer data via Passive Mode (`PASV`) dengan fallback penanganan IP NAT.
4. File diunduh dan disimpan ke direktori lokal server: `backend/backups/`.
5. **Auto-Cleanup**: Setelah file berhasil diunduh ke server, file temporary pada storage flash router di `/file` langsung dihapus via API untuk mencegah storage router penuh.

---

## 3. Penjadwal Otomatis (Auto Backup Scheduler)
- Berjalan sebagai background task asynchronous di FastAPI (`backend/app/backup_service.py`).
- Interval pengecekan scheduler: setiap 60 detik.
- Konfigurasi penjadwalan per router:
  - `frequency`: `daily` atau `weekly`.
  - `day_of_week`: `0` (Senin) s/d `6` (Minggu) untuk jadwal mingguan.
  - `hour` & `minute`: Waktu eksekusi lokal (contoh: pukul 02:00 pagi saat traffic rendah).
  - `backup_type`: `rsc`, `backup`, atau `both`.
  - `retention_days`: Masa simpan arsip (contoh: 30 hari). Arsip lama di luar retensi otomatis dibersihkan dari server.

---

## 4. Skema Database (PostgreSQL)

### A. Tabel `router_backups`
```sql
CREATE TABLE router_backups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    router_id INTEGER REFERENCES router_configs(id) ON DELETE CASCADE,
    backup_type VARCHAR(20) NOT NULL, -- 'rsc', 'backup', 'both'
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'failed', 'running'
    error_message TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### B. Tabel `backup_schedules`
```sql
CREATE TABLE backup_schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    router_id INTEGER UNIQUE REFERENCES router_configs(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly'
    day_of_week INTEGER DEFAULT 0, -- 0 = Monday, 6 = Sunday
    hour INTEGER DEFAULT 2,
    minute INTEGER DEFAULT 0,
    backup_type VARCHAR(20) DEFAULT 'both',
    retention_days INTEGER DEFAULT 30,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. REST API Endpoints (`backend/app/routes.py`)
- `GET /api/backup/list`: Mengambil daftar riwayat file backup untuk router aktif.
- `POST /api/backup/run`: Menjalankan backup manual on-demand (`backup_type`: `rsc`, `backup`, atau `both`).
- `GET /api/backup/download/{backup_id}`: Mengunduh file backup langsung ke browser (StreamingResponse).
- `GET /api/backup/preview/{backup_id}`: Menampilkan isi preview teks script `.rsc` langsung di UI modal.
- `DELETE /api/backup/{backup_id}`: Menghapus record riwayat dan file fisik dari server.
- `GET /api/backup/settings`: Mengambil konfigurasi jadwal auto-backup router.
- `POST /api/backup/settings`: Menyimpan pembaruan konfigurasi jadwal auto-backup.
- `GET /api/backup/stats`: Mengambil ringkasan statistik (total backup, total kapasitas penyimpanan, backup terakhir, status scheduler).

---

## 6. Antarmuka Pengguna (`frontend/src/pages/BackupPage.jsx`)
- **Akses Navigasi**: Menu `Backup & Restore` (`/backup`) di sidebar navigasi dengan ikon `Archive`.
- **Statistik Header**: 4 kartu ringkasan (Total Backup, Ruang Penyimpanan Terpakai, Backup Terakhir, Status Jadwal Otomatis).
- **Aksi Cepat**: Tombol `Backup Sekarang` memunculkan modal pemilihan tipe backup dengan visual status progress live.
- **Tabel Arsip**:
  - Kolom nama file, tipe (badge warna untuk RSC vs Backup), ukuran file terformat, tanggal pembuatan, status, dan tombol aksi.
  - Fitur pencarian instan dan filter berdasarkan tipe file (`rsc`, `backup`).
  - Tombol **Preview** (khusus `.rsc`) untuk membaca baris konfigurasi dengan fitur salin ke clipboard.
  - Tombol **Download** langsung dari browser.
  - Tombol **Hapus** dengan konfirmasi dialog aman.
- **Modal Pengaturan Jadwal**:
  - Switch toggle aktivasi scheduler.
  - Pemilihan tipe frekuensi (Harian / Mingguan).
  - Dropdown hari (Senin s/d Minggu) dan time picker (jam & menit).
  - Konfigurasi retensi (jumlah hari penyimpanan otomatis).
- **Feedback & Notifikasi**: Banner peringatan kontekstual jika port FTP 21 di router belum dibuka atau kredensial user MikroTik tidak memiliki policy `ftp`.
