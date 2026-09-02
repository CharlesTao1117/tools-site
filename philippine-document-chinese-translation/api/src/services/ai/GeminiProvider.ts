import { z } from "zod";
import type {
  AIProvider, ClassificationInput, ClassificationResult, ExtractionInput, ExtractionResult,
  QAInput, QAResult, TranslationInput, TranslationResult,
} from "./AIProvider";

const classificationSchema = z.object({
  country: z.string().min(2).max(3),
  issuer: z.string().min(1),
  documentType: z.string().min(1),
  documentVersion: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
const extractionSchema = z.object({ fields: z.array(z.object({
  fieldKey: z.string().min(1), value: z.string(), confidence: z.number().min(0).max(1),
})) });
const translationSchema = z.object({ segments: z.array(z.object({
  key: z.string().min(1), translatedText: z.string(),
})) });
const qaSchema = z.object({ passed: z.boolean(), issues: z.array(z.string()) });

type GeminiConfig = {
  apiKey: string;
  classificationModel: string;
  extractionModel: string;
  translationModel: string;
  fetcher?: typeof fetch;
};

export class GeminiProvider implements AIProvider {
  readonly name = "GEMINI";
  constructor(private readonly config: GeminiConfig) {}

  classifyDocument(input: ClassificationInput): Promise<ClassificationResult> {
    return this.generate(this.config.classificationModel,
      `Classify this official document OCR. Return JSON only. Use unknown when uncertain. Pages: ${input.pageCount}\nOCR:\n${input.ocrText}`,
      classificationSchema);
  }
  extractUnknownFields(input: ExtractionInput): Promise<ExtractionResult> {
    return this.generate(this.config.extractionModel,
      `Extract only these unknown fields: ${input.requestedFields.join(", ")}. Return JSON only. OCR:\n${input.ocrText}`,
      extractionSchema);
  }
  translateUnknownSegments(input: TranslationInput): Promise<TranslationResult> {
    return this.generate(this.config.translationModel,
      `Translate only the supplied unknown segments to ${input.targetLanguage}. Preserve keys. Do not alter names, identifiers, or numbers. Return JSON only.\n${JSON.stringify(input.segments)}`,
      translationSchema);
  }
  qualityCheck(input: QAInput): Promise<QAResult> {
    return this.generate(this.config.translationModel,
      `Compare the aligned source and translation segments. Return JSON only with passed and issues.\n${JSON.stringify(input)}`,
      qaSchema);
  }

  private async generate<T>(model: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const fetcher = this.config.fetcher ?? fetch;
        const response = await fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": this.config.apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0 },
            }),
          },
        );
        if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
        const payload: unknown = await response.json();
        const text = getGeminiText(payload);
        return schema.parse(JSON.parse(text));
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw new Error(`AI_INVALID_RESPONSE: ${lastError?.message ?? "unknown"}`);
  }
}

function getGeminiText(value: unknown): string {
  if (typeof value !== "object" || value === null || !("candidates" in value)) throw new Error("GEMINI_EMPTY_RESPONSE");
  const candidates = (value as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return text;
}
