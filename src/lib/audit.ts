import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";

// Append an entry to the admin audit trail. Best-effort: failures are logged
// but never block the action being audited. The acting user is resolved from
// the session; username is snapshotted so it survives the user's deletion.
export async function logAudit(
  action: string,
  target?: string | null,
  details?: string | null
): Promise<void> {
  try {
    const me = await getCurrentUser();
    await prisma.auditLog.create({
      data: {
        userId: me?.userId ?? null,
        username: me?.username ?? null,
        action,
        target: target ?? null,
        details: details ?? null,
      },
    });
  } catch (e) {
    console.error("logAudit failed:", e);
  }
}
