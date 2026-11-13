# Benchmark

RTF (real-time factor) = processing time / audio duration. An RTF below 1.0 means
faster than real time.

## Reference machine

Development machine of the author (Windows 11, WASM backend, no GPU). Numbers are
invalid for other hardware; rerun the procedure below for your own device.

## Methodology

1. Build and serve the site: `npm run build && npm run preview`.
2. Prepare a reference audio clip of known duration (example: the JFK "ask not
   what your country can do for you" clip, 11.0 s, English).
3. In the browser: select the model, wait for it to become ready.
4. Start transcription and record the wall-clock time from clicking Start to the
   Done badge. This includes one inference pass over the whole file.
5. RTF = seconds measured / audio duration in seconds.

## Results

| Date       | Machine      | Browser        | Model | Audio | Time | RTF  |
|------------|--------------|----------------|-------|-------|------|------|
| 2026-11-14 | Dev machine  | Chromium (WASM)| tiny  | 11.0 s| ~3 s | ~0.3 |

The measurement above is an informal single-run development check, not a
standardized benchmark. Treat it as a rough orientation only. Numbers for Base
and Small have not been measured yet and are intentionally left out rather than
invented.

## How to measure for your device

Follow the methodology above with each model and record the results in the table.
For a fair comparison use the same audio clip, warm cache, and no other heavy
load on the machine.
