import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/geist";
import "./globals.css";

const title = "OpenChat — Open-source Instagram and Telegram inbox";
const description = "Self-hosted Instagram and Telegram inbox with bring-your-own AI, durable automations, and human-controlled replies.";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-openchat.png`;

  return {
    title,
    description,
    icons: {
      icon: "/openchat-symbol.png",
      apple: "/openchat-symbol.png",
    },
    openGraph: { title, description, images: [{ url: image, width: 1672, height: 941, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
