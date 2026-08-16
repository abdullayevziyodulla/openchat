import { describe, expect, it } from "vitest";
import { clearConversationDraft, conversationDraft, updateConversationDraft } from "./conversation-drafts";

describe("conversation drafts", () => {
  it("keeps each conversation's draft isolated while switching chats", () => {
    let drafts = updateConversationDraft({}, 1, "draft for chat one");

    expect(conversationDraft(drafts, 2)).toBe("");

    drafts = updateConversationDraft(drafts, 2, "draft for chat two");

    expect(conversationDraft(drafts, 1)).toBe("draft for chat one");
    expect(conversationDraft(drafts, 2)).toBe("draft for chat two");
  });

  it("clears only the draft that was sent", () => {
    let drafts = updateConversationDraft({}, 1, "send this");
    drafts = updateConversationDraft(drafts, 2, "keep this");

    drafts = clearConversationDraft(drafts, 1);

    expect(conversationDraft(drafts, 1)).toBe("");
    expect(conversationDraft(drafts, 2)).toBe("keep this");
  });
});
