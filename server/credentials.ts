const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CREDENTIAL_VERSION = "v1";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function credentialKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`openchat:credentials:${secret}`));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(value: string, secret: string) {
  if (secret.length < 32) throw new Error("Credential encryption requires a 32+ character OPENCHAT_SESSION_SECRET.");
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await credentialKey(secret), encoder.encode(value));
  return `${CREDENTIAL_VERSION}.${base64Url(nonce)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptCredential(value: string, secret: string) {
  const [version, nonce, encrypted] = value.split(".");
  if (version !== CREDENTIAL_VERSION || !nonce || !encrypted) throw new Error("Stored credential format is invalid.");
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(nonce) }, await credentialKey(secret), fromBase64Url(encrypted));
    return decoder.decode(decrypted);
  } catch {
    throw new Error("Stored credentials could not be decrypted. Reconnect the integration.");
  }
}

export function generateWebhookSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function telegramErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Telegram setup failed.";
  if (/unauthorized/i.test(message)) return "Telegram rejected this bot token. Copy a fresh token from @BotFather and try again.";
  if (/https|webhook.*url|bad webhook/i.test(message)) return "Telegram requires a public HTTPS address. Enter the public URL for this OpenChat installation.";
  if (/timeout|timed out|fetch failed|network/i.test(message)) return "OpenChat could not reach Telegram. Check the server connection and try again.";
  return message;
}

export function openRouterErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "OpenRouter setup failed.";
  if (/401|unauthorized|invalid.*key/i.test(message)) return "OpenRouter rejected this API key. Create or copy a valid key and try again.";
  if (/404|model.*not found/i.test(message)) return "OpenRouter could not find that model. Enter a valid model ID such as openrouter/auto.";
  if (/timeout|timed out|fetch failed|network/i.test(message)) return "OpenChat could not reach OpenRouter. Check the server connection and try again.";
  return message;
}

export function normalizePublicUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error();
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Enter the public HTTPS address where Telegram can reach this OpenChat installation.");
  }
}

export async function resolveTelegramEnvironment(store: OpenChatStore, env: OpenChatEnv) {
  const stored = await store.getTelegramCredentials();
  if (!stored) {
    return {
      env,
      configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET),
      publicUrl: env.OPENCHAT_PUBLIC_URL ?? "",
      source: env.TELEGRAM_BOT_TOKEN ? "environment" as const : "none" as const,
    };
  }
  if (!env.OPENCHAT_SESSION_SECRET) throw new Error("Stored credentials cannot be opened because OPENCHAT_SESSION_SECRET is missing.");
  const [botToken, webhookSecret] = await Promise.all([
    decryptCredential(stored.encryptedBotToken, env.OPENCHAT_SESSION_SECRET),
    decryptCredential(stored.encryptedWebhookSecret, env.OPENCHAT_SESSION_SECRET),
  ]);
  const publicUrl = stored.publicUrl || env.OPENCHAT_PUBLIC_URL || "";
  return {
    env: { ...env, TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_WEBHOOK_SECRET: webhookSecret, OPENCHAT_PUBLIC_URL: publicUrl },
    configured: true,
    publicUrl,
    source: "dashboard" as const,
  };
}

export async function resolveAiEnvironment(store: OpenChatStore, env: OpenChatEnv) {
  const stored = await store.getAiCredentials();
  if (!stored) {
    const apiKey = env.OPENAI_API_KEY?.trim();
    const model = env.OPENAI_MODEL?.trim();
    const configured = Boolean(apiKey && model);
    const provider = configured
      ? env.OPENCHAT_AI_PROVIDER ?? (env.OPENAI_BASE_URL?.includes("openrouter.ai") ? "openrouter" : "environment")
      : "none";
    return {
      env,
      configured,
      provider,
      model: configured ? model! : "",
      source: configured ? "environment" as const : "none" as const,
    };
  }
  if (!env.OPENCHAT_SESSION_SECRET) throw new Error("Stored credentials cannot be opened because OPENCHAT_SESSION_SECRET is missing.");
  const apiKey = await decryptCredential(stored.encryptedApiKey, env.OPENCHAT_SESSION_SECRET);
  return {
    env: {
      ...env,
      OPENAI_API_KEY: apiKey,
      OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      OPENAI_MODEL: stored.model,
      OPENCHAT_AI_PROVIDER: "openrouter",
    },
    configured: true,
    provider: "openrouter",
    model: stored.model,
    source: "dashboard" as const,
  };
}
import type { OpenChatStore } from "./database";
import type { OpenChatEnv } from "./runtime";
