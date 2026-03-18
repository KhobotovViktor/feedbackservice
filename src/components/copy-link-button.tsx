"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="px-8 py-4 glass-dark text-white border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all"
    >
      {copied ? "Скопировано!" : "Копировать прямую ссылку"}
    </button>
  );
}
