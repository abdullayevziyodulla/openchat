import { describe, expect, it, vi } from "vitest";
import { normalizeTelegramBusinessConnection, normalizeTelegramBusinessMessage, normalizeTelegramUpdate, sendTelegramMessage } from "./telegram";

describe("normalizeTelegramUpdate", () => {
  it("normalizes a private text message", () => {
    expect(normalizeTelegramUpdate({
      update_id: 91,
      message: {
        message_id: 7,
        date: 1_700_000_000,
        text: "  Salom  ",
        from: { id: 42, is_bot: false, first_name: "Dilnoza", last_name: "R." , username: "dilnoza" },
        chat: { id: 42, type: "private" },
      },
    })).toMatchObject({ updateId: "91", messageId: "42:7", chatId: "42", senderId: "42", displayName: "Dilnoza R.", username: "dilnoza", text: "Salom", timestamp: 1_700_000_000_000 });
  });

  it("normalizes photos without captions and native reply targets", () => {
    expect(normalizeTelegramUpdate({
      update_id: 92,
      message: {
        message_id: 8,
        date: 1_700_000_001,
        photo: [
          { file_id: "small-photo", width: 90, height: 90, file_size: 1200 },
          { file_id: "large-photo", width: 1280, height: 720, file_size: 240000 },
        ],
        reply_to_message: { message_id: 7 },
        from: { id: 42, is_bot: false, first_name: "Dilnoza" },
        chat: { id: 42, type: "private" },
      },
    })).toMatchObject({
      text: "Photo",
      replyToProviderMessageId: "7",
      attachment: { type: "photo", fileId: "large-photo", width: 1280, height: 720 },
    });
  });

  it("ignores bot, non-message, and empty updates", () => {
    expect(normalizeTelegramUpdate({ update_id: 1 })).toBeNull();
    expect(normalizeTelegramUpdate({ update_id: 2, message: { message_id: 1, text: "", from: { id: 1 }, chat: { id: 1 } } })).toBeNull();
    expect(normalizeTelegramUpdate({ update_id: 3, message: { message_id: 1, text: "hello", from: { id: 1, is_bot: true }, chat: { id: 1 } } })).toBeNull();
  });
});

describe("Telegram Business updates", () => {
  it("normalizes a connected business account", () => {
    expect(normalizeTelegramBusinessConnection({
      update_id: 92,
      business_connection: {
        id: "business-123",
        user: { id: 900, first_name: "Test", last_name: "User", username: "test_user" },
        user_chat_id: 900,
        date: 1_700_000_000,
        rights: { can_reply: true },
        is_enabled: true,
      },
    })).toMatchObject({
      id: "business-123",
      accountUserId: "900",
      displayName: "Test User",
      username: "test_user",
      canReply: true,
      enabled: true,
    });
  });

  it("normalizes a customer message sent to the business profile", () => {
    expect(normalizeTelegramBusinessMessage({
      update_id: 93,
      business_message: {
        business_connection_id: "business-123",
        message_id: 8,
        date: 1_700_000_001,
        text: "  Are you open?  ",
        from: { id: 42, is_bot: false, first_name: "Dilnoza", username: "dilnoza" },
        chat: { id: 42, type: "private" },
      },
    }, "900")).toMatchObject({
      channel: "telegram_business",
      businessConnectionId: "business-123",
      updateId: "93",
      messageId: "business-123:42:8",
      chatId: "42",
      senderId: "42",
      text: "Are you open?",
    });
  });

  it("ignores messages sent by the business owner or connected bot", () => {
    const base = {
      update_id: 94,
      business_message: {
        business_connection_id: "business-123",
        message_id: 9,
        text: "outgoing",
        from: { id: 900, is_bot: false, first_name: "Owner" },
        chat: { id: 42, type: "private" },
      },
    };
    expect(normalizeTelegramBusinessMessage(base, "900")).toBeNull();
    expect(normalizeTelegramBusinessMessage({
      ...base,
      business_message: { ...base.business_message, from: { id: 42 }, sender_business_bot: { id: 1, is_bot: true } },
    }, "900")).toBeNull();
  });
});

describe("Telegram delivery", () => {
  it("does not automatically repeat an ambiguous outbound send failure", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("fetch failed after request upload"); });
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendTelegramMessage({ TELEGRAM_BOT_TOKEN: "123:token" } as never, "42", "Hello")).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
