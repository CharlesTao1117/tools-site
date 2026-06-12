-- EXAM-AI D1 Database Schema
-- Run: wrangler d1 execute exam-ai-db --file=schema.sql --remote

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  invite_code_used TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0
);

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_by INTEGER,
  used_by INTEGER,
  used_at TEXT,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  expires_at TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (used_by) REFERENCES users(id)
);

-- Quiz progress/sync table
CREATE TABLE IF NOT EXISTS quiz_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  data_key TEXT NOT NULL,  -- 'wrong_book', 'quiz_history', 'weakness_stats'
  data_value TEXT NOT NULL, -- JSON string
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, data_key)
);

-- Sessions table (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_quiz_progress_user ON quiz_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
