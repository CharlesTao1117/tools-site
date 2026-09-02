export type SupportedMimeType = "application/pdf" | "image/jpeg" | "image/png";

export type NormalizedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OCRToken = {
  text: string;
  confidence: number | null;
  pageNumber: number;
  boundingBox: NormalizedBoundingBox | null;
};

export type OCRPage = {
  pageNumber: number;
  width: number | null;
  height: number | null;
  tokens: OCRToken[];
};

export type DocumentQuality = {
  score?: number;
  issues?: string[];
};

export type OCRInput = {
  bytes: ArrayBuffer;
  mimeType: SupportedMimeType;
  nativePdfParsing?: boolean;
};

export type OCRResult = {
  fullText: string;
  pages: OCRPage[];
  quality?: DocumentQuality;
  rawResult?: unknown;
};

export interface OCRProvider {
  readonly name: string;
  readonly processorId: string;
  processDocument(input: OCRInput): Promise<OCRResult>;
}
