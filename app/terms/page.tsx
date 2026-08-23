import type { Metadata } from "next";
import Link from "next/link";

const repository = process.env.NEXT_PUBLIC_OPENCHAT_REPOSITORY_URL?.trim()
  || "https://github.com/abdullayevziyodulla/openchat";

export const metadata: Metadata = {
  title: "Terms - OpenChat",
  description: "Terms for using this OpenChat installation.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="wordmark" href="/">openchat<span>.</span></Link>
        <h1>Terms of Use</h1>
        <p>Last updated August 23, 2026.</p>
        <p>These terms apply to the OpenChat installation operated by Ziyodulla Abdullayev at <a href="https://openchat.zabdullayev.workers.dev">openchat.zabdullayev.workers.dev</a>. Contact: <a href="mailto:ziyodcoding@gmail.com">ziyodcoding@gmail.com</a>.</p>

        <h2>Purpose and access</h2>
        <p>This installation is a self-hosted communication tool for accounts controlled or authorized by the operator. The dashboard is not a public account-registration service. You may not attempt to bypass authentication, interfere with the service, misuse connected accounts, send unlawful or deceptive messages, or use the installation in a way that violates Meta, Instagram, Telegram, Cloudflare, an AI provider, or applicable law.</p>

        <h2>Connected services</h2>
        <p>Instagram, Telegram, Cloudflare, OpenRouter, and any selected AI model are independent third-party services with their own terms, policies, availability, and limits. Access to an OpenChat feature does not grant additional rights to use those services. The operator may disable a connection or automation to protect users, comply with provider rules, or address security and delivery failures.</p>

        <h2>Messages and AI assistance</h2>
        <p>The person or business sending a message is responsible for its content and for having authority to communicate through the connected account. AI output can be incomplete or incorrect and must not be treated as professional, legal, medical, financial, or safety advice. Human review is recommended before relying on AI output or using it in a sensitive situation.</p>

        <h2>Privacy and deletion</h2>
        <p>Information is handled as described in the <Link href="/privacy">Privacy Policy</Link>, including the process for access and deletion requests. Deleting or disconnecting information from this installation does not automatically delete copies independently retained by Instagram, Telegram, an AI provider, or a message recipient.</p>

        <h2>Open source license</h2>
        <p>The source code is available under the license included in the <a href={repository} target="_blank" rel="noreferrer">OpenChat repository</a>. That license controls use and distribution of the source code.</p>

        <h2>Availability and warranty</h2>
        <p>This installation and the open-source software are provided on an “as available” basis. Availability, uninterrupted delivery, compatibility, data preservation, and error-free operation are not guaranteed. To the extent permitted by applicable law, the operator is not responsible for indirect or consequential loss caused by service interruption, provider action, unauthorized use, automation configuration, or reliance on generated content.</p>

        <h2>Suspension and changes</h2>
        <p>Access may be suspended or ended to maintain security, comply with law or provider rules, or discontinue the installation. These terms may be updated when the installation or its legal obligations change. Continued use after an update means the updated terms apply.</p>

        <h2>Governing law</h2>
        <p>These terms are governed by the laws of the Republic of Uzbekistan, without limiting rights that cannot lawfully be excluded. Questions can be sent to <a href="mailto:ziyodcoding@gmail.com">ziyodcoding@gmail.com</a>.</p>
      </article>
    </main>
  );
}
