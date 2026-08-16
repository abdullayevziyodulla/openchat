import type { OpenChatEnv } from "./runtime";
import type { MessageAttachment, TelegramBusinessConnection, TelegramInbound } from "./database";

interface TelegramUser {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id?: number;
  date?: number;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  sender_business_bot?: TelegramUser;
  business_connection_id?: string;
  reply_to_message?: { message_id?: number };
  photo?: TelegramFileObject[];
  document?: TelegramFileObject;
  video?: TelegramFileObject;
  video_note?: TelegramFileObject;
  audio?: TelegramFileObject;
  voice?: TelegramFileObject;
  animation?: TelegramFileObject;
  sticker?: TelegramFileObject;
  chat?: { id?: number; type?: string; title?: string; username?: string; first_name?: string; last_name?: string };
}

interface TelegramFileObject {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  business_message?: TelegramMessage;
  business_connection?: TelegramBusinessConnectionPayload;
}

interface TelegramBusinessConnectionPayload {
  id?: string;
  user?: TelegramUser;
  user_chat_id?: number;
  date?: number;
  rights?: { can_reply?: boolean };
  is_enabled?: boolean;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  parameters?: { retry_after?: number };
}

function fileAttachment(type: MessageAttachment["type"], file: TelegramFileObject | undefined): MessageAttachment | null {
  if (!file?.file_id) return null;
  return {
    type,
    fileId: file.file_id,
    fileName: file.file_name,
    mimeType: file.mime_type,
    fileSize: file.file_size,
    width: file.width,
    height: file.height,
    duration: file.duration,
  };
}

export function telegramAttachment(message: TelegramMessage | undefined): MessageAttachment | null {
  const photo = message?.photo?.at(-1);
  if (photo) return fileAttachment("photo", photo);
  return fileAttachment("document", message?.document)
    ?? fileAttachment("video", message?.video)
    ?? fileAttachment("video_note", message?.video_note)
    ?? fileAttachment("audio", message?.audio)
    ?? fileAttachment("voice", message?.voice)
    ?? fileAttachment("animation", message?.animation)
    ?? fileAttachment("sticker", message?.sticker);
}

function attachmentLabel(attachment: MessageAttachment) {
  if (attachment.type === "document" && attachment.fileName) return attachment.fileName;
  if (attachment.type === "voice") return "Voice message";
  if (attachment.type === "video_note") return "Video message";
  return attachment.type.charAt(0).toUpperCase() + attachment.type.slice(1);
}

export function normalizeTelegramUpdate(value: unknown): TelegramInbound | null {
  if (!value || typeof value !== "object") return null;
  const update = value as TelegramUpdate;
  const message = update.message;
  const attachment = telegramAttachment(message);
  const text = (message?.text ?? message?.caption)?.trim() || (attachment ? attachmentLabel(attachment) : "");
  const chatId = message?.chat?.id;
  const senderId = message?.from?.id;
  if (!Number.isInteger(update.update_id) || !Number.isInteger(message?.message_id) || !Number.isInteger(chatId) || !Number.isInteger(senderId) || message?.from?.is_bot || !text) return null;
  const firstName = message?.from?.first_name?.trim() ?? "";
  const lastName = message?.from?.last_name?.trim() ?? "";
  const displayName = `${firstName} ${lastName}`.trim() || message?.from?.username || message?.chat?.title || "Telegram contact";
  return {
    updateId: String(update.update_id),
    messageId: `${chatId}:${message!.message_id}`,
    chatId: String(chatId),
    senderId: String(senderId),
    displayName,
    username: message?.from?.username,
    text,
    attachment: attachment ?? undefined,
    replyToProviderMessageId: Number.isInteger(message?.reply_to_message?.message_id) ? String(message!.reply_to_message!.message_id) : undefined,
    timestamp: (message?.date ?? Math.floor(Date.now() / 1000)) * 1000,
    payload: JSON.stringify(value),
  };
}

function displayName(user: TelegramUser | undefined, fallback: string) {
  const firstName = user?.first_name?.trim() ?? "";
  const lastName = user?.last_name?.trim() ?? "";
  return `${firstName} ${lastName}`.trim() || user?.username || fallback;
}

export function telegramBusinessConnectionId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const update = value as TelegramUpdate;
  const id = update.business_message?.business_connection_id;
  return typeof id === "string" && id ? id : null;
}

export function normalizeTelegramBusinessConnection(value: unknown): TelegramBusinessConnection | null {
  if (!value || typeof value !== "object") return null;
  const wrapper = value as TelegramUpdate;
  const connection = wrapper.business_connection ?? value as TelegramBusinessConnectionPayload;
  if (!connection.id || !Number.isInteger(connection.user?.id)) return null;
  return {
    id: connection.id,
    accountUserId: String(connection.user!.id),
    displayName: displayName(connection.user, "Telegram Business account"),
    username: connection.user?.username,
    canReply: Boolean(connection.rights?.can_reply),
    enabled: connection.is_enabled !== false,
    payload: JSON.stringify(value),
    updatedAt: (connection.date ?? Math.floor(Date.now() / 1000)) * 1000,
  };
}

export function normalizeTelegramBusinessMessage(value: unknown, businessAccountUserId: string): TelegramInbound | null {
  if (!value || typeof value !== "object") return null;
  const update = value as TelegramUpdate;
  const message = update.business_message;
  const attachment = telegramAttachment(message);
  const text = (message?.text ?? message?.caption)?.trim() || (attachment ? attachmentLabel(attachment) : "");
  const chatId = message?.chat?.id;
  const senderId = message?.from?.id;
  const connectionId = message?.business_connection_id;
  if (!Number.isInteger(update.update_id) || !Number.isInteger(message?.message_id) || !Number.isInteger(chatId) || !Number.isInteger(senderId) || !connectionId || !text) return null;
  if (message?.from?.is_bot || message?.sender_business_bot || String(senderId) === businessAccountUserId) return null;
  return {
    channel: "telegram_business",
    businessConnectionId: connectionId,
    updateId: String(update.update_id),
    messageId: `${connectionId}:${chatId}:${message!.message_id}`,
    chatId: String(chatId),
    senderId: String(senderId),
    displayName: displayName(message?.from, message?.chat?.title || "Telegram contact"),
    username: message?.from?.username,
    text,
    attachment: attachment ?? undefined,
    replyToProviderMessageId: Number.isInteger(message?.reply_to_message?.message_id) ? String(message!.reply_to_message!.message_id) : undefined,
    timestamp: (message?.date ?? Math.floor(Date.now() / 1000)) * 1000,
    payload: JSON.stringify(value),
  };
}

function telegramUrl(env: OpenChatEnv, method: string) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function telegramCall<T>(env: OpenChatEnv, method: string, body?: Record<string, unknown> | FormData, attempts = 3): Promise<T> {
  let lastError = "Telegram request failed";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(telegramUrl(env, method), {
        method: body ? "POST" : "GET",
        headers: body && !(body instanceof FormData) ? { "content-type": "application/json" } : undefined,
        body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12_000),
      });
      const result = await response.json() as TelegramResponse<T>;
      if (response.ok && result.ok && result.result !== undefined) return result.result;
      lastError = result.description ?? `Telegram returned HTTP ${response.status}`;
      const retrySeconds = result.parameters?.retry_after;
      if (attempt < attempts - 1 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, Math.min((retrySeconds ?? 2 ** attempt) * 1000, 10_000)));
        continue;
      }
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error(lastError);
}

export function telegramProviderMessageId(externalId: string | null | undefined) {
  const value = externalId?.split(":").at(-1);
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

function replyParameters(replyToMessageId?: number | null) {
  return replyToMessageId ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } } : {};
}

export async function sendTelegramMessage(env: OpenChatEnv, chatId: string, text: string, businessConnectionId?: string | null, replyToMessageId?: number | null) {
  const result = await telegramCall<{ message_id: number }>(env, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
    ...replyParameters(replyToMessageId),
  }, 1);
  return String(result.message_id);
}

export async function sendTelegramAttachment(env: OpenChatEnv, chatId: string, file: File, caption: string, businessConnectionId?: string | null, replyToMessageId?: number | null) {
  const photo = /^image\/(jpeg|png|webp)$/i.test(file.type);
  if (photo && file.size > 10 * 1024 * 1024) throw new Error("Telegram photos must be 10 MB or smaller.");
  if (!photo && file.size > 50 * 1024 * 1024) throw new Error("Telegram files must be 50 MB or smaller.");
  const field = photo ? "photo" : "document";
  const form = new FormData();
  form.append("chat_id", chatId);
  if (businessConnectionId) form.append("business_connection_id", businessConnectionId);
  if (caption) form.append("caption", caption.slice(0, 1024));
  if (replyToMessageId) form.append("reply_parameters", JSON.stringify({ message_id: replyToMessageId, allow_sending_without_reply: true }));
  form.append(field, file, file.name);
  const result = await telegramCall<TelegramMessage>(env, photo ? "sendPhoto" : "sendDocument", form, 1);
  if (!Number.isInteger(result.message_id)) throw new Error("Telegram returned an invalid sent message.");
  return { messageId: String(result.message_id), attachment: telegramAttachment(result) };
}

export async function downloadTelegramFile(env: OpenChatEnv, fileId: string) {
  const file = await telegramCall<{ file_path?: string }>(env, "getFile", { file_id: fileId }, 1);
  if (!file.file_path) throw new Error("Telegram did not return a file path.");
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.body) throw new Error(`Telegram file download failed (${response.status}).`);
  return response;
}

export async function configureTelegramWebhook(env: OpenChatEnv, publicUrl: string) {
  if (!env.TELEGRAM_WEBHOOK_SECRET) throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
  const webhookUrl = `${publicUrl.replace(/\/$/, "")}/webhooks/telegram`;
  await telegramCall<boolean>(env, "setWebhook", {
    url: webhookUrl,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "business_connection", "business_message", "edited_business_message", "deleted_business_messages"],
    drop_pending_updates: false,
  });
  return telegramCall<{ username?: string; first_name?: string }>(env, "getMe");
}

export async function removeTelegramWebhook(env: OpenChatEnv) {
  return telegramCall<boolean>(env, "deleteWebhook", { drop_pending_updates: false });
}

export async function inspectTelegramBot(env: OpenChatEnv) {
  return telegramCall<{ username?: string; first_name?: string }>(env, "getMe", undefined, 1);
}

export async function inspectTelegramWebhook(env: OpenChatEnv) {
  const result = await telegramCall<{
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    allowed_updates?: string[];
  }>(env, "getWebhookInfo", undefined, 1);
  return {
    url: result.url ?? "",
    pendingUpdateCount: result.pending_update_count ?? 0,
    lastErrorAt: result.last_error_date ? result.last_error_date * 1000 : null,
    lastError: result.last_error_message ?? null,
    allowedUpdates: result.allowed_updates ?? [],
  };
}

export async function inspectTelegramBusinessConnection(env: OpenChatEnv, id: string) {
  const result = await telegramCall<TelegramBusinessConnectionPayload>(env, "getBusinessConnection", { business_connection_id: id }, 1);
  const connection = normalizeTelegramBusinessConnection(result);
  if (!connection) throw new Error("Telegram returned an invalid business connection");
  return connection;
}
