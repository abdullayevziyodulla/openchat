import { schemaStatements } from "../db/schema";
import type { D1Database } from "./runtime";

export type ConversationMode = "AI_ACTIVE" | "ESCALATED" | "HUMAN_ACTIVE";
export type MessageAuthor = "customer" | "ai" | "human";
export type ConversationChannel = "telegram" | "telegram_business" | "instagram";

export interface MessageAttachment {
  type: "photo" | "document" | "video" | "video_note" | "audio" | "voice" | "animation" | "sticker";
  fileId?: string;
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

export interface OutboundMessage {
  id: number;
  conversationId: number;
  externalChatId: string;
  channel: ConversationChannel;
  businessConnectionId: string | null;
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
  counts: { failedEvents: number; failedAiJobs: number; pendingWork: number; failedMessages: number };
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

  async recordTelegramInbound(input: TelegramInbound) {
    await this.ready();
    const receivedAt = Date.now();
    const channel = input.channel ?? "telegram";
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
    `).bind(channel, input.updateId, input.payload, receivedAt, receivedAt, receivedAt - 60_000).first<{ id: number }>();
    if (!claim) {
      const existing = await this.db.prepare("SELECT status, conversation_id AS conversationId FROM channel_events WHERE provider = ? AND external_id = ?")
        .bind(channel, input.updateId).first<{ status: "processing" | "processed" | "failed" | "ignored"; conversationId: number | null }>();
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
      `).bind(channel, input.senderId, input.displayName, input.username ?? null, receivedAt, receivedAt).run();
      const contact = await this.db.prepare("SELECT id FROM contacts WHERE channel = ? AND external_id = ?").bind(channel, input.senderId).first<{ id: number }>();
      if (!contact) throw new Error("Contact upsert failed");

      await this.db.prepare(`
        INSERT INTO conversations(contact_id, channel, external_chat_id, last_message_at, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(channel, external_chat_id) DO UPDATE SET
          contact_id = excluded.contact_id,
          last_message_at = MAX(conversations.last_message_at, excluded.last_message_at),
          updated_at = excluded.updated_at
      `).bind(contact.id, channel, input.chatId, input.timestamp, receivedAt, receivedAt).run();
      const conversation = await this.db.prepare("SELECT id, mode FROM conversations WHERE channel = ? AND external_chat_id = ?").bind(channel, input.chatId).first<{ id: number; mode: ConversationMode }>();
      if (!conversation) throw new Error("Conversation upsert failed");
      if (channel === "telegram_business") {
        if (!input.businessConnectionId) throw new Error("Telegram Business message is missing its connection id");
        await this.db.prepare(`
          INSERT INTO telegram_business_conversations(conversation_id, business_connection_id, updated_at)
          VALUES(?, ?, ?)
          ON CONFLICT(conversation_id) DO UPDATE SET
            business_connection_id = excluded.business_connection_id,
            updated_at = excluded.updated_at
        `).bind(conversation.id, input.businessConnectionId, receivedAt).run();
      }

      const replyCandidates = input.replyToProviderMessageId ? [
        `${input.chatId}:${input.replyToProviderMessageId}`,
        `telegram:${input.chatId}:${input.replyToProviderMessageId}`,
        ...(input.businessConnectionId ? [`${input.businessConnectionId}:${input.chatId}:${input.replyToProviderMessageId}`] : []),
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
      `).bind(conversation.id, input.messageId, input.text, input.attachment ? JSON.stringify(input.attachment) : null, replyToMessageId, input.timestamp, receivedAt).run();
      if (rowChanges(inserted) > 0) {
        await this.db.prepare("UPDATE conversations SET unread_count = unread_count + 1, last_message_at = MAX(last_message_at, ?), updated_at = ? WHERE id = ?")
          .bind(input.timestamp, receivedAt, conversation.id).run();
      }
      const message = await this.db.prepare("SELECT id FROM messages WHERE conversation_id = ? AND external_id = ?")
        .bind(conversation.id, input.messageId).first<{ id: number }>();
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
        replied.external_id AS replyToExternalId, tbc.business_connection_id AS businessConnectionId
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN messages replied ON replied.id = m.reply_to_message_id
      LEFT JOIN telegram_business_conversations tbc ON tbc.conversation_id = c.id
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

  async listOperations(): Promise<OperationsSnapshot> {
    await this.ready();
    await reconcileStaleWork(this.db);
    const [eventsResult, jobsResult, messagesResult, countsResult] = await Promise.all([
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
        SELECT
          (SELECT COUNT(*) FROM channel_events WHERE status = 'failed') AS failedEvents,
          (SELECT COUNT(*) FROM ai_jobs WHERE status = 'failed') AS failedAiJobs,
          (SELECT COUNT(*) FROM ai_jobs WHERE status IN ('pending', 'processing')) AS pendingWork,
          (SELECT COUNT(*) FROM messages WHERE delivery_status = 'failed') AS failedMessages
      `).first<OperationsSnapshot["counts"]>(),
    ]);
    return {
      events: eventsResult.results,
      aiJobs: jobsResult.results,
      failedMessages: messagesResult.results,
      counts: countsResult ?? { failedEvents: 0, failedAiJobs: 0, pendingWork: 0, failedMessages: 0 },
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
