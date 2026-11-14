<div align="center">
  <img src="public/icon.svg" alt="Logo Koe" width="120" />
  <h1>Koe: Transkripsi Privat di Browser Kamu</h1>
  <p><b>Ubah audio dan video menjadi teks di browser kamu, gratis dan tanpa batas,<br/>
  tanpa ada yang pernah diunggah. Privat sepenuhnya dan jalan offline dari awal.</b></p>

  <a href="https://github.com/nekonaru/koe/releases"><img src="https://img.shields.io/github/v/release/nekonaru/koe?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/nekonaru/koe/actions/workflows/ci.yml"><img src="https://github.com/nekonaru/koe/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-Web-3A4F85?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square" alt="Status" />
</div>

<br />

[English](README.md) | **Bahasa Indonesia**

> [!NOTE]
> koe tidak pernah mengirim audio kamu ke mana pun. Semua pemrosesan terjadi di dalam browser kamu, dan satu-satunya lalu lintas jaringan adalah unduhan opsional model Small.

---

## Daftar Isi

- [Tentang](#tentang)
- [Fitur](#fitur)
- [Kebutuhan](#kebutuhan)
- [Instalasi](#instalasi)
- [Penggunaan](#penggunaan)
- [Bahasa Tampilan](#bahasa-tampilan)
- [Sumber Data](#sumber-data)
- [Struktur Proyek](#struktur-proyek)
- [Pengembangan](#pengembangan)
- [Pengujian](#pengujian)
- [Keamanan](#keamanan)
- [Integrasi Berkelanjutan](#integrasi-berkelanjutan)
- [FAQ](#faq)
- [Penulis](#penulis)
- [Penafian](#penafian)
- [Lisensi](#lisensi)

---

## Tentang

**Koe** adalah aplikasi web statis yang mentranskripsi audio dan video menjadi teks sepenuhnya di browser kamu. Pilih file, pilih bahasa dan model, lalu dapatkan transkrip yang bisa disalin atau diunduh sebagai TXT, SRT, VTT, atau JSON. koe dibuat untuk mahasiswa, kreator konten, jurnalis, dan siapa pun di komputer pinjaman yang tidak bisa memasang aplikasi tetapi tetap butuh transkrip yang privat. Tidak ada akun dan tidak ada biaya per menit; satu-satunya server yang terlibat adalah server yang menyajikan file statis. Tiny dan Base sudah tertanam, jadi aplikasi jalan offline sejak kunjungan pertama.

> _"Suara kamu, ditranskrip di perangkat kamu, bukan di server orang lain."_

---

## Fitur

### Transkripsi

| Fitur | Deskripsi |
|-------|-----------|
| **Input audio dan video** | wav, mp3, m4a, flac, ogg, mp4, mov, webm lewat pemilihan file atau seret dan lepas |
| **Dekode di browser** | Media didekode dan di-resample ke PCM 16 kHz mono dengan Web Audio API |
| **Progress langsung** | Progress per jendela, waktu berjalan, dan segmen muncul bertahap |
| **Antrean batch** | Antrek beberapa file dan unduh semua hasil sebagai ZIP |
| **Pembatalan aman** | Batalkan di antara jendela 30 detik; worker dihentikan dan dibuat ulang |

### Keluaran

| Fitur | Deskripsi |
|-------|-----------|
| **Teks polos** | TXT untuk dibaca dan ditempel di mana saja |
| **Subtitle** | SRT dan VTT dengan timestamp per segmen yang akurat |
| **Data terstruktur** | JSON dengan timestamp mulai dan selesai per segmen dalam milidetik |
| **Salin dan unduh** | Satu klik ke clipboard, atau simpan format pilihan per file |
| **Ekspor ZIP** | Unduh semua transkrip selesai dalam satu arsip |

### Model

| Fitur | Deskripsi |
|-------|-----------|
| **Model Tiny** | Tertanam di koe, paling cepat, akurasi lebih rendah |
| **Model Base** | Tertanam di koe, seimbang antara kecepatan dan akurasi, default |
| **Model Small** | Paling akurat dari ketiganya, sekitar 242 MB, diunduh saat dibutuhkan, butuh memori lebih |
| **Bobot terkuantisasi** | Model Whisper ONNX yang terkuantisasi untuk penggunaan browser |
| **Pengelola model** | Lihat model mana yang tersimpan, total penyimpanan browser yang terpakai, dan hapus model yang tidak dibutuhkan |
| **Offline dari awal** | Tiny dan Base langsung jalan, bahkan offline, sejak halaman pertama |

### Antarmuka

| Fitur | Deskripsi |
|-------|-----------|
| **Inggris dan Indonesia** | Seluruh UI dalam dua bahasa, tersimpan antar sesi |
| **Tema terang dan gelap** | Tombol di header; mengikuti pilihan kamu, bukan sistem |
| **PWA yang bisa dipasang** | Tambahkan koe ke layar utama atau peluncur aplikasi |

### Privasi

| Fitur | Deskripsi |
|-------|-----------|
| **Tanpa backend** | Tidak ada server yang bisa menerima audio atau transkrip kamu |
| **Tanpa telemetri** | Tanpa analytics, tanpa cookie, tanpa akun |
| **CSP ketat** | Content-Security-Policy, header COOP dan COEP dikirim di `public/_headers` |

---

## Kebutuhan

| Dependency | Versi Minimum | Catatan |
|------------|---------------|---------|
| **Node.js** | 22.12 | Dibutuhkan hanya untuk build dari source |
| **npm** | 10 | Dibutuhkan hanya untuk build dari source |
| **Browser WebAssembly** | Chrome, Edge, Firefox, atau Safari terbaru | Android Chrome bisa dipakai dengan peringatan memori |

> [!TIP]
> Kamu tidak butuh Node.js untuk memakai koe. Node.js hanya dibutuhkan untuk membangun situs sendiri.

### Belum pernah pakai terminal? Mulai di sini

<details>
<summary><b>Cara membuka terminal di Windows</b></summary>

1. Tekan tombol **Windows**, ketik `PowerShell`, lalu tekan **Enter**
2. Jendela biru terbuka. Di situ kamu mengetik perintah
3. Setiap perintah `npm ...` atau `git ...` di panduan ini diketik di jendela itu, diikuti **Enter**

</details>

---

## Instalasi

Versi hosted sudah live di [nekonaru.github.io/koe](https://nekonaru.github.io/koe/). Tiny dan Base dimuat dari situ dan jalan offline setelah kunjungan pertama; GitHub Pages tidak bisa mengatur header COOP/COEP, jadi transkripsi jalan single-thread.

### Opsi A: Jalankan build produksi secara lokal (paling mudah)

1. Buka halaman [repository](https://github.com/nekonaru/koe), atau clone:

```bash
git clone https://github.com/nekonaru/koe.git
cd koe
```

2. Bangun situs:

```bash
npm install
npm run build
```

3. Sajikan secara lokal:

```bash
npm run preview
```

4. Buka `http://localhost:4173` di browser kamu.

> [!IMPORTANT]
> Langkah 2 dan 3 hanya dibutuhkan di mesin kamu sendiri. koe adalah situs statis, jadi host file statis mana pun cara kerjanya sama.

### Opsi B: Build dari source (untuk development / membaca atau mengubah kode)

#### 1. Ambil kode proyek

<details>
<summary><b>Saya sudah pasang Git</b></summary>

```bash
git clone https://github.com/nekonaru/koe.git
cd koe
```

</details>

<details>
<summary><b>Saya belum pasang Git</b></summary>

1. Buka halaman repository di GitHub
2. Klik tombol **Code**, pilih **Download ZIP**
3. Ekstrak ZIP ke folder pilihanmu
4. Di terminal, masuk ke folder hasil ekstrak, misalnya:

```bash
cd Downloads/koe-main
```

</details>

#### 2. Instal dependency dan verifikasi

```bash
npm install
npm run lint
npm test
npm run build
```

> [!IMPORTANT]
> `npm run lint` dan `npm test` harus lulus sebelum kamu mulai mengubah kode.

#### 3. Jalankan dev server

```bash
npm run dev
```

Dev server mencetak URL lokalnya (biasanya `http://localhost:5173`). Perubahan di source langsung diterapkan.

---

## Penggunaan

### Peluncuran pertama

1. Lepas file audio atau video ke drop zone, atau klik untuk memilih
2. Tunggu sampai antrean menampilkan file siap (durasi muncul)
3. Pilih bahasa (default **Indonesia**) dan model (default **Base**)
4. Klik **Mulai transkripsi** dan lihat segmen muncul bertahap
5. Setelah selesai, klik **Salin** atau **Unduh** (TXT, SRT, VTT, JSON)

> [!NOTE]
> Tiny dan Base tertanam di koe dan langsung jalan, bahkan offline. Small, yang terbesar, diunduh dari Hugging Face pada pemakaian pertama lalu tersimpan di cache.

### Penggunaan sehari-hari

- Antrek beberapa file sekaligus; hasil bisa diunduh satu per satu atau sebagai ZIP
- Batalkan transkripsi yang sedang berjalan kapan pun dan mulai ulang
- Hapus model tersimpan dari pengelola model saat ruang penyimpanan hampir habis
- Ganti bahasa dengan tombol **ID / EN** di header; pilihan tersimpan
- Ganti tema terang dan gelap di header

---

## Bahasa Tampilan

Antarmuka aplikasi (menu, tombol, pesan, dan pengaturan) tersedia dalam **Inggris** (default untuk sebagian besar browser) dan **Bahasa Indonesia**.

1. Klik tombol **ID / EN** di header
2. Seluruh antarmuka langsung beralih bahasa
3. Pilihan tersimpan antar sesi di browser yang sama

---

## Sumber Data

koe hanya butuh jaringan saat kamu memilih model Small:

| Tujuan | Sumber |
|--------|--------|
| Bobot model suara (Whisper ONNX) | Tertanam di koe untuk Tiny dan Base; Hugging Face (`onnx-community/whisper-small`) untuk Small, diunduh saat dibutuhkan |

> [!NOTE]
> Tiny dan Base dimuat dari perangkat kamu dan tidak pernah menyentuh jaringan. Small diunduh sekali ke cache browser kamu lalu dipakai offline.

---

## Struktur Proyek

```
koe/
├── src/
│   ├── main.tsx               # entry aplikasi, registrasi service worker
│   ├── App.tsx                # shell: header, navigasi, tema, footer
│   ├── audio/                 # dekode Web Audio dan resample ke PCM 16 kHz mono
│   ├── worker/                # worker transkripsi (Transformers.js, WASM)
│   ├── format/                # pembangun keluaran TXT, SRT, VTT, JSON
│   ├── model/                 # deteksi cache model dan pengelolaan penyimpanan
│   ├── i18n/                  # kamus en.json dan id.json
│   ├── components/            # Dropzone, ModelManager, Logo
│   └── pages/                 # Transcribe, About, Help
├── public/                    # ikon, manifest, service worker, _headers (termasuk models/)
├── scripts/                   # copy-ort.mjs, generate-icons.mjs
├── tests/                     # unit test Vitest
├── docs/                      # PRD, benchmark, lisensi pihak ketiga
├── LICENSE
├── README.md                  # dokumentasi utama (Inggris)
└── README.id.md               # dokumentasi (Bahasa Indonesia)
```

---

## Pengembangan

### Menambah string baru untuk pengguna

1. Tambahkan key ke `src/i18n/en.json` (Inggris) dan key yang sama ke `src/i18n/id.json` (Indonesia)
2. Pakai lewat `useI18n().t('your.key')`
3. `npm test` memeriksa kedua kamus tetap sinkron

### Membuat ulang ikon

```bash
npm run icons
```

Perintah ini merender ulang `public/icons/*.png` dari `public/icon.svg`. Commit hanya PNG finalnya.

> [!WARNING]
> File di dalam `public/ort/` disalin dari `onnxruntime-web` oleh `npm run build` (lihat `scripts/copy-ort.mjs`) dan tidak pernah di-commit manual.

---

## Pengujian

Verifikasi sebelum setiap push, keempatnya harus bersih:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

| Pemeriksaan | Syarat |
|-------------|--------|
| `npm run lint` | oxlint melaporkan nol masalah |
| `npm run typecheck` | `tsc -b` lolos tanpa error |
| `npm test` | Semua test lulus, termasuk paritas kamus i18n |
| `npm run build` | Build produksi berhasil |

Lint ditegakkan lewat `.oxlintrc.json` (plugin react, typescript, dan oxc).

---

## Keamanan

koe tidak punya backend, sehingga seluruh permukaan serangan sisi server hilang. Content-Security-Policy yang ketat serta header COOP dan COEP dikirim di `public/_headers`, sehingga worker dan WebAssembly berjalan di bawah cross-origin isolation. Satu-satunya koneksi keluar adalah ke situs statis itu sendiri (Tiny dan Base tertanam) dan, jika kamu memilih Small, ke huggingface.co untuk unduhan model.

> [!NOTE]
> Untuk melaporkan kerentanan secara privat, gunakan jalur di [`SECURITY.md`](SECURITY.md).

---

## Integrasi Berkelanjutan

| Workflow | Tujuan |
|----------|--------|
| `ci.yml` | Lint, typecheck, test, build, dan pemeriksaan em/en dash pada setiap push ke main dan setiap PR |

---

## FAQ

<details>
<summary><b>Apakah audio saya diunggah ke mana pun?</b></summary>

Tidak. koe tidak punya backend, dan semua pemrosesan terjadi di dalam browser kamu. Kamu bisa memantau panel network saat mentranskripsi: tidak ada yang keluar dari perangkat kamu.

</details>

<details>
<summary><b>Model mana yang harus saya pilih?</b></summary>

Tiny untuk kecepatan dan file pendek, Base untuk kebanyakan kasus (default), Small untuk akurasi terbaik saat perangkat kamu punya cukup memori.

</details>

<details>
<summary><b>Apakah jalan offline?</b></summary>

Ya. Tiny dan Base tertanam di koe dan jalan offline sejak halaman pertama, tanpa unduhan. Small diunduh sekali dari Hugging Face (sekitar 231 MB) lalu tersimpan untuk dipakai offline. koe bisa dipasang sebagai PWA.

</details>

<details>
<summary><b>Unduhan model Small gagal atau terputus. Sekarang bagaimana?</b></summary>

Klik **Unduh model** lagi. Unduhan dilanjutkan dari cache browser, dan tidak ada yang diunduh ulang tanpa perlu. Tiny dan Base tertanam dan tidak pernah butuh unduhan.

</details>

<details>
<summary><b>Model tertanam gagal dimuat. Apa yang harus saya lakukan?</b></summary>

Ini berarti file model di dalam aplikasi tidak bisa dibaca. Klik **Coba lagi** di sebelah pesan error. Jika masih gagal, bersihkan data situs ini (DevTools browser, tab Application, Storage, Clear site data) lalu muat ulang halaman. Jika Base masih gagal, pindah ke Tiny. Sebagai upaya terakhir, periksa sisa ruang penyimpanan dan coba lagi, karena model Tiny dan Base tertanam cukup besar dan disajikan dari aplikasi.

</details>

<details>
<summary><b>File saya sangat panjang atau tab crash. Apa yang bisa saya lakukan?</b></summary>

Audio didekode sepenuhnya di memori, jadi file sangat panjang butuh RAM besar. Pakai model Tiny atau Base, tutup tab lain, atau potong file lebih dulu. koe memberi peringatan pada perangkat dengan RAM kurang dari 4 GB.

</details>

<details>
<summary><b>Kenapa transkripsinya lambat?</b></summary>

WebAssembly multithreading butuh header cross-origin isolation, yang dikirim situs ini. Jika kamu hosting koe di platform yang tidak bisa mengatur header (seperti GitHub Pages), transkripsi tetap jalan di satu thread, hanya lebih lambat. Pakai Cloudflare Pages atau host statis lain yang bisa mengirim COOP/COEP.

</details>

---

## Penulis

<div align="center">

| [![Nicolas Dwi Dharma](https://github.com/nekonaru.png?size=100)](https://github.com/nekonaru) |
|:---:|
| **Nicolas Dwi Dharma** |
| [github.com/nekonaru](https://github.com/nekonaru) |

</div>

---

## Penafian

Whisper bisa menghasilkan teks yang tidak akurat atau mengarang, terutama pada keheningan. Periksa kembali transkrip sebelum dipakai untuk keperluan hukum, medis, atau keperluan kritis lainnya. Tiny dan Base tertanam dari repository Hugging Face `onnx-community`; Small diunduh dari sumber yang sama jika kamu memilihnya. Ketersediaan model tidak dijamin.

---

## Lisensi

Didistribusikan di bawah **MIT License**. Lihat [`LICENSE`](LICENSE) untuk informasi lebih lanjut.




