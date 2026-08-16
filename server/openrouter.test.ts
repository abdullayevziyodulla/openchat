import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectOpenRouterModel, listOpenRouterModels } from "./openrouter";

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter model IDs", () => {
  it("accepts live catalog aliases prefixed with a tilde", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://openrouter.ai/api/v1/model/~deepseek/deepseek-v4-flash-latest");
      return Response.json({ data: { id: "~deepseek/deepseek-v4-flash-latest", name: "DeepSeek V4 Flash Latest" } });
    }));

    await expect(inspectOpenRouterModel("test-key", "~deepseek/deepseek-v4-flash-latest")).resolves.toEqual({
      id: "~deepseek/deepseek-v4-flash-latest",
      name: "DeepSeek V4 Flash Latest",
    });
  });

  it("falls back to the public catalog when the account-filtered catalog is unavailable", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/models/user")) return Response.json({ error: { message: "Catalog unavailable" } }, { status: 503 });
      if (url.endsWith("/models")) return Response.json({ data: [{ id: "deepseek/deepseek-chat", name: "DeepSeek Chat", context_length: 128_000 }] });
      return Response.json({}, { status: 404 });
    }));

    await expect(listOpenRouterModels("test-key")).resolves.toContainEqual({
      id: "deepseek/deepseek-chat",
      name: "DeepSeek Chat",
      contextLength: 128_000,
    });
    expect(calls).toEqual([
      "https://openrouter.ai/api/v1/models/user",
      "https://openrouter.ai/api/v1/models",
    ]);
  });
});
