import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Lightweight "who am I" for the client nav to show role-appropriate links.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ username: me.username, role: me.role });
}
