# koe

<p align="center">
  <img src="public/icon.svg" alt="Koe logo" width="128" height="128" />
</p>

**koe** (声, "voice") turns audio and video into text entirely in your browser.
Free, unlimited, and private. No accounts, no quotas, no uploads, no API keys.
After the speech model is downloaded once, koe works fully offline.

![CI](https://github.com/nekonaru/koe/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-2B3A67.svg)](LICENSE)

## Features

- **Private by architecture.** koe has no backend. Audio never leaves your device. Speech recognition runs as WebAssembly inside a Web Worker.
- **Free and unlimited.** No per-minute fees, subscriptions, or limits on file count or length.
- **Offline capable.** Once a model is downloaded, transcription works without a network connection. koe is also installable as a PWA.
- **Bilingual interface.** English and Indonesian, light and dark themes.
- **Batch processing.** Queue several files and download all transcripts at once as a ZIP.
- **Multiple output formats.** TXT (plain text), SRT and VTT (subtitles), JSON (per-segment timestamps).
- **Three models.** Tiny (fastest), Base (default), Small (most accurate), all quantized Whisper models from Hugging Face.

## How it works

1. Drop an audio or video file (wav, mp3, m4a, flac, ogg, mp4, mov, webm). It is decoded in the browser to 16 kHz mono PCM.
2. Pick a language (or auto-detect) and a model. The first use downloads the model from Hugging Face into your browser cache; after that it works offline.
3. koe transcribes in 30-second windows and streams segments to the page. Export as TXT, SRT, VTT, or JSON, or copy to the clipboard.

The only network requests koe ever makes are: loading this site, downloading the model you explicitly choose, and nothing else. No telemetry, no analytics.

## Development

Prerequisites: Node.js 22.12 or newer (Vite 8 requirement) and npm.

```bash
npm install          # install dependencies
npm run dev          # start the dev server
npm run build        # production build (also copies ONNX Runtime WASM into public/ort)
npm run preview      # serve the production build locally with production headers
npm test             # unit tests (Vitest)
npm run lint         # linter (oxlint)
npm run typecheck    # TypeScript check (tsc -b)
```

`npm run build` runs `scripts/copy-ort.mjs` first, which copies the ONNX Runtime Web WASM binaries from the installed package into `public/ort/` (git-ignored). The site serves them from its own origin, never from a CDN.

## Deployment

koe is a static site. It needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` response headers for best performance (SharedArrayBuffer), plus the Content-Security-Policy defined in `public/_headers`.

Recommended: **Cloudflare Pages** (free). Connect the GitHub repository with build command `npm run build` and output directory `dist`. The `public/_headers` file ships the required headers automatically. GitHub Pages cannot set custom headers and is not recommended.

## Browser support

Latest Chrome, Edge, Firefox, or Safari on desktop. Android Chrome works with a memory warning. iOS Safari is experimental. Without the COOP/COEP headers, transcription still works on a single thread.

## Project layout

```
src/audio        Web Audio decoding and resampling to 16 kHz mono PCM
src/worker       transcription Web Worker (Transformers.js + Whisper ONNX, WASM)
src/format       transcript output formats (TXT, SRT, VTT, JSON)
src/model        model cache detection and storage management
src/i18n         English and Indonesian dictionaries
public/          icons, manifest, service worker, response headers
docs/            PRD, benchmark methodology, third-party licenses
tests/           Vitest unit tests
```

## Privacy

koe makes no network requests other than loading its own static assets and downloading the model files you ask for from `huggingface.co` (and its CDN). You can verify this: open your browser's network panel and transcribe a file; no requests are made. koe has no backend, so there is nothing on any server to leak.

## Acknowledgements

- [Whisper](https://github.com/openai/whisper) by OpenAI (MIT)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) and ONNX Runtime by Microsoft (MIT)
- [Transformers.js](https://github.com/huggingface/transformers.js) by Hugging Face (Apache-2.0)
- Font: [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License), self-hosted

## License

[MIT](LICENSE)
