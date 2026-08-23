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

export const instagramAccounts = sqliteTable("instagram_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  instagramUserId: text("instagram_user_id").notNull(),
  appScopedUserId: text("app_scoped_user_id"),
  username: text("username").notNull(),
  displayName: text("display_name"),
  profilePictureUrl: text("profile_picture_url"),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  tokenExpiresAt: integer("token_expires_at"),
  scopesJson: text("scopes_json").notNull().default("[]"),
  webhookSubscribed: integer("webhook_subscribed", { mode: "boolean" }).notNull().default(false),
  connectedAt: integer("connected_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  lastError: text("last_error"),
}, (table) => [
  uniqueIndex("instagram_accounts_user_unique").on(table.instagramUserId),
  index("idx_instagram_accounts_updated").on(table.updatedAt),
]);

export const instagramConversations = sqliteTable("instagram_conversations", {
  conversationId: integer("conversation_id").primaryKey().references(() => conversations.id, { onDelete: "cascade" }),
  instagramAccountId: integer("instagram_account_id").notNull().references(() => instagramAccounts.id, { onDelete: "cascade" }),
  recipientIgsid: text("recipient_igsid").notNull(),
  threadId: text("thread_id"),
  lastInboundAt: integer("last_inbound_at").notNull(),
  messagingWindowUntil: integer("messaging_window_until").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("instagram_conversations_account_recipient_unique").on(table.instagramAccountId, table.recipientIgsid),
  index("idx_instagram_conversations_thread").on(table.threadId),
]);

export const oauthStates = sqliteTable("oauth_states", {
  stateHash: text("state_hash").primaryKey(),
  provider: text("provider").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_oauth_states_expiry").on(table.expiresAt)]);

export const instagramAutomations = sqliteTable("instagram_automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  instagramAccountId: integer("instagram_account_id").notNull().references(() => instagramAccounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull().default("comment"),
  postId: text("post_id"),
  matchAnyPost: integer("match_any_post", { mode: "boolean" }).notNull().default(false),
  matchAnyText: integer("match_any_text", { mode: "boolean" }).notNull().default(false),
  keywordsJson: text("keywords_json").notNull().default("[]"),
  wholeWordMatch: integer("whole_word_match", { mode: "boolean" }).notNull().default(true),
  privateReplyMessage: text("private_reply_message").notNull(),
  openingDmEnabled: integer("opening_dm_enabled", { mode: "boolean" }).notNull().default(false),
  openingDmMessage: text("opening_dm_message"),
  openingDmButtonLabel: text("opening_dm_button_label"),
  linkButtonLabel: text("link_button_label"),
  requireFollow: integer("require_follow", { mode: "boolean" }).notNull().default(false),
  followPromptMessage: text("follow_prompt_message"),
  followPromptButtonLabel: text("follow_prompt_button_label"),
  followUpEnabled: integer("follow_up_enabled", { mode: "boolean" }).notNull().default(false),
  followUpMessage: text("follow_up_message"),
  followUpDelayMinutes: integer("follow_up_delay_minutes").notNull().default(0),
  pendingNextReel: integer("pending_next_reel", { mode: "boolean" }).notNull().default(false),
  publicReplyEnabled: integer("public_reply_enabled", { mode: "boolean" }).notNull().default(false),
  publicReplyMessage: text("public_reply_message"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_instagram_automations_account_active").on(table.instagramAccountId, table.active),
  index("idx_instagram_automations_post").on(table.postId),
]);

export const instagramAutomationRuns = sqliteTable("instagram_automation_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  automationId: integer("automation_id").notNull().references(() => instagramAutomations.id, { onDelete: "cascade" }),
  instagramAccountId: integer("instagram_account_id").notNull().references(() => instagramAccounts.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type").notNull(),
  triggerExternalId: text("trigger_external_id").notNull(),
  subjectIgsid: text("subject_igsid").notNull(),
  subjectUsername: text("subject_username"),
  inputText: text("input_text").notNull(),
  matchedKeyword: text("matched_keyword"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until"),
  scheduledAt: integer("scheduled_at").notNull(),
  privateReplySentAt: integer("private_reply_sent_at"),
  publicReplySentAt: integer("public_reply_sent_at"),
  revealSentAt: integer("reveal_sent_at"),
  followUpScheduledAt: integer("follow_up_scheduled_at"),
  followUpSentAt: integer("follow_up_sent_at"),
  lastInteractionAt: integer("last_interaction_at"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("instagram_automation_runs_trigger_unique").on(table.automationId, table.triggerType, table.triggerExternalId),
  index("idx_instagram_automation_runs_status_schedule").on(table.status, table.scheduledAt),
]);

export const instagramProcessedComments = sqliteTable("instagram_processed_comments", {
  commentId: text("comment_id").primaryKey(),
  instagramAccountId: integer("instagram_account_id").notNull().references(() => instagramAccounts.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  seenAt: integer("seen_at").notNull(),
}, (table) => [index("idx_instagram_processed_comments_account").on(table.instagramAccountId)]);

export const instagramRateLimits = sqliteTable("instagram_rate_limits", {
  instagramAccountId: integer("instagram_account_id").primaryKey().references(() => instagramAccounts.id, { onDelete: "cascade" }),
  windowStartedAt: integer("window_started_at").notNull(),
  sends: integer("sends").notNull().default(0),
});

export const instagramTrackedLinks = sqliteTable("instagram_tracked_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  automationId: integer("automation_id").notNull().references(() => instagramAutomations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  label: text("label").notNull(),
  destinationUrl: text("destination_url").notNull(),
  position: integer("position").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("instagram_tracked_links_slug_unique").on(table.slug),
  uniqueIndex("instagram_tracked_links_automation_position_unique").on(table.automationId, table.position),
  index("idx_instagram_tracked_links_automation").on(table.automationId, table.position),
]);

export const instagramLinkClicks = sqliteTable("instagram_link_clicks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackedLinkId: integer("tracked_link_id").notNull().references(() => instagramTrackedLinks.id, { onDelete: "cascade" }),
  automationId: integer("automation_id").notNull().references(() => instagramAutomations.id, { onDelete: "cascade" }),
  instagramAccountId: integer("instagram_account_id").notNull().references(() => instagramAccounts.id, { onDelete: "cascade" }),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_instagram_link_clicks_automation_created").on(table.automationId, table.createdAt)]);

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
  `CREATE TABLE IF NOT EXISTS instagram_accounts (
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
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_conversations (
    conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    recipient_igsid TEXT NOT NULL,
    thread_id TEXT,
    last_inbound_at INTEGER NOT NULL,
    messaging_window_until INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(instagram_account_id, recipient_igsid)
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_automations (
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
    opening_dm_enabled INTEGER NOT NULL DEFAULT 0,
    opening_dm_message TEXT,
    opening_dm_button_label TEXT,
    link_button_label TEXT,
    require_follow INTEGER NOT NULL DEFAULT 0,
    follow_prompt_message TEXT,
    follow_prompt_button_label TEXT,
    follow_up_enabled INTEGER NOT NULL DEFAULT 0,
    follow_up_message TEXT,
    follow_up_delay_minutes INTEGER NOT NULL DEFAULT 0,
    pending_next_reel INTEGER NOT NULL DEFAULT 0,
    public_reply_enabled INTEGER NOT NULL DEFAULT 0,
    public_reply_message TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_automation_runs (
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
    reveal_sent_at INTEGER,
    follow_up_scheduled_at INTEGER,
    follow_up_sent_at INTEGER,
    last_interaction_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(automation_id, trigger_type, trigger_external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_processed_comments (
    comment_id TEXT PRIMARY KEY,
    instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    seen_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_rate_limits (
    instagram_account_id INTEGER PRIMARY KEY REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    window_started_at INTEGER NOT NULL,
    sends INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_tracked_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL REFERENCES instagram_automations(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    destination_url TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(automation_id, position)
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_link_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracked_link_id INTEGER NOT NULL REFERENCES instagram_tracked_links(id) ON DELETE CASCADE,
    automation_id INTEGER NOT NULL REFERENCES instagram_automations(id) ON DELETE CASCADE,
    instagram_account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    ip_hash TEXT,
    user_agent TEXT,
    referrer TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations(last_message_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_mode_recent ON conversations(mode, last_message_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_channel_external ON contacts(channel, external_id)`,
  `CREATE INDEX IF NOT EXISTS idx_telegram_business_connections_updated ON telegram_business_connections(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_telegram_business_conversations_connection ON telegram_business_conversations(business_connection_id)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_accounts_updated ON instagram_accounts(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_conversations_thread ON instagram_conversations(thread_id)`,
  `CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_automations_account_active ON instagram_automations(instagram_account_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_automations_post ON instagram_automations(post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_automation_runs_status_schedule ON instagram_automation_runs(status, scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_processed_comments_account ON instagram_processed_comments(instagram_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_tracked_links_automation ON instagram_tracked_links(automation_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_link_clicks_automation_created ON instagram_link_clicks(automation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_instagram_runs_follow_up ON instagram_automation_runs(follow_up_scheduled_at, follow_up_sent_at)`,
];
