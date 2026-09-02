export type ClassificationInput = { ocrText: string; pageCount: number };
export type ClassificationResult = {
  country: string;
  issuer: string;
  documentType: string;
  documentVersion: string;
  confidence: number;
};
export type ExtractionInput = { ocrText: string; requestedFields: string[] };
export type ExtractedUnknownField = { fieldKey: string; value: string; confidence: number };
export type ExtractionResult = { fields: ExtractedUnknownField[] };
export type TranslationInput = { segments: Array<{ key: string; text: string }>; targetLanguage: "zh-TW" | "zh-CN" };
export type TranslationResult = { segments: Array<{ key: string; translatedText: string }> };
export type QAInput = { sourceSegments: string[]; translatedSegments: string[] };
export type QAResult = { passed: boolean; issues: string[] };

export interface AIProvider {
  readonly name: string;
  classifyDocument(input: ClassificationInput): Promise<ClassificationResult>;
  extractUnknownFields(input: ExtractionInput): Promise<ExtractionResult>;
  translateUnknownSegments(input: TranslationInput): Promise<TranslationResult>;
  qualityCheck(input: QAInput): Promise<QAResult>;
}
