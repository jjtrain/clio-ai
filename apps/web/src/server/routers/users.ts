import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

const DEFAULT_USER_EMAIL = "admin@clio.local";

export async function ensureDefaultUser(db: PrismaClient) {
  const existing = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  const passwordHash = await hash("password123", 12);
  return db.user.create({
    data: {
      email: DEFAULT_USER_EMAIL,
      name: "Default User",
      passwordHash,
      firmName: "My Firm",
    },
  });
}

export const usersRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    let users = await ctx.db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    // Auto-create a default user if none exist
    if (users.length === 0) {
      const defaultUser = await ensureDefaultUser(ctx.db);
      users = [{ id: defaultUser.id, name: defaultUser.name, email: defaultUser.email }];
    }

    return { users };
  }),

  getFirmInfo: publicProcedure.query(async ({ ctx }) => {
    // Try Settings table first
    try {
      const settings = await ctx.db.settings.findUnique({ where: { id: "default" } });
      if (settings?.firmName) {
        return {
          firmName: settings.firmName || "",
          email: settings.email || "",
          phone: settings.phone || "",
          address: settings.address || "",
        };
      }
    } catch {
      // Settings table may not exist yet, fall through to User
    }

    // Fall back to User model
    const user = await ctx.db.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!user) {
      const defaultUser = await ensureDefaultUser(ctx.db);
      return {
        firmName: defaultUser.firmName || "",
        email: defaultUser.email,
        phone: defaultUser.phone || "",
        address: defaultUser.address || "",
      };
    }
    return {
      firmName: user.firmName || "",
      email: user.email,
      phone: user.phone || "",
      address: user.address || "",
    };
  }),

  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        firmName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      const passwordHash = await hash(input.password, 12);

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          firmName: input.firmName,
        },
      });

      return { id: user.id, email: user.email, name: user.name };
    }),

  getProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          email: true,
          name: true,
          firmName: true,
          phone: true,
          address: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    }),

  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        firmName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...data } = input;

      if (data.email) {
        const existingUser = await ctx.db.user.findFirst({
          where: {
            email: data.email,
            NOT: { id: userId },
          },
        });

        if (existingUser) {
          throw new Error("Email is already in use");
        }
      }

      const user = await ctx.db.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          firmName: true,
          phone: true,
          address: true,
        },
      });

      return user;
    }),

  changePassword: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { compare } = await import("bcryptjs");

      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const isValid = await compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new Error("Current password is incorrect");
      }

      const passwordHash = await hash(input.newPassword, 12);

      await ctx.db.user.update({
        where: { id: input.userId },
        data: { passwordHash },
      });

      return { success: true };
    }),
});
