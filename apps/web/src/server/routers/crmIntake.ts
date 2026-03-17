import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { syncInbound, syncFormSubmission, getSyncReport } from "@/lib/crm-sync-engine";
import { lawmaticsTestConnection, lawmaticsGetContacts, lawmaticsGetForms, leadDocketTestConnection, leadDocketGetLeads, leadDocketGetSources, hubspotTestConnection, hubspotGetContacts, hubspotGetForms, cognitoTestConnection, cognitoGetForms, wufooTestConnection, wufooGetForms } from "@/lib/integrations/crm-providers";

const PROVIDERS = ["LAWMATICS", "LEAD_DOCKET", "HUBSPOT", "COGNITO_FORMS", "WUFOO"] as const;

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const crmIntakeRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.crmIntakeIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret), accessToken: i.accessToken ? "***" : null, refreshToken: i.refreshToken ? "***" : null }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), portalId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), syncDirection: z.string().optional(), autoCreateLeads: z.boolean().optional(), fieldMappings: z.string().optional().nullable(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      if (clean.apiSecret?.startsWith("****")) delete clean.apiSecret;
      return ctx.db.crmIntakeIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS) }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { LAWMATICS: lawmaticsTestConnection, LEAD_DOCKET: leadDocketTestConnection, HUBSPOT: hubspotTestConnection, COGNITO_FORMS: cognitoTestConnection, WUFOO: wufooTestConnection };
      return (tests[input.provider] || (() => ({ success: false, error: "Unknown" })))();
    }),

  // ─── Sync ──────────────────────────────────────────────────────
  "sync.run": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS) }))
    .mutation(async ({ ctx, input }) => {
      // Pull contacts from provider
      let contacts: any[] = [];
      if (input.provider === "LAWMATICS") { const r = await lawmaticsGetContacts(); if (r.success) contacts = (r as any).data?.contacts || (r as any).data || []; }
      if (input.provider === "LEAD_DOCKET") { const r = await leadDocketGetLeads(); if (r.success) contacts = (r as any).data?.leads || (r as any).data || []; }
      if (input.provider === "HUBSPOT") { const r = await hubspotGetContacts(); if (r.success) contacts = (r as any).data?.results || (r as any).data || []; }

      let created = 0, updated = 0, errors = 0;
      for (const c of contacts) {
        try {
          const result = await syncInbound(input.provider, {
            externalId: c.id || c.contact_id || String(Math.random()),
            firstName: c.firstName || c.first_name || c.properties?.firstname,
            lastName: c.lastName || c.last_name || c.properties?.lastname,
            email: c.email || c.properties?.email,
            phone: c.phone || c.properties?.phone,
            source: c.source || c.lead_source || c.properties?.hs_lead_status,
          });
          if (result.action === "created") created++;
          else if (result.action === "updated") updated++;
        } catch { errors++; }
      }

      await ctx.db.crmIntakeIntegration.update({ where: { provider: input.provider }, data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS" } });
      return { created, updated, errors, total: contacts.length };
    }),
  "sync.status": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS).optional() }).optional())
    .query(async ({ input }) => getSyncReport(input?.provider)),

  // ─── Contacts ──────────────────────────────────────────────────
  "contacts.list": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS).optional(), syncStatus: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.syncStatus) where.syncStatus = input.syncStatus;
      return ctx.db.externalContact.findMany({ where, orderBy: { updatedAt: "desc" }, take: input?.limit || 50 });
    }),
  "contacts.link": publicProcedure
    .input(z.object({ externalContactId: z.string(), clientId: z.string().optional(), leadId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.externalContact.update({ where: { id: input.externalContactId }, data: { clientId: input.clientId, leadId: input.leadId, syncStatus: "SYNCED" } });
    }),

  // ─── Forms ─────────────────────────────────────────────────────
  "forms.list": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS).optional() }).optional())
    .query(async ({ input }) => {
      const results: any[] = [];
      const providers = input?.provider ? [input.provider] : PROVIDERS;
      for (const p of providers) {
        try {
          let r: any;
          if (p === "LAWMATICS") r = await lawmaticsGetForms();
          else if (p === "HUBSPOT") r = await hubspotGetForms();
          else if (p === "COGNITO_FORMS") r = await cognitoGetForms();
          else if (p === "WUFOO") r = await wufooGetForms();
          if (r?.success) {
            const forms = (r.data?.results || r.data?.Forms || r.data?.forms || r.data || []);
            for (const f of (Array.isArray(forms) ? forms : [])) {
              results.push({ provider: p, id: f.id || f.Hash || f.formId, name: f.name || f.Name || f.title, entries: f.entryCount || f.EntryCount || f.entries || 0 });
            }
          }
        } catch {}
      }
      return results;
    }),
  "forms.submissions": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS).optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      return ctx.db.externalFormSubmission.findMany({ where, orderBy: { submittedAt: "desc" }, take: input?.limit || 50 });
    }),
  "forms.process": publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.externalFormSubmission.findUniqueOrThrow({ where: { id: input.submissionId } });
      const fields = JSON.parse(sub.fields);
      return syncFormSubmission(sub.provider, { externalFormId: sub.externalFormId || undefined, formName: sub.formName, fields, respondentName: sub.respondentName || undefined, respondentEmail: sub.respondentEmail || undefined, respondentPhone: sub.respondentPhone || undefined });
    }),

  // ─── Field Mappings ────────────────────────────────────────────
  "mappings.list": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      return ctx.db.formFieldMapping.findMany({ where, orderBy: { formName: "asc" } });
    }),
  "mappings.create": publicProcedure
    .input(z.object({ provider: z.enum(PROVIDERS), externalFormId: z.string(), formName: z.string(), mappings: z.string(), autoCreateLead: z.boolean().optional(), leadSource: z.string().optional(), assignTo: z.string().optional(), notifyEmail: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.formFieldMapping.create({ data: input })),
  "mappings.update": publicProcedure
    .input(z.object({ id: z.string(), mappings: z.string().optional(), autoCreateLead: z.boolean().optional(), leadSource: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.formFieldMapping.update({ where: { id }, data }); }),

  // ─── Provider-specific ─────────────────────────────────────────
  "lawmatics.contacts": publicProcedure.query(async () => lawmaticsGetContacts()),
  "lawmatics.forms": publicProcedure.query(async () => lawmaticsGetForms()),
  "leadDocket.leads": publicProcedure.query(async () => leadDocketGetLeads()),
  "leadDocket.sources": publicProcedure.query(async () => leadDocketGetSources()),
  "hubspot.contacts": publicProcedure.query(async () => hubspotGetContacts()),
  "hubspot.forms": publicProcedure.query(async () => hubspotGetForms()),
  "cognito.forms": publicProcedure.query(async () => cognitoGetForms()),
  "wufoo.forms": publicProcedure.query(async () => wufooGetForms()),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.overview": publicProcedure.query(async ({ ctx }) => {
    const contacts = await ctx.db.externalContact.groupBy({ by: ["provider"], _count: true });
    const forms = await ctx.db.externalFormSubmission.groupBy({ by: ["provider"], _count: true });
    const leads = await ctx.db.externalFormSubmission.count({ where: { processingStatus: "MAPPED" } });
    return { contactsByProvider: contacts, formsByProvider: forms, totalLeadsCreated: leads };
  }),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const totalContacts = await ctx.db.externalContact.count();
    const totalForms = await ctx.db.externalFormSubmission.count();
    const pendingForms = await ctx.db.externalFormSubmission.count({ where: { processingStatus: "RECEIVED" } });
    const leadsCreated = await ctx.db.externalFormSubmission.count({ where: { processingStatus: "MAPPED" } });
    const syncErrors = await ctx.db.externalContact.count({ where: { syncStatus: "ERROR" } });
    const integrations = await ctx.db.crmIntakeIntegration.findMany({ where: { isEnabled: true } });
    return { totalContacts, totalForms, pendingForms, leadsCreated, syncErrors, enabledProviders: integrations.length };
  }),
});
