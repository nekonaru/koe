# koe

<p align="center">
  <img src="public/icon.svg" alt="Logo Koe" width="128" height="128" />
</p>

**koe** (声, "suara") mengubah audio dan video menjadi teks sepenuhnya di browser kamu.
Gratis, tanpa batas, dan privat. Tanpa akun, tanpa kuota, tanpa unggahan, tanpa API key.
Setelah model suara diunduh sekali, koe jalan sepenuhnya offline.

![CI](https://github.com/nekonaru/koe/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-2B3A67.svg)](LICENSE)

## Fitur

- **Privat secara arsitektur.** koe tidak punya backend. Audio tidak pernah meninggalkan perangkat kamu. Pengenalan suara berjalan sebagai WebAssembly di dalam Web Worker.
- **Gratis dan tanpa batas.** Tidak ada biaya per menit, langganan, atau batas jumlah maupun durasi file.
- **Jalan offline.** Setelah model diunduh, transkripsi jalan tanpa koneksi internet. koe juga bisa dipasang sebagai PWA.
- **Antarmuka dwibahasa.** Inggris dan Indonesia, tema terang dan gelap.
- **Pemrosesan batch.** Antrek banyak file dan unduh semua transkrip sekaligus sebagai ZIP.
- **Beragam format keluaran.** TXT (teks polos), SRT dan VTT (subtitle), JSON (timestamp per segmen).
- **Tiga model.** Tiny (paling cepat), Base (default), Small (paling akurat), semua model Whisper terkuantisasi dari Hugging Face.

## Cara kerja

1. Lepas file audio atau video (wav, mp3, m4a, flac, ogg, mp4, mov, webm). File didekode di browser menjadi PCM 16 kHz mono.
2. Pilih bahasa (atau deteksi otomatis) dan model. Pemakaian pertama mengunduh model dari Hugging Face ke cache browser; setelah itu jalan offline.
3. koe mentranskripsi per jendela 30 detik dan menampilkan segmen secara bertahap. Ekspor sebagai TXT, SRT, VTT, atau JSON, atau salin ke clipboard.

Satu-satunya permintaan jaringan yang pernah dilakukan koe adalah: memuat situs ini, mengunduh model yang kamu pilih secara eksplisit, dan tidak ada yang lain. Tanpa telemetri, tanpa analytics.

## Pengembangan

Prasyarat: Node.js 22.12 atau lebih baru (syarat Vite 8) dan npm.

```bash
npm install          # instal dependensi
npm run dev          # jalankan server pengembangan
npm run build        # build produksi (sekaligus menyalin WASM ONNX Runtime ke public/ort)
npm run preview      # sajikan build produksi dengan header produksi
npm test             # unit test (Vitest)
npm run lint         # linter (oxlint)
npm run typecheck    # pemeriksaan TypeScript (tsc -b)
```

`npm run build` menjalankan `scripts/copy-ort.mjs` lebih dulu, yang menyalin binary WASM ONNX Runtime Web dari paket yang terinstal ke `public/ort/` (tidak di-git). Situs menyajikannya dari origin sendiri, bukan dari CDN.

## Deployment

koe adalah situs statis. Situs membutuhkan header `Cross-Origin-Opener-Policy: same-origin` dan `Cross-Origin-Embedder-Policy: require-corp` untuk performa terbaik (SharedArrayBuffer), ditambah Content-Security-Policy yang didefinisikan di `public/_headers`.

Direkomendasikan: **Cloudflare Pages** (gratis). Hubungkan repository GitHub dengan build command `npm run build` dan output directory `dist`. File `public/_headers` mengirim header yang dibutuhkan secara otomatis. GitHub Pages tidak bisa mengatur header custom dan tidak direkomendasikan.

## Browser yang didukung

Chrome, Edge, Firefox, atau Safari versi terbaru di desktop. Android Chrome bisa dipakai dengan peringatan memori. iOS Safari masih eksperimental. Tanpa header COOP/COEP, transkripsi tetap jalan di satu thread.

## Struktur proyek

```
src/audio        Dekode Web Audio dan resample ke PCM 16 kHz mono
src/worker       Web Worker transkripsi (Transformers.js + Whisper ONNX, WASM)
src/format       Format keluaran transkrip (TXT, SRT, VTT, JSON)
src/model        Deteksi cache model dan pengelolaan penyimpanan
src/i18n         Kamus Inggris dan Indonesia
public/          Ikon, manifest, service worker, response headers
docs/            PRD, metodologi benchmark, lisensi pihak ketiga
tests/           Unit test Vitest
```

## Privasi

koe tidak membuat permintaan jaringan selain memuat aset statis miliknya dan mengunduh file model yang kamu minta dari `huggingface.co` (dan CDN-nya). Kamu bisa memeriksa ini sendiri: buka panel network browser dan transkrip sebuah file; tidak ada permintaan yang terjadi. koe tidak punya backend, jadi tidak ada apa pun di server mana pun yang bisa bocor.

## Ucapan terima kasih

- [Whisper](https://github.com/openai/whisper) oleh OpenAI (MIT)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) dan ONNX Runtime oleh Microsoft (MIT)
- [Transformers.js](https://github.com/huggingface/transformers.js) oleh Hugging Face (Apache-2.0)
- Font: [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License), di-host sendiri

## Lisensi

[MIT](LICENSE)
