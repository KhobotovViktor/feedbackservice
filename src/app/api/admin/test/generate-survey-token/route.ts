import { NextRequest, NextResponse } from "next/server";
import { createSurveyToken } from "@/lib/auth-utils";
import { jwtVerify } from "jose";

const secretKey = "admin_secret_key_change_me_in_prod";
const key = new TextEncoder().encode(process.env.AUTH_SECRET || secretKey);

export async function GET(req: NextRequest) {
  try {
    // Basic admin check (verify session cookie)
    const session = req.cookies.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    try {
      await jwtVerify(session, key);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    
    if (!branchId) {
      return NextResponse.json({ error: "Missing branchId" }, { status: 400 });
    }

    // Generate a test token
    // We'll use "TEST_CLIENT" and "TEST_DEAL" 
    const token = await createSurveyToken("TEST_CLIENT", "TEST_DEAL", branchId);
    
    return NextResponse.json({ 
      url: `${req.nextUrl.origin}/survey/${token}`,
      token 
    });
  } catch (error) {
    console.error("Test token generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
