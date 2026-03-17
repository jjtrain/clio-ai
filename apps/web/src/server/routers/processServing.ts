import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { proofTestConnection, proofCreateJob, proofGetJob, proofGetEstimate, proofGetProofOfService } from "@/lib/integrations/proof";
import { stenoTestConnection, stenoRequestReporter, stenoGetBooking, stenoGetBookings, stenoGetTranscript, stenoSearchTranscripts, stenoGetEstimate } from "@/lib/integrations/steno";

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const processServingRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.processServingIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.string(), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), defaultServiceMethod: z.string().optional().nullable(), defaultUrgency: z.string().optional(), autoCreateDocketEntry: z.boolean().optional(), autoSaveProofOfService: z.boolean().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      return ctx.db.processServingIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => input.provider === "PROOF" ? proofTestConnection() : input.provider === "STENO" ? stenoTestConnection() : { success: false, error: "Unknown" }),

  // ─── Service Jobs ──────────────────────────────────────────────
  "jobs.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), priority: z.string().optional(), provider: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.priority) where.priority = input.priority;
      if (input?.provider) where.provider = input.provider;
      return ctx.db.serviceJob.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),
  "jobs.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.serviceJob.findUniqueOrThrow({ where: { id: input.id } })),
  "jobs.create": publicProcedure
    .input(z.object({ matterId: z.string(), recipientName: z.string(), serviceAddress: z.string(), serviceCity: z.string().optional(), serviceState: z.string().optional(), serviceZip: z.string().optional(), jobType: z.string().default("PERSONAL_SERVICE"), priority: z.string().default("STANDARD"), documentIds: z.string().optional(), specialInstructions: z.string().optional(), dueDate: z.string().optional(), courtName: z.string().optional(), caseNumber: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Try Proof first
      const proofResult = await proofCreateJob({ recipientName: input.recipientName, serviceAddress: input.serviceAddress, city: input.serviceCity || "", state: input.serviceState || "", zip: input.serviceZip || "", serviceType: input.jobType, priority: input.priority, specialInstructions: input.specialInstructions });
      const provider = proofResult.success ? "PROOF" : "MANUAL";
      return ctx.db.serviceJob.create({
        data: {
          provider, matterId: input.matterId, recipientName: input.recipientName,
          serviceAddress: input.serviceAddress, serviceCity: input.serviceCity, serviceState: input.serviceState, serviceZip: input.serviceZip,
          jobType: input.jobType, priority: input.priority, specialInstructions: input.specialInstructions,
          documentIds: input.documentIds, courtName: input.courtName, caseNumber: input.caseNumber,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          externalJobId: proofResult.success ? (proofResult as any).data?.jobId : undefined,
          trackingUrl: proofResult.success ? (proofResult as any).data?.trackingUrl : undefined,
          estimatedServiceDate: proofResult.success && (proofResult as any).data?.estimatedServiceDate ? new Date((proofResult as any).data.estimatedServiceDate) : undefined,
          totalCost: proofResult.success ? (proofResult as any).data?.estimatedCost : undefined,
          status: proofResult.success ? "SUBMITTED" : "DRAFT",
        },
      });
    }),
  "jobs.cancel": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.serviceJob.update({ where: { id: input.id }, data: { status: "CANCELLED", notes: input.reason } })),
  "jobs.getEstimate": publicProcedure
    .input(z.object({ serviceAddress: z.string(), serviceType: z.string(), priority: z.string() }))
    .mutation(async ({ input }) => proofGetEstimate(input)),
  "jobs.track": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.serviceJob.findUniqueOrThrow({ where: { id: input.id } });
      if (job.externalJobId && job.provider === "PROOF") {
        const result = await proofGetJob(job.externalJobId);
        if (result.success) {
          const data = (result as any).data;
          await ctx.db.serviceJob.update({ where: { id: input.id }, data: { status: data.status?.toUpperCase() || job.status, totalAttempts: data.total_attempts || job.totalAttempts, servedDate: data.served_date ? new Date(data.served_date) : undefined, serverName: data.server_name, trackingUrl: data.tracking_url } });
        }
      }
      return ctx.db.serviceJob.findUniqueOrThrow({ where: { id: input.id } });
    }),
  "jobs.getProof": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.serviceJob.findUniqueOrThrow({ where: { id: input.id } });
      if (job.externalJobId) return proofGetProofOfService(job.externalJobId);
      return { success: false, error: "No external job ID" };
    }),

  // ─── Court Reporter ────────────────────────────────────────────
  "reporter.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), jobType: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.jobType) where.jobType = input.jobType;
      return ctx.db.courtReporterJob.findMany({ where, orderBy: { eventDate: "desc" }, take: input?.limit || 50 });
    }),
  "reporter.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.courtReporterJob.findUniqueOrThrow({ where: { id: input.id } })),
  "reporter.book": publicProcedure
    .input(z.object({ matterId: z.string(), jobType: z.string().default("DEPOSITION"), eventDate: z.string(), eventTime: z.string().optional(), estimatedDuration: z.number().optional(), location: z.string().optional(), locationType: z.string().default("IN_PERSON"), deponentName: z.string().optional(), videoConferenceUrl: z.string().optional(), videographerRequested: z.boolean().optional(), interpreterRequested: z.boolean().optional(), interpreterLanguage: z.string().optional(), realtimeRequested: z.boolean().optional(), roughDraftRequested: z.boolean().optional(), expeditedTranscriptRequested: z.boolean().optional(), expeditedDays: z.number().optional(), specialInstructions: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const stenoResult = await stenoRequestReporter({ eventDate: input.eventDate, eventTime: input.eventTime || "09:00", estimatedDuration: input.estimatedDuration || 4, location: input.location || "TBD", locationType: input.locationType, jobType: input.jobType, deponentName: input.deponentName, videographerRequested: input.videographerRequested, realtimeRequested: input.realtimeRequested, expeditedTranscript: input.expeditedTranscriptRequested, specialInstructions: input.specialInstructions });

      const job = await ctx.db.courtReporterJob.create({
        data: {
          provider: "STENO", matterId: input.matterId, jobType: input.jobType,
          eventDate: new Date(input.eventDate), eventTime: input.eventTime,
          estimatedDuration: input.estimatedDuration, location: input.location,
          locationType: input.locationType, deponentName: input.deponentName,
          videoConferenceUrl: input.videoConferenceUrl,
          videographerRequested: input.videographerRequested || false,
          interpreterRequested: input.interpreterRequested || false,
          interpreterLanguage: input.interpreterLanguage,
          realtimeRequested: input.realtimeRequested || false,
          roughDraftRequested: input.roughDraftRequested || false,
          expeditedTranscriptRequested: input.expeditedTranscriptRequested || false,
          expeditedDays: input.expeditedDays, specialInstructions: input.specialInstructions,
          externalJobId: stenoResult.success ? (stenoResult as any).data?.bookingId : undefined,
          status: stenoResult.success ? "CONFIRMED" : "REQUESTED",
          totalCost: stenoResult.success ? (stenoResult as any).data?.estimatedCost : undefined,
        },
      });

      // Create calendar event
      await ctx.db.calendarEvent.create({
        data: { title: `${input.jobType}: ${input.deponentName || "TBD"}`, startTime: new Date(input.eventDate), endTime: new Date(new Date(input.eventDate).getTime() + (input.estimatedDuration || 4) * 60 * 60 * 1000), location: input.location, description: `Court reporter booked via Steno. Matter: ${input.matterId}` },
      });

      return job;
    }),
  "reporter.cancel": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.courtReporterJob.update({ where: { id: input.id }, data: { status: "CANCELLED", notes: input.reason } })),
  "reporter.getEstimate": publicProcedure
    .input(z.object({ duration: z.number(), jobType: z.string(), video: z.boolean().optional(), realtime: z.boolean().optional(), expedited: z.boolean().optional() }))
    .mutation(async ({ input }) => stenoGetEstimate(input)),

  // ─── Transcripts ───────────────────────────────────────────────
  "transcripts.list": publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { transcriptStatus: { not: null } };
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.courtReporterJob.findMany({ where, orderBy: { eventDate: "desc" } });
    }),
  "transcripts.download": publicProcedure
    .input(z.object({ jobId: z.string(), format: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.courtReporterJob.findUniqueOrThrow({ where: { id: input.jobId } });
      if (job.externalJobId) return stenoGetTranscript(job.externalJobId, input.format);
      return { success: false, error: "No external booking ID" };
    }),
  "transcripts.search": publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => stenoSearchTranscripts(input.query)),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.service": publicProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.from || input?.to) { where.createdAt = {}; if (input?.from) where.createdAt.gte = new Date(input.from); if (input?.to) where.createdAt.lte = new Date(input.to); }
      const jobs = await ctx.db.serviceJob.findMany({ where });
      const served = jobs.filter((j) => j.status === "SERVED").length;
      const failed = jobs.filter((j) => j.status === "UNABLE_TO_SERVE").length;
      const totalCost = jobs.reduce((s, j) => s + Number(j.totalCost || 0), 0);
      const avgAttempts = jobs.length > 0 ? jobs.reduce((s, j) => s + j.totalAttempts, 0) / jobs.length : 0;
      return { total: jobs.length, served, failed, active: jobs.filter((j) => !["SERVED", "UNABLE_TO_SERVE", "CANCELLED"].includes(j.status)).length, totalCost, avgAttempts: Math.round(avgAttempts * 10) / 10 };
    }),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const activeJobs = await ctx.db.serviceJob.count({ where: { status: { notIn: ["SERVED", "UNABLE_TO_SERVE", "CANCELLED"] } } });
    const servedMonth = await ctx.db.serviceJob.count({ where: { status: "SERVED", servedDate: { gte: monthStart } } });
    const upcomingDepos = await ctx.db.courtReporterJob.count({ where: { eventDate: { gte: now, lte: in30 }, status: { notIn: ["CANCELLED"] } } });
    const pendingTranscripts = await ctx.db.courtReporterJob.count({ where: { transcriptStatus: { in: ["PENDING", "PROCESSING"] } } });

    const monthJobs = await ctx.db.serviceJob.findMany({ where: { createdAt: { gte: monthStart } } });
    const monthReporter = await ctx.db.courtReporterJob.findMany({ where: { createdAt: { gte: monthStart } } });
    const totalCosts = monthJobs.reduce((s, j) => s + Number(j.totalCost || 0), 0) + monthReporter.reduce((s, j) => s + Number(j.totalCost || 0), 0);

    const servedJobs = await ctx.db.serviceJob.findMany({ where: { status: "SERVED" } });
    const avgDays = servedJobs.length > 0 ? servedJobs.reduce((s, j) => s + (j.servedDate ? Math.floor((j.servedDate.getTime() - j.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0), 0) / servedJobs.length : 0;

    return { activeJobs, servedMonth, avgDaysToServe: Math.round(avgDays * 10) / 10, upcomingDepos, pendingTranscripts, totalCosts };
  }),
});
