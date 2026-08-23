"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import anthropicLogo from "@lobehub/icons-static-svg/icons/anthropic.svg?url";
import bytedanceLogo from "@lobehub/icons-static-svg/icons/bytedance-color.svg?url";
import cohereLogo from "@lobehub/icons-static-svg/icons/cohere-color.svg?url";
import deepseekLogo from "@lobehub/icons-static-svg/icons/deepseek-color.svg?url";
import geminiLogo from "@lobehub/icons-static-svg/icons/gemini-color.svg?url";
import groqLogo from "@lobehub/icons-static-svg/icons/groq.svg?url";
import huggingfaceLogo from "@lobehub/icons-static-svg/icons/huggingface-color.svg?url";
import liquidLogo from "@lobehub/icons-static-svg/icons/liquid.svg?url";
import metaLogo from "@lobehub/icons-static-svg/icons/meta-color.svg?url";
import minimaxLogo from "@lobehub/icons-static-svg/icons/minimax-color.svg?url";
import mistralLogo from "@lobehub/icons-static-svg/icons/mistral-color.svg?url";
import moonshotLogo from "@lobehub/icons-static-svg/icons/moonshot.svg?url";
import nvidiaLogo from "@lobehub/icons-static-svg/icons/nvidia-color.svg?url";
import openaiLogo from "@lobehub/icons-static-svg/icons/openai.svg?url";
import openrouterLogo from "@lobehub/icons-static-svg/icons/openrouter-color.svg?url";
import perplexityLogo from "@lobehub/icons-static-svg/icons/perplexity-color.svg?url";
import qwenLogo from "@lobehub/icons-static-svg/icons/qwen-color.svg?url";
import stepfunLogo from "@lobehub/icons-static-svg/icons/stepfun-color.svg?url";
import togetherLogo from "@lobehub/icons-static-svg/icons/together-color.svg?url";
import upstageLogo from "@lobehub/icons-static-svg/icons/upstage-color.svg?url";
import xaiLogo from "@lobehub/icons-static-svg/icons/xai.svg?url";
import zhipuLogo from "@lobehub/icons-static-svg/icons/zhipu-color.svg?url";
import {
  AlertTriangle, ArrowLeft, Bell, Bot, Check, ChevronLeft, ChevronRight, ContactRound, Eye, EyeOff, FileText, Inbox as InboxIcon,
  KeyRound, LayoutDashboard, LogOut, MoreHorizontal, Paperclip, RefreshCw, Reply, Search, Send,
  Settings as SettingsIcon, ShieldCheck, WandSparkles, X,
} from "lucide-react";
import { clearConversationDraft, conversationDraft, type ConversationDrafts, updateConversationDraft } from "./conversation-drafts";

type View = "overview" | "inbox" | "contacts" | "automations" | "settings";
type Channel = "telegram" | "telegram_business" | "instagram";
type Mode = "AI_ACTIVE" | "ESCALATED" | "HUMAN_ACTIVE";
type Status = "AI handling" | "Needs you" | "Human";
type Conversation = {
  id: number;
  name: string;
  username: string | null;
  initials: string;
  preview: string;
  time: string;
  unread: number;
  status: Status;
  mode: Mode;
  channel: Channel;
  stage: string;
  lastMessageAt: number;
};
type MessageAttachment = { type: "photo" | "document" | "video" | "video_note" | "audio" | "voice" | "animation" | "sticker"; fileName?: string; mimeType?: string; fileSize?: number; width?: number; height?: number };
type ApiMessage = { id: number; author: "customer" | "ai" | "human"; text: string; attachment: MessageAttachment | null; replyToId: number | null; replyToText: string | null; replyToAuthor: "customer" | "ai" | "human" | null; status: string; deliveryError: string | null; createdAt: number };
type Message = ApiMessage & { from: "customer" | "ai" | "you"; time: string };
type OperationCounts = { failedEvents: number; failedAiJobs: number; pendingWork: number; failedMessages: number; failedAutomations: number; pendingAutomations: number };
type Runtime = { database: boolean; telegram: { configured: boolean }; instagram?: { appConfigured: boolean; connected: number; healthy: number }; ai: { configured: boolean; provider?: string; model: string }; operations?: OperationCounts };
type SettingsValue = { aiEnabled: boolean; systemPrompt: string; businessContext: string; defaultLanguage: string };
type TelegramSetup = {
  configured: boolean;
  source: "dashboard" | "environment" | "none";
  publicUrl: string;
  bot?: { username?: string; first_name?: string; can_connect_to_business?: boolean };
  webhook?: { url: string; pendingUpdateCount: number; lastErrorAt: number | null; lastError: string | null; allowedUpdates: string[] };
  businessConnection?: {
    connected: boolean;
    enabled: boolean;
    canReply: boolean;
    displayName: string;
    username?: string;
  } | null;
  error?: string;
};
type AiSetup = {
  configured: boolean;
  source: "dashboard" | "environment" | "none";
  provider: string;
  model: string;
  modelName?: string;
  key?: { label: string; limitRemaining: number | null; freeTier: boolean };
  error?: string;
};
type AiModel = { id: string; name: string; contextLength: number | null };
type InstagramSetup = {
  appConfigured: boolean;
  callbackUrl: string;
  webhookUrl: string;
  accounts: Array<{
    id: number;
    instagramUserId: string;
    username: string;
    displayName: string | null;
    profilePictureUrl: string | null;
    tokenExpiresAt: number | null;
    webhookSubscribed: boolean;
    lastError: string | null;
  }>;
};
type InstagramAutomation = {
  id: number; instagramAccountId: number; accountUsername: string; name: string; triggerType: "comment" | "dm";
  postId: string | null; matchAnyPost: boolean; matchAnyText: boolean; keywords: string[]; wholeWordMatch: boolean;
  privateReplyMessage: string; openingDmEnabled: boolean; openingDmMessage: string | null; openingDmButtonLabel: string | null;
  linkButtonLabel: string | null; requireFollow: boolean; followPromptMessage: string | null; followPromptButtonLabel: string | null;
  followUpEnabled: boolean; followUpMessage: string | null; followUpDelayMinutes: number; pendingNextReel: boolean;
  trackedLinks: Array<{ id: number; slug: string; label: string; destinationUrl: string; position: number }>;
  publicReplyEnabled: boolean; publicReplyMessage: string | null; active: boolean; updatedAt: number;
};
type InstagramAutomationAnalytics = { automationId: number; name: string; accountUsername: string; runs: number; privateReplies: number; reveals: number; publicReplies: number; followUps: number; failures: number; clicks: number };
type InstagramMediaItem = { id: string; mediaType?: string; mediaProductType?: string; timestamp?: string; permalink?: string };
type OperationsValue = {
  events: { id: number; provider: string; externalId: string; status: string; attempts: number; lastError: string | null; receivedAt: number }[];
  aiJobs: { conversationId: number; conversationName: string; status: string; attempts: number; lastError: string | null; updatedAt: number }[];
  failedMessages: { id: number; conversationId: number; conversationName: string; body: string; attempts: number; lastError: string | null; createdAt: number }[];
  automationRuns: { id: number; automationName: string; accountUsername: string; triggerType: "comment" | "dm"; subjectUsername: string | null; status: string; attempts: number; privateReplySentAt: number | null; publicReplySentAt: number | null; lastError: string | null; updatedAt: number }[];
  counts: OperationCounts;
};

// Settings is mounted only while its page is visible. Keep the last resolved,
// non-secret view state in memory so returning to the page cannot regress to a
// false "not connected" state while the background refresh runs.
let cachedSettingsTab: "channels" | "ai" | "operations" = "channels";
let cachedSettingsValue: SettingsValue | null = null;
let cachedTelegramSetup: TelegramSetup | null = null;
let cachedInstagramSetup: InstagramSetup | null = null;
let cachedAiSetup: AiSetup | null = null;

const AI_PROVIDER_NAMES: Record<string, string> = { "openrouter": "OpenRouter", "openai": "OpenAI", "anthropic": "Anthropic", "google": "Google", "meta-llama": "Meta", "deepseek": "DeepSeek", "qwen": "Qwen", "mistralai": "Mistral", "x-ai": "xAI", "moonshotai": "Moonshot", "cohere": "Cohere", "perplexity": "Perplexity", "nvidia": "NVIDIA", "bytedance-seed": "ByteDance", "upstage": "Upstage", "liquid": "Liquid AI", "togethercomputer": "Together AI", "groq": "Groq", "huggingfaceh4": "Hugging Face", "minimax": "MiniMax", "stepfun": "StepFun", "z-ai": "Z.ai" };
const AI_PROVIDER_LOGOS: Record<string, string> = { "openrouter": openrouterLogo, "openai": openaiLogo, "anthropic": anthropicLogo, "google": geminiLogo, "meta-llama": metaLogo, "deepseek": deepseekLogo, "qwen": qwenLogo, "mistralai": mistralLogo, "x-ai": xaiLogo, "moonshotai": moonshotLogo, "cohere": cohereLogo, "perplexity": perplexityLogo, "nvidia": nvidiaLogo, "bytedance-seed": bytedanceLogo, "upstage": upstageLogo, "liquid": liquidLogo, "togethercomputer": togetherLogo, "groq": groqLogo, "huggingfaceh4": huggingfaceLogo, "minimax": minimaxLogo, "stepfun": stepfunLogo, "z-ai": zhipuLogo };

function aiProviderKey(id: string) { return id.split("/")[0].replace(/^~/, ""); }
function aiProviderName(id: string) {
  const key = aiProviderKey(id);
  return AI_PROVIDER_NAMES[key] ?? key.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function ProviderMark({ id }: { id: string }) {
  const logo = AI_PROVIDER_LOGOS[aiProviderKey(id)];
  return <span className={`model-provider-mark ${logo ? "has-logo" : ""}`}>{logo ? <Image src={logo} alt="" width={20} height={20} /> : aiProviderName(id).slice(0, 2).toUpperCase()}</span>;
}

class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  return payload;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function statusFor(mode: Mode): Status {
  return mode === "AI_ACTIVE" ? "AI handling" : mode === "ESCALATED" ? "Needs you" : "Human";
}

function normalizeConversation(row: Omit<Conversation, "initials" | "time" | "status">): Conversation {
  return { ...row, initials: initials(row.name), time: relativeTime(row.lastMessageAt), status: statusFor(row.mode) };
}

function presentMessages(messages: ApiMessage[]): Message[] {
  return messages.map((message) => ({
    ...message,
    from: message.author === "human" ? "you" : message.author,
    time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
}

const nav = [
  { id: "overview" as View, label: "Overview", icon: LayoutDashboard },
  { id: "inbox" as View, label: "Inbox", icon: InboxIcon },
  { id: "contacts" as View, label: "Contacts", icon: ContactRound },
  { id: "automations" as View, label: "Automations", icon: WandSparkles },
];

function ChannelLogo({ channel, size = 20 }: { channel: Channel; size?: number }) {
  const label = channelLabel(channel);
  return <Image className="channel-logo" src={`/icons/${channel === "telegram_business" ? "telegram" : channel}.svg`} alt={label} width={size} height={size} />;
}

function channelLabel(channel: Channel) {
  if (channel === "telegram_business") return "Telegram Business";
  return channel === "telegram" ? "Telegram bot" : "Instagram";
}

export function DashboardApp() {
  const [auth, setAuth] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<ConversationDrafts>({});
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2500);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const result = await api<{ conversations: Omit<Conversation, "initials" | "time" | "status">[] }>("/api/conversations");
      const rows = result.conversations.map(normalizeConversation);
      setConversations(rows);
      setSelected((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setAuth("signed-out");
      else flash(error instanceof Error ? error.message : "Could not load conversations");
    }
  }, [flash]);

  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      const result = await api<{ messages: ApiMessage[] }>(`/api/conversations/${conversationId}/messages`);
      setMessages(presentMessages(result.messages));
    } catch (error) { flash(error instanceof Error ? error.message : "Could not load messages"); }
  }, [flash]);

  useEffect(() => {
    api<{ authenticated: boolean }>("/api/auth/me").then(() => setAuth("signed-in")).catch(() => setAuth("signed-out"));
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(window.localStorage.getItem("openchat-sidebar-collapsed") === "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function closeAccountMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setAccountMenuOpen(false);
        return;
      }
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", closeAccountMenu);
    document.addEventListener("keydown", closeAccountMenu);
    return () => {
      document.removeEventListener("mousedown", closeAccountMenu);
      document.removeEventListener("keydown", closeAccountMenu);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (auth !== "signed-in") return;
    const initial = window.setTimeout(() => {
      void loadConversations();
      api<{ ok: boolean } & Runtime>("/api/health").then(setRuntime).catch((error) => flash(error instanceof Error ? error.message : "Runtime check failed"));
    }, 0);
    const timer = window.setInterval(() => void loadConversations(), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [auth, flash, loadConversations]);

  useEffect(() => {
    if (!selected || auth !== "signed-in") return;
    const initial = window.setTimeout(() => void loadMessages(selected), 0);
    const timer = window.setInterval(() => void loadMessages(selected), 6_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [auth, loadMessages, selected]);

  const active = conversations.find((item) => item.id === selected) ?? null;
  const draft = conversationDraft(drafts, selected);
  const unread = conversations.reduce((total, item) => total + item.unread, 0);

  function setDraft(value: string) {
    if (!selected) return;
    setDrafts((current) => updateConversationDraft(current, selected, value));
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setAuthError("");
    try { await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }); setPassword(""); setAuth("signed-in"); }
    catch (error) { setAuthError(error instanceof Error ? error.message : "Sign in failed"); }
    finally { setBusy(false); }
  }

  async function logout() {
    setAccountMenuOpen(false);
    await api("/api/auth/logout", { method: "POST" }); setAuth("signed-out"); setConversations([]); setMessages([]); setDrafts({});
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem("openchat-sidebar-collapsed", String(next));
      return next;
    });
  }

  async function sendMessage(file?: File, replyToMessageId?: number) {
    if (!active || (!draft.trim() && !file) || busy) return false;
    const conversationId = active.id;
    const messageText = draft.trim();
    setBusy(true);
    try {
      let body: BodyInit;
      if (file) {
        const form = new FormData();
        form.append("text", messageText);
        form.append("file", file, file.name);
        if (replyToMessageId) form.append("replyToMessageId", String(replyToMessageId));
        body = form;
      } else {
        body = JSON.stringify({ text: messageText, replyToMessageId });
      }
      const result = await api<{ messages: ApiMessage[] }>(`/api/conversations/${conversationId}/messages`, { method: "POST", body });
      setDrafts((current) => clearConversationDraft(current, conversationId));
      setMessages(presentMessages(result.messages));
      await loadConversations(); flash("Reply delivered");
      return true;
    } catch (error) { flash(error instanceof Error ? error.message : "Reply failed"); return false; }
    finally { setBusy(false); }
  }

  async function changeMode(mode: Mode) {
    if (!active) return;
    try {
      await api(`/api/conversations/${active.id}/mode`, { method: "PATCH", body: JSON.stringify({ mode }) });
      await loadConversations(); flash(mode === "AI_ACTIVE" ? "AI resumed" : "You took over the conversation");
    } catch (error) { flash(error instanceof Error ? error.message : "Could not change mode"); }
  }

  if (auth === "checking") return <div className="auth-screen"><div className="auth-card"><span className="brand-mark"><i /><i /><i /></span><p>Opening your inbox…</p></div></div>;
  if (auth === "signed-out") return <div className="auth-screen"><form className="auth-card" onSubmit={login}><span className="brand-mark"><i /><i /><i /></span><h1>Welcome to OpenChat</h1><p>Sign in with the admin password configured on this installation.</p><label><span>Admin password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{authError ? <div className="auth-error">{authError}</div> : null}<button className="button primary" disabled={busy || !password}>{busy ? "Signing in…" : "Open dashboard"}</button><Link href="/">Back to website</Link></form></div>;

  return <div className={`dashboard-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <aside className="sidebar" aria-label="Workspace sidebar">
      <div className="sidebar-header">
        <Link className="brand" href="/" aria-label="OpenChat home"><span className="brand-mark"><i /><i /><i /></span><strong>openchat</strong></Link>
      </div>
      <div className="workspace-switcher" title="Self-hosted workspace"><b>Self-hosted<small>Single workspace</small></b><ShieldCheck size={15} /></div>
      <nav aria-label="Dashboard navigation"><p>Workspace</p>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} title={item.label} onClick={() => setView(item.id)}><Icon size={18} /><span>{item.label}</span>{item.id === "inbox" && unread ? <em>{unread}</em> : null}</button>; })}<p>Manage</p><button type="button" className={view === "settings" ? "active" : ""} aria-current={view === "settings" ? "page" : undefined} title="Settings" onClick={() => setView("settings")}><SettingsIcon size={18} /><span>Settings</span></button></nav>
      <div className="sidebar-footer">
        <div className="usage-card"><span><Bot size={15} /> AI assistant</span><strong>{runtime?.ai.configured ? runtime.ai.model : "Not configured"}</strong><small>{runtime?.ai.configured ? "Provider key is stored server-side" : "Add an AI key to enable replies"}</small></div>
        <div className={`account-menu ${accountMenuOpen ? "open" : ""}`} ref={accountMenuRef}>
          <button className="user-menu" type="button" title="Open account menu" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}><span>AD</span><b>Administrator<small>Account menu</small></b><MoreHorizontal size={17} /></button>
          {accountMenuOpen ? <div className="account-menu-popover" role="menu" aria-label="Administrator menu">
            <button type="button" role="menuitem" onClick={() => { setView("settings"); setAccountMenuOpen(false); }}><SettingsIcon size={16} /><span><b>Settings</b><small>Manage this workspace</small></span></button>
            <div className="account-menu-separator" />
            <button className="account-sign-out" type="button" role="menuitem" onClick={() => void logout()}><LogOut size={16} /><span><b>Sign out</b><small>End this session</small></span></button>
          </div> : null}
        </div>
      </div>
    </aside>
    <main className="dashboard-main">
      <header className="topbar"><button className="mobile-brand" type="button" aria-label="Open overview" onClick={() => setView("overview")}><span className="brand-mark"><i /><i /><i /></span></button><button className="topbar-sidebar-toggle" type="button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar}>{sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button><label className="global-search"><Search size={16} /><input aria-label="Search workspace" placeholder="Search workspace" /><kbd>⌘ K</kbd></label><div className="topbar-actions"><button aria-label="Refresh" onClick={() => void loadConversations()}><RefreshCw size={18} /></button><button aria-label="Notifications"><Bell size={18} /></button><span className="live"><i />{runtime?.database ? "Instance operational" : "Checking instance"}</span></div></header>
      {view === "overview" ? <Overview conversations={conversations} runtime={runtime} onOpen={setView} /> : null}
      {view === "inbox" ? <Inbox conversations={conversations} active={active} selected={selected} messages={messages} draft={draft} busy={busy} aiConfigured={Boolean(runtime?.ai.configured)} onSelect={setSelected} onDraft={setDraft} onSend={sendMessage} onMode={changeMode} /> : null}
      {view === "contacts" ? <Contacts conversations={conversations} onOpen={(id) => { setSelected(id); setView("inbox"); }} /> : null}
      {view === "automations" ? <Automations onFlash={flash} /> : null}
      {view === "settings" ? <Settings runtime={runtime} onRuntime={setRuntime} onFlash={flash} /> : null}
    </main>
    {toast ? <div className="toast"><Check size={16} />{toast}</div> : null}
  </div>;
}

function PageHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <header className="page-header"><div className="page-header-copy"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action ? <div className="page-header-actions"><button className="button primary" onClick={onAction}>{action}</button></div> : null}</header>;
}

function Overview({ conversations, runtime, onOpen }: { conversations: Conversation[]; runtime: Runtime | null; onOpen: (view: View) => void }) {
  const attention = conversations.filter((item) => item.mode !== "AI_ACTIVE");
  const aiActive = conversations.filter((item) => item.mode === "AI_ACTIVE").length;
  const unread = conversations.reduce((sum, item) => sum + item.unread, 0);
  return <section className="page overview-page"><PageHeader eyebrow="Self-hosted workspace" title="Your OpenChat inbox" description="Live data from this installation. Connect a channel in Settings to receive the first message." action="Open inbox" onAction={() => onOpen("inbox")} />
    <div className="metrics-grid"><Metric label="Conversations" value={String(conversations.length)} note="Stored locally" trend="Live" /><Metric label="Needs attention" value={String(attention.length)} note="Escalated or human" trend={attention.length ? "Review" : "Clear"} /><Metric label="AI handling" value={String(aiActive)} note="Active conversations" trend={runtime?.ai.configured ? "Ready" : "Setup"} /><Metric label="Unread messages" value={String(unread)} note="Across channels" trend={unread ? "New" : "Clear"} /></div>
    <div className="overview-grid"><section className="panel priority-panel"><PanelHeader title="Needs your attention" meta={`${attention.length} conversations`} action="View inbox" onAction={() => onOpen("inbox")} /><div className="attention-list">{attention.slice(0, 5).map((item, index) => <button key={item.id} onClick={() => onOpen("inbox")}><Avatar initials={item.initials} index={index} /><span><b>{item.name}</b><small>{item.preview}</small></span><ChannelLogo channel={item.channel} size={17} /><time>{item.time}</time><ChevronRight size={16} /></button>)}{!attention.length ? <EmptyRow text={conversations.length ? "Nothing needs you right now." : "No conversations yet. Send a message to your connected bot."} /> : null}</div></section>
      <section className="panel channel-panel"><PanelHeader title="Runtime" meta="Configuration" action="Settings" onAction={() => onOpen("settings")} /><div className="channel-health"><HealthRow label="Database" detail="Durable conversation history" ready={Boolean(runtime?.database)} /><HealthRow label="Telegram" detail="Bot and webhook secrets" ready={Boolean(runtime?.telegram.configured)} /><HealthRow label="Instagram" detail={runtime?.instagram?.connected ? `${runtime.instagram.connected} connected account${runtime.instagram.connected === 1 ? "" : "s"}` : "Meta app and account connection"} ready={Boolean(runtime?.instagram?.connected && runtime.instagram.healthy === runtime.instagram.connected)} /><HealthRow label="AI provider" detail={runtime?.ai.configured ? runtime.ai.model : "Not configured"} ready={Boolean(runtime?.ai.configured)} /></div></section></div>
  </section>;
}

function Metric({ label, value, note, trend }: { label: string; value: string; note: string; trend: string }) { return <article className="metric"><header><span>{label}</span><MoreHorizontal size={17} /></header><strong>{value}</strong><footer><span>{note}</span><em>{trend}</em></footer></article>; }
function PanelHeader({ title, meta, action, onAction }: { title: string; meta: string; action?: string; onAction?: () => void }) { return <header className="panel-header"><div><h2>{title}</h2><span>{meta}</span></div>{action ? <button onClick={onAction}>{action}<ChevronRight size={14} /></button> : null}</header>; }
function Avatar({ initials: value, index = 0 }: { initials: string; index?: number }) { return <i className={`avatar tone-${index % 4}`}>{value}</i>; }
function EmptyRow({ text }: { text: string }) { return <div className="empty-row">{text}</div>; }
function HealthRow({ label, detail, ready }: { label: string; detail: string; ready: boolean }) { return <div><span className="health-icon">{ready ? <Check size={15} /> : <MoreHorizontal size={15} />}</span><span><b>{label}</b><small>{detail}</small></span><em><i className={ready ? "" : "not-ready"} />{ready ? "Ready" : "Setup needed"}</em></div>; }

function Inbox({ conversations, active, selected, messages, draft, busy, aiConfigured, onSelect, onDraft, onSend, onMode }: { conversations: Conversation[]; active: Conversation | null; selected: number | null; messages: Message[]; draft: string; busy: boolean; aiConfigured: boolean; onSelect: (id: number) => void; onDraft: (value: string) => void; onSend: (file?: File, replyToMessageId?: number) => Promise<boolean>; onMode: (mode: Mode) => void }) {
  const [filter, setFilter] = useState<"All" | "AI handling" | "Needs you">("All");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const messagesViewport = useRef<HTMLDivElement>(null);
  const filtered = conversations.filter((item) => filter === "All" || item.status === filter);
  const scrollMessagesToEnd = useCallback(() => {
    const viewport = messagesViewport.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(scrollMessagesToEnd);
    return () => cancelAnimationFrame(frame);
  }, [active?.id, messages.length, scrollMessagesToEnd]);
  function selectConversation(conversationId: number) {
    onSelect(conversationId);
    setAttachment(null);
    setReplyingTo(null);
    setImproveError("");
    setMobileOpen(true);
    if (fileInput.current) fileInput.current.value = "";
  }
  async function submitReply() {
    if (busy || improving || (!draft.trim() && !attachment)) return;
    if (await onSend(attachment ?? undefined, replyingTo?.id)) {
      setAttachment(null);
      setReplyingTo(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function improveMessage() {
    const text = draft.trim();
    if (!text || busy || improving || !aiConfigured) return;
    setImproving(true);
    setImproveError("");
    try {
      const result = await api<{ text: string }>("/api/assistant/improve", {
        method: "POST",
        body: JSON.stringify({
          draft: text,
          history: messages.slice(-12).map((message) => ({ author: message.author, text: message.text })),
        }),
      });
      onDraft(result.text);
      window.requestAnimationFrame(() => composerInput.current?.focus());
    } catch (error) {
      setImproveError(error instanceof Error ? error.message : "Could not improve this draft");
    } finally {
      setImproving(false);
    }
  }
  return <section className={`inbox-page ${mobileOpen ? "mobile-open" : ""}`}><aside className="conversation-pane"><header><div><span>Conversations</span><h1>Inbox</h1></div></header><label className="inbox-search"><Search size={15} /><input placeholder="Search conversations" /></label><div className="filter-tabs">{(["All", "AI handling", "Needs you"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "AI handling" ? "AI" : item}</button>)}</div><div className="conversation-list">{filtered.map((item, index) => <button key={item.id} className={selected === item.id ? "active" : ""} onClick={() => selectConversation(item.id)}><Avatar initials={item.initials} index={index} /><span><b>{item.name}</b><small>{item.preview}</small><em className={item.status.toLowerCase().replaceAll(" ", "-")}>{item.status}</em></span><time>{item.time}{item.unread ? <strong>{item.unread}</strong> : null}</time></button>)}{!filtered.length ? <EmptyRow text="No matching conversations." /> : null}</div></aside>
    {active ? <><section className="chat-pane"><header><button className="mobile-back" onClick={() => setMobileOpen(false)} aria-label="Back to conversations"><ArrowLeft size={18} /></button><Avatar initials={active.initials} /><span><b>{active.name}</b><small><ChannelLogo channel={active.channel} size={13} />{channelLabel(active.channel)} · {active.status}</small></span><button className="take-over" onClick={() => onMode(active.mode === "AI_ACTIVE" ? "HUMAN_ACTIVE" : "AI_ACTIVE")}>{active.mode === "AI_ACTIVE" ? "Take over" : "Resume AI"}</button></header><div ref={messagesViewport} className="messages"><div className="day-divider"><span>Conversation</span></div>{messages.map((message) => <div key={message.id} className={`message ${message.from}`}><div className="message-heading"><small>{message.from === "ai" ? "OpenChat AI" : message.from === "you" ? `You · ${message.status}` : ""}</small><button type="button" aria-label={`Reply to ${message.text}`} onClick={() => { setReplyingTo(message); composerInput.current?.focus(); }}><Reply size={13} />Reply</button></div><div className="message-content">{message.replyToText ? <blockquote><span>{message.replyToAuthor === "customer" ? active.name : message.replyToAuthor === "ai" ? "OpenChat AI" : "You"}</span>{message.replyToText}</blockquote> : null}{message.attachment?.type === "photo" ? <Image className="message-photo" src={`/api/messages/${message.id}/attachment`} alt={message.text || "Conversation attachment"} width={420} height={280} unoptimized onLoad={scrollMessagesToEnd} /> : message.attachment ? <a className="message-file" href={`/api/messages/${message.id}/attachment`} target="_blank" rel="noreferrer"><FileText size={20} /><span><b>{message.attachment.fileName ?? message.attachment.type}</b><small>{message.attachment.fileSize ? `${Math.ceil(message.attachment.fileSize / 1024)} KB` : "Open attachment"}</small></span></a> : null}<p>{message.text}</p></div><time>{message.time}</time></div>)}</div><footer className="composer-wrap"><div className="suggested-replies"><button onClick={() => { onDraft("Albatta, hozir tekshirib beraman."); setImproveError(""); }}>Check availability</button><button onClick={() => { onDraft("Iltimos, batafsil ma’lumot yuboring."); setImproveError(""); }}>Ask for details</button></div><div className="composer">{replyingTo ? <div className="composer-context"><Reply size={14} /><span><b>Replying to {replyingTo.from === "customer" ? active.name : replyingTo.from === "ai" ? "OpenChat AI" : "your message"}</b><small>{replyingTo.text}</small></span><button type="button" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}><X size={15} /></button></div> : null}{attachment ? <div className="composer-context attachment-context"><Paperclip size={14} /><span><b>{attachment.name}</b><small>{Math.ceil(attachment.size / 1024)} KB</small></span><button type="button" aria-label="Remove attachment" onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ""; }}><X size={15} /></button></div> : null}{improveError ? <div className="composer-error" role="alert">{improveError}</div> : null}<textarea ref={composerInput} value={draft} onChange={(event) => { onDraft(event.target.value); setImproveError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitReply(); } }} placeholder={attachment ? "Add a caption…" : "Write a reply…"} /><div><label className="attachment-button" aria-label="Attach media or file"><Paperclip size={17} /><input ref={fileInput} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.json" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label><button type="button" title={!aiConfigured ? "Connect an AI provider in Settings first" : "Rewrite this draft with AI"} disabled={busy || improving || !draft.trim() || !aiConfigured} onClick={() => void improveMessage()}><WandSparkles size={16} />{improving ? "Improving…" : "Improve"}</button><button className="send-button" disabled={busy || improving || (!draft.trim() && !attachment)} onClick={() => void submitReply()}>{busy ? "Sending…" : "Send"}<Send size={15} /></button></div></div></footer></section><aside className="details-pane"><header><span>Contact details</span></header><div className="contact-profile"><Avatar initials={active.initials} /><h2>{active.name}</h2><p>{active.username ? `@${active.username}` : `${channelLabel(active.channel)} contact`}</p></div><section><h3>Conversation</h3><dl><div><dt>Status</dt><dd>{active.status}</dd></div><div><dt>Stage</dt><dd>{active.stage}</dd></div><div><dt>Channel</dt><dd><ChannelLogo channel={active.channel} size={15} />{channelLabel(active.channel)}</dd></div></dl></section><section><h3>AI safety</h3><div className="context-note"><Bot size={16} /><p><b>Human control</b>Taking over pauses future AI replies before they are sent.</p></div></section></aside></> : <section className="chat-pane empty-chat"><Bot size={34} /><h2>Your inbox is ready</h2><p>Connect Instagram or Telegram in Settings, then send a message to that channel.</p></section>}
  </section>;
}

type TestMessage = { id: string; role: "user" | "assistant"; text: string; escalated?: boolean };

function AssistantTester({ settings, configured, model }: { settings: SettingsValue | null; configured: boolean; model: string }) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendTestMessage() {
    const text = draft.trim();
    if (!text || !settings || !configured || busy) return;
    const userMessage: TestMessage = { id: crypto.randomUUID(), role: "user", text };
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const result = await api<{ reply: string; escalated: boolean }>("/api/assistant/test", {
        method: "POST",
        body: JSON.stringify({
          settings,
          history: next.filter((message) => !message.escalated).map((message) => ({ author: message.role === "user" ? "customer" : "ai", text: message.text })),
        }),
      });
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.escalated ? "This conversation would be handed to a human." : result.reply,
        escalated: result.escalated,
      }]);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Assistant test failed"); }
    finally { setBusy(false); }
  }

  return <section className="settings-section assistant-tester"><header><div><span>Test assistant</span><h2>{messages.length ? "Test session" : "New test session"}</h2><small>{model || "No model selected"}</small></div>{messages.length ? <button className="button secondary" type="button" onClick={() => { setMessages([]); setError(""); }}>Reset</button> : null}</header><div className="test-chat" aria-live="polite">{messages.length ? messages.map((message) => <article key={message.id} className={`test-message ${message.role} ${message.escalated ? "escalated" : ""}`}><span>{message.role === "user" ? "You" : "OpenChat AI"}</span><p>{message.text}</p></article>) : <div className="test-empty"><span><Bot size={23} /></span><h3>Try your assistant before going live</h3><p>This private test uses the instruction and business-knowledge drafts shown beside it. Nothing is sent to a connected channel or saved in the inbox.</p><div><button type="button" onClick={() => setDraft("What are your opening hours?")}>Ask about hours</button><button type="button" onClick={() => setDraft("What is the status of my order?")}>Test an unknown answer</button></div></div>}{busy ? <article className="test-message assistant pending"><span>OpenChat AI</span><p>Thinking…</p></article> : null}</div><footer><textarea aria-label="Test message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendTestMessage(); } }} placeholder={configured ? "Message your assistant…" : "Connect an AI provider to start testing"} disabled={!configured || !settings} /><button className="send-button" type="button" aria-label="Send test message" disabled={!configured || !settings || busy || !draft.trim()} onClick={() => void sendTestMessage()}><Send size={16} /></button>{error ? <div className="test-error" role="alert">{error}</div> : null}</footer></section>;
}

function ModelPicker({ models, value, loading, error, onChange, onRetry }: { models: AiModel[]; value: string; loading: boolean; error: string; onChange: (model: string) => void; onRetry: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  const autoModel: AiModel = { id: "openrouter/auto", name: "Auto Router", contextLength: null };
  const catalog = models.some((model) => model.id === autoModel.id) ? models : [autoModel, ...models];
  const selected = catalog.find((model) => model.id === value) ?? { id: value, name: value, contextLength: null };
  const preferredProviders = ["openrouter", "openai", "anthropic", "google", "meta-llama", "deepseek", "qwen", "mistralai", "x-ai", "moonshotai"];
  const providers = [...catalog.reduce((items, model) => {
    const key = aiProviderKey(model.id);
    const current = items.get(key);
    items.set(key, { key, name: aiProviderName(model.id), count: (current?.count ?? 0) + 1 });
    return items;
  }, new Map<string, { key: string; name: string; count: number }>()).values()].sort((left, right) => {
    const leftRank = preferredProviders.indexOf(left.key);
    const rightRank = preferredProviders.indexOf(right.key);
    if (leftRank >= 0 || rightRank >= 0) return (leftRank < 0 ? 999 : leftRank) - (rightRank < 0 ? 999 : rightRank);
    return right.count - left.count || left.name.localeCompare(right.name);
  });
  const normalizedQuery = query.trim().toLowerCase();
  const matches = catalog.filter((model) => (provider === "all" || aiProviderKey(model.id) === provider) && (!normalizedQuery || `${model.name} ${model.id}`.toLowerCase().includes(normalizedQuery)));
  const visible = matches.slice(0, 60);
  const contextLabel = (length: number | null) => length ? `${Math.round(length / 1000)}k context` : "Automatic routing";
  const activeProviderName = provider === "all" ? "All companies" : providers.find((item) => item.key === provider)?.name ?? "Models";

  return <div className={`model-picker ${open ? "open" : ""}`}><input type="hidden" name="openrouter-model" value={value} /><button className="model-picker-trigger" type="button" role="combobox" aria-expanded={open} aria-controls="openrouter-model-options" aria-haspopup="listbox" onClick={() => setOpen((current) => { if (current) setQuery(""); return !current; })} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); setQuery(""); } }}><ProviderMark id={selected.id} /><span className="model-picker-value"><b>{selected.name}</b><small>{aiProviderName(selected.id)} · {selected.id} · {contextLabel(selected.contextLength)}</small></span><ChevronRight size={17} /></button>{open ? <div className="model-picker-popover"><nav className="model-provider-rail" aria-label="Filter models by company"><button type="button" className={provider === "all" ? "active" : ""} aria-pressed={provider === "all"} title={`All companies (${catalog.length})`} onClick={() => { setProvider("all"); setQuery(""); }}><span>★</span><small>All</small></button>{providers.map((item) => <button key={item.key} type="button" className={provider === item.key ? "active" : ""} aria-pressed={provider === item.key} title={`${item.name} (${item.count})`} onClick={() => { setProvider(item.key); setQuery(""); }}><ProviderMark id={`${item.key}/model`} /><small>{item.name}</small></button>)}</nav><div className="model-picker-results"><label className="model-search"><Search size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models…" /></label>{error ? <div className="model-catalog-error"><span><b>Model catalog unavailable</b><small>Auto Router still works, or retry loading the catalog.</small></span><button type="button" disabled={loading} onClick={onRetry}>{loading ? "Retrying…" : "Retry"}</button></div> : null}<div className="model-options" id="openrouter-model-options" role="listbox" aria-label={`${activeProviderName} models`}>{visible.map((model) => <button key={model.id} type="button" role="option" aria-selected={model.id === value} onClick={() => { onChange(model.id); setOpen(false); setQuery(""); }}><ProviderMark id={model.id} /><span className="model-option-copy"><b>{model.name}</b><small>{aiProviderName(model.id)}</small><em>{model.id} · {contextLabel(model.contextLength)}</em></span>{model.id === value ? <Check size={16} /> : null}</button>)}{!visible.length ? <div className="model-empty">{error ? "The catalog is not loaded yet." : <>No models match “{query}” in {activeProviderName}.</>}</div> : null}</div><footer>{error ? "Auto Router remains available" : matches.length > visible.length ? `${activeProviderName} · Showing ${visible.length} of ${matches.length}` : `${activeProviderName} · ${matches.length} model${matches.length === 1 ? "" : "s"}`}</footer></div></div> : null}</div>;
}

function Contacts({ conversations, onOpen }: { conversations: Conversation[]; onOpen: (id: number) => void }) {
  return <section className="page"><PageHeader eyebrow="Audience" title="Contacts" description="People who have messaged a connected channel." /><section className="table-panel"><div className="table-toolbar"><label><Search size={15} /><input placeholder="Search name or username" /></label><span>{conversations.length} contacts</span></div><div className="contact-table"><header><span>Contact</span><span>Stage</span><span>Channel</span><span>Mode</span><span>Last activity</span><span /></header>{conversations.map((item, index) => <button key={item.id} onClick={() => onOpen(item.id)}><span><Avatar initials={item.initials} index={index} /><b>{item.name}<small>{item.username ? `@${item.username}` : "No username"}</small></b></span><em>{item.stage}</em><span><ChannelLogo channel={item.channel} size={17} />{channelLabel(item.channel)}</span><span>{item.status}</span><time>{item.time}</time><ChevronRight size={15} /></button>)}{!conversations.length ? <EmptyRow text="Contacts appear after someone messages your bot or business profile." /> : null}</div></section></section>;
}

function Automations({ onFlash }: { onFlash: (text: string) => void }) {
  const [automations, setAutomations] = useState<InstagramAutomation[]>([]);
  const [analytics, setAnalytics] = useState<InstagramAutomationAnalytics[]>([]);
  const [accounts, setAccounts] = useState<InstagramSetup["accounts"]>([]);
  const [media, setMedia] = useState<InstagramMediaItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState(0);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"comment" | "dm">("comment");
  const [postId, setPostId] = useState("");
  const [matchAnyPost, setMatchAnyPost] = useState(true);
  const [pendingNextReel, setPendingNextReel] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [matchAnyText, setMatchAnyText] = useState(false);
  const [privateReply, setPrivateReply] = useState("");
  const [linkLabel, setLinkLabel] = useState("Open link");
  const [linkUrl, setLinkUrl] = useState("");
  const [secondLinkLabel, setSecondLinkLabel] = useState("");
  const [secondLinkUrl, setSecondLinkUrl] = useState("");
  const [thirdLinkLabel, setThirdLinkLabel] = useState("");
  const [thirdLinkUrl, setThirdLinkUrl] = useState("");
  const [openingEnabled, setOpeningEnabled] = useState(false);
  const [openingMessage, setOpeningMessage] = useState("");
  const [openingButton, setOpeningButton] = useState("Send it");
  const [followEnabled, setFollowEnabled] = useState(false);
  const [followMessage, setFollowMessage] = useState("Follow this account, then tap below to continue.");
  const [followButton, setFollowButton] = useState("I'm following");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpDelay, setFollowUpDelay] = useState(0);
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [publicReply, setPublicReply] = useState("");
  const load = useCallback(async () => {
    const [automationResult, analyticsResult, setup] = await Promise.all([
      api<{ automations: InstagramAutomation[] }>("/api/instagram/automations"),
      api<{ analytics: InstagramAutomationAnalytics[] }>("/api/instagram/automation-analytics"),
      api<InstagramSetup>("/api/setup/instagram"),
    ]);
    setAutomations(automationResult.automations);
    setAnalytics(analyticsResult.analytics);
    setAccounts(setup.accounts);
    setAccountId((current) => current || setup.accounts[0]?.id || 0);
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load automations")), 0);
    return () => window.clearTimeout(initial);
  }, [load]);
  useEffect(() => {
    if (!showForm || !accountId || triggerType !== "comment") return;
    let active = true;
    void api<{ media: InstagramMediaItem[] }>(`/api/instagram/accounts/${accountId}/media`)
      .then((result) => { if (active) setMedia(result.media); })
      .catch(() => { if (active) setMedia([]); });
    return () => { active = false; };
  }, [accountId, showForm, triggerType]);
  function resetForm() {
    setEditingId(null); setName(""); setTriggerType("comment"); setPostId(""); setMatchAnyPost(true); setPendingNextReel(false);
    setKeywords(""); setMatchAnyText(false); setPrivateReply(""); setLinkLabel("Open link"); setLinkUrl("");
    setSecondLinkLabel(""); setSecondLinkUrl(""); setThirdLinkLabel(""); setThirdLinkUrl("");
    setOpeningEnabled(false); setOpeningMessage(""); setOpeningButton("Send it");
    setFollowEnabled(false); setFollowMessage("Follow this account, then tap below to continue."); setFollowButton("I'm following");
    setFollowUpEnabled(false); setFollowUpMessage(""); setFollowUpDelay(0); setPublicEnabled(false); setPublicReply(""); setError("");
  }
  function startCreate() { resetForm(); setAccountId(accounts[0]?.id ?? 0); setShowForm(true); }
  function startEdit(automation: InstagramAutomation) {
    setEditingId(automation.id); setAccountId(automation.instagramAccountId); setName(automation.name); setTriggerType(automation.triggerType);
    setPostId(automation.postId ?? ""); setMatchAnyPost(automation.matchAnyPost); setPendingNextReel(automation.pendingNextReel);
    setKeywords(automation.keywords.join(", ")); setMatchAnyText(automation.matchAnyText); setPrivateReply(automation.privateReplyMessage);
    setLinkLabel(automation.trackedLinks[0]?.label ?? automation.linkButtonLabel ?? "Open link"); setLinkUrl(automation.trackedLinks[0]?.destinationUrl ?? "");
    setSecondLinkLabel(automation.trackedLinks[1]?.label ?? ""); setSecondLinkUrl(automation.trackedLinks[1]?.destinationUrl ?? "");
    setThirdLinkLabel(automation.trackedLinks[2]?.label ?? ""); setThirdLinkUrl(automation.trackedLinks[2]?.destinationUrl ?? "");
    setOpeningEnabled(automation.openingDmEnabled); setOpeningMessage(automation.openingDmMessage ?? ""); setOpeningButton(automation.openingDmButtonLabel ?? "Send it");
    setFollowEnabled(automation.requireFollow); setFollowMessage(automation.followPromptMessage ?? "Follow this account, then tap below to continue."); setFollowButton(automation.followPromptButtonLabel ?? "I'm following");
    setFollowUpEnabled(automation.followUpEnabled); setFollowUpMessage(automation.followUpMessage ?? ""); setFollowUpDelay(automation.followUpDelayMinutes);
    setPublicEnabled(automation.publicReplyEnabled); setPublicReply(automation.publicReplyMessage ?? ""); setError(""); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeForm() { resetForm(); setShowForm(false); }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const existing = editingId ? automations.find((automation) => automation.id === editingId) : null;
      const result = await api<{ automations: InstagramAutomation[] }>(editingId ? `/api/instagram/automations/${editingId}` : "/api/instagram/automations", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          instagramAccountId: accountId, name, triggerType, postId, matchAnyPost, matchAnyText,
          keywords: keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean), wholeWordMatch: true,
          privateReplyMessage: privateReply, publicReplyEnabled: publicEnabled, publicReplyMessage: publicReply,
          pendingNextReel, openingDmEnabled: openingEnabled, openingDmMessage: openingMessage, openingDmButtonLabel: openingButton,
          linkButtonLabel: linkLabel, requireFollow: followEnabled, followPromptMessage: followMessage, followPromptButtonLabel: followButton,
          followUpEnabled, followUpMessage, followUpDelayMinutes: followUpDelay,
          trackedLinks: [{ label: linkLabel, destinationUrl: linkUrl }, { label: secondLinkLabel, destinationUrl: secondLinkUrl }, { label: thirdLinkLabel, destinationUrl: thirdLinkUrl }].filter((link) => link.destinationUrl),
          active: existing?.active,
        }),
      });
      setAutomations(result.automations);
      closeForm();
      await load();
      onFlash(editingId ? "Instagram automation updated" : "Instagram automation created");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save automation"); }
    finally { setBusy(false); }
  }
  async function toggle(automation: InstagramAutomation) {
    setBusy(true);
    try {
      const result = await api<{ automations: InstagramAutomation[] }>(`/api/instagram/automations/${automation.id}`, { method: "PATCH", body: JSON.stringify({ active: !automation.active }) });
      setAutomations(result.automations);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update automation"); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    setBusy(true);
    try {
      const result = await api<{ automations: InstagramAutomation[] }>(`/api/instagram/automations/${id}`, { method: "DELETE" });
      setAutomations(result.automations);
      onFlash("Automation deleted");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete automation"); }
    finally { setBusy(false); }
  }
  return <section className="page"><PageHeader eyebrow="Instagram" title="Automations" description="Turn comments or incoming DMs into immediate, tracked replies." action={accounts.length ? showForm ? "Close builder" : "New automation" : undefined} onAction={() => showForm ? closeForm() : startCreate()} />
    {!accounts.length ? <section className="settings-section"><div className="provider-notice"><AlertTriangle size={16} /><span>Connect an Instagram professional account in Settings before creating an automation.</span></div></section> : null}
    {showForm ? <form className="settings-section automation-builder" onSubmit={save}>
      <header><div><h2>{editingId ? "Edit automation" : "Create automation"}</h2><p>Build a durable comment-to-DM or incoming-DM campaign. Use <code>{"{username}"}</code> for personalization.</p></div></header>
      <div className="automation-form-grid">
        <label className="field"><span>Account</span><select aria-label="Instagram account" value={accountId} onChange={(event) => { setAccountId(Number(event.target.value)); setPostId(""); }}>{accounts.map((account) => <option key={account.id} value={account.id}>@{account.username}</option>)}</select></label>
        <label className="field"><span>Name</span><input aria-label="Automation name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Send product guide" required /></label>
        <label className="field"><span>Trigger</span><select aria-label="Automation trigger" value={triggerType} onChange={(event) => setTriggerType(event.target.value as "comment" | "dm")}><option value="comment">Post comment</option><option value="dm">Incoming DM</option></select></label>
        {triggerType === "comment" ? <><label className="check-field"><input aria-label="Match comments on any post" type="checkbox" checked={matchAnyPost} onChange={(event) => { setMatchAnyPost(event.target.checked); if (event.target.checked) setPendingNextReel(false); }} /><span>Match comments on any post</span></label><label className="check-field"><input aria-label="Attach to the next Reel published" type="checkbox" checked={pendingNextReel} onChange={(event) => { setPendingNextReel(event.target.checked); if (event.target.checked) setMatchAnyPost(false); }} /><span>Attach to the next Reel published</span></label>{!matchAnyPost && !pendingNextReel ? <label className="field wide"><span>Instagram post</span><select aria-label="Instagram post" value={postId} onChange={(event) => setPostId(event.target.value)} required><option value="">Choose a recent post…</option>{media.map((item) => <option key={item.id} value={item.id}>{item.mediaProductType || item.mediaType || "Post"} · {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : item.id} · {item.id}</option>)}</select><small className="field-hint">Recent posts are loaded directly from the connected account.</small></label> : null}</> : null}
        <label className="check-field"><input aria-label="Match any text" type="checkbox" checked={matchAnyText} onChange={(event) => setMatchAnyText(event.target.checked)} /><span>Match any text</span></label>
        {!matchAnyText ? <label className="field wide"><span>Keywords</span><input aria-label="Keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="guide, price, link" required /><small className="field-hint">Comma-separated, Unicode-aware whole-word matching.</small></label> : null}
        <label className="field wide"><span>Reveal message</span><textarea aria-label="Reveal message" value={privateReply} onChange={(event) => setPrivateReply(event.target.value)} placeholder="Hi {username}, here is the guide…" required /></label>
        <label className="field"><span>Primary link label</span><input aria-label="Primary link label" value={linkLabel} maxLength={20} onChange={(event) => setLinkLabel(event.target.value)} /></label><label className="field"><span>Primary HTTPS link (optional)</span><input aria-label="Primary HTTPS link" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com/guide" /></label>
        <label className="field"><span>Second link label</span><input aria-label="Second link label" value={secondLinkLabel} maxLength={20} onChange={(event) => setSecondLinkLabel(event.target.value)} placeholder="Learn more" /></label><label className="field"><span>Second HTTPS link</span><input aria-label="Second HTTPS link" type="url" value={secondLinkUrl} onChange={(event) => setSecondLinkUrl(event.target.value)} placeholder="https://example.com" /></label>
        <label className="field"><span>Third link label</span><input aria-label="Third link label" value={thirdLinkLabel} maxLength={20} onChange={(event) => setThirdLinkLabel(event.target.value)} placeholder="Book now" /></label><label className="field"><span>Third HTTPS link</span><input aria-label="Third HTTPS link" type="url" value={thirdLinkUrl} onChange={(event) => setThirdLinkUrl(event.target.value)} placeholder="https://example.com/book" /></label>
        {triggerType === "comment" ? <><label className="check-field wide"><input aria-label="Send an opening DM before revealing" type="checkbox" checked={openingEnabled} onChange={(event) => setOpeningEnabled(event.target.checked)} /><span>Send an opening DM with a postback button before revealing</span></label>{openingEnabled ? <><label className="field wide"><span>Opening DM</span><textarea aria-label="Opening DM" maxLength={640} value={openingMessage} onChange={(event) => setOpeningMessage(event.target.value)} required /></label><label className="field"><span>Opening button</span><input aria-label="Opening button" maxLength={20} value={openingButton} onChange={(event) => setOpeningButton(event.target.value)} required /></label></> : null}</> : null}
        <label className="check-field wide"><input aria-label="Require account follow before reveal" type="checkbox" checked={followEnabled} onChange={(event) => setFollowEnabled(event.target.checked)} /><span>Require the person to follow the account before reveal</span></label>{followEnabled ? <><label className="field wide"><span>Follow prompt</span><textarea aria-label="Follow prompt" maxLength={640} value={followMessage} onChange={(event) => setFollowMessage(event.target.value)} required /></label><label className="field"><span>Follow-check button</span><input aria-label="Follow-check button" maxLength={20} value={followButton} onChange={(event) => setFollowButton(event.target.value)} required /></label></> : null}
        <label className="check-field wide"><input aria-label="Send a follow-up" type="checkbox" checked={followUpEnabled} onChange={(event) => setFollowUpEnabled(event.target.checked)} /><span>Send a follow-up after reveal when the 24-hour window permits</span></label>{followUpEnabled ? <><label className="field wide"><span>Follow-up message</span><textarea aria-label="Follow-up message" value={followUpMessage} onChange={(event) => setFollowUpMessage(event.target.value)} required /></label><label className="field"><span>Delay (minutes)</span><input aria-label="Follow-up delay in minutes" type="number" min={0} max={1440} value={followUpDelay} onChange={(event) => setFollowUpDelay(Number(event.target.value))} /></label></> : null}
        {triggerType === "comment" ? <><label className="check-field"><input aria-label="Also post a public reply" type="checkbox" checked={publicEnabled} onChange={(event) => setPublicEnabled(event.target.checked)} /><span>Also post a public reply</span></label>{publicEnabled ? <label className="field wide"><span>Public reply</span><input aria-label="Public reply" value={publicReply} onChange={(event) => setPublicReply(event.target.value)} placeholder="Sent it to your DMs!" required /></label> : null}</> : null}
      </div>
      {error ? <div className="settings-error" role="alert">{error}</div> : null}<div className="settings-actions"><button className="button primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Create automation"}</button></div>
    </form> : null}
    <div className="automation-grid">{automations.map((automation) => {
      const metric = analytics.find((item) => item.automationId === automation.id);
      const target = automation.triggerType === "dm" ? "Incoming DM" : automation.pendingNextReel ? "Waiting for next Reel" : automation.matchAnyPost ? "Any post comment" : `Post ${automation.postId}`;
      const features = [automation.openingDmEnabled ? "opening DM" : "", automation.requireFollow ? "follow gate" : "", automation.trackedLinks.length ? `${automation.trackedLinks.length} tracked link${automation.trackedLinks.length === 1 ? "" : "s"}` : "", automation.followUpEnabled ? "follow-up" : ""].filter(Boolean).join(" · ");
      return <article className="automation-card" key={automation.id}><header><span><WandSparkles size={17} /></span><div><button type="button" aria-label={`Edit ${automation.name}`} disabled={busy} onClick={() => startEdit(automation)}><SettingsIcon size={15} /></button><button type="button" aria-label={`Delete ${automation.name}`} disabled={busy} onClick={() => void remove(automation.id)}><X size={16} /></button></div></header><div className="automation-title"><i>●</i><h3>{automation.name}</h3></div><p>{target} · {automation.matchAnyText ? "any text" : automation.keywords.join(", ")}{features ? ` · ${features}` : ""}</p><dl><div><dt>Account</dt><dd>@{automation.accountUsername}</dd></div><div><dt>Reveals</dt><dd>{metric?.reveals ?? 0}</dd></div><div><dt>Clicks</dt><dd>{metric?.clicks ?? 0}</dd></div><div><dt>Failures</dt><dd>{metric?.failures ?? 0}</dd></div><div><dt>Status</dt><dd className={automation.active ? "live-status" : "paused-status"}>{automation.active ? "Live" : "Paused"}</dd></div></dl><footer><span>{metric?.runs ?? 0} run{metric?.runs === 1 ? "" : "s"}</span><label><input aria-label={`${automation.active ? "Pause" : "Activate"} ${automation.name}`} type="checkbox" checked={automation.active} disabled={busy} onChange={() => void toggle(automation)} /><span /></label></footer></article>;
    })}{!automations.length ? <section className="settings-section"><p>No Instagram automations yet.</p></section> : null}</div>
  </section>;
}

function ChannelSettingsLoading() {
  return <div className="channel-settings-loading" aria-label="Loading channel settings" aria-busy="true">
    <section className="settings-section"><div className="settings-loading-account"><span /><div><i /><i /></div><em /></div><div className="settings-loading-status"><i /><i /></div></section>
    <section className="settings-section settings-loading-secondary"><span /><div><i /><i /></div><em /></section>
  </div>;
}

function OperationsPanel({ onFlash }: { onFlash: (text: string) => void }) {
  const [operations, setOperations] = useState<OperationsValue | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const load = useCallback(async () => {
    try { setOperations((await api<{ operations: OperationsValue }>("/api/operations")).operations); }
    catch (error) { onFlash(error instanceof Error ? error.message : "Could not load operations"); }
  }, [onFlash]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);
  async function retry(path: string, key: string) {
    setBusyKey(key);
    try {
      const result = await api<{ operations: OperationsValue }>(path, { method: "POST" });
      setOperations(result.operations);
      onFlash("Retry started");
    } catch (error) { onFlash(error instanceof Error ? error.message : "Retry failed"); }
    finally { setBusyKey(""); }
  }
  if (!operations) return <ChannelSettingsLoading />;
  const healthy = operations.counts.failedEvents === 0 && operations.counts.failedAiJobs === 0 && operations.counts.failedMessages === 0 && operations.counts.failedAutomations === 0;
  return <div className="operations-stack">
    <section className="settings-section operations-summary"><header><div><h2>Operations</h2><p>Durable inbound, AI, delivery, and automation work that survives restarts.</p></div><button className="button secondary" type="button" onClick={() => void load()}><RefreshCw size={15} />Refresh</button></header><div className="operations-metrics"><span><b>{operations.counts.failedEvents}</b><small>Failed events</small></span><span><b>{operations.counts.failedAiJobs}</b><small>Failed AI jobs</small></span><span><b>{operations.counts.pendingWork + operations.counts.pendingAutomations}</b><small>Pending work</small></span><span><b>{operations.counts.failedMessages + operations.counts.failedAutomations}</b><small>Failed sends</small></span></div><div className={`operations-state ${healthy ? "healthy" : "attention"}`}>{healthy ? <Check size={16} /> : <AlertTriangle size={16} />}<span><b>{healthy ? "No operational failures" : "Attention required"}</b><small>{healthy ? "Inbound processing, AI, and automations are clear." : "Review and retry the failed work below."}</small></span></div></section>
    <section className="settings-section operations-list"><header><div><h2>Inbound events</h2><p>Channel updates are retained before processing and can be replayed safely.</p></div></header>{operations.events.length ? operations.events.map((event) => <article key={event.id}><span><b>{event.provider} · {event.externalId}</b><small>{event.lastError || `${event.status} · attempt ${event.attempts}`}</small></span>{event.status === "failed" ? <button className="button secondary" type="button" disabled={Boolean(busyKey)} onClick={() => void retry(`/api/operations/events/${event.id}/retry`, `event-${event.id}`)}>{busyKey === `event-${event.id}` ? "Retrying…" : "Retry"}</button> : <em>{event.status}</em>}</article>) : <p className="operations-empty">No failed or in-progress inbound events.</p>}</section>
    <section className="settings-section operations-list"><header><div><h2>AI processing</h2><p>One durable job runs per conversation, with stale replies cancelled before delivery.</p></div></header>{operations.aiJobs.length ? operations.aiJobs.map((job) => <article key={job.conversationId}><span><b>{job.conversationName}</b><small>{job.lastError || `${job.status} · attempt ${job.attempts}`}</small></span>{job.status === "failed" ? <button className="button secondary" type="button" disabled={Boolean(busyKey)} onClick={() => void retry(`/api/operations/ai/${job.conversationId}/retry`, `ai-${job.conversationId}`)}>{busyKey === `ai-${job.conversationId}` ? "Retrying…" : "Retry"}</button> : <em>{job.status}</em>}</article>) : <p className="operations-empty">No failed or pending AI jobs.</p>}</section>
    <section className="settings-section operations-list"><header><div><h2>Instagram automations</h2><p>Runs are resumable. A retry skips private or public actions already confirmed as sent.</p></div></header>{operations.automationRuns.length ? operations.automationRuns.map((run) => <article key={run.id}><span><b>@{run.accountUsername} · {run.automationName}</b><small>{run.lastError || `${run.triggerType} for @${run.subjectUsername || "unknown"} · attempt ${run.attempts}`}</small></span>{run.status === "failed" ? <button className="button secondary" type="button" disabled={Boolean(busyKey)} onClick={() => void retry(`/api/operations/instagram-automations/${run.id}/retry`, `automation-${run.id}`)}>{busyKey === `automation-${run.id}` ? "Retrying…" : "Retry"}</button> : <em>{run.status}</em>}</article>) : <p className="operations-empty">No failed or pending Instagram automations.</p>}</section>
    <section className="settings-section operations-list"><header><div><h2>Failed sends</h2><p>Check the channel before resending: a lost provider response can make delivery ambiguous.</p></div></header>{operations.failedMessages.length ? operations.failedMessages.map((message) => <article key={message.id}><span><b>{message.conversationName} · {message.body}</b><small>{message.lastError || `Delivery failed after ${message.attempts} attempt(s)`}</small></span><em>Review in inbox</em></article>) : <p className="operations-empty">No failed outbound messages.</p>}</section>
  </div>;
}

function Settings({ runtime, onRuntime, onFlash }: { runtime: Runtime | null; onRuntime: (runtime: Runtime) => void; onFlash: (text: string) => void }) {
  const [tab, setTab] = useState<"channels" | "ai" | "operations">(() => cachedSettingsTab);
  const [settings, setSettings] = useState<SettingsValue | null>(() => cachedSettingsValue);
  const [telegram, setTelegram] = useState<TelegramSetup | null>(() => cachedTelegramSetup);
  const [botToken, setBotToken] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [manageTelegram, setManageTelegram] = useState(false);
  const [setupSecretary, setSetupSecretary] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [instagram, setInstagram] = useState<InstagramSetup | null>(() => cachedInstagramSetup);
  const [instagramError, setInstagramError] = useState("");
  const [aiSetup, setAiSetup] = useState<AiSetup | null>(() => cachedAiSetup);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("openrouter/auto");
  const [showAiKey, setShowAiKey] = useState(false);
  const [manageAi, setManageAi] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { cachedSettingsTab = tab; }, [tab]);
  useEffect(() => { cachedSettingsValue = settings; }, [settings]);
  useEffect(() => { cachedTelegramSetup = telegram; }, [telegram]);
  useEffect(() => { cachedInstagramSetup = instagram; }, [instagram]);
  useEffect(() => { cachedAiSetup = aiSetup; }, [aiSetup]);
  const loadTelegram = useCallback(async () => {
    try {
      const result = await api<TelegramSetup>("/api/setup/telegram");
      setTelegram(result);
      setPublicUrl(result.publicUrl ?? "");
      setTelegramError(result.error ?? "");
    } catch (error) { setTelegramError(error instanceof Error ? error.message : "Could not check Telegram"); }
  }, []);
  const loadInstagram = useCallback(async () => {
    try {
      const result = await api<InstagramSetup>("/api/setup/instagram");
      setInstagram(result);
      setInstagramError("");
    } catch (error) { setInstagramError(error instanceof Error ? error.message : "Could not check Instagram"); }
  }, []);
  useEffect(() => {
    api<{ settings: SettingsValue; runtime: Runtime }>("/api/settings")
      .then((result) => { setSettings(result.settings); onRuntime(result.runtime); })
      .catch((error) => onFlash(error instanceof Error ? error.message : "Settings failed"));
    api<AiSetup>("/api/setup/ai")
      .then((result) => {
        setAiSetup(result);
        setAiModel(result.provider === "openrouter" ? result.model : "openrouter/auto");
        setAiError(result.error ?? "");
        if (result.provider === "openrouter" && result.configured) {
          void api<{ models: AiModel[] }>("/api/setup/ai/models").then((catalog) => setAiModels(catalog.models)).catch(() => undefined);
        }
      })
      .catch((error) => setAiError(error instanceof Error ? error.message : "Could not check the AI provider"));
  }, [onFlash, onRuntime]);
  useEffect(() => {
    const initial = window.setTimeout(() => void loadInstagram(), 0);
    const params = new URLSearchParams(window.location.search);
    const instagramResult = params.get("instagram");
    if (instagramResult) {
      const reason = params.get("reason");
      if (instagramResult === "connected") onFlash("Instagram connected");
      else if (instagramResult === "connected_attention") onFlash("Instagram connected, but its webhook subscription needs attention");
      else if (instagramResult === "denied") onFlash("Instagram connection was cancelled");
      else onFlash(reason || "Instagram could not be connected");
      params.delete("instagram");
      params.delete("reason");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
    return () => window.clearTimeout(initial);
  }, [loadInstagram, onFlash]);
  useEffect(() => {
    const initial = window.setTimeout(() => void loadTelegram(), 0);
    const timer = window.setInterval(() => void loadTelegram(), 8_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [loadTelegram]);

  async function setupTelegram(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setTelegramError("");
    try {
      const result = await api<TelegramSetup & { connected: boolean; runtime: Runtime }>("/api/setup/telegram", {
        method: "POST",
        body: JSON.stringify({ botToken: botToken.trim() || undefined, publicUrl: publicUrl.trim() }),
      });
      setTelegram(result);
      setPublicUrl(result.publicUrl);
      setBotToken("");
      setShowToken(false);
      setManageTelegram(false);
      setSetupSecretary(false);
      onRuntime(result.runtime);
      onFlash(result.bot?.username ? `Telegram connected as @${result.bot.username}` : "Telegram connected");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "Telegram setup failed");
    } finally { setBusy(false); }
  }

  async function disconnectTelegram() {
    setBusy(true);
    setTelegramError("");
    try {
      const result = await api<Pick<TelegramSetup, "configured" | "source">>("/api/setup/telegram", { method: "DELETE" });
      setTelegram({ configured: result.configured, source: result.source, publicUrl });
      setBotToken("");
      setShowToken(false);
      setManageTelegram(false);
      setSetupSecretary(false);
      onRuntime({ ...(runtime ?? { database: true, ai: { configured: false, provider: "none", model: "" }, telegram: { configured: false } }), telegram: { configured: result.configured } });
      onFlash("Telegram disconnected");
    } catch (error) { setTelegramError(error instanceof Error ? error.message : "Could not disconnect Telegram"); }
    finally { setBusy(false); }
  }

  async function connectInstagram() {
    setBusy(true);
    setInstagramError("");
    try {
      const result = await api<{ authorizationUrl: string }>("/api/setup/instagram/connect", { method: "POST" });
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setInstagramError(error instanceof Error ? error.message : "Instagram setup failed");
      setBusy(false);
    }
  }

  async function disconnectInstagram(accountId: number) {
    setBusy(true);
    setInstagramError("");
    try {
      await api(`/api/setup/instagram/${accountId}`, { method: "DELETE" });
      await loadInstagram();
      onFlash("Instagram account disconnected");
    } catch (error) { setInstagramError(error instanceof Error ? error.message : "Could not disconnect Instagram"); }
    finally { setBusy(false); }
  }

  async function syncInstagram(accountId: number) {
    setBusy(true);
    setInstagramError("");
    try {
      await api(`/api/setup/instagram/${accountId}/sync`, { method: "POST" });
      onFlash("Instagram conversation sync started");
    } catch (error) { setInstagramError(error instanceof Error ? error.message : "Could not sync Instagram conversations"); }
    finally { setBusy(false); }
  }

  async function setupAi(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAiError("");
    try {
      const result = await api<AiSetup & { runtime: Runtime }>("/api/setup/ai", {
        method: "POST",
        body: JSON.stringify({ provider: "openrouter", apiKey: aiApiKey.trim() || undefined, model: aiModel.trim() }),
      });
      setAiSetup(result);
      setAiModel(result.model);
      setAiApiKey("");
      setShowAiKey(false);
      setManageAi(false);
      onRuntime(result.runtime);
      onFlash(`OpenRouter connected with ${result.modelName ?? result.model}`);
    } catch (error) { setAiError(error instanceof Error ? error.message : "OpenRouter setup failed"); }
    finally { setBusy(false); }
  }

  async function loadAiModels() {
    const apiKey = aiApiKey.trim();
    setModelsBusy(true);
    setModelsError("");
    setAiError("");
    try {
      const result = await api<{ models: AiModel[] }>("/api/setup/ai/models", apiKey ? {
        method: "POST",
        body: JSON.stringify({ apiKey }),
      } : undefined);
      setAiModels(result.models);
      if (!result.models.some((model) => model.id === aiModel)) setAiModel("openrouter/auto");
    } catch (error) { setModelsError(error instanceof Error ? error.message : "Could not load OpenRouter models"); }
    finally { setModelsBusy(false); }
  }

  async function disconnectAi() {
    setBusy(true);
    setAiError("");
    try {
      const result = await api<AiSetup & { runtime: Runtime }>("/api/setup/ai", { method: "DELETE" });
      setAiSetup(result);
      setAiApiKey("");
      setAiModel("openrouter/auto");
      setAiModels([]);
      setModelsError("");
      setShowAiKey(false);
      setManageAi(false);
      onRuntime(result.runtime);
      onFlash(result.configured ? "OpenRouter removed; server provider restored" : "OpenRouter disconnected");
    } catch (error) { setAiError(error instanceof Error ? error.message : "Could not disconnect OpenRouter"); }
    finally { setBusy(false); }
  }

  async function saveSettings() { if (!settings) return; setBusy(true); try { const result = await api<{ settings: SettingsValue; runtime: Runtime }>("/api/settings", { method: "PATCH", body: JSON.stringify(settings) }); setSettings(result.settings); onRuntime(result.runtime); onFlash("AI settings saved"); } catch (error) { onFlash(error instanceof Error ? error.message : "Could not save settings"); } finally { setBusy(false); } }
  const businessConnection = telegram?.businessConnection;
  const businessReady = Boolean(businessConnection?.connected && businessConnection.canReply);
  const businessNeedsPermission = Boolean(businessConnection?.connected && !businessConnection.canReply);
  const botName = telegram?.bot?.username ?? telegram?.bot?.first_name ?? "Telegram bot";
  const connectionForm = <form className="telegram-form" onSubmit={setupTelegram}>
    <label className="field wide"><span>Bot token</span><div className="secret-input"><KeyRound size={17} /><input name="telegram-token" type={showToken ? "text" : "password"} value={botToken} onChange={(event) => setBotToken(event.target.value)} placeholder={telegram?.configured ? "Enter a new token to replace the saved one" : "Paste the token from @BotFather"} autoComplete="off" required={!telegram?.configured} /><button type="button" onClick={() => setShowToken((shown) => !shown)} aria-label={showToken ? "Hide bot token" : "Show bot token"}>{showToken ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><small className="field-hint">The token is encrypted before it is saved. It is never returned to the browser.</small></label>
    <label className="field wide"><span>Public OpenChat URL</span><input name="telegram-public-url" type="url" value={publicUrl} onChange={(event) => setPublicUrl(event.target.value)} placeholder="https://chat.example.com" required /><small className="field-hint">Telegram uses this HTTPS address to deliver new messages.</small></label>
    {telegramError ? <div className="settings-error" role="alert">{telegramError}</div> : null}
    <div className="settings-actions"><button className="button primary" disabled={busy || (!botToken.trim() && !telegram?.configured) || !publicUrl.trim()}>{busy ? "Connecting…" : telegram?.configured ? "Save and reconnect" : "Connect Telegram"}</button>{telegram?.source === "dashboard" ? <button className="button secondary disconnect-button" type="button" disabled={busy} onClick={disconnectTelegram}>Disconnect</button> : null}</div>
  </form>;
  return <section className={`page ${tab === "ai" ? "assistant-builder-page" : ""}`}><PageHeader eyebrow={tab === "ai" ? "Assistant" : tab === "operations" ? "Reliability" : "Installation"} title={tab === "ai" ? "Build and test your assistant" : tab === "operations" ? "Operations" : "Settings"} description={tab === "ai" ? "Tune its behavior and test every change before customers see it." : tab === "operations" ? "Inspect durable work and recover failures without losing customer messages." : "Connect channels and configure this self-hosted instance."} /><div className={`settings-layout ${tab === "ai" ? "assistant-mode" : ""}`}><aside><button className={tab === "channels" ? "active" : ""} onClick={() => setTab("channels")}>Channels</button><button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>AI assistant</button><button className={tab === "operations" ? "active" : ""} onClick={() => setTab("operations")}>Operations</button></aside><div className={`settings-content ${tab === "ai" ? "ai-workspace" : ""}`}>{tab === "channels" ? telegram === null ? <ChannelSettingsLoading /> : <>
    <section className={`settings-section telegram-section ${manageTelegram ? "telegram-manage" : ""}`}>{telegram?.bot ? !manageTelegram ? <div className="telegram-summary"><div className="connected-channel"><span className="logo-box"><ChannelLogo channel="telegram" size={28} /></span><span><b>Telegram</b><small>@{botName}</small></span><em><i />Connected</em><button type="button" onClick={() => setManageTelegram(true)}>Manage</button></div><div className="capability-summary"><span className="ready"><Check size={13} />Bot inbox active</span><span className={businessReady ? "ready" : businessNeedsPermission ? "attention" : ""}>{businessReady ? <Check size={13} /> : <MoreHorizontal size={13} />}{businessReady ? "Business profile active" : businessNeedsPermission ? "Business profile needs permission" : "Business profile not set up"}</span></div></div> : <><header><div><h2>Telegram</h2><p>Choose where OpenChat receives messages, or update the underlying connection.</p></div><button className="button secondary" type="button" onClick={() => { setManageTelegram(false); setSetupSecretary(false); }}>Done</button></header>
      <div className="connected-account"><span className="logo-box"><ChannelLogo channel="telegram" size={28} /></span><span><b>@{botName}</b><small>Connected bot · credentials encrypted on this server</small></span></div>
      <section className="telegram-capabilities" aria-labelledby="telegram-capabilities-title"><div className="settings-subheading"><span id="telegram-capabilities-title">Ways to receive messages</span><small>Bot inbox is active automatically. Business profile access is optional.</small></div>
        <div className="capability-row"><span className="capability-icon ready"><Check size={16} /></span><span><b>Bot inbox</b><small>Receive messages sent directly to @{botName}.</small></span><em className="feature-status ready">Active</em></div>
        <div className="capability-row"><span className={`capability-icon ${businessReady ? "ready" : businessNeedsPermission ? "attention" : ""}`}>{businessReady ? <Check size={16} /> : <Bot size={16} />}</span><span><b>Telegram Business profile <i>Secretary Mode</i></b><small>{businessConnection?.connected ? <>{businessConnection.displayName}{businessConnection.username ? ` · @${businessConnection.username}` : ""}</> : "Reply to customers who message your business profile."}</small></span><em className={`feature-status ${businessReady ? "ready" : businessNeedsPermission ? "attention" : ""}`}>{businessReady ? "Active" : businessNeedsPermission ? "Permission needed" : "Optional"}</em>{!businessReady ? <button className="button secondary feature-action" type="button" onClick={() => setSetupSecretary(true)}>{businessNeedsPermission ? "Fix permissions" : setupSecretary ? "Setup open" : "Set up"}</button> : null}</div>
        {(setupSecretary || businessNeedsPermission) && !businessReady ? <div className="secretary-setup"><header><div><b>Set up Secretary Mode</b><p>Connect your Telegram Business profile to this bot.</p></div><button type="button" aria-label="Close Secretary Mode setup" onClick={() => setSetupSecretary(false)}>×</button></header><ol className="secretary-steps"><li><span>{telegram.bot.can_connect_to_business ? <Check size={14} /> : "1"}</span><p>{telegram.bot.can_connect_to_business ? <><b>Business Mode is enabled</b> for @{botName}.</> : <>Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>, choose this bot, then turn on <b>Bot Settings → Business Mode</b>.</>}</p></li><li><span>2</span><p>In Telegram, open <b>Settings → Telegram Business → Chatbots</b> and add @{botName}.</p></li><li><span>3</span><p>Allow <b>Reply to messages</b> and choose which private chats OpenChat may handle.</p></li></ol><div className="settings-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => void loadTelegram()}><RefreshCw size={15} />Check connection</button><small>OpenChat also checks automatically.</small></div></div> : null}
      </section>
      <details className="connection-details"><summary><span><b>Connection settings</b><small>Webhook URL, token rotation, and disconnect</small></span><ChevronRight size={17} /></summary><div className="connection-details-body">{connectionForm}</div></details>
    </> : <><header><div><h2>Connect Telegram</h2><p>Paste the token from @BotFather. OpenChat validates it before storing anything.</p></div><span className="connection-state"><i />{telegram?.configured ? "Needs attention" : "Not connected"}</span></header>{connectionForm}</>}
    </section>
    <section className="settings-section instagram-section">
      <header><div><h2>Instagram</h2><p>Connect professional accounts through Meta&apos;s official Instagram Login.</p></div>{instagram?.appConfigured ? <button className="button primary" type="button" disabled={busy} onClick={() => void connectInstagram()}>{busy ? "Opening…" : instagram.accounts.length ? "Add account" : "Connect Instagram"}</button> : null}</header>
      {instagram === null ? <p>Checking Instagram configuration…</p> : <>
        {instagram.accounts.map((account) => <div className="connected-channel" key={account.id}><span className="logo-box"><ChannelLogo channel="instagram" size={28} /></span><span><b>@{account.username}</b><small>{account.displayName || "Instagram professional account"}{account.tokenExpiresAt ? ` · token expires ${new Date(account.tokenExpiresAt).toLocaleDateString()}` : ""}</small></span><em><i className={account.webhookSubscribed && !account.lastError ? "" : "not-ready"} />{account.webhookSubscribed && !account.lastError ? "Connected" : "Needs attention"}</em><div className="channel-actions"><button type="button" disabled={busy} onClick={() => void syncInstagram(account.id)}>Sync</button><button className="disconnect-button" type="button" disabled={busy} onClick={() => void disconnectInstagram(account.id)}>Disconnect</button></div>{account.lastError ? <div className="settings-error" role="alert">{account.lastError}</div> : null}</div>)}
        {!instagram.accounts.length && instagram.appConfigured ? <div className="provider-notice"><ShieldCheck size={16} /><span>No Instagram account is connected yet. Tokens are encrypted before they are stored.</span></div> : null}
        {!instagram.appConfigured ? <div className="settings-error" role="alert">Add the Instagram app ID, app secret, and webhook verify token to this installation before connecting an account.</div> : null}
        <details className="connection-details"><summary><span><b>Meta configuration URLs</b><small>Register these exact addresses in the Meta App Dashboard</small></span><ChevronRight size={17} /></summary><div className="connection-details-body"><label className="field wide"><span>OAuth callback</span><input readOnly value={instagram.callbackUrl} /></label><label className="field wide"><span>Webhook callback</span><input readOnly value={instagram.webhookUrl} /></label></div></details>
      </>}
      {instagramError ? <div className="settings-error" role="alert">{instagramError}</div> : null}
    </section>
  </> : tab === "ai" ? <>
    <AssistantTester settings={settings} configured={Boolean(runtime?.ai.configured)} model={aiSetup?.provider === "openrouter" ? aiSetup.model : runtime?.ai.model ?? ""} />
    <div className="ai-builder-panel">
      <header className="assistant-identity"><span><Bot size={22} /></span><div><h2>OpenChat AI</h2><p>Customer support and sales assistant</p></div><em className={runtime?.ai.configured ? "ready" : ""}><i />{runtime?.ai.configured ? "Ready to test" : "Provider needed"}</em></header>
      <div className="ai-builder-scroll">
        <section className="builder-section behavior-section"><header><div><span>Behavior</span><h2>How your assistant responds</h2><p>Changes are available immediately in the test chat.</p></div></header>{settings ? <div className="ai-settings"><label className="check-field automation-toggle" htmlFor="ai-automatic-replies" aria-label="Automatic replies"><span><b>Automatic replies</b><small>Reply while a conversation is in AI mode</small></span><input id="ai-automatic-replies" type="checkbox" checked={settings.aiEnabled} onChange={(event) => setSettings({ ...settings, aiEnabled: event.target.checked })} /></label><label className="field wide"><span>Assistant instructions</span><textarea value={settings.systemPrompt} onChange={(event) => setSettings({ ...settings, systemPrompt: event.target.value })} placeholder="Describe the assistant's role, tone, and boundaries…" /></label><label className="field wide"><span>Business knowledge</span><textarea className="knowledge" value={settings.businessContext} onChange={(event) => setSettings({ ...settings, businessContext: event.target.value })} placeholder="Products, prices, opening hours, policies, and FAQs…" /></label><label className="field wide"><span>Language</span><input value={settings.defaultLanguage} onChange={(event) => setSettings({ ...settings, defaultLanguage: event.target.value })} /></label></div> : <p>Loading settings…</p>}</section>
        <details className="builder-disclosure" open={manageAi || !runtime?.ai.configured}>
          <summary><span><small>Model &amp; provider</small><b>{aiSetup?.provider === "openrouter" && aiSetup.configured ? `OpenRouter · ${aiSetup.model}` : runtime?.ai.configured ? `${runtime.ai.model} · Server provider` : "Connect OpenRouter to start testing"}</b></span><ChevronRight size={18} /></summary>
          <section className="settings-section ai-provider-section">{aiSetup?.provider === "openrouter" && aiSetup.configured && !manageAi ? <div className="connected-channel"><span className="logo-box ai-logo"><Bot size={22} /></span><span><b>OpenRouter</b><small>{aiSetup.model}{aiSetup.key?.label ? ` · ${aiSetup.key.label}` : ""}</small></span><em><i />Connected</em><button type="button" onClick={() => setManageAi(true)}>Manage</button></div> : <><header><div><h2>{aiSetup?.provider === "openrouter" && aiSetup.configured ? "Manage OpenRouter" : "Connect OpenRouter"}</h2><p>Use one API key for models from OpenAI, Anthropic, Google, Meta, and others.</p></div><span className={`connection-state ${aiSetup?.provider === "openrouter" && aiSetup.configured && !aiSetup.error ? "ready" : ""}`}><i />{aiSetup?.provider === "openrouter" && aiSetup.configured ? aiSetup.error ? "Needs attention" : "Connected" : "Not connected"}</span></header>
            {aiSetup?.source === "environment" ? <div className="provider-notice"><ShieldCheck size={16} /><span>A server provider is active. OpenRouter will replace it for this installation.</span></div> : null}
            <form className="telegram-form" onSubmit={setupAi}>
              <label className="field wide"><span>OpenRouter API key</span><div className="secret-input"><KeyRound size={17} /><input name="openrouter-api-key" type={showAiKey ? "text" : "password"} value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder={aiSetup?.provider === "openrouter" && aiSetup.configured ? "Enter a new key to replace the saved one" : "sk-or-v1-…"} autoComplete="off" required={!(aiSetup?.provider === "openrouter" && aiSetup.configured)} /><button type="button" onClick={() => setShowAiKey((shown) => !shown)} aria-label={showAiKey ? "Hide OpenRouter API key" : "Show OpenRouter API key"}>{showAiKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><small className="field-hint">Validated, encrypted, and stored only on this server.</small></label>
              <div className="field wide model-field"><div className="model-field-heading"><span>Model</span><button type="button" disabled={modelsBusy || (!aiApiKey.trim() && !(aiSetup?.provider === "openrouter" && aiSetup.configured))} onClick={() => void loadAiModels()}>{modelsBusy ? "Loading…" : aiModels.length ? "Refresh models" : "Load models"}</button></div><ModelPicker models={aiModels} value={aiModel} loading={modelsBusy} error={modelsError} onRetry={() => void loadAiModels()} onChange={(model) => { setAiModel(model); setAiError(""); }} /><small className={`field-hint ${modelsError ? "error" : ""}`}>{modelsError || (aiModels.length ? `${aiModels.length} models available for this key. Search by company, model name, or ID.` : "Enter your key, then load the models available to your OpenRouter account.")}</small></div>
              {aiError ? <div className="settings-error" role="alert">{aiError}</div> : null}
              <div className="settings-actions"><button className="button primary" disabled={busy || !aiModel.trim() || (!aiApiKey.trim() && !(aiSetup?.provider === "openrouter" && aiSetup.configured))}>{busy ? "Checking…" : aiSetup?.provider === "openrouter" && aiSetup.configured ? "Save OpenRouter" : "Connect OpenRouter"}</button>{aiSetup?.provider === "openrouter" && aiSetup.configured ? <button className="button secondary" type="button" disabled={busy} onClick={() => { setAiApiKey(""); setShowAiKey(false); setAiError(""); setManageAi(false); }}>Cancel</button> : null}{aiSetup?.source === "dashboard" ? <button className="button secondary disconnect-button" type="button" disabled={busy} onClick={disconnectAi}>Disconnect</button> : null}</div>
            </form></>}
          </section>
        </details>
      </div>
      <footer className="ai-builder-footer"><span>Test your draft on the left before saving.</span><button className="button primary" disabled={busy || !settings} onClick={saveSettings}>{busy ? "Saving…" : "Save changes"}</button></footer>
    </div>
  </> : <OperationsPanel onFlash={onFlash} />}</div></div></section>;
}
