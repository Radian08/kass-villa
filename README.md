# Kas Villa — Portal Admin & Anggota

Aplikasi manajemen kas iuran villa dengan **sinkron otomatis antar perangkat** (Firebase Cloud).

## Struktur

```
villa/
├── index.html              # Login
├── admin/index.html        # Dashboard admin
├── customer/index.html     # Portal anggota
├── firebase-config.js      # Kredensial cloud (isi sekali)
├── SETUP-FIREBASE.md       # Panduan sinkron (±10 menit)
├── firestore.rules         # Rules keamanan Firebase
└── assets/
```

## Login

| Peran | Cara masuk | Default |
|-------|------------|---------|
| Admin | Username + password | `admin` / `admin123` |
| Anggota | WhatsApp + PIN 4 digit | PIN dari admin |

## Sinkron antar perangkat

1. Ikuti **[SETUP-FIREBASE.md](SETUP-FIREBASE.md)** (sekali)
2. Deploy web dengan `firebase-config.js` yang sudah diisi
3. Buka web yang sama di HP/laptop lain → data **otomatis sama**

Tidak perlu impor/ekspor JSON lagi.

## Hosting

Upload folder ke Netlify / Vercel / GitHub Pages / cPanel. Tidak perlu build.

```powershell
cd d:\villa
npx serve .
```

## Fitur

**Admin:** KPI, grafik, anggota, transaksi, konfirmasi bayar, pengumuman, log, Excel, WhatsApp.

**Anggota:** Progres iuran, lapor bayar, riwayat, pengumuman, hubungi pengurus.

## Migrasi dari versi lama

Data `kas.html` / `villa_pro_v5_plus` otomatis dipindah ke `kas_villa_v6` dan di-upload ke cloud saat Firebase aktif.
