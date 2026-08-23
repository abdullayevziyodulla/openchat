import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy - OpenChat",
  description: "How this OpenChat installation collects, uses, stores, and deletes information.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="wordmark" href="/">openchat<span>.</span></Link>
        <h1>Privacy Policy</h1>
        <p>Last updated August 23, 2026.</p>
        <p>This OpenChat installation is operated by Ziyodulla Abdullayev in Uzbekistan. Questions and privacy requests can be sent to <a href="mailto:ziyodcoding@gmail.com">ziyodcoding@gmail.com</a>.</p>

        <h2>Scope</h2>
        <p>This policy applies to the OpenChat installation at <a href="https://openchat.zabdullayev.workers.dev">openchat.zabdullayev.workers.dev</a>. OpenChat is self-hosted, open-source software. This installation does not use a centralized OpenChat account service, advertising network, email list, or product telemetry service.</p>

        <h2>Information processed</h2>
        <p>When an Instagram professional account, Telegram bot, or AI provider is connected, the installation processes the identifiers, profile details, access credentials, configuration, and webhook events required for that connection. It stores customer and operator messages, usernames or display names supplied by the channel, attachments and attachment metadata, conversation status, automation configuration and results, and operational error records.</p>
        <p>Tracked OpenChat links store a daily salted hash derived from the visitor&apos;s IP address, plus limited referrer and user-agent information. Raw IP addresses are not stored for link analytics. Login protection similarly uses a derived identifier to rate-limit repeated failed sign-in attempts.</p>

        <h2>How information is used</h2>
        <p>Information is used only to operate the unified inbox, deliver requested messages and automations, maintain human takeover and messaging-window controls, secure the dashboard, diagnose failures, and provide aggregate campaign results. When the operator enables AI features, relevant conversation content and instructions may be sent to the AI provider configured by the operator to draft or improve a response.</p>

        <h2>Service providers</h2>
        <p>Cloudflare provides the Worker runtime, D1 database, R2 media storage, networking, and operational infrastructure for this installation. Meta/Instagram and Telegram process channel data under their own terms when their services are connected. An operator-configured AI provider, currently supported through OpenRouter, processes only the content submitted when an AI feature is used. These providers may process data in other countries under their own privacy terms.</p>

        <h2>Retention and security</h2>
        <p>Channel credentials and AI-provider keys are encrypted before they are stored and remain until the connection is removed or the credentials are replaced. OAuth setup records are short-lived. Conversation records, configuration, analytics, and operational records remain in the installation until they are deleted by the operator or in response to a verified request, unless longer retention is required for security or legal reasons.</p>
        <p>Instagram media uploaded by the operator is stored in a private R2 bucket and automatically expires after 90 days. Provider-hosted attachments may stop being available earlier under the provider&apos;s rules. Limited recovery copies may remain temporarily in infrastructure backups according to the provider&apos;s recovery practices.</p>

        <h2 id="data-deletion">Access and data deletion</h2>
        <p>To request access, correction, export, or deletion, email <a href="mailto:ziyodcoding@gmail.com?subject=OpenChat%20data%20request">ziyodcoding@gmail.com</a> with the subject “OpenChat data request.” Include the Instagram or Telegram account or username involved and enough information to locate the conversation. Do not send passwords or access tokens.</p>
        <p>The operator may ask for reasonable verification before disclosing or deleting data. After verification, the operator will remove the matching local conversation data, stored media, analytics identifiers, and connected-account records that are not required to be retained by law. Disconnecting an Instagram account or Telegram bot also stops future collection through that connection.</p>

        <h2>Your responsibility when messaging</h2>
        <p>Instagram and Telegram users remain responsible for the content they choose to send through those services. Businesses connecting an account to this installation are responsible for providing any notices or obtaining any permissions required for their own customer communications.</p>

        <h2>Changes</h2>
        <p>This policy may be updated when the installation, connected services, or legal requirements change. The date above identifies the latest version.</p>
      </article>
    </main>
  );
}
