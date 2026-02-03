import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/lib/db";

export const createTRPCContext = async () => {
  return {
    db,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Log errors in production for debugging
    if (process.env.NODE_ENV === "production") {
      console.error("[tRPC Error]", {
        code: shape.code,
        message: error.message,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
        path: shape.data?.path,
      });
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Middleware to handle database errors gracefully
const dbErrorHandler = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Check for Prisma/database errors
    if (error instanceof Error) {
      const message = error.message;

      // Connection errors
      if (
        message.includes("Can't reach database server") ||
        message.includes("Connection refused") ||
        message.includes("ECONNREFUSED") ||
        message.includes("Connection timed out")
      ) {
        console.error("[Database] Connection error:", message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed. Please try again later.",
          cause: error,
        });
      }

      // Environment variable errors
      if (message.includes("DATABASE_URL") || message.includes("environment variable")) {
        console.error("[Database] Configuration error:", message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not configured. Please check environment variables.",
          cause: error,
        });
      }
    }

    // Re-throw other errors
    throw error;
  }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(dbErrorHandler);
