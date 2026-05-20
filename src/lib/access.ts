import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Branch IDs the current user may see.
 *   - null  → no restriction (ADMIN sees everything)
 *   - []    → MANAGER with no branches assigned (sees nothing)
 *   - [...] → MANAGER's assigned branch ids
 *
 * Server-only helper for filtering dashboard / results queries by role.
 */
export async function getAccessibleBranchIds(): Promise<string[] | null> {
  const me = await getCurrentUser();
  if (!me || me.role === "ADMIN") return null;
  if (!me.userId) return [];
  const u = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { branches: { select: { id: true } } },
  });
  return u?.branches.map((b) => b.id) ?? [];
}
