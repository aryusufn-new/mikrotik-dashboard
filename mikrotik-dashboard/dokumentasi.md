# Dokumentasi MIMO.SA - Mikrotik Monitoring System

---

## Daftar Isi

1. [Penjelasan Aplikasi](#1-penjelasan-aplikasi)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Struktur Direktori](#4-struktur-direktori)
5. [Fitur Aplikasi](#5-fitur-aplikasi)
6. [API Endpoints](#6-api-endpoints)
7. [WebSocket Endpoints](#7-websocket-endpoints)
8. [Sistem Autentikasi](#8-sistem-autentikasi)
9. [Multi-Router Support](#9-multi-router-support)
10. [Skema Database](#10-skema-database)
11. [Prasyarat](#11-prasyarat)
12. [Deploy ke CT Proxmox](#12-deploy-ke-ct-proxmox)
13. [Konfigurasi MikroTik](#13-konfigurasi-mikrotik)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Penjelasan Aplikasi

**MIMO.SA (Mikrotik Monitoring System)** adalah aplikasi web dashboard full-stack untuk memantau perangkat MikroTik RouterOS secara real-time. Aplikasi ini terdiri dari dua bagian utama:

- **Backend**: REST API dan WebSocket server berbasis Python FastAPI yang berkomunikasi langsung dengan RouterOS melalui API protocol (`librouteros`).
- **Frontend**: Single Page Application (SPA) berbasis React yang menampilkan data monitoring dalam bentuk gauge, chart, dan tabel secara real-time.

Aplikasi ini mendukung **multi-router**, artinya satu user bisa menambahkan dan memantau banyak perangkat MikroTik sekaligus, dan berpindah antar router dari sidebar dashboard.

### Apa yang Bisa Dipantau?

| Fitur | Deskripsi |
|---|---|
| **Device Monitor** | Info board (nama, versi, arsitektur), CPU Load, RAM, Disk (HDD), dan Uptime dalam bentuk gauge |
| **Interface Traffic** | Traffic real-time (TX/RX) semua interface dalam bps, status running/down/disabled |
| **PPPoE Monitor** | Daftar PPP Secret (total/online/offline), sesi aktif, traffic per-user PPPoE secara real-time |
| **Hotspot Monitor** | Daftar Hotspot User (total/online/offline), sesi aktif, traffic per-user Hotspot secara real-time |
| **Config Page** | Kelola multi-router (tambah, edit, hapus, test koneksi), pilih router aktif |

---

## 2. Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────┐
│                      Browser / Client                     │
│                                                           │
│  React SPA (Vite + Tailwind + Recharts)                   │
│  - REST requests → /api/*                                 │
│  - WebSocket connections → /ws/*                          │
└───────────────────┬──────────────────────────────────────┘
                    │ HTTP / WebSocket
                    ▼
┌──────────────────────────────────────────────────────────┐
│              Nginx (Reverse Proxy / Static)                │
│                                                           │
│  /           → serve static React build (dist/)           │
│  /api/*      → proxy ke Backend (port 8000)               │
│  /ws/*       → proxy ke Backend (WebSocket upgrade)       │
└───────────────────┬──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│             FastAPI Backend (Gunicorn + Uvicorn)           │
│                                                           │
│  - JWT Authentication                                     │
│  - REST API endpoints                                     │
│  - WebSocket streaming (4 channel)                        │
│  - SQLite database (users + router_configs)               │
│  - librouteros → koneksi ke MikroTik API                  │
└───────────────────┬──────────────────────────────────────┘
                    │ RouterOS API Protocol (port 8728)
                    ▼
┌──────────────────────────────────────────────────────────┐
│              MikroTik RouterOS Device(s)                   │
│                                                           │
│  Router 1 (192.168.88.1:8728)                             │
│  Router 2 (10.0.0.1:8728)                                 │
│  Router N (x.x.x.x:8728)                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

### Backend

| Teknologi | Versi | Fungsi |
|---|---|---|
| Python | 3.10+ | Runtime |
| FastAPI | 0.115.0 | Web framework (REST + WebSocket) |
| Uvicorn | 0.30.6 | ASGI server |
| Gunicorn | 22.0.0 | Production process manager |
| librouteros | 3.4.1 | MikroTik RouterOS API client |
| SQLite | built-in | Database (users + router configs) |
| aiosqlite | 0.20.0 | Async SQLite support |
| python-jose | 3.3.0 | JWT token (HS256) |
| passlib + bcrypt | 1.7.4 / 4.0.1 | Password hashing |
| Pydantic | 2.9.2 | Data validation |
| python-dotenv | 1.0.1 | Environment variable |

### Frontend

| Teknologi | Versi | Fungsi |
|---|---|---|
| React | 18.3.1 | UI framework |
| Vite | 5.4.8 | Build tool & dev server |
| Tailwind CSS | 3.4.13 | Utility-first CSS |
| Recharts | 2.13.0 | Chart (Line, Area) untuk traffic |
| React Router DOM | 6.27.0 | Client-side routing |
| Axios | 1.7.7 | HTTP client |
| Lucide React | 0.453.0 | Icon library |

### Infrastructure

| Teknologi | Fungsi |
|---|---|
| Nginx | Static file server + reverse proxy |

---

## 4. Struktur Direktori

```
mikrotik-dashboard/
├── dokumentasi.md              # File dokumentasi ini
├── README.md                   # README singkat
├── .gitignore
│
├── backend/
│   ├── requirements.txt        # Dependencies Python
│   ├── .env.example            # Template environment variable
│   ├── config.json             # Fallback config (legacy)
│   ├── data.db                 # SQLite database
│   └── app/
│       ├── __init__.py
│       ├── main.py             # Entry point FastAPI
│       ├── config.py           # Multi-layer config resolution
│       ├── database.py         # SQLite schema + CRUD
│       ├── auth.py             # JWT authentication
│       ├── mikrotik.py         # RouterOS API wrapper
│       ├── routes.py           # REST API endpoints
│       ├── ws.py               # WebSocket endpoints
│       └── gunicorn.conf.py    # Gunicorn production config
│
└── frontend/
    ├── nginx.conf              # Reverse proxy config (referensi)
    ├── package.json            # Dependencies Node.js
    ├── vite.config.js          # Vite configuration
    ├── tailwind.config.js      # Tailwind configuration
    ├── postcss.config.js
    ├── index.html              # HTML entry point
    ├── .env.example            # Template environment variable
    └── src/
        ├── main.jsx            # React entry point
        ├── App.jsx             # Router setup + auth guards
        ├── api.js              # Axios client + semua API function
        ├── index.css           # Tailwind directives + custom CSS
        ├── context/
        │   ├── AuthContext.jsx     # JWT auth state management
        │   └── RouterContext.jsx   # Multi-router selection state
        ├── layouts/
        │   ├── AppLayout.jsx       # Sidebar + main content
        │   └── Sidebar.jsx         # Navigasi + router selector
        ├── pages/
        │   ├── LoginPage.jsx       # Halaman login
        │   ├── DeviceMonitor.jsx   # CPU/RAM/Disk gauge + traffic
        │   ├── InterfaceTraffic.jsx # Traffic semua interface
        │   ├── PppoeMonitor.jsx    # PPPoE monitoring
        │   ├── HotspotMonitor.jsx  # Hotspot monitoring
        │   └── ConfigPage.jsx      # CRUD multi-router
        ├── hooks/
        │   ├── useTrafficWS.js         # WS: single interface traffic
        │   ├── useInterfacesWS.js      # WS: all interfaces traffic
        │   ├── usePppoeTrafficWS.js    # WS: per-user PPPoE traffic
        │   └── useHotspotTrafficWS.js  # WS: per-user Hotspot traffic
        ├── components/
        │   ├── Gauge.jsx               # SVG donut gauge
        │   ├── BoardInfo.jsx           # Info board card
        │   ├── ServiceStatsCards.jsx   # Total/online/offline cards
        │   └── ErrorBoundary.jsx       # React error boundary
        └── utils/
            └── format.js               # formatBps, formatBytes, formatUptime
```

---

## 5. Fitur Aplikasi

### 5.1 Login & Autentikasi

- Login dengan username dan password
- JWT token (HS256) dengan masa berlaku 24 jam
- Auto-logout saat token expired (HTTP 401)
- Default user: `admin` / `admin` (dibuat otomatis saat pertama kali)

### 5.2 Device Monitor (`/device`)

- **Board Info**: Nama router, versi RouterOS, arsitektur
- **CPU Load**: Gauge real-time (%)
- **RAM Usage**: Gauge (free/total memory)
- **Disk Usage**: Gauge (free/total HDD)
- **Uptime**: Waktu aktif router
- **Traffic Chart**: Grafik line real-time TX/RX interface utama

### 5.3 Interface Traffic (`/interfaces`)

- Daftar semua interface dengan status (running/down/disabled)
- Traffic real-time per interface (RX/TX dalam bps) via WebSocket
- Total traffic agregat semua interface
- Update setiap 1 detik

### 5.4 PPPoE Monitor (`/pppoe`)

- Statistik: Total secret / Online / Offline
- Tabel PPP Secret dengan status online/offline
- Tabel sesi PPPoE aktif (name, service, address, uptime, caller-id)
- Traffic real-time per-user PPPoE via WebSocket (setiap 2 detik)
- Support user RADIUS yang tidak ada di local secret

### 5.5 Hotspot Monitor (`/hotspot`)

- Statistik: Total user / Online / Offline
- Tabel Hotspot User dengan status online/offline
- Tabel sesi Hotspot aktif (user, address, MAC, uptime, server)
- Traffic real-time per-user Hotspot via WebSocket (setiap 2 detik)
- Kalkulasi traffic berbasis delta bytes-in/bytes-out

### 5.6 Config Page (`/config`)

- Tambah router baru (nama, host, username, password, port)
- Edit konfigurasi router yang sudah ada
- Hapus router
- Test koneksi ke router (menampilkan identity + versi jika berhasil)
- Pilih router aktif

---

## 6. API Endpoints

Semua endpoint (kecuali login) memerlukan header `Authorization: Bearer <token>`.

Endpoint monitoring menerima header `X-Router-Id: <id>` untuk memilih router.

### Auth

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/login` | Login (OAuth2 password form) |
| GET | `/api/auth/me` | Info user saat ini |

### Router CRUD

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/routers` | List semua router milik user |
| POST | `/api/routers` | Tambah router baru |
| GET | `/api/routers/{id}` | Detail router (password masked) |
| PUT | `/api/routers/{id}` | Update router |
| DELETE | `/api/routers/{id}` | Hapus router |
| POST | `/api/routers/{id}/test` | Test koneksi ke router |

### System & Interface

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/system/resource` | Info system (identity, board, CPU, RAM, HDD, uptime) |
| GET | `/api/interfaces` | List semua interface + byte counters |
| GET | `/api/interfaces/summary` | Summary (total/running/down/disabled) |

### PPP

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/ppp/stats` | Statistik PPP (total/online/offline) |
| GET | `/api/ppp/active` | List sesi PPP aktif |
| GET | `/api/ppp/secrets` | List semua PPP secret + status online |

### Hotspot

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/hotspot/stats` | Statistik Hotspot (total/online/offline) |
| GET | `/api/hotspot/active` | List sesi Hotspot aktif |
| GET | `/api/hotspot/users` | List semua Hotspot user + status online |

### Legacy Config

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/config` | Get config (password masked) |
| PUT | `/api/config` | Update config |
| POST | `/api/config/test` | Test koneksi |

---

## 7. WebSocket Endpoints

Semua WebSocket memerlukan query parameter `token=<jwt>` dan opsional `router_id=<id>`.

| Endpoint | Interval | Deskripsi |
|---|---|---|
| `/ws/traffic?iface=<name>` | 1 detik | Traffic single interface (monitor-traffic once) |
| `/ws/interfaces-traffic` | 1 detik | Traffic semua interface (delta RX/TX bytes) |
| `/ws/ppp-traffic` | 2 detik | Traffic per-user PPPoE (batch monitor-traffic) |
| `/ws/hotspot-traffic` | 2 detik | Traffic per-user Hotspot (delta bytes-in/out) |

---

## 8. Sistem Autentikasi

```
Client                          Backend
  │                                │
  │  POST /api/auth/login          │
  │  (username + password form)    │
  │ ──────────────────────────────►│
  │                                │ verify password (bcrypt)
  │                                │ generate JWT (HS256, 24h)
  │  ◄──────────────────────────── │
  │  { access_token, token_type }  │
  │                                │
  │  GET /api/system/resource      │
  │  Authorization: Bearer <token> │
  │  X-Router-Id: <id>             │
  │ ──────────────────────────────►│
  │                                │ decode JWT → get user
  │                                │ load router config
  │                                │ connect to MikroTik
  │  ◄──────────────────────────── │
  │  { identity, cpu_load, ... }   │
```

---

## 9. Multi-Router Support

Aplikasi mendukung banyak router per user:

1. **Database** menyimpan banyak entry di tabel `router_configs` per `user_id`
2. **Frontend** menyimpan `activeRouterId` di `localStorage`
3. **Setiap REST request** mengirim header `X-Router-Id` via Axios interceptor
4. **Setiap WebSocket** mengirim `router_id` sebagai query parameter
5. **Backend** me-resolve config berdasarkan prioritas:
   - Router ID spesifik dari database
   - Router pertama milik user dari database
   - Migrasi dari `config.json` (legacy)
   - Fallback ke `.env` / default values

---

## 10. Skema Database

Database menggunakan SQLite (`data.db`) dengan dua tabel:

```sql
CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE router_configs (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL,
    name     TEXT NOT NULL DEFAULT 'Router 1',
    host     TEXT NOT NULL DEFAULT '192.168.88.1',
    username TEXT NOT NULL DEFAULT 'admin',
    password TEXT NOT NULL DEFAULT '',
    port     INTEGER NOT NULL DEFAULT 8728,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Default user yang dibuat otomatis: `admin` / `admin` (password di-hash bcrypt).

---

## 11. Prasyarat

| Komponen | Versi Minimum |
|---|---|
| OS | Debian 11+ / Ubuntu 20.04+ (CT Proxmox) |
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Nginx | 1.18+ |
| Git | 2.x |

### Sisi MikroTik

- Service **API** aktif (default port `8728`)
- User dengan policy minimal `api, read`
- Firewall mengizinkan koneksi ke port API dari server dashboard

---

## 12. Deploy ke CT Proxmox

### 12.1 Buat CT di Proxmox

1. Buka Proxmox Web UI → **Create CT**
2. Template: **debian-12-standard** atau **ubuntu-22.04-standard**
3. Spesifikasi minimum:
   - CPU: 1 core
   - RAM: 512 MB (rekomendasi 1 GB)
   - Disk: 4 GB
   - Network: Bridge (pastikan bisa akses ke MikroTik)
4. Start CT, lalu masuk via console atau SSH

### 12.2 Update Sistem & Install Dependencies

```bash
apt update && apt upgrade -y

apt install -y python3 python3-pip python3-venv nginx git curl

curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

Verifikasi:

```bash
python3 --version    # harus 3.10+
node --version       # harus 18+
npm --version        # harus 9+
nginx -v
```

### 12.3 Upload / Clone Project

Pilih salah satu cara:

**Opsi A: Clone dari Git (jika ada repo)**

```bash
cd /opt
git clone <URL_REPO> mikrotik-dashboard
```

**Opsi B: Upload manual via SCP**

Dari komputer lokal:

```bash
scp -r ./mikrotik-dashboard root@<IP_CT>:/opt/mikrotik-dashboard
```

### 12.4 Setup Backend

```bash
cd /opt/mikrotik-dashboard/backend

python3 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

Buat file environment:

```bash
cp .env.example .env
```

Edit `.env` sesuai kebutuhan:

```bash
nano .env
```

```env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=password_mikrotik_kamu
MIKROTIK_PORT=8728
CORS_ORIGINS=*
JWT_SECRET=ganti-dengan-secret-key-yang-kuat
```

> **Catatan**: `MIKROTIK_HOST` di `.env` hanya digunakan sebagai fallback awal. Setelah login, konfigurasi router dilakukan melalui halaman Config di dashboard dan disimpan di database.

Buat direktori data untuk database:

```bash
mkdir -p /opt/mikrotik-dashboard/backend/data
```

Test apakah backend bisa jalan:

```bash
source /opt/mikrotik-dashboard/backend/.venv/bin/activate
cd /opt/mikrotik-dashboard/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Jika tidak ada error, hentikan dengan `Ctrl+C`.

### 12.5 Buat Systemd Service untuk Backend

```bash
nano /etc/systemd/system/mikrotik-dashboard.service
```

Isi dengan:

```ini
[Unit]
Description=Mikrotik Dashboard Backend
After=network.target

[Service]
Type=exec
User=root
WorkingDirectory=/opt/mikrotik-dashboard/backend
Environment=PATH=/opt/mikrotik-dashboard/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=JWT_SECRET=ganti-dengan-secret-key-yang-kuat
ExecStart=/opt/mikrotik-dashboard/backend/.venv/bin/gunicorn app.main:app -c app/gunicorn.conf.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan dan jalankan:

```bash
systemctl daemon-reload
systemctl enable mikrotik-dashboard
systemctl start mikrotik-dashboard
systemctl status mikrotik-dashboard
```

Pastikan statusnya **active (running)**. Cek log jika ada masalah:

```bash
journalctl -u mikrotik-dashboard -f
```

### 12.6 Build Frontend

```bash
cd /opt/mikrotik-dashboard/frontend

npm ci
```

Buat `.env` untuk production build (opsional, karena default sudah otomatis detect):

```bash
cp .env.example .env
```

Untuk production, kosongkan saja atau hapus `.env` frontend karena frontend akan otomatis menggunakan relative path saat di-serve dari Nginx:

```bash
rm -f .env
```

Build:

```bash
npm run build
```

Hasil build ada di `dist/`.

### 12.7 Konfigurasi Nginx

```bash
nano /etc/nginx/sites-available/mikrotik-dashboard
```

Isi dengan:

```nginx
server {
    listen 80;
    server_name _;

    # Frontend static files
    location / {
        root /opt/mikrotik-dashboard/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API ke backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy WebSocket ke backend
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Aktifkan site dan restart Nginx:

```bash
ln -sf /etc/nginx/sites-available/mikrotik-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx
```

### 12.8 Test Akses

Buka browser dan akses:

```
http://<IP_CT_PROXMOX>
```

Login dengan:

- **Username**: `admin`
- **Password**: `admin`

> **Penting**: Segera ganti password default setelah login pertama (jika fitur tersedia), atau ganti langsung di database.

### 12.9 Ringkasan Port

| Port | Service | Keterangan |
|---|---|---|
| 80 | Nginx | Akses dashboard (HTTP) |
| 8000 | Gunicorn/Backend | Internal, di-proxy oleh Nginx |
| 8728 | MikroTik API | Port tujuan koneksi ke router |

---

## 13. Konfigurasi MikroTik

Agar dashboard bisa terhubung ke MikroTik, perlu konfigurasi di sisi RouterOS:

### 13.1 Aktifkan API Service

Via Winbox:
```
IP → Services → api → Enable (port 8728)
```

Via Terminal RouterOS:
```
/ip service enable api
/ip service set api port=8728
```

### 13.2 Buat User API (Rekomendasi)

Jangan gunakan user `admin` utama. Buat user khusus untuk API:

Via Terminal RouterOS:
```
/user add name=dashboard_api password=password_kuat group=read
```

Pastikan group `read` memiliki policy `api`:
```
/user group print
```

Jika perlu buat group khusus:
```
/user group add name=api-readonly policy=api,read,winbox,test
/user add name=dashboard_api password=password_kuat group=api-readonly
```

### 13.3 Firewall (Opsional tapi Direkomendasikan)

Batasi akses API hanya dari IP server dashboard:

```
/ip firewall filter add chain=input src-address=<IP_SERVER_DASHBOARD> dst-port=8728 protocol=tcp action=accept comment="Allow Dashboard API"
/ip firewall filter add chain=input dst-port=8728 protocol=tcp action=drop comment="Block other API access"
```

> Pastikan rule ini diletakkan **sebelum** rule drop/reject lainnya.

### 13.4 API-SSL (Opsional)

Jika ingin menggunakan API-SSL (port 8729):

1. Aktifkan service `api-ssl` di MikroTik
2. Ubah port di konfigurasi router di dashboard menjadi `8729`
3. Perlu modifikasi kode `mikrotik.py` untuk menambahkan SSL context pada `librouteros.connect()`

---

## 14. Troubleshooting

### Backend tidak bisa start

```bash
# Cek log
journalctl -u mikrotik-dashboard -f

# Cek apakah port 8000 sudah dipakai
ss -tlnp | grep 8000

# Test manual
cd /opt/mikrotik-dashboard/backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Tidak bisa konek ke MikroTik

```bash
# Test koneksi dari server ke MikroTik
# Pastikan port API terbuka
apt install -y netcat-openbsd
nc -zv <IP_MIKROTIK> 8728

# Cek apakah service API aktif di MikroTik
# Via Winbox: IP → Services → api harus enabled
```

### WebSocket disconnect terus-menerus

- Pastikan konfigurasi Nginx mengandung `proxy_read_timeout 86400;` pada block `/ws/`
- Pastikan `proxy_http_version 1.1;` dan header `Upgrade`/`Connection` sudah diset
- Cek apakah ada firewall/proxy lain yang memutus koneksi WebSocket

### Frontend blank / tidak load

```bash
# Pastikan frontend sudah di-build
ls /opt/mikrotik-dashboard/frontend/dist/

# Jika kosong, build ulang
cd /opt/mikrotik-dashboard/frontend
npm ci && npm run build

# Cek config Nginx
nginx -t

# Cek log Nginx
tail -f /var/log/nginx/error.log
```

### Database corrupt / reset

```bash
rm /opt/mikrotik-dashboard/backend/data.db
systemctl restart mikrotik-dashboard
# Database baru akan dibuat otomatis dengan user admin/admin
```

---

**MIMO.SA - Mikrotik Monitoring System** | Dokumentasi v1.0
