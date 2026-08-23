CREATE TABLE IF NOT EXISTS instagram_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instagram_user_id TEXT NOT NULL UNIQUE,
  app_scoped_user_id TEXT,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_picture_url TEXT,
  encrypted_access_token TEXT NOT NULL,
  token_expires_at INTEGER,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  webhook_subscribed INTEGER NOT NULL DEFAULT 0,
  connected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_error TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instagram_conversations (
  conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  recipient_igsid TEXT NOT NULL,
  thread_id TEXT,
  last_inbound_at INTEGER NOT NULL,
  messaging_window_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(instagram_account_id, recipient_igsid)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_updated ON instagram_accounts(updated_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_thread ON instagram_conversations(thread_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
--> statement-breakpoint
PRAGMA optimize;
