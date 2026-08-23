import type { Metadata } from "next";
import { headers } from "next/headers";
import "./dashboard.css";

const title = "OpenChat Dashboard — Instagram and Telegram inbox";
const description = "Manage Instagram and Telegram conversations, automations, AI replies, contacts, and human takeover from your self-hosted OpenChat instance.";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3001";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-openchat.png`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1672, height: 941, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
