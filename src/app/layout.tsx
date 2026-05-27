import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import "./globals.css";

// Cyrillic + Latin so the whole (Russian) UI renders in Inter rather than
// falling back to a system font. Manrope is the display face for big headings.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800"], variable: "--font-manrope", display: "swap" });

// Public origin, baked in at build time (.env.production). Used as the base
// for OG/canonical URLs. metadataBase lets Next resolve relative metadata
// URLs against the right host instead of a hard-coded deploy domain.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://feedback.alleyadoma.ru";

// Read the configured brand once on the server side and weave it into the
// document <head>: title in the browser tab, favicon, OG/Twitter previews.
// Settings.brand_logo_url accepts a relative path (/logo.png), a remote URL,
// or a data: URL (uploaded via the Branding picker). All three are valid
// `<link rel="icon">` hrefs, so we just pass it through.
export async function generateMetadata(): Promise<Metadata> {
  let brandName = "Сервис сбора отзывов";
  let brandLogo: string | null = null;
  try {
    const rows = await prisma.settings.findMany({
      where: { key: { in: ["brand_name", "brand_logo_url"] } },
    });
    for (const r of rows) {
      if (r.key === "brand_name" && r.value?.trim()) brandName = r.value.trim();
      else if (r.key === "brand_logo_url" && r.value?.trim()) brandLogo = r.value.trim();
    }
  } catch {
    // Fresh installs / DB unreachable → fall back to the bundled defaults.
  }

  const title = `${brandName} — Сервис обратной связи`;
  const description = `Сервис сбора обратной связи для клиентов «${brandName}». Ваше мнение помогает нам стать лучше.`;

  return {
    metadataBase: new URL(APP_URL),
    title,
    description,
    keywords: ["отзывы", "обратная связь", "оценка сервиса", brandName],
    authors: [{ name: brandName }],
    icons: brandLogo
      ? {
          icon: [{ url: brandLogo }],
          shortcut: [{ url: brandLogo }],
          apple: [{ url: brandLogo }],
        }
      : undefined,
    openGraph: {
      title,
      description,
      url: APP_URL,
      siteName: brandName,
      locale: "ru_RU",
      type: "website",
      ...(brandLogo ? { images: [{ url: brandLogo }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(brandLogo ? { images: [brandLogo] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
    verification: {
      google: "jJMcCKm-mwWvCClj9MetJ9wSJYTJnZfFRnGQCkFjG6A",
    },
  };
}

// Reading x-nonce causes Next.js App Router to automatically apply the nonce
// to all inline scripts it generates (hydration bootstrap, etc.).
// The nonce itself is generated per-request in src/proxy.ts.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="ru">
      <body className={`${inter.variable} ${manrope.variable} font-sans antialiased noise-overlay min-h-screen bg-slate-50 text-slate-900`}>
        {/* No-FOUC: apply the saved theme before hydration. Honours only an
            explicit choice, so the public survey stays light for customers. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <div className="mesh-gradient" />
        {children}
      </body>
    </html>
  );
}
