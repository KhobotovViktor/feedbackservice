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

    // Защита от open redirect: разрешаем только пути на собственном домене
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    let destination: URL;
    try {
      destination = new URL(shortLink.url);
    } catch {
      return new NextResponse("Invalid link", { status: 400 });
    }

    if (appUrl) {
      const allowed = new URL(appUrl);
      if (destination.hostname !== allowed.hostname) {
        console.error(`Blocked open redirect to external host: ${destination.hostname}`);
        return new NextResponse("Invalid link", { status: 400 });
      }
    }

    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Redirection error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
