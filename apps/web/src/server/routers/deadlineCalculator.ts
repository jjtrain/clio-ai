import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as deadlineEngine from "@/lib/deadline-engine";

export const deadlineCalculatorRouter = router({
  // ─── Chain Creation ──────────────────────────────────────────────────

  calculateFromText: publicProcedure
    .input(
      z.object({
        text: z.string(),
        matterId: z.string().optional(),
        practiceArea: z.string().optional(),
        jurisdiction: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const parsed = await deadlineEngine.parseTriggerEvent(input.text);

      const practiceArea = input.practiceArea ?? parsed.practiceArea;
      const jurisdiction = input.jurisdiction ?? parsed.jurisdiction;

      const deadlines = await deadlineEngine.calculateFullChain(
        parsed.triggerEvent,
        new Date(parsed.triggerDate),
        practiceArea,
        jurisdiction,
        parsed.serviceMethod
      );

      return {
        parsed: {
          triggerEvent: parsed.triggerEvent,
          triggerDate: parsed.triggerDate,
          serviceMethod: parsed.serviceMethod,
          practiceArea,
          jurisdiction,
        },
        deadlines,
        chainPreview: {
          name: parsed.triggerEvent,
          triggerEvent: parsed.triggerEvent,
          triggerDate: parsed.triggerDate,
          practiceArea,
          jurisdiction,
          serviceMethod: parsed.serviceMethod,
        },
      };
    }),

  calculateFromForm: publicProcedure
    .input(
      z.object({
        triggerEvent: z.string(),
        triggerDate: z.string(),
        practiceArea: z.string(),
        jurisdiction: z.string(),
        serviceMethod: z.string().optional(),
        matterId: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const deadlines = await deadlineEngine.calculateFullChain(
        input.triggerEvent,
        new Date(input.triggerDate),
        input.practiceArea,
        input.jurisdiction,
        input.serviceMethod
      );

      return {
        deadlines,
        chainPreview: {
          name: input.name ?? input.triggerEvent,
          triggerEvent: input.triggerEvent,
          triggerDate: new Date(input.triggerDate),
          practiceArea: input.practiceArea,
          jurisdiction: input.jurisdiction,
          serviceMethod: input.serviceMethod,
        },
      };
    }),

  saveChain: publicProcedure
    .input(
      z.object({
        name: z.string(),
        triggerEvent: z.string(),
        triggerDate: z.string(),
        practiceArea: z.string(),
        jurisdiction: z.string(),
        serviceMethod: z.string().optional(),
        triggerDescription: z.string().optional(),
        matterId: z.string().optional(),
        courtId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const chain = await deadlineEngine.createDeadlineChain({
          ...input,
          triggerDate: new Date(input.triggerDate),
          userId: "default",
          firmId: "default",
        });

        const deadlines = await deadlineEngine.syncToCalendar(chain.id);

        return { chain, deadlines };
      } catch (error) {
        throw error;
      }
    }),

  recalculate: publicProcedure
    .input(
      z.object({
        chainId: z.string(),
        triggerDate: z.string().optional(),
        serviceMethod: z.string().optional(),
        jurisdiction: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (input.triggerDate) updates.triggerDate = new Date(input.triggerDate);
        if (input.serviceMethod) updates.serviceMethod = input.serviceMethod;
        if (input.jurisdiction) updates.jurisdiction = input.jurisdiction;

        if (Object.keys(updates).length > 0) {
          await (db as any).deadlineChain.update({
            where: { id: input.chainId },
            data: updates,
          });
        }

        const result = await deadlineEngine.recalculateChain(input.chainId);

        return { chain: result.chain, deadlines: result.deadlines };
      } catch (error) {
        throw error;
      }
    }),

  // ─── Chain Management ────────────────────────────────────────────────

  getChain: publicProcedure
    .input(z.object({ chainId: z.string() }))
    .query(async ({ input }) => {
      if (input.chainId === "sample-chain-1") {
        return deadlineEngine.getSampleChain();
      }

      try {
        const chain = await (db as any).deadlineChain.findUnique({
          where: { id: input.chainId },
        });

        const deadlines = await (db as any).calculatedDeadline.findMany({
          where: { chainId: input.chainId },
          orderBy: { deadlineDate: "asc" },
        });

        return { chain, deadlines };
      } catch (error) {
        throw error;
      }
    }),

  getChainsForMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      try {
        const chains = await (db as any).deadlineChain.findMany({
          where: { matterId: input.matterId },
        });

        return chains;
      } catch (error) {
        throw error;
      }
    }),

  getAllChains: publicProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = {};
        if (input.status) where.status = input.status;

        const chains = await (db as any).deadlineChain.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return chains;
      } catch (error) {
        throw error;
      }
    }),

  deleteChain: publicProcedure
    .input(z.object({ chainId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await (db as any).calculatedDeadline.deleteMany({
          where: { chainId: input.chainId },
        });

        await (db as any).deadlineChain.delete({
          where: { id: input.chainId },
        });

        return { success: true };
      } catch (error) {
        throw error;
      }
    }),

  applyStay: publicProcedure
    .input(
      z.object({
        chainId: z.string(),
        stayStartDate: z.string(),
        stayEndDate: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await deadlineEngine.applyStay(
          input.chainId,
          new Date(input.stayStartDate),
          new Date(input.stayEndDate),
          input.reason
        );

        return result;
      } catch (error) {
        throw error;
      }
    }),

  liftStay: publicProcedure
    .input(z.object({ chainId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await (db as any).deadlineChain.update({
          where: { id: input.chainId },
          data: {
            status: "active",
            stayStartDate: null,
            stayEndDate: null,
          },
        });

        const result = await deadlineEngine.recalculateChain(input.chainId);

        return { chain: result.chain, deadlines: result.deadlines };
      } catch (error) {
        throw error;
      }
    }),

  // ─── Individual Deadline Management ──────────────────────────────────

  markDeadlineCompleted: publicProcedure
    .input(z.object({ deadlineId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await deadlineEngine.markDeadlineCompleted(
          input.deadlineId
        );

        return result;
      } catch (error) {
        throw error;
      }
    }),

  extendDeadline: publicProcedure
    .input(
      z.object({
        deadlineId: z.string(),
        newDate: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await deadlineEngine.extendDeadline(
          input.deadlineId,
          new Date(input.newDate),
          input.reason
        );

        return result;
      } catch (error) {
        throw error;
      }
    }),

  waiveDeadline: publicProcedure
    .input(
      z.object({
        deadlineId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await (db as any).calculatedDeadline.update({
          where: { id: input.deadlineId },
          data: { status: "waived" },
        });

        return result;
      } catch (error) {
        throw error;
      }
    }),

  updateDeadlineStatus: publicProcedure
    .input(
      z.object({
        deadlineId: z.string(),
        status: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await (db as any).calculatedDeadline.update({
          where: { id: input.deadlineId },
          data: { status: input.status },
        });

        return result;
      } catch (error) {
        throw error;
      }
    }),

  // ─── Query & Reporting ───────────────────────────────────────────────

  getUpcomingDeadlines: publicProcedure
    .input(
      z.object({
        days: z.number().default(30),
        practiceArea: z.string().optional(),
        priority: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + input.days);

        const where: Record<string, unknown> = {
          status: "pending",
          deadlineDate: {
            gte: now,
            lte: endDate,
          },
        };

        if (input.priority) where.priority = input.priority;

        let deadlines = await (db as any).calculatedDeadline.findMany({
          where,
          orderBy: { deadlineDate: "asc" },
        });

        if (!deadlines || deadlines.length === 0) {
          const sample = deadlineEngine.getSampleChain();
          const sampleDeadlines = (sample as any).deadlines || [];
          deadlines = sampleDeadlines.filter((d: any) => {
            const dd = new Date(d.deadlineDate);
            return dd >= now && dd <= endDate;
          });
        }

        // Include chain data
        const chainIds = [
          ...new Set(deadlines.map((d: any) => d.chainId).filter(Boolean)),
        ];
        let chains: any[] = [];
        if (chainIds.length > 0) {
          try {
            chains = await (db as any).deadlineChain.findMany({
              where: { id: { in: chainIds } },
            });
          } catch {
            // chains remain empty
          }
        }

        const chainMap = new Map(chains.map((c: any) => [c.id, c]));

        return deadlines.map((d: any) => ({
          ...d,
          chain: d.chainId ? chainMap.get(d.chainId) ?? null : null,
        }));
      } catch (error) {
        // Fallback to sample data
        const sample = deadlineEngine.getSampleChain();
        return (sample as any).deadlines || [];
      }
    }),

  getOverdueDeadlines: publicProcedure.query(async () => {
    try {
      const now = new Date();

      const deadlines = await (db as any).calculatedDeadline.findMany({
        where: {
          status: "pending",
          deadlineDate: { lt: now },
        },
        orderBy: { deadlineDate: "asc" },
      });

      return deadlines;
    } catch (error) {
      throw error;
    }
  }),

  getDeadlinesByWeek: publicProcedure
    .input(
      z.object({
        startDate: z.string(),
        weeks: z.number().default(4),
      })
    )
    .query(async ({ input }) => {
      try {
        const start = new Date(input.startDate);
        const end = new Date(input.startDate);
        end.setDate(end.getDate() + input.weeks * 7);

        const deadlines = await (db as any).calculatedDeadline.findMany({
          where: {
            deadlineDate: {
              gte: start,
              lte: end,
            },
          },
          orderBy: { deadlineDate: "asc" },
        });

        // Group by ISO week
        const grouped: Record<string, any[]> = {};
        for (const d of deadlines) {
          const date = new Date(d.deadlineDate);
          const yearStart = new Date(date.getFullYear(), 0, 1);
          const dayOfYear =
            Math.floor(
              (date.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)
            ) + 1;
          const weekNumber = Math.ceil(dayOfYear / 7);
          const weekKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;

          if (!grouped[weekKey]) grouped[weekKey] = [];
          grouped[weekKey].push(d);
        }

        return grouped;
      } catch (error) {
        throw error;
      }
    }),

  getConflicts: publicProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const deadlines = await (db as any).calculatedDeadline.findMany({
          where: {
            deadlineDate: {
              gte: new Date(input.startDate),
              lte: new Date(input.endDate),
            },
          },
          orderBy: { deadlineDate: "asc" },
        });

        // Group by date and find conflicts (3+ deadlines on same date)
        const byDate: Record<string, any[]> = {};
        for (const d of deadlines) {
          const dateKey = new Date(d.deadlineDate).toISOString().split("T")[0];
          if (!byDate[dateKey]) byDate[dateKey] = [];
          byDate[dateKey].push(d);
        }

        const conflicts: { date: string; count: number; deadlines: any[] }[] =
          [];
        for (const [date, items] of Object.entries(byDate)) {
          if (items.length >= 3) {
            conflicts.push({ date, count: items.length, deadlines: items });
          }
        }

        return conflicts;
      } catch (error) {
        throw error;
      }
    }),

  // ─── Rules & Holidays ───────────────────────────────────────────────

  getRulesForJurisdiction: publicProcedure
    .input(
      z.object({
        jurisdiction: z.string(),
        triggerEvent: z.string(),
        practiceArea: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const rules = deadlineEngine.getDefaultRules();

      return rules.filter((r: any) => {
        if (r.jurisdiction !== input.jurisdiction) return false;
        if (r.triggerEvent !== input.triggerEvent) return false;
        if (input.practiceArea && r.practiceArea !== input.practiceArea)
          return false;
        return true;
      });
    }),

  getHolidays: publicProcedure
    .input(
      z.object({
        year: z.number(),
        jurisdiction: z.string(),
      })
    )
    .query(async ({ input }) => {
      const holidays = deadlineEngine.HOLIDAYS || [];

      return holidays.filter((h: any) => {
        const hDate = new Date(h.date);
        if (hDate.getFullYear() !== input.year) return false;
        if (h.jurisdiction && h.jurisdiction !== input.jurisdiction)
          return false;
        return true;
      });
    }),

  addCustomRule: publicProcedure
    .input(
      z.object({
        triggerEvent: z.string(),
        practiceArea: z.string(),
        jurisdiction: z.string(),
        deadlineName: z.string(),
        description: z.string(),
        ruleReference: z.string(),
        category: z.string(),
        calendarDays: z.number(),
        businessDays: z.number(),
        priority: z.string(),
        sortOrder: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const rule = await (db as any).deadlineRule.create({
          data: input,
        });

        return rule;
      } catch (error) {
        throw error;
      }
    }),

  addCustomHoliday: publicProcedure
    .input(
      z.object({
        name: z.string(),
        date: z.string(),
        jurisdiction: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const holiday = await (db as any).customHoliday.create({
          data: {
            name: input.name,
            date: new Date(input.date),
            jurisdiction: input.jurisdiction,
          },
        });

        return holiday;
      } catch (error) {
        throw error;
      }
    }),

  // ─── Sync ────────────────────────────────────────────────────────────

  syncChainToCalendar: publicProcedure
    .input(z.object({ chainId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await deadlineEngine.syncToCalendar(input.chainId);

        return result;
      } catch (error) {
        throw error;
      }
    }),

  exportChain: publicProcedure
    .input(
      z.object({
        chainId: z.string(),
        format: z.enum(["pdf", "csv"]),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await deadlineEngine.exportTimeline(input.chainId, input.format);
        return result;
      } catch (error) {
        throw error;
      }
    }),
});
