import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function isSafeB24Url(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host === "0.0.0.0" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return false;
    return host.includes("bitrix24.");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId, webhookUrl } = await req.json();

    if (!webhookUrl || !chatId) {
      return NextResponse.json({ error: "Необходимы URL вебхука и ID чата" }, { status: 400 });
    }

    if (!isSafeB24Url(webhookUrl)) {
      return NextResponse.json({ error: "Недопустимый URL вебхука" }, { status: 400 });
    }

    const cleanBaseUrl = webhookUrl.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");
    const dialogId = chatId.trim().startsWith("chat") ? chatId.trim() : `chat${chatId.trim()}`;

    const testMessage = `🚀 [b]ТЕСТ УВЕДОМЛЕНИЙ[/b]\n\nСистема обратной связи настроена корректно!\nЭто сообщение подтверждает работоспособность интеграции с чатом.`;

    const response = await fetch(`${cleanBaseUrl}/im.message.add.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        DIALOG_ID: dialogId,
        MESSAGE: testMessage,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return NextResponse.json(
        {
          error: result.error_description || result.error || "Ошибка API Битрикс24",
          details: result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Test notification failed:", error);
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}
