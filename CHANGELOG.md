# Changelog

All notable changes to this project are documented in this file.

## v2.2.0

A polish and portability release: faster starts with templates, readable on more devices, and projects that can move between browsers.

### New features

- **Project templates.** Interview, lecture, podcast and meeting presets set language, model, task, format and display mode in one click.
- **Folder import.** Add every supported file from a folder in a single step.
- **Portable projects.** Export all projects as one JSON bundle and import it on another device.
- **High contrast and density.** Toggle contrast, compact spacing and text size from the command palette.
- **Shortcuts overlay.** Press ? for a keyboard reference.
- **Bilingual share view.** A shared read-only link can switch between original and translated text.

### Improvements

- **Page transitions.** Navigation uses view transitions where supported and stays instant under reduced motion.
- **Preference persistence.** Contrast, density and text size survive reloads.

### Bug fixes

- **No skipped transition errors.** Interrupted view transitions are handled without console errors.
## v2.1.0

Koe can now translate a finished transcript into Indonesian and several other languages, entirely on the device.

### New features

- **Indonesian translation.** Whisper first produces an English transcript, then an offline OPUS-MT model translates it into Indonesian. The model downloads once and stays cached.
- **More targets.** French, Spanish and German use the same two-stage path. A large multilingual NLLB option is available with an explicit size and license warning.
- **Bilingual view.** Switch between original, translated and side by side readings. Editing stays on the original so translations are never overwritten by hand.
- **Bilingual export.** SRT, VTT, CSV and Markdown can carry original and translated text together.
- **Project glossary.** List names and product terms that must survive translation unchanged.
- **Translation cache.** Identical segments are translated once and reused across runs.
- **Detected language.** The UI reports the language Whisper detected and lets you override it before transcribing.
- **Model credits.** The model manager lists every translation model with its source, size and license.

### Improvements

- **Two-stage clarity.** The settings panel explains why Indonesian needs a second model while English stays native to Whisper.
- **Local ONNX Runtime paths.** The translation worker uses the self-hosted WASM files, so the strict content security policy still applies.

### Bug fixes

- **No silent translation failure.** Translation progress, errors and completion are now reported in the result header.
## v2.0.0

A milestone release: the offline viewer becomes a full player, segment timing is editable, and model choices are easier to judge.

### New features

- **Viewer 2.0.** The standalone HTML page now includes karaoke words, transcript search, playback speed, chapter buttons, a light and dark toggle, and a print layout.
- **Segment trimming.** Focus mode exposes start and end time fields for each segment, so timing fixes do not require replaying the whole file.
- **Print transcript.** The result header prints a clean reading layout with the app chrome hidden.
- **Model recommendations.** The model manager marks the suggested model and shows offline readiness beside each bundled model.
- **Download estimate.** Model downloads show a rough remaining time derived from progress speed.

### Improvements

- **Viewer safety.** All exported titles, words and chapters are HTML escaped before they enter the standalone page.
- **Metadata in the ZIP.** Each archive keeps a settings file alongside the transcript, Markdown, chapters and viewer.

### Bug fixes

- **Export dependency fixed.** The standalone viewer now receives the current word timestamps and chapters instead of emitting an empty player.
## v1.9.0

Koe becomes a workspace: finished transcripts are saved on the device, editing has history, and a command palette reaches every action.

### New features

- **Project library.** Finished transcripts are stored in IndexedDB and can be reopened from Home or Projects with their settings and, when kept, their audio.
- **Autosave and project notes.** Name, notes and favorite state are saved automatically; finished work survives a reload.
- **Undo and redo.** Transcript edits, timestamp shifts, cleanup and find and replace are reversible.
- **Editor tools.** Find and replace with regex and case options, text cleanup, repeat detection, chapter building, speaker assignment, split and merge, and WAV clip export from an A-B range.
- **Export presets.** Markdown with chapters, short caption lines and clean paragraphs join the existing list of formats.
- **Share link.** A compressed read-only transcript travels in a URL hash; nothing is uploaded.
- **Command palette.** Ctrl K opens a searchable list of navigation and result actions.
- **Home and Projects pages.** Recent work, search, favorites, a storage meter and per project audio retention.

### Improvements

- **Design tokens and motion.** A single set of spacing, radius and timing variables drives the new surfaces; motion is opt-in under reduced motion settings.
- **Native dialogs.** The palette and first-run tip use the platform dialog element for focus handling and Esc dismissal.
- **Device profile.** The UI reports threads, memory and a suggested model, plus a data saver path that avoids automatic model warming.
- **Fuller ZIP bundle.** Exports now include Markdown, chapter text, settings metadata and the standalone viewer.

### Bug fixes

- **Share payloads are validated.** Malformed or oversized links are rejected before they are shown.
## v1.8.0

A focused release: karaoke word highlighting, spreadsheet export, and word-level timestamps that actually work on the bundled models.

### New features

- **Karaoke word mode.** Switch the subtitle style to Karaoke before transcribing and each word lights up as it is spoken, with auto-scroll. Works on every model.
- **CSV export.** A fifth output format with per-segment timestamps; opens cleanly in Excel via a BOM.
- **Silence trimming.** Near-silent 30-second windows are skipped instead of turned into hallucinated text.
- **Keyboard shortcuts.** Space toggles playback; / focuses the search box.
- **ZIP includes the viewer.** The archive now also carries each standalone viewer page, ready to share.

### Improvements

- **Word timestamps that work.** Bundled Tiny and Base now ship the timestamped exports (about 45 MB and 81 MB), and Small downloads the timestamped build too (about 254 MB). The previous bundles could not produce word-level timestamps.
- **Safer offline model cache.** The service worker fetches model files network-first and only caches sensible content types, so a stale or corrupt entry from an interrupted download is no longer served forever.
## v1.7.0

Big user-facing update: export a standalone transcript viewer, shift timestamps, install koe as a PWA, and pick light, dark or system mode.

### New features

- **Standalone viewer export.** A self-contained HTML page with the transcript and the original audio embedded as a data URI. Open it offline in any browser; no dependencies.
- **Timestamp shift.** Buttons to shift every segment earlier or later by 1 second; useful for recordings that began before the section you transcribed.
- **Install as a PWA.** When the browser offers it, an Install button appears in the header.
- **Theme: light, dark or system.** Three-way toggle with a keyboard-friendly label.

## v1.6.0

Big interactive update: visual waveform with click-to-seek, paste-from-clipboard input, re-transcribing with the current settings, and a words-per-minute readout.

### New features

- **Waveform with seek.** A canvas waveform renders above the transcript; click anywhere to jump the player to that position and see the playhead color fill.
- **Paste from the clipboard.** Press Ctrl+V anywhere on the page to drop in audio or video files (for example right after copying a recording).
- **Re-transcribe.** A finished file can be transcribed again with the current language and model without decoding again.
- **Words per minute.** The result footer now shows words, segments, and words per minute.

## v1.5.0

A much richer transcript experience: play along with the audio, search, edit in place, and better recovery from decode failures.

### New features

- **Playback sync.** Click Listen to hear the audio with the current segment highlighted; click any segment's timestamp to jump to it.
- **Search in transcripts.** Filter matches, dim non-matches, jump to the first hits; works per file.
- **Inline editing.** Edit any segment directly in the list; exports reflect your edits.
- **Word and segment stats.** The result footer shows word count and segment count.
- **Decode failure recovery.** Files that cannot be decoded now retry by re-decoding the original file.

## v1.4.0

Faster first use: Tiny is the default model, bundled models precache in the background, and the in-app guide and FAQ are richer.

### New features

- **In-app guide and FAQ.** A "How koe works" strip with four steps and an in-page FAQ covers first load, errors, offline use, model choice, privacy, and long files.
- **Model precaching on first visit.** The service worker caches the bundled Tiny and Base models in the background after the app loads, so repeat visits and offline use are instant.
- **Tiny is the default model.** About half the download of Base; fastest for everyday use.

## v1.3.0

Bundled models now load automatically once a file is added, so transcription starts without a manual step.

### New features

- **Auto-load on file drop.** When a file is added, the selected bundled model (Tiny or Base) starts loading in the background automatically; no Load model click is needed. Devices with less than 4 GB of RAM and the Small model are excluded from auto-loading; they require an explicit action.
- **No duplicate loads.** Concurrent model load requests are coalesced so only one load runs per model.

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
