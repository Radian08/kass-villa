/**
 * Salin file ini jadi firebase-config.js lalu isi dari Firebase Console.
 * Semua perangkat harus pakai file config yang SAMA (apiKey + VILLA_SYNC_ID).
 */
window.FIREBASE_CONFIG = {
  apiKey: 'ISI_API_KEY',
  authDomain: 'proyek-anda.firebaseapp.com',
  projectId: 'proyek-anda',
  storageBucket: 'proyek-anda.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef'
};

/** Kode rahasia villa — buat sendiri, contoh: villa-bukit-2024 */
window.VILLA_SYNC_ID = 'villa-rahasia-anda';
