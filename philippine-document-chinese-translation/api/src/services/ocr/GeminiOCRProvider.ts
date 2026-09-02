import { z } from "zod";
import type { OCRInput, OCRProvider, OCRResult } from "./OCRProvider";

const tokenSchema = z.object({
  text: z.string(),
  box2d: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
});

const resultSchema = z.object({
  fullText: z.string(),
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    tokens: z.array(tokenSchema),
  })),
  qualityIssues: z.array(z.enum(["BLURRY", "LOW_RESOLUTION", "GLARE", "ROTATED", "DARK", "CUT_OFF"])),
});

type GeminiOCRConfig = {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
};

export class GeminiOCRProvider implements OCRProvider {
  readonly name = "GEMINI_VISION_OCR";
  readonly processorId: string;

  constructor(private readonly config: GeminiOCRConfig) {
    this.processorId = config.model;
  }

  async processDocument(input: OCRInput): Promise<OCRResult> {
    const fetcher = this.config.fetcher ?? fetch;
    const requestBody = JSON.stringify({
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: input.mimeType, data: arrayBufferToBase64(input.bytes) } },
        { text: OCR_PROMPT },
      ] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent`;
    let parsed: z.infer<typeof resultSchema> | undefined;
    let lastError = "GEMINI_OCR_FAILED";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.config.apiKey },
        body: requestBody,
      });
      if (response.ok) {
        try {
          const payload: unknown = await response.json();
          parsed = resultSchema.parse(JSON.parse(extractText(payload)));
          break;
        } catch {
          lastError = "GEMINI_OCR_INVALID_RESPONSE";
        }
      } else {
        lastError = `GEMINI_OCR_HTTP_${response.status}`;
        if (!RETRYABLE_STATUS.has(response.status)) throw new Error(lastError);
      }
      if (attempt < 2) await delay(500 * (attempt + 1));
    }
    if (!parsed) throw new Error(lastError);
    return {
      fullText: parsed.fullText,
      pages: parsed.pages.map((page) => ({
        pageNumber: page.pageNumber,
        width: null,
        height: null,
        tokens: page.tokens.map((token) => ({
          text: token.text,
          confidence: null,
          pageNumber: page.pageNumber,
          boundingBox: token.box2d ? normalizeBox2d(token.box2d) : null,
        })),
      })),
      quality: {
        issues: parsed.qualityIssues,
        // Gemini does not provide a calibrated OCR image-quality score.
        score: parsed.qualityIssues.length ? 0.5 : undefined,
      },
      rawResult: undefined,
    };
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const OCR_PROMPT = `Transcribe this official document without correcting, guessing, translating, or expanding text.
Return JSON only with: fullText, pages, and qualityIssues.
For each page return pageNumber and reading-order tokens. Each token must contain the exact visible text and box2d.
box2d is [ymin,xmin,ymax,xmax] normalized to integers from 0 to 1000; use null when uncertain.
qualityIssues may contain only BLURRY, LOW_RESOLUTION, GLARE, ROTATED, DARK, CUT_OFF.
Never invent obscured characters. Use the visible replacement character � when a character cannot be read.`;

function normalizeBox2d(box: [number, number, number, number]) {
  const [ymin, xmin, ymax, xmax] = box.map((value) => Math.min(1000, Math.max(0, value))) as [number, number, number, number];
  return { x: xmin / 1000, y: ymin / 1000, width: Math.max(0, xmax - xmin) / 1000, height: Math.max(0, ymax - ymin) / 1000 };
}

function extractText(value: unknown): string {
  if (typeof value !== "object" || value === null || !("candidates" in value)) throw new Error("GEMINI_OCR_EMPTY_RESPONSE");
  const candidates = (value as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("GEMINI_OCR_EMPTY_RESPONSE");
  return text;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
