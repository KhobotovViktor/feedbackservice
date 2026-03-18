import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secretKey = "admin_secret_key_change_me_in_prod";
const key = new TextEncoder().encode(process.env.AUTH_SECRET || secretKey);

export async function POST(req: NextRequest) {
  try {
    // ADMIN ONLY
    const session = req.cookies.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try { await jwtVerify(session, key); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

    const { branchId, dealId = "TEST_DEAL_" + Date.now(), contactId = "TEST_CONTACT" } = await req.json();

    if (!branchId) return NextResponse.json({ error: "Missing branchId" }, { status: 400 });

    // Simulate the Bitrix24 webhook call internally
    const webhookUrl = `${req.nextUrl.origin}/api/b24/webhook?dealId=${dealId}&contactId=${contactId}&branchId=${branchId}`;
    
    const res = await fetch(webhookUrl, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
       return NextResponse.json({ error: data.error || "Simulation failed" }, { status: res.status });
    }

    return NextResponse.json({ 
      success: true, 
      link: data.link,
      message: "Сделка имитирована. Ссылка сгенерирована и (если настроено) отправлена в CRM/Чат." 
    });
  } catch (error) {
    console.error("E2E Simulation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
