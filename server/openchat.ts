import { AiTimeoutError, generateAiReply, improveDraft } from "./ai";
import { encryptCredential, generateWebhookSecret, normalizePublicUrl, openRouterErrorMessage, resolveAiEnvironment, resolveTelegramEnvironment, telegramErrorMessage } from "./credentials";
import { OpenChatStore, type AiJobClaim, type ConversationMode, type InstanceSettings, type MessageAttachment } from "./database";
import { acceptsMutation, authenticationReady, clearSession, createSession, isAuthenticated, json, loginRateKey, readJson } from "./http";
import type { OpenChatEnv, WorkerContext } from "./runtime";
import { inspectOpenRouterKey, inspectOpenRouterModel, listOpenRouterModels } from "./openrouter";
import {
  configureTelegramWebhook,
  downloadTelegramFile,
  inspectTelegramBot,
  inspectTelegramBusinessConnection,
  inspectTelegramWebhook,
  normalizeTelegramBusinessConnection,
  normalizeTelegramBusinessMessage,
  normalizeTelegramUpdate,
  removeTelegramWebhook,
  sendTelegramMessage,
  sendTelegramAttachment,
  telegramBusinessConnectionId,
  telegramProviderMessageId,
} from "./telegram";

function parseId(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function deliver(store: OpenChatStore, env: OpenChatEnv, message: Awaited<ReturnType<OpenChatStore["createOutbound"]>>, file?: File | null, aiJob?: AiJobClaim) {
  if (!message) return null;
  let claimed = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await store.claimDelivery(message, aiJob);
    if (result === "claimed") { claimed = true; break; }
    if (result === "cancelled") {
      await store.finishOutbound(message.id, "cancelled");
      return null;
    }
    if (result === "missing") throw new Error("Conversation no longer exists");
    await delay(200);
  }
  if (!claimed) throw new Error("Another delivery is still in progress. Try again in a moment.");
  try {
    if (message.channel !== "telegram" && message.channel !== "telegram_business") throw new Error(`${message.channel} sending is not implemented yet`);
    if (message.channel === "telegram_business" && !message.businessConnectionId) throw new Error("Telegram Business connection is missing");
    const replyToMessageId = telegramProviderMessageId(message.replyToExternalId);
    const delivery = message.attachment && file
      ? await sendTelegramAttachment(env, message.externalChatId, file, message.body, message.businessConnectionId, replyToMessageId)
      : { messageId: await sendTelegramMessage(env, message.externalChatId, message.body, message.businessConnectionId, replyToMessageId), attachment: null };
    await store.finishOutbound(message.id, "sent", `telegram:${message.externalChatId}:${delivery.messageId}`, delivery.attachment);
    return { ...message, status: "sent" as const };
  } catch (error) {
    const deliveryError = error instanceof Error ? error.message : "Message delivery failed";
    await store.finishOutbound(message.id, "failed", undefined, undefined, deliveryError);
    throw error;
  } finally {
    await store.releaseDelivery(message.conversationId, message.id);
  }
}

async function processAiReply(store: OpenChatStore, env: OpenChatEnv, conversationId: number) {
  while (true) {
    const job = await store.claimAiJob(conversationId);
    if (!job) return;
    try {
      const settings = await store.getSettings();
      if (!settings.aiEnabled || !env.TELEGRAM_BOT_TOKEN) {
        if (!await store.finishAiJob(job)) return;
        continue;
      }
      const aiEnv = (await resolveAiEnvironment(store, env)).env;
      if (!aiEnv.OPENAI_API_KEY) {
        if (!await store.finishAiJob(job)) return;
        continue;
      }
      const mode = await store.getMode(conversationId);
      if (mode?.mode !== "AI_ACTIVE") {
        if (!await store.finishAiJob(job)) return;
        continue;
      }
      const result = await generateAiReply(aiEnv, settings, await store.recentHistory(conversationId));
      if (result.kind === "escalate") {
        await store.setMode(conversationId, "ESCALATED");
      } else if (result.kind === "reply") {
        const outbound = await store.createOutbound(conversationId, "ai", result.text, { aiJob: job });
        if (outbound) {
          try { await deliver(store, aiEnv, outbound, null, job); }
          catch {
            await store.finishAiJob(job);
            return;
          }
        }
      }
      if (!await store.finishAiJob(job)) return;
    } catch (error) {
      await store.finishAiJob(job, error instanceof Error ? error.message : "AI processing failed");
      return;
    }
  }
}

async function setConversationMode(store: OpenChatStore, conversationId: number, mode: ConversationMode) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await store.setMode(conversationId, mode);
    if (result !== "busy") return result;
    await delay(200);
  }
  return "busy" as const;
}

async function normalizeInboundPayload(store: OpenChatStore, telegramEnv: OpenChatEnv, payload: unknown) {
  const businessConnection = normalizeTelegramBusinessConnection(payload);
  if (businessConnection) {
    await store.saveTelegramBusinessConnection(businessConnection);
    return { businessConnection: true as const, inbound: null };
  }
  const businessConnectionId = telegramBusinessConnectionId(payload);
  if (businessConnectionId) {
    let connection = await store.getTelegramBusinessConnection(businessConnectionId);
    if (!connection) {
      connection = await inspectTelegramBusinessConnection(telegramEnv, businessConnectionId);
      await store.saveTelegramBusinessConnection(connection);
    }
    return { businessConnection: false as const, inbound: normalizeTelegramBusinessMessage(payload, connection.accountUserId) };
  }
  return { businessConnection: false as const, inbound: normalizeTelegramUpdate(payload) };
}

async function handleTelegramWebhook(request: Request, env: OpenChatEnv, ctx: WorkerContext) {
  const store = new OpenChatStore(env.DB);
  let telegramEnv: OpenChatEnv;
  try { telegramEnv = (await resolveTelegramEnvironment(store, env)).env; }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Telegram credentials are unavailable." }, 503); }
  if (!telegramEnv.TELEGRAM_WEBHOOK_SECRET || !telegramEnv.TELEGRAM_BOT_TOKEN) return json({ error: "Telegram is not configured." }, 503);
  if (request.headers.get("x-telegram-bot-api-secret-token") !== telegramEnv.TELEGRAM_WEBHOOK_SECRET) return json({ error: "Unauthorized webhook." }, 401);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return json({ error: "Webhook payload is too large." }, 413);
  const payload = await readJson<unknown>(request);
  if (!payload) return json({ error: "Expected a JSON update." }, 400);
  let normalized: Awaited<ReturnType<typeof normalizeInboundPayload>>;
  try { normalized = await normalizeInboundPayload(store, telegramEnv, payload); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Could not inspect Telegram Business connection." }, 502); }
  if (normalized.businessConnection) return json({ ok: true, businessConnection: true });
  const inbound = normalized.inbound;
  if (!inbound) return json({ ok: true, ignored: true });
  let result: Awaited<ReturnType<OpenChatStore["recordTelegramInbound"]>>;
  try { result = await store.recordTelegramInbound(inbound); }
  catch { return json({ error: "The update was saved but could not be processed. Telegram should retry it." }, 503, { "retry-after": "1" }); }
  if (result.status === "processing") return json({ error: "This update is already being processed." }, 503, { "retry-after": "1" });
  if (result.eventId && result.conversationId) ctx.waitUntil(processAiReply(store, telegramEnv, result.conversationId).catch(() => undefined));
  return json({ ok: true, duplicate: !result.inserted });
}

async function telegramBusinessStatus(store: OpenChatStore) {
  const connection = await store.getLatestTelegramBusinessConnection();
  if (!connection) return null;
  return {
    connected: connection.enabled,
    enabled: connection.enabled,
    canReply: connection.canReply,
    displayName: connection.displayName,
    username: connection.username,
  };
}

async function runtimeStatus(store: OpenChatStore, env: OpenChatEnv) {
  let telegramConfigured = false;
  let ai = { configured: false, provider: "none", model: "" };
  try { telegramConfigured = (await resolveTelegramEnvironment(store, env)).configured; }
  catch { telegramConfigured = false; }
  try {
    const current = await resolveAiEnvironment(store, env);
    ai = { configured: current.configured, provider: current.provider, model: current.model };
  } catch { /* Report the integration as unavailable until it is reconnected. */ }
  const operations = await store.listOperations();
  return {
    database: Boolean(env.DB),
    telegram: { configured: telegramConfigured },
    ai,
    operations: operations.counts,
  };
}

export async function handleOpenChatRequest(request: Request, env: OpenChatEnv, ctx: WorkerContext): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname === "/webhooks/telegram" && request.method === "POST") return handleTelegramWebhook(request, env, ctx);
  if (!pathname.startsWith("/api/")) return null;
  if (!acceptsMutation(request)) return json({ error: "Cross-origin request rejected." }, 403);

  if (pathname === "/api/auth/login" && request.method === "POST") {
    const store = new OpenChatStore(env.DB);
    const rateKey = await loginRateKey(request);
    const blockedFor = await store.getLoginBlock(rateKey);
    if (blockedFor > 0) return json({ error: "Too many login attempts. Try again later." }, 429, { "retry-after": String(Math.ceil(blockedFor / 1000)) });
    const body = await readJson<{ password?: string }>(request);
    const response = await createSession(request, env, body?.password ?? "");
    if (response.status === 200) await store.clearLoginFailures(rateKey);
    else if (response.status === 401) {
      const newlyBlockedFor = await store.recordLoginFailure(rateKey);
      if (newlyBlockedFor > 0) return json({ error: "Too many login attempts. Try again later." }, 429, { "retry-after": String(Math.ceil(newlyBlockedFor / 1000)) });
    }
    return response;
  }
  if (pathname === "/api/auth/logout" && request.method === "POST") return clearSession(request);
  const authenticated = await isAuthenticated(request, env);
  if (pathname === "/api/auth/me" && request.method === "GET") return json({ authenticated, configured: authenticationReady(env) || env.OPENCHAT_TRUST_PLATFORM_AUTH === "true" }, authenticated ? 200 : 401);
  if (!authenticated) return json({ error: "Authentication required." }, 401);

  const store = new OpenChatStore(env.DB);
  if (pathname === "/api/health" && request.method === "GET") {
    await store.ready();
    return json({ ok: true, ...await runtimeStatus(store, env) });
  }
  if (pathname === "/api/conversations" && request.method === "GET") return json({ conversations: await store.listConversations() });

  const attachmentMatch = pathname.match(/^\/api\/messages\/(\d+)\/attachment$/);
  if (attachmentMatch && request.method === "GET") {
    const messageId = parseId(attachmentMatch[1]);
    if (!messageId) return json({ error: "Invalid message id." }, 400);
    const attachment = await store.getMessageAttachment(messageId);
    if (!attachment?.fileId) return json({ error: "Attachment not found." }, 404);
    try {
      const upstream = await downloadTelegramFile((await resolveTelegramEnvironment(store, env)).env, attachment.fileId);
      const headers = new Headers();
      headers.set("content-type", upstream.headers.get("content-type") ?? attachment.mimeType ?? "application/octet-stream");
      headers.set("cache-control", "private, max-age=300");
      const safeName = (attachment.fileName ?? `${attachment.type}-${messageId}`).replace(/[^a-zA-Z0-9._-]/g, "_");
      headers.set("content-disposition", `${attachment.type === "photo" ? "inline" : "attachment"}; filename="${safeName}"`);
      return new Response(upstream.body, { status: 200, headers });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Could not download the Telegram attachment." }, 502);
    }
  }

  const messageMatch = pathname.match(/^\/api\/conversations\/(\d+)\/messages$/);
  if (messageMatch) {
    const id = parseId(messageMatch[1]);
    if (!id) return json({ error: "Invalid conversation id." }, 400);
    if (request.method === "GET") {
      await store.markRead(id);
      return json({ messages: await store.listMessages(id) });
    }
    if (request.method === "POST") {
      const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
      let text = "";
      let replyToMessageId: number | undefined;
      let file: File | null = null;
      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        text = typeof form.get("text") === "string" ? String(form.get("text")).trim() : "";
        const replyValue = Number(form.get("replyToMessageId"));
        replyToMessageId = Number.isInteger(replyValue) && replyValue > 0 ? replyValue : undefined;
        const candidate = form.get("file");
        file = candidate instanceof File && candidate.size > 0 ? candidate : null;
      } else {
        const body = await readJson<{ text?: string; replyToMessageId?: number }>(request);
        text = body?.text?.trim() ?? "";
        replyToMessageId = Number.isInteger(body?.replyToMessageId) && Number(body?.replyToMessageId) > 0 ? Number(body?.replyToMessageId) : undefined;
      }
      if (!text && !file) return json({ error: "Write a message or attach a file." }, 400);
      if (text.length > (file ? 1024 : 4096)) return json({ error: file ? "Attachment captions must be 1024 characters or fewer." : "Messages must be 4096 characters or fewer." }, 400);
      const isPhoto = file ? /^image\/(jpeg|png|webp)$/i.test(file.type) : false;
      if (file && isPhoto && file.size > 10 * 1024 * 1024) return json({ error: "Photos must be 10 MB or smaller." }, 400);
      if (file && !isPhoto && file.size > 50 * 1024 * 1024) return json({ error: "Files must be 50 MB or smaller." }, 400);
      const attachment: MessageAttachment | undefined = file ? {
        type: isPhoto ? "photo" : "document",
        fileName: file.name,
        mimeType: file.type || undefined,
        fileSize: file.size,
      } : undefined;
      const messageText = text || (attachment?.type === "photo" ? "Photo" : file?.name || "Document");
      const takeover = await setConversationMode(store, id, "HUMAN_ACTIVE");
      if (takeover === "missing") return json({ error: "Conversation not found." }, 404);
      if (takeover === "busy") return json({ error: "An AI reply is finishing. Try sending again in a moment." }, 409);
      const outbound = await store.createOutbound(id, "human", messageText, { attachment, replyToMessageId });
      if (!outbound) return json({ error: "Conversation is busy. Try sending again in a moment." }, 409);
      try {
        await deliver(store, (await resolveTelegramEnvironment(store, env)).env, outbound, file);
        return json({ messages: await store.listMessages(id) }, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Message delivery failed.", messages: await store.listMessages(id) }, 502);
      }
    }
  }

  const modeMatch = pathname.match(/^\/api\/conversations\/(\d+)\/mode$/);
  if (modeMatch && request.method === "PATCH") {
    const id = parseId(modeMatch[1]);
    const body = await readJson<{ mode?: ConversationMode }>(request);
    if (!id || !body?.mode || !["AI_ACTIVE", "ESCALATED", "HUMAN_ACTIVE"].includes(body.mode)) return json({ error: "Invalid conversation mode." }, 400);
    const changed = await setConversationMode(store, id, body.mode);
    if (changed === "missing") return json({ error: "Conversation not found." }, 404);
    if (changed === "busy") return json({ error: "An AI reply is finishing. Try takeover again in a moment." }, 409);
    return json({ mode: body.mode });
  }

  if (pathname === "/api/settings") {
    if (request.method === "GET") return json({ settings: await store.getSettings(), runtime: await runtimeStatus(store, env) });
    if (request.method === "PATCH") {
      const body = await readJson<Partial<InstanceSettings>>(request);
      if (!body) return json({ error: "Expected settings JSON." }, 400);
      return json({ settings: await store.updateSettings(body), runtime: await runtimeStatus(store, env) });
    }
  }

  if (pathname === "/api/operations" && request.method === "GET") return json({ operations: await store.listOperations() });

  const eventRetryMatch = pathname.match(/^\/api\/operations\/events\/(\d+)\/retry$/);
  if (eventRetryMatch && request.method === "POST") {
    const eventId = parseId(eventRetryMatch[1]);
    if (!eventId) return json({ error: "Invalid event id." }, 400);
    const event = await store.getChannelEventForRetry(eventId);
    if (!event) return json({ error: "Failed event not found or already recovered." }, 404);
    let payload: unknown;
    try { payload = JSON.parse(event.payload); }
    catch { return json({ error: "The stored event payload is invalid and cannot be retried." }, 409); }
    try {
      const telegramEnv = (await resolveTelegramEnvironment(store, env)).env;
      const normalized = await normalizeInboundPayload(store, telegramEnv, payload);
      if (!normalized.inbound) return json({ error: "The stored event no longer contains a supported Telegram message." }, 409);
      const result = await store.recordTelegramInbound(normalized.inbound);
      if (result.eventId && result.conversationId) ctx.waitUntil(processAiReply(store, telegramEnv, result.conversationId).catch(() => undefined));
      return json({ recovered: result.status === "processed", operations: await store.listOperations() });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Event retry failed.", operations: await store.listOperations() }, 502);
    }
  }

  const aiRetryMatch = pathname.match(/^\/api\/operations\/ai\/(\d+)\/retry$/);
  if (aiRetryMatch && request.method === "POST") {
    const conversationId = parseId(aiRetryMatch[1]);
    if (!conversationId) return json({ error: "Invalid conversation id." }, 400);
    if (!await store.retryAiJob(conversationId)) return json({ error: "Failed AI job not found or already recovered." }, 404);
    let telegramEnv: OpenChatEnv;
    try { telegramEnv = (await resolveTelegramEnvironment(store, env)).env; }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Telegram credentials are unavailable." }, 503); }
    ctx.waitUntil(processAiReply(store, telegramEnv, conversationId).catch(() => undefined));
    return json({ retried: true, operations: await store.listOperations() });
  }

  if (pathname === "/api/assistant/test" && request.method === "POST") {
    const body = await readJson<{
      settings?: Partial<InstanceSettings>;
      history?: { author?: string; text?: string }[];
    }>(request);
    if (!body?.settings || !Array.isArray(body.history)) return json({ error: "Expected assistant settings and test history." }, 400);
    if (body.history.length < 1 || body.history.length > 30) return json({ error: "A test session must contain between 1 and 30 messages." }, 400);
    const history = body.history.map((message) => ({ author: message.author, text: message.text?.trim() }))
      .filter((message): message is { author: "customer" | "ai"; text: string } => (message.author === "customer" || message.author === "ai") && Boolean(message.text) && message.text!.length <= 4096);
    if (history.length !== body.history.length) return json({ error: "The test history contains an invalid message." }, 400);
    const current = await store.getSettings();
    const draft: InstanceSettings = {
      aiEnabled: true,
      systemPrompt: typeof body.settings.systemPrompt === "string" ? body.settings.systemPrompt.slice(0, 8000) : current.systemPrompt,
      businessContext: typeof body.settings.businessContext === "string" ? body.settings.businessContext.slice(0, 50000) : current.businessContext,
      defaultLanguage: typeof body.settings.defaultLanguage === "string" ? body.settings.defaultLanguage.slice(0, 200) : current.defaultLanguage,
    };
    try {
      const ai = await resolveAiEnvironment(store, env);
      if (!ai.configured || !ai.env.OPENAI_API_KEY) return json({ error: "Connect an AI provider before testing the assistant." }, 409);
      const result = await generateAiReply(ai.env, draft, history);
      if (result.kind === "reply") return json({ reply: result.text, escalated: false });
      if (result.kind === "escalate") return json({ reply: "", escalated: true });
      return json({ error: "The assistant is not configured." }, 409);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Assistant test failed." }, 502);
    }
  }

  if (pathname === "/api/assistant/improve" && request.method === "POST") {
    const body = await readJson<{
      draft?: string;
      history?: { author?: string; text?: string }[];
    }>(request);
    const draft = body?.draft?.trim() ?? "";
    if (!draft) return json({ error: "Write a draft before improving it." }, 400);
    if (draft.length > 4096) return json({ error: "Drafts must be 4096 characters or fewer." }, 400);
    if (body?.history !== undefined && !Array.isArray(body.history)) return json({ error: "Expected conversation history." }, 400);
    if ((body?.history?.length ?? 0) > 20) return json({ error: "Conversation context is limited to 20 messages." }, 400);
    const history = (body?.history ?? []).map((message) => ({ author: message.author, text: message.text?.trim() }))
      .filter((message): message is { author: "customer" | "ai" | "human"; text: string } => ["customer", "ai", "human"].includes(message.author ?? "") && Boolean(message.text) && message.text!.length <= 4096);
    if (history.length !== (body?.history?.length ?? 0)) return json({ error: "The conversation context contains an invalid message." }, 400);
    try {
      const ai = await resolveAiEnvironment(store, env);
      if (!ai.configured || !ai.env.OPENAI_API_KEY) return json({ error: "Connect an AI provider before using Improve." }, 409);
      return json({ text: await improveDraft(ai.env, draft, history) });
    } catch (error) {
      if (error instanceof AiTimeoutError) return json({ error: error.message }, 504);
      return json({ error: error instanceof Error ? error.message : "Could not improve the draft." }, 502);
    }
  }

  if (pathname === "/api/setup/telegram") {
    if (request.method === "POST") {
      const body = await readJson<{ botToken?: string; publicUrl?: string }>(request);
      if (!body) return json({ error: "Expected Telegram setup JSON." }, 400);
      try {
        let current: Awaited<ReturnType<typeof resolveTelegramEnvironment>>;
        try { current = await resolveTelegramEnvironment(store, env); }
        catch (error) {
          if (!body.botToken?.trim()) throw error;
          current = { env, configured: false, publicUrl: env.OPENCHAT_PUBLIC_URL ?? "", source: env.TELEGRAM_BOT_TOKEN ? "environment" : "none" };
        }
        const botToken = body.botToken?.trim() || current.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return json({ error: "Paste the bot token from @BotFather." }, 400);
        if (botToken.length > 512) return json({ error: "The Telegram bot token is too long." }, 400);
        const publicUrl = normalizePublicUrl(body.publicUrl?.trim() || current.publicUrl || url.origin);
        const webhookSecret = current.env.TELEGRAM_WEBHOOK_SECRET || generateWebhookSecret();
        const telegramEnv = { ...env, TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_WEBHOOK_SECRET: webhookSecret, OPENCHAT_PUBLIC_URL: publicUrl };
        let bot: Awaited<ReturnType<typeof inspectTelegramBot>>;
        try { bot = await inspectTelegramBot(telegramEnv); }
        catch (error) { return json({ error: telegramErrorMessage(error) }, 400); }
        if (!env.OPENCHAT_SESSION_SECRET) return json({ error: "Credential encryption requires OPENCHAT_SESSION_SECRET." }, 503);
        const [encryptedBotToken, encryptedWebhookSecret] = await Promise.all([
          encryptCredential(botToken, env.OPENCHAT_SESSION_SECRET),
          encryptCredential(webhookSecret, env.OPENCHAT_SESSION_SECRET),
        ]);
        await store.saveTelegramCredentials({ encryptedBotToken, encryptedWebhookSecret, publicUrl });
        try { await configureTelegramWebhook(telegramEnv, publicUrl); }
        catch (error) { return json({ error: telegramErrorMessage(error), saved: true }, 502); }
        return json({ connected: true, configured: true, source: "dashboard", publicUrl, bot, webhook: await inspectTelegramWebhook(telegramEnv), businessConnection: await telegramBusinessStatus(store), runtime: await runtimeStatus(store, env) });
      } catch (error) {
        return json({ error: telegramErrorMessage(error) }, 502);
      }
    }
    if (request.method === "GET") {
      let current: Awaited<ReturnType<typeof resolveTelegramEnvironment>>;
      try {
        current = await resolveTelegramEnvironment(store, env);
      } catch (error) {
        return json({ configured: true, source: "dashboard", publicUrl: env.OPENCHAT_PUBLIC_URL ?? "", error: telegramErrorMessage(error) });
      }
      if (!current.env.TELEGRAM_BOT_TOKEN) return json({ configured: false, source: "none", publicUrl: current.publicUrl });
      try {
        const [bot, webhook] = await Promise.all([inspectTelegramBot(current.env), inspectTelegramWebhook(current.env)]);
        return json({ configured: current.configured, source: current.source, publicUrl: current.publicUrl, bot, webhook, businessConnection: await telegramBusinessStatus(store) });
      } catch (error) { return json({ configured: current.configured, source: current.source, publicUrl: current.publicUrl, businessConnection: await telegramBusinessStatus(store), error: telegramErrorMessage(error) }); }
    }
    if (request.method === "DELETE") {
      try {
        const current = await resolveTelegramEnvironment(store, env);
        if (current.env.TELEGRAM_BOT_TOKEN) await removeTelegramWebhook(current.env);
        await store.clearTelegramCredentials();
        return json({ connected: false, configured: Boolean(env.TELEGRAM_BOT_TOKEN), source: env.TELEGRAM_BOT_TOKEN ? "environment" : "none" });
      } catch (error) { return json({ error: telegramErrorMessage(error) }, 502); }
    }
  }

  if (pathname === "/api/setup/ai/models" && (request.method === "GET" || request.method === "POST")) {
    try {
      const body = request.method === "POST" ? await readJson<{ apiKey?: string }>(request) : null;
      let apiKey = body?.apiKey?.trim();
      if (!apiKey) {
        const current = await resolveAiEnvironment(store, env);
        if (current.provider === "openrouter") apiKey = current.env.OPENAI_API_KEY;
      }
      if (!apiKey) return json({ error: "Enter an OpenRouter API key to load models." }, 400);
      if (apiKey.length > 1024) return json({ error: "The OpenRouter API key is too long." }, 400);
      return json({ models: await listOpenRouterModels(apiKey) });
    } catch (error) { return json({ error: openRouterErrorMessage(error) }, 502); }
  }

  if (pathname === "/api/setup/ai") {
    if (request.method === "POST") {
      const body = await readJson<{ provider?: string; apiKey?: string; model?: string }>(request);
      if (!body) return json({ error: "Expected AI setup JSON." }, 400);
      if (body.provider !== "openrouter") return json({ error: "OpenRouter is the supported dashboard provider in this release." }, 400);
      try {
        let current: Awaited<ReturnType<typeof resolveAiEnvironment>>;
        try { current = await resolveAiEnvironment(store, env); }
        catch (error) {
          if (!body.apiKey?.trim()) throw error;
          current = { env, configured: false, provider: "none", model: "openrouter/auto", source: "none" };
        }
        const apiKey = body.apiKey?.trim() || (current.provider === "openrouter" ? current.env.OPENAI_API_KEY : undefined);
        if (!apiKey) return json({ error: "Paste an OpenRouter API key." }, 400);
        if (apiKey.length > 1024) return json({ error: "The OpenRouter API key is too long." }, 400);
        const requestedModel = body.model?.trim() || (current.provider === "openrouter" ? current.model : "openrouter/auto");
        let key: Awaited<ReturnType<typeof inspectOpenRouterKey>>;
        let model: Awaited<ReturnType<typeof inspectOpenRouterModel>>;
        try { [key, model] = await Promise.all([inspectOpenRouterKey(apiKey), inspectOpenRouterModel(apiKey, requestedModel)]); }
        catch (error) { return json({ error: openRouterErrorMessage(error) }, 400); }
        if (!env.OPENCHAT_SESSION_SECRET) return json({ error: "Credential encryption requires OPENCHAT_SESSION_SECRET." }, 503);
        await store.saveAiCredentials({
          provider: "openrouter",
          encryptedApiKey: await encryptCredential(apiKey, env.OPENCHAT_SESSION_SECRET),
          model: model.id,
        });
        return json({ configured: true, source: "dashboard", provider: "openrouter", model: model.id, modelName: model.name, key, runtime: await runtimeStatus(store, env) });
      } catch (error) { return json({ error: openRouterErrorMessage(error) }, 502); }
    }
    if (request.method === "GET") {
      try {
        const current = await resolveAiEnvironment(store, env);
        if (!current.configured || !current.env.OPENAI_API_KEY) return json({ configured: false, source: "none", provider: "none", model: current.model });
        if (current.provider !== "openrouter") return json({ configured: true, source: current.source, provider: current.provider, model: current.model });
        try {
          const key = await inspectOpenRouterKey(current.env.OPENAI_API_KEY);
          return json({ configured: true, source: current.source, provider: "openrouter", model: current.model, key });
        } catch (error) {
          return json({ configured: true, source: current.source, provider: "openrouter", model: current.model, error: openRouterErrorMessage(error) });
        }
      } catch (error) { return json({ configured: true, source: "dashboard", provider: "openrouter", model: "", error: openRouterErrorMessage(error) }); }
    }
    if (request.method === "DELETE") {
      await store.clearAiCredentials();
      const fallback = await resolveAiEnvironment(store, env);
      return json({ configured: fallback.configured, source: fallback.source, provider: fallback.provider, model: fallback.model, runtime: await runtimeStatus(store, env) });
    }
  }
  return json({ error: "Not found." }, 404);
}
