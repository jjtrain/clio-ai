import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getProviderAdapter, PROVIDERS } from "@/lib/migration/providers";
import { runMigration } from "@/lib/migration/runner";

export const migrationRouter = router({
  getProviders: publicProcedure.query(() => PROVIDERS),

  createJob: publicProcedure
    .input(z.object({ provider: z.string(), accessToken: z.string().optional(), selectedTypes: z.array(z.string()).optional(), isDryRun: z.boolean().optional(), fieldMappings: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.migrationJob.create({
        data: { provider: input.provider, accessToken: input.accessToken, selectedTypes: input.selectedTypes || ["contacts", "matters", "documents", "billing"], isDryRun: input.isDryRun || false, fieldMappings: input.fieldMappings },
      });
    }),

  getJob: publicProcedure.input(z.object({ jobId: z.string() })).query(async ({ ctx, input }) =>
    ctx.db.migrationJob.findUniqueOrThrow({ where: { id: input.jobId } }),
  ),

  listJobs: publicProcedure.query(async ({ ctx }) =>
    ctx.db.migrationJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ),

  preview: publicProcedure
    .input(z.object({ provider: z.string(), accessToken: z.string() }))
    .mutation(async ({ input }) => {
      const adapter = getProviderAdapter(input.provider);
      const [contacts, matters, docs, invoices] = await Promise.all([
        adapter.fetchContacts(input.accessToken, { limit: 5 }).catch(() => []),
        adapter.fetchMatters(input.accessToken, { limit: 5 }).catch(() => []),
        adapter.fetchDocuments(input.accessToken, { limit: 5 }).catch(() => []),
        adapter.fetchInvoices(input.accessToken, { limit: 5 }).catch(() => []),
      ]);
      return { contacts: { sample: contacts.slice(0, 3), count: contacts.length }, matters: { sample: matters.slice(0, 3), count: matters.length }, documents: { sample: docs.slice(0, 3), count: docs.length }, invoices: { sample: invoices.slice(0, 3), count: invoices.length } };
    }),

  startJob: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.migrationJob.findUniqueOrThrow({ where: { id: input.jobId } });
      // Compute total records for progress tracking
      const adapter = getProviderAdapter(job.provider);
      const token = job.accessToken || "";
      let total = 0;
      const types = job.selectedTypes as string[];
      if (types.includes("contacts")) total += (await adapter.fetchContacts(token).catch(() => [])).length;
      if (types.includes("matters")) total += (await adapter.fetchMatters(token).catch(() => [])).length;
      if (types.includes("documents")) total += (await adapter.fetchDocuments(token).catch(() => [])).length;
      if (types.includes("billing")) total += (await adapter.fetchInvoices(token).catch(() => [])).length;
      await ctx.db.migrationJob.update({ where: { id: input.jobId }, data: { totalRecords: total } });

      // Run async — don't await
      runMigration(input.jobId).catch((err) => console.error("[Migration] Error:", err));
      return { started: true, totalRecords: total };
    }),

  cancelJob: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.migrationJob.update({ where: { id: input.jobId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    ),

  getJobRecords: publicProcedure
    .input(z.object({ jobId: z.string(), entityType: z.string().optional(), status: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const where: any = { jobId: input.jobId };
      if (input.entityType) where.entityType = input.entityType;
      if (input.status) where.status = input.status;
      return ctx.db.migrationRecord.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  getErrorsCsv: publicProcedure.input(z.object({ jobId: z.string() })).query(async ({ ctx, input }) => {
    const job = await ctx.db.migrationJob.findUniqueOrThrow({ where: { id: input.jobId } });
    const errors = (job.errorLog as any[]) || [];
    const header = "type,sourceId,reason";
    const rows = errors.map((e) => `${e.entityType},${e.sourceId},"${(e.reason || "").replace(/"/g, '""')}"`);
    return [header, ...rows].join("\n");
  }),
});
