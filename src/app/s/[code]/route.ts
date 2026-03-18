import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const shortLink = await prisma.shortLink.findUnique({
      where: { code },
    });

    if (!shortLink) {
      return new NextResponse("Link not found", { status: 404 });
    }

    return NextResponse.redirect(new URL(shortLink.url));
  } catch (error) {
    console.error("Redirection error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
