# Koe: PRD dan Master Prompt (Versi Web)

Website transkripsi audio/video ke teks, gratis, tanpa batas pemakaian, tanpa backend. Seluruh proses jalan di browser pengguna dan bisa dipakai offline sebagai PWA.

Penulis: Niko (nekonaru) | Status: Draf v0.1 | Nama: Koe (nama repo: `koe`) | Saudara dari: Kikoe (CLI, desktop, mobile)

## Bagian 1: PRD

### 1. Ringkasan

Koe mengubah file audio atau video menjadi teks dan subtitle langsung di browser. Tidak ada server pemrosesan, akun, kuota, atau API key. Audio tidak pernah diunggah ke mana pun. Mesin pengenalan suara memakai whisper.cpp yang dikompilasi ke WebAssembly (WASM) dan berjalan di Web Worker. Situs hanya berisi file statis, sehingga bisa di-host gratis.

Asal nama: "Koe" (å£°) berarti "suara" dalam bahasa Jepang. Kikoe (èžã“ãˆ) berarti "terdengar", jadi Koe terasa satu keluarga dengan Kikoe tetapi punya identitas sendiri: lebih ringan, lembut, dan bisa dibuka tanpa memasang apa pun.

### 2. Masalah

- Layanan transkripsi web populer membatasi menit gratis, meminta langganan, atau mengunggah audio ke cloud.
- Alat open source yang privat biasanya butuh instalasi, terminal, atau Python, sehingga sulit dipakai orang non-teknis.
- Dukungan bahasa Indonesia sering jadi prioritas kedua.
- Pengguna yang meminjam komputer kampus atau warnet tidak bisa memasang aplikasi, tetapi masih bisa membuka website.

### 3. Tujuan

1. Transkripsi tanpa batas durasi dan jumlah file, gratis selamanya.
2. Privasi penuh: audio diproses di perangkat, nol unggahan.
3. Tanpa instalasi: buka URL, pilih file, selesai. Opsional dipasang sebagai PWA.
4. Kualitas baik untuk bahasa Indonesia, plus bahasa lain yang didukung Whisper.
5. Jalan offline setelah model terunduh sekali.
6. Core C++ dipakai ulang dari Kikoe, bukan ditulis ulang.

### 4. Bukan Tujuan (v1)

- Transkripsi real-time dari mikrofon (dipertimbangkan setelah v1).
- Diarisasi pembicara.
- Akun, sinkronisasi, kolaborasi, atau penyimpanan cloud.
- Terjemahan teks ke banyak bahasa (hanya opsi terjemahan ke Inggris bawaan Whisper, prioritas rendah).
- Editor video.
- Model medium dan large (batas memori WASM dan browser).
- Backend atau API publik.

### 5. Pengguna Sasaran

| Persona | Kebutuhan | Perangkat utama |
| --- | --- | --- |
| Mahasiswa | Mentranskrip rekaman kuliah dan wawancara tanpa memasang aplikasi | Laptop, kadang HP |
| Kreator konten | Subtitle SRT/VTT cepat untuk video pendek | Laptop |
| Jurnalis dan peneliti | Transkrip wawancara yang terjamin privat | Laptop |
| Pengguna di komputer pinjaman | Tidak bisa memasang software | Komputer umum |

### 6. Prinsip Produk

- Privat secara arsitektur: tidak ada backend, jadi tidak ada yang bisa bocor dari server.
- Offline dulu: internet hanya untuk memuat situs dan mengunduh model, selebihnya tidak.
- Tanpa telemetri dan tanpa pelacak pihak ketiga (tanpa Google Analytics, tanpa font atau skrip dari CDN pihak ketiga saat runtime).
- Sederhana di permukaan: satu halaman, tiga langkah (pilih file, pilih bahasa, mulai).
- Jujur soal batasan: tampilkan ukuran unduhan, perkiraan waktu, dan peringatan memori sebelum pengguna mulai.

### 7. Kebutuhan Fungsional

Prioritas memakai MoSCoW: M = wajib v1, S = sebaiknya v1, C = bisa nanti.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-01 | Menerima input audio (wav, mp3, m4a, flac, ogg) dan video (mp4, mov, webm) lewat pilih file dan seret-lepas | M |
| FR-02 | Dekode media ke PCM 16 kHz mono memakai Web Audio API di browser | M |
| FR-03 | Transkripsi memakai whisper.cpp WASM di Web Worker dengan pilihan model tiny, base, small | M |
| FR-04 | Pilihan bahasa manual atau deteksi otomatis | M |
| FR-05 | Output TXT, SRT, VTT, JSON (timestamp per segmen), unduh sebagai file dan salin ke clipboard | M |
| FR-06 | Progress, segmen muncul bertahap, dan pembatalan yang aman | M |
| FR-07 | Manajer model: unduh dengan progress, verifikasi checksum SHA-256, simpan di OPFS, bisa dilanjutkan jika terputus | M |
| FR-08 | Deteksi kemampuan browser (WASM SIMD, SharedArrayBuffer, OPFS) dengan pesan jelas jika tidak didukung | M |
| FR-09 | PWA: bisa dipasang dan seluruh fitur inti jalan offline setelah model ada | S |
| FR-10 | Antrean banyak file, hasil bisa diunduh satu per satu atau sebagai ZIP | S |
| FR-11 | Pemrosesan audio panjang per potongan agar memori stabil | S |
| FR-12 | Fallback dekode dengan ffmpeg.wasm untuk format yang tidak terbaca browser (misalnya mkv), dimuat hanya saat dibutuhkan | S |
| FR-13 | Antarmuka dwibahasa (Indonesia dan Inggris), tema terang dan gelap | S |
| FR-14 | Percepatan WebGPU lewat jalur alternatif (Transformers.js) sebagai eksperimen | C |
| FR-15 | Edit teks dan sinkron timestamp di halaman hasil | C |
| FR-16 | Kosakata kustom lewat initial prompt | C |
| FR-17 | Transkripsi mikrofon real-time | C |

### 8. Kebutuhan Non-Fungsional

- Performa (target awal, diukur di akhir Tahap 3): model base pada laptop menengah dengan WASM multithread memproses audio dengan RTF mendekati 1.0 atau lebih baik. Angka final dicatat di dokumen benchmark, bukan ditebak.
- Memori: model small butuh sekitar setengah GB untuk bobot saja. Aplikasi harus mendeteksi perangkat dengan memori kecil dan menyarankan model lebih kecil. Audio diproses per potongan.
- UI tidak boleh macet: seluruh dekode berat dan inferensi di Web Worker, thread utama hanya untuk antarmuka.
- Stabilitas: file rusak, format tidak didukung, atau kehabisan memori menghasilkan pesan galat jelas, bukan tab yang membeku diam-diam.
- Kompatibilitas: Chrome, Edge, Firefox, dan Safari versi terbaru di desktop. Android Chrome dengan peringatan batas memori. iOS Safari dievaluasi belakangan.
- Privasi: nol permintaan jaringan selain memuat aset situs dan mengunduh model yang diminta pengguna. Dikunci dengan Content-Security-Policy ketat.
- Ukuran: bundel awal (tanpa model dan tanpa ffmpeg.wasm) sekecil mungkin; WASM whisper dimuat saat pengguna mulai.
- Aksesibilitas: dapat dipakai dengan keyboard, kontras warna memenuhi WCAG AA, label ARIA pada kontrol utama.
- Lisensi: seluruh dependensi harus kompatibel dengan distribusi open source gratis (lihat risiko tentang ffmpeg.wasm).

### 9. Arsitektur

```
koe/
â”œâ”€â”€ core/                  dipakai ulang dari Kikoe (submodule atau salinan terversi)
â”‚   â”œâ”€â”€ include/           C API publik
â”‚   â””â”€â”€ src/{engine,format}/
â”œâ”€â”€ wasm/                  build Emscripten
â”‚   â”œâ”€â”€ CMakeLists.txt     target koe_core.wasm (SIMD, pthreads)
â”‚   â”œâ”€â”€ bindings.cpp       ekspor kk_* yang dibutuhkan web
â”‚   â””â”€â”€ build.sh
â”œâ”€â”€ web/                   aplikasi (Vite + React + TypeScript + Tailwind)
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ ui/            komponen dan halaman
â”‚   â”‚   â”œâ”€â”€ worker/        transcribe.worker.ts (memuat WASM, inferensi)
â”‚   â”‚   â”œâ”€â”€ audio/         decode.ts (Web Audio), chunk.ts, ffmpeg-fallback.ts
â”‚   â”‚   â”œâ”€â”€ model/         manager.ts (unduh, checksum, OPFS)
â”‚   â”‚   â”œâ”€â”€ format/        wrapper TypeScript ke formatter core, atau formatter TS yang diuji silang
â”‚   â”‚   â”œâ”€â”€ i18n/          id.json, en.json
â”‚   â”‚   â””â”€â”€ pwa/           service worker
â”‚   â”œâ”€â”€ public/            ikon, manifest, _headers
â”‚   â””â”€â”€ tests/
â”œâ”€â”€ third_party/whisper.cpp
â”œâ”€â”€ docs/
â””â”€â”€ package.json
```

Alur data: file media â†’ dekode di browser (Web Audio, fallback ffmpeg.wasm) â†’ resample ke PCM 16 kHz mono (Float32Array) â†’ potongan â†’ dikirim ke Web Worker â†’ inferensi whisper.cpp WASM â†’ segmen bertimestamp dikirim bertahap ke UI â†’ formatter â†’ unduh atau salin.

Keputusan arsitektur:

- Tanpa backend. Hosting statis di Cloudflare Pages (atau Netlify) dengan header `Cross-Origin-Opener-Policy: same-origin` dan `Cross-Origin-Embedder-Policy: require-corp` agar SharedArrayBuffer dan WASM multithread aktif. GitHub Pages tidak bisa mengatur header ini tanpa trik service worker, jadi bukan pilihan utama.
- Core C++ tetap satu sumber kebenaran untuk engine dan formatter. Hanya lapisan dekode yang berbeda dari Kikoe: web memakai Web Audio, jadi tidak ada FFmpeg di jalur utama. Core mendapat varian `kk_transcribe_pcm` yang menerima buffer PCM langsung, bukan path file.
- Worker berkomunikasi lewat pesan bertipe (diskriminasi union di TypeScript): `init`, `transcribe`, `cancel` dari UI, dan `progress`, `segment`, `done`, `error` dari worker.
- Pembatalan: whisper.cpp memeriksa abort callback; jika tidak merespons dalam waktu wajar, worker dihentikan dan dibuat ulang (model dimuat ulang dari OPFS).
- Model disimpan di OPFS (fallback Cache Storage) dan tidak pernah dibundel di situs. File model terlalu besar untuk batas file hosting statis, jadi sumbernya ada di luar situs (lihat bagian Strategi Model).
- Formatter: pilih satu jalur dan jangan ganda. Default: pakai formatter C++ dari core lewat WASM agar hasil identik dengan Kikoe. Jika overhead binding terasa tidak sepadan, formatter TypeScript boleh dipakai asalkan lolos test silang terhadap keluaran C++.

### 10. Kontrak Antarmuka

Tambahan C API untuk web (turunan dari kontrak Kikoe, nama bisa disempurnakan):

```c
// Varian PCM: tidak ada dekode di dalam core.
int kk_transcribe_pcm(kk_engine* e,
                      const float* pcm_16k_mono, size_t n_samples,
                      const kk_options* o,
                      kk_progress_cb on_progress,
                      kk_segment_cb on_segment, void* user);
```

Pesan Worker (TypeScript, rancangan):

```ts
type ToWorker =
  | { type: "init"; modelId: ModelId; threads: number }
  | { type: "transcribe"; pcm: Float32Array; lang: string; translate: boolean }
  | { type: "cancel" };

type FromWorker =
  | { type: "ready" }
  | { type: "progress"; percent: number }
  | { type: "segment"; startMs: number; endMs: number; text: string }
  | { type: "done" }
  | { type: "error"; code: string; message: string };
```

Aturan: PCM dikirim ke worker sebagai transferable agar tidak disalin. Semua galat dari WASM diterjemahkan menjadi kode galat dengan pesan yang bisa dibaca pengguna.

### 11. Pengalaman Pengguna

Satu halaman dengan tiga langkah yang terlihat sekaligus.

1. Pilih file: area seret-lepas besar, menampilkan nama, durasi, dan ukuran setelah file dipilih.
2. Pengaturan: bahasa (default Indonesia), model (tiny, base, small dengan ukuran unduhan dan catatan kecepatan), format keluaran. Jika model belum ada, tampil tombol unduh dengan ukuran jelas dan peringatan memakai kuota data.
3. Mulai: progress bar, teks muncul bertahap, tombol batal. Setelah selesai: tombol Salin, Unduh TXT/SRT/VTT/JSON.

Status penting yang harus selalu terlihat: "Diproses di perangkat ini, tidak ada yang diunggah" dan status offline-siap.

Halaman tambahan: Tentang dan privasi (penjelasan singkat bagaimana data tidak keluar), Bantuan (browser yang didukung, cara memilih model), dan halaman galat kompatibilitas.

Identitas visual:

- Logo: huruf kana ã“ (ko) dibentuk dari dua garis di dalam kotak bersudut bulat. Garis atas berwarna coral sebagai aksen, garis bawah putih hangat melengkung seperti huruf. Terbaca sampai 16 px.
- Warna: indigo ai-iro `#2B3A67`, coral `#FF7A59`, putih hangat sekitar `#FAF7F2`. Mode gelap memakai latar mendekati `#141414` dengan indigo sebagai permukaan.
- Wordmark: "koe" huruf kecil, font sans bersudut lembut (Nunito, M PLUS Rounded 1c, atau yang setara). Font di-host sendiri, bukan dari CDN.
- Favicon dan ikon PWA: ikon kotak indigo di 16, 32, 192, dan 512 px (termasuk versi maskable).
- Karakter: lembut dan ringan, berbeda dari Kikoe yang tegas dengan hanko merah.

### 12. Strategi Model

- Model tidak dibundel di situs. Diunduh sekali saat dibutuhkan, disimpan di OPFS, lalu dipakai offline.
- Pilihan v1: tiny, base, small, masing-masing dalam varian terkuantisasi bila kualitasnya masih memadai (diputuskan setelah uji). Ukuran kira-kira: tiny puluhan MB, base ratusan MB, small sekitar 466 MB tanpa kuantisasi. Angka pasti dicek dari sumber model sebelum ditulis ke UI.
- Default: base. Small ditawarkan dengan peringatan ukuran dan memori. Perangkat dengan memori kecil mendapat saran otomatis ke tiny atau base.
- Sumber unduhan: Hugging Face (repositori model whisper.cpp) atau bucket sendiri (misalnya Cloudflare R2). Periksa dulu apakah CORS mengizinkan unduhan langsung dari browser; jika tidak, gunakan bucket sendiri. Cloudflare Pages punya batas ukuran file, jadi model tidak ditaruh di Pages.
- Setiap model punya SHA-256 yang disematkan di kode dan diperiksa dengan SubtleCrypto setelah unduh. Unduhan bisa dilanjutkan memakai permintaan Range.
- Pengguna bisa melihat dan menghapus model tersimpan, dengan tampilan ruang yang terpakai.

### 13. Roadmap dan Kriteria Selesai

| Tahap | Cakupan | Kriteria selesai |
| --- | --- | --- |
| 0. Fondasi | Repo, Vite + React + TS + Tailwind, lint, test runner, CI, deploy awal ke Cloudflare Pages dengan header COOP/COEP | Halaman kosong terdeploy dan `crossOriginIsolated` bernilai true |
| 1. Spike WASM | Kompilasi whisper.cpp (dan core) ke WASM via Emscripten, panggil dari Web Worker dengan PCM contoh dan model tiny | Audio sampel Indonesia pendek menghasilkan teks terbaca di browser |
| 2. Dekode dan UI minimal | Web Audio decode + resample, halaman satu layar, segmen muncul bertahap, format TXT | File mp3 dan mp4 sampel menghasilkan teks dari UI |
| 3. Model dan format | Manajer model (unduh, checksum, OPFS, resume), SRT/VTT/JSON, pilihan model dan bahasa, benchmark RTF | Model base terunduh sekali dan dipakai ulang; SRT valid; angka benchmark tercatat |
| 4. Kenyamanan | Pembatalan aman, pemotongan audio panjang, antrean dan ZIP, filter keheningan, deteksi kemampuan browser | Antrean 5 file selesai, batal tidak membekukan tab, file 30 menit tidak membuat tab crash di perangkat acuan |
| 5. PWA dan offline | Service worker, manifest, ikon, mode offline penuh | Setelah model ada, putus internet, lalu transkripsi tetap berjalan |
| 6. Fallback dan poles | ffmpeg.wasm lazy untuk mkv dan sejenisnya, dwibahasa, tema, aksesibilitas, halaman bantuan | mkv sampel terbaca; audit aksesibilitas dasar lulus; CSP ketat tanpa pelanggaran |
| 7. Rilis | Domain, README dwibahasa, SECURITY.md, dokumen lisensi pihak ketiga, rilis v1.0 | Situs publik, dokumentasi lengkap, tag v1.0 di GitHub |

Estimasi kasar Tahap 0 sampai 3 adalah dua sampai tiga minggu paruh waktu dengan bantuan AI, dengan Tahap 1 sebagai titik risiko terbesar. Jika spike WASM macet, jalur cadangan ada di bagian risiko.

### 14. Metrik Keberhasilan

Tanpa telemetri, ukuran sukses bersifat terbuka dan manual:

- RTF per model per perangkat acuan, dicatat di dokumen benchmark.
- WER pada kumpulan audio Indonesia kecil buatan sendiri, dibandingkan antar-model.
- Matriks browser dan perangkat yang lolos uji manual per rilis.
- Bintang, isu, dan fork di GitHub; statistik kunjungan agregat dari hosting (tanpa pelacak di halaman).

### 15. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Batas memori WASM dan browser, terutama di HP | Tab crash saat model besar atau file panjang | Hanya tiny, base, small; deteksi memori; pemrosesan per potongan; peringatan jelas |
| Lebih lambat dari native | Pengalaman kurang menyenangkan | Multithread + SIMD; jujur menampilkan perkiraan waktu; jalur eksperimen WebGPU; arahkan ke Kikoe desktop untuk file besar |
| Web Audio `decodeAudioData` memuat seluruh file ke memori | Video panjang bisa gagal | Batasi dan beri peringatan; pertimbangkan WebCodecs atau dekode bertahap; fallback ffmpeg.wasm |
| Perlu COOP/COEP untuk multithread | Hosting terbatas, embed pihak ketiga rusak | Pilih hosting yang mendukung header; tanpa aset lintas-origin; mode single-thread sebagai cadangan |
| CORS dan ketersediaan sumber model | Unduhan gagal | Uji CORS sejak Tahap 3; siapkan bucket sendiri; cermin model |
| Lisensi ffmpeg.wasm bergantung pada build (LGPL atau GPL) | Hukum, distribusi | Dimuat opsional dan lazy; pakai build yang lisensinya jelas; catat di dokumen lisensi; periksa sebelum rilis |
| Whisper berhalusinasi pada keheningan | Teks palsu | Filter keheningan atau VAD, ambang no-speech |
| Perbedaan perilaku antar browser (OPFS, SharedArrayBuffer di Safari) | Bug sulit dilacak | Deteksi kemampuan, fallback ke Cache Storage, matriks uji manual |
| Ruang lingkup membengkak | Proyek mandek | Kunci v1 pada M dan S, sisanya masuk daftar tunggu |

### 16. Lisensi dan Distribusi

whisper.cpp berlisensi MIT dan bobot model Whisper dirilis OpenAI dengan lisensi MIT. Lisensi repo Koe ditentukan pemilik; MIT atau Apache-2.0 paling sederhana selama dependensi kompatibel. Distribusi berupa situs statis di domain sendiri, kode di GitHub, dan PWA yang bisa dipasang. Dokumen lisensi pihak ketiga (Emscripten output, whisper.cpp, font, dan lainnya) disertakan di repo dan di halaman Tentang.

### 17. Pertanyaan Terbuka

1. Lisensi repo? (nama dan logo sudah final: Koe)
2. Hosting utama: Cloudflare Pages atau Netlify? Apakah model dihosting di bucket sendiri?
3. Perangkat dan browser acuan untuk uji performa?
4. Apakah jalur WebGPU (Transformers.js) masuk v1 sebagai opsi, atau ditunda setelah v1?
5. Apakah core C++ Kikoe dipakai sebagai submodule, atau disalin dan dipecah?
6. Perlu dukungan iOS Safari di v1 atau cukup setelah v1?
7. Domain: perlu dicek ketersediaan (misalnya koe.app, koe.id, atau varian lain)?

## Bagian 18: Catatan Implementasi v1.0 (deviasi dari draf)

Dieksekusi pada 2026-11-14. Deviasi dari draf di atas, beserta alasannya:

1. **Mesin transkripsi.** Draf mengusulkan whisper.cpp dikompilasi ke WASM lewat Emscripten. Mesin build (Emscripten, CMake) tidak tersedia di mesin pengembangan, dan core C++ Kikoe masih berupa stub. Sesuai mitigasi risiko di bagian 15, dipakai jalur cadangan: **Transformers.js v4** dengan model **Whisper ONNX terkuantisasi** dari Hugging Face (onnx-community/whisper-tiny, onnx-community/whisper-base, onnx-community/whisper-small), berjalan di Web Worker dengan backend WASM. Lisensi: Apache-2.0 (Transformers.js), MIT (bobot Whisper).
2. **Checksum SHA-256 dan OPFS.** Draf mengusulkan verifikasi SHA-256 dan penyimpanan OPFS dengan resume. Unduhan model kini ditangani Transformers.js ke Cache Storage API. Integritas dilindungi hash internal Hugging Face. SHA-256 yang disematkan dan resume unduhan belum diimplementasikan.
3. **Windowing.** Audio diproses per jendela 30 detik tanpa overlap untuk memberi progress nyata dan pembatalan yang bersih. Konsekuensi: akurasi di batas jendela bisa sedikit turun dibanding stride 5 detik bawaan Transformers.js.
4. **Ukuran model di UI** diukur dari API Hugging Face pada 2026-11-14 (quantized): tiny 43 MB, base 74 MB, small 231 MB. Angka bisa berubah seiring update repo model.
5. **ffmpeg.wasm (FR-12), WebGPU (FR-14), VAD/no-speech threshold (FR-16), filter keheningan** belum diimplementasikan di v1.0. Input dibatasi format yang bisa dibaca decodeAudioData browser (wav, mp3, m4a, flac, ogg, mp4, mov, webm).
6. **Deploy ke Cloudflare Pages** belum dijalankan: membutuhkan akun Cloudflare. File public/_headers sudah berisi COOP/COEP/CSP yang dibutuhkan. Setelah repo terhubung, situs dapat di-build dengan 
pm run build dan output dist.
7. **Pengukuran RTF** ada di enchmark.md. Angka final per perangkat acuan harus diukur dengan metodologi di sana, bukan ditebak.
8. **Multithreading.** Aktif hanya bila situs disajikan dengan header COOP/COEP (lihat public/_headers). Tanpa header, ONNX Runtime jatuh ke satu thread.
