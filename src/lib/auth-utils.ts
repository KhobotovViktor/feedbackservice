import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-change-me"
);

export async function createSurveyToken(clientId: string, dealId: string, branchId?: string | null, isTest: boolean = false, templateId?: string | null, responsibleName?: string | null) {
  const token = await new SignJWT({ clientId, dealId, branchId, isTest, templateId, responsibleName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(JWT_SECRET);
  return token;
}

export async function createQRToken(branchId?: string | null) {
  // Generate a random ID so each scan is treated as a unique anonymous visit
  const uniqueId = `QR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await new SignJWT({ clientId: uniqueId, dealId: uniqueId, branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifySurveyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { clientId: string; dealId: string; branchId?: string | null; isTest?: boolean; templateId?: string | null; responsibleName?: string | null };
  } catch (error) {
    return null;
  }
}
