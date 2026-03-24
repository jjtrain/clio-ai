import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getAgingBuckets, getEscalationQueue, executeEscalation, processAllDueEscalations, getEscalationHistory } from "@/lib/aging-engine";

const DEFAULT_FIRM_ID = "demo-firm";

export const agingRouter = router({
  getBuckets: publicProcedure.query(async () => {
    return getAgingBuckets(DEFAULT_FIRM_ID);
  }),

  getEscalationQueue: publicProcedure.query(async () => {
    return getEscalationQueue(DEFAULT_FIRM_ID);
  }),

  escalateInvoice: publicProcedure
    .input(z.object({ invoiceId: z.string(), stage: z.string() }))
    .mutation(async ({ input }) => {
      return executeEscalation(input.invoiceId, input.stage, DEFAULT_FIRM_ID, "attorney");
    }),

  processAllDue: publicProcedure.mutation(async () => {
    return processAllDueEscalations(DEFAULT_FIRM_ID);
  }),

  getHistory: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ input }) => {
      return getEscalationHistory(input.invoiceId);
    }),

  getSummary: publicProcedure.query(async ({ ctx }) => {
    const buckets = await getAgingBuckets(DEFAULT_FIRM_ID);
    const queue = await getEscalationQueue(DEFAULT_FIRM_ID);
    const totalOutstanding = buckets.reduce((s, b) => s + b.totalOutstanding, 0);
    const totalOverdue = buckets.filter((b) => b.minDays > 0).reduce((s, b) => s + b.totalOutstanding, 0);

    return {
      totalOutstanding,
      totalOverdue,
      buckets: buckets.map((b) => ({ label: b.label, count: b.count, total: b.totalOutstanding })),
      escalationsDue: queue.length,
    };
  }),
});
