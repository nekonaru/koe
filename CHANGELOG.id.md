# Changelog

Semua perubahan penting proyek ini dicatat di file ini.

## [1.0.0] - 2026-11-14

### Fitur baru

- **Transkripsi di browser.** Audio dan video (wav, mp3, m4a, flac, ogg, mp4, mov, webm) didekode menjadi PCM 16 kHz mono dan ditranskripsi dengan Whisper ONNX (terkuantisasi) yang berjalan sebagai WebAssembly di dalam Web Worker.
- **Tiga model.** Tiny, Base (default), Small, diunduh saat dibutuhkan dari Hugging Face dan disimpan di cache browser untuk dipakai offline.
- **Antarmuka dwibahasa.** Inggris dan Indonesia, dengan tema terang dan gelap.
- **Format keluaran.** TXT, SRT, VTT, JSON (timestamp per segmen), dengan salin ke clipboard dan unduhan file.
- **Antrean batch.** Transkripsi beberapa file dan unduh semua hasil sebagai ZIP.
- **PWA yang bisa dipasang.** Web app manifest dan service worker untuk penggunaan offline setelah model pertama diunduh.
- **Pengelola model.** Lihat model mana yang tersimpan, penyimpanan yang terpakai, dan hapus model yang tidak dibutuhkan.
- **Progress langsung.** Progress per jendela, segmen muncul bertahap, pembatalan antar jendela 30 detik.

### Perbaikan

- **Binary WASM di-host sendiri.** WASM ONNX Runtime disajikan dari origin situs; tidak ada CDN pihak ketiga saat runtime.
- **Content-Security-Policy ketat** dengan header COOP/COEP (cross-origin isolation) di `public/_headers` dan di preview lokal.
- **Pembatalan aman dari crash** dengan menghentikan dan membuat ulang worker.
- **Pemberitahuan memori rendah** pada perangkat dengan RAM kurang dari 4 GB.

### Perbaikan bug

- Memperbaiki ONNX Runtime yang diam-diam memakai CDN jsdelivr ketika path WASM diset salah; situs sekarang hanya menyajikan file miliknya.
- Memperbaiki transkripsi yang menggantung tanpa pesan error ketika worker gagal inisialisasi; error sekarang ditampilkan.
