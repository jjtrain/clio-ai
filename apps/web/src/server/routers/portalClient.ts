import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { generateMagicToken, generateSessionToken } from "@/lib/portal-engine";

export const portalClientRouter = router({
  // ==========================================
  // AUTH
  // ==========================================

  requestMagicLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findUnique({ where: { email: input.email } });
      if (!user || !user.isActive) return { sent: true }; // Don't reveal if account exists

      const token = generateMagicToken();
      await ctx.db.clientPortalUser.update({
        where: { id: user.id },
        data: {
          loginToken: token,
          loginTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // TODO: Send email with magic link containing token
      console.log(`[Portal] Magic link for ${input.email}: /portal/login?token=${token}`);
      return { sent: true };
    }),

  loginWithMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.clientPortalUser.findFirst({
        where: {
          loginToken: input.token,
          loginTokenExpiry: { gte: new Date() },
          isActive: true,
        },
        include: { client: { select: { name: true } } },
      });

      if (!user) throw new Error("Invalid or expired link");

      // Create session
      const sessionToken = generateSessionToken();
      await ctx.db.portalSession.create({
        data: {
          portalUserId: user.id,
          token: sessionToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });

      // Clear magic link token, update last login
      await ctx.db.clientPortalUser.update({
        where: { id: user.id },
        data: { loginToken: null, loginTokenExpiry: null, lastLoginAt: new Date() },
      });

      // Get matters
      const matterAccess = await ctx.db.portalMatterAccess.findMany({
        where: { portalUserId: user.id, isActive: true },
      });

      return {
        sessionToken,
        user: { id: user.id, name: user.name, email: user.email, clientId: user.clientId },
        matterIds: matterAccess.map((a) => a.matterId),
      };
    }),

  getSession: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.portalSession.findUnique({
        where: { token: input.sessionToken },
        include: { portalUser: { select: { id: true, name: true, email: true, clientId: true, firmId: true } } },
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }

      return { user: session.portalUser, sessionId: session.id };
    }),

  logout: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.portalSession.updateMany({
        where: { token: input.sessionToken },
        data: { isActive: false },
      });
      return { success: true };
    }),

  // ==========================================
  // DASHBOARD
  // ==========================================

  getDashboard: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      const access = await ctx.db.portalMatterAccess.findMany({
        where: { portalUserId: session.portalUserId, isActive: true },
      });

      const matters = [];
      for (const a of access) {
        const matter = await ctx.db.matter.findUnique({
          where: { id: a.matterId },
          select: { id: true, name: true, practiceArea: true, status: true, pipelineStage: true },
        });
        if (!matter) continue;

        const unreadMessages = await ctx.db.clientPortalMessage.count({
          where: { matterId: a.matterId, direction: "FIRM_TO_CLIENT", isRead: false },
        });

        const latestUpdate = await ctx.db.portalStatusUpdate.findFirst({
          where: { matterId: a.matterId, isPublished: true },
          orderBy: { publishedAt: "desc" },
          select: { title: true, publishedAt: true },
        });

        const checklist = await ctx.db.portalChecklist.findFirst({
          where: { matterId: a.matterId },
          select: { totalItems: true, completedItems: true },
        });

        matters.push({
          ...matter,
          unreadMessages,
          latestUpdate,
          checklistProgress: checklist ? { total: checklist.totalItems, completed: checklist.completedItems } : null,
        });
      }

      const unreadNotifications = await ctx.db.portalNotification.count({
        where: { portalUserId: session.portalUserId, isRead: false },
      });

      return { matters, unreadNotifications };
    }),

  // ==========================================
  // MATTER VIEWS
  // ==========================================

  getMatterOverview: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      const matter = await ctx.db.matter.findUnique({
        where: { id: input.matterId },
        select: { id: true, name: true, practiceArea: true, status: true, pipelineStage: true, openDate: true, party1Name: true, party2Name: true },
      });

      const statusUpdates = await ctx.db.portalStatusUpdate.findMany({
        where: { matterId: input.matterId, isPublished: true },
        orderBy: { publishedAt: "desc" },
        take: 10,
      });

      const upcomingEvents = await ctx.db.calendarEvent.findMany({
        where: { matterId: input.matterId, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 5,
        select: { id: true, title: true, startTime: true, endTime: true, location: true, eventType: true },
      });

      return { matter, statusUpdates, upcomingEvents };
    }),

  getMatterMessages: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      return ctx.db.clientPortalMessage.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
    }),

  sendMessage: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string(), body: z.string(), subject: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      return ctx.db.clientPortalMessage.create({
        data: {
          clientPortalUserId: session.portalUserId,
          matterId: input.matterId,
          direction: "CLIENT_TO_FIRM",
          subject: input.subject,
          content: input.body,
        },
      });
    }),

  getMatterDocuments: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      const where: any = { matterId: input.matterId, isVisible: true };
      if (input.category) where.category = input.category;

      return ctx.db.portalDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  uploadDocument: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      matterId: z.string(),
      fileName: z.string(),
      category: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      const user = await ctx.db.clientPortalUser.findUnique({ where: { id: session.portalUserId } });

      return ctx.db.portalDocument.create({
        data: {
          matterId: input.matterId,
          portalUserId: session.portalUserId,
          fileName: input.fileName,
          category: input.category || "client_uploads",
          description: input.description,
          uploaderType: "client",
          firmId: user?.firmId || "demo-firm",
        },
      });
    }),

  getMatterChecklist: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      return ctx.db.portalChecklist.findFirst({
        where: { matterId: input.matterId },
      });
    }),

  updateChecklistItem: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      checklistId: z.string(),
      itemId: z.string(),
      isCompleted: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      const checklist = await ctx.db.portalChecklist.findUnique({ where: { id: input.checklistId } });
      if (!checklist) throw new Error("Checklist not found");

      const items = checklist.items as any[];
      const item = items.find((i) => i.id === input.itemId);
      if (item) {
        item.isCompleted = input.isCompleted;
        item.completedAt = input.isCompleted ? new Date().toISOString() : null;
      }

      const completedItems = items.filter((i) => i.isCompleted).length;

      return ctx.db.portalChecklist.update({
        where: { id: input.checklistId },
        data: { items, completedItems },
      });
    }),

  getMatterInvoices: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      return ctx.db.invoice.findMany({
        where: { matterId: input.matterId, status: { not: "DRAFT" } },
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          total: true,
          amountPaid: true,
          status: true,
        },
      });
    }),

  getMatterEvents: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      return ctx.db.calendarEvent.findMany({
        where: { matterId: input.matterId, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 10,
        select: { id: true, title: true, startTime: true, endTime: true, location: true, eventType: true, description: true },
      });
    }),

  getStatusHistory: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      return ctx.db.portalStatusUpdate.findMany({
        where: { matterId: input.matterId, isPublished: true },
        orderBy: { publishedAt: "desc" },
      });
    }),

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  getNotifications: publicProcedure
    .input(z.object({ sessionToken: z.string(), unreadOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      const where: any = { portalUserId: session.portalUserId };
      if (input.unreadOnly) where.isRead = false;

      return ctx.db.portalNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  markNotificationRead: publicProcedure
    .input(z.object({ sessionToken: z.string(), notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await validateSession(ctx.db, input.sessionToken);

      return ctx.db.portalNotification.update({
        where: { id: input.notificationId },
        data: { isRead: true, readAt: new Date() },
      });
    }),

  // ==========================================
  // FEEDBACK
  // ==========================================

  submitFeedback: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      matterId: z.string().optional(),
      ratingType: z.enum(["satisfaction", "nps", "service_quality"]),
      score: z.number().min(0).max(10),
      comment: z.string().optional(),
      isAnonymous: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      const user = await ctx.db.clientPortalUser.findUnique({ where: { id: session.portalUserId } });

      return ctx.db.portalFeedback.create({
        data: {
          portalUserId: session.portalUserId,
          matterId: input.matterId,
          ratingType: input.ratingType,
          score: input.score,
          comment: input.comment,
          isAnonymous: input.isAnonymous || false,
          firmId: user?.firmId || "demo-firm",
        },
      });
    }),

  // ==========================================
  // PROFILE
  // ==========================================

  updateProfile: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      preferredLanguage: z.string().optional(),
      timezone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await validateSession(ctx.db, input.sessionToken);
      if (!session) throw new Error("Unauthorized");

      const { sessionToken, ...updates } = input;
      const name = updates.firstName && updates.lastName ? `${updates.firstName} ${updates.lastName}` : undefined;

      return ctx.db.clientPortalUser.update({
        where: { id: session.portalUserId },
        data: { ...updates, ...(name ? { name } : {}) },
      });
    }),

  // ==========================================
  // THEME
  // ==========================================

  getTheme: publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.portalBrandingTheme.findUnique({
        where: { practiceArea: input.practiceArea },
      });
    }),
});

// Helper
async function validateSession(db: any, sessionToken: string) {
  const session = await db.portalSession.findUnique({
    where: { token: sessionToken },
  });
  if (!session || !session.isActive || session.expiresAt < new Date()) return null;
  return session;
}
