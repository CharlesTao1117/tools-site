import type { OCRResult } from "../services/ocr/OCRProvider";
import type { StructuredField } from "../services/templates/templateMapper";

export type JobStart = {
  id: string; idempotencyKey: string | null; orderId: string | null; orderItemId: string | null;
  provider: string; processorId: string; sourceObjectKey: string;
};

export async function findJobByIdempotencyKey(db: D1Database, key: string): Promise<{ id: string; status: string } | null> {
  return db.prepare("SELECT id, status FROM ocr_jobs WHERE idempotency_key = ?").bind(key).first<{ id: string; status: string }>();
}

export async function createJob(db: D1Database, job: JobStart): Promise<void> {
  await db.prepare(`INSERT INTO ocr_jobs
    (id,idempotency_key,order_id,order_item_id,provider,processor_id,status,source_object_key)
    VALUES (?,?,?,?,?,?, 'OCR_PROCESSING', ?)`)
    .bind(job.id, job.idempotencyKey, job.orderId, job.orderItemId, job.provider, job.processorId, job.sourceObjectKey).run();
}

export async function failJob(db: D1Database, jobId: string, errorCode: string): Promise<void> {
  await db.prepare("UPDATE ocr_jobs SET status='OCR_FAILED', error_code=?, completed_at=datetime('now') WHERE id=?")
    .bind(errorCode.slice(0, 120), jobId).run();
}

export async function completeJob(
  db: D1Database,
  jobId: string,
  rawResultReference: string | null,
  status: "OCR_COMPLETED" | "REUPLOAD_REQUIRED",
  ocr: OCRResult,
  fields: StructuredField[],
  usage: { provider: string; orderId: string | null; orderItemId: string | null },
  persistContent: boolean,
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare("UPDATE ocr_jobs SET status=?, raw_result_reference=?, completed_at=datetime('now') WHERE id=?")
      .bind(status, rawResultReference, jobId),
    db.prepare(`INSERT INTO ocr_usage (id,provider,processor_type,pages_processed,order_id,order_item_id)
      VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), usage.provider, "ENTERPRISE_DOCUMENT_OCR", ocr.pages.length, usage.orderId, usage.orderItemId),
  ];
  for (const page of persistContent ? ocr.pages : []) {
    const pageId = crypto.randomUUID();
    statements.push(db.prepare(`INSERT INTO ocr_pages
      (id,ocr_job_id,page_number,width,height,quality_score,quality_issues_json) VALUES (?,?,?,?,?,?,?)`)
      .bind(pageId, jobId, page.pageNumber, page.width, page.height, ocr.quality?.score ?? null, JSON.stringify(ocr.quality?.issues ?? [])));
    for (const token of page.tokens) {
      statements.push(db.prepare(`INSERT INTO ocr_tokens
        (id,ocr_page_id,text,confidence,page_number,bounding_box_json) VALUES (?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), pageId, token.text, token.confidence, token.pageNumber,
          token.boundingBox ? JSON.stringify(token.boundingBox) : null));
    }
  }
  for (const field of persistContent ? fields : []) {
    statements.push(db.prepare(`INSERT INTO extracted_fields
      (id,ocr_job_id,field_key,raw_value,normalized_value,rendered_value,ocr_confidence,
       template_mapping_confidence,page_number,bounding_box_json,extraction_source,warnings_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), jobId, field.fieldKey, field.rawValue, field.normalizedValue, field.renderedValue,
      field.ocrConfidence, field.templateMappingConfidence, field.pageNumber,
      field.boundingBox ? JSON.stringify(field.boundingBox) : null, field.extractionSource, JSON.stringify(field.warnings),
    ));
  }
  // Large OCR pages can produce hundreds of tokens. Keep D1 batches bounded.
  for (let offset = 0; offset < statements.length; offset += 100) {
    await db.batch(statements.slice(offset, offset + 100));
  }
}

export async function recordAiUsage(
  db: D1Database, model: string, taskType: string, orderId: string | null, orderItemId: string | null,
): Promise<void> {
  await db.prepare(`INSERT INTO ai_usage
    (id,provider,model,task_type,input_tokens,output_tokens,order_id,order_item_id) VALUES (?, 'GEMINI', ?, ?, NULL, NULL, ?, ?)`)
    .bind(crypto.randomUUID(), model, taskType, orderId, orderItemId).run();
}
