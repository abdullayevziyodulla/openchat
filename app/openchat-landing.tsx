"use client";

import Image from "next/image";
import {
  ArrowRight,
  BrainCircuit,
  Camera,
  Check,
  ChevronLeft,
  Code2,
  Github,
  Heart,
  ImageIcon,
  Info,
  Layers3,
  Menu,
  MessageCircle,
  Mic,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./openchat-landing.css";

const repository = process.env.NEXT_PUBLIC_OPENCHAT_REPOSITORY_URL?.trim()
  || "https://github.com/your-account/openchat";

const productModes = [
  { id: "inbox", label: "Shared inbox", icon: MessageCircle },
  { id: "ai", label: "AI manager", icon: BrainCircuit },
  { id: "handoff", label: "Human handoff", icon: Users },
] as const;

type ProductMode = (typeof productModes)[number]["id"];
type Channel = "instagram" | "telegram";

const channelMessages: Record<Channel, Array<{ from: "customer" | "ai"; text: string }>> = {
  instagram: [
    { from: "customer", text: "Hi, is the linen set available in olive?" },
    { from: "ai", text: "Yes. Sizes S to XL are available. Size M can arrive tomorrow." },
    { from: "customer", text: "Perfect. Reserve one for me." },
  ],
  telegram: [
    { from: "customer", text: "Can I book a strategy call this Friday?" },
    { from: "ai", text: "Friday at 11:30 and 15:00 are open. Which time works better?" },
    { from: "customer", text: "11:30 works." },
  ],
};

function Brand({ priority = false }: { priority?: boolean }) {
  return (
    <a className="oc-brand" href="#top" aria-label="OpenChat home">
      <Image src="/openchat-symbol.png" alt="OpenChat" width={1254} height={1254} priority={priority} />
      <span className="oc-brand-wordmark">OpenChat</span>
    </a>
  );
}

function GitHubLink({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`oc-github${compact ? " compact" : ""}`} href={repository} target="_blank" rel="noreferrer">
      <Github size={18} aria-hidden="true" />
      <span>GitHub</span>
    </a>
  );
}

function PhonePreview({ channel }: { channel: Channel }) {
  return (
    <div className={`oc-phone ${channel}`} aria-label={`${channel} conversation preview on an iPhone`}>
      <div className="oc-phone-screen">
        <div className="oc-phone-status" aria-hidden="true">
          <time>9:41</time>
          <span className="oc-dynamic-island" />
          <span className="oc-phone-status-icons"><i /><i /><b /></span>
        </div>
        {channel === "instagram" ? (
          <header className="oc-instagram-header">
            <div className="oc-ig-header-main">
              <button type="button" aria-label="Back"><ChevronLeft size={21} /></button>
              <span className="oc-ig-avatar"><Image src="/icons/instagram.svg" alt="" width={24} height={24} /></span>
              <b>openchat.store<small>Active now</small></b>
            </div>
            <div className="oc-ig-header-actions">
              <button type="button" aria-label="Audio call"><Phone size={16} /></button>
              <button type="button" aria-label="Video call"><Video size={18} /></button>
              <button type="button" aria-label="Conversation details"><Info size={17} /></button>
            </div>
          </header>
        ) : (
          <header>
            <span>
              <Image src={`/icons/${channel}.svg`} alt="" width={24} height={24} />
              <b>OpenChat Store<small>Active now</small></b>
            </span>
            <em>•••</em>
          </header>
        )}
        <div className="oc-phone-feed">
          {channelMessages[channel].map((message, index) => (
            <p className={message.from} key={`${channel}-${index}`}>
              {message.from === "ai" && <small>✦ OPENCHAT AI</small>}
              {message.text}
            </p>
          ))}
        </div>
        {channel === "instagram" ? (
          <footer className="oc-instagram-composer">
            <button className="oc-ig-camera" type="button" aria-label="Open camera"><Camera size={15} /></button>
            <span>Message...</span>
            <button type="button" aria-label="Record voice message"><Mic size={15} /></button>
            <button type="button" aria-label="Add photo"><ImageIcon size={15} /></button>
            <button type="button" aria-label="Send heart"><Heart size={15} /></button>
          </footer>
        ) : (
          <footer>
            <span>Message…</span>
            <button type="button" aria-label="Send message"><Send size={14} /></button>
          </footer>
        )}
        <div className="oc-home-indicator" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}

function InboxPreview({ mode }: { mode: ProductMode }) {
  return (
    <div className="oc-workspace" aria-label="OpenChat product preview">
      <div className="oc-workspace-bar">
        <span><i /> OpenChat workspace</span>
        <div><b>AI online</b><span>•••</span></div>
      </div>
      <div className="oc-workspace-grid">
        <aside className="oc-sidebar">
          <div className="oc-mini-brand">oc<span>.</span></div>
          <button type="button" className="active"><MessageCircle size={16} /><span>Inbox</span><b>12</b></button>
          <button type="button"><Sparkles size={16} /><span>AI handling</span><b>8</b></button>
          <button type="button"><Users size={16} /><span>Needs you</span><b>3</b></button>
          <button type="button"><Workflow size={16} /><span>Automations</span></button>
          <div className="oc-sidebar-bottom"><span>OC</span><small>Admin</small></div>
        </aside>

        <div className="oc-thread-panel">
          <header><div><b>Inbox</b><small>All conversations</small></div><button type="button">⌕</button></header>
          {[
            ["JL", "Jordan Lee", "Do you ship internationally?", "2m", "instagram"],
            ["TR", "Taylor Reed", "Perfect, thank you.", "8m", "telegram"],
            ["AK", "Alex Kim", "Can I book Friday?", "12m", "instagram"],
            ["MD", "Morgan Diaz", "Can you deliver today?", "29m", "telegram"],
          ].map(([initials, name, message, time, channel], index) => (
            <button className={`oc-thread${index === 0 ? " active" : ""}`} type="button" key={name}>
              <span className={`oc-avatar avatar-${index}`}>{initials}</span>
              <span><b>{name}</b><small>{message}</small></span>
              <time>{time}</time>
              <Image src={`/icons/${channel}.svg`} alt="" width={16} height={16} />
            </button>
          ))}
        </div>

        <div className="oc-chat-panel">
          <header><div><span className="oc-avatar avatar-0">JL</span><span><b>Jordan Lee</b><small>Telegram · AI is replying</small></span></div><button type="button">Take over</button></header>
          <div className="oc-chat-body">
            <p className="oc-message customer">Hi, do you ship the linen set internationally?</p>
            <p className="oc-message ai"><span><Sparkles size={13} /> OpenChat AI</span>We do. Delivery options appear at checkout. Which color would you like?</p>
            <p className="oc-message customer">Olive, size M please.</p>
            {mode === "ai" && <div className="oc-mode-card"><BrainCircuit size={18} /><span><b>Answer grounded in 4 sources</b><small>Catalog · Delivery policy · Brand voice · FAQ</small></span></div>}
            {mode === "handoff" && <div className="oc-mode-card handoff"><Users size={18} /><span><b>Human review requested</b><small>High purchase intent · Assigned to you</small></span><button type="button">Open</button></div>}
          </div>
          <div className="oc-composer"><span>Write a message…</span><button type="button" aria-label="Send message"><Send size={15} /></button></div>
        </div>

        <aside className="oc-context-panel">
          <header>Customer context</header>
          <div className="oc-contact"><span className="oc-avatar avatar-0">JL</span><b>Jordan Lee</b><small>Returning customer</small></div>
          <dl><div><dt>Intent</dt><dd>Ready to buy</dd></div><div><dt>Product</dt><dd>Olive linen set</dd></div><div><dt>Size</dt><dd>M</dd></div><div><dt>Location</dt><dd>International</dd></div></dl>
          <div className="oc-summary"><span><Sparkles size={13} /> AI summary</span><p>Asked about availability and delivery. Ready to reserve size M.</p></div>
        </aside>
      </div>
    </div>
  );
}

export function OpenChatLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [productMode, setProductMode] = useState<ProductMode>("inbox");
  const [channel, setChannel] = useState<Channel>("telegram");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateNavbar = () => setNavScrolled(window.scrollY > 28);
    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });
    return () => window.removeEventListener("scroll", updateNavbar);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1051px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };

    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const firstLink = mobileMenuRef.current?.querySelector<HTMLAnchorElement>("a");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    firstLink?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="oc-page" id="top">
      <a className="oc-skip" href="#main">Skip to content</a>
      <div className="oc-source-bar">
        <span><Github size={15} /> Free and open source · AGPL 3.0</span>
        <a href={repository} target="_blank" rel="noreferrer">Steal our code (legally) <ArrowRight size={15} /></a>
      </div>

      <header className="oc-hero">
        <nav className={`oc-nav${navScrolled ? " scrolled" : ""}`} aria-label="Main navigation">
          <Brand priority />
          <div className="oc-nav-links">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#open-source">Open source</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="oc-nav-actions">
            <GitHubLink compact />
            <a className="oc-button dark small" href="/dashboard">Open dashboard <ArrowRight size={15} /></a>
            <button
              ref={menuButtonRef}
              className="oc-menu"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="oc-mobile-menu" id="mobile-navigation" ref={mobileMenuRef}>
            <button className="oc-mobile-menu-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
            <div className="oc-mobile-menu-links">
              <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
              <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
              <a href="#open-source" onClick={() => setMenuOpen(false)}>Open source</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            </div>
          </div>
        )}

        <div className="oc-hero-content">
          <p className="oc-eyebrow"><span>OPEN-SOURCE v0.2</span> Instagram and Telegram, one human-controlled inbox</p>
          <h1>Turn social chats<br />into customers.</h1>
          <p className="oc-hero-lede">Self-host OpenChat, answer with your business knowledge, and take over from AI whenever judgment matters.</p>
          <div className="oc-hero-actions">
            <a className="oc-button dark" href="/dashboard">Open your dashboard <ArrowRight size={17} /></a>
            <a className="oc-hero-github" href={repository} target="_blank" rel="noreferrer"><Github size={18} /> View source</a>
          </div>
          <div className="oc-trust-row"><span><Check size={15} /> Bring your own AI</span><span><Check size={15} /> Self host anywhere</span><span><Check size={15} /> Human takeover</span></div>
        </div>

        <div className="oc-hero-product">
          <div className="oc-float-note note-one"><Send size={20} /><span><small>VERSION 0.2</small><b>Instagram + Telegram</b></span></div>
          <div className="oc-float-note note-two"><Zap size={19} /><span><small>AI RESPONSE</small><b>Ready in 12 seconds</b></span></div>
          <InboxPreview mode="inbox" />
        </div>
      </header>

      <main id="main">
        <section className="oc-platform-strip" aria-label="Supported platforms">
          <p>Built for businesses that sell through conversation</p>
          <div><span><Image src="/icons/telegram.svg" alt="Telegram" width={24} height={24} /> Telegram</span><i /> <span><Image src="/icons/instagram.svg" alt="Instagram" width={24} height={24} /> Instagram · v0.2</span><i /> <span><Github size={19} /> Open source</span></div>
        </section>

        <section className="oc-problem oc-section">
          <div className="oc-section-intro"><p className="oc-kicker">THE BUYING MOMENT</p><h2>A customer should not wait while your team searches for an answer.</h2></div>
          <div className="oc-outcome-grid">
            <article><span><Zap size={23} /></span><h3>Answer while intent is hot</h3><p>Give customers a useful next step in seconds, even when your team is offline.</p></article>
            <article><span><Layers3 size={23} /></span><h3>Keep every chat organized</h3><p>See Instagram and Telegram conversations, context, delivery state, and AI ownership in one place.</p></article>
            <article><span><Users size={23} /></span><h3>Make handoffs feel human</h3><p>Bring in a teammate with the full thread, detected intent, and a suggested next action.</p></article>
          </div>
        </section>

        <section className="oc-product oc-section" id="product">
          <div className="oc-product-heading"><div><p className="oc-kicker">THE PRODUCT</p><h2>AI speed.<br />Human control.</h2></div><p>One workspace for the repetitive questions, the promising leads, and the conversations only your team should handle.</p></div>
          <div className="oc-mode-tabs" role="tablist" aria-label="Product capabilities">
            {productModes.map(({ id, label, icon: Icon }) => <button type="button" role="tab" aria-selected={productMode === id} className={productMode === id ? "active" : ""} onClick={() => setProductMode(id)} key={id}><Icon size={18} /> {label}</button>)}
          </div>
          <InboxPreview mode={productMode} />
        </section>

        <section className="oc-how oc-section" id="how">
          <div className="oc-how-copy"><p className="oc-kicker">LIVE IN MINUTES</p><h2>Connect.<br />Teach. Go live.</h2><p>No flow-builder maze. Start with the business knowledge and rules you already have.</p></div>
          <ol>
            <li><span>01</span><div><h3>Connect your channels</h3><p>Add Instagram professional accounts, a Telegram bot, or Telegram Business, then receive conversations in one inbox.</p></div><MessageCircle size={26} /></li>
            <li><span>02</span><div><h3>Add your knowledge</h3><p>Import products, services, prices, policies, FAQs, and examples of your tone.</p></div><BrainCircuit size={26} /></li>
            <li><span>03</span><div><h3>Set the handoff rules</h3><p>Choose what AI can handle and the moments that always need a person.</p></div><ShieldCheck size={26} /></li>
          </ol>
        </section>

        <section className="oc-channels oc-section">
          <div className="oc-channel-heading"><div><p className="oc-kicker">TWO CHANNELS, ONE INBOX</p><h2>Telegram foundations.<br />Instagram automation.</h2></div><div className="oc-channel-tabs" role="tablist" aria-label="Choose platform"><button type="button" role="tab" aria-selected={channel === "instagram"} className={channel === "instagram" ? "active" : ""} onClick={() => setChannel("instagram")}><Image src="/icons/instagram.svg" alt="" width={20} height={20} /> Instagram · v0.2</button><button type="button" role="tab" aria-selected={channel === "telegram"} className={channel === "telegram" ? "active" : ""} onClick={() => setChannel("telegram")}><Image src="/icons/telegram.svg" alt="" width={20} height={20} /> Telegram</button></div></div>
          <div className="oc-channel-stage">
            <div className="oc-channel-copy"><span>/ {channel}</span><h3>{channel === "instagram" ? "Turn comments and DMs into buying conversations." : "Turn community questions into qualified customers."}</h3><p>{channel === "instagram" ? "Answer product questions, story replies, and high-intent DMs with the right context and a clear next step." : "Welcome members, answer questions, qualify interest, and hand promising conversations to your team."}</p><ul><li><Check size={16} /> Instant answers from your knowledge</li><li><Check size={16} /> Lead fields saved automatically</li><li><Check size={16} /> Human takeover at any moment</li></ul></div>
            <PhonePreview channel={channel} />
          </div>
        </section>

        <section className="oc-oss oc-section" id="open-source">
          <div className="oc-oss-copy"><p className="oc-kicker">OPEN SOURCE BY DEFAULT</p><h2>Steal our code.<br /><span>Legally.</span></h2><p>Fork OpenChat, self-host it, connect your preferred AI provider, and keep control of the conversations your business depends on.</p><a className="oc-button sky" href={repository} target="_blank" rel="noreferrer"><Github size={18} /> Explore the repository <ArrowRight size={16} /></a></div>
          <div className="oc-code-card"><header><span><i /> <i /> <i /></span><b>openchat / README.md</b></header><pre><code><span># OpenChat</span>{"\n\n"}Self-hosted social inbox{"\n"}with human-controlled AI.{"\n\n"}<b>✓ Instagram + Telegram</b>{"\n"}<b>✓ Comment and DM automations</b>{"\n"}<b>✓ Durable recovery</b>{"\n\n"}$ git clone {repository}</code></pre><footer><Code2 size={16} /> AGPL-3.0</footer></div>
        </section>

        <section className="oc-principle">
          <p>People do not want a chatbot.</p>
          <h2>They want a fast, useful answer—and a real person when it matters.</h2>
        </section>

        <section className="oc-faq oc-section" id="faq">
          <div><p className="oc-kicker">STRAIGHT ANSWERS</p><h2>Questions before you connect.</h2></div>
          <div className="oc-faq-list">
            <details open><summary>Which channels does OpenChat support?<span>+</span></summary><p>Version 0.2 supports Instagram professional accounts, Telegram bots, and Telegram Business secretary mode.</p></details>
            <details><summary>Can I use my own AI provider?<span>+</span></summary><p>Yes. Bring your own provider credentials or connect an OpenAI-compatible endpoint. The goal is to keep model choice and billing under your control.</p></details>
            <details><summary>Can my team take over a conversation?<span>+</span></summary><p>At any moment. OpenChat keeps the complete thread and customer context visible so the handoff does not force the customer to repeat themselves.</p></details>
            <details><summary>Can I self-host OpenChat?<span>+</span></summary><p>Yes. Self-hosting is a first-class part of the project, not an enterprise add-on. Deployment documentation will live in the public repository.</p></details>
            <details><summary>Will the AI sound like our business?<span>+</span></summary><p>You provide the product information, policies, examples, and tone. OpenChat uses that knowledge to prepare grounded replies instead of generic scripts.</p></details>
            <details><summary>What does version 0.2 include?<span>+</span></summary><p>A unified inbox, encrypted channel credentials, Instagram comment and DM campaigns, tracked links, optional AI replies, durable takeover, attachments, analytics, and operator-visible retry tooling.</p></details>
          </div>
        </section>

        <section className="oc-final-cta" id="start">
          <div><p className="oc-kicker">SELF-HOST v0.2</p><h2>Your next customer is already typing.</h2><p>Clone the repository and run your own Instagram and Telegram inbox.</p></div>
          <a className="oc-button dark" href={repository} target="_blank" rel="noreferrer"><Github size={18} /> View setup guide <ArrowRight size={16} /></a>
        </section>
      </main>

      <footer className="oc-footer">
        <div><Brand /><p>Bring your own AI, self-host, and keep human control.</p></div>
        <div><b>Product</b><a href="#product">Shared inbox</a><a href="#product">AI manager</a><a href="#how">How it works</a></div>
        <div><b>Project</b><a href={repository} target="_blank" rel="noreferrer">GitHub</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
        <div className="oc-footer-bottom"><span>© 2026 OpenChat contributors</span><a href="#top">Back to top ↑</a></div>
      </footer>
    </div>
  );
}
