import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { branchId, dealId = "TEST_DEAL_" + Date.now(), contactId = "TEST_CONTACT" } = await req.json();

    if (!branchId) return NextResponse.json({ error: "Missing branchId" }, { status: 400 });

    const webhookUrl = `${req.nextUrl.origin}/api/b24/webhook?dealId=${dealId}&contactId=${contactId}&branchId=${branchId}&isTest=true`;

    const res = await fetch(webhookUrl, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Simulation failed" }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      link: data.surveyUrl || data.url || data.link,
      message: "Сделка имитирована. Ссылка сгенерирована и (если настроено) отправлена в CRM/Чат."
    });
  } catch (error) {
    console.error("E2E Simulation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
