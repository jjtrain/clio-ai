import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { generateStatusUpdateDraft, generateClientChecklist, notifyStatusUpdate, notifyDocumentShared, notifyNewMessage, getPortalAnalytics } from "@/lib/portal-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

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

  // ==================== STATUS UPDATES ====================

  publishStatusUpdate: publicProcedure
    .input(z.object({
      matterId: z.string(),
      title: z.string(),
      body: z.string(),
      milestone: z.string().optional(),
      phase: z.string().optional(),
      phasePercentage: z.number().optional(),
      notifyClient: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const update = await ctx.db.portalStatusUpdate.create({
        data: {
          matterId: input.matterId,
          title: input.title,
          body: input.body,
          milestone: input.milestone,
          phase: input.phase,
          phasePercentage: input.phasePercentage,
          isPublished: true,
          isDraft: false,
          publishedAt: new Date(),
          notifyClient: input.notifyClient,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });

      if (input.notifyClient) {
        const access = await ctx.db.portalMatterAccess.findMany({ where: { matterId: input.matterId, isActive: true } });
        for (const a of access) {
          await notifyStatusUpdate(a.portalUserId, input.matterId, input.title).catch(() => {});
        }
      }

      return update;
    }),

  generateStatusUpdateDraft: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => {
      return generateStatusUpdateDraft(input.matterId, DEFAULT_FIRM_ID);
    }),

  getStatusUpdates: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.portalStatusUpdate.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
      });
    }),

  deleteStatusUpdate: publicProcedure
    .input(z.object({ updateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.portalStatusUpdate.delete({ where: { id: input.updateId } });
    }),

  // ==================== DOCUMENT SHARING ====================

  shareDocument: publicProcedure
    .input(z.object({
      matterId: z.string(),
      fileName: z.string(),
      fileUrl: z.string().optional(),
      category: z.string(),
      description: z.string().optional(),
      requiresSignature: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.portalDocument.create({
        data: {
          matterId: input.matterId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          category: input.category,
          description: input.description,
          requiresSignature: input.requiresSignature || false,
          uploaderType: "attorney",
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });

      const access = await ctx.db.portalMatterAccess.findMany({ where: { matterId: input.matterId, isActive: true } });
      for (const a of access) {
        await notifyDocumentShared(a.portalUserId, input.matterId, input.fileName).catch(() => {});
      }

      return doc;
    }),

  hideDocument: publicProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.portalDocument.update({ where: { id: input.documentId }, data: { isVisible: false } });
    }),

  getPortalDocuments: publicProcedure
    .input(z.object({ matterId: z.string(), uploaderType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (input.uploaderType) where.uploaderType = input.uploaderType;
      return ctx.db.portalDocument.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  // ==================== CHECKLISTS ====================

  generateChecklist: publicProcedure
    .input(z.object({ matterId: z.string(), practiceArea: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const items = generateClientChecklist(input.practiceArea);
      return ctx.db.portalChecklist.create({
        data: {
          matterId: input.matterId,
          title: `${input.practiceArea.replace(/_/g, " ")} Document Checklist`,
          practiceArea: input.practiceArea,
          items: items as any,
          totalItems: items.length,
          completedItems: 0,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  getChecklists: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.portalChecklist.findMany({ where: { matterId: input.matterId } });
    }),

  // ==================== BRANDING ====================

  getThemes: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.portalBrandingTheme.findMany({ orderBy: { practiceArea: "asc" } });
  }),

  updateTheme: publicProcedure
    .input(z.object({
      themeId: z.string(),
      colorPrimary: z.string().optional(),
      colorSecondary: z.string().optional(),
      colorAccent: z.string().optional(),
      colorBackground: z.string().optional(),
      welcomeHeading: z.string().optional(),
      welcomeSubtext: z.string().optional(),
      terminology: z.any().optional(),
      faqItems: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { themeId, ...data } = input;
      return ctx.db.portalBrandingTheme.update({ where: { id: themeId }, data });
    }),

  getThemeByPracticeArea: publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.portalBrandingTheme.findUnique({ where: { practiceArea: input.practiceArea } });
    }),

  // ==================== MATTER ACCESS ====================

  grantMatterAccess: publicProcedure
    .input(z.object({
      portalUserId: z.string(),
      matterId: z.string(),
      role: z.string().optional(),
      accessLevel: z.string().optional(),
      permissions: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.portalMatterAccess.upsert({
        where: { portalUserId_matterId: { portalUserId: input.portalUserId, matterId: input.matterId } },
        create: {
          portalUserId: input.portalUserId,
          matterId: input.matterId,
          role: input.role || "client",
          accessLevel: input.accessLevel || "standard",
          permissions: input.permissions,
        },
        update: {
          role: input.role,
          accessLevel: input.accessLevel,
          permissions: input.permissions,
          isActive: true,
          revokedAt: null,
        },
      });
    }),

  revokeMatterAccess: publicProcedure
    .input(z.object({ accessId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.portalMatterAccess.update({
        where: { id: input.accessId },
        data: { isActive: false, revokedAt: new Date() },
      });
    }),

  // ==================== ANALYTICS ====================

  getPortalAnalytics: publicProcedure.query(async () => {
    return getPortalAnalytics(DEFAULT_FIRM_ID);
  }),

  getFeedbackRatings: publicProcedure
    .input(z.object({ matterId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;

      return ctx.db.portalFeedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { portalUser: { select: { name: true } } },
      });
    }),
});
