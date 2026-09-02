import type { DocumentQuality, NormalizedBoundingBox, OCRResult, OCRToken } from "./OCRProvider";

type Vertex = { x?: number; y?: number };
type TextSegment = { startIndex?: string; endIndex?: string };
type Layout = {
  confidence?: number;
  textAnchor?: { textSegments?: TextSegment[] };
  boundingPoly?: { normalizedVertices?: Vertex[]; vertices?: Vertex[] };
};
type ApiToken = { layout?: Layout };
type ApiPage = {
  pageNumber?: number;
  dimension?: { width?: number; height?: number };
  tokens?: ApiToken[];
  imageQualityScores?: {
    qualityScore?: number;
    detectedDefects?: Array<{ type?: string; confidence?: number }>;
  };
};
export type DocumentAIResponse = { document?: { text?: string; pages?: ApiPage[] } };

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export function normalizeBoundingBox(
  layout: Layout | undefined,
  width: number | undefined,
  height: number | undefined,
): NormalizedBoundingBox | null {
  const normalized = layout?.boundingPoly?.normalizedVertices;
  const absolute = layout?.boundingPoly?.vertices;
  const vertices = normalized?.length ? normalized : absolute;
  if (!vertices?.length) return null;
  const useAbsolute = !normalized?.length;
  if (useAbsolute && (!width || !height)) return null;
  const xs = vertices.map((vertex) => (vertex.x ?? 0) / (useAbsolute ? width ?? 1 : 1));
  const ys = vertices.map((vertex) => (vertex.y ?? 0) / (useAbsolute ? height ?? 1 : 1));
  const minX = clamp(Math.min(...xs));
  const minY = clamp(Math.min(...ys));
  const maxX = clamp(Math.max(...xs));
  const maxY = clamp(Math.max(...ys));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function anchoredText(text: string, layout: Layout | undefined): string {
  return (layout?.textAnchor?.textSegments ?? [])
    .map((segment) => text.slice(Number(segment.startIndex ?? 0), Number(segment.endIndex ?? 0)))
    .join("");
}

function normalizeQuality(pages: ApiPage[]): DocumentQuality | undefined {
  const scores = pages.flatMap((page) =>
    typeof page.imageQualityScores?.qualityScore === "number"
      ? [page.imageQualityScores.qualityScore]
      : [],
  );
  const issues = pages.flatMap((page) =>
    (page.imageQualityScores?.detectedDefects ?? [])
      .filter((defect) => (defect.confidence ?? 0) >= 0.5)
      .map((defect) => String(defect.type ?? "UNKNOWN").replace(/^QUALITY_DEFECT_/, "")),
  );
  if (!scores.length && !issues.length) return undefined;
  return {
    score: scores.length ? Math.min(...scores) : undefined,
    issues: [...new Set(issues)],
  };
}

export function normalizeDocumentAIResult(response: DocumentAIResponse): OCRResult {
  const fullText = response.document?.text ?? "";
  const apiPages = response.document?.pages ?? [];
  const pages = apiPages.map((page, pageIndex) => {
    const width = page.dimension?.width;
    const height = page.dimension?.height;
    const pageNumber = page.pageNumber ?? pageIndex + 1;
    const tokens: OCRToken[] = (page.tokens ?? []).map((token) => ({
      text: anchoredText(fullText, token.layout),
      confidence: typeof token.layout?.confidence === "number" ? token.layout.confidence : null,
      pageNumber,
      boundingBox: normalizeBoundingBox(token.layout, width, height),
    }));
    return { pageNumber, width: width ?? null, height: height ?? null, tokens };
  });
  return { fullText, pages, quality: normalizeQuality(apiPages), rawResult: response };
}
