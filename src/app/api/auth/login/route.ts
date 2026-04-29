import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, isSha256Hash, verifySha256Password, hashPassword, login as setSession } from "@/lib/auth";

// In-memory rate limiter (сбрасывается при рестарте, достаточно для Edge/Serverless)
// Структура: IP -> { count: number; lockedUntil: number; windowStart: number }
const loginAttempts = new Map<string, { count: number; lockedUntil: number; windowStart: number }>();

const MAX_ATTEMPTS = 10;          // макс попыток в окне
const WINDOW_MS    = 15 * 60 * 1000; // окно 15 минут
const LOCKOUT_MS   = 30 * 60 * 1000; // блокировка 30 минут

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry) {
    // Снять блокировку по истечении lockout
    if (entry.lockedUntil > 0 && now < entry.lockedUntil) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    // Сброс окна
    if (now - entry.windowStart > WINDOW_MS) {
      loginAttempts.set(ip, { count: 1, lockedUntil: 0, windowStart: now });
      return { allowed: true, retryAfterSec: 0 };
    }
    // Превышение лимита
    if (entry.count >= MAX_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_MS;
      loginAttempts.set(ip, { ...entry, lockedUntil });
      return { allowed: false, retryAfterSec: Math.ceil(LOCKOUT_MS / 1000) };
    }
    // Инкремент
    loginAttempts.set(ip, { ...entry, count: entry.count + 1 });
  } else {
    loginAttempts.set(ip, { count: 1, lockedUntil: 0, windowStart: now });
  }

  return { allowed: true, retryAfterSec: 0 };
}

function resetAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSec } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: `Слишком много попыток. Повторите через ${Math.ceil(retryAfterSec / 60)} мин.` },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Необходимо указать имя пользователя и пароль" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // Use the same error message for both wrong username and wrong password
    // to prevent username enumeration attacks.
    const invalidCredentials = NextResponse.json(
      { error: "Неверное имя пользователя или пароль" },
      { status: 401 }
    );

    if (!user) {
      return invalidCredentials;
    }

    // Verify with bcrypt first; fall back to legacy SHA-256 for transparent migration
    let isValid = await verifyPassword(password, user.password);
    let needsUpgrade = false;

    if (!isValid && isSha256Hash(user.password)) {
      isValid = verifySha256Password(password, user.password);
      if (isValid) needsUpgrade = true;
    }

    if (!isValid) {
      return invalidCredentials;
    }

    // Upgrade legacy SHA-256 hash to bcrypt transparently
    if (needsUpgrade) {
      const newHash = await hashPassword(password);
      await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
    }

    // Успешный вход — сбросить счётчик попыток
    resetAttempts(ip);
    await setSession(username);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
