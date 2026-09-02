PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ocr_jobs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE,
  order_id TEXT,
  order_item_id TEXT,
  provider TEXT NOT NULL,
  processor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OCR_PROCESSING','OCR_COMPLETED','OCR_FAILED','REUPLOAD_REQUIRED')),
  source_object_key TEXT NOT NULL,
  raw_result_reference TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ocr_pages (
  id TEXT PRIMARY KEY,
  ocr_job_id TEXT NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  width REAL,
  height REAL,
  quality_score REAL,
  quality_issues_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE (ocr_job_id, page_number)
);

CREATE TABLE IF NOT EXISTS ocr_tokens (
  id TEXT PRIMARY KEY,
  ocr_page_id TEXT NOT NULL REFERENCES ocr_pages(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  confidence REAL,
  page_number INTEGER NOT NULL,
  bounding_box_json TEXT
);

CREATE TABLE IF NOT EXISTS extracted_fields (
  id TEXT PRIMARY KEY,
  ocr_job_id TEXT NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  rendered_value TEXT NOT NULL,
  ocr_confidence REAL,
  template_mapping_confidence REAL NOT NULL,
  page_number INTEGER NOT NULL,
  bounding_box_json TEXT,
  extraction_source TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS ocr_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  processor_type TEXT NOT NULL,
  pages_processed INTEGER NOT NULL,
  order_id TEXT,
  order_item_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  order_id TEXT,
  order_item_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_type, version)
);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_order_item ON ocr_jobs(order_item_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tokens_page ON ocr_tokens(ocr_page_id);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_job ON extracted_fields(ocr_job_id);

INSERT OR IGNORE INTO prompt_templates (id, task_type, version, prompt, active) VALUES
  ('classification-v1', 'DOCUMENT_CLASSIFICATION', 1,
   'Classify official-document OCR and return structured JSON. Use unknown when uncertain.', 1),
  ('unknown-extraction-v1', 'UNKNOWN_FIELD_EXTRACTION', 1,
   'Extract only requested unknown fields and return structured JSON.', 1),
  ('unknown-translation-v1', 'UNKNOWN_SEGMENT_TRANSLATION', 1,
   'Translate only unknown segments. Preserve names, identifiers, numbers, and locked terms.', 1);
