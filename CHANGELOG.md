# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-11-14

### New features

- **Transcription in the browser.** Audio and video (wav, mp3, m4a, flac, ogg, mp4, mov, webm) are decoded to 16 kHz mono PCM and transcribed with Whisper ONNX (quantized) running as WebAssembly in a Web Worker.
- **Three models.** Tiny, Base (default), Small, downloaded on demand from Hugging Face and cached in the browser for offline reuse.
- **Bilingual interface.** English and Indonesian, with light and dark themes.
- **Output formats.** TXT, SRT, VTT, JSON (per-segment timestamps), with copy-to-clipboard and file download.
- **Batch queue.** Transcribe several files and download all results as a ZIP.
- **Installable PWA.** Web app manifest and service worker for offline use after the first model download.
- **Model manager.** See which models are cached, the storage used, and delete models you no longer want.
- **Live progress.** Per-window progress, streaming segments, cancellation between 30-second windows.

### Improvements

- **Self-hosted WASM binaries.** ONNX Runtime WASM is served from the site origin; no third-party CDN is used at runtime.
- **Strict Content-Security-Policy** with COOP/COEP headers (cross-origin isolation) in `public/_headers` and in local preview.
- **Crash-safe cancellation** by terminating and recreating the worker.
- **Low-memory notice** on devices reporting less than 4 GB of RAM.

### Bug fixes

- Fixed ONNX Runtime silently falling back to the jsdelivr CDN when WASM paths were set incorrectly; the site now serves only its own files.
- Fixed transcription hanging with no visible error when the worker failed to initialize; errors are now surfaced.
