import { schemaStatements } from "../db/schema";
import type { D1Database } from "./runtime";

export type ConversationMode = "AI_ACTIVE" | "ESCALATED" | "HUMAN_ACTIVE";
export type MessageAuthor = "customer" | "ai" | "human";
export type ConversationChannel = "telegram" | "telegram_business" | "instagram";

export interface MessageAttachment {
  type: "photo" | "document" | "video" | "video_note" | "audio" | "voice" | "animation" | "sticker";
  fileId?: string;
  url?: string;
  providerMediaId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface TelegramInbound {
  channel?: "telegram" | "telegram_business";
  businessConnectionId?: string;
  updateId: string;
  messageId: string;
  chatId: string;
  senderId: string;
  displayName: string;
  username?: string;
  text: string;
  attachment?: MessageAttachment;
  replyToProviderMessageId?: string;
  timestamp: number;
  payload: string;
}

export interface ChannelInbound {
  channel: ConversationChannel;
  eventId: string;
  externalMessageId: string;
  externalConversationId: string;
  externalContactId: string;
  displayName: string;
  username?: string;
  text: string;
  attachment?: MessageAttachment;
  replyToExternalMessageId?: string;
  timestamp: number;
  payload: string;
  telegramBusinessConnectionId?: string;
  instagramAccountId?: number;
  instagramRecipientIgsid?: string;
  instagramThreadId?: string;
  messagingWindowUntil?: number;
}

export interface InboxConversation {
  id: number;
  name: string;
  username: string | null;
  preview: string;
  channel: ConversationChannel;
  mode: ConversationMode;
  stage: string;
  unread: number;
  lastMessageAt: number;
}

export interface InboxMessage {
  id: number;
  externalId: string;
  author: MessageAuthor;
  text: string;
  attachment: MessageAttachment | null;
  replyToId: number | null;
  replyToText: string | null;
  replyToAuthor: MessageAuthor | null;
  status: "received" | "pending" | "sent" | "failed" | "cancelled";
  deliveryError: string | null;
  createdAt: number;
}

export interface InstanceSettings {
  aiEnabled: boolean;
  systemPrompt: string;
  businessContext: string;
  defaultLanguage: string;
}

export interface StoredTelegramCredentials {
  encryptedBotToken: string;
  encryptedWebhookSecret: string;
  publicUrl: string;
}

export interface StoredAiCredentials {
  provider: "openrouter";
  encryptedApiKey: string;
  model: string;
}

export interface TelegramBusinessConnection {
  id: string;
  accountUserId: string;
  displayName: string;
  username?: string;
  canReply: boolean;
  enabled: boolean;
  payload: string;
  updatedAt: number;
}

export interface InstagramAccount {
  id: number;
  instagramUserId: string;
  appScopedUserId: string | null;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  encryptedAccessToken: string;
  tokenExpiresAt: number | null;
  scopes: string[];
  webhookSubscribed: boolean;
  connectedAt: number;
  updatedAt: number;
  lastError: string | null;
}

export interface InstagramConversationContext {
  instagramAccountId: number;
  instagramUserId: string;
  recipientIgsid: string;
  threadId: string | null;
  lastInboundAt: number;
  messagingWindowUntil: number;
}

export interface InstagramHistoryMessage {
  externalMessageId: string;
  author: "customer" | "human";
  text: string;
  attachment?: MessageAttachment;
  timestamp: number;
}

export interface InstagramAutomation {
  id: number;
  instagramAccountId: number;
  accountUsername: string;
  name: string;
  triggerType: "comment" | "dm";
  postId: string | null;
  matchAnyPost: boolean;
  matchAnyText: boolean;
  keywords: string[];
  wholeWordMatch: boolean;
  privateReplyMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number;
  pendingNextReel: boolean;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  trackedLinks: InstagramTrackedLink[];
}

export interface InstagramTrackedLink {
  id: number;
  automationId: number;
  slug: string;
  label: string;
  destinationUrl: string;
  position: number;
}

export interface InstagramAutomationInput {
  instagramAccountId: number;
  name: string;
  triggerType?: "comment" | "dm";
  postId?: string | null;
  matchAnyPost?: boolean;
  matchAnyText?: boolean;
  keywords?: string[];
  wholeWordMatch?: boolean;
  privateReplyMessage: string;
  openingDmEnabled?: boolean;
  openingDmMessage?: string | null;
  openingDmButtonLabel?: string | null;
  linkButtonLabel?: string | null;
  requireFollow?: boolean;
  followPromptMessage?: string | null;
  followPromptButtonLabel?: string | null;
  followUpEnabled?: boolean;
  followUpMessage?: string | null;
  followUpDelayMinutes?: number;
  pendingNextReel?: boolean;
  trackedLinks?: Array<{ label: string; destinationUrl: string }>;
  publicReplyEnabled?: boolean;
  publicReplyMessage?: string | null;
  active?: boolean;
}

export interface InstagramAutomationRunClaim {
  id: number;
  automationId: number;
  instagramAccountId: number;
  instagramUserId: string;
  encryptedAccessToken: string;
  triggerType: "comment" | "dm";
  triggerExternalId: string;
  subjectIgsid: string;
  subjectUsername: string | null;
  attempts: number;
  privateReplyMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  privateReplySentAt: number | null;
  publicReplySentAt: number | null;
  revealSentAt: number | null;
  followUpScheduledAt: number | null;
  followUpSentAt: number | null;
  lastInteractionAt: number | null;
  trackedLinks: InstagramTrackedLink[];
  leaseToken: string;
}

export interface OutboundMessage {
  id: number;
  conversationId: number;
  externalChatId: string;
  channel: ConversationChannel;
  businessConnectionId: string | null;
  instagramAccountId: number | null;
  instagramRecipientIgsid: string | null;
  instagramLastInboundAt: number | null;
  instagramMessagingWindowUntil: number | null;
  author: "ai" | "human";
  body: string;
  attachment: MessageAttachment | null;
  replyToExternalId: string | null;
}

export interface AiJobClaim {
  conversationId: number;
  targetMessageId: number;
  leaseToken: string;
}

export interface OperationsSnapshot {
  events: {
    id: number;
    provider: string;
    externalId: string;
    status: "processing" | "processed" | "failed" | "ignored";
    attempts: number;
    lastError: string | null;
    receivedAt: number;
  }[];
  aiJobs: {
    conversationId: number;
    conversationName: string;
    status: "pending" | "processing" | "processed" | "failed";
    attempts: number;
    lastError: string | null;
    updatedAt: number;
  }[];
  failedMessages: {
    id: number;
    conversationId: number;
    conversationName: string;
    body: string;
    attempts: number;
    lastError: string | null;
    createdAt: number;
  }[];
  automationRuns: {
    id: number;
    automationName: string;
    accountUsername: string;
    triggerType: "comment" | "dm";
    subjectUsername: string | null;
    status: "pending" | "processing" | "failed";
    attempts: number;
    privateReplySentAt: number | null;
    publicReplySentAt: number | null;
    lastError: string | null;
    updatedAt: number;
  }[];
  counts: { failedEvents: number; failedAiJobs: number; pendingWork: number; failedMessages: number; failedAutomations: number; pendingAutomations: number };
}

let initializedDatabase: D1Database | undefined;
let initialization: Promise<void> | undefined;

async function ensureColumns(db: D1Database, table: string, definitions: Record<string, string>) {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const columns = new Set(results.map((column) => column.name));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!columns.has(name)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}

async function reconcileStaleWork(db: D1Database) {
  const now = Date.now();
  const stale = now - 60_000;
  await db.prepare("UPDATE conversations SET delivery_lock_message_id = NULL, delivery_lock_author = NULL, delivery_lock_until = NULL WHERE COALESCE(delivery_lock_until, 0) > 0 AND delivery_lock_until <= ?").bind(now).run();
  await db.prepare("UPDATE channel_events SET status = 'failed', claimed_at = NULL, last_error = COALESCE(last_error, 'Processing lease expired before the event completed.') WHERE status = 'processing' AND COALESCE(claimed_at, 0) <= ?").bind(stale).run();
  await db.prepare("UPDATE ai_jobs SET status = 'failed', lease_token = NULL, lease_until = NULL, last_error = COALESCE(last_error, 'AI processing lease expired before completion.'), updated_at = ? WHERE status = 'processing' AND COALESCE(lease_until, 0) <= ?").bind(now, now).run();
  await db.prepare("UPDATE instagram_automation_runs SET status = 'failed', lease_token = NULL, lease_until = NULL, last_error = COALESCE(last_error, 'Automation delivery was interrupted; review before retrying to avoid a duplicate reply.'), updated_at = ? WHERE status = 'processing' AND COALESCE(lease_until, 0) <= ?").bind(now, now).run();
  await db.prepare("UPDATE messages SET delivery_status = 'failed', delivery_error = COALESCE(delivery_error, 'Delivery was interrupted. Check Telegram before sending again.') WHERE delivery_status = 'pending' AND created_at <= ?").bind(stale).run();
}

async function initialize(db: D1Database) {
  if (initializedDatabase === db && initialization) return initialization;
  initializedDatabase = db;
  initialization = (async () => {
    for (const statement of schemaStatements) await db.prepare(statement).run();
    await ensureColumns(db, "conversations", {
      delivery_lock_message_id: "INTEGER",
      delivery_lock_author: "TEXT",
      delivery_lock_until: "INTEGER",
      last_delivery_at: "INTEGER NOT NULL DEFAULT 0",
    });
    await ensureColumns(db, "messages", {
      attachment_json: "TEXT",
      reply_to_message_id: "INTEGER REFERENCES messages(id) ON DELETE SET NULL",
      delivery_attempts: "INTEGER NOT NULL DEFAULT 0",
      delivery_error: "TEXT",
      last_attempt_at: "INTEGER",
    });
    await ensureColumns(db, "channel_events", {
      status: "TEXT NOT NULL DEFAULT 'processed'",
      attempts: "INTEGER NOT NULL DEFAULT 0",
      claimed_at: "INTEGER",
      processed_at: "INTEGER",
      last_error: "TEXT",
      conversation_id: "INTEGER REFERENCES conversations(id) ON DELETE SET NULL",
    });
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_channel_events_status_received ON channel_events(status, received_at DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_updated ON ai_jobs(status, updated_at DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON messages(delivery_status, created_at DESC)").run();
    await reconcileStaleWork(db);
  })();
  return initialization;
}

function rowChanges(result: { meta?: { changes?: number } }) {
  return result.meta?.changes ?? 0;
}

function randomSlug() {
  return Array.from(crypto.getRandomValues(new Uint8Array(9)), (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export class OpenChatStore {
  constructor(private readonly db: D1Database) {}

  async ready() {
    await initialize(this.db);
  }

  async reconcileStaleWork() {
    await this.ready();
    await reconcileStaleWork(this.db);
  }

  async listConversations(): Promise<InboxConversation[]> {
    await this.ready();
    const { results } = await this.db.prepare(`
      SELECT c.id, p.display_name AS name, p.username, c.channel, c.mode, c.stage,
        c.unread_count AS unread, c.last_message_at AS lastMessageAt,
        COALESCE((SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY COALESCE(m.provider_timestamp, m.created_at) DESC, m.id DESC LIMIT 1), '') AS preview
      FROM conversations c
      JOIN contacts p ON p.id = c.contact_id
      ORDER BY c.last_message_at DESC
      LIMIT 200
    `).all<InboxConversation>();
    return results;
  }

  async listMessages(conversationId: number): Promise<InboxMessage[]> {
    await this.ready();
    const { results } = await this.db.prepare(`
      SELECT m.id, m.external_id AS externalId, m.author, m.body AS text,
        m.attachment_json AS attachmentJson, m.reply_to_message_id AS replyToId,
        replied.body AS replyToText, replied.author AS replyToAuthor,
        m.delivery_status AS status, m.delivery_error AS deliveryError, m.created_at AS createdAt
      FROM messages m
      LEFT JOIN messages replied ON replied.id = m.reply_to_message_id
      WHERE m.conversation_id = ?
      ORDER BY COALESCE(m.provider_timestamp, m.created_at) ASC, m.id ASC
      LIMIT 500
    `).bind(conversationId).all<InboxMessage & { attachmentJson: string | null }>();
    return results.map(({ attachmentJson, ...message }) => ({
      ...message,
      attachment: attachmentJson ? JSON.parse(attachmentJson) as MessageAttachment : null,
    }));
  }

  async markRead(conversationId: number) {
    await this.ready();
    await this.db.prepare("UPDATE conversations SET unread_count = 0, updated_at = ? WHERE id = ?").bind(Date.now(), conversationId).run();
  }

  async recordInbound(input: ChannelInbound) {
    await this.ready();
    const receivedAt = Date.now();
    const channel = input.channel;
    const claim = await this.db.prepare(`
      INSERT INTO channel_events(provider, external_id, payload, received_at, status, attempts, claimed_at)
      VALUES(?, ?, ?, ?, 'processing', 1, ?)
      ON CONFLICT(provider, external_id) DO UPDATE SET
        payload = excluded.payload,
        status = 'processing',
        attempts = channel_events.attempts + 1,
        claimed_at = excluded.claimed_at,
        last_error = NULL
      WHERE channel_events.status = 'failed'
        OR (channel_events.status = 'processing' AND COALESCE(channel_events.claimed_at, 0) < ?)
      RETURNING id
    `).bind(channel, input.eventId, input.payload, receivedAt, receivedAt, receivedAt - 60_000).first<{ id: number }>();
    if (!claim) {
      const existing = await this.db.prepare("SELECT status, conversation_id AS conversationId FROM channel_events WHERE provider = ? AND external_id = ?")
        .bind(channel, input.eventId).first<{ status: "processing" | "processed" | "failed" | "ignored"; conversationId: number | null }>();
      return { inserted: false as const, status: existing?.status ?? "processing", conversationId: existing?.conversationId ?? undefined };
    }

    try {
      await this.db.prepare(`
        INSERT INTO contacts(channel, external_id, display_name, username, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(channel, external_id) DO UPDATE SET
          display_name = excluded.display_name,
          username = excluded.username,
          updated_at = excluded.updated_at
      `).bind(channel, input.externalContactId, input.displayName, input.username ?? null, receivedAt, receivedAt).run();
      const contact = await this.db.prepare("SELECT id FROM contacts WHERE channel = ? AND external_id = ?").bind(channel, input.externalContactId).first<{ id: number }>();
      if (!contact) throw new Error("Contact upsert failed");

      await this.db.prepare(`
        INSERT INTO conversations(contact_id, channel, external_chat_id, last_message_at, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(channel, external_chat_id) DO UPDATE SET
          contact_id = excluded.contact_id,
          last_message_at = MAX(conversations.last_message_at, excluded.last_message_at),
          updated_at = excluded.updated_at
      `).bind(contact.id, channel, input.externalConversationId, input.timestamp, receivedAt, receivedAt).run();
      const conversation = await this.db.prepare("SELECT id, mode FROM conversations WHERE channel = ? AND external_chat_id = ?").bind(channel, input.externalConversationId).first<{ id: number; mode: ConversationMode }>();
      if (!conversation) throw new Error("Conversation upsert failed");
      if (channel === "telegram_business") {
        if (!input.telegramBusinessConnectionId) throw new Error("Telegram Business message is missing its connection id");
        await this.db.prepare(`
          INSERT INTO telegram_business_conversations(conversation_id, business_connection_id, updated_at)
          VALUES(?, ?, ?)
          ON CONFLICT(conversation_id) DO UPDATE SET
            business_connection_id = excluded.business_connection_id,
            updated_at = excluded.updated_at
        `).bind(conversation.id, input.telegramBusinessConnectionId, receivedAt).run();
      }
      if (channel === "instagram") {
        if (!input.instagramAccountId || !input.instagramRecipientIgsid) throw new Error("Instagram message is missing its account context");
        const windowUntil = input.messagingWindowUntil ?? input.timestamp + 24 * 60 * 60_000;
        await this.db.prepare(`
          INSERT INTO instagram_conversations(conversation_id, instagram_account_id, recipient_igsid, thread_id, last_inbound_at, messaging_window_until, updated_at)
          VALUES(?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(conversation_id) DO UPDATE SET
            instagram_account_id = excluded.instagram_account_id,
            recipient_igsid = excluded.recipient_igsid,
            thread_id = COALESCE(excluded.thread_id, instagram_conversations.thread_id),
            last_inbound_at = MAX(instagram_conversations.last_inbound_at, excluded.last_inbound_at),
            messaging_window_until = MAX(instagram_conversations.messaging_window_until, excluded.messaging_window_until),
            updated_at = excluded.updated_at
        `).bind(conversation.id, input.instagramAccountId, input.instagramRecipientIgsid, input.instagramThreadId ?? null, input.timestamp, windowUntil, receivedAt).run();
      }

      const replyCandidates = input.replyToExternalMessageId ? [
        input.replyToExternalMessageId,
        `${input.externalConversationId}:${input.replyToExternalMessageId}`,
        `${channel}:${input.externalConversationId}:${input.replyToExternalMessageId}`,
        ...(input.telegramBusinessConnectionId ? [`${input.telegramBusinessConnectionId}:${input.externalConversationId}:${input.replyToExternalMessageId}`] : []),
      ] : [];
      let replyToMessageId: number | null = null;
      if (replyCandidates.length) {
        const placeholders = replyCandidates.map(() => "?").join(", ");
        const reply = await this.db.prepare(`SELECT id FROM messages WHERE conversation_id = ? AND external_id IN (${placeholders}) LIMIT 1`)
          .bind(conversation.id, ...replyCandidates).first<{ id: number }>();
        replyToMessageId = reply?.id ?? null;
      }
      const inserted = await this.db.prepare(`
        INSERT INTO messages(conversation_id, external_id, direction, author, body, attachment_json, reply_to_message_id, delivery_status, provider_timestamp, created_at)
        VALUES(?, ?, 'inbound', 'customer', ?, ?, ?, 'received', ?, ?)
        ON CONFLICT(conversation_id, external_id) DO NOTHING
      `).bind(conversation.id, input.externalMessageId, input.text, input.attachment ? JSON.stringify(input.attachment) : null, replyToMessageId, input.timestamp, receivedAt).run();
      if (rowChanges(inserted) > 0) {
        await this.db.prepare("UPDATE conversations SET unread_count = unread_count + 1, last_message_at = MAX(last_message_at, ?), updated_at = ? WHERE id = ?")
          .bind(input.timestamp, receivedAt, conversation.id).run();
      }
      const message = await this.db.prepare("SELECT id FROM messages WHERE conversation_id = ? AND external_id = ?")
        .bind(conversation.id, input.externalMessageId).first<{ id: number }>();
      if (!message) throw new Error("Message persistence failed");
      await this.db.prepare(`
        INSERT INTO ai_jobs(conversation_id, target_message_id, status, attempts, updated_at)
        VALUES(?, ?, 'pending', 0, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
          target_message_id = MAX(ai_jobs.target_message_id, excluded.target_message_id),
          status = CASE
            WHEN excluded.target_message_id > ai_jobs.target_message_id AND ai_jobs.status != 'processing' THEN 'pending'
            ELSE ai_jobs.status
          END,
          last_error = CASE WHEN excluded.target_message_id > ai_jobs.target_message_id THEN NULL ELSE ai_jobs.last_error END,
          updated_at = CASE WHEN excluded.target_message_id > ai_jobs.target_message_id THEN excluded.updated_at ELSE ai_jobs.updated_at END
      `).bind(conversation.id, message.id, receivedAt).run();
      await this.db.prepare(`
        UPDATE channel_events SET status = 'processed', processed_at = ?, conversation_id = ?, last_error = NULL
        WHERE id = ?
      `).bind(Date.now(), conversation.id, claim.id).run();
      return { inserted: rowChanges(inserted) > 0, status: "processed" as const, conversationId: conversation.id, mode: conversation.mode, eventId: claim.id };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Inbound event processing failed";
      await this.db.prepare("UPDATE channel_events SET status = 'failed', last_error = ?, claimed_at = NULL WHERE id = ?")
        .bind(message, claim.id).run();
      throw error;
    }
  }

  async recordTelegramInbound(input: TelegramInbound) {
    const channel = input.channel ?? "telegram";
    return this.recordInbound({
      channel,
      eventId: input.updateId,
      externalMessageId: input.messageId,
      externalConversationId: input.chatId,
      externalContactId: input.senderId,
      displayName: input.displayName,
      username: input.username,
      text: input.text,
      attachment: input.attachment,
      replyToExternalMessageId: input.replyToProviderMessageId,
      timestamp: input.timestamp,
      payload: input.payload,
      telegramBusinessConnectionId: input.businessConnectionId,
    });
  }

  async syncInstagramConversation(input: {
    instagramAccountId: number;
    instagramUserId: string;
    recipientIgsid: string;
    threadId?: string;
    displayName?: string;
    username?: string;
    messages: InstagramHistoryMessage[];
  }) {
    await this.ready();
    if (!input.messages.length) return null;
    const now = Date.now();
    const externalId = `${input.instagramUserId}:${input.recipientIgsid}`;
    const lastMessageAt = Math.max(...input.messages.map((message) => message.timestamp));
    const inboundTimes = input.messages.filter((message) => message.author === "customer").map((message) => message.timestamp);
    const lastInboundAt = inboundTimes.length ? Math.max(...inboundTimes) : 0;
    await this.db.prepare(`
      INSERT INTO contacts(channel, external_id, display_name, username, created_at, updated_at)
      VALUES('instagram', ?, ?, ?, ?, ?)
      ON CONFLICT(channel, external_id) DO UPDATE SET
        display_name = CASE WHEN excluded.display_name LIKE 'Instagram user %' THEN contacts.display_name ELSE excluded.display_name END,
        username = COALESCE(excluded.username, contacts.username),
        updated_at = excluded.updated_at
    `).bind(externalId, input.displayName?.trim() || `Instagram user ${input.recipientIgsid.slice(-6)}`, input.username ?? null, now, now).run();
    const contact = await this.db.prepare("SELECT id FROM contacts WHERE channel = 'instagram' AND external_id = ?")
      .bind(externalId).first<{ id: number }>();
    if (!contact) throw new Error("Instagram contact sync failed");
    await this.db.prepare(`
      INSERT INTO conversations(contact_id, channel, external_chat_id, last_message_at, created_at, updated_at)
      VALUES(?, 'instagram', ?, ?, ?, ?)
      ON CONFLICT(channel, external_chat_id) DO UPDATE SET
        contact_id = excluded.contact_id,
        last_message_at = MAX(conversations.last_message_at, excluded.last_message_at),
        updated_at = excluded.updated_at
    `).bind(contact.id, externalId, lastMessageAt, now, now).run();
    const conversation = await this.db.prepare("SELECT id FROM conversations WHERE channel = 'instagram' AND external_chat_id = ?")
      .bind(externalId).first<{ id: number }>();
    if (!conversation) throw new Error("Instagram conversation sync failed");
    await this.db.prepare(`
      INSERT INTO instagram_conversations(conversation_id, instagram_account_id, recipient_igsid, thread_id, last_inbound_at, messaging_window_until, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        instagram_account_id = excluded.instagram_account_id,
        recipient_igsid = excluded.recipient_igsid,
        thread_id = COALESCE(excluded.thread_id, instagram_conversations.thread_id),
        last_inbound_at = MAX(instagram_conversations.last_inbound_at, excluded.last_inbound_at),
        messaging_window_until = MAX(instagram_conversations.messaging_window_until, excluded.messaging_window_until),
        updated_at = excluded.updated_at
    `).bind(conversation.id, input.instagramAccountId, input.recipientIgsid, input.threadId ?? null, lastInboundAt, lastInboundAt ? lastInboundAt + 24 * 60 * 60_000 : 0, now).run();
    await this.db.batch(input.messages.map((message) => this.db.prepare(`
      INSERT INTO messages(conversation_id, external_id, direction, author, body, attachment_json, delivery_status, provider_timestamp, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id, external_id) DO NOTHING
    `).bind(
      conversation.id,
      message.externalMessageId,
      message.author === "customer" ? "inbound" : "outbound",
      message.author,
      message.text,
      message.attachment ? JSON.stringify(message.attachment) : null,
      message.author === "customer" ? "received" : "sent",
      message.timestamp,
      now,
    )));
    return conversation.id;
  }

  async setMode(conversationId: number, mode: ConversationMode) {
    await this.ready();
    const now = Date.now();
    const result = await this.db.prepare(`
      UPDATE conversations SET mode = ?, unread_count = 0, updated_at = ?
      WHERE id = ? AND (delivery_lock_author IS NULL OR delivery_lock_author != 'ai' OR COALESCE(delivery_lock_until, 0) <= ?)
    `).bind(mode, now, conversationId, now).run();
    if (rowChanges(result) > 0) return "updated" as const;
    const conversation = await this.db.prepare("SELECT delivery_lock_author AS deliveryLockAuthor, delivery_lock_until AS deliveryLockUntil FROM conversations WHERE id = ?")
      .bind(conversationId).first<{ deliveryLockAuthor: string | null; deliveryLockUntil: number | null }>();
    return conversation ? "busy" as const : "missing" as const;
  }

  async getMode(conversationId: number) {
    await this.ready();
    return this.db.prepare("SELECT mode FROM conversations WHERE id = ?").bind(conversationId).first<{ mode: ConversationMode }>();
  }

  async getConversationChannel(conversationId: number) {
    await this.ready();
    return this.db.prepare("SELECT channel FROM conversations WHERE id = ?")
      .bind(conversationId).first<{ channel: ConversationChannel }>();
  }

  async claimDelivery(message: Pick<OutboundMessage, "id" | "conversationId" | "author">, aiJob?: AiJobClaim) {
    await this.ready();
    const now = Date.now();
    const aiGuard = message.author === "ai"
      ? `AND c.mode = 'AI_ACTIVE' AND EXISTS (
          SELECT 1 FROM ai_jobs j WHERE j.conversation_id = c.id AND j.lease_token = ? AND j.target_message_id = ? AND j.status = 'processing'
        )`
      : "";
    const values: (string | number)[] = [message.id, message.author, now + 30_000, message.conversationId, now, now - 1_000];
    if (message.author === "ai") values.push(aiJob?.leaseToken ?? "", aiJob?.targetMessageId ?? 0);
    const result = await this.db.prepare(`
      UPDATE conversations AS c SET delivery_lock_message_id = ?, delivery_lock_author = ?, delivery_lock_until = ?
      WHERE c.id = ?
        AND (c.delivery_lock_message_id IS NULL OR COALESCE(c.delivery_lock_until, 0) <= ?)
        AND COALESCE(c.last_delivery_at, 0) <= ?
        ${aiGuard}
    `).bind(...values).run();
    if (rowChanges(result) === 0) {
      const state = await this.db.prepare(`
        SELECT c.mode, j.lease_token AS leaseToken, j.target_message_id AS targetMessageId, j.status AS jobStatus
        FROM conversations c LEFT JOIN ai_jobs j ON j.conversation_id = c.id WHERE c.id = ?
      `).bind(message.conversationId).first<{ mode: ConversationMode; leaseToken: string | null; targetMessageId: number | null; jobStatus: string | null }>();
      if (!state) return "missing" as const;
      if (message.author === "ai" && (state.mode !== "AI_ACTIVE" || state.leaseToken !== aiJob?.leaseToken || state.targetMessageId !== aiJob?.targetMessageId || state.jobStatus !== "processing")) return "cancelled" as const;
      return "busy" as const;
    }
    await this.db.prepare("UPDATE messages SET delivery_attempts = delivery_attempts + 1, delivery_error = NULL, last_attempt_at = ? WHERE id = ?")
      .bind(now, message.id).run();
    return "claimed" as const;
  }

  async releaseDelivery(conversationId: number, messageId: number) {
    await this.ready();
    await this.db.prepare(`
      UPDATE conversations SET delivery_lock_message_id = NULL, delivery_lock_author = NULL, delivery_lock_until = NULL, last_delivery_at = ?
      WHERE id = ? AND delivery_lock_message_id = ?
    `).bind(Date.now(), conversationId, messageId).run();
  }

  async claimAiJob(conversationId: number): Promise<AiJobClaim | null> {
    await this.ready();
    const now = Date.now();
    const leaseToken = crypto.randomUUID();
    const job = await this.db.prepare(`
      UPDATE ai_jobs SET status = 'processing', lease_token = ?, lease_until = ?, attempts = attempts + 1, last_error = NULL, updated_at = ?
      WHERE conversation_id = ? AND (status = 'pending' OR (status = 'processing' AND COALESCE(lease_until, 0) <= ?))
      RETURNING conversation_id AS conversationId, target_message_id AS targetMessageId
    `).bind(leaseToken, now + 60_000, now, conversationId, now).first<{ conversationId: number; targetMessageId: number }>();
    return job ? { ...job, leaseToken } : null;
  }

  async finishAiJob(claim: AiJobClaim, error?: string) {
    await this.ready();
    const now = Date.now();
    if (error) {
      await this.db.prepare(`
        UPDATE ai_jobs SET status = 'failed', lease_token = NULL, lease_until = NULL, last_error = ?, updated_at = ?
        WHERE conversation_id = ? AND lease_token = ?
      `).bind(error.slice(0, 1000), now, claim.conversationId, claim.leaseToken).run();
      return false;
    }
    await this.db.prepare(`
      UPDATE ai_jobs SET
        status = CASE WHEN target_message_id > ? THEN 'pending' ELSE 'processed' END,
        lease_token = NULL,
        lease_until = NULL,
        last_error = NULL,
        completed_at = CASE WHEN target_message_id > ? THEN completed_at ELSE ? END,
        updated_at = ?
      WHERE conversation_id = ? AND lease_token = ?
    `).bind(claim.targetMessageId, claim.targetMessageId, now, now, claim.conversationId, claim.leaseToken).run();
    const next = await this.db.prepare("SELECT status FROM ai_jobs WHERE conversation_id = ?")
      .bind(claim.conversationId).first<{ status: string }>();
    return next?.status === "pending";
  }

  async createOutbound(conversationId: number, author: "ai" | "human", body: string, options: { attachment?: MessageAttachment; replyToMessageId?: number; aiJob?: AiJobClaim } = {}): Promise<OutboundMessage | null> {
    await this.ready();
    const now = Date.now();
    if (author === "human" && await this.setMode(conversationId, "HUMAN_ACTIVE") !== "updated") return null;
    const localId = `local:${crypto.randomUUID()}`;
    const guard = author === "ai" ? `AND mode = 'AI_ACTIVE' AND EXISTS (
      SELECT 1 FROM ai_jobs j WHERE j.conversation_id = conversations.id AND j.lease_token = ? AND j.target_message_id = ? AND j.status = 'processing'
    )` : "";
    let replyToMessageId: number | null = null;
    if (options.replyToMessageId) {
      const reply = await this.db.prepare("SELECT id FROM messages WHERE id = ? AND conversation_id = ? AND delivery_status IN ('received', 'sent')")
        .bind(options.replyToMessageId, conversationId).first<{ id: number }>();
      if (!reply) return null;
      replyToMessageId = reply.id;
    }
    const values: (string | number | null)[] = [localId, author, body, options.attachment ? JSON.stringify(options.attachment) : null, replyToMessageId, now, conversationId];
    if (author === "ai") values.push(options.aiJob?.leaseToken ?? "", options.aiJob?.targetMessageId ?? 0);
    const inserted = await this.db.prepare(`
      INSERT INTO messages(conversation_id, external_id, direction, author, body, attachment_json, reply_to_message_id, delivery_status, created_at)
      SELECT id, ?, 'outbound', ?, ?, ?, ?, 'pending', ? FROM conversations WHERE id = ? ${guard}
    `).bind(...values).run();
    if (rowChanges(inserted) === 0) return null;
    await this.db.prepare("UPDATE conversations SET unread_count = 0, last_message_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, conversationId).run();
    return this.db.prepare(`
      SELECT m.id, m.conversation_id AS conversationId, c.external_chat_id AS externalChatId,
        c.channel, m.author, m.body, m.attachment_json AS attachmentJson,
        replied.external_id AS replyToExternalId, tbc.business_connection_id AS businessConnectionId,
        ic.instagram_account_id AS instagramAccountId, ic.recipient_igsid AS instagramRecipientIgsid,
        ic.last_inbound_at AS instagramLastInboundAt,
        ic.messaging_window_until AS instagramMessagingWindowUntil
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN messages replied ON replied.id = m.reply_to_message_id
      LEFT JOIN telegram_business_conversations tbc ON tbc.conversation_id = c.id
      LEFT JOIN instagram_conversations ic ON ic.conversation_id = c.id
      WHERE m.conversation_id = ? AND m.external_id = ?
    `).bind(conversationId, localId).first<OutboundMessage & { attachmentJson: string | null }>().then((message) => message ? ({ ...message, attachment: message.attachmentJson ? JSON.parse(message.attachmentJson) as MessageAttachment : null }) : null);
  }

  async finishOutbound(messageId: number, status: "sent" | "failed" | "cancelled", externalId?: string, attachment?: MessageAttachment | null, deliveryError?: string) {
    await this.ready();
    await this.db.prepare("UPDATE messages SET delivery_status = ?, external_id = COALESCE(?, external_id), attachment_json = COALESCE(?, attachment_json), delivery_error = ? WHERE id = ?")
      .bind(status, externalId ?? null, attachment ? JSON.stringify(attachment) : null, deliveryError?.slice(0, 1000) ?? null, messageId).run();
  }

  async getMessageAttachment(messageId: number): Promise<MessageAttachment | null> {
    await this.ready();
    const row = await this.db.prepare("SELECT attachment_json AS attachmentJson FROM messages WHERE id = ?")
      .bind(messageId).first<{ attachmentJson: string | null }>();
    return row?.attachmentJson ? JSON.parse(row.attachmentJson) as MessageAttachment : null;
  }

  async recentHistory(conversationId: number, limit = 20) {
    await this.ready();
    const { results } = await this.db.prepare(`
      SELECT author, body AS text FROM (
        SELECT id, author, body, provider_timestamp, created_at FROM messages
        WHERE conversation_id = ? AND delivery_status IN ('received', 'sent')
        ORDER BY COALESCE(provider_timestamp, created_at) DESC, id DESC LIMIT ?
      ) ORDER BY COALESCE(provider_timestamp, created_at) ASC, id ASC
    `).bind(conversationId, limit).all<{ author: MessageAuthor; text: string }>();
    return results;
  }

  async getSettings(): Promise<InstanceSettings> {
    await this.ready();
    const defaults: Record<string, string> = {
      ai_enabled: "true",
      system_prompt: "You are a helpful sales and support assistant. Be concise, honest, and ask a human to take over when you are uncertain.",
      business_context: "",
      default_language: "Reply in the customer's language.",
    };
    const { results } = await this.db.prepare("SELECT key, value FROM instance_settings").all<{ key: string; value: string }>();
    for (const row of results) defaults[row.key] = row.value;
    return {
      aiEnabled: defaults.ai_enabled === "true",
      systemPrompt: defaults.system_prompt,
      businessContext: defaults.business_context,
      defaultLanguage: defaults.default_language,
    };
  }

  async updateSettings(settings: Partial<InstanceSettings>) {
    await this.ready();
    const entries: [string, string][] = [];
    if (typeof settings.aiEnabled === "boolean") entries.push(["ai_enabled", String(settings.aiEnabled)]);
    if (typeof settings.systemPrompt === "string") entries.push(["system_prompt", settings.systemPrompt.slice(0, 8000)]);
    if (typeof settings.businessContext === "string") entries.push(["business_context", settings.businessContext.slice(0, 50000)]);
    if (typeof settings.defaultLanguage === "string") entries.push(["default_language", settings.defaultLanguage.slice(0, 200)]);
    const now = Date.now();
    if (entries.length) await this.db.batch(entries.map(([key, value]) => this.db.prepare(`
      INSERT INTO instance_settings(key, value, updated_at) VALUES(?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, value, now)));
    return this.getSettings();
  }

  async getTelegramCredentials(): Promise<StoredTelegramCredentials | null> {
    await this.ready();
    const keys = ["telegram_bot_token", "telegram_webhook_secret", "telegram_public_url"];
    const { results } = await this.db.prepare("SELECT key, value FROM instance_settings WHERE key IN (?, ?, ?)")
      .bind(...keys).all<{ key: string; value: string }>();
    const values = Object.fromEntries(results.map((row) => [row.key, row.value]));
    if (!values.telegram_bot_token || !values.telegram_webhook_secret) return null;
    return {
      encryptedBotToken: values.telegram_bot_token,
      encryptedWebhookSecret: values.telegram_webhook_secret,
      publicUrl: values.telegram_public_url ?? "",
    };
  }

  async saveTelegramCredentials(credentials: StoredTelegramCredentials) {
    await this.ready();
    const now = Date.now();
    const values: [string, string][] = [
      ["telegram_bot_token", credentials.encryptedBotToken],
      ["telegram_webhook_secret", credentials.encryptedWebhookSecret],
      ["telegram_public_url", credentials.publicUrl],
    ];
    await this.db.batch(values.map(([key, value]) => this.db.prepare(`
      INSERT INTO instance_settings(key, value, updated_at) VALUES(?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, value, now)));
  }

  async clearTelegramCredentials() {
    await this.ready();
    await this.db.prepare("DELETE FROM instance_settings WHERE key IN (?, ?, ?)")
      .bind("telegram_bot_token", "telegram_webhook_secret", "telegram_public_url").run();
  }

  async getAiCredentials(): Promise<StoredAiCredentials | null> {
    await this.ready();
    const keys = ["ai_provider", "ai_api_key", "ai_model"];
    const { results } = await this.db.prepare("SELECT key, value FROM instance_settings WHERE key IN (?, ?, ?)")
      .bind(...keys).all<{ key: string; value: string }>();
    const values = Object.fromEntries(results.map((row) => [row.key, row.value]));
    if (values.ai_provider !== "openrouter" || !values.ai_api_key || !values.ai_model) return null;
    return { provider: "openrouter", encryptedApiKey: values.ai_api_key, model: values.ai_model };
  }

  async saveAiCredentials(credentials: StoredAiCredentials) {
    await this.ready();
    const now = Date.now();
    const values: [string, string][] = [
      ["ai_provider", credentials.provider],
      ["ai_api_key", credentials.encryptedApiKey],
      ["ai_model", credentials.model],
    ];
    await this.db.batch(values.map(([key, value]) => this.db.prepare(`
      INSERT INTO instance_settings(key, value, updated_at) VALUES(?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, value, now)));
  }

  async clearAiCredentials() {
    await this.ready();
    await this.db.prepare("DELETE FROM instance_settings WHERE key IN (?, ?, ?)")
      .bind("ai_provider", "ai_api_key", "ai_model").run();
  }

  async saveTelegramBusinessConnection(connection: TelegramBusinessConnection) {
    await this.ready();
    await this.db.prepare(`
      INSERT INTO telegram_business_connections(id, account_user_id, display_name, username, can_reply, enabled, payload, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        account_user_id = excluded.account_user_id,
        display_name = excluded.display_name,
        username = excluded.username,
        can_reply = excluded.can_reply,
        enabled = excluded.enabled,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `).bind(connection.id, connection.accountUserId, connection.displayName, connection.username ?? null, connection.canReply ? 1 : 0, connection.enabled ? 1 : 0, connection.payload, connection.updatedAt).run();
  }

  async getTelegramBusinessConnection(id: string): Promise<TelegramBusinessConnection | null> {
    await this.ready();
    const row = await this.db.prepare(`
      SELECT id, account_user_id AS accountUserId, display_name AS displayName, username,
        can_reply AS canReply, enabled, payload, updated_at AS updatedAt
      FROM telegram_business_connections WHERE id = ?
    `).bind(id).first<TelegramBusinessConnection & { canReply: boolean | number; enabled: boolean | number }>();
    return row ? { ...row, canReply: Boolean(row.canReply), enabled: Boolean(row.enabled) } : null;
  }

  async getLatestTelegramBusinessConnection(): Promise<TelegramBusinessConnection | null> {
    await this.ready();
    const row = await this.db.prepare(`
      SELECT id, account_user_id AS accountUserId, display_name AS displayName, username,
        can_reply AS canReply, enabled, payload, updated_at AS updatedAt
      FROM telegram_business_connections ORDER BY updated_at DESC LIMIT 1
    `).first<TelegramBusinessConnection & { canReply: boolean | number; enabled: boolean | number }>();
    return row ? { ...row, canReply: Boolean(row.canReply), enabled: Boolean(row.enabled) } : null;
  }

  async getMessageAttachmentContext(messageId: number) {
    await this.ready();
    const row = await this.db.prepare(`
      SELECT m.attachment_json AS attachmentJson, c.channel
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ?
    `).bind(messageId).first<{ attachmentJson: string | null; channel: ConversationChannel }>();
    return row?.attachmentJson ? { channel: row.channel, attachment: JSON.parse(row.attachmentJson) as MessageAttachment } : null;
  }

  async updateContactProfile(channel: ConversationChannel, externalId: string, displayName: string, username?: string) {
    await this.ready();
    await this.db.prepare(`
      UPDATE contacts SET display_name = ?, username = COALESCE(?, username), updated_at = ?
      WHERE channel = ? AND external_id = ?
    `).bind(displayName.slice(0, 200), username?.slice(0, 200) ?? null, Date.now(), channel, externalId).run();
  }

  async saveInstagramAccount(account: Omit<InstagramAccount, "id" | "connectedAt" | "updatedAt" | "lastError"> & { id?: number; lastError?: string | null }) {
    await this.ready();
    const now = Date.now();
    await this.db.prepare(`
      INSERT INTO instagram_accounts(
        instagram_user_id, app_scoped_user_id, username, display_name, profile_picture_url,
        encrypted_access_token, token_expires_at, scopes_json, webhook_subscribed,
        connected_at, updated_at, last_error
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(instagram_user_id) DO UPDATE SET
        app_scoped_user_id = excluded.app_scoped_user_id,
        username = excluded.username,
        display_name = excluded.display_name,
        profile_picture_url = excluded.profile_picture_url,
        encrypted_access_token = excluded.encrypted_access_token,
        token_expires_at = excluded.token_expires_at,
        scopes_json = excluded.scopes_json,
        webhook_subscribed = excluded.webhook_subscribed,
        updated_at = excluded.updated_at,
        last_error = excluded.last_error
    `).bind(
      account.instagramUserId,
      account.appScopedUserId,
      account.username,
      account.displayName,
      account.profilePictureUrl,
      account.encryptedAccessToken,
      account.tokenExpiresAt,
      JSON.stringify(account.scopes),
      account.webhookSubscribed ? 1 : 0,
      now,
      now,
      account.lastError ?? null,
    ).run();
    const saved = await this.getInstagramAccountByUserId(account.instagramUserId);
    if (!saved) throw new Error("Instagram account persistence failed");
    return saved;
  }

  async listInstagramAccounts(): Promise<InstagramAccount[]> {
    await this.ready();
    const { results } = await this.db.prepare(`
      SELECT id, instagram_user_id AS instagramUserId, app_scoped_user_id AS appScopedUserId,
        username, display_name AS displayName, profile_picture_url AS profilePictureUrl,
        encrypted_access_token AS encryptedAccessToken, token_expires_at AS tokenExpiresAt,
        scopes_json AS scopesJson, webhook_subscribed AS webhookSubscribed,
        connected_at AS connectedAt, updated_at AS updatedAt, last_error AS lastError
      FROM instagram_accounts ORDER BY updated_at DESC
    `).all<InstagramAccount & { scopesJson: string; webhookSubscribed: boolean | number }>();
    return results.map(({ scopesJson, webhookSubscribed, ...account }) => ({
      ...account,
      scopes: JSON.parse(scopesJson) as string[],
      webhookSubscribed: Boolean(webhookSubscribed),
    }));
  }

  async getInstagramAccount(id: number): Promise<InstagramAccount | null> {
    const accounts = await this.listInstagramAccounts();
    return accounts.find((account) => account.id === id) ?? null;
  }

  async getInstagramAccountByUserId(instagramUserId: string): Promise<InstagramAccount | null> {
    const accounts = await this.listInstagramAccounts();
    return accounts.find((account) => account.instagramUserId === instagramUserId) ?? null;
  }

  async updateInstagramAccountHealth(id: number, webhookSubscribed: boolean, lastError: string | null) {
    await this.ready();
    await this.db.prepare("UPDATE instagram_accounts SET webhook_subscribed = ?, last_error = ?, updated_at = ? WHERE id = ?")
      .bind(webhookSubscribed ? 1 : 0, lastError?.slice(0, 1000) ?? null, Date.now(), id).run();
  }

  async updateInstagramToken(id: number, encryptedAccessToken: string, tokenExpiresAt: number) {
    await this.ready();
    await this.db.prepare(`
      UPDATE instagram_accounts SET encrypted_access_token = ?, token_expires_at = ?, last_error = NULL, updated_at = ?
      WHERE id = ?
    `).bind(encryptedAccessToken, tokenExpiresAt, Date.now(), id).run();
  }

  async setInstagramAccountError(id: number, error: string) {
    await this.ready();
    await this.db.prepare("UPDATE instagram_accounts SET last_error = ?, updated_at = ? WHERE id = ?")
      .bind(error.slice(0, 1000), Date.now(), id).run();
  }

  async deleteInstagramAccount(id: number) {
    await this.ready();
    const result = await this.db.prepare("DELETE FROM instagram_accounts WHERE id = ?").bind(id).run();
    return rowChanges(result) > 0;
  }

  async getInstagramConversationContext(conversationId: number): Promise<InstagramConversationContext | null> {
    await this.ready();
    return this.db.prepare(`
      SELECT ic.instagram_account_id AS instagramAccountId, ia.instagram_user_id AS instagramUserId,
        ic.recipient_igsid AS recipientIgsid, ic.thread_id AS threadId,
        ic.last_inbound_at AS lastInboundAt, ic.messaging_window_until AS messagingWindowUntil
      FROM instagram_conversations ic
      JOIN instagram_accounts ia ON ia.id = ic.instagram_account_id
      WHERE ic.conversation_id = ?
    `).bind(conversationId).first<InstagramConversationContext>();
  }

  async createOauthState(provider: "instagram", ttlMs = 10 * 60_000) {
    await this.ready();
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
    const stateHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const now = Date.now();
    await this.db.batch([
      this.db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now),
      this.db.prepare("INSERT INTO oauth_states(state_hash, provider, expires_at, created_at) VALUES(?, ?, ?, ?)").bind(stateHash, provider, now + ttlMs, now),
    ]);
    return state;
  }

  async consumeOauthState(provider: "instagram", state: string) {
    await this.ready();
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
    const stateHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const consumed = await this.db.prepare("DELETE FROM oauth_states WHERE state_hash = ? AND provider = ? AND expires_at > ? RETURNING state_hash AS stateHash")
      .bind(stateHash, provider, Date.now()).first<{ stateHash: string }>();
    return Boolean(consumed);
  }

  async listInstagramAutomations(instagramAccountId?: number): Promise<InstagramAutomation[]> {
    await this.ready();
    const where = instagramAccountId ? "WHERE a.instagram_account_id = ?" : "";
    const statement = this.db.prepare(`
      SELECT a.id, a.instagram_account_id AS instagramAccountId, ia.username AS accountUsername,
        a.name, a.trigger_type AS triggerType, a.post_id AS postId,
        a.match_any_post AS matchAnyPost, a.match_any_text AS matchAnyText,
        a.keywords_json AS keywordsJson, a.whole_word_match AS wholeWordMatch,
        a.private_reply_message AS privateReplyMessage,
        a.opening_dm_enabled AS openingDmEnabled, a.opening_dm_message AS openingDmMessage,
        a.opening_dm_button_label AS openingDmButtonLabel, a.link_button_label AS linkButtonLabel,
        a.require_follow AS requireFollow, a.follow_prompt_message AS followPromptMessage,
        a.follow_prompt_button_label AS followPromptButtonLabel,
        a.follow_up_enabled AS followUpEnabled, a.follow_up_message AS followUpMessage,
        a.follow_up_delay_minutes AS followUpDelayMinutes, a.pending_next_reel AS pendingNextReel,
        a.public_reply_enabled AS publicReplyEnabled, a.public_reply_message AS publicReplyMessage,
        a.active, a.created_at AS createdAt, a.updated_at AS updatedAt
      FROM instagram_automations a JOIN instagram_accounts ia ON ia.id = a.instagram_account_id
      ${where} ORDER BY a.updated_at DESC
    `);
    const { results } = await (instagramAccountId ? statement.bind(instagramAccountId) : statement)
      .all<InstagramAutomation & { keywordsJson: string; matchAnyPost: number | boolean; matchAnyText: number | boolean; wholeWordMatch: number | boolean; openingDmEnabled: number | boolean; requireFollow: number | boolean; followUpEnabled: number | boolean; pendingNextReel: number | boolean; publicReplyEnabled: number | boolean; active: number | boolean }>();
    const { results: links } = await this.db.prepare(`
      SELECT id, automation_id AS automationId, slug, label, destination_url AS destinationUrl, position
      FROM instagram_tracked_links WHERE active = 1 ORDER BY automation_id, position
    `).all<InstagramTrackedLink>();
    return results.map(({ keywordsJson, ...automation }) => ({
      ...automation,
      keywords: JSON.parse(keywordsJson) as string[],
      matchAnyPost: Boolean(automation.matchAnyPost),
      matchAnyText: Boolean(automation.matchAnyText),
      wholeWordMatch: Boolean(automation.wholeWordMatch),
      openingDmEnabled: Boolean(automation.openingDmEnabled),
      requireFollow: Boolean(automation.requireFollow),
      followUpEnabled: Boolean(automation.followUpEnabled),
      pendingNextReel: Boolean(automation.pendingNextReel),
      publicReplyEnabled: Boolean(automation.publicReplyEnabled),
      active: Boolean(automation.active),
      trackedLinks: links.filter((link) => link.automationId === automation.id),
    }));
  }

  async createInstagramAutomation(input: InstagramAutomationInput) {
    await this.ready();
    const now = Date.now();
    const result = await this.db.prepare(`
      INSERT INTO instagram_automations(
        instagram_account_id, name, trigger_type, post_id, match_any_post, match_any_text,
        keywords_json, whole_word_match, private_reply_message,
        opening_dm_enabled, opening_dm_message, opening_dm_button_label, link_button_label,
        require_follow, follow_prompt_message, follow_prompt_button_label,
        follow_up_enabled, follow_up_message, follow_up_delay_minutes, pending_next_reel,
        public_reply_enabled, public_reply_message, active, created_at, updated_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      input.instagramAccountId, input.name.trim(), input.triggerType ?? "comment", input.postId?.trim() || null,
      input.matchAnyPost ? 1 : 0, input.matchAnyText ? 1 : 0,
      JSON.stringify(input.keywords ?? []), input.wholeWordMatch === false ? 0 : 1,
      input.privateReplyMessage.trim(),
      input.openingDmEnabled ? 1 : 0, input.openingDmMessage?.trim() || null, input.openingDmButtonLabel?.trim() || null, input.linkButtonLabel?.trim() || null,
      input.requireFollow ? 1 : 0, input.followPromptMessage?.trim() || null, input.followPromptButtonLabel?.trim() || null,
      input.followUpEnabled ? 1 : 0, input.followUpMessage?.trim() || null, Math.max(0, Math.min(1440, input.followUpDelayMinutes ?? 0)), input.pendingNextReel ? 1 : 0,
      input.publicReplyEnabled ? 1 : 0,
      input.publicReplyMessage?.trim() || null, input.active === false ? 0 : 1, now, now,
    ).run();
    const automationId = Number(result.meta.last_row_id);
    const links = (input.trackedLinks ?? []).slice(0, 3);
    if (links.length) await this.db.batch(links.map((link, position) => this.db.prepare(`
      INSERT INTO instagram_tracked_links(automation_id, slug, label, destination_url, position, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).bind(automationId, randomSlug(), link.label.trim(), link.destinationUrl.trim(), position, now, now)));
    return automationId;
  }

  async updateInstagramAutomation(id: number, input: InstagramAutomationInput) {
    await this.ready();
    const exists = await this.db.prepare("SELECT id FROM instagram_automations WHERE id = ?").bind(id).first<{ id: number }>();
    if (!exists) return false;
    const now = Date.now();
    const links = (input.trackedLinks ?? []).slice(0, 3);
    const { results: existingLinks } = await this.db.prepare(`
      SELECT id FROM instagram_tracked_links WHERE automation_id = ?
      ORDER BY active DESC, position ASC, id ASC
    `).bind(id).all<{ id: number }>();
    const statements = [
      this.db.prepare(`
        UPDATE instagram_automations SET
          instagram_account_id = ?, name = ?, trigger_type = ?, post_id = ?,
          match_any_post = ?, match_any_text = ?, keywords_json = ?, whole_word_match = ?,
          private_reply_message = ?, opening_dm_enabled = ?, opening_dm_message = ?,
          opening_dm_button_label = ?, link_button_label = ?, require_follow = ?,
          follow_prompt_message = ?, follow_prompt_button_label = ?, follow_up_enabled = ?,
          follow_up_message = ?, follow_up_delay_minutes = ?, pending_next_reel = ?,
          public_reply_enabled = ?, public_reply_message = ?, active = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        input.instagramAccountId, input.name.trim(), input.triggerType ?? "comment", input.postId?.trim() || null,
        input.matchAnyPost ? 1 : 0, input.matchAnyText ? 1 : 0, JSON.stringify(input.keywords ?? []), input.wholeWordMatch === false ? 0 : 1,
        input.privateReplyMessage.trim(), input.openingDmEnabled ? 1 : 0, input.openingDmMessage?.trim() || null,
        input.openingDmButtonLabel?.trim() || null, input.linkButtonLabel?.trim() || null, input.requireFollow ? 1 : 0,
        input.followPromptMessage?.trim() || null, input.followPromptButtonLabel?.trim() || null, input.followUpEnabled ? 1 : 0,
        input.followUpMessage?.trim() || null, Math.max(0, Math.min(1440, input.followUpDelayMinutes ?? 0)), input.pendingNextReel ? 1 : 0,
        input.publicReplyEnabled ? 1 : 0, input.publicReplyMessage?.trim() || null, input.active === false ? 0 : 1, now, id,
      ),
      this.db.prepare("UPDATE instagram_tracked_links SET active = 0, position = -id, updated_at = ? WHERE automation_id = ?").bind(now, id),
      ...links.map((link, position) => existingLinks[position]
        ? this.db.prepare(`UPDATE instagram_tracked_links SET label = ?, destination_url = ?, position = ?, active = 1, updated_at = ? WHERE id = ?`)
          .bind(link.label.trim(), link.destinationUrl.trim(), position, now, existingLinks[position].id)
        : this.db.prepare(`
          INSERT INTO instagram_tracked_links(automation_id, slug, label, destination_url, position, active, created_at, updated_at)
          VALUES(?, ?, ?, ?, ?, 1, ?, ?)
        `).bind(id, randomSlug(), link.label.trim(), link.destinationUrl.trim(), position, now, now)),
    ];
    await this.db.batch(statements);
    return true;
  }

  async setInstagramAutomationActive(id: number, active: boolean) {
    await this.ready();
    const result = await this.db.prepare("UPDATE instagram_automations SET active = ?, updated_at = ? WHERE id = ?")
      .bind(active ? 1 : 0, Date.now(), id).run();
    return rowChanges(result) > 0;
  }

  async deleteInstagramAutomation(id: number) {
    await this.ready();
    const result = await this.db.prepare("DELETE FROM instagram_automations WHERE id = ?").bind(id).run();
    return rowChanges(result) > 0;
  }

  async activateNextReelAutomation(automationId: number, mediaId: string) {
    await this.ready();
    const result = await this.db.prepare(`
      UPDATE instagram_automations SET post_id = ?, pending_next_reel = 0, updated_at = ?
      WHERE id = ? AND pending_next_reel = 1 AND active = 1
    `).bind(mediaId, Date.now(), automationId).run();
    return rowChanges(result) > 0;
  }

  async markInstagramCommentSeen(instagramAccountId: number, commentId: string, source: "webhook" | "polling") {
    await this.ready();
    const result = await this.db.prepare(`
      INSERT INTO instagram_processed_comments(comment_id, instagram_account_id, source, seen_at)
      VALUES(?, ?, ?, ?) ON CONFLICT(comment_id) DO NOTHING
    `).bind(commentId, instagramAccountId, source, Date.now()).run();
    return rowChanges(result) > 0;
  }

  async enqueueInstagramAutomationRun(input: {
    automationId: number;
    instagramAccountId: number;
    triggerType: "comment" | "dm";
    triggerExternalId: string;
    subjectIgsid: string;
    subjectUsername?: string;
    inputText: string;
    matchedKeyword?: string | null;
    interactionAt?: number | null;
  }) {
    await this.ready();
    const now = Date.now();
    const result = await this.db.prepare(`
      INSERT INTO instagram_automation_runs(
        automation_id, instagram_account_id, trigger_type, trigger_external_id,
        subject_igsid, subject_username, input_text, matched_keyword,
        status, attempts, scheduled_at, last_interaction_at, created_at, updated_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)
      ON CONFLICT(automation_id, trigger_type, trigger_external_id) DO NOTHING
    `).bind(
      input.automationId, input.instagramAccountId, input.triggerType, input.triggerExternalId,
      input.subjectIgsid, input.subjectUsername ?? null, input.inputText, input.matchedKeyword ?? null,
      now, input.interactionAt ?? null, now, now,
    ).run();
    return rowChanges(result) > 0;
  }

  async claimInstagramAutomationRun(): Promise<InstagramAutomationRunClaim | null> {
    await this.ready();
    const now = Date.now();
    const leaseToken = crypto.randomUUID();
    const claimed = await this.db.prepare(`
      UPDATE instagram_automation_runs SET status = 'processing', lease_token = ?, lease_until = ?, attempts = attempts + 1, last_error = NULL, updated_at = ?
      WHERE id = (
        SELECT id FROM instagram_automation_runs
        WHERE (scheduled_at <= ? AND status = 'pending') OR
          (status = 'sent' AND follow_up_scheduled_at IS NOT NULL AND follow_up_scheduled_at <= ? AND follow_up_sent_at IS NULL)
        ORDER BY scheduled_at ASC, id ASC LIMIT 1
      ) RETURNING id
    `).bind(leaseToken, now + 60_000, now, now, now).first<{ id: number }>();
    if (!claimed) return null;
    const run = await this.db.prepare(`
      SELECT r.id, r.automation_id AS automationId, r.instagram_account_id AS instagramAccountId,
        ia.instagram_user_id AS instagramUserId, ia.encrypted_access_token AS encryptedAccessToken,
        r.trigger_type AS triggerType, r.trigger_external_id AS triggerExternalId,
        r.subject_igsid AS subjectIgsid, r.subject_username AS subjectUsername,
        r.attempts,
        a.private_reply_message AS privateReplyMessage,
        a.opening_dm_enabled AS openingDmEnabled, a.opening_dm_message AS openingDmMessage,
        a.opening_dm_button_label AS openingDmButtonLabel, a.link_button_label AS linkButtonLabel,
        a.require_follow AS requireFollow, a.follow_prompt_message AS followPromptMessage,
        a.follow_prompt_button_label AS followPromptButtonLabel,
        a.follow_up_enabled AS followUpEnabled, a.follow_up_message AS followUpMessage,
        a.follow_up_delay_minutes AS followUpDelayMinutes,
        a.public_reply_enabled AS publicReplyEnabled, a.public_reply_message AS publicReplyMessage,
        r.private_reply_sent_at AS privateReplySentAt, r.public_reply_sent_at AS publicReplySentAt,
        r.reveal_sent_at AS revealSentAt, r.follow_up_scheduled_at AS followUpScheduledAt,
        r.follow_up_sent_at AS followUpSentAt, r.last_interaction_at AS lastInteractionAt
      FROM instagram_automation_runs r
      JOIN instagram_automations a ON a.id = r.automation_id
      JOIN instagram_accounts ia ON ia.id = r.instagram_account_id
      WHERE r.id = ? AND r.lease_token = ?
    `).bind(claimed.id, leaseToken).first<Omit<InstagramAutomationRunClaim, "leaseToken" | "trackedLinks"> & { openingDmEnabled: number | boolean; requireFollow: number | boolean; followUpEnabled: number | boolean; publicReplyEnabled: number | boolean }>();
    if (!run) return null;
    const { results: trackedLinks } = await this.db.prepare(`
      SELECT id, automation_id AS automationId, slug, label, destination_url AS destinationUrl, position
      FROM instagram_tracked_links WHERE automation_id = ? AND active = 1 ORDER BY position
    `).bind(run.automationId).all<InstagramTrackedLink>();
    return {
      ...run,
      openingDmEnabled: Boolean(run.openingDmEnabled),
      requireFollow: Boolean(run.requireFollow),
      followUpEnabled: Boolean(run.followUpEnabled),
      publicReplyEnabled: Boolean(run.publicReplyEnabled),
      trackedLinks,
      leaseToken,
    };
  }

  async markInstagramAutomationActionSent(run: InstagramAutomationRunClaim, action: "private" | "public") {
    await this.ready();
    const column = action === "private" ? "private_reply_sent_at" : "public_reply_sent_at";
    await this.db.prepare(`UPDATE instagram_automation_runs SET ${column} = ?, updated_at = ? WHERE id = ? AND lease_token = ?`)
      .bind(Date.now(), Date.now(), run.id, run.leaseToken).run();
  }

  async markInstagramAutomationRevealSent(run: InstagramAutomationRunClaim, interactionAt?: number) {
    await this.ready();
    const now = Date.now();
    const followUpAt = run.followUpEnabled && run.followUpMessage && interactionAt
      ? now + Math.max(0, run.followUpDelayMinutes) * 60_000
      : null;
    await this.db.prepare(`
      UPDATE instagram_automation_runs SET reveal_sent_at = ?, follow_up_scheduled_at = ?,
        last_interaction_at = COALESCE(?, last_interaction_at), updated_at = ?
      WHERE id = ? AND lease_token = ?
    `).bind(now, followUpAt, interactionAt ?? null, now, run.id, run.leaseToken).run();
  }

  async markInstagramAutomationFollowUpSent(run: InstagramAutomationRunClaim) {
    await this.ready();
    const now = Date.now();
    await this.db.prepare(`UPDATE instagram_automation_runs SET follow_up_sent_at = ?, updated_at = ? WHERE id = ? AND lease_token = ?`)
      .bind(now, now, run.id, run.leaseToken).run();
  }

  async triggerInstagramAutomationPostback(runId: number, subjectIgsid: string, interactionAt: number) {
    await this.ready();
    const now = Date.now();
    const result = await this.db.prepare(`
      UPDATE instagram_automation_runs SET status = 'pending', scheduled_at = ?, last_interaction_at = ?,
        lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = ?
      WHERE id = ? AND subject_igsid = ? AND status IN ('sent', 'failed')
        AND private_reply_sent_at IS NOT NULL AND reveal_sent_at IS NULL
    `).bind(now, interactionAt, now, runId, subjectIgsid).run();
    const triggered = rowChanges(result) > 0;
    if (triggered) await this.db.prepare(`
      UPDATE instagram_conversations SET last_inbound_at = MAX(last_inbound_at, ?),
        messaging_window_until = MAX(messaging_window_until, ?), updated_at = ?
      WHERE recipient_igsid = ? AND instagram_account_id = (
        SELECT instagram_account_id FROM instagram_automation_runs WHERE id = ?
      )
    `).bind(interactionAt, interactionAt + 24 * 60 * 60_000, now, subjectIgsid, runId).run();
    return triggered;
  }

  async finishInstagramAutomationRun(run: InstagramAutomationRunClaim, error?: string) {
    await this.ready();
    const now = Date.now();
    await this.db.prepare(`
      UPDATE instagram_automation_runs SET status = ?, lease_token = NULL, lease_until = NULL, last_error = ?, updated_at = ?
      WHERE id = ? AND lease_token = ?
    `).bind(error ? "failed" : "sent", error?.slice(0, 1000) ?? null, now, run.id, run.leaseToken).run();
  }

  async rescheduleInstagramAutomationRun(run: InstagramAutomationRunClaim, delayMs: number, error: string) {
    await this.ready();
    const now = Date.now();
    await this.db.prepare(`
      UPDATE instagram_automation_runs SET status = 'pending', lease_token = NULL, lease_until = NULL,
        scheduled_at = ?, last_error = ?, updated_at = ? WHERE id = ? AND lease_token = ?
    `).bind(now + delayMs, error.slice(0, 1000), now, run.id, run.leaseToken).run();
  }

  async claimInstagramSendBudget(instagramAccountId: number, maximumPerHour = 700) {
    await this.ready();
    const now = Date.now();
    const windowStart = now - 60 * 60_000;
    const claimed = await this.db.prepare(`
      INSERT INTO instagram_rate_limits(instagram_account_id, window_started_at, sends)
      VALUES(?, ?, 1)
      ON CONFLICT(instagram_account_id) DO UPDATE SET
        window_started_at = CASE WHEN instagram_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE instagram_rate_limits.window_started_at END,
        sends = CASE WHEN instagram_rate_limits.window_started_at <= ? THEN 1 ELSE instagram_rate_limits.sends + 1 END
      WHERE instagram_rate_limits.window_started_at <= ? OR instagram_rate_limits.sends < ?
      RETURNING sends
    `).bind(instagramAccountId, now, windowStart, windowStart, windowStart, maximumPerHour).first<{ sends: number }>();
    return Boolean(claimed);
  }

  async listInstagramAutomationRuns(limit = 100) {
    await this.ready();
    const { results } = await this.db.prepare(`
      SELECT r.id, r.automation_id AS automationId, a.name AS automationName,
        r.trigger_type AS triggerType, r.trigger_external_id AS triggerExternalId,
        r.subject_username AS subjectUsername, r.input_text AS inputText,
        r.matched_keyword AS matchedKeyword, r.status, r.attempts,
        r.private_reply_sent_at AS privateReplySentAt, r.public_reply_sent_at AS publicReplySentAt,
        r.last_error AS lastError, r.created_at AS createdAt, r.updated_at AS updatedAt
      FROM instagram_automation_runs r JOIN instagram_automations a ON a.id = r.automation_id
      ORDER BY r.created_at DESC LIMIT ?
    `).bind(limit).all();
    return results;
  }

  async getInstagramTrackedLink(slug: string) {
    await this.ready();
    return this.db.prepare(`
      SELECT l.id, l.automation_id AS automationId, a.instagram_account_id AS instagramAccountId,
        l.destination_url AS destinationUrl
      FROM instagram_tracked_links l JOIN instagram_automations a ON a.id = l.automation_id
      WHERE l.slug = ? AND l.active = 1
    `).bind(slug).first<{ id: number; automationId: number; instagramAccountId: number; destinationUrl: string }>();
  }

  async recordInstagramLinkClick(link: { id: number; automationId: number; instagramAccountId: number }, input: { ipHash?: string; userAgent?: string; referrer?: string }) {
    await this.ready();
    await this.db.prepare(`
      INSERT INTO instagram_link_clicks(tracked_link_id, automation_id, instagram_account_id, ip_hash, user_agent, referrer, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).bind(link.id, link.automationId, link.instagramAccountId, input.ipHash?.slice(0, 128) || null, input.userAgent?.slice(0, 500) || null, input.referrer?.slice(0, 1000) || null, Date.now()).run();
  }

  async listInstagramAutomationAnalytics() {
    await this.ready();
    const { results } = await this.db.prepare(`
      SELECT a.id AS automationId, a.name, ia.username AS accountUsername,
        COUNT(DISTINCT r.id) AS runs,
        COUNT(DISTINCT CASE WHEN r.private_reply_sent_at IS NOT NULL THEN r.id END) AS privateReplies,
        COUNT(DISTINCT CASE WHEN r.reveal_sent_at IS NOT NULL THEN r.id END) AS reveals,
        COUNT(DISTINCT CASE WHEN r.public_reply_sent_at IS NOT NULL THEN r.id END) AS publicReplies,
        COUNT(DISTINCT CASE WHEN r.follow_up_sent_at IS NOT NULL THEN r.id END) AS followUps,
        COUNT(DISTINCT CASE WHEN r.status = 'failed' THEN r.id END) AS failures,
        COUNT(DISTINCT c.id) AS clicks
      FROM instagram_automations a
      JOIN instagram_accounts ia ON ia.id = a.instagram_account_id
      LEFT JOIN instagram_automation_runs r ON r.automation_id = a.id
      LEFT JOIN instagram_link_clicks c ON c.automation_id = a.id
      GROUP BY a.id ORDER BY a.updated_at DESC
    `).all();
    return results;
  }

  async retryInstagramAutomationRun(runId: number) {
    await this.ready();
    const now = Date.now();
    const result = await this.db.prepare(`
      UPDATE instagram_automation_runs SET status = 'pending', lease_token = NULL, lease_until = NULL,
        scheduled_at = ?, last_error = NULL, updated_at = ?
      WHERE id = ? AND status = 'failed'
    `).bind(now, now, runId).run();
    return rowChanges(result) > 0;
  }

  async getChannelEventForRetry(eventId: number) {
    await this.ready();
    return this.db.prepare(`
      SELECT id, provider, external_id AS externalId, payload, status
      FROM channel_events WHERE id = ? AND status = 'failed'
    `).bind(eventId).first<{ id: number; provider: string; externalId: string; payload: string; status: "failed" }>();
  }

  async retryAiJob(conversationId: number) {
    await this.ready();
    const result = await this.db.prepare(`
      UPDATE ai_jobs SET status = 'pending', lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = ?
      WHERE conversation_id = ? AND status = 'failed'
    `).bind(Date.now(), conversationId).run();
    return rowChanges(result) > 0;
  }

  async discardPendingAiJob(conversationId: number) {
    await this.ready();
    await this.db.prepare("DELETE FROM ai_jobs WHERE conversation_id = ? AND status = 'pending'").bind(conversationId).run();
  }

  async listOperations(): Promise<OperationsSnapshot> {
    await this.ready();
    await reconcileStaleWork(this.db);
    const [eventsResult, jobsResult, messagesResult, automationRunsResult, countsResult] = await Promise.all([
      this.db.prepare(`
        SELECT id, provider, external_id AS externalId, status, attempts, last_error AS lastError, received_at AS receivedAt
        FROM channel_events WHERE status IN ('failed', 'processing') ORDER BY received_at DESC LIMIT 50
      `).all<OperationsSnapshot["events"][number]>(),
      this.db.prepare(`
        SELECT j.conversation_id AS conversationId, p.display_name AS conversationName, j.status, j.attempts,
          j.last_error AS lastError, j.updated_at AS updatedAt
        FROM ai_jobs j
        JOIN conversations c ON c.id = j.conversation_id
        JOIN contacts p ON p.id = c.contact_id
        WHERE j.status IN ('pending', 'processing', 'failed') ORDER BY j.updated_at DESC LIMIT 50
      `).all<OperationsSnapshot["aiJobs"][number]>(),
      this.db.prepare(`
        SELECT m.id, m.conversation_id AS conversationId, p.display_name AS conversationName, m.body,
          m.delivery_attempts AS attempts, m.delivery_error AS lastError, m.created_at AS createdAt
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        JOIN contacts p ON p.id = c.contact_id
        WHERE m.delivery_status = 'failed' ORDER BY m.created_at DESC LIMIT 50
      `).all<OperationsSnapshot["failedMessages"][number]>(),
      this.db.prepare(`
        SELECT r.id, a.name AS automationName, ia.username AS accountUsername,
          r.trigger_type AS triggerType, r.subject_username AS subjectUsername, r.status, r.attempts,
          r.private_reply_sent_at AS privateReplySentAt, r.public_reply_sent_at AS publicReplySentAt,
          r.last_error AS lastError, r.updated_at AS updatedAt
        FROM instagram_automation_runs r
        JOIN instagram_automations a ON a.id = r.automation_id
        JOIN instagram_accounts ia ON ia.id = r.instagram_account_id
        WHERE r.status IN ('pending', 'processing', 'failed') ORDER BY r.updated_at DESC LIMIT 50
      `).all<OperationsSnapshot["automationRuns"][number]>(),
      this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM channel_events WHERE status = 'failed') AS failedEvents,
          (SELECT COUNT(*) FROM ai_jobs WHERE status = 'failed') AS failedAiJobs,
          (SELECT COUNT(*) FROM ai_jobs WHERE status IN ('pending', 'processing')) AS pendingWork,
          (SELECT COUNT(*) FROM messages WHERE delivery_status = 'failed') AS failedMessages,
          (SELECT COUNT(*) FROM instagram_automation_runs WHERE status = 'failed') AS failedAutomations,
          (SELECT COUNT(*) FROM instagram_automation_runs WHERE status IN ('pending', 'processing')) AS pendingAutomations
      `).first<OperationsSnapshot["counts"]>(),
    ]);
    return {
      events: eventsResult.results,
      aiJobs: jobsResult.results,
      failedMessages: messagesResult.results,
      automationRuns: automationRunsResult.results,
      counts: countsResult ?? { failedEvents: 0, failedAiJobs: 0, pendingWork: 0, failedMessages: 0, failedAutomations: 0, pendingAutomations: 0 },
    };
  }

  async getLoginBlock(key: string) {
    await this.ready();
    const row = await this.db.prepare("SELECT blocked_until AS blockedUntil FROM auth_failures WHERE key = ?")
      .bind(key).first<{ blockedUntil: number }>();
    return Math.max(0, (row?.blockedUntil ?? 0) - Date.now());
  }

  async recordLoginFailure(key: string) {
    await this.ready();
    const now = Date.now();
    const cutoff = now - 15 * 60_000;
    const blockedUntil = now + 15 * 60_000;
    await this.db.prepare(`
      INSERT INTO auth_failures(key, failed_count, window_started_at, blocked_until)
      VALUES(?, 1, ?, 0)
      ON CONFLICT(key) DO UPDATE SET
        failed_count = CASE WHEN auth_failures.window_started_at < ? THEN 1 ELSE auth_failures.failed_count + 1 END,
        window_started_at = CASE WHEN auth_failures.window_started_at < ? THEN excluded.window_started_at ELSE auth_failures.window_started_at END,
        blocked_until = CASE
          WHEN auth_failures.window_started_at < ? THEN 0
          WHEN auth_failures.failed_count + 1 >= 5 THEN ?
          ELSE auth_failures.blocked_until
        END
    `).bind(key, now, cutoff, cutoff, cutoff, blockedUntil).run();
    return this.getLoginBlock(key);
  }

  async clearLoginFailures(key: string) {
    await this.ready();
    await this.db.prepare("DELETE FROM auth_failures WHERE key = ?").bind(key).run();
  }
}
