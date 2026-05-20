import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

// Lazy key initialization — проверка происходит в runtime, а не во время сборки
let _key: Uint8Array | null = null;
function getKey(): Uint8Array {
  if (!_key) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("AUTH_SECRET environment variable is not set.");
    }
    _key = new TextEncoder().encode(secret);
  }
  return _key;
}

export async function encrypt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getKey());
}

export async function decrypt(input: string): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(input, getKey(), {
    algorithms: ["HS256"],
  });
  return payload as Record<string, unknown>;
}

export async function getSession() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    return await decrypt(session);
  } catch {
    return null;
  }
}

export type SessionRole = "ADMIN" | "MANAGER";

export async function login(
  username: string,
  role: SessionRole = "ADMIN",
  userId?: string
) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await encrypt({
    username,
    role,
    userId,
    expires: expires.toISOString(),
  });
  const isProduction = process.env.NODE_ENV === "production";

  (await cookies()).set("session", session, {
    expires,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Typed view of the current session for role-aware server code.
 * Defaults role to ADMIN for legacy sessions issued before roles existed.
 */
export async function getCurrentUser(): Promise<
  { username: string; role: SessionRole; userId?: string } | null
> {
  const s = await getSession();
  if (!s || typeof s.username !== "string") return null;
  return {
    username: s.username,
    role: s.role === "MANAGER" ? "MANAGER" : "ADMIN",
    userId: typeof s.userId === "string" ? s.userId : undefined,
  };
}

export async function logout() {
  (await cookies()).set("session", "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
  });
}

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Migration helpers: detect and verify legacy SHA-256 (unsalted) hashes
export function isSha256Hash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

export function verifySha256Password(password: string, hash: string): boolean {
  return createHash("sha256").update(password).digest("hex") === hash;
}
