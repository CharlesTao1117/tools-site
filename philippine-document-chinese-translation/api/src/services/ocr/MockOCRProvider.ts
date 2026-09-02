import type { OCRInput, OCRProvider, OCRResult } from "./OCRProvider";

export class MockOCRProvider implements OCRProvider {
  readonly name = "MOCK_OCR";
  readonly processorId = "mock-enterprise-ocr";
  constructor(private readonly fixture: OCRResult) {}
  async processDocument(_input: OCRInput): Promise<OCRResult> {
    return structuredClone(this.fixture);
  }
}
