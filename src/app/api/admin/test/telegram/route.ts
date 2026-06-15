import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegramTest } from "@/lib/telegram";
import { SECRET_MASK } from "@/lib/secret-mask";

// Send a Telegram test message using the credentials from the settings form
// (no need to save first). Session-gated; admin-only via the proxy.
export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { botToken, chatId } = await req.json();
    // The form sends the mask (or nothing) when the admin hasn't re-typed the
    // saved token — fall back to the stored value so "test" still works without
    // the plaintext ever round-tripping through the browser.
    let token = typeof botToken === "string" ? botToken.trim() : "";
    if (!token || token === SECRET_MASK) {
      const stored = await prisma.settings.findUnique({ where: { key: "telegram_bot_token" } });
      token = stored?.value?.trim() || "";
    }
    if (!token || !chatId) {
      return NextResponse.json({ error: "Укажите токен бота и chat_id" }, { status: 400 });
    }
    const res = await sendTelegramTest(token, String(chatId).trim());
    if (!res.ok) {
      // 400, not 502 — the failure is in the upstream Telegram call / config,
      // and the client shows res.error in an alert.
      return NextResponse.json(
        { error: res.error || "Telegram отклонил запрос" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Telegram test failed:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
