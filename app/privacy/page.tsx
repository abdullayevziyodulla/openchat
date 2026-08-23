import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — OpenChat",
  description: "How a self-hosted OpenChat installation handles information.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="wordmark" href="/">openchat<span>.</span></Link>
        <h1>Privacy</h1>
        <p>Last updated August 16, 2026.</p>
        <p>OpenChat is self-hosted software. This source distribution does not include telemetry, a centralized account service, an email list, or a hosted analytics service.</p>
        <h2>Installation data</h2>
        <p>Your installation stores the channel connections, conversations, messages, settings, and operational records needed to provide the features you configure. The installation operator controls that data and its retention.</p>
        <h2>Connected services</h2>
        <p>Meta/Instagram, Telegram, and any AI provider you connect receive data according to the actions you enable and their own terms. Review those services and your legal obligations before processing customer conversations.</p>
        <h2>Your choices</h2>
        <p>Requests to access, correct, export, or delete information must be directed to the operator of the OpenChat installation you used.</p>
        <h2>For operators</h2>
        <p>Before publishing an installation, replace or extend this notice so it accurately describes your organization, data flows, retention rules, contact method, and jurisdiction.</p>
      </article>
    </main>
  );
}
