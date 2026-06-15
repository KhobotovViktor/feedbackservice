import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSafeB24Url } from "@/lib/b24-url";
import { SECRET_MASK } from "@/lib/secret-mask";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId, webhookUrl } = await req.json();

    // The webhook URL embeds a token, so the form sends the mask when it wasn't
    // re-typed — fall back to the stored value.
    let url = typeof webhookUrl === "string" ? webhookUrl : "";
    if (!url || url === SECRET_MASK) {
      const stored = await prisma.settings.findUnique({ where: { key: "b24_webhook_url" } });
      url = stored?.value || "";
    }

    if (!url || !chatId) {
      return NextResponse.json({ error: "Необходимы URL вебхука и ID чата" }, { status: 400 });
    }

    if (!isSafeB24Url(url)) {
      return NextResponse.json({ error: "Недопустимый URL вебхука" }, { status: 400 });
    }

    const cleanBaseUrl = url.replace(/\/$/, "").replace(/\/(profile\.json|profile)$/, "");
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
