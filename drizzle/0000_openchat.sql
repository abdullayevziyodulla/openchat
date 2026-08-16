CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(channel, external_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_chat_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'AI_ACTIVE' CHECK(mode IN ('AI_ACTIVE', 'ESCALATED', 'HUMAN_ACTIVE')),
  stage TEXT NOT NULL DEFAULT 'New inquiry',
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(channel, external_chat_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  author TEXT NOT NULL CHECK(author IN ('customer', 'ai', 'human')),
  body TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK(delivery_status IN ('received', 'pending', 'sent', 'failed', 'cancelled')),
  provider_timestamp INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(conversation_id, external_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS channel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  UNIQUE(provider, external_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS instance_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations(last_message_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_conversations_mode_recent ON conversations(mode, last_message_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_contacts_channel_external ON contacts(channel, external_id);
--> statement-breakpoint
PRAGMA optimize;
