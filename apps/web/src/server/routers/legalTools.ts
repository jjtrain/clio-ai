import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { maskApiKey } from "@/lib/integrations/provider-factory";
import { casetextSearch, casetextCheckCitations } from "@/lib/integrations/casetext";
import { fastcaseSearch } from "@/lib/integrations/fastcase";
import { docketAlarmSearch, docketAlarmTrackCase } from "@/lib/integrations/docket-alarm";
import { veraCalculateDeadlines, veraGetJurisdictions } from "@/lib/integrations/vera";
import { briefpointGenerateResponse, briefpointAnalyze, briefpointGetObjections } from "@/lib/integrations/briefpoint";

const PROVIDER_ENUM = ["CASETEXT", "DOCKET_ALARM", "FASTCASE", "VERA", "BRIEFPOINT", "CUSTOM"] as const;
const ALERT_TYPE_ENUM = ["NEW_FILING", "DEADLINE", "HEARING", "ORDER", "RULING", "STATUS_CHANGE", "CUSTOM"] as const;

export const legalToolsRouter = router({
  // ─── Settings ──────────────────────────────────────────────────

  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.legalToolIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskApiKey(i.apiKey), apiSecret: maskApiKey(i.apiSecret) }));
  }),

  "settings.get": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .query(async ({ ctx, input }) => {
      const i = await ctx.db.legalToolIntegration.findUnique({ where: { provider: input.provider } });
      if (!i) return null;
      return { ...i, apiKey: maskApiKey(i.apiKey), apiSecret: maskApiKey(i.apiSecret) };
    }),

  "settings.update": publicProcedure
    .input(z.object({
      provider: z.enum(PROVIDER_ENUM), displayName: z.string().optional(),
      apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(),
      baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(),
      isEnabled: z.boolean().optional(), settings: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      // Don't overwrite keys if masked value sent back
      const cleanData: any = { ...data };
      if (cleanData.apiKey?.startsWith("****")) delete cleanData.apiKey;
      if (cleanData.apiSecret?.startsWith("****")) delete cleanData.apiSecret;

      return ctx.db.legalToolIntegration.upsert({
        where: { provider },
        create: { provider, displayName: input.displayName || provider, ...cleanData },
        update: cleanData,
      });
    }),

  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      const i = await ctx.db.legalToolIntegration.findUnique({ where: { provider: input.provider } });
      if (!i?.apiKey) return { success: false, error: "API key not configured" };

      // Simple connectivity test
      try {
        if (input.provider === "CASETEXT") {
          const r = await casetextSearch({ query: "test", resultLimit: 1 });
          return { success: r.success, error: r.success ? undefined : (r as any).error };
        }
        if (input.provider === "FASTCASE") {
          const r = await fastcaseSearch({ query: "test", resultLimit: 1 });
          return { success: r.success, error: r.success ? undefined : (r as any).error };
        }
        if (input.provider === "DOCKET_ALARM") {
          const r = await docketAlarmSearch("test");
          return { success: r.success, error: r.success ? undefined : (r as any).error };
        }
        if (input.provider === "VERA") {
          const r = await veraGetJurisdictions();
          return { success: r.success, error: r.success ? undefined : (r as any).error };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  // ─── Unified Search ────────────────────────────────────────────

  search: publicProcedure
    .input(z.object({
      query: z.string().min(1), jurisdiction: z.string().optional(),
      providers: z.array(z.enum(PROVIDER_ENUM)).optional(), resultLimit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = { query: input.query, jurisdiction: input.jurisdiction, resultLimit: input.resultLimit || 10 };
      const results: any[] = [];
      const errors: string[] = [];

      const providers = input.providers || ["CASETEXT", "FASTCASE"];
      for (const p of providers) {
        try {
          if (p === "CASETEXT") {
            const r = await casetextSearch(request);
            if (r.success) results.push(...(r as any).data.map((d: any) => ({ ...d, provider: "CASETEXT" })));
            else errors.push((r as any).error);
          }
          if (p === "FASTCASE") {
            const r = await fastcaseSearch(request);
            if (r.success) results.push(...(r as any).data.map((d: any) => ({ ...d, provider: "FASTCASE" })));
            else errors.push((r as any).error);
          }
        } catch {}
      }

      return { results, errors, totalResults: results.length };
    }),

  checkCitations: publicProcedure
    .input(z.object({ citations: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const r = await casetextCheckCitations(input.citations);
      return r;
    }),

  // ─── Docket Integration ────────────────────────────────────────

  trackCase: publicProcedure
    .input(z.object({ provider: z.enum(["DOCKET_ALARM", "VERA"]), matterId: z.string(), caseNumber: z.string(), courtName: z.string() }))
    .mutation(async ({ input }) => {
      if (input.provider === "DOCKET_ALARM") {
        return docketAlarmTrackCase(input.courtName, input.caseNumber, input.matterId);
      }
      return { success: false, error: "Provider not supported for case tracking", provider: input.provider };
    }),

  calculateDeadlines: publicProcedure
    .input(z.object({ jurisdiction: z.string(), caseType: z.string(), triggerEvent: z.string(), triggerDate: z.string() }))
    .mutation(async ({ input }) => veraCalculateDeadlines(input)),

  // ─── Alerts ────────────────────────────────────────────────────

  "alerts.list": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM).optional(), matterId: z.string().optional(), alertType: z.enum(ALERT_TYPE_ENUM).optional(), isProcessed: z.boolean().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.alertType) where.alertType = input.alertType;
      if (input?.isProcessed !== undefined) where.isProcessed = input.isProcessed;
      return ctx.db.docketAlert.findMany({ where, include: { matter: true }, orderBy: { receivedAt: "desc" }, take: input?.limit || 50 });
    }),

  "alerts.process": publicProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.docketAlert.update({ where: { id: input.alertId }, data: { isProcessed: true } });
    }),

  "alerts.dismiss": publicProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.docketAlert.update({ where: { id: input.alertId }, data: { isProcessed: true } });
    }),

  // ─── Discovery (Briefpoint) ────────────────────────────────────

  "discovery.analyze": publicProcedure
    .input(z.object({ documentText: z.string().min(1) }))
    .mutation(async ({ input }) => briefpointAnalyze(input.documentText)),

  "discovery.generateResponses": publicProcedure
    .input(z.object({ matterId: z.string(), documentText: z.string(), requestType: z.enum(["interrogatory", "rfa", "rfp", "rog"]), responseStrategy: z.string().optional() }))
    .mutation(async ({ input }) => {
      return briefpointGenerateResponse({ matterId: input.matterId, documentText: input.documentText, requestType: input.requestType, responseStrategy: input.responseStrategy });
    }),

  "discovery.getObjections": publicProcedure
    .input(z.object({ requestType: z.string(), jurisdiction: z.string() }))
    .query(async ({ input }) => briefpointGetObjections(input.requestType, input.jurisdiction)),
});
