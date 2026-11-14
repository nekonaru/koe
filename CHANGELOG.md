# Changelog

All notable changes to this project are documented in this file.

## v1.2.0

Resilience release: model load failures now recover in-app with a Retry button and guided steps.

### New features

- **In-app recovery for model load failures.** The item error now shows a Retry button and the raw failure detail; the Bantuan page has a Model failed to load section with concrete steps to recover.
- **Bundled models never hit the network.** Tiny and Base load strictly from the site's own origin; missing or stale files fail fast with a clear message instead of hanging.
- **Cache hygiene for bundled models.** Stale remote cache entries matching bundled models are cleared once on first load so a previously interrupted download cannot shadow the bundled copy.

## v1.1.1

Bug fixes for concurrent queue runs and clearer load error messaging.

### Bug fixes

- **Queue desync on rapid starts.** Fixed clicking several Start buttons in quick succession leaving the queue permanently stuck; only one transcription is in flight at a time and Start buttons disable while another is running.
- **Load error wording.** The model failure message now says the model could not be loaded instead of implying a network download problem.

## v1.1.0

Free, unlimited, private transcription of audio and video to text in your browser, now with Tiny and Base bundled so it works offline from the very first page.

### New features

- **Bundled models.** Tiny and Base (default) ship inside the site under `public/models`, loaded from your own origin; no download is needed and they work fully offline on first visit.

### Improvements

- **Model manager updated.** Tiny and Base show as included in the app and cannot be deleted; only Small appears as on-demand.

## v1.0.0

Free, unlimited, private transcription of audio and video to text, entirely in your browser, offline after the first model download.

### New features

- **Transcription in the browser.** Audio and video (wav, mp3, m4a, flac, ogg, mp4, mov, webm) are decoded to 16 kHz mono PCM and transcribed with Whisper ONNX (quantized) running as WebAssembly in a Web Worker.
- **Three models.** Tiny, Base (default) and Small, downloaded on demand from Hugging Face and cached in the browser for offline reuse.
- **Bilingual interface.** English and Indonesian, with light and dark themes.
- **Output formats.** TXT, SRT, VTT, JSON (per-segment timestamps), with copy to clipboard and file download.
- **Batch queue.** Transcribe several files and download all results as a ZIP.
- **Installable PWA.** Web app manifest and service worker for offline use after the first model download.
- **Model manager.** See which models are cached, how much storage is used, and delete models you no longer need.
- **Live progress.** Per-window progress, streaming segments, cancellation between 30-second windows.

### Improvements

- **Self-hosted WASM binaries.** ONNX Runtime WASM is served from the site origin; no third-party CDN is used at runtime.
- **Strict Content-Security-Policy** with COOP/COEP headers (cross-origin isolation) in `public/_headers` and in local preview.
- **Crash-safe cancellation** by terminating and recreating the worker.
- **Low-memory notice** on devices reporting less than 4 GB of RAM.

### Bug fixes

- **WASM path fallback.** Fixed ONNX Runtime silently falling back to the jsdelivr CDN when WASM paths were set incorrectly; the site now serves only its own files.
- **Silent init failure.** Fixed transcription hanging with no visible error when the worker failed to initialize; errors are now surfaced.
