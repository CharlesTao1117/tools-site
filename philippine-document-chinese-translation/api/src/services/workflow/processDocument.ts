import type { AIProvider, ClassificationResult } from "../ai/AIProvider";
import type { OCRInput, OCRProvider, OCRResult } from "../ocr/OCRProvider";
import { mapKnownTemplate, type StructuredField } from "../templates/templateMapper";

export type WorkflowConfig = { qualityReuploadThreshold: number; templateLowConfidenceThreshold: number; enableQualityCheck: boolean };
export type WorkflowResult = {
  status: "READY_FOR_REVIEW" | "HUMAN_REVIEW_REQUIRED" | "REUPLOAD_REQUIRED";
  ocr: OCRResult;
  templateKey: string | null;
  templateConfidence: number | null;
  fields: StructuredField[];
  classification: ClassificationResult | null;
  aiCalled: boolean;
};

export async function processDocument(
  input: OCRInput,
  ocrProvider: OCRProvider,
  aiProvider: AIProvider | null,
  config: WorkflowConfig,
): Promise<WorkflowResult> {
  const ocr = await ocrProvider.processDocument(input);
  if (config.enableQualityCheck && (ocr.quality?.score ?? 1) < config.qualityReuploadThreshold) {
    return { status: "REUPLOAD_REQUIRED", ocr, templateKey: null, templateConfidence: null, fields: [], classification: null, aiCalled: false };
  }
  const template = mapKnownTemplate(ocr);
  if (template && template.confidence >= config.templateLowConfidenceThreshold) {
    return { status: "READY_FOR_REVIEW", ocr, templateKey: template.templateKey, templateConfidence: template.confidence, fields: template.fields, classification: null, aiCalled: false };
  }
  if (!aiProvider) {
    return { status: "HUMAN_REVIEW_REQUIRED", ocr, templateKey: template?.templateKey ?? null, templateConfidence: template?.confidence ?? null, fields: template?.fields ?? [], classification: null, aiCalled: false };
  }
  try {
    const classification = await aiProvider.classifyDocument({ ocrText: ocr.fullText, pageCount: ocr.pages.length });
    return { status: "HUMAN_REVIEW_REQUIRED", ocr, templateKey: template?.templateKey ?? null, templateConfidence: template?.confidence ?? null, fields: template?.fields ?? [], classification, aiCalled: true };
  } catch {
    return { status: "HUMAN_REVIEW_REQUIRED", ocr, templateKey: template?.templateKey ?? null, templateConfidence: template?.confidence ?? null, fields: template?.fields ?? [], classification: null, aiCalled: true };
  }
}
