# Google Document AI + Gemini setup

This Worker keeps OCR and AI credentials server-side. Do not add secrets to the static site, `wrangler.jsonc`, Git, D1, or application logs.

## Google Document AI

1. Create or select a Google Cloud project and enable billing.
2. Enable the Document AI API.
3. In Processor Gallery, create an **Enterprise Document OCR** processor.
4. Choose and record its location. `asia-southeast1` is the initial recommendation for this service; verify current processor availability and data-residency requirements.
5. Record the Project ID and Processor ID.
6. Create a dedicated service account and grant only `roles/documentai.apiUser`.
7. Create a service-account JSON key only if Workload Identity Federation is not available for the deployment. Store the email and PKCS#8 private key as Worker secrets.

Non-secret configuration in `wrangler.jsonc`:

```text
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_LOCATION
GOOGLE_DOCUMENT_AI_PROCESSOR_ID
```

Secrets:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```

## Gemini

1. Create a Gemini API key in Google AI Studio for development, or use the organization-approved Google AI credential flow.
2. Store it as a Worker secret: `npx wrangler secret put GEMINI_API_KEY`.
3. Set classification, extraction, and translation model names through the three `GEMINI_MODEL_*` vars.
4. Turn on `ENABLE_GEMINI` only after the mock and real classification checks pass.

For the MVP, `OCR_PROVIDER=gemini` and `ENABLE_GEMINI_OCR=true` route PDF/JPG/PNG directly to Gemini multimodal understanding. Gemini returns structured text and approximate 0–1 bounding boxes; confidence remains `null`, and critical fields require customer or human confirmation.

Gemini is called only for unknown documents, unknown template versions, or low template confidence. Known high-confidence templates use OCR plus deterministic template rules.

## Cloudflare resources

1. Create a dedicated D1 database and replace the placeholder database ID in `wrangler.jsonc`.
2. Apply migrations with `npx wrangler d1 migrations apply official-document-translation --remote`.
3. Add `ADMIN_API_KEY` with `npx wrangler secret put ADMIN_API_KEY`.
4. Run `npm run types` after changing bindings.

R2 is intentionally not required for the Google Form MVP. The uploaded file remains in private Google Drive, is passed through the Worker to Gemini, and is not stored again by the Worker.

## Local development

Copy `.env.example` to `.dev.vars`, fill test credentials, and never commit that file. Keep both provider feature flags off for unit tests. The test suite uses anonymous mock providers and does not call Google.

## Real OCR smoke test

Use an anonymous one- or two-page PDF/JPEG/PNG, then call the authenticated endpoint:

```bash
curl -X POST http://127.0.0.1:8787/v1/documents/process \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Idempotency-Key: demo-ocr-001" \
  -F "file=@demo-certificate.pdf;type=application/pdf"
```

Verify that the response contains page count, status, quality, template decision and normalized field bounding boxes. Verify D1 usage rows and private R2 objects without printing OCR text.

## Review UI contract

Each returned field includes `pageNumber` and a 0–1 `boundingBox`. The viewer converts it to CSS percentages: `left=x*100%`, `top=y*100%`, `width=width*100%`, `height=height*100%`. Selecting a field changes page, scrolls to the box, and highlights it. A missing box must not block review.
