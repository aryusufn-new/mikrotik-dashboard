# Rencana: mikrotik-admin-frontend

## Overview
Repo terpisah dari `mikrotik-dashboard` — khusus halaman admin untuk mengelola user.

## Fungsi
- CRUD user (list, create, edit, delete)
- Consume API `/api/admin/users` dari backend `mikrotik-dashboard`

## Backend (sudah ada)
- Endpoint: `/api/admin/users` di `mikrotik-dashboard` (`backend/app/routes.py`)
- Auth: decorator admin check (`backend/app/auth.py`)
- DB: PostgreSQL (`backend/app/database.py`)
- Repo: https://github.com/aryusufn-new/mikrotik-dashboard.git

## Status & Implementasi
- [x] Backend update (`mikrotik-dashboard` branch `dev`):
  - Kolom `register_ip` di tabel `users` (PostgreSQL)
  - Auto-migrasi via `init_db()`
  - Simpan IP client (`x-forwarded-for` / `request.client.host`) saat `/api/auth/register`
  - Return `register_ip` di `/api/admin/users`
- [x] Repo `mikrotik-admin-frontend` dibuat & di-commit di `/home/ariansyah/Pictures/YUSUF/project_individu/mikrotik-admin-frontend`
- [x] Fitur Admin Dashboard (`src/pages/DashboardPage.jsx`):
  - Card Stats: Total User, Pendaftar Hari Ini, Count Admin, Count User
  - Search & Filter: Username, IP address, Role filter
  - Tabel User: ID, Username, Role, Tanggal Daftar (formatted), Jam Daftar (formatted), IP Register (badge)
  - Modal Add User, Edit User (Role & Password), Delete User (dengan proteksi self-delete)
  - Login page khusus admin (role validation)
- [x] Build verified (`npm run build` sukses via Tailwind v4)

## Remaining Tasks
- [ ] Push commit repo `mikrotik-admin-frontend` ke GitHub (`git push -u origin main`)
- [ ] Push commit branch `dev` di `mikrotik-dashboard` (`git push origin dev`)