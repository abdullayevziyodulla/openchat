import { AiTimeoutError, generateAiReply, improveDraft } from "./ai";
import { matchAutomationKeywords, renderAutomationMessage } from "./automations";
import { decryptCredential, encryptCredential, generateWebhookSecret, normalizePublicUrl, openRouterErrorMessage, resolveAiEnvironment, resolveTelegramEnvironment, telegramErrorMessage } from "./credentials";
import { OpenChatStore, type AiJobClaim, type ConversationMode, type InstagramAutomationInput, type InstanceSettings, type MessageAttachment } from "./database";
import { acceptsMutation, authenticationReady, clearSession, createSession, isAuthenticated, json, loginRateKey, readJson } from "./http";
import type { OpenChatEnv, WorkerContext } from "./runtime";
import { inspectOpenRouterKey, inspectOpenRouterModel, listOpenRouterModels } from "./openrouter";
import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  inspectInstagramContact,
  inspectInstagramProfile,
  instagramAuthorizationUrl,
  getInstagramConversation,
  instagramHistoryAttachment,
  InstagramApiError,
  INSTAGRAM_SCOPES,
  listInstagramConversations,
  listInstagramMedia,
  listInstagramMediaComments,
  parseInstagramInboundMessages,
  parseInstagramCommentEvents,
  parseInstagramPostbacks,
  refreshInstagramToken,
  inspectInstagramFollowStatus,
  sendInstagramDirectButton,
  sendInstagramDirectLinks,
  sendInstagramMedia,
  sendInstagramText,
  sendInstagramPrivateReplyButton,
  sendInstagramPrivateReplyLinks,
  sendInstagramPrivateReply,
  sendInstagramCommentReply,
  subscribeInstagramWebhooks,
  unsubscribeInstagramWebhooks,
  verifyInstagramWebhookSignature,
} from "./instagram";
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

type InstagramAutomationBody = {
  instagramAccountId?: number; name?: string; triggerType?: "comment" | "dm"; postId?: string;
  matchAnyPost?: boolean; matchAnyText?: boolean; keywords?: string[]; wholeWordMatch?: boolean;
  privateReplyMessage?: string; publicReplyEnabled?: boolean; publicReplyMessage?: string;
  openingDmEnabled?: boolean; openingDmMessage?: string; openingDmButtonLabel?: string; linkButtonLabel?: string;
  requireFollow?: boolean; followPromptMessage?: string; followPromptButtonLabel?: string;
  followUpEnabled?: boolean; followUpMessage?: string; followUpDelayMinutes?: number;
  pendingNextReel?: boolean; trackedLinks?: Array<{ label?: string; destinationUrl?: string }>;
  active?: boolean;
};

async function normalizeInstagramAutomation(body: InstagramAutomationBody | null, store: OpenChatStore): Promise<{ input: InstagramAutomationInput } | { error: string }> {
  const accountId = Number(body?.instagramAccountId);
  const name = body?.name?.trim() ?? "";
  const privateReplyMessage = body?.privateReplyMessage?.trim() ?? "";
  const triggerType = body?.triggerType === "dm" ? "dm" : "comment";
  const keywords = Array.isArray(body?.keywords) ? body.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 20) : [];
  const trackedLinks = Array.isArray(body?.trackedLinks)
    ? body.trackedLinks.slice(0, 3).map((link) => ({ label: String(link.label ?? "").trim(), destinationUrl: String(link.destinationUrl ?? "").trim() })).filter((link) => link.destinationUrl)
    : [];
  if (!Number.isInteger(accountId) || !await store.getInstagramAccount(accountId)) return { error: "Choose a connected Instagram account." };
  if (!name || name.length > 100) return { error: "Automation names must be between 1 and 100 characters." };
  if (!privateReplyMessage || privateReplyMessage.length > 1000) return { error: "Private replies must be between 1 and 1000 characters." };
  if (!body?.matchAnyText && !keywords.length) return { error: "Add at least one keyword or match any text." };
  if (triggerType === "comment" && !body?.matchAnyPost && !body?.postId?.trim() && !body?.pendingNextReel) return { error: "Choose a post ID, the next Reel, or match comments on any post." };
  if (body?.publicReplyEnabled && !body.publicReplyMessage?.trim()) return { error: "Write the public reply or turn it off." };
  if (body?.openingDmEnabled && (!body.openingDmMessage?.trim() || !body.openingDmButtonLabel?.trim())) return { error: "Opening DMs need a message and button label." };
  if (body?.requireFollow && (!body.followPromptMessage?.trim() || !body.followPromptButtonLabel?.trim())) return { error: "Follow gates need a prompt and button label." };
  if (body?.followUpEnabled && !body.followUpMessage?.trim()) return { error: "Write a follow-up message or turn it off." };
  if ((body?.openingDmMessage?.length ?? 0) > 640 || (body?.followPromptMessage?.length ?? 0) > 640) return { error: "Instagram button-template messages must be 640 characters or fewer." };
  if ([body?.openingDmButtonLabel, body?.followPromptButtonLabel, body?.linkButtonLabel].some((label) => (label?.trim().length ?? 0) > 20)) return { error: "Instagram button labels must be 20 characters or fewer." };
  if ((body?.followUpMessage?.length ?? 0) > 1000 || (body?.publicReplyMessage?.length ?? 0) > 1000) return { error: "Automation replies must be 1000 characters or fewer." };
  if (!Number.isInteger(body?.followUpDelayMinutes ?? 0) || (body?.followUpDelayMinutes ?? 0) < 0 || (body?.followUpDelayMinutes ?? 0) > 1440) return { error: "Follow-up delay must be between 0 and 1440 minutes." };
  for (const link of trackedLinks) {
    let destination: URL;
    try { destination = new URL(link.destinationUrl); } catch { return { error: "Tracked links must be valid HTTPS URLs." }; }
    if (destination.protocol !== "https:" || !link.label || link.label.length > 20) return { error: "Each tracked link needs an HTTPS destination and a label up to 20 characters." };
  }
  return { input: {
    instagramAccountId: accountId, name, triggerType,
    postId: triggerType === "comment" ? body?.postId : null,
    matchAnyPost: triggerType === "comment" && Boolean(body?.matchAnyPost),
    matchAnyText: Boolean(body?.matchAnyText), keywords, wholeWordMatch: body?.wholeWordMatch !== false,
    privateReplyMessage,
    openingDmEnabled: triggerType === "comment" && Boolean(body?.openingDmEnabled),
    openingDmMessage: body?.openingDmMessage, openingDmButtonLabel: body?.openingDmButtonLabel,
    linkButtonLabel: body?.linkButtonLabel, requireFollow: Boolean(body?.requireFollow),
    followPromptMessage: body?.followPromptMessage, followPromptButtonLabel: body?.followPromptButtonLabel,
    followUpEnabled: Boolean(body?.followUpEnabled), followUpMessage: body?.followUpMessage,
    followUpDelayMinutes: body?.followUpDelayMinutes,
    pendingNextReel: triggerType === "comment" && Boolean(body?.pendingNextReel), trackedLinks,
    publicReplyEnabled: triggerType === "comment" && Boolean(body?.publicReplyEnabled),
    publicReplyMessage: body?.publicReplyMessage, active: body?.active,
  } };
}

async function signedInstagramMediaUrl(env: OpenChatEnv, messageId: number) {
  if (!env.OPENCHAT_PUBLIC_URL || !env.OPENCHAT_SESSION_SECRET) throw new Error("Instagram media sending requires OPENCHAT_PUBLIC_URL and OPENCHAT_SESSION_SECRET.");
  const expires = Date.now() + 10 * 60_000;
  const payload = `${messageId}:${expires}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.OPENCHAT_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const signature = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const url = new URL(`/media/instagram-outbound/${messageId}`, env.OPENCHAT_PUBLIC_URL);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature);
  return url.toString();
}

async function verifyInstagramMediaUrl(env: OpenChatEnv, messageId: number, expires: string | null, signature: string | null) {
  const timestamp = Number(expires);
  if (!env.OPENCHAT_SESSION_SECRET || !signature || !Number.isFinite(timestamp) || timestamp < Date.now() || timestamp > Date.now() + 15 * 60_000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.OPENCHAT_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${messageId}:${timestamp}`)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < signature.length; index += 1) difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
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
    if (message.channel === "instagram") {
      if (!message.instagramAccountId || !message.instagramRecipientIgsid) throw new Error("Instagram conversation context is missing.");
      const account = await store.getInstagramAccount(message.instagramAccountId);
      if (!account) throw new Error("The connected Instagram account is unavailable. Reconnect it in Settings.");
      if (!env.OPENCHAT_SESSION_SECRET) throw new Error("Instagram credentials cannot be opened because OPENCHAT_SESSION_SECRET is missing.");
      const now = Date.now();
      let humanAgent = false;
      if (now > (message.instagramMessagingWindowUntil ?? 0)) {
        const humanDeadline = (message.instagramLastInboundAt ?? 0) + 7 * 24 * 60 * 60_000;
        humanAgent = message.author === "human" && env.INSTAGRAM_HUMAN_AGENT_ENABLED === "true" && now <= humanDeadline;
        if (!humanAgent) throw new Error(message.author === "ai"
          ? "Instagram's 24-hour automated messaging window has closed. A human must take over."
          : "Instagram's standard messaging window has closed. Enable approved HUMAN_AGENT support or wait for the customer to reply.");
      }
      const accessToken = await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET);
      if (file && message.attachment) {
        if (!env.MEDIA) throw new Error("Instagram media sending requires the MEDIA R2 bucket binding.");
        const objectKey = `instagram-outbound/${message.id}`;
        await env.MEDIA.put(objectKey, file.stream(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
          customMetadata: { fileName: file.name.slice(0, 255) },
        });
        const attachmentType = message.attachment.type === "photo" ? "image"
          : message.attachment.type === "video" ? "video"
            : message.attachment.type === "audio" || message.attachment.type === "voice" ? "audio" : "file";
        const media = await sendInstagramMedia(env, accessToken, account.instagramUserId, message.instagramRecipientIgsid, attachmentType, await signedInstagramMediaUrl(env, message.id), humanAgent);
        const defaultBody = message.attachment.type === "photo" ? "Photo" : message.attachment.fileName || "Document";
        let externalId = media.message_id;
        if (message.body && message.body !== defaultBody) {
          const caption = await sendInstagramText(env, accessToken, account.instagramUserId, message.instagramRecipientIgsid, message.body, humanAgent);
          externalId = `${media.message_id},${caption.message_id}`;
        }
        await store.finishOutbound(message.id, "sent", externalId, { ...message.attachment, fileId: objectKey });
      } else {
        const result = await sendInstagramText(env, accessToken, account.instagramUserId, message.instagramRecipientIgsid, message.body, humanAgent);
        await store.finishOutbound(message.id, "sent", result.message_id);
      }
    } else {
      if (message.channel !== "telegram" && message.channel !== "telegram_business") throw new Error(`${message.channel} sending is not implemented yet`);
      if (message.channel === "telegram_business" && !message.businessConnectionId) throw new Error("Telegram Business connection is missing");
      const telegramEnv = (await resolveTelegramEnvironment(store, env)).env;
      const replyToMessageId = telegramProviderMessageId(message.replyToExternalId);
      const delivery = message.attachment && file
        ? await sendTelegramAttachment(telegramEnv, message.externalChatId, file, message.body, message.businessConnectionId, replyToMessageId)
        : { messageId: await sendTelegramMessage(telegramEnv, message.externalChatId, message.body, message.businessConnectionId, replyToMessageId), attachment: null };
      await store.finishOutbound(message.id, "sent", `telegram:${message.externalChatId}:${delivery.messageId}`, delivery.attachment);
    }
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
      if (!settings.aiEnabled) {
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

function safeRemoteAttachmentUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
  if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1" || privateIpv4) {
    throw new Error("The provider returned an unsafe attachment URL.");
  }
  return url;
}

function publicOrigin(request: Request, env: OpenChatEnv) {
  try { return new URL(env.OPENCHAT_PUBLIC_URL?.trim() || request.url).origin; }
  catch { return new URL(request.url).origin; }
}

async function anonymousIpHash(request: Request, env: OpenChatEnv) {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  if (!ip || !env.OPENCHAT_SESSION_SECRET) return undefined;
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.OPENCHAT_SESSION_SECRET}:${day}:${ip}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function handleTrackedInstagramLink(request: Request, env: OpenChatEnv, ctx: WorkerContext, slug: string) {
  if (!/^[a-z0-9_-]{6,64}$/i.test(slug)) return new Response("Link not found", { status: 404 });
  const store = new OpenChatStore(env.DB);
  const link = await store.getInstagramTrackedLink(slug);
  if (!link) return new Response("Link not found", { status: 404, headers: { "cache-control": "no-store" } });
  ctx.waitUntil(store.recordInstagramLinkClick(link, {
    ipHash: await anonymousIpHash(request, env),
    userAgent: request.headers.get("user-agent") ?? undefined,
    referrer: request.headers.get("referer") ?? undefined,
  }));
  return new Response(null, {
    status: 302,
    headers: { location: link.destinationUrl, "cache-control": "no-store, private", "referrer-policy": "no-referrer" },
  });
}

async function handleInstagramOutboundMedia(request: Request, env: OpenChatEnv, messageId: number) {
  const url = new URL(request.url);
  if (!env.MEDIA || !await verifyInstagramMediaUrl(env, messageId, url.searchParams.get("expires"), url.searchParams.get("signature"))) {
    return new Response("Media link expired", { status: 403, headers: { "cache-control": "no-store" } });
  }
  const object = await env.MEDIA.get(`instagram-outbound/${messageId}`);
  if (!object) return new Response("Media not found", { status: 404, headers: { "cache-control": "no-store" } });
  const headers = new Headers({ "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" });
  const fileName = object.customMetadata?.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (fileName) headers.set("content-disposition", `inline; filename="${fileName}"`);
  return new Response(object.body, { headers });
}

async function handleInstagramWebhook(request: Request, env: OpenChatEnv, ctx: WorkerContext) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const valid = url.searchParams.get("hub.mode") === "subscribe"
      && Boolean(env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN)
      && url.searchParams.get("hub.verify_token") === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    const challenge = url.searchParams.get("hub.challenge");
    return valid && challenge !== null
      ? new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } })
      : json({ error: "Instagram webhook verification failed." }, 403);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return json({ error: "Webhook payload is too large." }, 413);
  const rawBody = await request.text();
  let signatureValid = false;
  try { signatureValid = await verifyInstagramWebhookSignature(env, rawBody, request.headers.get("x-hub-signature-256")); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Instagram webhook verification is unavailable." }, 503); }
  if (!signatureValid) return json({ error: "Invalid Instagram webhook signature." }, 401);
  let payload: unknown;
  try { payload = JSON.parse(rawBody); }
  catch { return json({ error: "Expected a JSON webhook payload." }, 400); }
  const events = parseInstagramInboundMessages(payload);
  const commentEvents = parseInstagramCommentEvents(payload);
  const postbacks = parseInstagramPostbacks(payload);
  if (!events.length && !commentEvents.length && !postbacks.length) return json({ ok: true, ignored: true });
  const store = new OpenChatStore(env.DB);
  const aiConversations = new Set<number>();
  const conversationByMessage = new Map<string, number>();
  let automationEnqueued = false;
  try {
    if (commentEvents.length) automationEnqueued = await enqueueInstagramCommentAutomations(store, payload);
    for (const postback of postbacks) {
      const match = /^openchat:(?:reveal|follow):(\d+)$/.exec(postback.payload);
      const runId = match ? parseId(match[1]) : null;
      if (runId && await store.triggerInstagramAutomationPostback(runId, postback.senderIgsid, postback.timestamp)) automationEnqueued = true;
    }
    for (const event of events) {
      const account = await store.getInstagramAccountByUserId(event.instagramUserId);
      if (!account) continue;
      if (event.isEcho) {
        await store.syncInstagramConversation({
          instagramAccountId: account.id,
          instagramUserId: account.instagramUserId,
          recipientIgsid: event.senderIgsid,
          messages: [{ externalMessageId: event.messageId, author: "human", text: event.text, attachment: event.attachment, timestamp: event.timestamp }],
        });
        continue;
      }
      const result = await store.recordInbound({
        channel: "instagram",
        eventId: event.messageId,
        externalMessageId: event.messageId,
        externalConversationId: `${account.instagramUserId}:${event.senderIgsid}`,
        externalContactId: `${account.instagramUserId}:${event.senderIgsid}`,
        displayName: `Instagram user ${event.senderIgsid.slice(-6)}`,
        text: event.text,
        attachment: event.attachment,
        replyToExternalMessageId: event.replyToMessageId,
        timestamp: event.timestamp,
        payload: rawBody,
        instagramAccountId: account.id,
        instagramRecipientIgsid: event.senderIgsid,
        messagingWindowUntil: event.timestamp + 24 * 60 * 60_000,
      });
      if (env.OPENCHAT_SESSION_SECRET) ctx.waitUntil((async () => {
        try {
          const accessToken = await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET!);
          const contact = await inspectInstagramContact(env, accessToken, event.senderIgsid);
          const name = contact.name?.trim() || contact.username?.trim();
          if (name) await store.updateContactProfile("instagram", `${account.instagramUserId}:${event.senderIgsid}`, name, contact.username);
        } catch { /* Contact enrichment is best-effort and must not reject a valid webhook. */ }
      })());
      if (result.eventId && result.conversationId) {
        aiConversations.add(result.conversationId);
        conversationByMessage.set(event.messageId, result.conversationId);
      }
    }
    if (events.length) {
      const dmAutomations = await enqueueInstagramDmAutomations(store, events);
      automationEnqueued = dmAutomations.enqueued || automationEnqueued;
      for (const messageId of dmAutomations.matchedMessageIds) {
        const conversationId = conversationByMessage.get(messageId);
        if (conversationId) {
          aiConversations.delete(conversationId);
          await store.discardPendingAiJob(conversationId);
        }
      }
    }
  } catch {
    return json({ error: "The Instagram update was saved but could not be processed. Meta should retry it." }, 503, { "retry-after": "1" });
  }
  for (const conversationId of aiConversations) ctx.waitUntil(processAiReply(store, env, conversationId).catch(() => undefined));
  if (automationEnqueued) ctx.waitUntil(processInstagramAutomationRuns(env));
  return json({ ok: true, received: events.length, comments: commentEvents.length, postbacks: postbacks.length });
}

async function handleInstagramCallback(request: Request, env: OpenChatEnv, ctx: WorkerContext) {
  const url = new URL(request.url);
  const dashboard = new URL("/dashboard", publicOrigin(request, env));
  const state = url.searchParams.get("state") ?? "";
  const store = new OpenChatStore(env.DB);
  if (!state || !await store.consumeOauthState("instagram", state)) {
    dashboard.searchParams.set("instagram", "invalid_state");
    return Response.redirect(dashboard, 302);
  }
  if (url.searchParams.get("error")) {
    dashboard.searchParams.set("instagram", "denied");
    return Response.redirect(dashboard, 302);
  }
  const code = url.searchParams.get("code");
  if (!code || !env.OPENCHAT_SESSION_SECRET) {
    dashboard.searchParams.set("instagram", "configuration_error");
    return Response.redirect(dashboard, 302);
  }
  try {
    const redirectUri = `${publicOrigin(request, env)}/api/instagram/callback`;
    const shortLived = await exchangeInstagramCode(env, code, redirectUri);
    const longLived = await exchangeInstagramLongLivedToken(env, shortLived.accessToken);
    const profile = await inspectInstagramProfile(env, longLived.accessToken);
    const instagramUserId = profile.user_id ?? profile.id;
    let webhookSubscribed = false;
    let lastError: string | null = null;
    try { webhookSubscribed = Boolean((await subscribeInstagramWebhooks(env, instagramUserId, longLived.accessToken)).success); }
    catch (error) { lastError = error instanceof Error ? error.message : "Webhook subscription failed"; }
    const saved = await store.saveInstagramAccount({
      instagramUserId,
      appScopedUserId: profile.id || shortLived.appScopedUserId,
      username: profile.username,
      displayName: profile.name ?? null,
      profilePictureUrl: profile.profile_picture_url ?? null,
      encryptedAccessToken: await encryptCredential(longLived.accessToken, env.OPENCHAT_SESSION_SECRET),
      tokenExpiresAt: Date.now() + longLived.expiresIn * 1000,
      scopes: [...INSTAGRAM_SCOPES],
      webhookSubscribed,
      lastError,
    });
    ctx.waitUntil(syncInstagramAccount(store, env, saved.id).catch(() => undefined));
    dashboard.searchParams.set("instagram", webhookSubscribed ? "connected" : "connected_attention");
  } catch (error) {
    dashboard.searchParams.set("instagram", "failed");
    dashboard.searchParams.set("reason", (error instanceof Error ? error.message : "Instagram connection failed").slice(0, 200));
  }
  return Response.redirect(dashboard, 302);
}

async function syncInstagramAccount(store: OpenChatStore, env: OpenChatEnv, accountId: number) {
  const account = await store.getInstagramAccount(accountId);
  if (!account) throw new Error("Instagram account not found.");
  if (!env.OPENCHAT_SESSION_SECRET) throw new Error("Instagram credentials cannot be opened because OPENCHAT_SESSION_SECRET is missing.");
  const accessToken = await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET);
  try {
    const conversations = await listInstagramConversations(env, accessToken, account.instagramUserId);
    for (const summary of conversations) {
      const conversation = await getInstagramConversation(env, accessToken, summary.id);
      const participant = conversation.participants?.data?.find((candidate) => candidate.id !== account.instagramUserId);
      const rawMessages = conversation.messages?.data ?? [];
      const inferredRecipient = participant?.id
        ?? rawMessages.flatMap((message) => [message.from, ...(message.to?.data ?? [])]).find((candidate) => candidate?.id && candidate.id !== account.instagramUserId)?.id;
      if (!inferredRecipient) continue;
      const messages = rawMessages.flatMap((message) => {
        const attachment = instagramHistoryAttachment(message);
        const text = message.message?.trim() || (attachment ? attachment.type === "photo" ? "Photo" : attachment.type === "video" ? "Video" : "Attachment" : "");
        const timestamp = message.created_time ? Date.parse(message.created_time) : Number.NaN;
        if (!message.id || !text || !Number.isFinite(timestamp)) return [];
        return [{
          externalMessageId: message.id,
          author: message.from?.id === account.instagramUserId ? "human" as const : "customer" as const,
          text,
          attachment,
          timestamp,
        }];
      });
      if (!messages.length) continue;
      await store.syncInstagramConversation({
        instagramAccountId: account.id,
        instagramUserId: account.instagramUserId,
        recipientIgsid: inferredRecipient,
        threadId: conversation.id,
        displayName: participant?.name || participant?.username,
        username: participant?.username,
        messages,
      });
    }
    await store.updateInstagramAccountHealth(account.id, account.webhookSubscribed, null);
  } catch (error) {
    await store.setInstagramAccountError(account.id, error instanceof Error ? `Conversation sync failed: ${error.message}` : "Conversation sync failed");
    throw error;
  }
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
  const instagramAccounts = await store.listInstagramAccounts();
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
    instagram: {
      appConfigured: Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET && env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
      connected: instagramAccounts.length,
      healthy: instagramAccounts.filter((account) => account.webhookSubscribed && !account.lastError).length,
    },
    ai,
    operations: operations.counts,
  };
}

async function refreshInstagramAccount(store: OpenChatStore, env: OpenChatEnv, accountId: number) {
  const account = await store.getInstagramAccount(accountId);
  if (!account) throw new Error("Instagram account not found.");
  if (!env.OPENCHAT_SESSION_SECRET) throw new Error("Instagram credentials cannot be opened because OPENCHAT_SESSION_SECRET is missing.");
  try {
    const accessToken = await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET);
    const refreshed = await refreshInstagramToken(env, accessToken);
    await store.updateInstagramToken(
      account.id,
      await encryptCredential(refreshed.accessToken, env.OPENCHAT_SESSION_SECRET),
      Date.now() + refreshed.expiresIn * 1000,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram token refresh failed";
    await store.setInstagramAccountError(account.id, message);
    throw error;
  }
}

export async function refreshDueInstagramTokens(env: OpenChatEnv) {
  const store = new OpenChatStore(env.DB);
  const refreshBefore = Date.now() + 7 * 24 * 60 * 60_000;
  const accounts = await store.listInstagramAccounts();
  for (const account of accounts) {
    if (account.tokenExpiresAt && account.tokenExpiresAt <= refreshBefore) {
      try { await refreshInstagramAccount(store, env, account.id); }
      catch { /* The account error is persisted for the operator. */ }
    }
  }
}

async function enqueueInstagramCommentAutomations(store: OpenChatStore, payload: unknown) {
  let enqueued = false;
  for (const event of parseInstagramCommentEvents(payload)) {
    const account = await store.getInstagramAccountByUserId(event.instagramUserId);
    if (!account || !await store.markInstagramCommentSeen(account.id, event.commentId, "webhook")) continue;
    const automations = (await store.listInstagramAutomations(account.id)).filter((automation) => automation.active && automation.triggerType === "comment");
    for (const automation of automations) {
      if (!automation.matchAnyPost && automation.postId !== event.mediaId) continue;
      const matchedKeyword = automation.matchAnyText ? null : matchAutomationKeywords(event.text, automation.keywords, automation.wholeWordMatch);
      if (!automation.matchAnyText && !matchedKeyword) continue;
      enqueued = await store.enqueueInstagramAutomationRun({
        automationId: automation.id,
        instagramAccountId: account.id,
        triggerType: "comment",
        triggerExternalId: event.commentId,
        subjectIgsid: event.commenterIgsid,
        subjectUsername: event.commenterUsername,
        inputText: event.text,
        matchedKeyword,
      }) || enqueued;
    }
  }
  return enqueued;
}

async function enqueueInstagramDmAutomations(store: OpenChatStore, events: ReturnType<typeof parseInstagramInboundMessages>) {
  let enqueued = false;
  const matchedMessageIds = new Set<string>();
  for (const event of events) {
    if (event.isEcho) continue;
    const account = await store.getInstagramAccountByUserId(event.instagramUserId);
    if (!account) continue;
    const automations = (await store.listInstagramAutomations(account.id)).filter((automation) => automation.active && automation.triggerType === "dm");
    for (const automation of automations) {
      const matchedKeyword = automation.matchAnyText ? null : matchAutomationKeywords(event.text, automation.keywords, automation.wholeWordMatch);
      if (!automation.matchAnyText && !matchedKeyword) continue;
      matchedMessageIds.add(event.messageId);
      enqueued = await store.enqueueInstagramAutomationRun({
        automationId: automation.id,
        instagramAccountId: account.id,
        triggerType: "dm",
        triggerExternalId: event.messageId,
        subjectIgsid: event.senderIgsid,
        inputText: event.text,
        matchedKeyword,
        interactionAt: event.timestamp,
      }) || enqueued;
    }
  }
  return { enqueued, matchedMessageIds };
}

export async function reconcileInstagramComments(env: OpenChatEnv) {
  if (!env.OPENCHAT_SESSION_SECRET) return;
  const store = new OpenChatStore(env.DB);
  for (const account of await store.listInstagramAccounts()) {
    try {
      const accessToken = await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET);
      const media = await listInstagramMedia(env, accessToken, 25);
      let automations = (await store.listInstagramAutomations(account.id)).filter((automation) => automation.active && automation.triggerType === "comment");
      const reels = media.filter((item) => item.mediaProductType === "REELS" || item.mediaProductType === "REEL");
      for (const automation of automations.filter((item) => item.pendingNextReel)) {
        const next = reels.find((item) => {
          const timestamp = item.timestamp ? Date.parse(item.timestamp) : 0;
          return Number.isFinite(timestamp) && timestamp > automation.createdAt;
        });
        if (next) await store.activateNextReelAutomation(automation.id, next.id);
      }
      automations = (await store.listInstagramAutomations(account.id)).filter((automation) => automation.active && automation.triggerType === "comment" && !automation.pendingNextReel);
      const mediaIds = new Set(automations.flatMap((automation) => automation.matchAnyPost ? media.slice(0, 10).map((item) => item.id) : automation.postId ? [automation.postId] : []));
      for (const mediaId of mediaIds) {
        for (const comment of await listInstagramMediaComments(env, accessToken, mediaId, 100)) {
          if (comment.commenterIgsid === account.instagramUserId || !await store.markInstagramCommentSeen(account.id, comment.commentId, "polling")) continue;
          for (const automation of automations) {
            if (!automation.matchAnyPost && automation.postId !== mediaId) continue;
            const matchedKeyword = automation.matchAnyText ? null : matchAutomationKeywords(comment.text, automation.keywords, automation.wholeWordMatch);
            if (!automation.matchAnyText && !matchedKeyword) continue;
            await store.enqueueInstagramAutomationRun({
              automationId: automation.id,
              instagramAccountId: account.id,
              triggerType: "comment",
              triggerExternalId: comment.commentId,
              subjectIgsid: comment.commenterIgsid,
              subjectUsername: comment.commenterUsername,
              inputText: comment.text,
              matchedKeyword,
            });
          }
        }
      }
    } catch {
      // Webhooks remain primary. Polling is a best-effort reconciliation path.
    }
  }
  await processInstagramAutomationRuns(env, 100);
}

class InstagramAutomationRateLimitError extends Error {}

function automationLinkButtons(env: OpenChatEnv, run: Awaited<ReturnType<OpenChatStore["claimInstagramAutomationRun"]>>) {
  if (!run) return [];
  let origin: string | null = null;
  try { origin = env.OPENCHAT_PUBLIC_URL ? new URL(env.OPENCHAT_PUBLIC_URL).origin : null; }
  catch { origin = null; }
  return run.trackedLinks.map((link, index) => ({
    title: (index === 0 ? run.linkButtonLabel : null) || link.label || "Open link",
    url: origin ? `${origin}/l/${encodeURIComponent(link.slug)}` : link.destinationUrl,
  }));
}

export async function processInstagramAutomationRuns(env: OpenChatEnv, maximum = 25) {
  const store = new OpenChatStore(env.DB);
  if (!env.OPENCHAT_SESSION_SECRET) return;
  for (let processed = 0; processed < maximum; processed += 1) {
    const run = await store.claimInstagramAutomationRun();
    if (!run) return;
    try {
      const accessToken = await decryptCredential(run.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET);
      const recordOutbound = async (sent: { message_id: string }, text: string) => {
        await store.syncInstagramConversation({
          instagramAccountId: run.instagramAccountId,
          instagramUserId: run.instagramUserId,
          recipientIgsid: run.subjectIgsid,
          displayName: run.subjectUsername ?? undefined,
          username: run.subjectUsername ?? undefined,
          messages: [{ externalMessageId: sent.message_id || `automation:${run.id}:${Date.now()}`, author: "human", text, timestamp: Date.now() }],
        });
      };
      const claimBudget = async () => {
        if (!await store.claimInstagramSendBudget(run.instagramAccountId)) throw new InstagramAutomationRateLimitError("Per-account Instagram send budget is temporarily exhausted.");
      };
      if (run.revealSentAt && run.followUpScheduledAt && run.followUpScheduledAt <= Date.now() && !run.followUpSentAt) {
        if (!run.lastInteractionAt || Date.now() > run.lastInteractionAt + 24 * 60 * 60_000) throw new Error("The 24-hour Instagram messaging window closed before this follow-up became due.");
        await claimBudget();
        const followUp = renderAutomationMessage(run.followUpMessage || "", run.subjectUsername);
        const sent = await sendInstagramText(env, accessToken, run.instagramUserId, run.subjectIgsid, followUp);
        await recordOutbound(sent, followUp);
        await store.markInstagramAutomationFollowUpSent(run);
        await store.finishInstagramAutomationRun(run);
        continue;
      }

      const sendReveal = async (initial: boolean) => {
        const message = renderAutomationMessage(run.privateReplyMessage, run.subjectUsername);
        const buttons = automationLinkButtons(env, run);
        await claimBudget();
        let sent: { message_id: string };
        let deliveredMessage = message;
        try {
          if (buttons.length) {
            if (run.triggerType === "comment" && initial) sent = await sendInstagramPrivateReplyLinks(env, accessToken, run.instagramUserId, run.triggerExternalId, message, buttons);
            else sent = await sendInstagramDirectLinks(env, accessToken, run.instagramUserId, run.subjectIgsid, message, buttons);
          } else if (run.triggerType === "comment" && initial) {
            sent = await sendInstagramPrivateReply(env, accessToken, run.instagramUserId, run.triggerExternalId, message);
          } else {
            sent = await sendInstagramText(env, accessToken, run.instagramUserId, run.subjectIgsid, message);
          }
        } catch (error) {
          if (!(buttons.length && error instanceof InstagramApiError && error.code === 100)) throw error;
          const fallback = `${message}\n\n${buttons.map((button) => button.url).join("\n")}`.trim();
          deliveredMessage = fallback;
          if (run.triggerType === "comment" && initial) sent = await sendInstagramPrivateReply(env, accessToken, run.instagramUserId, run.triggerExternalId, fallback);
          else sent = await sendInstagramText(env, accessToken, run.instagramUserId, run.subjectIgsid, fallback);
        }
        await recordOutbound(sent!, deliveredMessage);
        if (initial) await store.markInstagramAutomationActionSent(run, "private");
        await store.markInstagramAutomationRevealSent(run, run.lastInteractionAt ?? undefined);
      };

      let waitingForPostback = false;
      if (!run.privateReplySentAt) {
        if (run.triggerType === "comment" && run.openingDmEnabled && run.openingDmMessage && run.openingDmButtonLabel) {
          await claimBudget();
          const openingMessage = renderAutomationMessage(run.openingDmMessage, run.subjectUsername);
          const sent = await sendInstagramPrivateReplyButton(
            env, accessToken, run.instagramUserId, run.triggerExternalId,
            openingMessage, run.openingDmButtonLabel, `openchat:reveal:${run.id}`,
          );
          await recordOutbound(sent, openingMessage);
          await store.markInstagramAutomationActionSent(run, "private");
          waitingForPostback = true;
        } else if (run.requireFollow && await inspectInstagramFollowStatus(env, accessToken, run.subjectIgsid) === false) {
          await claimBudget();
          const prompt = renderAutomationMessage(run.followPromptMessage || "Follow this account, then tap below to continue.", run.subjectUsername);
          const label = run.followPromptButtonLabel || "I'm following";
          const sent = run.triggerType === "comment"
            ? await sendInstagramPrivateReplyButton(env, accessToken, run.instagramUserId, run.triggerExternalId, prompt, label, `openchat:follow:${run.id}`)
            : await sendInstagramDirectButton(env, accessToken, run.instagramUserId, run.subjectIgsid, prompt, label, `openchat:follow:${run.id}`);
          await recordOutbound(sent, prompt);
          await store.markInstagramAutomationActionSent(run, "private");
          waitingForPostback = true;
        } else {
          await sendReveal(true);
        }
      } else if (!run.revealSentAt) {
        if (run.requireFollow && await inspectInstagramFollowStatus(env, accessToken, run.subjectIgsid) === false) {
          await claimBudget();
          const prompt = renderAutomationMessage(run.followPromptMessage || "Follow this account, then tap below to continue.", run.subjectUsername);
          const sent = await sendInstagramDirectButton(
            env, accessToken, run.instagramUserId, run.subjectIgsid,
            prompt,
            run.followPromptButtonLabel || "I'm following", `openchat:follow:${run.id}`,
          );
          await recordOutbound(sent, prompt);
          waitingForPostback = true;
        } else {
          await sendReveal(false);
        }
      }

      if (run.triggerType === "comment" && run.publicReplyEnabled && run.publicReplyMessage && !run.publicReplySentAt) {
        await claimBudget();
        await sendInstagramCommentReply(env, accessToken, run.triggerExternalId, renderAutomationMessage(run.publicReplyMessage, run.subjectUsername));
        await store.markInstagramAutomationActionSent(run, "public");
      }
      await store.finishInstagramAutomationRun(run);
      void waitingForPostback;
    } catch (error) {
      if (run.attempts < 8 && (error instanceof InstagramAutomationRateLimitError || (error instanceof InstagramApiError && [4, 17, 368].includes(error.code)))) {
        await store.rescheduleInstagramAutomationRun(run, 5 * 60_000, error.message);
      } else {
        await store.finishInstagramAutomationRun(run, error instanceof Error ? error.message : "Instagram automation failed");
      }
    }
  }
}

export async function handleOpenChatRequest(request: Request, env: OpenChatEnv, ctx: WorkerContext): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname === "/webhooks/telegram" && request.method === "POST") return handleTelegramWebhook(request, env, ctx);
  if (pathname === "/webhooks/instagram" && ["GET", "POST"].includes(request.method)) return handleInstagramWebhook(request, env, ctx);
  if (pathname === "/api/instagram/callback" && request.method === "GET") return handleInstagramCallback(request, env, ctx);
  const trackedLinkMatch = pathname.match(/^\/l\/([a-z0-9_-]+)$/i);
  if (trackedLinkMatch && request.method === "GET") return handleTrackedInstagramLink(request, env, ctx, trackedLinkMatch[1]);
  const outboundMediaMatch = pathname.match(/^\/media\/instagram-outbound\/(\d+)$/);
  if (outboundMediaMatch && request.method === "GET") {
    const messageId = parseId(outboundMediaMatch[1]);
    return messageId ? handleInstagramOutboundMedia(request, env, messageId) : new Response("Media not found", { status: 404 });
  }
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
  if (pathname === "/api/setup/instagram" && request.method === "GET") {
    const accounts = await store.listInstagramAccounts();
    if (accounts.some((account) => account.tokenExpiresAt && account.tokenExpiresAt <= Date.now() + 7 * 24 * 60 * 60_000)) {
      ctx.waitUntil(refreshDueInstagramTokens(env));
    }
    return json({
      appConfigured: Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET && env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
      callbackUrl: `${publicOrigin(request, env)}/api/instagram/callback`,
      webhookUrl: `${publicOrigin(request, env)}/webhooks/instagram`,
      accounts: accounts.map((account) => ({
        id: account.id,
        instagramUserId: account.instagramUserId,
        username: account.username,
        displayName: account.displayName,
        profilePictureUrl: account.profilePictureUrl,
        tokenExpiresAt: account.tokenExpiresAt,
        scopes: account.scopes,
        webhookSubscribed: account.webhookSubscribed,
        connectedAt: account.connectedAt,
        updatedAt: account.updatedAt,
        lastError: account.lastError,
      })),
    });
  }
  if (pathname === "/api/setup/instagram/connect" && request.method === "POST") {
    if (!env.OPENCHAT_SESSION_SECRET || !env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET || !env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
      return json({ error: "Configure the Instagram app ID, app secret, webhook verify token, and OpenChat session secret before connecting an account." }, 503);
    }
    const redirectUri = `${publicOrigin(request, env)}/api/instagram/callback`;
    const state = await store.createOauthState("instagram");
    try { return json({ authorizationUrl: instagramAuthorizationUrl(env, redirectUri, state) }); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Instagram connection is unavailable." }, 503); }
  }
  const instagramSetupMatch = pathname.match(/^\/api\/setup\/instagram\/(\d+)$/);
  if (instagramSetupMatch && request.method === "DELETE") {
    const accountId = parseId(instagramSetupMatch[1]);
    if (!accountId) return json({ error: "Invalid Instagram account id." }, 400);
    const account = await store.getInstagramAccount(accountId);
    if (!account) return json({ error: "Instagram account not found." }, 404);
    if (!env.OPENCHAT_SESSION_SECRET) return json({ error: "Stored Instagram credentials cannot be opened because OPENCHAT_SESSION_SECRET is missing." }, 503);
    try {
      const accessToken = await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET);
      await unsubscribeInstagramWebhooks(env, account.instagramUserId, accessToken);
    } catch (error) {
      return json({ error: `Instagram could not be disconnected safely: ${error instanceof Error ? error.message : "provider request failed"}` }, 502);
    }
    await store.deleteInstagramAccount(account.id);
    return json({ disconnected: true });
  }
  const instagramRefreshMatch = pathname.match(/^\/api\/setup\/instagram\/(\d+)\/refresh$/);
  if (instagramRefreshMatch && request.method === "POST") {
    const accountId = parseId(instagramRefreshMatch[1]);
    if (!accountId) return json({ error: "Invalid Instagram account id." }, 400);
    try {
      await refreshInstagramAccount(store, env, accountId);
      return json({ refreshed: true });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Instagram token refresh failed." }, 502);
    }
  }
  const instagramSyncMatch = pathname.match(/^\/api\/setup\/instagram\/(\d+)\/sync$/);
  if (instagramSyncMatch && request.method === "POST") {
    const accountId = parseId(instagramSyncMatch[1]);
    if (!accountId || !await store.getInstagramAccount(accountId)) return json({ error: "Instagram account not found." }, 404);
    ctx.waitUntil(syncInstagramAccount(store, env, accountId).catch(() => undefined));
    return json({ syncing: true }, 202);
  }
  const instagramMediaMatch = pathname.match(/^\/api\/instagram\/accounts\/(\d+)\/media$/);
  if (instagramMediaMatch && request.method === "GET") {
    const accountId = parseId(instagramMediaMatch[1]);
    const account = accountId ? await store.getInstagramAccount(accountId) : null;
    if (!account) return json({ error: "Instagram account not found." }, 404);
    if (!env.OPENCHAT_SESSION_SECRET) return json({ error: "Instagram credentials are unavailable." }, 503);
    try {
      return json({ media: await listInstagramMedia(env, await decryptCredential(account.encryptedAccessToken, env.OPENCHAT_SESSION_SECRET), 50) });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Could not load Instagram posts." }, 502);
    }
  }
  if (pathname === "/api/instagram/automations") {
    if (request.method === "GET") return json({ automations: await store.listInstagramAutomations() });
    if (request.method === "POST") {
      const normalized = await normalizeInstagramAutomation(await readJson<InstagramAutomationBody>(request), store);
      if ("error" in normalized) return json({ error: normalized.error }, 400);
      const id = await store.createInstagramAutomation(normalized.input);
      return json({ id, automations: await store.listInstagramAutomations() }, 201);
    }
  }
  const automationMatch = pathname.match(/^\/api\/instagram\/automations\/(\d+)$/);
  if (automationMatch) {
    const id = parseId(automationMatch[1]);
    if (!id) return json({ error: "Invalid automation id." }, 400);
    if (request.method === "PATCH") {
      const body = await readJson<{ active?: boolean }>(request);
      if (typeof body?.active !== "boolean") return json({ error: "Expected an active state." }, 400);
      if (!await store.setInstagramAutomationActive(id, body.active)) return json({ error: "Automation not found." }, 404);
      return json({ automations: await store.listInstagramAutomations() });
    }
    if (request.method === "PUT") {
      const normalized = await normalizeInstagramAutomation(await readJson<InstagramAutomationBody>(request), store);
      if ("error" in normalized) return json({ error: normalized.error }, 400);
      if (!await store.updateInstagramAutomation(id, normalized.input)) return json({ error: "Automation not found." }, 404);
      return json({ automations: await store.listInstagramAutomations() });
    }
    if (request.method === "DELETE") {
      if (!await store.deleteInstagramAutomation(id)) return json({ error: "Automation not found." }, 404);
      return json({ automations: await store.listInstagramAutomations() });
    }
  }
  if (pathname === "/api/instagram/automation-runs" && request.method === "GET") {
    return json({ runs: await store.listInstagramAutomationRuns() });
  }
  if (pathname === "/api/instagram/automation-analytics" && request.method === "GET") {
    return json({ analytics: await store.listInstagramAutomationAnalytics() });
  }
  const automationRetryMatch = pathname.match(/^\/api\/operations\/instagram-automations\/(\d+)\/retry$/);
  if (automationRetryMatch && request.method === "POST") {
    const runId = parseId(automationRetryMatch[1]);
    if (!runId) return json({ error: "Invalid automation run id." }, 400);
    if (!await store.retryInstagramAutomationRun(runId)) return json({ error: "Failed automation run not found." }, 404);
    ctx.waitUntil(processInstagramAutomationRuns(env));
    return json({ operations: await store.listOperations() }, 202);
  }
  if (pathname === "/api/health" && request.method === "GET") {
    await store.ready();
    return json({ ok: true, ...await runtimeStatus(store, env) });
  }
  if (pathname === "/api/conversations" && request.method === "GET") return json({ conversations: await store.listConversations() });

  const attachmentMatch = pathname.match(/^\/api\/messages\/(\d+)\/attachment$/);
  if (attachmentMatch && request.method === "GET") {
    const messageId = parseId(attachmentMatch[1]);
    if (!messageId) return json({ error: "Invalid message id." }, 400);
    const context = await store.getMessageAttachmentContext(messageId);
    if (!context) return json({ error: "Attachment not found." }, 404);
    const { attachment } = context;
    try {
      let upstream: Response | null = null;
      if (context.channel === "instagram" && attachment.url) upstream = await fetch(safeRemoteAttachmentUrl(attachment.url));
      else if (context.channel === "instagram" && attachment.fileId && env.MEDIA) {
        const object = await env.MEDIA.get(attachment.fileId);
        if (object) upstream = new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || attachment.mimeType || "application/octet-stream" } });
      } else if (attachment.fileId) upstream = await downloadTelegramFile((await resolveTelegramEnvironment(store, env)).env, attachment.fileId);
      if (!upstream?.ok) return json({ error: "The provider attachment is no longer available." }, 404);
      const headers = new Headers();
      headers.set("content-type", upstream.headers.get("content-type") ?? attachment.mimeType ?? "application/octet-stream");
      headers.set("cache-control", "private, max-age=300");
      const safeName = (attachment.fileName ?? `${attachment.type}-${messageId}`).replace(/[^a-zA-Z0-9._-]/g, "_");
      headers.set("content-disposition", `${attachment.type === "photo" ? "inline" : "attachment"}; filename="${safeName}"`);
      return new Response(upstream.body, { status: 200, headers });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Could not download the provider attachment." }, 502);
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
      const isVideo = file ? /^video\/(mp4|quicktime|webm)$/i.test(file.type) : false;
      const isAudio = file ? /^audio\//i.test(file.type) : false;
      if (file && isPhoto && file.size > 10 * 1024 * 1024) return json({ error: "Photos must be 10 MB or smaller." }, 400);
      if (file && !isPhoto && file.size > 50 * 1024 * 1024) return json({ error: "Files must be 50 MB or smaller." }, 400);
      const attachment: MessageAttachment | undefined = file ? {
        type: isPhoto ? "photo" : isVideo ? "video" : isAudio ? "audio" : "document",
        fileName: file.name,
        mimeType: file.type || undefined,
        fileSize: file.size,
      } : undefined;
      const messageText = text || (attachment?.type === "photo" ? "Photo" : attachment?.type === "video" ? "Video" : attachment?.type === "audio" ? "Audio" : file?.name || "Document");
      const takeover = await setConversationMode(store, id, "HUMAN_ACTIVE");
      if (takeover === "missing") return json({ error: "Conversation not found." }, 404);
      if (takeover === "busy") return json({ error: "An AI reply is finishing. Try sending again in a moment." }, 409);
      const outbound = await store.createOutbound(id, "human", messageText, { attachment, replyToMessageId });
      if (!outbound) return json({ error: "Conversation is busy. Try sending again in a moment." }, 409);
      try {
        await deliver(store, env, outbound, file);
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
      let result: Awaited<ReturnType<OpenChatStore["recordInbound"]>>;
      if (event.provider === "instagram") {
        const instagramEvent = parseInstagramInboundMessages(payload).find((candidate) => candidate.messageId === event.externalId);
        if (!instagramEvent) return json({ error: "The stored event no longer contains the expected Instagram message." }, 409);
        const account = await store.getInstagramAccountByUserId(instagramEvent.instagramUserId);
        if (!account) return json({ error: "Reconnect the Instagram account before retrying this event." }, 409);
        result = await store.recordInbound({
          channel: "instagram",
          eventId: instagramEvent.messageId,
          externalMessageId: instagramEvent.messageId,
          externalConversationId: `${account.instagramUserId}:${instagramEvent.senderIgsid}`,
          externalContactId: `${account.instagramUserId}:${instagramEvent.senderIgsid}`,
          displayName: `Instagram user ${instagramEvent.senderIgsid.slice(-6)}`,
          text: instagramEvent.text,
          attachment: instagramEvent.attachment,
          replyToExternalMessageId: instagramEvent.replyToMessageId,
          timestamp: instagramEvent.timestamp,
          payload: event.payload,
          instagramAccountId: account.id,
          instagramRecipientIgsid: instagramEvent.senderIgsid,
          messagingWindowUntil: instagramEvent.timestamp + 24 * 60 * 60_000,
        });
      } else {
        const telegramEnv = (await resolveTelegramEnvironment(store, env)).env;
        const normalized = await normalizeInboundPayload(store, telegramEnv, payload);
        if (!normalized.inbound) return json({ error: "The stored event no longer contains a supported Telegram message." }, 409);
        result = await store.recordTelegramInbound(normalized.inbound);
      }
      if (result.eventId && result.conversationId) ctx.waitUntil(processAiReply(store, env, result.conversationId).catch(() => undefined));
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
    ctx.waitUntil(processAiReply(store, env, conversationId).catch(() => undefined));
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
