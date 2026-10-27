import React, { createContext, useContext, useState, useEffect } from 'react'

export const translations = {
  id: {
    // Header & Brand
    appSubtitle: 'MIMO.SA • Monitoring Sistem MikroTik',
    pilihBahasa: 'Pilih Bahasa',
    tema: 'Tema',
    temaTerang: 'Terang',
    temaGelap: 'Gelap',
    temaSistem: 'Sistem',

    // Navigasi & Sidebar
    navDashboard: 'Dashboard Perangkat',
    navNoc: 'Pusat Kontrol NOC',
    navTraffic: 'Traffic Interface',
    navTopology: 'Topologi Jaringan',
    navHotspot: 'Klien Hotspot',
    navPppoe: 'Klien PPPoE',
    navCustomers: 'Pelanggan FTTH & OLT',
    navLogs: 'Log Audit Sistem',
    navConfig: 'Konfigurasi Router',
    navBackups: 'Auto Backup & Arsip',
    roleAdmin: 'Administrator',
    roleOperator: 'Operator Jaringan',
    logout: 'Keluar',
    activeRouter: 'Router Aktif',
    clickToSwitch: 'Klik untuk ganti router',

    // NOC Command Center Header
    nocTitle: 'Pusat Kontrol NOC',
    liveTelemetry: 'TELEMETRI LANGSUNG',
    checkingUplink: 'Memeriksa uplink...',
    uptime: 'Waktu Aktif',
    alarmOn: 'Alarm Aktif',
    alarmMute: 'Senyap',
    alarmTitleOn: 'Alarm Suara Link Down: ON',
    alarmTitleOff: 'Alarm Suara Link Down: OFF',
    refreshData: 'Segarkan Data',
    layarPenuh: 'Layar Penuh',
    keluarLayarPenuh: 'Keluar Layar Penuh',
    kioskTooltip: 'Mode Kiosk / Tampilan Layar Penuh (NOC TV Wall)',
    noRouterTitle: 'Router Belum Dipilih',
    noRouterDesc: 'Pilih atau tambahkan router dari menu Konfigurasi',

    // Banner Saturasi Bandwidth
    saturationWarning: 'Peringatan Saturasi Tautan!',
    saturationCapacityUsed: 'Kapasitas Terpakai',
    saturationText1: 'Throughput antarmuka',
    saturationText2: 'mencapai',
    saturationText3: 'dari batas kapasitas ISP',
    adjustCapacity: 'Sesuaikan Kapasitas',

    // Row 1 Hardware
    cpuLoad: 'Beban CPU',
    cpuTotal: 'Total',
    cpuPerCore: 'Per Inti:',
    ramMemory: 'Memori RAM',
    conntrackTable: 'Tabel Conntrack',
    conntrackFirewall: 'Pelacakan Firewall',
    conntrackNormal: 'Normal',
    dhcpLeases: 'Sewa IP DHCP',
    dhcpActiveBound: 'Terikat aktif',
    dhcpPoolsDefined: 'pool terdefinisi',
    poolCapacityNormal: 'Kapasitas Pool Normal',
    temperature: 'Suhu Sistem',
    sensorThermal: 'Sensor Termal',
    optimal: 'Optimal',
    highTemp: 'Suhu Tinggi',
    storageDisk: 'Penyimpanan Disk',

    // Row 2 Port Matrix
    portMatrixTitle: 'Matriks Port & Tautan Fisik',
    interfacesDetected: 'antarmuka terdeteksi',
    portMatrixSubtitle: 'Panel visual status tautan port fisik, negosiasi kecepatan, galat paket, dan paket dibuang (klik port untuk inspeksi detail)',
    portUp: 'Aktif',
    portDown: 'Mati',
    portDrops: 'Dibuang',
    portErrors: 'Galat',
    portStatusDown: 'MATI',

    // Row 3 Traffic & DNS
    ifaceThroughputTitle: 'Throughput Antarmuka',
    ifaceThroughputSubtitle: 'Lalu lintas unduh (RX) & unggah (TX) langsung dari RouterOS',
    capLabel: 'Batas:',
    ifacePort: 'Port:',
    ifaceRunning: 'Aktif',
    ifaceDown: 'Mati',
    ifaceSpeed: 'Kecepatan:',
    cumulativeTotal: 'Total Akumulasi:',
    topDomainsTitle: '5 Domain / Web Teratas',
    topDomainsSubtitle: 'Domain tujuan yang paling sering diakses oleh klien di jaringan',
    dnsCacheBadge: 'Cache DNS',
    noDnsQueries: 'Belum ada kueri DNS tercatat',
    noDnsQueriesHelp: 'Pastikan klien menggunakan DNS RouterOS',
    dnsMethod: 'Metode: /ip dns cache',
    dnsUpdateFreq: 'Diperbarui setiap 5 detik',
    chartDownload: 'Unduh (RX)',
    chartUpload: 'Unggah (TX)',
    chartTime: 'Waktu:',

    // Row 4 Talkers & Watchlist
    topTalkersTitle: 'Konsumen Bandwidth Teratas',
    topTalkersSubtitle: 'Klien Hotspot & PPPoE yang paling aktif menggunakan bandwidth',
    noActiveClients: 'Belum ada klien aktif terdeteksi',
    activeSession: 'Sesi Aktif',
    watchlistTitle: 'Pengawasan Galat & Paket Dibuang',
    watchlistSubtitle: 'Kualitas Fisik Kabel & Port SFP',
    allLinksHealthy: 'Semua Tautan Antarmuka Bersih',
    allLinksHealthyDesc: '0 paket dibuang & 0 galat CRC pada seluruh port',

    // Row 5 Incident Logs
    incidentLogsTitle: 'Aliran Log Insiden & Sistem Langsung',
    incidentLogsSubtitle: 'Umpan log RouterOS waktu-nyata khusus insiden kritis, galat, dan peringatan sistem',
    eventsCount: 'kejadian',
    severityAll: 'Semua',
    severityCritical: 'Kritis',
    severityError: 'Galat',
    severityWarning: 'Peringatan',
    noIncidentsTitle: 'Tidak Ada Insiden Tercatat',
    noIncidentsDesc: 'Router berjalan bersih tanpa peringatan atau galat aktif',

    // Modals
    capacityModalTitle: 'Atur Batas Kapasitas Bandwidth ISP',
    subscriptionCapacity: 'Kapasitas Langganan (Mbps)',
    capacityPlaceholder: 'Contoh: 500',
    capacityModalHelp: 'Dashboard akan memicu alarm dan banner peringatan jika throughput antarmuka melebihi 85% dari batas ini.',
    btnBatal: 'Batal',
    btnSimpan: 'Simpan',
    btnTutup: 'Tutup',

    // Port Detail Modal
    portDetailTitle: 'Inspeksi Port',
    linkStatus: 'Status Tautan',
    linkRunning: 'TERHUBUNG (Aktif)',
    linkDisconnected: 'TERPUTUS (Mati)',
    negotiatedSpeed: 'Kecepatan Negosiasi',
    macAddress: 'Alamat MAC',
    currentLiveTraffic: 'Lalu Lintas Langsung Saat Ini',
    cumulativeRxTx: 'Total Akumulasi RX/TX',
    packetDrops: 'Paket Dibuang',
    packetErrors: 'Galat Paket',

    // Pelanggan & OLT FTTH
    customerTitle: 'Monitoring Pelanggan & Redaman OLT',
    customerSubtitle: 'Pemantauan redaman optik FTTH (dBm), status koneksi ONU/ONT, dan integrasi PPPoE MikroTik',
    totalCustomers: 'Total Pelanggan',
    onlineCustomers: 'Online (PPPoE & ONU)',
    normalAttenuation: 'Redaman Normal (-14 s/d -24 dBm)',
    warningAttenuation: 'Redaman Waspada (-24 s/d -27 dBm)',
    criticalAttenuation: 'Redaman Kritis / LOS (< -27 dBm)',
    btnTambahPelanggan: 'Tambah Pelanggan',
    btnCekSemuaRedaman: 'Cek Redaman Semua',
    btnKelolaOlt: 'Kelola OLT',
    btnSyncPppoe: 'Sinkronisasi PPPoE',
    searchCustomerPlaceholder: 'Cari nama, user PPPoE, telepon, SN ONU, atau ODP...',
    allOlt: 'Semua OLT',
    allAttenuation: 'Semua Kualitas Redaman',
    optNormal: 'Normal (Optimal)',
    optWarning: 'Waspada (Tinggi)',
    optCritical: 'Kritis (Jelek)',
    optLos: 'LOS (Putus / Rusak)',
    colCustomer: 'Pelanggan & Kontak',
    colPppoe: 'Koneksi PPPoE',
    colOltPon: 'OLT & Port PON',
    colOptical: 'Redaman Optik (dBm)',
    colAction: 'Aksi',
    btnCekRedaman: 'Cek Redaman',
    btnWhatsApp: 'Hubungi WA',
    lastChecked: 'Terakhir dicek:',
    activeSubscribers: 'aktif berlangganan',
    onlinePppoe: 'Online PPPoE',
    activeSessionsInMikrotik: 'Sesi aktif di MikroTik',
    optCriticalLos: 'Kritis / LOS',
    needInspection: 'Perlu Cek',
    noCustomersFound: 'Tidak ada pelanggan yang cocok dengan kriteria pencarian atau filter.',
    loadingCustomerData: 'Memuat data pelanggan & telemetri OLT...',
    btnAutoScan: 'Auto Scan Pelanggan',
    autoScanDesc: 'Pindai otomatis semua akun PPPoE MikroTik & OLT ke database pelanggan',
    btnImportAllPppoe: 'Impor Semua Sekaligus',
    btnImporSemuaOnu: 'Impor Semua ONU ke Pelanggan',
    autoScanSuccess: 'Auto scan berhasil! Semua data pelanggan telah disinkronkan.',
    autoScanEmptyPrompt: 'Temukan & Sinkronkan Semua Pelanggan: Sistem mendeteksi akun di MikroTik & OLT. Klik Auto Scan untuk memuat semua data pelanggan secara otomatis.',
  },
  en: {
    // Header & Brand
    appSubtitle: 'MIMO.SA • MikroTik System Monitoring',
    pilihBahasa: 'Select Language',
    tema: 'Theme',
    temaTerang: 'Light',
    temaGelap: 'Dark',
    temaSistem: 'System',

    // Navigasi & Sidebar
    navDashboard: 'Device Dashboard',
    navNoc: 'NOC Command Center',
    navTraffic: 'Interface Traffic',
    navTopology: 'Network Topology',
    navHotspot: 'Hotspot Clients',
    navPppoe: 'PPPoE Clients',
    navCustomers: 'FTTH & OLT Monitor',
    navLogs: 'System Audit Logs',
    navConfig: 'Router Configuration',
    navBackups: 'Auto Backup & Archive',
    roleAdmin: 'Administrator',
    roleOperator: 'Network Operator',
    logout: 'Logout',
    activeRouter: 'Active Router',
    clickToSwitch: 'Click to switch router',

    // NOC Command Center Header
    nocTitle: 'NOC Command Center',
    liveTelemetry: 'LIVE TELEMETRY',
    checkingUplink: 'Checking uplink...',
    uptime: 'Uptime',
    alarmOn: 'Alarm ON',
    alarmMute: 'Mute',
    alarmTitleOn: 'Link Down Audio Alarm: ON',
    alarmTitleOff: 'Link Down Audio Alarm: OFF',
    refreshData: 'Refresh Data',
    layarPenuh: 'Fullscreen',
    keluarLayarPenuh: 'Exit Fullscreen',
    kioskTooltip: 'Kiosk Mode / Fullscreen Display (NOC TV Wall)',
    noRouterTitle: 'No Router Selected',
    noRouterDesc: 'Select or add a router from Configuration page',

    // Banner Saturasi Bandwidth
    saturationWarning: 'Link Saturation Warning!',
    saturationCapacityUsed: 'Capacity Used',
    saturationText1: 'Interface throughput',
    saturationText2: 'reached',
    saturationText3: 'of ISP capacity limit',
    adjustCapacity: 'Adjust Capacity',

    // Row 1 Hardware
    cpuLoad: 'CPU Load',
    cpuTotal: 'Total',
    cpuPerCore: 'Per Core:',
    ramMemory: 'RAM Memory',
    conntrackTable: 'Conntrack Table',
    conntrackFirewall: 'Firewall Tracking',
    conntrackNormal: 'Normal',
    dhcpLeases: 'DHCP Leases',
    dhcpActiveBound: 'Active bound',
    dhcpPoolsDefined: 'pools defined',
    poolCapacityNormal: 'Pool Capacity Normal',
    temperature: 'Temperature',
    sensorThermal: 'Thermal Sensor',
    optimal: 'Optimal',
    highTemp: 'High Temp',
    storageDisk: 'Storage Disk',

    // Row 2 Port Matrix
    portMatrixTitle: 'Port Matrix & Physical Link',
    interfacesDetected: 'interfaces detected',
    portMatrixSubtitle: 'Visual status of physical ports, speed negotiation, packet errors, and drops (click port for detailed inspection)',
    portUp: 'Up',
    portDown: 'Down',
    portDrops: 'Drops',
    portErrors: 'Errors',
    portStatusDown: 'DOWN',

    // Row 3 Traffic & DNS
    ifaceThroughputTitle: 'Interface Throughput',
    ifaceThroughputSubtitle: 'Live download (RX) & upload (TX) bandwidth directly from RouterOS',
    capLabel: 'Cap:',
    ifacePort: 'Port:',
    ifaceRunning: 'Running',
    ifaceDown: 'Down',
    ifaceSpeed: 'Speed:',
    cumulativeTotal: 'Total Cumulative:',
    topDomainsTitle: 'Top 5 Visited Domains',
    topDomainsSubtitle: 'Destination domains most frequently queried by network clients',
    dnsCacheBadge: 'DNS Cache',
    noDnsQueries: 'No DNS queries recorded yet',
    noDnsQueriesHelp: 'Ensure network clients are using RouterOS DNS',
    dnsMethod: 'Method: /ip dns cache',
    dnsUpdateFreq: 'Updated every 5s',
    chartDownload: 'Download (RX)',
    chartUpload: 'Upload (TX)',
    chartTime: 'Time:',

    // Row 4 Talkers & Watchlist
    topTalkersTitle: 'Top Bandwidth Consumers',
    topTalkersSubtitle: 'Most active Hotspot & PPPoE clients consuming bandwidth',
    noActiveClients: 'No active clients detected',
    activeSession: 'Active Session',
    watchlistTitle: 'Link Error & Packet Drop Watchlist',
    watchlistSubtitle: 'Physical Cable & SFP Interface Quality',
    allLinksHealthy: 'All Interface Links Clean',
    allLinksHealthyDesc: '0 packet drops & 0 CRC errors across all ports',

    // Row 5 Incident Logs
    incidentLogsTitle: 'Live Incident & System Log Stream',
    incidentLogsSubtitle: 'Real-time RouterOS log stream for critical incidents, errors, and system warnings',
    eventsCount: 'events',
    severityAll: 'All',
    severityCritical: 'Critical',
    severityError: 'Error',
    severityWarning: 'Warning',
    noIncidentsTitle: 'No Incidents Recorded',
    noIncidentsDesc: 'Router running clean with no active warnings or errors',

    // Modals
    capacityModalTitle: 'Set ISP Bandwidth Capacity Limit',
    subscriptionCapacity: 'Subscribed Capacity (Mbps)',
    capacityPlaceholder: 'Example: 500',
    capacityModalHelp: 'Dashboard triggers alarm and saturation warning banner when interface throughput exceeds 85% of this limit.',
    btnBatal: 'Cancel',
    btnSimpan: 'Save',
    btnTutup: 'Close',

    // Port Detail Modal
    portDetailTitle: 'Port Inspection',
    linkStatus: 'Link Status',
    linkRunning: 'LINK UP (Running)',
    linkDisconnected: 'LINK DOWN',
    negotiatedSpeed: 'Negotiated Speed',
    macAddress: 'MAC Address',
    currentLiveTraffic: 'Current Live Traffic',
    cumulativeRxTx: 'Total Cumulative RX/TX',
    packetDrops: 'Packet Drops',
    packetErrors: 'Packet Errors',

    // Customers & OLT FTTH
    customerTitle: 'Customer & OLT Optical Power Monitor',
    customerSubtitle: 'FTTH optical power attenuation monitoring (dBm), ONU/ONT status, and MikroTik PPPoE integration',
    totalCustomers: 'Total Customers',
    onlineCustomers: 'Online (PPPoE & ONU)',
    normalAttenuation: 'Normal Attenuation (-14 to -24 dBm)',
    warningAttenuation: 'Warning Attenuation (-24 to -27 dBm)',
    criticalAttenuation: 'Critical / LOS (< -27 dBm)',
    btnTambahPelanggan: 'Add Customer',
    btnCekSemuaRedaman: 'Check All Optical',
    btnKelolaOlt: 'Manage OLTs',
    btnSyncPppoe: 'Sync PPPoE',
    searchCustomerPlaceholder: 'Search name, PPPoE user, phone, ONU SN, or ODP...',
    allOlt: 'All OLTs',
    allAttenuation: 'All Signal Tiers',
    optNormal: 'Normal (Optimal)',
    optWarning: 'Warning (High)',
    optCritical: 'Critical (Poor)',
    optLos: 'LOS (No Signal / Broken)',
    colCustomer: 'Customer & Contact',
    colPppoe: 'PPPoE Connection',
    colOltPon: 'OLT & PON Port',
    colOptical: 'Optical Power (dBm)',
    colAction: 'Actions',
    btnCekRedaman: 'Check Power',
    btnWhatsApp: 'WhatsApp',
    lastChecked: 'Last checked:',
    activeSubscribers: 'active subscribers',
    onlinePppoe: 'Online PPPoE',
    activeSessionsInMikrotik: 'Active sessions in MikroTik',
    optCriticalLos: 'Critical / LOS',
    needInspection: 'Needs Check',
    noCustomersFound: 'No customers found matching search criteria or filters.',
    loadingCustomerData: 'Loading customer data & OLT telemetry...',
    btnAutoScan: 'Auto Scan Customers',
    autoScanDesc: 'Automatically scan all MikroTik PPPoE accounts & OLT ONUs into the customer list',
    btnImportAllPppoe: 'Import All at Once',
    btnImporSemuaOnu: 'Import All ONUs to Customers',
    autoScanSuccess: 'Auto scan successful! All customer data has been synchronized.',
    autoScanEmptyPrompt: 'Discover & Sync All Customers: System detects accounts on MikroTik & OLT. Click Auto Scan to automatically load all customer data.',
  },
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('language')
      return saved === 'EN' || saved === 'en' ? 'en' : 'id'
    } catch {
      return 'id'
    }
  })

  const setLanguage = (lang) => {
    const code = String(lang).toLowerCase() === 'en' ? 'en' : 'id'
    setLanguageState(code)
    try {
      localStorage.setItem('language', code.toUpperCase())
    } catch {}
  }

  const t = translations[language] || translations.id

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
