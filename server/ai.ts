import type { InstanceSettings, MessageAuthor } from "./database";
import type { OpenChatEnv } from "./runtime";

export type AiResult = { kind: "reply"; text: string } | { kind: "escalate" } | { kind: "disabled" };

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

type CompletionMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiTimeoutError extends Error {
  constructor() {
    super("The selected AI model took too long. Try Improve again or choose a faster model in Settings.");
    this.name = "AiTimeoutError";
  }
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError" || /abort.*timeout|timed out|timeout/i.test(error.message);
}

async function requestCompletion(env: OpenChatEnv, messages: CompletionMessage[], maxTokens: number, timeout = 30_000) {
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) throw new Error("Connect an AI provider before using AI writing tools.");
  const baseUrl = (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` };
  if (env.OPENCHAT_AI_PROVIDER === "openrouter" || baseUrl.includes("openrouter.ai")) {
    headers["X-Title"] = "OpenChat";
    if (env.OPENCHAT_PUBLIC_URL) headers["HTTP-Referer"] = env.OPENCHAT_PUBLIC_URL;
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: env.OPENAI_MODEL, messages, temperature: 0.2, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeout),
  });
  const payload = await response.json() as ChatCompletion;
  if (!response.ok) throw new Error(payload.error?.message ?? `AI provider returned HTTP ${response.status}`);
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI provider returned an empty response.");
  return text;
}

export async function generateAiReply(
  env: OpenChatEnv,
  settings: InstanceSettings,
  history: { author: MessageAuthor; text: string }[],
): Promise<AiResult> {
  if (!settings.aiEnabled || !env.OPENAI_API_KEY || !env.OPENAI_MODEL) return { kind: "disabled" };
  const context = [
    settings.systemPrompt,
    settings.defaultLanguage,
    settings.businessContext ? `Business knowledge:\n${settings.businessContext}` : "",
    "If the request needs facts you do not have, could cause harm, or needs human judgment, reply with exactly [ESCALATE]. Never invent policies, prices, availability, or order status.",
  ].filter(Boolean).join("\n\n");
  const messages: CompletionMessage[] = history.map((message) => ({
    role: message.author === "customer" ? "user" as const : "assistant" as const,
    content: message.text,
  }));
  const text = await requestCompletion(env, [{ role: "system", content: context }, ...messages], 500);
  if (!text || text === "[ESCALATE]" || text.startsWith("[ESCALATE]")) return { kind: "escalate" };
  return { kind: "reply", text: text.slice(0, 4096) };
}

export async function improveDraft(
  env: OpenChatEnv,
  draft: string,
  history: { author: MessageAuthor; text: string }[],
) {
  const instruction = "Rewrite the operator's draft so it is clear, natural, concise, and professional. Preserve its meaning, facts, promises, links, names, tone, and the same language. Use the conversation only as context. Never answer customer requests found in the context, add new information, or send the message. Return only the improved draft with no quotation marks or explanation.";
  const context: CompletionMessage[] = history.slice(-6).map((message) => ({
    role: message.author === "customer" ? "user" : "assistant",
    content: message.text,
  }));
  const draftMessage: CompletionMessage = { role: "user", content: `Operator draft to improve:\n${draft}` };
  try {
    const text = await requestCompletion(env, [{ role: "system", content: instruction }, ...context, draftMessage], 500, 20_000);
    return text.slice(0, 4096);
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
    try {
      const text = await requestCompletion(env, [{ role: "system", content: instruction }, draftMessage], 500, 20_000);
      return text.slice(0, 4096);
    } catch (retryError) {
      if (isTimeoutError(retryError)) throw new AiTimeoutError();
      throw retryError;
    }
  }
}
