import type { MessageAttachment } from "./database";
import type { OpenChatEnv } from "./runtime";

const DEFAULT_GRAPH_VERSION = "v25.0";
const OAUTH_URL = "https://api.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
] as const;

function graphVersion(env: OpenChatEnv) {
  const value = env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("META_GRAPH_API_VERSION must look like v25.0.");
  return value;
}

function graphBase(env: OpenChatEnv) {
  return `https://graph.instagram.com/${graphVersion(env)}`;
}

function requireInstagramApp(env: OpenChatEnv) {
  const appId = env.INSTAGRAM_APP_ID?.trim();
  const appSecret = env.INSTAGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("Instagram is not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.");
  return { appId, appSecret };
}

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly subcode?: number,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

async function metaResponse<T>(response: Response): Promise<T> {
  let body: T & MetaErrorBody;
  try { body = await response.json() as T & MetaErrorBody; }
  catch { throw new InstagramApiError(`Instagram returned an unreadable response (${response.status}).`, response.status); }
  if (!response.ok || body.error) {
    const error = body.error;
    const code = error?.code ?? response.status;
    const detail = [error?.message || `HTTP ${response.status}`, error?.type, error?.fbtrace_id ? `trace ${error.fbtrace_id}` : ""].filter(Boolean).join(" · ");
    throw new InstagramApiError(detail, code, error?.error_subcode, error?.fbtrace_id);
  }
  return body;
}

export function instagramAuthorizationUrl(env: OpenChatEnv, redirectUri: string, state: string) {
  const { appId } = requireInstagramApp(env);
  const query = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: INSTAGRAM_SCOPES.join(","),
    response_type: "code",
    state,
  });
  return `${OAUTH_URL}?${query.toString()}`;
}

export async function exchangeInstagramCode(env: OpenChatEnv, code: string, redirectUri: string) {
  const { appId, appSecret } = requireInstagramApp(env);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const result = await metaResponse<{ access_token: string; user_id: number | string }>(response);
  if (!result.access_token) throw new Error("Instagram did not return an access token.");
  return { accessToken: result.access_token, appScopedUserId: String(result.user_id) };
}

export async function exchangeInstagramLongLivedToken(env: OpenChatEnv, shortLivedToken: string) {
  const { appSecret } = requireInstagramApp(env);
  const url = new URL(`${graphBase(env)}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);
  const result = await metaResponse<{ access_token: string; expires_in?: number }>(await fetch(url));
  return { accessToken: result.access_token, expiresIn: result.expires_in ?? 5_184_000 };
}

export async function refreshInstagramToken(env: OpenChatEnv, accessToken: string) {
  const url = new URL(`${graphBase(env)}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const result = await metaResponse<{ access_token: string; expires_in?: number }>(await fetch(url));
  return { accessToken: result.access_token, expiresIn: result.expires_in ?? 5_184_000 };
}

export interface InstagramProfile {
  id: string;
  user_id?: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}

export async function inspectInstagramProfile(env: OpenChatEnv, accessToken: string): Promise<InstagramProfile> {
  const url = new URL(`${graphBase(env)}/me`);
  url.searchParams.set("fields", "id,user_id,username,name,profile_picture_url");
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  return metaResponse<InstagramProfile>(response);
}

export async function inspectInstagramContact(env: OpenChatEnv, accessToken: string, igsid: string) {
  const url = new URL(`${graphBase(env)}/${encodeURIComponent(igsid)}`);
  url.searchParams.set("fields", "name,username,profile_pic,is_user_follow_business");
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  return metaResponse<{ id?: string; name?: string; username?: string; profile_pic?: string; is_user_follow_business?: boolean }>(response);
}

export async function subscribeInstagramWebhooks(env: OpenChatEnv, instagramUserId: string, accessToken: string) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/subscribed_apps`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ subscribed_fields: ["messages", "messaging_postbacks", "messaging_seen", "message_reactions", "comments"] }),
  });
  return metaResponse<{ success: boolean }>(response);
}

export async function unsubscribeInstagramWebhooks(env: OpenChatEnv, instagramUserId: string, accessToken: string) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/subscribed_apps`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return metaResponse<{ success: boolean }>(response);
}

export async function sendInstagramText(env: OpenChatEnv, accessToken: string, instagramUserId: string, recipientIgsid: string, text: string, humanAgent = false) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { text },
      ...(humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : {}),
    }),
  });
  return metaResponse<{ recipient_id: string; message_id: string }>(response);
}

export async function sendInstagramMedia(env: OpenChatEnv, accessToken: string, instagramUserId: string, recipientIgsid: string, type: "image" | "video" | "audio" | "file", url: string, humanAgent = false) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { attachment: { type, payload: { url, is_reusable: true } } },
      ...(humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : {}),
    }),
  });
  return metaResponse<{ recipient_id: string; message_id: string }>(response);
}

export async function sendInstagramPrivateReply(env: OpenChatEnv, accessToken: string, instagramUserId: string, commentId: string, text: string) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
  return metaResponse<{ recipient_id: string; message_id: string }>(response);
}

export interface InstagramLinkButton { title: string; url: string }

async function sendInstagramTemplate(
  env: OpenChatEnv,
  accessToken: string,
  instagramUserId: string,
  recipient: { id: string } | { comment_id: string },
  text: string,
  buttons: Array<{ type: "postback"; title: string; payload: string } | { type: "web_url"; title: string; url: string }>,
) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      recipient,
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: text.slice(0, 640),
            buttons: buttons.slice(0, 3).map((button) => ({ ...button, title: button.title.slice(0, 20) })),
          },
        },
      },
    }),
  });
  return metaResponse<{ recipient_id: string; message_id: string }>(response);
}

export function sendInstagramPrivateReplyButton(env: OpenChatEnv, accessToken: string, instagramUserId: string, commentId: string, text: string, title: string, payload: string) {
  return sendInstagramTemplate(env, accessToken, instagramUserId, { comment_id: commentId }, text, [{ type: "postback", title, payload }]);
}

export function sendInstagramDirectButton(env: OpenChatEnv, accessToken: string, instagramUserId: string, recipientIgsid: string, text: string, title: string, payload: string) {
  return sendInstagramTemplate(env, accessToken, instagramUserId, { id: recipientIgsid }, text, [{ type: "postback", title, payload }]);
}

export function sendInstagramPrivateReplyLinks(env: OpenChatEnv, accessToken: string, instagramUserId: string, commentId: string, text: string, buttons: InstagramLinkButton[]) {
  return sendInstagramTemplate(env, accessToken, instagramUserId, { comment_id: commentId }, text, buttons.map((button) => ({ type: "web_url" as const, title: button.title, url: button.url })));
}

export function sendInstagramDirectLinks(env: OpenChatEnv, accessToken: string, instagramUserId: string, recipientIgsid: string, text: string, buttons: InstagramLinkButton[]) {
  return sendInstagramTemplate(env, accessToken, instagramUserId, { id: recipientIgsid }, text, buttons.map((button) => ({ type: "web_url" as const, title: button.title, url: button.url })));
}

export async function inspectInstagramFollowStatus(env: OpenChatEnv, accessToken: string, recipientIgsid: string) {
  try {
    const profile = await inspectInstagramContact(env, accessToken, recipientIgsid);
    return typeof profile.is_user_follow_business === "boolean" ? profile.is_user_follow_business : null;
  } catch {
    return null;
  }
}

export async function sendInstagramCommentReply(env: OpenChatEnv, accessToken: string, commentId: string, text: string) {
  const response = await fetch(`${graphBase(env)}/${encodeURIComponent(commentId)}/replies`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ message: text }),
  });
  return metaResponse<{ id: string }>(response);
}

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

async function signWebhook(rawBody: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes(rawBody)));
  return `sha256=${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function constantTimeEqual(left: string, right: string) {
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", bytes(left)), crypto.subtle.digest("SHA-256", bytes(right))]);
  const leftBytes = new Uint8Array(a);
  const rightBytes = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

export async function verifyInstagramWebhookSignature(env: OpenChatEnv, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const secrets = [env.FACEBOOK_APP_SECRET, env.INSTAGRAM_APP_SECRET].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  if (!secrets.length) throw new Error("Instagram webhook verification requires INSTAGRAM_APP_SECRET or FACEBOOK_APP_SECRET.");
  for (const secret of secrets) if (await constantTimeEqual(signature, await signWebhook(rawBody, secret))) return true;
  return false;
}

interface InstagramWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: {
        mid?: string;
        text?: string;
        is_echo?: boolean;
        is_deleted?: boolean;
        is_unsupported?: boolean;
        reply_to?: { mid?: string };
        attachments?: Array<{ type?: string; payload?: { url?: string; sticker_id?: string } }>;
      };
      postback?: { mid?: string; title?: string; payload?: string };
    }>;
    changes?: Array<{
      field?: string;
      value?: {
        id?: string;
        comment_id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string; media_product_type?: string };
        media_id?: string;
      };
    }>;
  }>;
}

export interface InstagramCommentEvent {
  instagramUserId: string;
  commentId: string;
  commenterIgsid: string;
  commenterUsername?: string;
  text: string;
  mediaId: string;
  timestamp: number;
}

export function parseInstagramCommentEvents(payload: unknown): InstagramCommentEvent[] {
  const value = payload as InstagramWebhookPayload;
  if (value?.object !== "instagram" || !Array.isArray(value.entry)) return [];
  const events: InstagramCommentEvent[] = [];
  for (const entry of value.entry) {
    if (!entry.id) continue;
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" && change.field !== "live_comments") continue;
      const comment = change.value;
      const commentId = comment?.id ?? comment?.comment_id;
      const commenterIgsid = comment?.from?.id;
      const mediaId = comment?.media?.id ?? comment?.media_id;
      if (!commentId || !commenterIgsid || !mediaId || commenterIgsid === entry.id) continue;
      events.push({
        instagramUserId: entry.id,
        commentId,
        commenterIgsid,
        commenterUsername: comment?.from?.username,
        text: comment?.text ?? "",
        mediaId,
        timestamp: entry.time ?? Date.now(),
      });
    }
  }
  return events;
}

interface InstagramWebhookAttachment {
  type?: string;
  payload?: { url?: string; sticker_id?: string };
}

export interface InstagramInboundMessageEvent {
  instagramUserId: string;
  senderIgsid: string;
  messageId: string;
  text: string;
  timestamp: number;
  replyToMessageId?: string;
  attachment?: MessageAttachment;
  isEcho: boolean;
}

export interface InstagramPostbackEvent {
  instagramUserId: string;
  senderIgsid: string;
  payload: string;
  messageId: string;
  timestamp: number;
}

export function parseInstagramPostbacks(payload: unknown): InstagramPostbackEvent[] {
  const value = payload as InstagramWebhookPayload;
  if (value?.object !== "instagram" || !Array.isArray(value.entry)) return [];
  const events: InstagramPostbackEvent[] = [];
  for (const entry of value.entry) {
    if (!entry.id) continue;
    for (const messaging of entry.messaging ?? []) {
      const senderIgsid = messaging.sender?.id;
      const postback = messaging.postback;
      if (!senderIgsid || senderIgsid === entry.id || !postback?.payload) continue;
      events.push({
        instagramUserId: entry.id,
        senderIgsid,
        payload: postback.payload,
        messageId: postback.mid || `postback:${entry.id}:${senderIgsid}:${messaging.timestamp ?? entry.time ?? Date.now()}`,
        timestamp: messaging.timestamp ?? entry.time ?? Date.now(),
      });
    }
  }
  return events;
}

export interface InstagramMediaItem {
  id: string;
  mediaType?: string;
  mediaProductType?: string;
  timestamp?: string;
  permalink?: string;
}

export async function listInstagramMedia(env: OpenChatEnv, accessToken: string, limit = 25) {
  const url = new URL(`${graphBase(env)}/me/media`);
  url.searchParams.set("fields", "id,media_type,media_product_type,timestamp,permalink");
  url.searchParams.set("limit", String(Math.max(1, Math.min(100, limit))));
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const result = await metaResponse<{ data?: Array<{ id: string; media_type?: string; media_product_type?: string; timestamp?: string; permalink?: string }> }>(response);
  return (result.data ?? []).map((item) => ({ id: item.id, mediaType: item.media_type, mediaProductType: item.media_product_type, timestamp: item.timestamp, permalink: item.permalink } satisfies InstagramMediaItem));
}

export async function listInstagramMediaComments(env: OpenChatEnv, accessToken: string, mediaId: string, limit = 100) {
  const url = new URL(`${graphBase(env)}/${encodeURIComponent(mediaId)}/comments`);
  url.searchParams.set("fields", "id,text,username,from,timestamp");
  url.searchParams.set("limit", String(Math.max(1, Math.min(100, limit))));
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const result = await metaResponse<{ data?: Array<{ id: string; text?: string; username?: string; from?: { id?: string; username?: string }; timestamp?: string }> }>(response);
  return (result.data ?? []).flatMap((comment) => {
    const commenterIgsid = comment.from?.id;
    if (!commenterIgsid) return [];
    return [{
      commentId: comment.id,
      commenterIgsid,
      commenterUsername: comment.from?.username ?? comment.username,
      text: comment.text ?? "",
      mediaId,
      timestamp: comment.timestamp ? Date.parse(comment.timestamp) : Date.now(),
    }];
  });
}

function instagramAttachment(value: InstagramWebhookAttachment): MessageAttachment | undefined {
  const url = value.payload?.url;
  const providerMediaId = value.payload?.sticker_id;
  switch (value.type) {
    case "image": return { type: "photo", url, providerMediaId };
    case "video": return { type: "video", url, providerMediaId };
    case "audio": return { type: "audio", url, providerMediaId };
    case "file": return { type: "document", url, providerMediaId };
    case "share": return { type: "document", url, providerMediaId };
    default: return value.type || url || providerMediaId ? { type: "document", url, providerMediaId } : undefined;
  }
}

export function parseInstagramInboundMessages(payload: unknown): InstagramInboundMessageEvent[] {
  const value = payload as InstagramWebhookPayload;
  if (value?.object !== "instagram" || !Array.isArray(value.entry)) return [];
  const events: InstagramInboundMessageEvent[] = [];
  for (const entry of value.entry) {
    if (!entry.id) continue;
    for (const messaging of entry.messaging ?? []) {
      const message = messaging.message;
      const isEcho: boolean = Boolean(message?.is_echo || messaging.sender?.id === entry.id);
      const senderIgsid: string | undefined = isEcho ? messaging.recipient?.id : messaging.sender?.id;
      if (!message?.mid || !senderIgsid || senderIgsid === entry.id || message.is_deleted || message.is_unsupported) continue;
      const attachment = message.attachments?.map(instagramAttachment).find(Boolean);
      const text = message.text?.trim() || (attachment ? attachment.type === "photo" ? "Photo" : attachment.type === "video" ? "Video" : attachment.type === "audio" ? "Audio" : "Attachment" : "");
      if (!text) continue;
      events.push({
        instagramUserId: entry.id,
        senderIgsid,
        messageId: message.mid,
        text,
        timestamp: messaging.timestamp ?? entry.time ?? Date.now(),
        replyToMessageId: message.reply_to?.mid,
        attachment,
        isEcho,
      });
    }
  }
  return events;
}

export interface InstagramConversationParticipant {
  id: string;
  username?: string;
  name?: string;
}

export interface InstagramConversationMessage {
  id: string;
  created_time?: string;
  message?: string;
  from?: InstagramConversationParticipant;
  to?: { data?: InstagramConversationParticipant[] };
  attachments?: { data?: Array<{ image_data?: { url?: string }; video_data?: { url?: string }; file_url?: string; mime_type?: string; name?: string }> };
}

export interface InstagramConversation {
  id: string;
  updated_time?: string;
  participants?: { data?: InstagramConversationParticipant[] };
  messages?: { data?: InstagramConversationMessage[] };
}

async function graphPages<T>(url: URL, accessToken: string, max: number) {
  const results: T[] = [];
  let next: string | null = url.toString();
  while (next && results.length < max) {
    const page: { data?: T[]; paging?: { next?: string } } = await metaResponse(await fetch(next, { headers: { authorization: `Bearer ${accessToken}` } }));
    results.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
  }
  return results.slice(0, max);
}

export async function listInstagramConversations(env: OpenChatEnv, accessToken: string, instagramUserId: string, max = 50) {
  const url = new URL(`${graphBase(env)}/${encodeURIComponent(instagramUserId)}/conversations`);
  url.searchParams.set("platform", "instagram");
  url.searchParams.set("fields", "participants,updated_time");
  url.searchParams.set("limit", String(Math.min(max, 50)));
  return graphPages<InstagramConversation>(url, accessToken, max);
}

export async function getInstagramConversation(env: OpenChatEnv, accessToken: string, conversationId: string) {
  const url = new URL(`${graphBase(env)}/${encodeURIComponent(conversationId)}`);
  url.searchParams.set("fields", "participants,updated_time,messages.limit(50){id,created_time,from,to,message,attachments}");
  return metaResponse<InstagramConversation>(await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } }));
}

export function instagramHistoryAttachment(message: InstagramConversationMessage): MessageAttachment | undefined {
  const attachment = message.attachments?.data?.[0];
  if (!attachment) return undefined;
  if (attachment.image_data?.url) return { type: "photo", url: attachment.image_data.url, mimeType: attachment.mime_type };
  if (attachment.video_data?.url) return { type: "video", url: attachment.video_data.url, mimeType: attachment.mime_type };
  if (attachment.file_url) return { type: "document", url: attachment.file_url, mimeType: attachment.mime_type, fileName: attachment.name };
  return undefined;
}
