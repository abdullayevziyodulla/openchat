import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential, generateWebhookSecret, openRouterErrorMessage, telegramErrorMessage } from "./credentials";

const encryptionSecret = "a-session-secret-that-is-longer-than-thirty-two-characters";

describe("stored integration credentials", () => {
  it("encrypts credentials with a fresh nonce and decrypts them", async () => {
    const first = await encryptCredential("123456:telegram-token", encryptionSecret);
    const second = await encryptCredential("123456:telegram-token", encryptionSecret);

    expect(first).not.toContain("telegram-token");
    expect(first).not.toBe(second);
    expect(await decryptCredential(first, encryptionSecret)).toBe("123456:telegram-token");
  });

  it("generates a Telegram-compatible webhook secret", () => {
    expect(generateWebhookSecret()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("turns Telegram's unauthorized response into an actionable message", () => {
    expect(telegramErrorMessage(new Error("Unauthorized"))).toBe("Telegram rejected this bot token. Copy a fresh token from @BotFather and try again.");
  });

  it("turns OpenRouter authentication errors into an actionable message", () => {
    expect(openRouterErrorMessage(new Error("OpenRouter returned HTTP 401"))).toBe("OpenRouter rejected this API key. Create or copy a valid key and try again.");
  });
});
