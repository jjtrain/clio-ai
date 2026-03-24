import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { syncCaseNumber, syncAllWatchedCases } from "@/lib/court-sync-engine";
import { parseICS } from "@/lib/court-adapters/ics-import";
import { listAdapters } from "@/lib/court-adapters";

export const courtCalendarRouter = router({
  // List court events for a matter or across all matters
  listEvents: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      courtName: z.string().optional(),
      eventType: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      const where: any = { firmId };
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.courtName) where.courtName = { contains: input.courtName, mode: "insensitive" };
      if (input?.eventType) where.eventType = input.eventType;
      if (input?.status) where.status = input.status;
      if (input?.startDate || input?.endDate) {
        where.scheduledAt = {};
        if (input?.startDate) where.scheduledAt.gte = new Date(input.startDate);
        if (input?.endDate) where.scheduledAt.lte = new Date(input.endDate);
      }

      return ctx.db.courtEvent.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        take: input?.limit || 100,
      });
    }),

  // Add a manual court event
  addManualEvent: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      eventType: z.string(),
      title: z.string().min(1),
      courtName: z.string().optional(),
      judgeAssigned: z.string().optional(),
      caseNumber: z.string().optional(),
      scheduledAt: z.string(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      return ctx.db.courtEvent.create({
        data: {
          firmId,
          source: "MANUAL",
          matterId: input.matterId || null,
          eventType: input.eventType,
          title: input.title,
          courtName: input.courtName,
          judgeAssigned: input.judgeAssigned,
          caseNumber: input.caseNumber,
          scheduledAt: new Date(input.scheduledAt),
          endTime: input.endTime ? new Date(input.endTime) : null,
          location: input.location,
          notes: input.notes,
          status: "SCHEDULED",
        },
      });
    }),

  // Update court event
  updateEvent: publicProcedure
    .input(z.object({
      id: z.string(),
      status: z.string().optional(),
      title: z.string().optional(),
      scheduledAt: z.string().optional(),
      notes: z.string().optional(),
      judgeAssigned: z.string().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const update: any = { ...data };
      if (data.scheduledAt) update.scheduledAt = new Date(data.scheduledAt);
      return ctx.db.courtEvent.update({ where: { id }, data: update });
    }),

  // Delete court event
  deleteEvent: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtEvent.delete({ where: { id: input.id } });
    }),

  // Import .ics file
  importICS: publicProcedure
    .input(z.object({
      icsContent: z.string(),
      matterId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      const events = parseICS(input.icsContent);
      let created = 0;
      let skipped = 0;

      for (const event of events) {
        // Check for duplicate by externalId
        const existing = await ctx.db.courtEvent.findFirst({
          where: { firmId, externalId: event.externalId, source: "IMPORT" },
        });
        if (existing) {
          skipped++;
          continue;
        }

        await ctx.db.courtEvent.create({
          data: {
            firmId,
            source: "IMPORT",
            matterId: input.matterId || null,
            externalId: event.externalId,
            eventType: event.eventType,
            title: event.title,
            courtName: event.courtName,
            judgeAssigned: event.judgeAssigned,
            caseNumber: event.caseNumber,
            scheduledAt: event.scheduledAt,
            endTime: event.endTime,
            location: event.location,
            notes: event.notes,
            syncedAt: new Date(),
          },
        });
        created++;
      }

      return { created, skipped, total: events.length };
    }),

  // Connect CourtListener search
  connectCourtListener: publicProcedure
    .input(z.object({
      caseNumber: z.string().min(1),
      matterId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      return syncCaseNumber(firmId, input.caseNumber, "COURTLISTENER", input.matterId);
    }),

  // Sync all watched cases now
  syncNow: publicProcedure.mutation(async ({ ctx }) => {
    const firmId = ctx.session?.firmId || "demo-firm";
    return syncAllWatchedCases(firmId);
  }),

  // List watched cases
  listWatchedCases: publicProcedure.query(async ({ ctx }) => {
    const firmId = ctx.session?.firmId || "demo-firm";
    const integrations = await ctx.db.courtIntegration.findMany({
      where: { firmId },
      orderBy: { updatedAt: "desc" },
    });
    return integrations.map((i) => ({
      ...i,
      caseNumbers: typeof i.caseNumbers === "string" ? JSON.parse(i.caseNumbers) : i.caseNumbers,
    }));
  }),

  // Add a watched case
  addWatchedCase: publicProcedure
    .input(z.object({
      provider: z.string(),
      caseNumber: z.string().min(1),
      matterId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";

      const existing = await ctx.db.courtIntegration.findUnique({
        where: { firmId_provider: { firmId, provider: input.provider } },
      });

      const newEntry = { caseNumber: input.caseNumber, matterId: input.matterId };

      if (existing) {
        const cases = (typeof existing.caseNumbers === "string"
          ? JSON.parse(existing.caseNumbers)
          : existing.caseNumbers) as any[];
        // Avoid duplicates
        if (!cases.some((c: any) => c.caseNumber === input.caseNumber)) {
          cases.push(newEntry);
        }
        return ctx.db.courtIntegration.update({
          where: { id: existing.id },
          data: { caseNumbers: cases as any },
        });
      }

      return ctx.db.courtIntegration.create({
        data: {
          firmId,
          provider: input.provider,
          caseNumbers: [newEntry] as any,
          status: "active",
        },
      });
    }),

  // Remove a watched case
  removeWatchedCase: publicProcedure
    .input(z.object({
      provider: z.string(),
      caseNumber: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      const existing = await ctx.db.courtIntegration.findUnique({
        where: { firmId_provider: { firmId, provider: input.provider } },
      });
      if (!existing) return null;

      const cases = (typeof existing.caseNumbers === "string"
        ? JSON.parse(existing.caseNumbers)
        : existing.caseNumbers) as any[];
      const filtered = cases.filter((c: any) => c.caseNumber !== input.caseNumber);

      return ctx.db.courtIntegration.update({
        where: { id: existing.id },
        data: { caseNumbers: filtered as any },
      });
    }),

  // List available adapters
  listAdapters: publicProcedure.query(() => {
    return listAdapters();
  }),
});
