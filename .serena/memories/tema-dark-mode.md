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

---

## 7. Standardisasi Bahasa Konsisten (100% ID & 100% EN)

### A. Masalah Sebelumnya
- Terdapat percampuran bahasa secara acak di UI (contoh: "PORT MATRIX & PHYSICAL LINK (29 INTERFACES DETECTED)" bercampur dengan "Sesuaikan Kapasitas", "Layar Penuh", "19 Up", "5 Down").
- Tombol pemilih bahasa `[ 🇮🇩 ID ]` / `[ 🇬🇧 EN ]` di header sebelumnya hanya mengubah state lokal tanpa menyinkronkan seluruh teks aplikasi.

### B. Solusi
1. **Centralized LanguageContext (`frontend/src/context/LanguageContext.jsx`)**:
   - Menyediakan kamus terjemahan lengkap (`translations.id` dan `translations.en`).
   - Menyimpan preferensi bahasa operator di `localStorage.getItem('language')`.
   - Mengontrol bahasa aplikasi secara terpusat dengan hook `useLanguage()`.
2. **Cakupan Terjemahan**:
   - **Header & Sidebar**: Judul aplikasi, menu navigasi, pemilihan router, status role, tooltip, dan tombol logout.
   - **NOC Header**: Telemetri langsung, status uplink, uptime, alarm audio, layar penuh / keluar layar penuh.
   - **Row 1 Hardware**: Beban CPU, RAM, tabel Conntrack, sewa IP DHCP, suhu sistem, penyimpanan disk.
   - **Row 2 Port Matrix**: Matriks port, jumlah antarmuka terdeteksi, status Aktif/Mati, paket dibuang, dan galat paket.
   - **Row 3 Throughput & DNS**: Throughput antarmuka RX/TX, tooltip grafik, domain teratas, metode cache DNS.
   - **Row 4 Talkers & Watchlist**: Konsumen bandwidth teratas, pengawasan galat fisik, kondisi tautan bersih.
   - **Row 5 Incident Stream**: Aliran insiden sistem, filter tingkat keparahan (Semua, Kritis, Galat, Peringatan), dan status tanpa insiden.
   - **Modals**: Modal pengaturan kapasitas ISP dan Modal inspeksi port (PortDetailModal).
3. **Kaidah Istilah**:
   - Jika mode **ID (Bahasa Indonesia)** aktif: 100% kosakata menggunakan Bahasa Indonesia baku jaringan.
   - Jika mode **EN (English)** aktif: 100% kosakata menggunakan Bahasa Inggris murni.
   - Istilah teknis RouterOS (seperti nama interface `ether1`, `sfp1`, `bps`, `Mbps`, `PPPoE`, `DHCP`, `DNS`, alamat IP & MAC) tetap presisi sesuai spesifikasi teknis jaringan.

---

## 8. Perbaikan Bug Background / Backdrop Pop-up (Modal Overlay)

### A. Akar Masalah
1. **Stacking Context Isolation**: Modal sebelumnya dirender secara in-tree di dalam elemen `<main>`. Karena elemen `<header>` (`sticky top-0 z-30`) dan `<Sidebar>` (`z-50`) berada pada konteks penumpukan (*stacking context*) sejajar atau di atas `<main>`, overlay `fixed inset-0 z-50` yang berada di dalam `<main>` tidak dapat menutupi header dan sidebar secara sempurna, sehingga meninggalkan celah/garis putih dan latar belakang yang tidak blur menyeluruh di sekeliling pop-up.
2. **Ketiadaan Scroll-Lock & Keydown Escape**: Halaman di balik modal masih bisa di-scroll saat modal terbuka, dan menekan tombol keyboard `Escape` tidak menutup modal.
3. **Kontras Backdrop Kasar**: Class `bg-black/40 backdrop-blur-sm` pada tema terang terlihat abu-abu kusam/washed-out, sementara pada tema gelap kurang solid.

### B. Solusi yang Diterapkan
1. **React Portal (`createPortal(..., document.body)`)**:
   - Seluruh modal dipindahkan keluar dari pohon DOM lokal dan di-mount langsung ke `document.body`.
   - Z-index dinaikkan menjadi `z-[100]` sehingga menjamin modal 100% berada di atas navbar, sidebar, toast, dan seluruh layer lainnya di semua ukuran layar dan mode fullscreen (kiosk).
2. **Backdrop Seimbang & Halus**:
   - Overlay backdrop menggunakan `fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity`.
   - Menghasilkan efek blur modern (*frosted glass*) dengan kontras seimbang di tema Terang maupun Gelap tanpa menyilaukan mata atau terlihat belang.
3. **Interaktivitas Lengkap**:
   - **Click Outside**: Mengklik area backdrop langsung menutup pop-up modal.
   - **Escape Key Listener**: Menekan tombol `Escape` pada keyboard otomatis menutup modal.
   - **Body Scroll Lock**: Saat modal aktif, `document.body.style.overflow = 'hidden'` otomatis dipasang dan dipulihkan kembali saat modal ditutup.
4. **Halaman yang Ditangani**:
   - `frontend/src/pages/NocDashboard.jsx` (`PortDetailModal`, `showCapModal`)
   - `frontend/src/pages/PppoeMonitor.jsx` (`UserTrafficModal`)
   - `frontend/src/pages/HotspotMonitor.jsx` (`UserTrafficModal`)
   - `frontend/src/pages/ConfigPage.jsx` (`RouterFormModal`, `DeleteConfirmModal`)

