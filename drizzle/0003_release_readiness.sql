ALTER TABLE conversations ADD COLUMN delivery_lock_message_id INTEGER;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN delivery_lock_author TEXT CHECK(delivery_lock_author IS NULL OR delivery_lock_author IN ('ai', 'human'));
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN delivery_lock_until INTEGER;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN last_delivery_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN delivery_error TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN last_attempt_at INTEGER;
--> statement-breakpoint
ALTER TABLE channel_events ADD COLUMN status TEXT NOT NULL DEFAULT 'processed' CHECK(status IN ('processing', 'processed', 'failed', 'ignored'));
--> statement-breakpoint
ALTER TABLE channel_events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE channel_events ADD COLUMN claimed_at INTEGER;
--> statement-breakpoint
ALTER TABLE channel_events ADD COLUMN processed_at INTEGER;
--> statement-breakpoint
ALTER TABLE channel_events ADD COLUMN last_error TEXT;
--> statement-breakpoint
ALTER TABLE channel_events ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ai_jobs (
  conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  target_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
  lease_token TEXT,
  lease_until INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_failures (
  key TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_channel_events_status_received ON channel_events(status, received_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_updated ON ai_jobs(status, updated_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON messages(delivery_status, created_at DESC);
--> statement-breakpoint
PRAGMA optimize;
