import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { ConflictStatus, ConflictSearchType } from "@prisma/client";

export const conflictsRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        searchType: z.nativeEnum(ConflictSearchType).default("MANUAL"),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        triggeredBy: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const q = input.query.trim();
      if (!q) return { clients: [], matters: [], relatedParties: [], leads: [], intakeSubmissions: [], total: 0 };

      // Split query into words for broader matching
      const words = q.split(/\s+/).filter(Boolean);

      // Build OR conditions for each word
      const nameContains = words.map((w) => ({
        name: { contains: w, mode: "insensitive" as const },
      }));

      // Search Clients
      const clients = await ctx.db.client.findMany({
        where: {
          OR: [
            ...nameContains,
            ...words.map((w) => ({ email: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ phone: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ address: { contains: w, mode: "insensitive" as const } })),
          ],
        },
        take: 20,
        select: { id: true, name: true, email: true, phone: true, address: true, status: true },
      });

      // Search Matters
      const matters = await ctx.db.matter.findMany({
        where: {
          OR: [
            ...nameContains,
            ...words.map((w) => ({ description: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ matterNumber: { contains: w, mode: "insensitive" as const } })),
          ],
        },
        take: 20,
        include: { client: { select: { id: true, name: true } } },
      });

      // Search Related Parties
      const relatedParties = await ctx.db.relatedParty.findMany({
        where: {
          OR: [
            ...nameContains,
            ...words.map((w) => ({ email: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ phone: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ company: { contains: w, mode: "insensitive" as const } })),
          ],
        },
        take: 20,
        include: { matter: { select: { id: true, name: true, matterNumber: true } } },
      });

      // Search Leads
      const leads = await ctx.db.lead.findMany({
        where: {
          OR: [
            ...nameContains,
            ...words.map((w) => ({ email: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ phone: { contains: w, mode: "insensitive" as const } })),
          ],
        },
        take: 20,
        select: { id: true, name: true, email: true, phone: true, source: true, status: true },
      });

      // Search Intake Submissions
      const intakeSubmissions = await ctx.db.intakeFormSubmission.findMany({
        where: {
          OR: [
            ...words.map((w) => ({ submitterName: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ submitterEmail: { contains: w, mode: "insensitive" as const } })),
            ...words.map((w) => ({ submitterPhone: { contains: w, mode: "insensitive" as const } })),
          ],
        },
        take: 20,
        include: { template: { select: { name: true } } },
      });

      const total = clients.length + matters.length + relatedParties.length + leads.length + intakeSubmissions.length;

      // Log the check
      await ctx.db.conflictCheck.create({
        data: {
          searchQuery: q,
          searchType: input.searchType,
          resultsCount: total,
          resultsData: JSON.stringify({ clients: clients.length, matters: matters.length, relatedParties: relatedParties.length, leads: leads.length, intakeSubmissions: intakeSubmissions.length }),
          triggeredBy: input.triggeredBy,
          entityType: input.entityType,
          entityId: input.entityId,
          status: total > 0 ? "PENDING" : "CLEARED",
        },
      });

      return { clients, matters, relatedParties, leads, intakeSubmissions, total };
    }),

  logCheck: publicProcedure
    .input(
      z.object({
        searchQuery: z.string(),
        searchType: z.nativeEnum(ConflictSearchType),
        resultsCount: z.number(),
        resultsData: z.string().optional(),
        triggeredBy: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        status: z.nativeEnum(ConflictStatus).default("PENDING"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.conflictCheck.create({ data: input });
    }),

  listChecks: publicProcedure
    .input(
      z.object({
        status: z.nativeEnum(ConflictStatus).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, limit = 50, offset = 0 } = input || {};
      const where: any = {};
      if (status) where.status = status;

      const [checks, total] = await Promise.all([
        ctx.db.conflictCheck.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        ctx.db.conflictCheck.count({ where }),
      ]);

      return { checks, total };
    }),

  getCheck: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.conflictCheck.findUnique({ where: { id: input.id } });
      if (!check) throw new Error("Conflict check not found");
      return check;
    }),

  resolveCheck: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["CLEARED", "CONFLICT", "WAIVED"]),
        resolution: z.string().optional(),
        resolvedBy: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.conflictCheck.update({
        where: { id: input.id },
        data: {
          status: input.status,
          resolution: input.resolution,
          resolvedBy: input.resolvedBy,
          resolvedAt: new Date(),
        },
      });
    }),
});
