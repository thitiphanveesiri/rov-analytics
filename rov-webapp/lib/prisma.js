import { PrismaClient } from "@prisma/client";

// Prevent multiple Prisma Client instances in dev (Next.js hot reload)
// and in serverless environments where each invocation could otherwise
// open a fresh connection.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
