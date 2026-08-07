# MIMO.SA - Mikrotik Monitoring Dashboard

Dashboard web real-time untuk monitoring perangkat MikroTik RouterOS. Mendukung multi-router, multi-user, dengan data langsung dari RouterOS API.

**Demo:** https://mimosa.ayngroup.id

---

## Fitur

| Fitur | Deskripsi |
|-------|-----------|
| **Device Monitor** | Info board, CPU load, RAM, Disk usage, Uptime (real-time gauge) |
| **Interface Traffic** | Traffic RX/TX semua interface per detik via WebSocket |
| **PPPoE Monitor** | Statistik total/online/offline, traffic per-user PPPoE |
| **Hotspot Monitor** | Statistik total/online/offline, traffic per-user Hotspot |
| **Multi-Router** | Satu akun bisa monitoring banyak router, switch dari sidebar |
| **Config Page** | CRUD router via UI, test koneksi langsung dari dashboard |
| **Autentikasi** | JWT login, password di-hash bcrypt |

---

## Tech Stack

**Backend:** Python 3.12 · FastAPI · Gunicorn · librouteros · PostgreSQL 16 · psycopg2 · bcrypt

**Frontend:** React 18 · Vite 5 · Tailwind CSS 3 · Recharts · Axios · React Router DOM 6

**Infra:** Docker Compose · Nginx (reverse proxy) · PostgreSQL (database)

---

## Struktur Direktori

```
mikrotik-dashboard/
├── docker-compose.yml          # Main compose (port 80)
├── deploy.sh                   # Deploy script
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI entry point
│       ├── config.py           # Config resolution
│       ├── database.py         # PostgreSQL schema + CRUD
│       ├── auth.py             # JWT authentication
│       ├── mikrotik.py         # RouterOS API wrapper
│       ├── routes.py           # REST API endpoints
│       ├── ws.py               # WebSocket endpoints
│       └── gunicorn.conf.py    # Gunicorn config
├── frontend/
│   ├── Dockerfile              # Multi-stage: Node build → Nginx
│   ├── nginx.conf              # Reverse proxy config
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── pages/              # DeviceMonitor, InterfaceTraffic, PppoeMonitor, HotspotMonitor, ConfigPage, LoginPage
│   │   ├── components/         # Gauge, BoardInfo, ServiceStatsCards
│   │   ├── hooks/              # useTrafficWS, useInterfacesWS, usePppoeTrafficWS, useHotspotTrafficWS
│   │   └── context/            # AuthContext, RouterContext
│   └── dist/                   # Build output (served by Nginx)
└── README.md
```

---

## Database Schema

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE router_configs (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(id),
    name     TEXT NOT NULL DEFAULT 'Router 1',
    host     TEXT NOT NULL DEFAULT '192.168.88.1',
    username TEXT NOT NULL DEFAULT 'admin',
    password TEXT NOT NULL DEFAULT '',
    port     INTEGER NOT NULL DEFAULT 8728
);
```

Default user: **admin / admin** (role: admin, dibuat otomatis saat startup).

---

## Arsitektur

```
Browser ←── HTTP/WS ──→ Nginx (port 80) ←──→ FastAPI Backend (Gunicorn, internal)
                                                    ↕
                                          PostgreSQL Database
                                                    ↕
                                          MikroTik RouterOS API (port 8728)
```

---

## Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `DATABASE_URL` | `postgresql://mikrotik:mikrotik_secret@db:5432/mikrotik` | Koneksi PostgreSQL |
| `DB_PASSWORD` | `mikrotik_secret` | Password PostgreSQL |
| `JWT_SECRET` | `supersecretkey123changeme` | Secret key JWT token |
| `PGADMIN_EMAIL` | `admin@mimosa.com` | Email login pgAdmin |
| `PGADMIN_PASSWORD` | `admin123` | Password login pgAdmin |

---

## Deploy dengan Docker

### 1. Clone Repository

```bash
git clone https://github.com/aryusufn-new/mikrotik-dashboard.git
cd mikrotik-dashboard
```

### 2. Jalankan Main (Port 80)

```bash
git checkout main
docker compose -p mikrotik-main up -d --build
```

Akses: `http://<IP_SERVER>`

### 3. Jalankan Dev (Port 8080)

Dev branch jalan bersama main dengan nama container & port berbeda:

```bash
git checkout dev
sed -i 's/mikrotik-backend/mikrotik-dev-backend/' docker-compose.yml
sed -i 's/mikrotik-frontend/mikrotik-dev-frontend/' docker-compose.yml
sed -i 's/mikrotik-db/mikrotik-dev-db/' docker-compose.yml
sed -i 's/mikrotik-pgadmin/mikrotik-dev-pgadmin/' docker-compose.yml
sed -i 's/"80:80"/"8080:80"/' docker-compose.yml
sed -i 's/"5050:80"/"5051:80"/' docker-compose.yml
docker compose -p mikrotik-dev up -d --build
git checkout docker-compose.yml  # kembalikan file
```

Akses: `http://<IP_SERVER>:8080`

### 4. Akses pgAdmin

| | Main | Dev |
|---|---|---|
| URL | `http://<IP>:5050` | `http://<IP>:5051` |
| Email | `admin@mimosa.com` | `admin@mimosa.com` |
| Password | `admin123` | `admin123` |
| DB Host | `mikrotik-db` | `mikrotik-dev-db` |
| DB User | `mikrotik` | `mikrotik` |
| DB Password | `mikrotik_secret` | `mikrotik_secret` |
| DB Name | `mikrotik` | `mikrotik` |

### 5. Login Dashboard

| | Main | Dev |
|---|---|---|
| URL | `http://<IP>` | `http://<IP>:8080` |
| Username | `admin` | `admin` |
| Password | `admin` | `admin` |

> Segera ganti password default setelah login pertama.

---

## Update / Pull Terbaru

### Main

```bash
cd /path/to/mikrotik-dashboard
git checkout main
git pull
docker compose -p mikrotik-main up -d --build
```

### Dev

```bash
cd /path/to/mikrotik-dashboard
git checkout dev
git pull
sed -i 's/mikrotik-backend/mikrotik-dev-backend/' docker-compose.yml
sed -i 's/mikrotik-frontend/mikrotik-dev-frontend/' docker-compose.yml
sed -i 's/mikrotik-db/mikrotik-dev-db/' docker-compose.yml
sed -i 's/mikrotik-pgadmin/mikrotik-dev-pgadmin/' docker-compose.yml
sed -i 's/"80:80"/"8080:80"/' docker-compose.yml
sed -i 's/"5050:80"/"5051:80"/' docker-compose.yml
docker compose -p mikrotik-dev up -d --build
git checkout docker-compose.yml
```

---

## Port Mapping

| Port | Service | Keterangan |
|------|---------|------------|
| 80 | Main Frontend | Dashboard utama |
| 8080 | Dev Frontend | Dashboard development |
| 5050 | Main pgAdmin | Database admin main |
| 5051 | Dev pgAdmin | Database admin dev |
| 5432 | PostgreSQL | Internal Docker network |

> Backend (8000) dan PostgreSQL (5432) tidak di-expose ke luar, hanya diakses melalui Docker network internal.

---

## Konfigurasi MikroTik Router

Sebelum monitoring, konfigurasi MikroTik agar bisa diakses dari server:

### 1. Aktifkan Service API

Via Winbox:
```
IP → Services → api → Enable (port 8728)
```

Via Terminal RouterOS:
```
/ip service enable api
/ip service set api port=8728
```

### 2. Buat User API (Rekomendasi)

Jangan pakai admin utama. Buat user khusus:
```
/user group add name=api-readonly policy=api,read,winbox,test
/user add name=dashboard_api password=password_kuat group=api-readonly
```

### 3. Firewall (Opsional)

Batas akses hanya dari IP server dashboard:
```
/ip firewall filter add chain=input src-address=<IP_SERVER> dst-port=8728 protocol=tcp action=accept comment="Allow Dashboard"
/ip firewall filter add chain=input dst-port=8728 protocol=tcp action=drop comment="Block other API"
```

### 4. Tambah Router di Dashboard

1. Login ke dashboard
2. Buka halaman **Config** (sidebar)
3. Klik **Add Router**
4. Isi: nama, host, username, password, port
5. Klik **Test Connection** untuk verifikasi
6. Pilih router aktif

---

## API Endpoints

Semua endpoint monitoring memerlukan header `Authorization: Bearer <token>` dan `X-Router-Id: <id>`.

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Info user saat ini |

### Router
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/routers` | List semua router |
| POST | `/api/routers` | Tambah router |
| GET | `/api/routers/{id}` | Detail router |
| PUT | `/api/routers/{id}` | Update router |
| DELETE | `/api/routers/{id}` | Hapus router |
| POST | `/api/routers/{id}/test` | Test koneksi |

### System & Interfaces
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/system/resource` | Info device (CPU, RAM, Disk) |
| GET | `/api/interfaces` | List semua interface |
| GET | `/api/interfaces/summary` | Summary status interface |

### PPP
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/ppp/stats` | Statistik PPP |
| GET | `/api/ppp/active` | Sesi PPP aktif |
| GET | `/api/ppp/secrets` | Semua PPP secret |

### Hotspot
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/hotspot/stats` | Statistik Hotspot |
| GET | `/api/hotspot/active` | Sesi Hotspot aktif |
| GET | `/api/hotspot/users` | Semua Hotspot user |

### WebSocket
| Endpoint | Interval | Deskripsi |
|----------|----------|-----------|
| `/ws/interfaces-traffic` | 1 detik | Traffic semua interface |
| `/ws/ppp-traffic` | 2 detik | Traffic per-user PPPoE |
| `/ws/hotspot-traffic` | 2 detik | Traffic per-user Hotspot |

---

## Cek Data via Terminal

### Lihat semua user terdaftar

```bash
docker exec mikrotik-db psql -U mikrotik -d mikrotik -c "SELECT id, username, role FROM users ORDER BY id;"
```

### Hitung total user

```bash
docker exec mikrotik-db psql -U mikrotik -d mikrotik -c "SELECT COUNT(*) FROM users;"
```

### Lihat semua router config

```bash
docker exec mikrotik-db psql -U mikrotik -d mikrotik -c "SELECT rc.id, rc.name, rc.host, u.username FROM router_configs rc JOIN users u ON rc.user_id = u.id;"
```

### Reset password user

```bash
docker exec -i mikrotik-db psql -U mikrotik -d mikrotik <<'SQL'
UPDATE users SET hashed_password = '$(python3 -c "from passlib.context import CryptContext; print(CryptContext(schemes=["bcrypt"]).hash("admin"))")' WHERE username = 'admin';
SQL
```

Atau dari dalam container backend:
```bash
docker exec -it mikrotik-main-backend python -c "
from passlib.context import CryptContext
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd.hash('password_baru'))
"
```

Lalu update manual:
```bash
docker exec mikrotik-db psql -U mikrotik -d mikrotik -c "UPDATE users SET hashed_password='<HASH_DARI_ATAS>' WHERE username='admin';"
```

---

## Container Management

### Cek status container

```bash
docker ps
```

### Lihat log

```bash
docker logs -f mikrotik-backend        # Main backend
docker logs -f mikrotik-frontend       # Main frontend
docker logs -f mikrotik-db             # PostgreSQL
docker logs -f mikrotik-pgadmin        # pgAdmin main
```

### Restart container

```bash
docker restart mikrotik-backend        # Restart backend main
docker restart mikrotik-frontend       # Restart frontend main
```

### Stop & Hapus semua container

```bash
# Main
docker compose -p mikrotik-main down

# Dev
docker compose -p mikrotik-dev down

# Hapus volume database (HATI-HATI: data hilang)
docker compose -p mikrotik-main down -v
docker compose -p mikrotik-dev down -v
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| pgAdmin restart terus | Email default invalid. Pastikan `PGADMIN_EMAIL` domain valid (bukan `.local`) |
| Container name conflict | Hapus container lama: `docker rm -f <container_name>` |
| Port sudah dipakai | Cek: `ss -tlnp \| grep <port>`, lalu stop service yang menggunakan port tersebut |
| Tidak bisa akses MikroTik | Pastikan API service aktif (port 8728) dan firewall mengizinkan |
| Frontend blank | Cek log frontend: `docker logs mikrotik-frontend` |
| Backend error | Cek log: `docker logs mikrotik-backend` |
| Database tidak bisa connect | Pastikan container `db` running: `docker ps \| grep db` |
| Git branch tidak ada `.git` | Clone ulang repo karena folder bukan git repository |

### Spesifikasi Minimum

| Resource | Minimum |
|----------|---------|
| CPU | 2 cores |
| RAM | 1 GB |
| Disk | 10 GB |
| OS | Linux (Debian/Ubuntu) |

---

## License

Private - MIMO.SA | Mikrotik Monitoring System
