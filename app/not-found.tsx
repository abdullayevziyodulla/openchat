import Link from "next/link";

export default function NotFound() {
  return (
    <main className="legal-page">
      <article>
        <Link className="wordmark" href="/">openchat<span>.</span></Link>
        <h1>That page is not here.</h1>
        <p>The conversation may have moved. Head back to OpenChat and keep exploring.</p>
        <p><Link className="brutal-button dark" href="/">Back to OpenChat →</Link></p>
      </article>
    </main>
  );
}
