import { afterEach, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import { decryptCredential } from "./credentials";
import { OpenChatStore } from "./database";
import { createSession } from "./http";
import { handleOpenChatRequest } from "./openchat";
import type { D1Database, OpenChatEnv, WorkerContext } from "./runtime";

let miniflare: Miniflare | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  await miniflare?.dispose();
  miniflare = undefined;
});

async function testEnvironment() {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });
  const database = await miniflare.getD1Database("DB") as unknown as D1Database;
  const env = {
    DB: database,
    OPENCHAT_ADMIN_PASSWORD: "correct-horse-battery-staple",
    OPENCHAT_SESSION_SECRET: "a-session-secret-that-is-longer-than-thirty-two-characters",
  } as OpenChatEnv;
  const session = await createSession(new Request("http://localhost:3001/api/auth/login"), env, env.OPENCHAT_ADMIN_PASSWORD!);
  return { env, cookie: session.headers.get("set-cookie")!.split(";", 1)[0] };
}

describe("dashboard authentication", () => {
  it("rate-limits repeated password guesses before checking another password", async () => {
    const { env } = await testEnvironment();
    const context = { waitUntil() {}, passThroughOnException() {} } as WorkerContext;
    const login = (password: string) => handleOpenChatRequest(new Request("https://chat.example/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
      body: JSON.stringify({ password }),
    }), env, context);

    for (let attempt = 0; attempt < 4; attempt += 1) expect((await login("wrong-password"))?.status).toBe(401);
    const blocked = await login("wrong-password");
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await login(env.OPENCHAT_ADMIN_PASSWORD!))?.status).toBe(429);
  });
});

describe("operations API", () => {
  it("replays a retained failed Telegram event idempotently", async () => {
    const { env, cookie } = await testEnvironment();
    env.TELEGRAM_BOT_TOKEN = "123456:valid-token";
    env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    const payload = {
      update_id: 515,
      message: { message_id: 9, date: 1_700_000_000, text: "Recover this", from: { id: 51, first_name: "Laylo" }, chat: { id: 51 } },
    };
    const store = new OpenChatStore(env.DB);
    await store.recordTelegramInbound({ updateId: "515", messageId: "51:9", chatId: "51", senderId: "51", displayName: "Laylo", text: "Recover this", timestamp: 1_700_000_000_000, payload: JSON.stringify(payload) });
    await env.DB.prepare("UPDATE channel_events SET status = 'failed', last_error = 'simulated post-write failure' WHERE external_id = ?").bind("515").run();
    const [failed] = (await store.listOperations()).events;
    expect(failed).toMatchObject({ externalId: "515", status: "failed" });

    const background: Promise<unknown>[] = [];
    const response = await handleOpenChatRequest(new Request(`http://localhost:3001/api/operations/events/${failed.id}/retry`, {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
    }), env, { waitUntil(promise) { background.push(promise); }, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ recovered: true, operations: { events: [] } });
    await Promise.all(background);
    expect(await store.listMessages((await store.listConversations())[0].id)).toHaveLength(1);
  });

  it("records an ambiguous AI send failure without making the AI job automatically retryable", async () => {
    const { env } = await testEnvironment();
    env.TELEGRAM_BOT_TOKEN = "123456:valid-token";
    env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    env.OPENAI_API_KEY = "provider-key";
    env.OPENAI_MODEL = "test-model";
    env.OPENAI_BASE_URL = "https://provider.example/v1";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("provider.example")) return Response.json({ choices: [{ message: { content: "AI answer" } }] });
      throw new TypeError("Telegram response was lost");
    }));
    const background: Promise<unknown>[] = [];
    const response = await handleOpenChatRequest(new Request("http://localhost:3001/webhooks/telegram", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "webhook-secret" },
      body: JSON.stringify({ update_id: 616, message: { message_id: 1, date: 1_700_000_000, text: "Hello", from: { id: 61, first_name: "Ali" }, chat: { id: 61 } } }),
    }), env, { waitUntil(promise) { background.push(promise); }, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    await Promise.all(background);
    const operations = await new OpenChatStore(env.DB).listOperations();
    expect(operations.counts).toMatchObject({ failedAiJobs: 0, failedMessages: 1 });
    expect(operations.failedMessages[0]).toMatchObject({ conversationName: "Ali", body: "AI answer", attempts: 1, lastError: "Telegram response was lost" });
  });
});

describe("Telegram setup API", () => {
  it("validates, encrypts, stores, and activates a token entered in the dashboard", async () => {
    const { env, cookie } = await testEnvironment();
    const telegramCalls: string[] = [];
    let webhookBody: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      telegramCalls.push(url.split("/").at(-1) ?? "");
      if (url.endsWith("/getMe")) return Response.json({ ok: true, result: { username: "openchat_test_bot", first_name: "OpenChat" } });
      if (url.endsWith("/getWebhookInfo")) return Response.json({ ok: true, result: { url: "https://chat.example/webhooks/telegram", pending_update_count: 0, allowed_updates: ["message"] } });
      if (url.endsWith("/setWebhook")) {
        webhookBody = JSON.parse(String(init?.body));
        return Response.json({ ok: true, result: true });
      }
      return Response.json({ ok: false, description: "Unexpected Telegram call" }, { status: 400 });
    }));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/setup/telegram", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({ botToken: "123456:valid-token", publicUrl: "https://chat.example" }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ connected: true, bot: { username: "openchat_test_bot" } });
    expect(telegramCalls).toEqual(["getMe", "setWebhook", "getMe", "getWebhookInfo"]);
    expect(webhookBody?.allowed_updates).toEqual(expect.arrayContaining(["message", "business_connection", "business_message"]));

    const stored = await new OpenChatStore(env.DB).getTelegramCredentials();
    expect(stored?.encryptedBotToken).not.toContain("valid-token");
    expect(await decryptCredential(stored!.encryptedBotToken, env.OPENCHAT_SESSION_SECRET!)).toBe("123456:valid-token");
  });

  it("returns a useful message for an invalid token", async () => {
    const { env, cookie } = await testEnvironment();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false, description: "Unauthorized" }, { status: 401 })));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/setup/telegram", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({ botToken: "invalid", publicUrl: "https://chat.example" }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({ error: "Telegram rejected this bot token. Copy a fresh token from @BotFather and try again." });
  });
});

describe("Telegram secretary mode", () => {
  it("stores profile messages and sends dashboard replies through the business connection", async () => {
    const { env, cookie } = await testEnvironment();
    env.TELEGRAM_BOT_TOKEN = "123456:valid-token";
    env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    const context = { waitUntil() {}, passThroughOnException() {} } as WorkerContext;
    const webhookHeaders = { "content-type": "application/json", "x-telegram-bot-api-secret-token": "webhook-secret" };

    const connectionResponse = await handleOpenChatRequest(new Request("http://localhost:3001/webhooks/telegram", {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify({
        update_id: 200,
        business_connection: {
          id: "business-123",
          user: { id: 900, first_name: "Test", username: "test_user" },
          user_chat_id: 900,
          date: 1_700_000_000,
          rights: { can_reply: true },
          is_enabled: true,
        },
      }),
    }), env, context);
    expect(connectionResponse?.status).toBe(200);

    const messageResponse = await handleOpenChatRequest(new Request("http://localhost:3001/webhooks/telegram", {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify({
        update_id: 201,
        business_message: {
          business_connection_id: "business-123",
          message_id: 8,
          date: 1_700_000_001,
          text: "Are you open?",
          from: { id: 42, is_bot: false, first_name: "Dilnoza" },
          chat: { id: 42, type: "private" },
        },
      }),
    }), env, context);
    expect(messageResponse?.status).toBe(200);

    const conversations = await new OpenChatStore(env.DB).listConversations();
    expect(conversations).toMatchObject([{ channel: "telegram_business", preview: "Are you open?" }]);
    const inboundMessages = await new OpenChatStore(env.DB).listMessages(conversations[0].id);

    let telegramBody: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      telegramBody = JSON.parse(String(init?.body));
      return Response.json({ ok: true, result: { message_id: 9 } });
    }));
    const replyResponse = await handleOpenChatRequest(new Request(`http://localhost:3001/api/conversations/${conversations[0].id}/messages`, {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({ text: "Yes, we are.", replyToMessageId: inboundMessages[0].id }),
    }), env, context);
    expect(replyResponse?.status).toBe(201);
    expect(telegramBody).toMatchObject({ chat_id: "42", business_connection_id: "business-123", text: "Yes, we are.", reply_parameters: { message_id: 8 } });
  });

  it("uploads a photo with a caption and stores Telegram's reusable file id", async () => {
    const { env, cookie } = await testEnvironment();
    env.TELEGRAM_BOT_TOKEN = "123456:valid-token";
    env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    const context = { waitUntil() {}, passThroughOnException() {} } as WorkerContext;
    const webhook = await handleOpenChatRequest(new Request("http://localhost:3001/webhooks/telegram", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "webhook-secret" },
      body: JSON.stringify({ update_id: 301, message: { message_id: 10, text: "Send the receipt", from: { id: 42, first_name: "Dilnoza" }, chat: { id: 42 } } }),
    }), env, context);
    expect(webhook?.status).toBe(200);
    const [conversation] = await new OpenChatStore(env.DB).listConversations();
    const [original] = await new OpenChatStore(env.DB).listMessages(conversation.id);

    let telegramForm: FormData | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toContain("/sendPhoto");
      telegramForm = init?.body as FormData;
      return Response.json({ ok: true, result: { message_id: 11, photo: [{ file_id: "telegram-photo-id", width: 640, height: 480, file_size: 4 }] } });
    }));
    const form = new FormData();
    form.append("text", "Here it is");
    form.append("replyToMessageId", String(original.id));
    form.append("file", new File([new Uint8Array([1, 2, 3, 4])], "receipt.png", { type: "image/png" }));
    const response = await handleOpenChatRequest(new Request(`http://localhost:3001/api/conversations/${conversation.id}/messages`, {
      method: "POST", headers: { cookie, origin: "http://localhost:3001" }, body: form,
    }), env, context);

    expect(response?.status).toBe(201);
    expect(telegramForm?.get("chat_id")).toBe("42");
    expect(telegramForm?.get("caption")).toBe("Here it is");
    expect(JSON.parse(String(telegramForm?.get("reply_parameters")))).toMatchObject({ message_id: 10 });
    expect(await response?.json()).toMatchObject({ messages: [{ text: "Send the receipt" }, { text: "Here it is", attachment: { type: "photo", fileId: "telegram-photo-id" } }] });
  });

  it("proxies Telegram attachments through the authenticated dashboard", async () => {
    const { env, cookie } = await testEnvironment();
    env.TELEGRAM_BOT_TOKEN = "123456:valid-token";
    env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    const context = { waitUntil() {}, passThroughOnException() {} } as WorkerContext;
    await handleOpenChatRequest(new Request("http://localhost:3001/webhooks/telegram", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "webhook-secret" },
      body: JSON.stringify({ update_id: 401, message: { message_id: 20, photo: [{ file_id: "private-photo", width: 640, height: 480 }], from: { id: 42, first_name: "Dilnoza" }, chat: { id: 42 } } }),
    }), env, context);
    const [conversation] = await new OpenChatStore(env.DB).listConversations();
    const [message] = await new OpenChatStore(env.DB).listMessages(conversation.id);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/getFile")) return Response.json({ ok: true, result: { file_path: "photos/private.jpg" } });
      if (url.includes("/file/bot")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
      return Response.json({ ok: false }, { status: 404 });
    }));

    const response = await handleOpenChatRequest(new Request(`http://localhost:3001/api/messages/${message.id}/attachment`, { headers: { cookie } }), env, context);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toBe("image/jpeg");
    expect([...new Uint8Array(await response!.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});

describe("OpenRouter setup API", () => {
  it("does not advertise a model when no AI provider is connected", async () => {
    const { env, cookie } = await testEnvironment();
    const context = { waitUntil() {}, passThroughOnException() {} } as WorkerContext;

    const settingsResponse = await handleOpenChatRequest(new Request("http://localhost:3001/api/settings", {
      headers: { cookie },
    }), env, context);
    expect(settingsResponse?.status).toBe(200);
    expect(await settingsResponse?.json()).toMatchObject({
      runtime: { ai: { configured: false, provider: "none", model: "" } },
    });

    const setupResponse = await handleOpenChatRequest(new Request("http://localhost:3001/api/setup/ai", {
      headers: { cookie },
    }), env, context);
    expect(setupResponse?.status).toBe(200);
    expect(await setupResponse?.json()).toMatchObject({
      configured: false,
      provider: "none",
      model: "",
    });
  });

  it("lists models available to an OpenRouter key", async () => {
    const { env, cookie } = await testEnvironment();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://openrouter.ai/api/v1/models/user");
      return Response.json({ data: [
        { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", context_length: 200_000 },
        { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", context_length: 1_000_000 },
      ] });
    }));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/setup/ai/models", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-or-v1-secret" }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ models: [
      { id: "openrouter/auto", name: "Auto Router", contextLength: null },
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", contextLength: 200_000 },
      { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", contextLength: 1_000_000 },
    ] });
  });

  it("validates and encrypts an OpenRouter key entered in the dashboard", async () => {
    const { env, cookie } = await testEnvironment();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/key")) return Response.json({ data: { label: "openchat-key", limit_remaining: 12.5 } });
      if (url.endsWith("/model/openrouter/auto")) return Response.json({ data: { id: "openrouter/auto", name: "Auto Router" } });
      return Response.json({ error: { message: "Unexpected OpenRouter call" } }, { status: 400 });
    }));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/setup/ai", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({ provider: "openrouter", apiKey: "sk-or-v1-secret", model: "openrouter/auto" }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      configured: true,
      source: "dashboard",
      provider: "openrouter",
      model: "openrouter/auto",
      key: { label: "openchat-key", limitRemaining: 12.5 },
    });
    expect(calls).toEqual([
      "https://openrouter.ai/api/v1/key",
      "https://openrouter.ai/api/v1/model/openrouter/auto",
    ]);

    const stored = await new OpenChatStore(env.DB).getAiCredentials();
    expect(stored?.encryptedApiKey).not.toContain("sk-or-v1-secret");
    expect(await decryptCredential(stored!.encryptedApiKey, env.OPENCHAT_SESSION_SECRET!)).toBe("sk-or-v1-secret");
  });
});

describe("assistant test workspace", () => {
  it("tests draft assistant instructions without creating an inbox conversation", async () => {
    const { env, cookie } = await testEnvironment();
    env.OPENAI_API_KEY = "provider-key";
    env.OPENAI_BASE_URL = "https://provider.example/v1";
    env.OPENAI_MODEL = "test-model";
    let providerBody: { messages?: { role: string; content: string }[] } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      providerBody = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: "Draft behavior works." } }] });
    }));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/assistant/test", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({
        settings: {
          aiEnabled: false,
          systemPrompt: "Use the unsaved draft instructions.",
          businessContext: "We close at 8 PM.",
          defaultLanguage: "Reply in English.",
        },
        history: [{ author: "customer", text: "When do you close?" }],
      }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ reply: "Draft behavior works.", escalated: false });
    expect(providerBody?.messages?.[0].content).toContain("Use the unsaved draft instructions.");
    expect(providerBody?.messages?.[0].content).toContain("We close at 8 PM.");
    expect(await new OpenChatStore(env.DB).listConversations()).toEqual([]);
  });

  it("improves an inbox draft without sending or storing it", async () => {
    const { env, cookie } = await testEnvironment();
    env.OPENAI_API_KEY = "provider-key";
    env.OPENAI_BASE_URL = "https://provider.example/v1";
    env.OPENAI_MODEL = "test-model";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: "Hello! I can check that for you." } }] })));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/assistant/improve", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({
        draft: "hello i check",
        history: [{ author: "customer", text: "Is this available?" }],
      }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ text: "Hello! I can check that for you." });
    expect(await new OpenChatStore(env.DB).listConversations()).toEqual([]);
  });

  it("returns a useful Improve error when the AI provider repeatedly times out", async () => {
    const { env, cookie } = await testEnvironment();
    env.OPENAI_API_KEY = "provider-key";
    env.OPENAI_BASE_URL = "https://provider.example/v1";
    env.OPENAI_MODEL = "test-model";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }));

    const response = await handleOpenChatRequest(new Request("http://localhost:3001/api/assistant/improve", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:3001", "content-type": "application/json" },
      body: JSON.stringify({ draft: "hi how cn you heping", history: [] }),
    }), env, { waitUntil() {}, passThroughOnException() {} } as WorkerContext);

    expect(response?.status).toBe(504);
    expect(await response?.json()).toEqual({ error: "The selected AI model took too long. Try Improve again or choose a faster model in Settings." });
  });
});
