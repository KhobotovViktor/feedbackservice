import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Cities power the "pick your city" step for CRM survey links. Each city is
// attached to a branch, which supplies the questions and review-map links.
// Admin-gated by proxy.ts (the path is not in the public allowlist and is
// listed as admin-only, so MANAGER sessions are blocked).

export async function GET() {
  try {
    const cities = await prisma.city.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(cities);
  } catch (error) {
    console.error("FETCH_CITIES_ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch cities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Название города обязательно" }, { status: 400 });
    }

    const city = await prisma.city.create({
      data: { name, branchId: body.branchId || null },
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(city);
  } catch (error) {
    console.error("CREATE_CITY_ERROR:", error);
    return NextResponse.json({ error: "Failed to create city" }, { status: 500 });
  }
}
