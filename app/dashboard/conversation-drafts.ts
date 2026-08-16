export type ConversationDrafts = Record<number, string>;

export function conversationDraft(drafts: ConversationDrafts, conversationId: number | null) {
  return conversationId ? drafts[conversationId] ?? "" : "";
}

export function updateConversationDraft(drafts: ConversationDrafts, conversationId: number, value: string) {
  return { ...drafts, [conversationId]: value };
}

export function clearConversationDraft(drafts: ConversationDrafts, conversationId: number) {
  if (!(conversationId in drafts)) return drafts;
  const next = { ...drafts };
  delete next[conversationId];
  return next;
}
