# Mikrotik Monitoring Dashboard

Dashboard sederhana untuk memantau RouterOS Mikrotik:

- Info board: Board Name, Version, Memory, CPU Load, Uptime
- Traffic realtime per interface (TX / RX) via WebSocket
- Statistik PPP Secret: Total / Online / Offline

Stack: **FastAPI + librouteros** (backend) & **React + Vite + Tailwind + Recharts** (frontend).

## Prasyarat

- Python 3.10+
- Node.js 18+
- RouterOS dengan service **API** aktif (default port `8728`)
  - Aktifkan via Winbox: `IP > Services > api`
  - Pastikan user yang dipakai punya policy minimal `api, read`

## 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env -> isi MIKROTIK_HOST, MIKROTIK_USER, MIKROTIK_PASSWORD
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Endpoint:
- `GET  /api/system/resource`
- `GET  /api/interfaces`
- `GET  /api/ppp/stats`
- `WS   /ws/traffic?iface=ether1`

## 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # opsional, default sudah menunjuk ke localhost:8000
npm run dev
```

Buka <http://localhost:5173>.

## Konfigurasi

`backend/.env`:

```env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=secret
MIKROTIK_PORT=8728
CORS_ORIGINS=http://localhost:5173
```

`frontend/.env`:

```env
VITE_API_BASE=http://localhost:8000
VITE_WS_BASE=ws://localhost:8000
```

## Catatan

- WebSocket `/ws/traffic` melakukan polling `/interface/monitor-traffic once=` setiap 1 detik per koneksi klien. Untuk skala besar, pertimbangkan pooling koneksi RouterOS atau menggunakan satu task background yang dibroadcast ke seluruh klien.
- Jika menggunakan API-SSL (`8729`), ubah `MIKROTIK_PORT` dan sesuaikan koneksi `librouteros` (perlu konteks SSL).
- Pastikan firewall di sisi Mikrotik mengizinkan akses port API dari host yang menjalankan backend.

## Struktur

```
mikrotik-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── mikrotik.py
│   │   ├── routes.py
│   │   └── ws.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── hooks/useTrafficWS.js
    │   ├── components/{TrafficPanel,BoardInfo,SecretsCards}.jsx
    │   └── utils/format.js
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```
