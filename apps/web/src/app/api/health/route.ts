import { NextResponse } from "next/server";
import { db, testDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {},
  };

  // Check environment variables
  const envChecks = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
  };

  health.checks = { env: envChecks };

  // Test database connection
  try {
    const dbTest = await testDatabaseConnection();
    health.checks = {
      ...health.checks as object,
      database: {
        connected: dbTest.ok,
        error: dbTest.error || null,
      },
    };

    if (!dbTest.ok) {
      health.status = "degraded";
    }
  } catch (error) {
    health.status = "degraded";
    health.checks = {
      ...health.checks as object,
      database: {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }

  // Check if all required env vars are present
  if (!envChecks.DATABASE_URL) {
    health.status = "error";
    health.error = "DATABASE_URL is not configured";
  }

  const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
