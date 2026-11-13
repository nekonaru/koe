# Third-Party Licenses

Koe is MIT licensed. It builds on the following third-party software and assets.
Licenses are listed as published by each project at the time of writing (2026-11-14).

| Package | Version | License | Role |
| --- | --- | --- | --- |
| react, react-dom | 19.3.1 | MIT | UI framework |
| @huggingface/transformers | 4.3.2 | Apache-2.0 | Whisper pipeline, model loading |
| onnxruntime-web | 1.31.0-dev.20260914-8d85527a0 | MIT | ONNX inference backend (transitive) |
| onnxruntime-node | 1.30.0 | MIT | ONNX inference backend for Node (transitive, not shipped to browser) |
| jszip | 3.10.2 | MIT (chosen) | ZIP export for batch downloads |
| @fontsource/nunito | 5.3.0 | SIL Open Font License 1.1 | Self-hosted UI font |
| tailwindcss, @tailwindcss/vite | 4.3.5 | MIT | Styling |
| vite | 8.3.8 | MIT | Build tooling |
| @vitejs/plugin-react | 6.3.0 | MIT | Build tooling |
| vitest | 5.1.0 | MIT | Test runner |
| oxlint | 1.93.0 | MIT | Linter |
| typescript | 7.0.2 | Apache-2.0 | Type checking |
| sharp | 0.35.5 | Apache-2.0 | Icon generation (dev only) |

## Model weights

- Whisper weights by OpenAI, distributed via the Hugging Face repository
  `onnx-community/whisper-{tiny,base,small}`, licensed MIT.
- Whisper ONNX conversions by the onnx-community team.

## Whisper lineage

Whisper (OpenAI, MIT), whisper.cpp (ggml-org, MIT), and the ONNX Runtime (Microsoft, MIT).
Koe uses the Transformers.js pipeline at runtime; no part of whisper.cpp is
compiled into this site.
