export function matchAutomationKeywords(text: string, keywords: string[], wholeWord = true) {
  const input = text.normalize("NFKC").trim().toLocaleLowerCase();
  if (!input) return null;
  for (const original of keywords) {
    const keyword = original.normalize("NFKC").trim().toLocaleLowerCase();
    if (!keyword) continue;
    if (!wholeWord && input.includes(keyword)) return original;
    if (wholeWord) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(input)) return original;
    }
  }
  return null;
}

export function renderAutomationMessage(template: string, username?: string | null) {
  return template.replaceAll("{username}", username?.trim() || "there").trim();
}
