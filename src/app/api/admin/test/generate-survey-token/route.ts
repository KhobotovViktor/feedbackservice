import { NextRequest, NextResponse } from "next/server";
import { createSurveyToken } from "@/lib/auth-utils";
import { getSession } from "@/lib/auth";
import { getAppOrigin } from "@/lib/url";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ error: "Missing branchId" }, { status: 400 });
    }

    const token = await createSurveyToken("TEST_CLIENT", "TEST_DEAL", branchId, true);

    // Use the public origin (not req.nextUrl.origin — that reflects the
    // internal HOSTNAME/PORT and produces broken https://localhost:3000 URLs
    // when running behind nginx).
    return NextResponse.redirect(`${getAppOrigin(req)}/survey/${token}`);
  } catch (error) {
    console.error("Test token generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
