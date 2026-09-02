import type { OCRInput, OCRProvider, OCRResult } from "./OCRProvider";
import { normalizeDocumentAIResult, type DocumentAIResponse } from "./normalize";
import { getGoogleAccessToken } from "../shared/googleAuth";

export type GoogleDocumentAIConfig = {
  projectId: string;
  location: string;
  processorId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  fetcher?: typeof fetch;
};

export class GoogleDocumentAIProvider implements OCRProvider {
  readonly name = "GOOGLE_DOCUMENT_AI";
  readonly processorId: string;
  private readonly config: GoogleDocumentAIConfig;

  constructor(config: GoogleDocumentAIConfig) {
    this.config = config;
    this.processorId = config.processorId;
  }

  async processDocument(input: OCRInput): Promise<OCRResult> {
    const fetcher = this.config.fetcher ?? fetch;
    const accessToken = await getGoogleAccessToken({
      email: this.config.serviceAccountEmail,
      privateKey: this.config.serviceAccountPrivateKey,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      fetcher,
    });
    const endpoint = `https://${this.config.location}-documentai.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/processors/${this.config.processorId}:process`;
    const body = {
      rawDocument: {
        mimeType: input.mimeType,
        content: arrayBufferToBase64(input.bytes),
      },
      processOptions: {
        ocrConfig: {
          enableNativePdfParsing: input.mimeType === "application/pdf" && input.nativePdfParsing !== false,
          enableImageQualityScores: true,
          hints: { languageHints: ["en"] },
        },
      },
    };
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`DOCUMENT_AI_HTTP_${response.status}`);
    const json: unknown = await response.json();
    return normalizeDocumentAIResult(json as DocumentAIResponse);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
