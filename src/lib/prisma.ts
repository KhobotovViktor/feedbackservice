import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// In dev: log every query for visibility while iterating.
// In production: only log warnings/errors — full query logging leaks PII
// (e.g. user passwords on User.findFirst, survey contents) to disk and
// hurts perf for no benefit in a hosted environment.
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
