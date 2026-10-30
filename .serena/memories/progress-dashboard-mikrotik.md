# Progress Dashboard Mikrotik

## Yang Sudah Dikerjakan (branch: dev)

### 1. Fitur Utama & Telemetri NOC
- **NOC Monitoring Dashboard** (`frontend/src/pages/NocDashboard.jsx`, route: `/noc`) — pusat monitoring operasional jaringan murni:
  - **Live Incident & System Log Stream** — filter log RouterOS khusus kategori `warning`, `error`, dan `critical` dengan filter pills (`/api/noc/incident-logs`).
  - **Multi-Target Latency Matrix** — ping live matrix ke ISP Gateway, Cloudflare (1.1.1.1), dan Google (8.8.8.8) dengan indikator latency & packet loss (`/api/noc/multi-ping`).
  - **DHCP IP Pool & Conntrack Table Meter** — bar utilisasi visual real-time untuk pemakaian pool IP DHCP dan tabel koneksi firewall (`/api/noc/dhcp-conntrack`).
  - **ISP Bandwidth Capacity & Saturation Alert** — modal pengaturan ambang batas kapasitas ISP (Mbps) dengan banner peringatan otomatis jika throughput melebihi 85%.
  - **Port Link Down Audio Alarm** — synthesizer audio Web Audio API otomatis berbunyi saat link port fisik berubah down (dengan tombol toggle mute/unmute).
  - **Single-Interface Throughput Chart** — dropdown pemilih interface (default: WAN / ether1) untuk menghindari akumulasi double-counting semua interface.
  - **Port Detail Inspector Modal** — inspeksi port mendalam dengan WebSocket live traffic (`useTrafficWS`) dan auto-negotiated speed/duplex.
  - **Top Talkers (Hotspot & PPPoE)** — perbaikan penghitungan byte PPPoE dengan memetakan username aktif ke interface dinamis `<pppoe-*>` dan queue simple (`backend/app/mikrotik.py`).
  - **Top DNS Domains** — monitoring domain DNS teratas via cache query RouterOS (`/ip/dns/cache/print`).
- **Network Topology** — realtime TX/RX traffic on topology edges and nodes (`frontend/src/pages/NetworkTopology.jsx`).
- **Device & Traffic Monitors** — telemetri CPU, RAM, disk, suhu, voltase (`DeviceMonitor.jsx`) dan traffic per interface (`InterfaceTraffic.jsx`).
- **Hotspot & PPPoE Monitors** — monitoring sesi aktif, IP, uptime, traffic real-time, dan manajemen user (`HotspotMonitor.jsx`, `PppoeMonitor.jsx`).
- **Admin User Management & Audit Logs** — endpoint CRUD user di `/api/admin/users` dan audit trail lengkap untuk mutasi data (`/api/admin/logs`).
- **Database PostgreSQL 16** — migrasi dari SQLite ke PostgreSQL dengan pooling koneksi `psycopg2`.

---

### 2. Fitur OLT & Monitoring Pelanggan FTTH (`frontend/src/pages/CustomerMonitor.jsx`, route: `/customers`)
- **Dukungan Multi-Vendor OLT**: VSOL, C-Data (NSCRTV GPON & CLAOS MIBs), HSGQ, dan Generic PON OLT via SNMP v2c engine independen.
- **Decoding Serial Number & MAC**: Parser heksadesimal 8-byte C-Data (ASCII vendor prefix + hex serial) dan normalisasi MAC address.
- **Workflow 5-Langkah Auto-Scan & Sinkronisasi PPPoE**:
  - Deteksi seluruh ONU aktif pada semua port PON (termasuk PON 1 s/d 16).
  - **Modal Pratinjau & Konfirmasi Sinkronisasi (`SyncPppoeModal`)**:
    - Pratinjau live sebelum commit ke database.
    - Smart matcher: mencocokkan deskripsi/nama ONU pada OLT terhadap `username` atau `comment` akun PPPoE MikroTik.
    - Tombol **Refresh / Rescan** langsung dari modal.
    - Filter status kecocokan (Semua, Matched, Belum Ada PPPoE).
  - Eliminasi timeout impor dengan payload pre-scanned items.
  - Cascade delete: penghapusan OLT otomatis membersihkan ONU/pelanggan terkait.
- **Monitoring Redaman Optik (RX/TX Power dBm)**: Indikator status visual (Normal, Waspada, Kritis, LOS), live probe per pelanggan, dan batch check massal.

---

### 3. Fitur Backup & Restore Otomatis & Manual RouterOS (`frontend/src/pages/BackupPage.jsx`, route: `/backup`)
- **Dual Backup Mode**:
  - **RouterOS Export Script (`.rsc`)**: Script teks konfigurasi human-readable (`/export compact`) dieksekusi via temporary script di `/system/script` dengan policy bypass (`sensitive`, `password`, `write`).
  - **Binary System Backup (`.backup`)**: Backup biner sistem RouterOS (`/system/backup/save`) dengan auto-fallback parameter `dont-encrypt`.
- **RouterOS API & FTP Lifecycle**:
  - Generator execution fix pada `ros_api`: konsumsi generator dengan `tuple()` agar command API terkirim pasti.
  - Polling kestabilan file di `/file` router sebelum download FTP.
  - Pengambilan file via FTP (Passive mode dengan fallback NAT).
  - Pembersihan file temporary di RouterOS secara otomatis pasca download untuk menghemat flash router.
- **Penjadwal Otomatis (Scheduler)**:
  - Background async scheduler di `backend/app/backup_service.py` berjalan setiap 60 detik.
  - Opsi frekuensi: `daily`, `weekly` (pilihan hari: Senin - Minggu), dan jam eksekusi (`00:00` - `23:59`).
  - Pembersihan otomatis arsip lama berdasarkan jumlah hari retensi (`retention_days`).
- **Antarmuka BackupPage**:
  - 4 kartu statistik ringkasan (Total Backup, Total Kapasitas, Backup Terakhir, Status Jadwal).
  - Aksi 1-klik `Backup Sekarang` dengan modal progres live.
  - Tabel arsip dengan pencarian instan, filter tipe file, tombol Download langsung, Preview script `.rsc`, dan Hapus arsip.
  - Modal konfigurasi jadwal auto-backup.

---

### 4. Sistem Tema (Dark / Light / System) & i18n
- **Theme Engine**:
  - `frontend/tailwind.config.js`: Ditambahkan konfigurasi `darkMode: 'class'`.
  - `frontend/index.html`: Anti-FOUC inline script di `<head>` untuk mencegah flash saat reload.
  - `frontend/src/context/ThemeContext.jsx`: State tema (`light`, `dark`, `system`) dengan OS color scheme listener.
  - `frontend/src/components/ThemeSelector.jsx`: Dropdown navbar modern dengan indikator centang dan outside click detection.
- **Centralized Language (i18n)**:
  - `frontend/src/context/LanguageContext.jsx`: Switcher bahasa ID 🇮🇩 / EN 🇬🇧 dengan persistensi `localStorage`.
  - Seluruh label halaman, modal, tombol, dan status badge terinternasionalisasi secara konsisten.

---

### 5. DevOps, CI/CD & Deploy
- **GitHub Actions Auto-Deploy** (`.github/workflows/deploy-dev.yml`):
  - Terpicu saat `git push origin dev`.
  - SSH ke VM server di `/opt/mikrotik-dev`.
  - `git fetch origin dev` dan `git reset --hard origin/dev` untuk mencegah konflik merge pada VM.
  - Build frontend dengan flag `--no-cache` dan timeout 20 menit.
  - Nginx anti-cache header untuk `index.html` agar update UI langsung terbaca oleh browser operator tanpa clear cache manual.

---

### 6. Riwayat Commit Signifikan (branch dev)
| Commit | Tipe / Pesan | Deskripsi |
|--------|--------------|-----------|
| `4326d42` | `feat(customer): add refresh button in sync preview modal and enhance matching` | Tombol refresh di modal preview sinkronisasi OLT & penyempurnaan smart matcher |
| `20b5e24` | `fix(backup): execute routeros export and backup commands and handle ftp lifecycle` | Eksekusi export/backup command via tuple generator & penanganan lifecycle FTP |
| `1c2c60e` | `fix(backup): use librouteros path api for script and file operations` | Migrasi operasi script dan file RouterOS ke librouteros Path API |
| `80c254d` | `fix(backup): keep export script alive while writing and fix file polling` | Pertahankan script sementara selama file ditulis & perbaikan polling ukuran file |
| `254fc6b` | `fix(backup): resolve generator throw exception in ros_api and decouple ftp download` | Fix exception throw generator di ros_api & pemisahan download FTP |
| `f4cb727` | `fix(backup): import AlertCircle icon in BackupPage` | Tambahkan import icon AlertCircle yang hilang pada BackupPage |
| `98fa7b1` | `fix(backup): fix export and backup execution, ftp retrieval, and error reporting` | Perbaikan eksekusi export/backup, penarikan FTP, dan pesan error informatif |
| `eff695d` | `fix(deploy): force reset to dev to avoid merge conflict on VM and disable html cache` | Force reset dev di VM server & disable cache HTML di browser |
| `1eb87ad` | `ci(deploy): add 20m timeout and target --no-cache only for frontend build` | Tambah timeout 20 menit & batasi --no-cache hanya untuk build frontend |
| `029b908` | `ci(deploy): add --no-cache to build to ensure fresh frontend build` | Flag build tanpa cache agar update frontend selalu termuat segar |
| `af98ebf` | `ci(deploy): force rebuild and recreate frontend and backend containers` | Force rebuild dan recreate container backend & frontend |
| `1cecedc` | `feat(backup): add weekly auto backup scheduler and internal archive storage` | Implementasi fitur backup & restore lengkap dengan scheduler & storage internal |
| `3aed0c7` | `feat(ftth): enhance auto-sync matcher for OLT description vs MikroTik username/comment` | Penyempurnaan smart matcher deskripsi OLT terhadap username/comment PPPoE |
| `89c374f` | `feat(ftth): add preview and confirmation modal for PPPoE auto-sync` | Penambahan modal pratinjau & konfirmasi sinkronisasi PPPoE |
| `f213d52` | `fix(ftth): resolve router_id properly and provide clear diagnostic messages for PPPoE sync` | Resolusi router_id yang tepat & pesan diagnostik jelas untuk sinkronisasi |
| `066d99d` | `fix(ftth): remove nonexistent db helpers in auto-scan import` | Pembersihan helper DB non-existent pada import auto-scan |
| `5b928c3` | `fix(ftth): smart customer name & comment matcher for PPPoE sync` | Matcher pintar nama pelanggan dan komentar akun PPPoE |
| `226d85a` | `fix(ftth): eliminate import timeout with pre-scanned items payload, cascade delete ONUs...` | Hilangkan timeout via pre-scanned items, cascade delete ONU, fix PON port 16 |
| `e536c72` | `feat(olt): add C-Data NSCRTV GPON live scanning, 8-byte SN decoding...` | Scanning C-Data NSCRTV GPON, decode serial number 8-byte, dan pengayaan telemetri |
| `db1613f` | `feat(olt): add C-Data CLAOS MIB OIDs and edit OLT modal` | Dukungan OID CLAOS MIB untuk C-Data & modal edit OLT |
| `6a51d38` | `feat(ftth): re-architect FTTH workflow to 5-step OLT scan and PPPoE synchronization` | Arsitektur ulang workflow FTTH 5-step scan OLT & sinkronisasi PPPoE |
| `69ae88f` | `feat(olt): add multi-vendor live SNMP walking for C-Data and VSOL...` | SNMP walk live multi-vendor untuk C-Data dan VSOL dengan decode MAC nyata |
| `e03edfd` | `fix(theme): balance port matrix contrast and localize kiosk mode button` | Kontras port matrix, NOC header responsif, Recharts adaptive theme |
| `da90eb0` | `feat(theme): add dark, light, and system theme switcher with auto-sync and memories` | Sistem tema (Light, Dark, System), navbar theme selector, bahasa, dan dark mode |

---

## Repository
- **GitHub**: https://github.com/aryusufn-new/mikrotik-dashboard.git
- **Branch aktif**: `dev`

---

## Struktur Directory Lengkap
```
mikrotik-dashboard/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry point & background task startup
│   │   ├── routes.py            # API routes (NOC, OLT, Customer, Backup, Auth, Admin)
│   │   ├── auth.py              # Auth decorator & admin check
│   │   ├── database.py          # PostgreSQL DB models & queries
│   │   ├── mikrotik.py          # RouterOS API integration & NOC telemetry
│   │   ├── olt_service.py       # SNMP v2c client, OLT scanning, SN/MAC parser
│   │   ├── backup_service.py    # Auto & manual backup, FTP downloader, scheduler
│   │   ├── config.py            # App config & environment variables
│   │   └── ws.py                # WebSocket traffic & interface handlers
│   ├── backups/                 # Internal archive storage for .rsc and .backup files
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ThemeSelector.jsx      # Theme dropdown (Light/Dark/System) & language pill
│   │   │   ├── TrafficPanel.jsx
│   │   │   ├── ServiceStatsCards.jsx
│   │   │   ├── BoardInfo.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   └── Gauge.jsx
│   │   ├── context/
│   │   │   ├── ThemeContext.jsx       # Theme state & OS preference sync
│   │   │   ├── LanguageContext.jsx    # Centralized i18n (ID / EN)
│   │   │   └── RouterContext.jsx      # Multi-router selector context
│   │   ├── pages/
│   │   │   ├── NocDashboard.jsx       # Dedicated NOC Monitoring View
│   │   │   ├── CustomerMonitor.jsx    # FTTH & OLT Optical Attenuation & Sync
│   │   │   ├── BackupPage.jsx         # RouterOS Backup & Restore Scheduler
│   │   │   ├── DeviceMonitor.jsx      # System resources & health
│   │   │   ├── NetworkTopology.jsx    # Realtime topology + traffic
│   │   │   ├── InterfaceTraffic.jsx   # Bandwidth & interface details
│   │   │   ├── HotspotMonitor.jsx     # Hotspot users & active sessions
│   │   │   ├── PppoeMonitor.jsx       # PPPoE clients & traffic
│   │   │   ├── AdminLogs.jsx          # Audit trails & mutasi
│   │   │   ├── ConfigPage.jsx         # Router & OLT device configuration
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── hooks/
│   │   │   ├── useTrafficWS.js
│   │   │   ├── useInterfacesWS.js
│   │   │   ├── useHotspotTrafficWS.js
│   │   │   └── usePppoeTrafficWS.js
│   │   ├── layouts/
│   │   │   ├── AppLayout.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── docker/
│   └── postgres/
│       └── init-databases.sh
├── .github/
│   └── workflows/
│       └── deploy-dev.yml             # CI/CD auto-deploy dev branch to VM
├── .serena/
│   ├── memories/
│   │   ├── arsitektur-dan-database.md
│   │   ├── fitur-backup-restore-mikrotik.md
│   │   ├── fitur-olt-pelanggan-ftth.md
│   │   ├── progress-dashboard-mikrotik.md
│   │   ├── rencana-mikrotik-admin-frontend.md
│   │   └── tema-dark-mode.md
│   ├── project.yml
│   └── project.local.yml
├── docker-compose.yml
├── docker-compose.dev.yml
├── deploy.sh
└── README.md
```

---

## Status Saat Ini (30 Oktober 2026)
- **Branch**: `dev` sinkron penuh dengan `origin/dev` (commit `4326d42`).
- **Fitur Utama Terimplementasi**:
  - [x] NOC Live Telemetry & Audio Alarm Link Down
  - [x] Manajemen OLT Multi-Vendor (VSOL, C-Data, HSGQ) & Pelanggan FTTH
  - [x] Modal Pratinjau & Konfirmasi Sinkronisasi PPPoE dengan Refresh Button
  - [x] Fitur Backup & Restore Otomatis & Manual RouterOS (Export RSC & System Backup)
  - [x] Sistem Tema (Dark / Light / System) & Internasionalisasi Bahasa (ID / EN)
  - [x] Database PostgreSQL 16 & Audit Trail Logging
  - [x] CI/CD Auto-Deploy dev branch ke VM Server Ubuntu
- **Next Steps**:
  - [ ] Pengujian lapangan live restore konfigurasi pada router lab/staging
  - [ ] Integrasi push notification (Telegram bot / WhatsApp gateway) saat backup gagal atau redaman kabel fiber putus (LOS)
  - [ ] Persiapan final merge branch `dev` ke `main` untuk rilis production