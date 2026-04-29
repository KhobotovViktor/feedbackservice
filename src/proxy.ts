import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Lazy key initialization — не бросает во время сборки
let _key: Uint8Array | null = null;
function getKey(): Uint8Array | null {
  if (_key) return _key;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  _key = new TextEncoder().encode(secret);
  return _key;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1. Пропускаем статические ресурсы
  if (
    path.includes(".") ||
    path.startsWith("/_next") ||
    path.startsWith("/icons/") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Публичные маршруты — не требуют авторизации
  const isPublicPath =
    path === "/" ||
    path === "/login" ||
    path === "/privacy" ||
    path === "/terms" ||
    path.startsWith("/survey") ||
    path.startsWith("/s/") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/surveys") ||
    path.startsWith("/api/b24/webhook") ||
    path.startsWith("/api/test-b24-notification") ||
    // Sync-запросы с API ключом (внешние интеграции)
    path.startsWith("/api/rating-bridge") ||
    path.startsWith("/api/sync-manual");

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 3. Если AUTH_SECRET не задан — сервер неправильно настроен
  const key = getKey();
  if (!key) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 4. Проверяем сессию
  const session = req.cookies.get("session")?.value;

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(session, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
