import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAiReply, improveDraft } from "./ai";
import type { InstanceSettings } from "./database";
import type { OpenChatEnv } from "./runtime";

const settings: InstanceSettings = {
  aiEnabled: true,
  systemPrompt: "Be helpful.",
  businessContext: "Open every day.",
  defaultLanguage: "Reply in the customer's language.",
};

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter AI delivery", () => {
  it("uses the selected OpenRouter model and attribution headers", async () => {
    let request: { url: string; headers: Headers; body: Record<string, unknown> } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      request = { url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
      return Response.json({ choices: [{ message: { content: "We are open." } }] });
    }));

    const result = await generateAiReply({
      OPENAI_API_KEY: "sk-or-v1-secret",
      OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      OPENAI_MODEL: "openrouter/auto",
      OPENCHAT_AI_PROVIDER: "openrouter",
      OPENCHAT_PUBLIC_URL: "https://chat.example",
    } as OpenChatEnv, settings, [{ author: "customer", text: "Are you open?" }]);

    expect(result).toEqual({ kind: "reply", text: "We are open." });
    expect(request?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request?.headers.get("authorization")).toBe("Bearer sk-or-v1-secret");
    expect(request?.headers.get("http-referer")).toBe("https://chat.example");
    expect(request?.headers.get("x-title")).toBe("OpenChat");
    expect(request?.body).toMatchObject({ model: "openrouter/auto" });
  });

  it("improves an operator draft without changing its intent or language", async () => {
    let providerBody: { messages?: { role: string; content: string }[] } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      providerBody = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: "Salom! Albatta, hozir tekshirib beraman." } }] });
    }));

    const result = await improveDraft({
      OPENAI_API_KEY: "provider-key",
      OPENAI_BASE_URL: "https://provider.example/v1",
      OPENAI_MODEL: "test-model",
    } as OpenChatEnv, "salom ha tekshiraman", [{ author: "customer", text: "Bugun joy bormi?" }]);

    expect(result).toBe("Salom! Albatta, hozir tekshirib beraman.");
    expect(providerBody?.messages?.[0].content.toLowerCase()).toContain("preserve its meaning");
    expect(providerBody?.messages?.[0].content).toContain("same language");
    expect(providerBody?.messages?.at(-1)?.content).toContain("salom ha tekshiraman");
  });

  it("retries an improvement once when the provider times out", async () => {
    const provider = vi.fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Hi, how can I help you?" } }] }));
    vi.stubGlobal("fetch", provider);

    const result = await improveDraft({
      OPENAI_API_KEY: "provider-key",
      OPENAI_BASE_URL: "https://provider.example/v1",
      OPENAI_MODEL: "test-model",
    } as OpenChatEnv, "hi how cn you heping", [{ author: "customer", text: "Hello" }]);

    expect(result).toBe("Hi, how can I help you?");
    expect(provider).toHaveBeenCalledTimes(2);
  });
});
