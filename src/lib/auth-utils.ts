import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-change-me"
);

export async function createSurveyToken(clientId: string, dealId: string, branchId?: string | null) {
  const token = await new SignJWT({ clientId, dealId, branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(JWT_SECRET);
  return token;
}

export async function createQRToken(branchId?: string | null) {
  // Generic token for QR source
  return await new SignJWT({ clientId: "QR_GUEST", dealId: "QR_GUEST", branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifySurveyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { clientId: string; dealId: string; branchId?: string | null };
  } catch (error) {
    return null;
  }
}
