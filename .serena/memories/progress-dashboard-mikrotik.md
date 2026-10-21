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
- **Admin User Management** — endpoint CRUD user di `/api/admin/users` (`backend/app/routes.py`, `backend/app/auth.py`, `backend/app/database.py`).
- **Audit Logs** — logging audit trail lengkap untuk mutasi data di PostgreSQL (`/api/admin/logs`).
- **Migrasi ke PostgreSQL** — dari SQLite ke PostgreSQL, shared DB setup (`docker/postgres/init-databases.sh`).

### 2. DevOps, CI/CD & Security
- **CI/CD Auto-Deploy** — GitHub Actions workflow auto-deploy untuk branch `dev` (`.github/workflows/deploy-dev.yml`):
  - Trigger saat `git push origin dev`
  - SSH ke VM dev di `/opt/mikrotik-dev`
  - Menjalankan `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`
- **Security** — credentials terenkapsulasi penuh di `.env`, proteksi route admin, JWT authentication.
- **Dev Stack** — shared PostgreSQL database dari environment production.

### 3. Sistem Tema (Dark Mode, Light Mode, System) & UI Header Controls
- **Theme Support (Light / Dark / System)**:
  - `frontend/tailwind.config.js`: Ditambahkan konfigurasi `darkMode: 'class'`.
  - `frontend/index.html`: Anti-FOUC inline script di `<head>` untuk deteksi `localStorage.getItem('theme')` atau `window.matchMedia('(prefers-color-scheme: dark)')` sebelum render DOM.
  - `frontend/src/index.css`: Styling global `html.dark { color-scheme: dark; }` dan scrollbar.
  - `frontend/src/context/ThemeContext.jsx`: Context provider `ThemeContext` yang mengelola `theme` (`light`, `dark`, `system`), `resolvedTheme` (`light`/`dark`), auto listener perubahan OS scheme, dan sinkronisasi ke `document.documentElement.classList`.
  - `frontend/src/components/ThemeSelector.jsx`:
    - Komponen dropdown navbar sesuai referensi UI:
      - Badge bahasa `[ 🇮🇩 ID ]` (dapat ditoggle ID/EN).
      - Tombol ikon tema (`Sun` / `Moon` / `Monitor`) dengan ring halus.
      - Dropdown menu mengambang (floating card) dengan opsi:
        - `Light` (ikon Sun)
        - `Dark` (ikon Moon)
        - `System` (ikon Monitor)
        - Indikator centang aktif (`Check`).
        - Fitur klik di luar untuk menutup (outside click detection).
  - Integrasi Navbar & Layout:
    - `frontend/src/layouts/AppLayout.jsx`: Top navbar sticky dengan ThemeSelector di kanan atas, border bawah adaptif dark/light, dan latar belakang blur.
    - `frontend/src/layouts/Sidebar.jsx`: Full dark mode palette untuk navigasi, logo brand, router dropdown selector, dan profil user.
    - `frontend/src/pages/LoginPage.jsx` & `RegisterPage.jsx`: Header floating dengan ThemeSelector dan card auth adaptif gelap/terang.
  - Adaptasi Seluruh Halaman Dashboard ke Dark Mode:
    - `NocDashboard.jsx` (Gauges, incident stream, multi-ping table, ISP saturation bar & modal, port inspector).
    - `DeviceMonitor.jsx` (System metrics, health gauge, resource cards).
    - `InterfaceTraffic.jsx` (Stat cards, traffic chart, interfaces table).
    - `HotspotMonitor.jsx` (Live users table, detail traffic modal, filters).
    - `PppoeMonitor.jsx` (Active sessions table, bandwidth stats, user traffic modal).
    - `AdminLogs.jsx` (Audit log data table, filter inputs, status badges).
    - `ConfigPage.jsx` (Router card list, router form modal, delete confirmation modal, empty state).

### 4. File yang Diubah (Commit Terakhir di dev)
| Commit | Pesan | Deskripsi |
|--------|-------|-----------|
| `e03edfd` | `fix(theme): balance port matrix contrast and localize kiosk mode button` | Kontras halus port matrix (down port gelap, up port terang), NOC header responsif, Recharts adaptive theme, tombol Layar Penuh |
| `da90eb0` | `feat(theme): add dark, light, and system theme switcher with auto-sync and memories` | Sistem tema (Light, Dark, System), navbar theme selector, bahasa, dan dark mode semua halaman |
| `a2f42f6` | `feat(layout): add collapsible desktop sidebar with icon-only mode and persistent state` | Sidebar collapsible (toggle buka/tutup, mode icon-only 64px, tooltip, auto-persist) |
| `834d749` | `feat(noc): add incident logs, multi-ping matrix, conntrack meters, saturation alert, and audio alarm` | Implementasi 5 fitur NOC utama di backend & frontend |
| `b188506` | `feat(noc): add interface selector dropdown for single-interface throughput chart` | Dropdown filter interface tunggal pada grafik throughput |
| `aad3b29` | `fix(noc): wire live port traffic and negotiated speed in modal` | Sambungkan live WS traffic dan duplex/speed pada modal port |
| `cb5ee6f` | `fix(noc): map pppoe client bytes from interfaces and queues` | Fix pemetaan byte PPPoE aktif dari dynamic interface & simple queue |
| `3db4049` | `feat(noc): add noc dashboard with telemetry and top domains` | Struktur dasar NOC dashboard, port grid, dan DNS top domains |

## Repository
- **GitHub**: https://github.com/aryusufn-new/mikrotik-dashboard.git
- **Branch aktif**: `dev`

## Struktur Directory Lengkap
```
mikrotik-dashboard/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── routes.py            # API routes (termasuk NOC endpoints)
│   │   ├── auth.py              # Auth decorator & admin check
│   │   ├── database.py          # DB models & functions (PostgreSQL)
│   │   ├── mikrotik.py          # RouterOS API integration & NOC telemetry
│   │   ├── config.py            # App config
│   │   └── ws.py                # WebSocket handlers
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
│   │   │   └── RouterContext.jsx
│   │   ├── pages/
│   │   │   ├── NocDashboard.jsx       # Dedicated NOC Monitoring View
│   │   │   ├── DeviceMonitor.jsx
│   │   │   ├── NetworkTopology.jsx    # Realtime topology + traffic
│   │   │   ├── InterfaceTraffic.jsx
│   │   │   ├── HotspotMonitor.jsx
│   │   │   ├── PppoeMonitor.jsx
│   │   │   ├── AdminLogs.jsx
│   │   │   ├── ConfigPage.jsx
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
├── docker/
│   └── postgres/
│       └── init-databases.sh
├── .github/
│   └── workflows/
│       └── deploy-dev.yml           # CI/CD auto-deploy dev branch
├── docker-compose.yml
├── deploy.sh
└── README.md
```

## Status Saat Ini (21 Oktober 2026)
- **Branch**: `dev` sudah sync dengan remote `origin dev` (commit `da90eb0`).
- **Deployment**: Pipeline GitHub Actions dev sukses ter-deploy (`success`) di VM dev:
  - Container `mikrotik-dev-backend`: Up
  - Container `mikrotik-dev-frontend`: Up (port 8080)
  - Container `mikrotik-admin-frontend`: Up (port 8081)
- **Next Steps**:
  - [x] Implementasi 5 fitur inti NOC Dashboard
  - [x] Auto-deploy dan verifikasi di server VM
  - [x] Implementasi sistem tema (Light, Dark, System) & header dropdown
  - [x] Deploy dev branch dan verifikasi container
  - [ ] Pengujian langsung performa real-time dan feedback audio alarm di browser operator
  - [ ] Persiapan pull request / merge `dev` ke `main`