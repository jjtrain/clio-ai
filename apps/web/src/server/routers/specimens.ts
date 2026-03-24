import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const NICE_CLASSES = Array.from({ length: 45 }, (_, i) => i + 1);

export const specimensRouter = router({
  list: publicProcedure
    .input(z.object({
      matterId: z.string(),
      trademarkDocketId: z.string().optional(),
      niceClass: z.number().optional(),
      status: z.string().optional(),
      filingAssociation: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (input.trademarkDocketId) where.trademarkDocketId = input.trademarkDocketId;
      if (input.niceClass) where.niceClass = input.niceClass;
      if (input.status) where.status = input.status;
      if (input.filingAssociation) where.filingAssociation = input.filingAssociation;
      return ctx.db.trademarkSpecimen.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  getByClass: publicProcedure
    .input(z.object({ matterId: z.string(), trademarkDocketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const specimens = await ctx.db.trademarkSpecimen.findMany({
        where: { matterId: input.matterId, trademarkDocketId: input.trademarkDocketId },
        orderBy: { createdAt: "desc" },
      });
      // Group by class
      const byClass: Record<number, typeof specimens> = {};
      for (const s of specimens) {
        if (!byClass[s.niceClass]) byClass[s.niceClass] = [];
        byClass[s.niceClass].push(s);
      }
      return byClass;
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.trademarkSpecimen.findUniqueOrThrow({ where: { id: input.id } })),

  create: publicProcedure
    .input(z.object({
      trademarkDocketId: z.string(),
      matterId: z.string(),
      niceClass: z.number().min(1).max(45),
      goodsServices: z.string().optional(),
      specimenType: z.string(),
      fileUrl: z.string(),
      thumbnailUrl: z.string().optional(),
      fileName: z.string(),
      fileType: z.string(),
      fileSize: z.number().optional(),
      dateFirstUseCommerce: z.string().optional(),
      dateFirstUseAnywhere: z.string().optional(),
      dateCollected: z.string().optional(),
      filingAssociation: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Mark previous specimens for this class as superseded
      await ctx.db.trademarkSpecimen.updateMany({
        where: { trademarkDocketId: input.trademarkDocketId, niceClass: input.niceClass, isCurrent: true },
        data: { isCurrent: false, isSuperseded: true },
      });

      return ctx.db.trademarkSpecimen.create({
        data: {
          ...input,
          dateFirstUseCommerce: input.dateFirstUseCommerce ? new Date(input.dateFirstUseCommerce) : null,
          dateFirstUseAnywhere: input.dateFirstUseAnywhere ? new Date(input.dateFirstUseAnywhere) : null,
          dateCollected: input.dateCollected ? new Date(input.dateCollected) : null,
          isCurrent: true,
          status: "PENDING",
        },
      });
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      status: z.string().optional(),
      rejectionReason: z.string().optional(),
      notes: z.string().optional(),
      filingAssociation: z.string().optional(),
      goodsServices: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.trademarkSpecimen.update({ where: { id }, data });
    }),

  markCurrent: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const specimen = await ctx.db.trademarkSpecimen.findUniqueOrThrow({ where: { id: input.id } });
      await ctx.db.trademarkSpecimen.updateMany({
        where: { trademarkDocketId: specimen.trademarkDocketId, niceClass: specimen.niceClass, isCurrent: true },
        data: { isCurrent: false },
      });
      return ctx.db.trademarkSpecimen.update({ where: { id: input.id }, data: { isCurrent: true, isSuperseded: false } });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.trademarkSpecimen.delete({ where: { id: input.id } })),

  // Renewal deadline check
  checkRenewalDeadlines: publicProcedure
    .input(z.object({ trademarkDocketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tm = await ctx.db.trademarkDocket.findUniqueOrThrow({ where: { id: input.trademarkDocketId } });
      if (!tm.registrationDate || !tm.matterId) return { tasks: 0 };

      const regDate = new Date(tm.registrationDate);
      const now = new Date();
      const tasks: string[] = [];

      // Section 8: years 5-6
      const sec8Start = new Date(regDate); sec8Start.setFullYear(sec8Start.getFullYear() + 5);
      const sec8End = new Date(regDate); sec8End.setFullYear(sec8End.getFullYear() + 6);
      const sec8Warn6mo = new Date(sec8End); sec8Warn6mo.setMonth(sec8Warn6mo.getMonth() - 6);
      const sec8Warn60d = new Date(sec8End); sec8Warn60d.setDate(sec8Warn60d.getDate() - 60);

      if (sec8End > now && sec8Warn6mo <= now) {
        const existing = await ctx.db.task.findFirst({ where: { matterId: tm.matterId, title: { contains: "Section 8" } } });
        if (!existing) {
          await ctx.db.task.create({ data: { matterId: tm.matterId, title: `Section 8 Declaration — ${tm.markName}`, description: `Section 8 Declaration of Use due by ${sec8End.toLocaleDateString()}. Specimens required for all registered classes.`, dueDate: sec8End, priority: "HIGH", status: "NOT_STARTED" } });
          tasks.push("Section 8");
        }
      }

      // Section 8 & 15 combined (same 5-6 year window)
      if (sec8End > now && sec8Warn6mo <= now) {
        const existing = await ctx.db.task.findFirst({ where: { matterId: tm.matterId, title: { contains: "Section 15" } } });
        if (!existing) {
          await ctx.db.task.create({ data: { matterId: tm.matterId, title: `Section 15 Incontestability — ${tm.markName}`, description: `Section 15 can be filed with Section 8 between years 5-6. Deadline: ${sec8End.toLocaleDateString()}.`, dueDate: sec8End, priority: "MEDIUM", status: "NOT_STARTED" } });
          tasks.push("Section 15");
        }
      }

      // Section 8 renewal: years 9-10
      const sec8rStart = new Date(regDate); sec8rStart.setFullYear(sec8rStart.getFullYear() + 9);
      const sec8rEnd = new Date(regDate); sec8rEnd.setFullYear(sec8rEnd.getFullYear() + 10);
      const sec8rWarn6mo = new Date(sec8rEnd); sec8rWarn6mo.setMonth(sec8rWarn6mo.getMonth() - 6);

      if (sec8rEnd > now && sec8rWarn6mo <= now) {
        const existing = await ctx.db.task.findFirst({ where: { matterId: tm.matterId, title: { contains: "Section 8 Renewal" } } });
        if (!existing) {
          await ctx.db.task.create({ data: { matterId: tm.matterId, title: `Section 8 Renewal — ${tm.markName}`, description: `Section 8 renewal + Section 9 due by ${sec8rEnd.toLocaleDateString()}. Specimens required.`, dueDate: sec8rEnd, priority: "HIGH", status: "NOT_STARTED" } });
          tasks.push("Section 8 Renewal");
        }
      }

      // Check for missing specimens near deadline
      const upcomingDeadline = sec8End > now && sec8End < new Date(Date.now() + 90 * 86400000) ? sec8End
        : sec8rEnd > now && sec8rEnd < new Date(Date.now() + 90 * 86400000) ? sec8rEnd : null;

      if (upcomingDeadline && tm.matterId) {
        const classes = (tm.internationalClasses || "").split(",").map((c) => parseInt(c.trim())).filter(Boolean);
        for (const cls of classes) {
          const recentSpecimen = await ctx.db.trademarkSpecimen.findFirst({
            where: { trademarkDocketId: tm.id, niceClass: cls, dateCollected: { gte: new Date(Date.now() - 365 * 86400000) } },
          });
          if (!recentSpecimen) {
            const existing = await ctx.db.task.findFirst({ where: { matterId: tm.matterId, title: { contains: `specimen for Class ${cls}` } } });
            if (!existing) {
              await ctx.db.task.create({ data: { matterId: tm.matterId, title: `Collect specimen for Class ${cls} renewal — ${tm.markName}`, description: `No recent specimen for Class ${cls}. Renewal deadline: ${upcomingDeadline.toLocaleDateString()}. Upload a current specimen of use.`, dueDate: new Date(upcomingDeadline.getTime() - 30 * 86400000), priority: "MEDIUM", status: "NOT_STARTED" } });
              tasks.push(`Specimen Class ${cls}`);
            }
          }
        }
      }

      return { tasks: tasks.length, created: tasks };
    }),

  getSummary: publicProcedure
    .input(z.object({ matterId: z.string(), trademarkDocketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const specimens = await ctx.db.trademarkSpecimen.findMany({ where: { matterId: input.matterId, trademarkDocketId: input.trademarkDocketId } });
      const classesCovered = Array.from(new Set(specimens.filter((s) => s.isCurrent).map((s) => s.niceClass))).sort((a, b) => a - b);
      const lastDate = specimens.reduce((max, s) => s.dateCollected && (!max || s.dateCollected > max) ? s.dateCollected : max, null as Date | null);
      const pendingCount = specimens.filter((s) => s.status === "PENDING").length;
      const rejectedCount = specimens.filter((s) => s.status === "REJECTED").length;
      return { total: specimens.length, classesCovered, lastSpecimenDate: lastDate, pendingCount, rejectedCount };
    }),
});
