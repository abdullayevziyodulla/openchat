CREATE TABLE IF NOT EXISTS telegram_business_connections (
  id TEXT PRIMARY KEY,
  account_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT,
  can_reply INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS telegram_business_conversations (
  conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  business_connection_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_telegram_business_connections_updated ON telegram_business_connections(updated_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_telegram_business_conversations_connection ON telegram_business_conversations(business_connection_id);
--> statement-breakpoint
PRAGMA optimize;
