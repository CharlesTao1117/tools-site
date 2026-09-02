import type { NormalizedBoundingBox, OCRResult, OCRToken } from "../ocr/OCRProvider";

export type ExtractionSource = "TEMPLATE_RULE" | "GEMINI" | "MANUAL" | "CUSTOMER";
export type StructuredField = {
  fieldKey: string;
  rawValue: string;
  normalizedValue: string;
  renderedValue: string;
  ocrConfidence: number | null;
  templateMappingConfidence: number;
  pageNumber: number;
  boundingBox: NormalizedBoundingBox | null;
  extractionSource: ExtractionSource;
  warnings: string[];
};
export type TemplateMatch = { templateKey: string; confidence: number; fields: StructuredField[] };

type TemplateRule = {
  key: string;
  requiredPhrases: string[];
  fields: Array<{ fieldKey: string; label: string; pattern: RegExp }>;
};

const RULES: TemplateRule[] = [{
  key: "demo_certificate_v1",
  requiredPhrases: ["DEMO CERTIFICATE", "DOCUMENT NO"],
  fields: [
    { fieldKey: "person_name", label: "NAME", pattern: /NAME\s*:\s*([^\n]+)/i },
    { fieldKey: "date", label: "DATE", pattern: /DATE\s*:\s*([^\n]+)/i },
    { fieldKey: "document_number", label: "DOCUMENT NO", pattern: /DOCUMENT NO\s*:\s*([^\n]+)/i },
  ],
}];

export function mapKnownTemplate(ocr: OCRResult): TemplateMatch | null {
  const upper = ocr.fullText.toUpperCase();
  const candidates = RULES.map((rule) => ({
    rule,
    phraseScore: rule.requiredPhrases.filter((phrase) => upper.includes(phrase)).length / rule.requiredPhrases.length,
  })).sort((a, b) => b.phraseScore - a.phraseScore);
  const best = candidates[0];
  if (!best || best.phraseScore < 0.8) return null;
  const fields = best.rule.fields.flatMap((fieldRule) => {
    const match = ocr.fullText.match(fieldRule.pattern);
    if (!match?.[1]) return [];
    const rawValue = match[1].trim();
    const token = findValueToken(ocr, rawValue);
    return [{
      fieldKey: fieldRule.fieldKey,
      rawValue,
      normalizedValue: rawValue,
      renderedValue: rawValue,
      ocrConfidence: token?.confidence ?? null,
      templateMappingConfidence: token ? 0.95 : 0.82,
      pageNumber: token?.pageNumber ?? 1,
      boundingBox: token?.boundingBox ?? null,
      extractionSource: "TEMPLATE_RULE" as const,
      warnings: ambiguityWarnings(rawValue, token?.confidence ?? null),
    }];
  });
  const fieldCoverage = fields.length / best.rule.fields.length;
  return { templateKey: best.rule.key, confidence: best.phraseScore * 0.6 + fieldCoverage * 0.4, fields };
}

function findValueToken(ocr: OCRResult, value: string): OCRToken | undefined {
  const normalized = value.replace(/\s+/g, " ").trim().toUpperCase();
  return ocr.pages.flatMap((page) => page.tokens).find((token) =>
    token.text.replace(/\s+/g, " ").trim().toUpperCase() === normalized,
  );
}

function ambiguityWarnings(value: string, confidence: number | null): string[] {
  if (confidence === null || confidence >= 0.85 || !/[O0I1lB8S5]/.test(value)) return [];
  return ["POSSIBLE_OCR_CHARACTER_AMBIGUITY"];
}
