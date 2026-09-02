import { GeminiProvider } from "./services/ai/GeminiProvider";
import { GoogleDocumentAIProvider } from "./services/ocr/GoogleDocumentAIProvider";
import { GeminiOCRProvider } from "./services/ocr/GeminiOCRProvider";
import type { OCRProvider } from "./services/ocr/OCRProvider";
import type { SupportedMimeType } from "./services/ocr/OCRProvider";
import { processDocument } from "./services/workflow/processDocument";
import { completeJob, createJob, failJob, findJobByIdempotencyKey, recordAiUsage } from "./persistence/ocrRepository";
import type { WorkerEnv } from "./env";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set<SupportedMimeType>(["application/pdf", "image/jpeg", "image/png"]);

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return corsResponse(env, new Response(null, { status: 204 }));
    if (url.pathname === "/health" && request.method === "GET") {
      return corsResponse(env, Response.json({ ok: true, providers: {
        ocrProvider: env.OCR_PROVIDER, documentAI: enabled(env.ENABLE_GOOGLE_DOCUMENT_AI),
        geminiOcr: enabled(env.ENABLE_GEMINI_OCR), gemini: enabled(env.ENABLE_GEMINI),
      } }));
    }
    if (url.pathname === "/v1/documents/process" && request.method === "POST") {
      if (!(await authorized(request, env.ADMIN_API_KEY))) return corsResponse(env, Response.json({ error: "UNAUTHORIZED" }, { status: 401 }));
      return corsResponse(env, await handleProcess(request, env));
    }
    return corsResponse(env, Response.json({ error: "NOT_FOUND" }, { status: 404 }));
  },
} satisfies ExportedHandler<WorkerEnv>;

async function handleProcess(request: Request, env: WorkerEnv): Promise<Response> {
  const selectedOCRProvider = String(env.OCR_PROVIDER);
  if (selectedOCRProvider === "google_document_ai" && !enabled(env.ENABLE_GOOGLE_DOCUMENT_AI)) {
    return Response.json({ error: "DOCUMENT_AI_DISABLED" }, { status: 503 });
  }
  if (selectedOCRProvider === "gemini" && !enabled(env.ENABLE_GEMINI_OCR)) {
    return Response.json({ error: "GEMINI_OCR_DISABLED" }, { status: 503 });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 128_000) return Response.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  const form = await request.formData();
  const uploaded = form.get("file");
  if (!(uploaded instanceof File)) return Response.json({ error: "FILE_REQUIRED" }, { status: 400 });
  if (uploaded.size > MAX_UPLOAD_BYTES) return Response.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  if (!ALLOWED_MIME_TYPES.has(uploaded.type as SupportedMimeType)) return Response.json({ error: "INVALID_MIME_TYPE" }, { status: 415 });
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await findJobByIdempotencyKey(env.TRANSLATION_DB, idempotencyKey);
    if (existing) return Response.json({ jobId: existing.id, status: existing.status, idempotentReplay: true }, { status: 200 });
  }
  const jobId = crypto.randomUUID();
  const orderId = stringValue(form.get("orderId"));
  const orderItemId = stringValue(form.get("orderItemId"));
  const bytes = await uploaded.arrayBuffer();
  const ocrProvider = createOCRProvider(env);
  await createJob(env.TRANSLATION_DB, { id: jobId, idempotencyKey, orderId, orderItemId,
    provider: ocrProvider.name, processorId: ocrProvider.processorId, sourceObjectKey: `google-drive-transfer://${jobId}` });
  try {
    const aiProvider = enabled(env.ENABLE_GEMINI) ? new GeminiProvider({
      apiKey: env.GEMINI_API_KEY, classificationModel: env.GEMINI_MODEL_CLASSIFICATION,
      extractionModel: env.GEMINI_MODEL_EXTRACTION, translationModel: env.GEMINI_MODEL_TRANSLATION,
    }) : null;
    const result = await processDocument({ bytes, mimeType: uploaded.type as SupportedMimeType }, ocrProvider, aiProvider, {
      qualityReuploadThreshold: numberConfig(env.OCR_QUALITY_REUPLOAD_THRESHOLD, 0.55),
      templateLowConfidenceThreshold: numberConfig(env.TEMPLATE_LOW_CONFIDENCE_THRESHOLD, 0.8),
      enableQualityCheck: enabled(env.ENABLE_OCR_QUALITY_CHECK),
    });
    await completeJob(env.TRANSLATION_DB, jobId, null,
      result.status === "REUPLOAD_REQUIRED" ? "REUPLOAD_REQUIRED" : "OCR_COMPLETED",
      result.ocr, result.fields, { provider: ocrProvider.name, orderId, orderItemId },
      enabled(env.PERSIST_OCR_CONTENT));
    if (result.aiCalled) await recordAiUsage(env.TRANSLATION_DB, env.GEMINI_MODEL_CLASSIFICATION, "DOCUMENT_CLASSIFICATION", orderId, orderItemId);
    return Response.json({
      jobId, status: result.status, pageCount: result.ocr.pages.length, quality: result.ocr.quality,
      templateKey: result.templateKey, templateConfidence: result.templateConfidence,
      classification: result.classification, fields: result.fields,
    }, { status: result.status === "REUPLOAD_REQUIRED" ? 422 : 200 });
  } catch (error) {
    const code = safeErrorCode(error);
    await failJob(env.TRANSLATION_DB, jobId, code);
    console.error(JSON.stringify({ message: "document processing failed", jobId, errorCode: code }));
    return Response.json({ jobId, status: "OCR_FAILED", error: code }, { status: 502 });
  }
}

function createOCRProvider(env: WorkerEnv): OCRProvider {
  if (String(env.OCR_PROVIDER) === "gemini") {
    return new GeminiOCRProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_OCR_MODEL });
  }
  return new GoogleDocumentAIProvider({
    projectId: env.GOOGLE_CLOUD_PROJECT_ID, location: env.GOOGLE_CLOUD_LOCATION,
    processorId: env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID, serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    serviceAccountPrivateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  });
}

function stringValue(value: FormDataEntryValue | null): string | null { return typeof value === "string" && value ? value : null; }
function enabled(value: string): boolean { return value.toLowerCase() === "true"; }
function numberConfig(value: string, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "PROVIDER_ERROR";
  return /^(DOCUMENT_AI|GOOGLE_AUTH|AI_|GEMINI)_[A-Z0-9_]+$/.test(message) ? message : "PROVIDER_ERROR";
}
async function authorized(request: Request, expected: string): Promise<boolean> {
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const encoder = new TextEncoder();
  const actualHash = await crypto.subtle.digest("SHA-256", encoder.encode(actual));
  const expectedHash = await crypto.subtle.digest("SHA-256", encoder.encode(expected));
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0 && actual.length > 0;
}
function corsResponse(env: WorkerEnv, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", env.ALLOWED_ORIGIN);
  headers.set("access-control-allow-headers", "authorization,content-type,idempotency-key");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
