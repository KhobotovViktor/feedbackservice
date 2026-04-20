import { SignJWT, jwtVerify } from "jose";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set.");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

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
    .sign(JWT_SECRET);
}

export async function createQRToken(branchId?: string | null) {
  const uniqueId = `QR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await new SignJWT({ clientId: uniqueId, dealId: uniqueId, branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifySurveyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
