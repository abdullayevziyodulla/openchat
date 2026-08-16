import type { Metadata } from "next";
import Link from "next/link";

const repository = process.env.NEXT_PUBLIC_OPENCHAT_REPOSITORY_URL?.trim()
  || "https://github.com/your-account/openchat";

export const metadata: Metadata = {
  title: "Terms — OpenChat",
  description: "Terms and operator responsibilities for OpenChat.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="wordmark" href="/">openchat<span>.</span></Link>
        <h1>Terms</h1>
        <p>Last updated August 16, 2026.</p>
        <p>OpenChat is open-source software, not a centrally operated hosted service. Each deployment is controlled by its operator.</p>
        <h2>Operator responsibility</h2>
        <p>Installation operators are responsible for access controls, notices, consent, retention, connected channel accounts, AI providers, business rules, and lawful use. AI-generated replies should be reviewed before use in sensitive situations.</p>
        <h2>No service warranty</h2>
        <p>The software is provided under its open-source license without a promise of uninterrupted availability, fitness for a particular purpose, or managed support.</p>
        <h2>Open source license</h2>
        <p>The source code is available under the license included in the <a href={repository} target="_blank" rel="noreferrer">OpenChat repository</a>. That license controls use and distribution of the source code.</p>
        <h2>Deployment terms</h2>
        <p>An operator publishing OpenChat should replace or extend this page with terms that accurately describe that deployment and provide the operator&apos;s contact information.</p>
      </article>
    </main>
  );
}
