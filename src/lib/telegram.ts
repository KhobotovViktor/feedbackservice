import { prisma } from "@/lib/prisma";

// Optional duplicate channel for negative-feedback alerts via a Telegram bot.
// Configured from Settings (telegram_bot_token / telegram_chat_id) — degrades
// to a no-op when not set. Uses the Bot HTTP API directly (no dependency).

async function postTelegram(
  token: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: Boolean(j?.ok), error: j?.description };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getTelegramConfig(): Promise<{ token: string; chatId: string }> {
  const [t, c] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "telegram_bot_token" } }),
    prisma.settings.findUnique({ where: { key: "telegram_chat_id" } }),
  ]);
  return { token: t?.value?.trim() || "", chatId: c?.value?.trim() || "" };
}

/** Send a message using the stored config. Returns false if not configured. */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const { token, chatId } = await getTelegramConfig();
  if (!token || !chatId) return false;
  return (await postTelegram(token, chatId, text)).ok;
}

/** Send a test message with explicit credentials (used by the settings UI). */
export async function sendTelegramTest(
  token: string,
  chatId: string
): Promise<{ ok: boolean; error?: string }> {
  return postTelegram(
    token,
    chatId,
    "✅ Тестовое сообщение от сервиса отзывов. Уведомления о негативе настроены."
  );
}
