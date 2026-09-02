import { describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../src/services/ai/GeminiProvider";

function response(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

describe("Gemini structured output", () => {
  it("validates classification JSON", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(JSON.stringify({
      country: "PH", issuer: "PSA", documentType: "certificate_of_marriage", documentVersion: "unknown", confidence: 0.97,
    })));
    const provider = new GeminiProvider({ apiKey: "test", classificationModel: "test", extractionModel: "test", translationModel: "test", fetcher });
    await expect(provider.classifyDocument({ ocrText: "test", pageCount: 1 })).resolves.toMatchObject({ issuer: "PSA", confidence: 0.97 });
  });

  it("retries invalid JSON once", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response("not-json"))
      .mockResolvedValueOnce(response(JSON.stringify({ country: "PH", issuer: "PSA", documentType: "birth", documentVersion: "unknown", confidence: 0.9 })));
    const provider = new GeminiProvider({ apiKey: "test", classificationModel: "test", extractionModel: "test", translationModel: "test", fetcher });
    await expect(provider.classifyDocument({ ocrText: "test", pageCount: 1 })).resolves.toMatchObject({ documentType: "birth" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
