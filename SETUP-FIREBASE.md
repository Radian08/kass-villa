# Setup Sinkron Cloud (sekali saja, ±10 menit)

Setelah setup, **update di HP A otomatis muncul di HP B** — tanpa impor/ekspor JSON.

## 1. Buat proyek Firebase (gratis)

1. Buka [https://console.firebase.google.com](https://console.firebase.google.com)
2. Klik **Add project** → nama bebas (misal `kas-villa`) → Create
3. Di project, klik ikon **Web** `</>` → daftarkan app
4. Salin objek `firebaseConfig` yang ditampilkan

## 2. Aktifkan Firestore

1. Menu **Build → Firestore Database**
2. **Create database** → mode **Production** → lokasi `asia-southeast2` (Jakarta) atau terdekat
3. Selesai

## 3. Atur keamanan (rules)

1. Tab **Rules** di Firestore
2. Ganti isi file dengan isi `firestore.rules` di folder villa
3. **Penting:** ganti `villa-rahasia-anda` dengan kode rahasia Anda sendiri, misalnya `villa-bukit-jaya-2024`
4. Klik **Publish**

## 4. Isi config di web

1. Salin `firebase-config.example.js` → `firebase-config.js` (jika belum ada)
2. Isi semua field dari Firebase Console
3. Set `VILLA_SYNC_ID` **sama persis** dengan kode di Firestore Rules (langkah 3)

Contoh:

```javascript
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSy...',
  authDomain: 'kas-villa.firebaseapp.com',
  projectId: 'kas-villa',
  storageBucket: 'kas-villa.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123'
};

window.VILLA_SYNC_ID = 'villa-bukit-jaya-2024';
```

## 5. Upload / deploy ulang

Upload seluruh folder `villa` ke hosting (Netlify, Vercel, cPanel, dll.).

**Semua perangkat** harus membuka **URL yang sama** dan memakai **firebase-config.js yang sama**.

## Cara kerja

| Anda lakukan | Yang terjadi |
|--------------|--------------|
| Admin centang iuran di laptop | Otomatis tersimpan ke cloud |
| Anggota buka portal di HP | Data terbaru langsung dimuat |
| Anggota lapor bayar | Admin lihat di menu Konfirmasi (setelah sinkron) |

Indikator di pojok atas:

- **Hijau "Sinkron cloud"** = berhasil
- **Oranye "Hanya perangkat ini"** = Firebase belum diisi

## Pertanyaan umum

**Apakah gratis?**  
Firestore gratis untuk penggunaan kecil (villa puluhan anggota biasanya aman).

**Apakah aman?**  
Hanya yang tahu `VILLA_SYNC_ID` + rules Firebase yang bisa akses data. Jangan bagikan kode itu ke publik.

**Data lama di localStorage?**  
Saat cloud pertama kali aktif, data lokal otomatis di-upload ke cloud.

**Cadangan JSON masih ada?**  
Opsional di Pengaturan → "Cadangan opsional", untuk berjaga-jaga.
