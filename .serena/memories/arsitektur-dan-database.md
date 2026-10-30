# Arsitektur & Database Sistem MikroTik Dashboard

## 1. Arsitektur Infrastruktur & Jaringan

```mermaid
graph TD
    Client[Client / Browser<br/>Operator NOC] -- HTTPS --> CF[Cloudflare CDN & Edge]
    CF -- Cloudflare Tunnel<br/>(cloudflared) --> VM[Home Server VM<br/>(Ubuntu)]
    
    subgraph VM [Host Server VM]
        Nginx[Nginx Reverse Proxy<br/>Port 80 / 8080]
        
        subgraph Docker [Docker Containers (Dev/Prod Network)]
            Frontend[mikrotik-frontend<br/>React 18 + Vite + Tailwind]
            Backend[mikrotik-backend<br/>FastAPI + Uvicorn + librouteros]
            Database[(mikrotik-db<br/>PostgreSQL 16 Alpine)]
        end
        
        Nginx --> Frontend
        Nginx -->|/api/* & /ws/*| Backend
        Backend --> Database
    end

    Backend -->|RouterOS API :8728| MikroTik[MikroTik Routers]
    Backend -->|FTP :21| MikroTik
    Backend -->|SNMP UDP :161| OLT[OLT Devices<br/>VSOL, C-Data, HSGQ]
```

### Komponen Utama:
1. **Cloudflare Tunnel (`cloudflared`)**:
   - Membuka akses publik terenkripsi TLS tanpa perlu port-forwarding atau membuka IP publik server ke internet.
   - WAF, DDoS protection, dan sertifikat SSL/TLS otomatis dikelola oleh Cloudflare.
2. **Nginx Reverse Proxy**:
   - Mengarahkan traffic frontend static assets (`/`) dan reverse proxy API/WebSocket ke backend (`/api`, `/ws`).
   - Anti-caching headers khusus untuk file `index.html` guna memastikan klien selalu memuat bundle JS/CSS terbaru pasca auto-deploy.
3. **Backend (FastAPI)**:
   - FastAPI framework dengan Python 3.12.
   - Integrasi langsung ke RouterOS menggunakan `librouteros` (API Port 8728) dan FTP (Port 21).
   - Engine SNMP v2c independen (Pure Python via raw UDP socket & BER encoding) untuk query OLT.
   - Connection pool PostgreSQL via `psycopg2` (min 2, max 10 koneksi).
   - Background scheduler asynchronous untuk auto-backup.
4. **Frontend (React 18 + Vite)**:
   - React 18 SPA dengan Tailwind CSS & Lucide Icons.
   - Recharts untuk grafik real-time throughput & telemetri.
   - WebSocket hooks (`useTrafficWS`, dll.) untuk streaming data real-time dengan latensi rendah.
   - Multi-theme engine (Light, Dark, System) dengan anti-FOUC script.
   - Centralized i18n (`LanguageContext`) mendukung penuh Bahasa Indonesia & English.

---

## 2. Struktur Database PostgreSQL (`mikrotik`)

1. **`users`**: Akun operator/administrator (autentikasi JWT, role `admin` / `user`).
2. **`router_configs`**: Konfigurasi koneksi router MikroTik (nama, host, API port, username, password terenkripsi/aman).
3. **`olts`**: Data master OLT (brand, host, SNMP port/community, telnet port/user/pass, jumlah port PON).
4. **`customers`**: Data pelanggan FTTH, pemetaan port PON & ONU ID, redaman optik (RX/TX/Distance), dan link akun PPPoE MikroTik.
5. **`router_backups`**: Riwayat file backup router (tipe `.rsc` / `.backup`, path lokal, ukuran, status).
6. **`backup_schedules`**: Konfigurasi auto-backup terjadwal per router (frekuensi, hari, jam, tipe, retensi hari).
7. **`audit_logs`**: Logging jejak audit semua aktivitas mutasi data dan aksi konfigurasi.

---

## 3. CI/CD & Deployment Workflow

- **Branch Aktif**: `dev` (untuk development & testing VM) dan `main` (untuk production).
- **GitHub Actions Auto-Deploy** (`.github/workflows/deploy-dev.yml`):
  - Terpicu secara otomatis saat `git push origin dev`.
  - Terhubung via SSH ke server VM (`/opt/mikrotik-dev`).
  - Menjalankan `git fetch origin dev` dan `git reset --hard origin/dev` untuk mencegah konflik merge di server.
  - Menjalankan `docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache frontend` dan `docker compose up -d --force-recreate`.
  - Verifikasi otomatis container `mikrotik-dev-backend` dan `mikrotik-dev-frontend`.
