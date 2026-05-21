import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendTelegramTest } from "@/lib/telegram";

// Send a Telegram test message using the credentials from the settings form
// (no need to save first). Session-gated; admin-only via the proxy.
export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { botToken, chatId } = await req.json();
    if (!botToken || !chatId) {
      return NextResponse.json({ error: "Укажите токен бота и chat_id" }, { status: 400 });
    }
    const res = await sendTelegramTest(String(botToken).trim(), String(chatId).trim());
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error || "Telegram отклонил запрос" },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Telegram test failed:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
