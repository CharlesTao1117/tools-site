import { describe, expect, it } from "vitest";
import { normalizeBoundingBox, normalizeDocumentAIResult } from "../src/services/ocr/normalize";

describe("Document AI normalization", () => {
  it("normalizes absolute vertices to 0-1 coordinates", () => {
    expect(normalizeBoundingBox({ boundingPoly: { vertices: [
      { x: 220, y: 310 }, { x: 490, y: 310 }, { x: 490, y: 350 }, { x: 220, y: 350 },
    ] } }, 1000, 1000)).toEqual({ x: 0.22, y: 0.31, width: 0.27, height: 0.03999999999999998 });
  });

  it("maps text anchors, pages, confidence, and quality", () => {
    const result = normalizeDocumentAIResult({ document: { text: "JUAN TEST", pages: [{
      pageNumber: 1, dimension: { width: 1000, height: 1400 }, imageQualityScores: {
        qualityScore: 0.42, detectedDefects: [{ type: "QUALITY_DEFECT_BLURRY", confidence: 0.9 }],
      }, tokens: [{ layout: { confidence: 0.987, textAnchor: { textSegments: [{ startIndex: "0", endIndex: "9" }] },
        boundingPoly: { normalizedVertices: [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.4 }, { x: 0.2, y: 0.4 }] } } }],
    }] } });
    expect(result.pages[0]?.tokens[0]).toMatchObject({ text: "JUAN TEST", confidence: 0.987, pageNumber: 1 });
    expect(result.quality).toEqual({ score: 0.42, issues: ["BLURRY"] });
  });
});
