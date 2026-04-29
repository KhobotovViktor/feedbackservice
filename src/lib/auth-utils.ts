import { SignJWT, jwtVerify } from "jose";

// Lazy key initialization — проверка происходит в runtime, а не во время сборки
let _jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (!_jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not set.");
    }
    _jwtSecret = new TextEncoder().encode(secret);
  }
  return _jwtSecret;
}

export async function createSurveyToken(
  clientId: string,
  dealId: string,
  branchId?: string | null,
  isTest: boolean = false,
  templateId?: string | null,
  responsibleName?: string | null
) {
  return await new SignJWT({ clientId, dealId, branchId, isTest, templateId, responsibleName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function createQRToken(branchId?: string | null) {
  const uniqueId = `QR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await new SignJWT({ clientId: uniqueId, dealId: uniqueId, branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifySurveyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as {
      clientId: string;
      dealId: string;
      branchId?: string | null;
      isTest?: boolean;
      templateId?: string | null;
      responsibleName?: string | null;
    };
  } catch {
    return null;
  }
}
