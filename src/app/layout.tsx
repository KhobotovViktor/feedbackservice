import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Аллея Мебели — Сервис сбора отзывов",
  description: "Официальный сервис сбора отзывов компании «Аллея Мебели». Ваше мнение помогает нам становиться лучше.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.className} antialiased noise-overlay min-h-screen bg-slate-50 text-slate-900`}>
        <div className="mesh-gradient" />
        {children}
      </body>
    </html>
  );
}
