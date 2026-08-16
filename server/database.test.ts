import { afterEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { OpenChatStore } from "./database";
import type { D1Database, D1PreparedStatement, D1Value } from "./runtime";

let miniflare: Miniflare | undefined;

afterEach(async () => { await miniflare?.dispose(); miniflare = undefined; });

async function createStore() {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });
  const database = await miniflare.getD1Database("DB");
  return new OpenChatStore(database as unknown as D1Database);
}

describe("OpenChatStore", () => {
  it("keeps a failed inbound event retryable instead of poisoning Telegram deduplication", async () => {
    const base = await createStore();
    await base.ready();
    const inner = (base as unknown as { db: D1Database }).db;
    let failed = false;
    const wrap = (statement: D1PreparedStatement, query: string): D1PreparedStatement => ({
      bind: (...values: D1Value[]) => wrap(statement.bind(...values), query),
      first: <T>() => statement.first<T>(),
      all: <T>() => statement.all<T>(),
      run: async () => {
        if (!failed && /INSERT INTO contacts/.test(query)) {
          failed = true;
          throw new Error("simulated contact write failure");
        }
        return statement.run();
      },
    });
    const faultingDatabase: D1Database = {
      prepare: (query) => wrap(inner.prepare(query), query),
      batch: (statements) => inner.batch(statements),
    };
    const store = new OpenChatStore(faultingDatabase);
    const inbound = { updateId: "retry-100", messageId: "77:1", chatId: "77", senderId: "77", displayName: "Aziz", text: "Retry me", timestamp: Date.now(), payload: "{}" };

    await expect(store.recordTelegramInbound(inbound)).rejects.toThrow("simulated contact write failure");
    expect((await store.listOperations()).events).toMatchObject([{ externalId: "retry-100", status: "failed", attempts: 1 }]);

    const recovered = await store.recordTelegramInbound(inbound);
    expect(recovered).toMatchObject({ inserted: true, status: "processed" });
    expect((await store.listOperations()).events).toEqual([]);
  });

  it("persists and deduplicates Telegram updates", async () => {
    const store = await createStore();
    const inbound = {
      updateId: "100",
      messageId: "42:7",
      chatId: "42",
      senderId: "42",
      displayName: "Dilnoza",
      username: "dilnoza",
      text: "Narxi qancha?",
      timestamp: 1_700_000_000_000,
      payload: "{}",
    };
    const first = await store.recordTelegramInbound(inbound);
    const duplicate = await store.recordTelegramInbound(inbound);
    expect(first.inserted).toBe(true);
    expect(duplicate.inserted).toBe(false);
    if (!first.conversationId) throw new Error("Expected inserted conversation");
    expect(await store.listConversations()).toMatchObject([{ name: "Dilnoza", unread: 1, preview: "Narxi qancha?", mode: "AI_ACTIVE" }]);
    expect(await store.listMessages(first.conversationId)).toMatchObject([{ author: "customer", text: "Narxi qancha?", status: "received" }]);
  });

  it("persists media metadata and links replies to the original message", async () => {
    const store = await createStore();
    const first = await store.recordTelegramInbound({
      updateId: "media-1", messageId: "42:7", chatId: "42", senderId: "42", displayName: "Dilnoza",
      text: "Original question", timestamp: Date.now(), payload: "{}",
    });
    if (!first.inserted) throw new Error("Expected first message");
    await store.recordTelegramInbound({
      updateId: "media-2", messageId: "42:8", chatId: "42", senderId: "42", displayName: "Dilnoza",
      text: "Receipt", attachment: { type: "photo", fileId: "photo-1", width: 1280, height: 720 },
      replyToProviderMessageId: "7", timestamp: Date.now() + 1, payload: "{}",
    });

    expect(await store.listMessages(first.conversationId)).toMatchObject([
      { text: "Original question", attachment: null, replyToId: null },
      { text: "Receipt", attachment: { type: "photo", fileId: "photo-1" }, replyToText: "Original question", replyToAuthor: "customer" },
    ]);
  });

  it("guards AI output after human takeover", async () => {
    const store = await createStore();
    const inbound = await store.recordTelegramInbound({ updateId: "101", messageId: "7:1", chatId: "7", senderId: "7", displayName: "Aziz", text: "Hello", timestamp: Date.now(), payload: "{}" });
    if (!inbound.inserted) throw new Error("Expected inserted message");
    await store.setMode(inbound.conversationId, "HUMAN_ACTIVE");
    expect(await store.createOutbound(inbound.conversationId, "ai", "Late reply")).toBeNull();
    const human = await store.createOutbound(inbound.conversationId, "human", "I can help");
    expect(human).toMatchObject({ author: "human", body: "I can help", externalChatId: "7" });
  });

  it("serializes AI work and rejects a stale generation after a newer inbound message", async () => {
    const store = await createStore();
    const first = await store.recordTelegramInbound({ updateId: "ai-1", messageId: "88:1", chatId: "88", senderId: "88", displayName: "Mira", text: "First", timestamp: Date.now(), payload: "{}" });
    if (!first.conversationId) throw new Error("Expected conversation");
    const firstJob = await store.claimAiJob(first.conversationId);
    if (!firstJob) throw new Error("Expected first AI job");

    await store.recordTelegramInbound({ updateId: "ai-2", messageId: "88:2", chatId: "88", senderId: "88", displayName: "Mira", text: "Actually, second", timestamp: Date.now() + 1, payload: "{}" });
    expect(await store.createOutbound(first.conversationId, "ai", "Stale answer", { aiJob: firstJob })).toBeNull();
    expect(await store.finishAiJob(firstJob)).toBe(true);
    const currentJob = await store.claimAiJob(first.conversationId);
    expect(currentJob?.targetMessageId).toBeGreaterThan(firstJob.targetMessageId);
  });

  it("does not complete takeover until an in-flight AI delivery releases its lease", async () => {
    const store = await createStore();
    const inbound = await store.recordTelegramInbound({ updateId: "lease-1", messageId: "99:1", chatId: "99", senderId: "99", displayName: "Nodira", text: "Hello", timestamp: Date.now(), payload: "{}" });
    if (!inbound.conversationId) throw new Error("Expected conversation");
    const job = await store.claimAiJob(inbound.conversationId);
    if (!job) throw new Error("Expected AI job");
    const outbound = await store.createOutbound(inbound.conversationId, "ai", "AI answer", { aiJob: job });
    if (!outbound) throw new Error("Expected outbound message");

    expect(await store.claimDelivery(outbound, job)).toBe("claimed");
    expect(await store.setMode(inbound.conversationId, "HUMAN_ACTIVE")).toBe("busy");
    await store.releaseDelivery(inbound.conversationId, outbound.id);
    expect(await store.setMode(inbound.conversationId, "HUMAN_ACTIVE")).toBe("updated");
    expect(await store.claimDelivery(outbound, job)).toBe("cancelled");
  });

  it("reconciles work interrupted by a restart into operator-visible failures", async () => {
    const store = await createStore();
    const inbound = await store.recordTelegramInbound({ updateId: "stale-1", messageId: "111:1", chatId: "111", senderId: "111", displayName: "Samira", text: "Hello", timestamp: Date.now(), payload: "{}" });
    if (!inbound.conversationId) throw new Error("Expected conversation");
    const job = await store.claimAiJob(inbound.conversationId);
    if (!job) throw new Error("Expected AI job");
    const outbound = await store.createOutbound(inbound.conversationId, "ai", "Interrupted answer", { aiJob: job });
    if (!outbound) throw new Error("Expected outbound message");
    expect(await store.claimDelivery(outbound, job)).toBe("claimed");
    const database = (store as unknown as { db: D1Database }).db;
    await database.batch([
      database.prepare("UPDATE conversations SET delivery_lock_until = 1 WHERE id = ?").bind(inbound.conversationId),
      database.prepare("UPDATE messages SET created_at = 1 WHERE id = ?").bind(outbound.id),
      database.prepare("UPDATE ai_jobs SET lease_until = 1 WHERE conversation_id = ?").bind(inbound.conversationId),
      database.prepare("UPDATE channel_events SET status = 'processing', claimed_at = 1 WHERE external_id = ?").bind("stale-1"),
    ]);

    await store.reconcileStaleWork();
    const operations = await store.listOperations();
    expect(operations.counts).toMatchObject({ failedEvents: 1, failedAiJobs: 1, failedMessages: 1 });
    expect(operations.failedMessages[0].lastError).toContain("interrupted");
  });

  it("links Telegram Business conversations so replies use the profile connection", async () => {
    const store = await createStore();
    await store.saveTelegramBusinessConnection({
      id: "business-123",
      accountUserId: "900",
      displayName: "Test User",
      username: "test_user",
      canReply: true,
      enabled: true,
      payload: "{}",
      updatedAt: Date.now(),
    });
    const inbound = await store.recordTelegramInbound({
      channel: "telegram_business",
      businessConnectionId: "business-123",
      updateId: "102",
      messageId: "business-123:42:8",
      chatId: "42",
      senderId: "42",
      displayName: "Dilnoza",
      username: "dilnoza",
      text: "Are you open?",
      timestamp: Date.now(),
      payload: "{}",
    });
    if (!inbound.inserted) throw new Error("Expected inserted message");

    expect(await store.listConversations()).toMatchObject([{ channel: "telegram_business", name: "Dilnoza" }]);
    expect(await store.createOutbound(inbound.conversationId, "human", "Yes"))
      .toMatchObject({ channel: "telegram_business", externalChatId: "42", businessConnectionId: "business-123" });
    expect(await store.getLatestTelegramBusinessConnection()).toMatchObject({ id: "business-123", canReply: true, enabled: true });
  });

  it("persists encrypted Telegram credentials without exposing plaintext", async () => {
    const store = await createStore();
    await store.saveTelegramCredentials({
      encryptedBotToken: "v1.encrypted-token",
      encryptedWebhookSecret: "v1.encrypted-secret",
      publicUrl: "https://openchat.example",
    });

    expect(await store.getTelegramCredentials()).toEqual({
      encryptedBotToken: "v1.encrypted-token",
      encryptedWebhookSecret: "v1.encrypted-secret",
      publicUrl: "https://openchat.example",
    });
  });

  it("persists encrypted OpenRouter credentials and model choice", async () => {
    const store = await createStore();
    await store.saveAiCredentials({
      provider: "openrouter",
      encryptedApiKey: "v1.encrypted-openrouter-key",
      model: "openrouter/auto",
    });

    expect(await store.getAiCredentials()).toEqual({
      provider: "openrouter",
      encryptedApiKey: "v1.encrypted-openrouter-key",
      model: "openrouter/auto",
    });
  });
});
