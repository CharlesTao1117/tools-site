import { describe, expect, it } from "vitest";
import fixture from "./fixtures/demo-ocr.json";
import { MockOCRProvider } from "../src/services/ocr/MockOCRProvider";
import { MockAIProvider } from "../src/services/ai/MockAIProvider";
import { processDocument } from "../src/services/workflow/processDocument";
import type { OCRResult } from "../src/services/ocr/OCRProvider";

const input = { bytes: new ArrayBuffer(1), mimeType: "application/pdf" as const };
const config = { qualityReuploadThreshold: 0.55, templateLowConfidenceThreshold: 0.8, enableQualityCheck: true };
const classification = { country: "PH", issuer: "unknown", documentType: "unknown", documentVersion: "unknown", confidence: 0.6 };

describe("routing", () => {
  it("does not call Gemini for a known, high-confidence template", async () => {
    const ai = new MockAIProvider(classification);
    const result = await processDocument(input, new MockOCRProvider(fixture as OCRResult), ai, config);
    expect(result.status).toBe("READY_FOR_REVIEW");
    expect(result.fields[0]?.boundingBox).toEqual({ x: 0.22, y: 0.31, width: 0.27, height: 0.04 });
    expect(ai.calls.classify).toBe(0);
  });

  it("calls Gemini for an unknown template and still requires human review", async () => {
    const unknown = structuredClone(fixture) as OCRResult;
    unknown.fullText = "UNRECOGNIZED GOVERNMENT PAPER";
    const ai = new MockAIProvider(classification);
    const result = await processDocument(input, new MockOCRProvider(unknown), ai, config);
    expect(result.status).toBe("HUMAN_REVIEW_REQUIRED");
    expect(ai.calls.classify).toBe(1);
  });

  it("requires reupload before Gemini when image quality is too low", async () => {
    const lowQuality = structuredClone(fixture) as OCRResult;
    lowQuality.quality = { score: 0.3, issues: ["BLURRY"] };
    const ai = new MockAIProvider(classification);
    const result = await processDocument(input, new MockOCRProvider(lowQuality), ai, config);
    expect(result.status).toBe("REUPLOAD_REQUIRED");
    expect(ai.calls.classify).toBe(0);
  });

  it("falls back to manual review when Gemini fails", async () => {
    const unknown = structuredClone(fixture) as OCRResult;
    unknown.fullText = "UNKNOWN DOCUMENT";
    const failingAi = new MockAIProvider(classification);
    failingAi.classifyDocument = async () => { throw new Error("provider unavailable"); };
    const result = await processDocument(input, new MockOCRProvider(unknown), failingAi, config);
    expect(result.status).toBe("HUMAN_REVIEW_REQUIRED");
    expect(result.classification).toBeNull();
  });
});
