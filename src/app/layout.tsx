import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="ru">
      <body className={`${inter.className} antialiased noise-overlay min-h-screen bg-slate-50 text-slate-900`}>
        <div className="mesh-gradient" />
        {children}
      </body>
    </html>
  );
}
