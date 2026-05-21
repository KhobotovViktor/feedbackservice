import { NextRequest, NextResponse } from "next/server";
import { createSurveyToken } from "@/lib/auth-utils";
import { getSession } from "@/lib/auth";
import { getAppOrigin } from "@/lib/url";

// Test the "pick your city" CRM scenario, mirroring the per-branch test.
// We mint a CRM-style test token (entityType="deal", isTest=true, no branch)
// so the survey page shows the city-selection step regardless of whether the
// scenario toggle is currently on. Nothing is persisted (isTest short-circuits
// the survey POST handler).
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = await createSurveyToken(
      "TEST_CLIENT",
      "TEST_DEAL",
      null,
      true,
      null,
      null,
      "deal"
    );

    return NextResponse.redirect(`${getAppOrigin(req)}/survey/${token}`);
  } catch (error) {
    console.error("City test token generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
