import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { buildClientTimeline, generateClientEventDescription } from "@/lib/timeline-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const clientTimelineRouter = router({
  // ==========================================
  // TIMELINE QUERIES
  // ==========================================

  getTimeline: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return buildClientTimeline(input.matterId, DEFAULT_FIRM_ID);
    }),

  getTimelineEvents: publicProcedure
    .input(z.object({ matterId: z.string(), visibleOnly: z.boolean().optional().default(true) }))
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (input.visibleOnly) where.isVisibleToClient = true;
      return ctx.db.clientTimelineEvent.findMany({ where, orderBy: { date: "asc" } });
    }),

  // ==========================================
  // EVENT MANAGEMENT (Attorney)
  // ==========================================

  addEvent: publicProcedure
    .input(z.object({
      matterId: z.string(),
      eventType: z.string(),
      category: z.string(),
      timelineStatus: z.string(),
      title: z.string(),
      description: z.string().optional(),
      clientDescription: z.string().optional(),
      date: z.date(),
      endDate: z.date().optional(),
      isEstimatedDate: z.boolean().optional(),
      dateLabel: z.string().optional(),
      iconType: z.string().optional(),
      importance: z.string().optional(),
      isVisibleToClient: z.boolean().optional(),
      requiresClientAction: z.boolean().optional(),
      clientActionText: z.string().optional(),
      clientActionLink: z.string().optional(),
      phaseTag: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientTimelineEvent.create({
        data: {
          ...input,
          sourceType: "manual",
          createdBy: DEFAULT_USER_ID,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  updateEvent: publicProcedure
    .input(z.object({
      eventId: z.string(),
      title: z.string().optional(),
      clientDescription: z.string().optional(),
      timelineStatus: z.string().optional(),
      isVisibleToClient: z.boolean().optional(),
      importance: z.string().optional(),
      date: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { eventId, ...data } = input;
      return ctx.db.clientTimelineEvent.update({ where: { id: eventId }, data });
    }),

  deleteEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientTimelineEvent.delete({ where: { id: input.eventId } });
    }),

  toggleVisibility: publicProcedure
    .input(z.object({ eventId: z.string(), isVisible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientTimelineEvent.update({
        where: { id: input.eventId },
        data: { isVisibleToClient: input.isVisible },
      });
    }),

  completeClientAction: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientTimelineEvent.update({
        where: { id: input.eventId },
        data: { clientActionCompleted: true, clientActionCompletedAt: new Date() },
      });
    }),

  // ==========================================
  // AI ENHANCEMENT
  // ==========================================

  generateDescription: publicProcedure
    .input(z.object({ eventId: z.string(), practiceArea: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.clientTimelineEvent.findUnique({ where: { id: input.eventId } });
      if (!event) throw new Error("Event not found");

      const clientDesc = await generateClientEventDescription(event, input.practiceArea);
      return ctx.db.clientTimelineEvent.update({
        where: { id: input.eventId },
        data: { clientDescription: clientDesc },
      });
    }),

  // ==========================================
  // CONFIGURATION
  // ==========================================

  getConfig: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.timelineConfig.findUnique({ where: { matterId: input.matterId } });
    }),

  updateConfig: publicProcedure
    .input(z.object({
      matterId: z.string(),
      templateId: z.string().optional(),
      showEstimatedDates: z.boolean().optional(),
      showPhaseGroups: z.boolean().optional(),
      showDocuments: z.boolean().optional(),
      showPayments: z.boolean().optional(),
      showCorrespondence: z.boolean().optional(),
      showDeadlines: z.boolean().optional(),
      showClientActions: z.boolean().optional(),
      customWelcomeNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { matterId, ...data } = input;
      return ctx.db.timelineConfig.upsert({
        where: { matterId },
        create: { matterId, ...data, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID },
        update: data,
      });
    }),

  // ==========================================
  // TEMPLATES
  // ==========================================

  getTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true, OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      return ctx.db.timelineTemplate.findMany({ where, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
    }),

  createTemplate: publicProcedure
    .input(z.object({
      name: z.string(),
      practiceArea: z.string(),
      caseType: z.string().optional(),
      milestones: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.timelineTemplate.create({
        data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID },
      });
    }),

  // ==========================================
  // PORTAL (Client-facing)
  // ==========================================

  getPortalTimeline: publicProcedure
    .input(z.object({ sessionToken: z.string(), matterId: z.string() }))
    .query(async ({ input }) => {
      // In production, validate session token here
      return buildClientTimeline(input.matterId, DEFAULT_FIRM_ID);
    }),
});
