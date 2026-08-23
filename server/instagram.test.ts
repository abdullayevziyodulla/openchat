import { describe, expect, it } from "vitest";
import { instagramAuthorizationUrl, parseInstagramInboundMessages, parseInstagramPostbacks, verifyInstagramWebhookSignature } from "./instagram";
import type { OpenChatEnv } from "./runtime";

async function signature(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `sha256=${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("Instagram OAuth", () => {
  it("uses Instagram Login with only the required inbox and comment scopes", () => {
    const url = new URL(instagramAuthorizationUrl({ INSTAGRAM_APP_ID: "123", INSTAGRAM_APP_SECRET: "secret" } as OpenChatEnv, "https://chat.example/api/instagram/callback", "state-1"));
    expect(url.origin + url.pathname).toBe("https://api.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
    ]);
  });
});

describe("Instagram webhooks", () => {
  it("verifies the raw request body against either configured Meta app secret", async () => {
    const payload = JSON.stringify({ object: "instagram", entry: [] });
    const env = { INSTAGRAM_APP_SECRET: "instagram-secret", FACEBOOK_APP_SECRET: "facebook-secret" } as OpenChatEnv;
    expect(await verifyInstagramWebhookSignature(env, payload, await signature(payload, "instagram-secret"))).toBe(true);
    expect(await verifyInstagramWebhookSignature(env, payload, await signature(payload, "facebook-secret"))).toBe(true);
    expect(await verifyInstagramWebhookSignature(env, payload, "sha256=wrong")).toBe(false);
    expect(await verifyInstagramWebhookSignature(env, payload, null)).toBe(false);
  });

  it("normalizes text, media-only messages, timestamps, and reply targets", () => {
    expect(parseInstagramInboundMessages({
      object: "instagram",
      entry: [{
        id: "ig-business-1",
        time: 1_700_000_000_000,
        messaging: [
          { sender: { id: "customer-1" }, timestamp: 1_700_000_000_001, message: { mid: "mid.1", text: "  Hello  ", reply_to: { mid: "mid.0" } } },
          { sender: { id: "customer-2" }, message: { mid: "mid.2", attachments: [{ type: "image", payload: { url: "https://cdn.example/photo.jpg" } }] } },
        ],
      }],
    })).toEqual([
      { instagramUserId: "ig-business-1", senderIgsid: "customer-1", messageId: "mid.1", text: "Hello", timestamp: 1_700_000_000_001, replyToMessageId: "mid.0", attachment: undefined, isEcho: false },
      { instagramUserId: "ig-business-1", senderIgsid: "customer-2", messageId: "mid.2", text: "Photo", timestamp: 1_700_000_000_000, replyToMessageId: undefined, attachment: { type: "photo", url: "https://cdn.example/photo.jpg", providerMediaId: undefined }, isEcho: false },
    ]);
  });

  it("normalizes echoes for reconciliation and ignores deleted or unsupported messages", () => {
    const messages = [
      { sender: { id: "account" }, recipient: { id: "customer" }, message: { mid: "echo", text: "x", is_echo: true } },
      { sender: { id: "customer" }, message: { mid: "deleted", text: "x", is_deleted: true } },
      { sender: { id: "customer" }, message: { mid: "unsupported", text: "x", is_unsupported: true } },
      { sender: { id: "account" }, recipient: { id: "customer-2" }, message: { mid: "self", text: "sent" } },
    ];
    expect(parseInstagramInboundMessages({ object: "instagram", entry: [{ id: "account", messaging: messages }] })).toEqual([
      { instagramUserId: "account", senderIgsid: "customer", messageId: "echo", text: "x", timestamp: expect.any(Number), replyToMessageId: undefined, attachment: undefined, isEcho: true },
      { instagramUserId: "account", senderIgsid: "customer-2", messageId: "self", text: "sent", timestamp: expect.any(Number), replyToMessageId: undefined, attachment: undefined, isEcho: true },
    ]);
  });

  it("normalizes postback button taps and ignores self-originated taps", () => {
    expect(parseInstagramPostbacks({
      object: "instagram",
      entry: [{ id: "account", time: 50, messaging: [
        { sender: { id: "customer" }, timestamp: 51, postback: { mid: "tap-1", payload: "openchat:reveal:9" } },
        { sender: { id: "account" }, postback: { payload: "ignore" } },
      ] }],
    })).toEqual([{ instagramUserId: "account", senderIgsid: "customer", payload: "openchat:reveal:9", messageId: "tap-1", timestamp: 51 }]);
  });
});
