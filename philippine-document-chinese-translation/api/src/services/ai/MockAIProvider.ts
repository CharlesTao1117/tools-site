import type { AIProvider, ClassificationInput, ClassificationResult, ExtractionInput, ExtractionResult, QAInput, QAResult, TranslationInput, TranslationResult } from "./AIProvider";

export class MockAIProvider implements AIProvider {
  readonly name = "MOCK_AI";
  calls = { classify: 0, extract: 0, translate: 0, qa: 0 };
  constructor(private readonly classification: ClassificationResult) {}
  async classifyDocument(_input: ClassificationInput): Promise<ClassificationResult> { this.calls.classify += 1; return this.classification; }
  async extractUnknownFields(_input: ExtractionInput): Promise<ExtractionResult> { this.calls.extract += 1; return { fields: [] }; }
  async translateUnknownSegments(input: TranslationInput): Promise<TranslationResult> { this.calls.translate += 1; return { segments: input.segments.map((segment) => ({ key: segment.key, translatedText: segment.text })) }; }
  async qualityCheck(_input: QAInput): Promise<QAResult> { this.calls.qa += 1; return { passed: true, issues: [] }; }
}
