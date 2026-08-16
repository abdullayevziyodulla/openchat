import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channel: text("channel").notNull(),
  externalId: text("external_id").notNull(),
  displayName: text("display_name").notNull(),
  username: text("username"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("contacts_channel_external_unique").on(table.channel, table.externalId)]);

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  externalChatId: text("external_chat_id").notNull(),
  mode: text("mode").notNull().default("AI_ACTIVE"),
  stage: text("stage").notNull().default("New inquiry"),
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessageAt: integer("last_message_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deliveryLockMessageId: integer("delivery_lock_message_id"),
  deliveryLockAuthor: text("delivery_lock_author"),
  deliveryLockUntil: integer("delivery_lock_until"),
  lastDeliveryAt: integer("last_delivery_at").notNull().default(0),
}, (table) => [
  uniqueIndex("conversations_channel_chat_unique").on(table.channel, table.externalChatId),
  index("idx_conversations_recent").on(table.lastMessageAt),
  index("idx_conversations_mode_recent").on(table.mode, table.lastMessageAt),
]);

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  direction: text("direction").notNull(),
  author: text("author").notNull(),
  body: text("body").notNull(),
  attachmentJson: text("attachment_json"),
  replyToMessageId: integer("reply_to_message_id"),
  deliveryStatus: text("delivery_status").notNull(),
  deliveryAttempts: integer("delivery_attempts").notNull().default(0),
  deliveryError: text("delivery_error"),
  lastAttemptAt: integer("last_attempt_at"),
  providerTimestamp: integer("provider_timestamp"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("messages_conversation_external_unique").on(table.conversationId, table.externalId),
  index("idx_messages_conversation_created").on(table.conversationId, table.createdAt),
]);

export const channelEvents = sqliteTable("channel_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  payload: text("payload").notNull(),
  receivedAt: integer("received_at").notNull(),
  status: text("status").notNull().default("processed"),
  attempts: integer("attempts").notNull().default(0),
  claimedAt: integer("claimed_at"),
  processedAt: integer("processed_at"),
  lastError: text("last_error"),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
}, (table) => [
  uniqueIndex("channel_events_provider_external_unique").on(table.provider, table.externalId),
  index("idx_channel_events_status_received").on(table.status, table.receivedAt),
]);

export const aiJobs = sqliteTable("ai_jobs", {
  conversationId: integer("conversation_id").primaryKey().references(() => conversations.id, { onDelete: "cascade" }),
  targetMessageId: integer("target_message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [index("idx_ai_jobs_status_updated").on(table.status, table.updatedAt)]);

export const authFailures = sqliteTable("auth_failures", {
  key: text("key").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  blockedUntil: integer("blocked_until").notNull().default(0),
});

export const instanceSettings = sqliteTable("instance_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const telegramBusinessConnections = sqliteTable("telegram_business_connections", {
  id: text("id").primaryKey(),
  accountUserId: text("account_user_id").notNull(),
  displayName: text("display_name").notNull(),
  username: text("username"),
  canReply: integer("can_reply", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_telegram_business_connections_updated").on(table.updatedAt)]);

export const telegramBusinessConversations = sqliteTable("telegram_business_conversations", {
  conversationId: integer("conversation_id").primaryKey().references(() => conversations.id, { onDelete: "cascade" }),
  businessConnectionId: text("business_connection_id").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_telegram_business_conversations_connection").on(table.businessConnectionId)]);

export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    external_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    username TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(channel, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
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
    delivery_lock_message_id INTEGER,
    delivery_lock_author TEXT CHECK(delivery_lock_author IS NULL OR delivery_lock_author IN ('ai', 'human')),
    delivery_lock_until INTEGER,
    last_delivery_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE(channel, external_chat_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
    author TEXT NOT NULL CHECK(author IN ('customer', 'ai', 'human')),
    body TEXT NOT NULL,
    attachment_json TEXT,
    reply_to_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    delivery_status TEXT NOT NULL CHECK(delivery_status IN ('received', 'pending', 'sent', 'failed', 'cancelled')),
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    delivery_error TEXT,
    last_attempt_at INTEGER,
    provider_timestamp INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(conversation_id, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS channel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'processed' CHECK(status IN ('processing', 'processed', 'failed', 'ignored')),
    attempts INTEGER NOT NULL DEFAULT 0,
    claimed_at INTEGER,
    processed_at INTEGER,
    last_error TEXT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    UNIQUE(provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_jobs (
    conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    target_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
    lease_token TEXT,
    lease_until INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS auth_failures (
    key TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 0,
    window_started_at INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS instance_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS telegram_business_connections (
    id TEXT PRIMARY KEY,
    account_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    username TEXT,
    can_reply INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS telegram_business_conversations (
    conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    business_connection_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations(last_message_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_mode_recent ON conversations(mode, last_message_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_channel_external ON contacts(channel, external_id)`,
  `CREATE INDEX IF NOT EXISTS idx_telegram_business_connections_updated ON telegram_business_connections(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_telegram_business_conversations_connection ON telegram_business_conversations(business_connection_id)`,
];
