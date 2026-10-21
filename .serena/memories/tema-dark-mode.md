# Arsitektur & Dokumentasi Sistem Tema (Dark Mode, Light Mode, System)

## 1. Ringkasan Fitur
Implementasi sistem tema menyeluruh pada dashboard Mikrotik yang mendukung:
1. **Light Mode**: Tampilan terang dengan palette slate bersih.
2. **Dark Mode**: Tampilan gelap dengan palette slate gelap (`dark:bg-slate-900`, `dark:bg-slate-950`, `dark:border-slate-800`).
3. **System Mode**: Otomatis mengikuti preferensi sistem operasi (`prefers-color-scheme`) pengguna secara real-time.
4. **Language Indicator**: Tombol/badge bahasa `[ 🇮🇩 ID ]` berdampingan dengan tombol tema pada header navigasi.
5. **Anti-FOUC (Flash of Unstyled Content)**: Tidak ada kedipan putih saat memuat halaman dalam mode gelap.

---

## 2. Arsitektur Teknis

### A. Konfigurasi Tailwind CSS
- File: `frontend/tailwind.config.js`
- Konfigurasi: Ditambahkan properti `darkMode: 'class'`.
- Menjadikan class `dark:` aktif setiap kali elemen `<html class="dark">` memiliki class `dark`.

### B. Anti-FOUC Script di `<head>`
- File: `frontend/index.html`
- Script synchronous dieksekusi sebelum DOM selesai dirender untuk mengecek `localStorage.getItem('theme')` atau query `prefers-color-scheme: dark`. Jika dark, langsung menambahkan class `dark` ke `document.documentElement`.
- Body styling: `class="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-screen"`.

### C. State Management (`ThemeContext`)
- File: `frontend/src/context/ThemeContext.jsx`
- Hook: `useTheme()`
- State:
  - `theme`: `'light' | 'dark' | 'system'` (tersimpan permanen di `localStorage.getItem('theme')`, default: `'system'`).
  - `resolvedTheme`: `'light' | 'dark'` (hasil evaluasi aktual).
  - `setTheme(mode)`: Mengubah tema dan memperbarui `localStorage`.
- Listener: Memasang event listener ke `window.matchMedia('(prefers-color-scheme: dark)')` saat mode `'system'` aktif, sehingga tema langsung berubah otomatis ketika tema OS berganti.

### D. Komponen Kontrol Header (`ThemeSelector`)
- File: `frontend/src/components/ThemeSelector.jsx`
- Sesuai dengan referensi UI screenshot pengguna:
  - **Badge Bahasa**: `[ 🇮🇩 ID ]` (dapat ditoggle ID/EN).
  - **Tombol Ikon Tema**: Menampilkan ikon dinamis (`Sun` untuk light, `Moon` untuk dark, `Monitor` untuk system).
  - **Dropdown Card**: Floating menu dengan pilihan:
    - `Light` (dengan ikon `Sun`)
    - `Dark` (dengan ikon `Moon`)
    - `System` (dengan ikon `Monitor`)
    - Tanda centang (`Check`) pada opsi yang sedang aktif.
  - **Auto Close**: Menutup otomatis saat klik di luar area dropdown (`mousedown` event listener).

---

## 3. Integrasi Komponen & Halaman

| File | Komponen / Halaman | Perubahan |
|------|--------------------|-----------|
| `frontend/src/App.jsx` | Root App | Membungkus routing dengan `<ThemeProvider>` |
| `frontend/src/layouts/AppLayout.jsx` | Layout Utama | Menambahkan top navbar sticky dengan `ThemeSelector` di kanan atas, background blur adaptif dark/light |
| `frontend/src/layouts/Sidebar.jsx` | Navigasi Samping | Dukungan dark mode penuh untuk brand, router selector dropdown, link menu navigasi, dan footer user |
| `frontend/src/pages/LoginPage.jsx` | Halaman Login | Floating header dengan `ThemeSelector`, dark mode form card dan input |
| `frontend/src/pages/RegisterPage.jsx` | Halaman Registrasi | Floating header dengan `ThemeSelector`, dark mode form card dan input |
| `frontend/src/pages/NocDashboard.jsx` | NOC Dashboard | Dark mode untuk bar utilisasi ISP, live incident log, latency matrix, port detail inspector, audio alarm controls |
| `frontend/src/pages/DeviceMonitor.jsx` | Device Monitor | Dark mode untuk info cells, health gauges, system telemetry cards |
| `frontend/src/pages/InterfaceTraffic.jsx` | Traffic Interface | Dark mode untuk stat cards, Recharts tooltip, interfaces data table |
| `frontend/src/pages/HotspotMonitor.jsx` | Hotspot Monitor | Dark mode untuk stat cards, search filters, active users table, modal user traffic |
| `frontend/src/pages/PppoeMonitor.jsx` | PPPoE Monitor | Dark mode untuk active sessions table, bandwidth cards, user traffic inspector |
| `frontend/src/pages/AdminLogs.jsx` | Admin Audit Logs | Dark mode untuk filter inputs, audit log table, status badges |
| `frontend/src/pages/ConfigPage.jsx` | Konfigurasi Router | Dark mode untuk router cards, form modal (tambah/edit), delete confirm modal, empty state |

---

## 4. Cara Penggunaan untuk Developer Selanjutnya
Untuk menggunakan state tema di komponen baru:
```jsx
import { useTheme } from '../context/ThemeContext'

export default function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  // theme = 'light' | 'dark' | 'system'
  // resolvedTheme = 'light' | 'dark'
  // setTheme('dark')
  
  return (
    <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
      Konten
    </div>
  )
}
```

---

---

## 5. Verifikasi & Build
- `npm run build` dijalankan pada folder `frontend/` dan berhasil tanpa error (`exit code 0`).

---

## 6. Penyesuaian Kontras Warna (Balanced Contrast) & Istilah Kiosk Mode

### A. Masalah Kontras Sebelumnya
1. **Port Matrix (Status Down)**: Sebelumnya port down di-hardcode dengan `bg-slate-100/80` tanpa class dark mode. Pada tema gelap, port down muncul sebagai kotak putih terang yang menyilaukan dan kontrasnya terlalu tajam.
2. **Port Matrix (Status Up)**: Di-hardcode dengan `bg-slate-900`. Pada tema terang, port up muncul sebagai kotak hitam pekat yang kontrasnya kasar.
3. **NOC Header**: Di-hardcode dengan `bg-slate-900 text-white`. Pada tema terang, header menjadi blok hitam pekat yang tidak menyatu dengan sisa dashboard.
4. **Grafik Recharts**: Garis grid (`CartesianGrid`) dan popup `Tooltip` tadinya di-hardcode satu warna sehingga tidak adaptif.

### B. Solusi Kontras Halus & Seimbang
- **Port Matrix**:
  - Mode Dark: Port Up menggunakan `dark:bg-slate-800/70` dengan LED hijau pulsing halus; Port Down menggunakan `dark:bg-slate-900/40` (gelap lembut, tidak silau putih).
  - Mode Light: Port Up menggunakan `bg-white border-slate-200` (bersih dan terang); Port Down menggunakan `bg-slate-50/70` (abu-abu lembut).
- **NOC Header**: Dibuat responsif penuh (`bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800`).
- **Grafik Recharts**: `stroke` grid dan latar belakang `Tooltip` sekarang membaca `resolvedTheme` secara dinamis.

### C. Penjelasan & Penerjemahan Istilah "Kiosk Mode"
- **Arti Kiosk Mode**: Dalam dunia IT / NOC, *Kiosk Mode* merujuk pada mode tampilan penuh layar (Fullscreen) yang menonaktifkan/menyembunyikan navigasi browser dan header OS, sehingga dashboard dapat dipajang mandiri 24/7 di monitor NOC atau TV dinding (*wall display*).
- **Label Tombol**: Diperbarui menjadi **"Layar Penuh"** (saat normal) dan **"Keluar Layar Penuh"** (saat fullscreen aktif), dengan tooltip: `"Mode Kiosk / Tampilan Layar Penuh (NOC TV Wall)"`.
