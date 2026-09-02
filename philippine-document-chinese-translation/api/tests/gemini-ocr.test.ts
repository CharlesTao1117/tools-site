import { describe, expect, it, vi } from "vitest";
import { GeminiOCRProvider } from "../src/services/ocr/GeminiOCRProvider";

describe("Gemini OCR provider", () => {
  it("normalizes model boxes and leaves confidence unset", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      fullText: "JUAN TEST", pages: [{ pageNumber: 1, tokens: [{ text: "JUAN TEST", box2d: [310, 220, 350, 490] }] }], qualityIssues: [],
    }) }] } }] }));
    const provider = new GeminiOCRProvider({ apiKey: "test", model: "test-model", fetcher });
    const result = await provider.processDocument({ bytes: new Uint8Array([1]).buffer, mimeType: "image/png" });
    expect(result.pages[0]?.tokens[0]).toEqual({
      text: "JUAN TEST", confidence: null, pageNumber: 1,
      boundingBox: { x: 0.22, y: 0.31, width: 0.27, height: 0.04 },
    });
  });

  it("retries transient provider errors", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        fullText: "DEMO", pages: [{ pageNumber: 1, tokens: [] }], qualityIssues: [],
      }) }] } }] }));
    const provider = new GeminiOCRProvider({ apiKey: "test", model: "test-model", fetcher });
    await expect(provider.processDocument({ bytes: new Uint8Array([1]).buffer, mimeType: "image/png" })).resolves.toMatchObject({ fullText: "DEMO" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
