import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export const clientPortalRouter = router({
  // ==================== ADMIN PROCEDURES ====================

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.clientPortalSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.clientPortalSettings.create({ data: { id: "default" } });
    }
    return settings;
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      firmName: z.string().optional(),
      firmLogo: z.string().optional(),
      primaryColor: z.string().optional(),
      welcomeMessage: z.string().optional(),
      allowMessaging: z.boolean().optional(),
      allowDocumentView: z.boolean().optional(),
      allowPayments: z.boolean().optional(),
      allowAppointmentView: z.boolean().optional(),
      requirePasswordChange: z.boolean().optional(),
      sessionTimeoutMinutes: z.number().min(5).max(1440).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = {};
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) data[key] = value;
      });
      return ctx.db.clientPortalSettings.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
      });
    }),

  listPortalUsers: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const users = await ctx.db.clientPortalUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      });

      return users;
    }),

  createPortalUser: publicProcedure
    .input(z.object({
      clientId: z.string(),
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists
      const existing = await ctx.db.clientPortalUser.findUnique({ where: { email: input.email } });
      if (existing) throw new Error("A portal user with this email already exists");

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await ctx.db.clientPortalUser.create({
        data: {
          clientId: input.clientId,
          email: input.email,
          name: input.name,
          passwordHash,
        },
      });

      return user;
    }),

  deactivateUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientPortalUser.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  activateUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientPortalUser.update({
        where: { id: input.id },
        data: { isActive: true },
      });
    }),

  resetPassword: publicProcedure
    .input(z.object({ id: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      return ctx.db.clientPortalUser.update({
        where: { id: input.id },
        data: { passwordHash },
      });
    }),

  deletePortalUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientPortalUser.delete({ where: { id: input.id } });
    }),

  // Admin: Send message to client
  sendMessage: publicProcedure
    .input(z.object({
      portalUserId: z.string(),
      matterId: z.string().optional(),
      subject: z.string().optional(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientPortalMessage.create({
        data: {
          clientPortalUserId: input.portalUserId,
          matterId: input.matterId || null,
          direction: "FIRM_TO_CLIENT" as any,
          subject: input.subject || null,
          content: input.content,
        },
      });
    }),

  // Admin: List messages for a portal user
  listMessages: publicProcedure
    .input(z.object({
      portalUserId: z.string().optional(),
      matterId: z.string().optional(),
      unreadOnly: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.portalUserId) where.clientPortalUserId = input.portalUserId;
      if (input.matterId) where.matterId = input.matterId;
      if (input.unreadOnly) where.isRead = false;

      return ctx.db.clientPortalMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          portalUser: { select: { id: true, name: true, email: true } },
          matter: { select: { id: true, name: true } },
        },
      });
    }),

  // Admin: Mark message as read
  markMessageRead: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientPortalMessage.update({
        where: { id: input.id },
        data: { isRead: true, readAt: new Date() },
      });
    }),

  // Admin: Get portal stats
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [totalUsers, activeUsers, unreadMessages, recentMessages] = await Promise.all([
      ctx.db.clientPortalUser.count(),
      ctx.db.clientPortalUser.count({ where: { isActive: true } }),
      ctx.db.clientPortalMessage.count({ where: { isRead: false, direction: "CLIENT_TO_FIRM" } }),
      ctx.db.clientPortalMessage.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { totalUsers, activeUsers, unreadMessages, recentMessages };
  }),

  // ==================== PORTAL (CLIENT-FACING) PROCEDURES ====================

  portalLogin: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findUnique({ where: { email: input.email } });
      if (!user) throw new Error("Invalid email or password");
      if (!user.isActive) throw new Error("Your account has been deactivated. Please contact the firm.");

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new Error("Invalid email or password");

      // Generate session token
      const loginToken = randomUUID();
      const loginTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await ctx.db.clientPortalUser.update({
        where: { id: user.id },
        data: { loginToken, loginTokenExpiry, lastLoginAt: new Date() },
      });

      return {
        token: loginToken,
        user: { id: user.id, name: user.name, email: user.email, clientId: user.clientId },
      };
    }),

  portalVerifyToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: {
          loginToken: input.token,
          loginTokenExpiry: { gt: new Date() },
          isActive: true,
        },
        include: { client: { select: { id: true, name: true } } },
      });

      if (!user) return null;
      return { id: user.id, name: user.name, email: user.email, clientId: user.clientId, clientName: user.client.name };
    }),

  portalGetMatters: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: { loginToken: input.token, loginTokenExpiry: { gt: new Date() }, isActive: true },
      });
      if (!user) throw new Error("Session expired. Please log in again.");

      return ctx.db.matter.findMany({
        where: { clientId: user.clientId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          matterNumber: true,
          status: true,
          practiceArea: true,
          openDate: true,
          _count: { select: { documents: true, events: true } },
        },
      });
    }),

  portalGetDocuments: publicProcedure
    .input(z.object({ token: z.string(), matterId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: { loginToken: input.token, loginTokenExpiry: { gt: new Date() }, isActive: true },
      });
      if (!user) throw new Error("Session expired. Please log in again.");

      const where: any = { matter: { clientId: user.clientId } };
      if (input.matterId) where.matterId = input.matterId;

      return ctx.db.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          matter: { select: { id: true, name: true } },
        },
      });
    }),

  portalGetInvoices: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: { loginToken: input.token, loginTokenExpiry: { gt: new Date() }, isActive: true },
      });
      if (!user) throw new Error("Session expired. Please log in again.");

      return ctx.db.invoice.findMany({
        where: { matter: { clientId: user.clientId } },
        orderBy: { createdAt: "desc" },
        include: {
          matter: { select: { id: true, name: true } },
        },
      });
    }),

  portalGetMessages: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: { loginToken: input.token, loginTokenExpiry: { gt: new Date() }, isActive: true },
      });
      if (!user) throw new Error("Session expired. Please log in again.");

      // Mark firm-to-client messages as read
      await ctx.db.clientPortalMessage.updateMany({
        where: { clientPortalUserId: user.id, direction: "FIRM_TO_CLIENT", isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      return ctx.db.clientPortalMessage.findMany({
        where: { clientPortalUserId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          matter: { select: { id: true, name: true } },
        },
      });
    }),

  portalSendMessage: publicProcedure
    .input(z.object({
      token: z.string(),
      subject: z.string().optional(),
      content: z.string().min(1),
      matterId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: { loginToken: input.token, loginTokenExpiry: { gt: new Date() }, isActive: true },
      });
      if (!user) throw new Error("Session expired. Please log in again.");

      return ctx.db.clientPortalMessage.create({
        data: {
          clientPortalUserId: user.id,
          matterId: input.matterId || null,
          direction: "CLIENT_TO_FIRM" as any,
          subject: input.subject || null,
          content: input.content,
        },
      });
    }),

  portalGetAppointments: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: { loginToken: input.token, loginTokenExpiry: { gt: new Date() }, isActive: true },
      });
      if (!user) throw new Error("Session expired. Please log in again.");

      return ctx.db.calendarEvent.findMany({
        where: {
          matterId: { not: null },
          matter: { clientId: user.clientId },
          startTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { startTime: "asc" },
        include: {
          matter: { select: { id: true, name: true } },
        },
      });
    }),

  portalLogout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.clientPortalUser.updateMany({
        where: { loginToken: input.token },
        data: { loginToken: null, loginTokenExpiry: null },
      });
      return { success: true };
    }),
});
