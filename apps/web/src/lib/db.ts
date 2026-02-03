import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Log environment info for debugging
  const hasDbUrl = !!process.env.DATABASE_URL;
  console.log(`[Prisma] Initializing client. DATABASE_URL present: ${hasDbUrl}`);

  if (!process.env.DATABASE_URL) {
    console.error("[Prisma] ERROR: DATABASE_URL environment variable is not set!");
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Test connection helper
export async function testDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Prisma] Database connection test failed:", message);
    return { ok: false, error: message };
  }
}
