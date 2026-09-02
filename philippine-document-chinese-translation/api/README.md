# Official Document Translation API

Incremental Cloudflare Worker backend for the existing static translation landing page.

## Current scope

- Provider abstractions for Google Document AI, Gemini OCR and Gemini fallback tasks.
- Enterprise OCR normalization with page, confidence, quality and 0–1 bounding boxes.
- Deterministic template mapping; Gemini classification is fallback-only.
- D1 audit/usage persistence. Google Drive remains the MVP source-file store; the Worker does not persist document bytes or raw Gemini responses.
- Idempotent authenticated processing endpoint and manual/reupload fallbacks.
- Anonymous fixtures and provider-free unit tests.

Gemini OCR is the selected MVP provider. It deliberately stores `confidence: null` because model-generated confidence is not equivalent to calibrated OCR confidence. The module is not connected to production intake yet. The only included template is an anonymous development fixture; the four real golden templates must be added after PII removal and field-schema approval.

`PERSIST_OCR_CONTENT=false` is the privacy-first default: D1 stores job status and usage, while OCR text, tokens and extracted fields are returned to the authorized Apps Script without being persisted by the Worker.

## Commands

```bash
npm install
npm run types
npm run lint
npm run typecheck
npm test
npm run build
```

Setup: see `docs/google-ai-setup.md`.
