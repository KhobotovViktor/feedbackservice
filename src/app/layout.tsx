import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Feedback Service",
  description: "Оставьте отзыв о нашей работе",
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
