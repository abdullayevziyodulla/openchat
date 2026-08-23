CREATE TABLE IF NOT EXISTS instagram_automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'comment' CHECK(trigger_type IN ('comment', 'dm')),
  post_id TEXT,
  match_any_post INTEGER NOT NULL DEFAULT 0,
  match_any_text INTEGER NOT NULL DEFAULT 0,
  keywords_json TEXT NOT NULL DEFAULT '[]',
  whole_word_match INTEGER NOT NULL DEFAULT 1,
  private_reply_message TEXT NOT NULL,
  public_reply_enabled INTEGER NOT NULL DEFAULT 0,
  public_reply_message TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instagram_automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL REFERENCES instagram_automations(id) ON DELETE CASCADE,
  instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('comment', 'dm')),
  trigger_external_id TEXT NOT NULL,
  subject_igsid TEXT NOT NULL,
  subject_username TEXT,
  input_text TEXT NOT NULL,
  matched_keyword TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER,
  scheduled_at INTEGER NOT NULL,
  private_reply_sent_at INTEGER,
  public_reply_sent_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(automation_id, trigger_type, trigger_external_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instagram_processed_comments (
  comment_id TEXT PRIMARY KEY,
  instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  seen_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instagram_rate_limits (
  instagram_account_id INTEGER PRIMARY KEY REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  window_started_at INTEGER NOT NULL,
  sends INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_automations_account_active ON instagram_automations(instagram_account_id, active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_automations_post ON instagram_automations(post_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_automation_runs_status_schedule ON instagram_automation_runs(status, scheduled_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_processed_comments_account ON instagram_processed_comments(instagram_account_id);
--> statement-breakpoint
PRAGMA optimize;
