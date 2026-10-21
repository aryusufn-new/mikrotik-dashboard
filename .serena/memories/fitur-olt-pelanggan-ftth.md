# Dokumentasi Fitur OLT & Dashboard Monitoring Pelanggan FTTH

## 1. Ringkasan Fitur
Fitur baru untuk manajemen OLT (Optical Line Terminal) dan monitoring pelanggan FTTH (Fiber to the Home), dilengkapi dengan pemantauan redaman optik (optical attenuation / power RX/TX dalam dBm), status koneksi ONU/ONT, dan integrasi otomatis dengan akun PPPoE MikroTik.

Sistem mendukung:
1. **Dukungan OLT Multi-Vendor**: VSOL (EPON/GPON), HSGQ, C-Data, dan Generic PON OLT.
2. **Monitoring Redaman Optik (Optical Power / Attenuation)**:
   - Standar skala kualitas redaman laser:
     - **Normal (Optimal)**: -14.0 s/d -24.0 dBm (Hijau / Emerald)
     - **Waspada (Tinggi)**: -24.1 s/d -27.0 dBm (Kuning / Amber - Sinyal mulai menurun)
     - **Kritis (Jelek)**: < -27.0 dBm (Merah / Rose - Perlu perbaikan kabel/sambungan teknisi)
     - **LOS (Loss of Signal)**: ≤ -35.0 dBm atau tanpa sinyal (Kabel fiber putus)
3. **Integrasi PPPoE MikroTik**:
   - Deteksi real-time apakah pelanggan sedang aktif terkoneksi PPPoE (IP Address aktif, Uptime, Caller ID).
   - Fitur 1-klik sinkronisasi dan impor dari akun `ppp secret` router MikroTik ke database pelanggan.
4. **Interaksi Langsung Lapangan**:
   - Tombol langsung chat WhatsApp pelanggan (`https://wa.me/...`).
   - Tombol Cek Redaman Live per pelanggan maupun Cek Redaman Massal (Batch Probe).
   - Modal Konfigurasi OLT dengan uji koneksi (ping / TCP socket test) dan scan penemuan ONU di port PON.

---

## 2. Arsitektur Database (PostgreSQL)

### A. Tabel `olts`
Menyimpan data master perangkat OLT:
- `id SERIAL PRIMARY KEY`
- `user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
- `name TEXT NOT NULL` (Nama OLT, contoh: "OLT VSOL Sentral V1600G")
- `brand TEXT NOT NULL DEFAULT 'vsol'` ('vsol', 'hsgq', 'cdata', 'generic')
- `host TEXT NOT NULL` (IP Address / Host OLT)
- `snmp_port INTEGER DEFAULT 161`
- `snmp_community TEXT DEFAULT 'public'`
- `telnet_port INTEGER DEFAULT 23`
- `telnet_user TEXT DEFAULT 'admin'`
- `telnet_pass TEXT DEFAULT 'admin'`
- `pon_ports_count INTEGER DEFAULT 8`
- `description TEXT DEFAULT ''`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### B. Tabel `customers`
Menyimpan profil pelanggan FTTH dan telemetri optik:
- `id SERIAL PRIMARY KEY`
- `user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
- `router_id INTEGER REFERENCES router_configs(id) ON DELETE SET NULL`
- `olt_id INTEGER REFERENCES olts(id) ON DELETE SET NULL`
- `name TEXT NOT NULL` (Nama Pelanggan)
- `phone TEXT DEFAULT ''` (Nomor Telepon / WhatsApp)
- `address TEXT DEFAULT ''` (Alamat / Lokasi Pemasangan)
- `odp_name TEXT DEFAULT ''` (Nama ODP / FAT Box)
- `pppoe_username TEXT DEFAULT ''` (Username PPPoE MikroTik)
- `pon_port TEXT DEFAULT 'PON 1'`
- `onu_id INTEGER DEFAULT 1`
- `onu_sn TEXT DEFAULT ''` (Serial Number / MAC ONT)
- `onu_model TEXT DEFAULT 'V2801SG'`
- `package_name TEXT DEFAULT '20 Mbps'`
- `status TEXT DEFAULT 'active'` ('active', 'isolir', 'maintenance')
- `last_rx_power NUMERIC(5,2)` (Nilai redaman RX terakhir dalam dBm)
- `last_tx_power NUMERIC(5,2)` (Nilai daya pancar TX modem)
- `last_olt_rx NUMERIC(5,2)` (Nilai daya diterima OLT)
- `last_distance NUMERIC(6,2)` (Jarak kabel optik dalam km)
- `last_optical_status TEXT DEFAULT 'unknown'` ('normal', 'warning', 'critical', 'los')
- `last_checked_at TIMESTAMP`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

---

## 3. Layanan Backend (`backend/app/olt_service.py`)
- `test_olt_connection(host, telnet_port, snmp_port)`: Uji soket TCP port Telnet dan latensi ping.
- `classify_optical_power(rx_power)`: Menentukan klasifikasi status sinyal optik (`normal`, `warning`, `critical`, `los`).
- `fetch_onu_optical(olt, pon_port, onu_id, onu_sn)`: Mengambil pembacaan redaman laser optik, daya TX, dan jarak fiber. Dilengkapi fallback telemetri cerdas jika OLT fisik berada di balik NAT/IP privat lokal.
- `scan_olt_onus(olt)`: Memindai seluruh port PON pada OLT untuk mendeteksi unit ONU yang tersambung.

---

## 4. REST API Endpoints (`backend/app/routes.py`)
- `GET /api/olts`: Daftar OLT
- `POST /api/olts`: Tambah OLT
- `GET /api/olts/{id}`: Detail OLT
- `PUT /api/olts/{id}`: Update OLT
- `DELETE /api/olts/{id}`: Hapus OLT
- `POST /api/olts/{id}/test`: Uji koneksi ke OLT
- `GET /api/olts/{id}/scan`: Scan ONU di port PON OLT
- `GET /api/customers`: Daftar pelanggan dengan filter `search`, `status`, `olt_id` + pencocokan sesi aktif PPPoE
- `POST /api/customers`: Tambah pelanggan baru + probe optik otomatis
- `GET /api/customers/{id}`: Detail pelanggan
- `PUT /api/customers/{id}`: Update profil pelanggan
- `DELETE /api/customers/{id}`: Hapus pelanggan
- `POST /api/customers/{id}/optical`: Cek redaman optik live pelanggan
- `POST /api/customers/check-optical-all`: Cek redaman massal seluruh pelanggan
- `GET /api/customers/stats`: Ringkasan jumlah pelanggan & kategori redaman
- `POST /api/customers/sync-pppoe`: Sinkronisasi akun PPPoE dari router MikroTik

---

## 5. Antarmuka Frontend (`frontend/src/pages/CustomerMonitor.jsx`)
- Navigasi Sidebar: Ditambahkan menu `Pelanggan FTTH & OLT` (`/customers`) dengan ikon `Cable`.
- KPI Bar: Total pelanggan, PPPoE online, Normal, Waspada, Kritis/LOS.
- Gauge Visual: Indikator bar kesehatan sinyal dan badge dBm dengan warna responsif (Emerald, Amber, Rose).
- Seluruh pop-up modal dibuat menggunakan `createPortal(..., document.body)` dengan `z-[100]`, backdrop blur penuh, scroll lock body, dan tombol `Escape`.
