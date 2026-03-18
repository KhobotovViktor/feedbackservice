import { SignJWT } from "jose";

const secretKey = "admin_secret_key_change_me_in_prod";
const key = new TextEncoder().encode(process.env.AUTH_SECRET || secretKey);

export async function createQRToken(branchId?: string | null) {
  // Generic token for QR source
  return await new SignJWT({ clientId: "QR_GUEST", dealId: "QR_GUEST", branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(key);
}
