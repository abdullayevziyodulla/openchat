import type { OpenChatEnv } from "./runtime";

const SESSION_COOKIE = "openchat_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function base64Url(buffer: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function loginRateKey(request: Request) {
  const address = request.headers.get("cf-connecting-ip")?.trim() || `local:${new URL(request.url).hostname}`;
  return base64Url(await crypto.subtle.digest("SHA-256", bytes(`openchat:login:${address}`)));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(await crypto.subtle.sign("HMAC", key, bytes(value)));
}

async function constantTimeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([crypto.subtle.digest("SHA-256", bytes(left)), crypto.subtle.digest("SHA-256", bytes(right))]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function parseCookies(request: Request) {
  return Object.fromEntries((request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

export function authenticationReady(env: OpenChatEnv) {
  return Boolean(env.OPENCHAT_ADMIN_PASSWORD && env.OPENCHAT_ADMIN_PASSWORD.length >= 12 && env.OPENCHAT_SESSION_SECRET && env.OPENCHAT_SESSION_SECRET.length >= 32);
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

export function configError() {
  return json({ error: "Server authentication is not configured. Set a 12+ character OPENCHAT_ADMIN_PASSWORD and a 32+ character OPENCHAT_SESSION_SECRET." }, 503);
}

export async function createSession(request: Request, env: OpenChatEnv, password: string) {
  if (!authenticationReady(env)) return configError();
  if (!await constantTimeEqual(password, env.OPENCHAT_ADMIN_PASSWORD!)) return json({ error: "Incorrect password." }, 401);
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = `${expires}.${await sign(`openchat:${expires}`, env.OPENCHAT_SESSION_SECRET!)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return json({ authenticated: true }, 200, { "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}` });
}

export function clearSession(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return json({ authenticated: false }, 200, { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}` });
}

export async function isAuthenticated(request: Request, env: OpenChatEnv) {
  if (env.OPENCHAT_TRUST_PLATFORM_AUTH === "true" && request.headers.get("oai-authenticated-user-id")) return true;
  if (!authenticationReady(env)) return false;
  const raw = parseCookies(request)[SESSION_COOKIE];
  if (!raw) return false;
  const [expiresText, signature] = raw.split(".");
  const expires = Number(expiresText);
  if (!expires || expires <= Math.floor(Date.now() / 1000) || !signature) return false;
  return constantTimeEqual(signature, await sign(`openchat:${expires}`, env.OPENCHAT_SESSION_SECRET!));
}

export function acceptsMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return null;
  try { return await request.json() as T; } catch { return null; }
}
