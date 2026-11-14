# Changelog

Semua perubahan penting proyek ini dicatat di file ini.

## v1.2.0

Rilis ketahanan: kegagalan muat model sekarang bisa dipulihkan dari dalam aplikasi dengan tombol Coba lagi dan langkah-langkah terarah.

### Fitur baru

- **Pemulihan di dalam aplikasi untuk kegagalan muat model.** Error item sekarang menampilkan tombol Coba lagi dan rincian kegagalan; halaman Bantuan punya bagian Model gagal dimuat dengan langkah konkret.
- **Model tertanam tidak pernah menyentuh jaringan.** Tiny dan Base dimuat ketat dari origin situs; file hilang atau basi gagal seketika dengan pesan jelas, bukan menggantung.
- **Kebersihan cache model tertanam.** Entri cache remote yang basi untuk model tertanam dibersihkan sekali pada muat pertama agar unduhan terputus sebelumnya tidak menutupi salinan tertanam.

## v1.1.1

Perbaikan bug untuk antrean bersamaan dan pesan error muat yang lebih jelas.

### Perbaikan bug

- **Desync antrean saat klik cepat.** Memperbaiki klik beberapa tombol Mulai sekaligus yang membuat antrean nyangkut permanen; sekarang hanya satu transkripsi berjalan dalam satu waktu dan tombol Mulai nonaktif saat yang lain sedang berjalan.
- **Kata pesan error muat.** Pesan kegagalan model sekarang menyatakan model tidak bisa dimuat, bukan seolah masalah unduhan.

## v1.1.0

Transkripsi audio dan video ke teks yang gratis, tanpa batas, dan privat di browser kamu, sekarang dengan Tiny dan Base tertanam sehingga jalan offline sejak halaman pertama.

### Fitur baru

- **Model tertanam.** Tiny dan Base (default) disertakan dalam situs di `public/models`, dimuat dari origin sendiri; tidak perlu unduhan dan sepenuhnya offline pada kunjungan pertama.

### Peningkatan

- **Pengelola model diperbarui.** Tiny dan Base ditampilkan sebagai termasuk dalam aplikasi dan tidak bisa dihapus; hanya Small yang tampil sebagai on-demand.

## v1.0.0

Transkripsi audio dan video ke teks yang gratis, tanpa batas, dan privat, sepenuhnya di browser kamu, offline setelah model pertama diunduh.

### Fitur baru

- **Transkripsi di browser.** Audio dan video (wav, mp3, m4a, flac, ogg, mp4, mov, webm) didekode menjadi PCM 16 kHz mono dan ditranskripsi dengan Whisper ONNX (terkuantisasi) yang berjalan sebagai WebAssembly di dalam Web Worker.
- **Tiga model.** Tiny, Base (default) dan Small, diunduh saat dibutuhkan dari Hugging Face dan disimpan di cache browser untuk dipakai offline.
- **Antarmuka dwibahasa.** Inggris dan Indonesia, dengan tema terang dan gelap.
- **Format keluaran.** TXT, SRT, VTT, JSON (timestamp per segmen), dengan salin ke clipboard dan unduhan file.
- **Antrean batch.** Transkripsi beberapa file dan unduh semua hasil sebagai ZIP.
- **PWA yang bisa dipasang.** Web app manifest dan service worker untuk penggunaan offline setelah model pertama diunduh.
- **Pengelola model.** Lihat model mana yang tersimpan, berapa penyimpanan yang terpakai, dan hapus model yang tidak dibutuhkan.
- **Progress langsung.** Progress per jendela, segmen muncul bertahap, pembatalan antar jendela 30 detik.

### Peningkatan

- **Binary WASM di-host sendiri.** WASM ONNX Runtime disajikan dari origin situs; tidak ada CDN pihak ketiga saat runtime.
- **Content-Security-Policy ketat** dengan header COOP/COEP (cross-origin isolation) di `public/_headers` dan di preview lokal.
- **Pembatalan aman dari crash** dengan menghentikan dan membuat ulang worker.
- **Pemberitahuan memori rendah** pada perangkat dengan RAM kurang dari 4 GB.

### Perbaikan bug

- **Fallback path WASM.** Memperbaiki ONNX Runtime yang diam-diam memakai CDN jsdelivr ketika path WASM diset salah; situs sekarang hanya menyajikan file miliknya.
- **Kegagalan inisialisasi senyap.** Memperbaiki transkripsi yang menggantung tanpa pesan error ketika worker gagal inisialisasi; error sekarang ditampilkan.
