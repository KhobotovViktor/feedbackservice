import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// Cyrillic + Latin so the whole (Russian) UI renders in Inter rather than
// falling back to a system font. Manrope is the display face for big headings.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800"], variable: "--font-manrope", display: "swap" });

// Public origin, baked in at build time (.env.production). Used as the base
// for OG/canonical URLs. metadataBase lets Next resolve relative metadata
// URLs against the right host instead of a hard-coded deploy domain.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://feedback.alleyadoma.ru";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Аллея Мебели — Сервис сбора отзывов",
  description: "Официальный сервис сбора обратной связи для клиентов сети мебельных салонов «Аллея Мебели». Ваше мнение помогает нам стать лучше.",
  keywords: ["отзывы", "аллея мебели", "обратная связь", "оценка сервиса"],
  authors: [{ name: "Аллея Мебели" }],
  openGraph: {
    title: "Аллея Мебели — Сервис сбора отзывов",
    description: "Поделитесь вашим мнением о нашей работе",
    url: APP_URL,
    siteName: "Аллея Фидбек",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Аллея Мебели — Сервис сбора отзывов",
    description: "Ваше мнение помогает нам стать лучше",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "jJMcCKm-mwWvCClj9MetJ9wSJYTJnZfFRnGQCkFjG6A",
  },
};

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
