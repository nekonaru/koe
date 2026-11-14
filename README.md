<div align="center">
  <img src="public/icon.svg" alt="Koe logo" width="120" />
  <h1>Koe: Private Transcription in Your Browser</h1>
  <p><b>Transcribe audio and video to text in your browser, free and unlimited,<br/>
  with nothing ever uploaded. Fully private and works offline out of the box.</b></p>

  <a href="https://github.com/nekonaru/koe/releases"><img src="https://img.shields.io/github/v/release/nekonaru/koe?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/nekonaru/koe/actions/workflows/ci.yml"><img src="https://github.com/nekonaru/koe/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-Web-3A4F85?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square" alt="Status" />
</div>

<br />

**English** | [Bahasa Indonesia](README.id.md)

> [!NOTE]
> koe never sends your audio anywhere. All processing happens inside your browser, and the only network traffic is the optional on-demand download of the Small model.

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Display Language](#display-language)
- [Data Sources](#data-sources)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Security](#security)
- [Continuous Integration](#continuous-integration)
- [FAQ](#faq)
- [Author](#author)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## About

**Koe** is a static web app that transcribes audio and video to text entirely in your browser. Choose a file, pick a language and a model, and get a transcript you can copy or download as TXT, SRT, VTT or JSON. It is built for students, content creators, journalists and anyone on a borrowed computer who cannot install software but still needs a private transcript. There is no account and no per-minute fee; the only server involved is the one serving the static files. Tiny and Base are bundled, so the app works offline from the very first visit.

> _"Your voice, transcribed on your device, never on anyone's server."_

---

## Features

### Transcription

| Feature | Description |
|---------|-------------|
| **Audio and video input** | wav, mp3, m4a, flac, ogg, mp4, mov, webm via file picker or drag and drop |
| **In-browser decoding** | Media is decoded and resampled to 16 kHz mono PCM with the Web Audio API |
| **Live progress** | Per-window progress bar, elapsed time, and segments streaming in as they are transcribed |
| **Batch queue** | Queue several files and download all results as a ZIP |
| **Safe cancellation** | Cancel between 30-second windows; the worker is terminated and recreated |

### Output

| Feature | Description |
|---------|-------------|
| **Plain text** | TXT for reading and pasting anywhere |
| **Subtitles** | SRT and VTT with accurate per-segment timestamps |
| **Structured data** | JSON with per-segment start and end timestamps in milliseconds |
| **Copy and download** | One click to clipboard, or save the chosen format per file |
| **ZIP export** | Download every finished transcript in one archive |

### Models

| Feature | Description |
|---------|-------------|
| **Tiny model** | Bundled with koe, fastest, lowest accuracy |
| **Base model** | Bundled with koe, balanced speed and accuracy, the default |
| **Small model** | Most accurate of the three, about 242 MB, downloaded on demand, needs more memory |
| **Quantized weights** | Whisper ONNX models quantized for browser use |
| **Model manager** | See which models are cached, total browser storage used, and delete models you no longer need |
| **Offline out of the box** | Tiny and Base work immediately, even offline, after the first page load |

### Interface

| Feature | Description |
|---------|-------------|
| **English and Indonesian** | Full UI in both languages, remembered between sessions |
| **Light and dark themes** | Toggle in the header; follows your choice, not the system |
| **Installable PWA** | Add koe to your home screen or app launcher |

### Privacy

| Feature | Description |
|---------|-------------|
| **No backend** | There is no server that can receive your audio or transcript |
| **No telemetry** | No analytics, no cookies, no accounts |
| **Strict CSP** | Content-Security-Policy, COOP and COEP headers ship in `public/_headers` |

---

## Requirements

| Dependency | Minimum Version | Notes |
|------------|-----------------|-------|
| **Node.js** | 22.12 | Required only to build from source |
| **npm** | 10 | Required only to build from source |
| **WebAssembly browser** | Latest Chrome, Edge, Firefox, or Safari | Android Chrome works with a memory warning |

> [!TIP]
> You do not need Node.js to use koe. You only need it to build the site yourself.

### Never used a terminal? Start here

<details>
<summary><b>How to open a terminal on Windows</b></summary>

1. Press the **Windows** key, type `PowerShell`, then press **Enter**
2. A blue window opens. That is where you type commands
3. Every `npm ...` or `git ...` command in this guide is typed in that window, followed by **Enter**

</details>

---

## Installation

The hosted version is live at [nekonaru.github.io/koe](https://nekonaru.github.io/koe/). Tiny and Base load from that site and work offline after the first visit; GitHub Pages cannot set COOP/COEP headers, so transcription runs single-threaded.

### Option A: Run the production build locally (easiest)

1. Open the [repository](https://github.com/nekonaru/koe) page, or clone it:

```bash
git clone https://github.com/nekonaru/koe.git
cd koe
```

2. Build the site:

```bash
npm install
npm run build
```

3. Serve it locally:

```bash
npm run preview
```

4. Open `http://localhost:4173` in your browser.

> [!IMPORTANT]
> Steps 2 and 3 are required only on your own machine. koe is a static site, so any static file host works the same way.

### Option B: Build from source (for development / to read or change the code)

#### 1. Get the project code

<details>
<summary><b>I have Git installed</b></summary>

```bash
git clone https://github.com/nekonaru/koe.git
cd koe
```

</details>

<details>
<summary><b>I don't have Git</b></summary>

1. Open the repository page on GitHub
2. Click the **Code** button, choose **Download ZIP**
3. Extract the ZIP to a folder of your choice
4. In the terminal, go into the extracted folder, for example:

```bash
cd Downloads/koe-main
```

</details>

#### 2. Install dependencies and verify

```bash
npm install
npm run lint
npm test
npm run build
```

> [!IMPORTANT]
> `npm run lint` and `npm test` must pass before you start changing code.

#### 3. Start the dev server

```bash
npm run dev
```

The dev server prints the local URL (usually `http://localhost:5173`). Edits to the source are applied live.

---

## Usage

### First launch

1. Drop an audio or video file onto the drop zone, or click it to browse
2. Wait for the transcript queue to show the file as ready (duration appears)
3. Choose a language (default **Indonesian**) and a model (default **Base**, bundled with koe)
4. Click **Start transcription** and watch the segments stream in
5. When it is done, click **Copy** or **Download** (TXT, SRT, VTT, JSON)

> [!NOTE]
> Tiny and Base are bundled with koe and work immediately, even offline. Small, the largest, downloads from Hugging Face on first use and is then cached too.

### Everyday use

- Queue several files at once; results download individually or as a ZIP
- Cancel a running transcription at any time and start over
- Delete stored models from the model manager when you run low on space
- Switch languages with the **ID / EN** toggle in the header; the choice is remembered
- Toggle light and dark themes in the header

---

## Display Language

The app UI (menus, buttons, messages, and settings) is available in **English** (default for most browsers) and **Bahasa Indonesia**.

1. Click the **ID / EN** button in the header
2. The whole interface switches immediately
3. The choice is remembered between sessions on the same browser

---

## Data Sources

koe needs the network only when you choose the Small model:

| Purpose | Source |
|---------|--------|
| Speech model weights (Whisper ONNX) | Bundled with koe for Tiny and Base; Hugging Face (`onnx-community/whisper-small`) for Small, downloaded on demand |

> [!NOTE]
> Tiny and Base load from your device and never touch the network. Small is downloaded once into your browser cache and then used offline.

---

## Project Structure

```
koe/
├── src/
│   ├── main.tsx               # app entry, service worker registration
│   ├── App.tsx                # shell: header, nav, theme, footer
│   ├── audio/                 # Web Audio decode and resample to 16 kHz mono
│   ├── worker/                # transcription worker (Transformers.js, WASM)
│   ├── format/                # TXT, SRT, VTT, JSON output builders
│   ├── model/                 # model cache detection and storage management
│   ├── i18n/                  # en.json and id.json dictionaries
│   ├── components/            # Dropzone, ModelManager, Logo
│   └── pages/                 # Transcribe, About, Help
├── public/                    # icons, manifest, service worker, _headers
│   └── models/                # bundled Whisper Tiny and Base (ONNX, quantized)
├── scripts/                   # copy-ort.mjs, generate-icons.mjs
├── tests/                     # Vitest unit tests
├── docs/                      # PRD, benchmark, third-party licenses
├── LICENSE
├── README.md                  # main documentation (English)
└── README.id.md               # documentation (Bahasa Indonesia)
```

---

## Development

### Adding a new user-facing string

1. Add the key to `src/i18n/en.json` (English) and the same key to `src/i18n/id.json` (Indonesian)
2. Use it via `useI18n().t('your.key')`
3. `npm test` checks that both dictionaries stay in sync

### Generating the icons

```bash
npm run icons
```

This re-renders `public/icons/*.png` from `public/icon.svg`. Commit only the final PNGs.

> [!WARNING]
> Files inside `public/ort/` are copied from `onnxruntime-web` by `npm run build` (see `scripts/copy-ort.mjs`) and are never committed by hand.

---

## Testing

Verification before every push, all four must be clean:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

| Check | Requirement |
|-------|-------------|
| `npm run lint` | oxlint reports zero issues |
| `npm run typecheck` | `tsc -b` passes with no errors |
| `npm test` | All tests pass, including i18n dictionary parity |
| `npm run build` | Production build succeeds |

Lints are enforced through `.oxlintrc.json` (react, typescript and oxc plugins).

---

## Security

koe has no backend, which removes the whole server attack surface. A strict Content-Security-Policy, COOP and COEP headers ship in `public/_headers`, so the worker and WebAssembly run under cross-origin isolation. The only outbound connections are to the static site itself (Tiny and Base are bundled) and, if you choose Small, to huggingface.co for the model download.

> [!NOTE]
> To report a vulnerability privately, use the route in [`SECURITY.md`](SECURITY.md).

---

## Continuous Integration

| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Lint, typecheck, tests, build, and an en/em dash check on every push to main and on every PR |

---

## FAQ

<details>
<summary><b>Is my audio uploaded anywhere?</b></summary>

No. koe has no backend, and all processing happens inside your browser. You can watch the network panel while transcribing: nothing leaves your device.

</details>

<details>
<summary><b>Which model should I choose?</b></summary>

Tiny for speed and short files, Base for most use (the default), Small for the best accuracy when your device has enough memory.

</details>

<details>
<summary><b>Does it work offline?</b></summary>

Yes. Tiny and Base are bundled with koe and work offline from the very first page, no download needed. Small downloads once from Hugging Face (about 231 MB) and is then cached for offline use too. koe can be installed as a PWA.

</details>

<details>
<summary><b>The Small model download failed or was interrupted. What now?</b></summary>

Click **Download model** again. The download resumes from the browser cache, and nothing is re-downloaded unnecessarily. Tiny and Base are bundled and never need a download.

</details>

<details>
<summary><b>The bundled model fails to load. What do I do?</b></summary>

This means the model files in the app could not be read. Click **Retry** next to the error. If it keeps failing, clear this site's data (browser DevTools, Application tab, Storage, Clear site data) and reload the page. If Base still fails, switch to Tiny. As a last resort, check your disk space and try again, since the bundled Tiny and Base models are large files served from the app.

</details>

<details>
<summary><b>My file is very long or the tab crashes. What can I do?</b></summary>

Audio is decoded fully in memory, so very long files need a lot of RAM. Use the Tiny or Base model, close other tabs, or trim the file first. koe warns on devices reporting less than 4 GB of RAM.

</details>

<details>
<summary><b>Why is transcription slow?</b></summary>

Multi-threaded WebAssembly needs cross-origin isolation headers, which this site sends. If you host koe on a platform that cannot set headers (like GitHub Pages), transcription still works on a single thread, just slower. Note the bundled Tiny and Base model files are larger than 25 MB each, so Cloudflare Pages cannot host them as site assets; deploy to GitHub Pages (100 MB file limit, single-threaded WASM) or to another static host without a small per-file limit and with COOP/COEP support.

</details>

---

## Author

<div align="center">

| [![Nicolas Dwi Dharma](https://github.com/nekonaru.png?size=100)](https://github.com/nekonaru) |
|:---:|
| **Nicolas Dwi Dharma** |
| [github.com/nekonaru](https://github.com/nekonaru) |

</div>

---

## Disclaimer

Whisper can produce inaccurate or fabricated text, especially on silence. Review transcripts before using them for legal, medical, or other critical purposes. Tiny and Base are bundled from the `onnx-community` Hugging Face repositories; Small is downloaded from the same source if you choose it. Model availability is not guaranteed.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
