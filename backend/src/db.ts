import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS oauth_token (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watched_project (
  id INTEGER PRIMARY KEY,
  name TEXT,
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS needs_reply (
  kind TEXT NOT NULL DEFAULT 'mention',
  recording_id INTEGER PRIMARY KEY,
  project_id INTEGER,
  project_name TEXT,
  title TEXT,
  app_url TEXT,
  excerpt TEXT,
  mentioned_at INTEGER NOT NULL,
  last_author_id INTEGER,
  last_author_name TEXT,
  last_activity_at INTEGER,
  last_comment_text TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_cache (
  todo_id INTEGER PRIMARY KEY,
  project_id INTEGER,
  project_name TEXT,
  title TEXT,
  app_url TEXT,
  due_on TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS other_notification (
  id INTEGER PRIMARY KEY,
  type TEXT,
  title TEXT,
  project_name TEXT,
  app_url TEXT,
  created_at_bc INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS report_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  todo_id INTEGER,
  app_url TEXT,
  posted_today INTEGER NOT NULL DEFAULT 0,
  last_posted_at INTEGER,
  checked_at INTEGER
);

CREATE TABLE IF NOT EXISTS digest (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  highlights_json TEXT NOT NULL,
  routine_summary TEXT NOT NULL,
  ids_key TEXT,
  generated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relevance_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ids_key TEXT,
  checked_at INTEGER
);

CREATE TABLE IF NOT EXISTS poller_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_run_at INTEGER,
  last_ok_at INTEGER,
  last_error TEXT
);
`);

export function seedOauthTokenIfEmpty() {
  const row = db.prepare("SELECT id FROM oauth_token WHERE id = 1").get();
  if (!row) {
    db.prepare(
      `INSERT INTO oauth_token (id, access_token, refresh_token, expires_at, updated_at)
       VALUES (1, ?, ?, ?, ?)`
    ).run(config.basecamp.accessToken, config.basecamp.refreshToken, 0, Date.now());
  }
  const state = db.prepare("SELECT id FROM poller_state WHERE id = 1").get();
  if (!state) {
    db.prepare(
      `INSERT INTO poller_state (id, last_run_at, last_ok_at, last_error) VALUES (1, NULL, NULL, NULL)`
    ).run();
  }
}
