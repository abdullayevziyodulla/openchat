import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dashboardCss = readFileSync(fileURLToPath(new URL("../app/dashboard/dashboard.css", import.meta.url)), "utf8");
const dashboardApp = readFileSync(fileURLToPath(new URL("../app/dashboard/dashboard-app.tsx", import.meta.url)), "utf8");

describe("dashboard visual baseline", () => {
  it("uses the blue OpenChat brand instead of the legacy green palette", () => {
    expect(dashboardCss).toContain("--oc-blue: #2563eb");
    expect(dashboardCss).not.toContain("--oc-green");
  });

  it("never renders dashboard copy below 12px", () => {
    const fontSizes = [...dashboardCss.matchAll(/font-size:\s*(\d+)px/g)].map((match) => Number(match[1]));
    expect(fontSizes.length).toBeGreaterThan(0);
    expect(fontSizes.filter((size) => size < 12)).toEqual([]);
  });

  it("stacks the shared page eyebrow, title, and description vertically", () => {
    expect(dashboardCss).toMatch(
      /\.page-header-copy\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
  });

  it("supports a persistent collapsible desktop sidebar without dropping mobile settings", () => {
    expect(dashboardApp).toContain('openchat-sidebar-collapsed');
    expect(dashboardApp).toContain('aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}');
    expect(dashboardCss).toMatch(/\.dashboard-shell\.sidebar-collapsed \.sidebar\s*\{[^}]*width:\s*76px;/s);
    expect(dashboardCss).toMatch(/\.sidebar nav\s*\{[^}]*grid-template-columns:\s*repeat\(4, 1fr\);/s);
    expect(dashboardCss).not.toContain(".sidebar nav button:last-child { display: none; }");
  });

  it("uses quiet selection backgrounds without decorative left-edge bars", () => {
    expect(dashboardCss).not.toMatch(/\.sidebar nav button\.active\s*\{[^}]*box-shadow:\s*inset/s);
    expect(dashboardCss).not.toMatch(/\.conversation-list > button\.active\s*\{[^}]*box-shadow:\s*inset/s);
  });

  it("does not invent a logo for the self-hosted workspace", () => {
    expect(dashboardApp).not.toContain('<span>O</span><b>Self-hosted');
    expect(dashboardCss).toMatch(/\.workspace-switcher\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
  });

  it("lets an administrator connect Telegram without editing environment files", () => {
    expect(dashboardApp).toContain('name="telegram-token"');
    expect(dashboardApp).toContain('name="telegram-public-url"');
    expect(dashboardApp).toContain("The token is encrypted before it is saved");
    expect(dashboardApp).not.toContain("TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET required");
  });

  it("explains and reports Telegram secretary mode", () => {
    expect(dashboardApp).toContain("Secretary Mode");
    expect(dashboardApp).toContain("Telegram Business");
    expect(dashboardApp).toContain("Chatbots");
  });

  it("keeps bot inbox and Secretary Mode inside one Telegram management flow", () => {
    expect(dashboardApp).toContain('className="telegram-capabilities"');
    expect(dashboardApp).toContain("Ways to receive messages");
    expect(dashboardApp).toContain("Connection settings");
    expect(dashboardApp).not.toContain('className="settings-section secretary-section"');
  });

  it("lets an administrator configure OpenRouter without editing environment files", () => {
    expect(dashboardApp).toContain('name="openrouter-api-key"');
    expect(dashboardApp).toContain('name="openrouter-model"');
    expect(dashboardApp).toContain("Load models");
    expect(dashboardApp).toContain('"/api/setup/ai/models"');
    expect(dashboardApp).toContain("Connect OpenRouter");
    expect(dashboardApp).toContain("OpenAI, Anthropic, Google, Meta, and others");
  });

  it("does not present a model as available before an AI provider is connected", () => {
    expect(dashboardApp).toContain('runtime?.ai.configured ? runtime.ai.model : "Not configured"');
    expect(dashboardApp).not.toContain('model: "gpt-4.1-mini"');
  });

  it("uses a searchable model picker instead of a native 400-item select menu", () => {
    expect(dashboardApp).toContain('role="combobox"');
    expect(dashboardApp).toContain('placeholder="Search models…"');
    expect(dashboardApp).toContain('role="listbox"');
    expect(dashboardApp).toContain("Model catalog unavailable");
    expect(dashboardApp).toContain("Auto Router still works");
    expect(dashboardApp).not.toContain('<select id="openrouter-model"');
  });

  it("lets administrators filter OpenRouter models by company", () => {
    expect(dashboardApp).toContain('className="model-provider-rail"');
    expect(dashboardApp).toContain('aria-label="Filter models by company"');
    expect(dashboardApp).toContain('"openai": "OpenAI"');
    expect(dashboardApp).toContain('"anthropic": "Anthropic"');
    expect(dashboardApp).toContain('"google": "Google"');
    expect(dashboardCss).toMatch(/\.model-picker-popover\s*\{[^}]*grid-template-columns:\s*96px minmax\(0, 1fr\);/s);
    expect(dashboardApp).toContain('className="model-option-copy"');
    expect(dashboardCss).toMatch(/\.model-options > button\s*\{[^}]*grid-template-columns:\s*32px minmax\(0, 1fr\) 18px;/s);
  });

  it("uses real AI company logos with a fallback for unknown providers", () => {
    expect(dashboardApp).toContain('@lobehub/icons-static-svg/icons/openai.svg?url');
    expect(dashboardApp).toContain('@lobehub/icons-static-svg/icons/anthropic.svg?url');
    expect(dashboardApp).toContain('@lobehub/icons-static-svg/icons/gemini-color.svg?url');
    expect(dashboardApp).toContain("function ProviderMark");
    expect(dashboardApp).toContain("AI_PROVIDER_LOGOS[aiProviderKey(id)]");
  });

  it("reserves icon space inside secret credential inputs", () => {
    expect(dashboardCss).toMatch(/\.field \.secret-input input\s*\{[^}]*padding:\s*0 44px 0 38px;/s);
  });

  it("includes a private assistant testing workspace", () => {
    expect(dashboardApp).toContain("Test assistant");
    expect(dashboardApp).toContain("New test session");
    expect(dashboardApp).toContain('"/api/assistant/test"');
  });

  it("uses one consistent top switch for Channels and AI assistant", () => {
    expect(dashboardApp).toContain('settings-layout ${tab === "ai" ? "assistant-mode" : ""}');
    expect(dashboardCss).toMatch(/\.settings-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
    expect(dashboardCss).toMatch(/\.settings-layout > aside\s*\{[^}]*flex-direction:\s*row;/s);
    expect(dashboardCss).not.toMatch(/\.settings-layout\s*\{[^}]*grid-template-columns:\s*180px/s);
  });

  it("preserves resolved settings state and never flashes a false disconnected form", () => {
    expect(dashboardApp).toContain('useState<TelegramSetup | null>(() => cachedTelegramSetup)');
    expect(dashboardApp).toContain('useState<"channels" | "ai" | "operations">(() => cachedSettingsTab)');
    expect(dashboardApp).toContain('telegram === null ? <ChannelSettingsLoading />');
  });

  it("keeps the assistant studio within the desktop viewport with its own builder scroll", () => {
    expect(dashboardApp).toContain('className="ai-builder-scroll"');
    expect(dashboardApp).toContain('className="ai-builder-footer"');
    expect(dashboardCss).toMatch(/\.assistant-builder-page\s*\{[^}]*height:\s*calc\(100vh - 64px\);[^}]*overflow:\s*hidden;/s);
    expect(dashboardCss).toMatch(/\.ai-builder-panel\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/s);
    expect(dashboardCss).toMatch(/\.ai-builder-scroll\s*\{[^}]*overflow-y:\s*auto;/s);
  });

  it("keeps customer messages on the left and operator messages on the right", () => {
    expect(dashboardCss).not.toContain(".message.customer, .message.you");
    expect(dashboardCss).toMatch(/\.message\.you\s*\{[^}]*margin-left:\s*auto;/s);
  });

  it("offers Telegram attachments and native message replies from the inbox", () => {
    expect(dashboardApp).toContain('aria-label="Attach photo or file"');
    expect(dashboardApp).toContain("Replying to");
    expect(dashboardApp).toContain("replyToMessageId");
    expect(dashboardApp).toContain("/attachment");
    expect(dashboardApp).not.toContain("Attachments are coming later");
  });

  it("lets operators improve a draft before sending it", () => {
    expect(dashboardApp).toContain('"/api/assistant/improve"');
    expect(dashboardApp).toContain("Improving…");
    expect(dashboardApp).not.toContain("<button disabled><WandSparkles");
  });

  it("keeps the inbox composer inside the viewport while messages scroll", () => {
    expect(dashboardCss).toMatch(/\.inbox-page\s*\{[^}]*overflow:\s*hidden;/s);
    expect(dashboardCss).toMatch(/\.chat-pane\s*\{[^}]*min-height:\s*0;/s);
    expect(dashboardCss).toMatch(/\.messages\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(dashboardApp).toContain('ref={messagesViewport} className="messages"');
    expect(dashboardApp).toContain("viewport.scrollTop = viewport.scrollHeight");
    expect(dashboardApp).toContain("onLoad={scrollMessagesToEnd}");
  });
});
