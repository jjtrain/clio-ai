import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { clearbriefAnalyze, clearbriefCheckCitations, clearbriefFindAuthority } from "@/lib/integrations/clearbrief";
import { definelyAnalyze, definelyExtractTerms, definelyCheckCrossRefs, definelyCompareVersions } from "@/lib/integrations/definely";
import { medilenzSubmitRecords, medilenzGetSummary, medilenzGetStatus } from "@/lib/integrations/medilenz";
import { gavelGetTemplates, gavelGenerateDocument } from "@/lib/integrations/gavel";
import { infotrackGetCourts, infotrackSubmitFiling, infotrackRequestService, infotrackGetStatus } from "@/lib/integrations/infotrack";
import { docketbirdSearchCases, docketbirdSearchByParty, docketbirdSearchByJudge, docketbirdGetJudgeAnalytics } from "@/lib/integrations/docketbird";
import { generateFromTemplate, draftFreeform, refineDocument, suggestImprovements, generateFromOutline } from "@/lib/drafting-ai";

const DOC_PROVIDER = ["CLEARBRIEF", "DEFINELY", "MEDILENZ", "GAVEL", "INFOTRACK", "DOCKETBIRD"] as const;

function maskKey(key: string | null): string | null {
  if (!key) return null;
  return key.length > 4 ? "****" + key.slice(-4) : "****";
}

export const docToolsRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.docToolIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(DOC_PROVIDER), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      if (clean.apiSecret?.startsWith("****")) delete clean.apiSecret;
      return ctx.db.docToolIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),

  // ─── Clearbrief ────────────────────────────────────────────────
  "clearbrief.analyze": publicProcedure
    .input(z.object({ text: z.string(), briefType: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await clearbriefAnalyze(input.text, input.briefType);
      if (result.success) {
        await ctx.db.clearBriefReview.create({ data: { matterId: input.matterId, briefType: input.briefType, processingStatus: "COMPLETED", completedAt: new Date(), citationReport: JSON.stringify((result as any).data?.citations), factCheckResults: JSON.stringify((result as any).data?.facts), suggestedAuthorities: JSON.stringify((result as any).data?.suggestedAuthorities) } });
      }
      return result;
    }),
  "clearbrief.checkCitations": publicProcedure
    .input(z.object({ citations: z.array(z.string()) }))
    .mutation(async ({ input }) => clearbriefCheckCitations(input.citations)),
  "clearbrief.findAuthority": publicProcedure
    .input(z.object({ claim: z.string(), jurisdiction: z.string() }))
    .mutation(async ({ input }) => clearbriefFindAuthority(input.claim, input.jurisdiction)),

  // ─── Definely ──────────────────────────────────────────────────
  "definely.analyze": publicProcedure
    .input(z.object({ text: z.string(), matterId: z.string(), documentType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await definelyAnalyze(input.text, input.documentType);
      if (result.success) {
        await ctx.db.definelyReview.create({ data: { matterId: input.matterId, processingStatus: "COMPLETED", completedAt: new Date(), termsReport: JSON.stringify((result as any).data?.terms), crossRefReport: JSON.stringify((result as any).data?.crossReferences), readabilityReport: JSON.stringify((result as any).data?.readability), numbering: JSON.stringify((result as any).data?.numbering) } });
      }
      return result;
    }),
  "definely.extractTerms": publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input }) => definelyExtractTerms(input.text)),
  "definely.checkCrossRefs": publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input }) => definelyCheckCrossRefs(input.text)),
  "definely.compareVersions": publicProcedure
    .input(z.object({ text1: z.string(), text2: z.string() }))
    .mutation(async ({ input }) => definelyCompareVersions(input.text1, input.text2)),

  // ─── Medilenz ──────────────────────────────────────────────────
  "medilenz.submit": publicProcedure
    .input(z.object({ matterId: z.string(), patientName: z.string(), recordType: z.string(), provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await medilenzSubmitRecords(input);
      const record = await ctx.db.medilenzRecord.create({ data: { matterId: input.matterId, patientName: input.patientName, recordType: input.recordType, provider: input.provider, status: "PROCESSING", medilenzCaseId: result.success ? (result as any).data?.caseId : undefined } });
      return { record, apiResult: result };
    }),
  "medilenz.getSummary": publicProcedure
    .input(z.object({ recordId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rec = await ctx.db.medilenzRecord.findUniqueOrThrow({ where: { id: input.recordId } });
      if (!rec.medilenzCaseId) return { success: false, error: "No Medilenz case ID" };
      const result = await medilenzGetSummary(rec.medilenzCaseId);
      if (result.success) {
        const data = (result as any).data;
        await ctx.db.medilenzRecord.update({ where: { id: input.recordId }, data: { status: "SUMMARIZED", aiSummary: data.summary, keyFindings: JSON.stringify(data.key_findings || data.keyFindings), diagnoses: JSON.stringify(data.diagnoses), treatments: JSON.stringify(data.treatments), medications: JSON.stringify(data.medications), chronology: JSON.stringify(data.chronology) } });
      }
      return result;
    }),
  "medilenz.list": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.medilenzRecord.findMany({ where: { matterId: input.matterId }, orderBy: { createdAt: "desc" } })),

  // ─── Gavel ─────────────────────────────────────────────────────
  "gavel.templates.list": publicProcedure.query(async ({ ctx }) => ctx.db.gavelTemplate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  "gavel.generate": publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), fieldValues: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await gavelGenerateDocument(input.templateId, JSON.parse(input.fieldValues));
      const doc = await ctx.db.gavelDocument.create({ data: { templateId: input.templateId, matterId: input.matterId, title: input.title, fieldValues: input.fieldValues, status: result.success ? "COMPLETED" : "FAILED", generatedUrl: (result as any).data?.url, gavelDocumentId: (result as any).data?.id } });
      return { doc, apiResult: result };
    }),

  // ─── InfoTrack ─────────────────────────────────────────────────
  "infotrack.getCourts": publicProcedure
    .input(z.object({ jurisdiction: z.string() }))
    .query(async ({ input }) => infotrackGetCourts(input.jurisdiction)),
  "infotrack.submitFiling": publicProcedure
    .input(z.object({ matterId: z.string(), courtId: z.string(), caseNumber: z.string(), filingType: z.string(), description: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await infotrackSubmitFiling(input);
      const filing = await ctx.db.infoTrackFiling.create({ data: { matterId: input.matterId, filingType: input.filingType, court: input.courtId, caseNumber: input.caseNumber, description: input.description, status: result.success ? "SUBMITTED" : "DRAFT", infotrackOrderId: (result as any).data?.order_id } });
      return { filing, apiResult: result };
    }),
  "infotrack.requestService": publicProcedure
    .input(z.object({ matterId: z.string(), recipientName: z.string(), recipientAddress: z.string(), serviceMethod: z.string(), description: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await infotrackRequestService(input);
      const filing = await ctx.db.infoTrackFiling.create({ data: { matterId: input.matterId, filingType: "SERVICE_OF_PROCESS", description: input.description, recipientName: input.recipientName, recipientAddress: input.recipientAddress, serviceMethod: input.serviceMethod, status: result.success ? "SUBMITTED" : "DRAFT", infotrackOrderId: (result as any).data?.order_id } });
      return { filing, apiResult: result };
    }),
  "infotrack.list": publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.infoTrackFiling.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
    }),
  "infotrack.getStatus": publicProcedure
    .input(z.object({ filingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const filing = await ctx.db.infoTrackFiling.findUniqueOrThrow({ where: { id: input.filingId } });
      if (!filing.infotrackOrderId) return filing;
      const result = await infotrackGetStatus(filing.infotrackOrderId);
      if (result.success) {
        const data = (result as any).data;
        await ctx.db.infoTrackFiling.update({ where: { id: input.filingId }, data: { status: data.status || filing.status, confirmationNumber: data.confirmation_number, filingDate: data.filing_date ? new Date(data.filing_date) : undefined } });
      }
      return ctx.db.infoTrackFiling.findUniqueOrThrow({ where: { id: input.filingId } });
    }),

  // ─── Docketbird ────────────────────────────────────────────────
  "docketbird.searchCases": publicProcedure
    .input(z.object({ query: z.string(), court: z.string().optional(), jurisdiction: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await docketbirdSearchCases(input);
      if (result.success) {
        await ctx.db.docketbirdSearch.create({ data: { searchType: "CASE", query: input.query, jurisdiction: input.jurisdiction, court: input.court, results: JSON.stringify((result as any).data), resultCount: Array.isArray((result as any).data) ? (result as any).data.length : 0 } });
      }
      return result;
    }),
  "docketbird.searchByParty": publicProcedure
    .input(z.object({ partyName: z.string(), court: z.string().optional() }))
    .mutation(async ({ input }) => docketbirdSearchByParty(input.partyName, input.court)),
  "docketbird.searchByJudge": publicProcedure
    .input(z.object({ judgeName: z.string(), court: z.string().optional() }))
    .mutation(async ({ input }) => docketbirdSearchByJudge(input.judgeName, input.court)),
  "docketbird.judgeAnalytics": publicProcedure
    .input(z.object({ judgeName: z.string(), court: z.string() }))
    .mutation(async ({ input }) => docketbirdGetJudgeAnalytics(input.judgeName, input.court)),

  // ─── Clio Drafting AI ──────────────────────────────────────────
  "drafting.templates.list": publicProcedure
    .input(z.object({ category: z.string().optional(), documentType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };
      if (input?.category) where.category = input.category;
      if (input?.documentType) where.documentType = input.documentType;
      return ctx.db.draftTemplate.findMany({ where, orderBy: { name: "asc" } });
    }),
  "drafting.templates.getById": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.draftTemplate.findUniqueOrThrow({ where: { id: input.id } })),
  "drafting.templates.create": publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), category: z.string(), practiceArea: z.string().optional(), documentType: z.string(), templateContent: z.string(), variables: z.string(), aiPrompt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.draftTemplate.create({ data: input })),
  "drafting.generate": publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), fieldValues: z.string(), customInstructions: z.string().optional(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.draftTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      const content = await generateFromTemplate(template.templateContent, JSON.parse(input.fieldValues), template.aiPrompt || undefined, input.customInstructions);
      await ctx.db.draftTemplate.update({ where: { id: input.templateId }, data: { usageCount: { increment: 1 } } });
      return ctx.db.draftDocument.create({ data: { matterId: input.matterId, title: input.title, content, variableValues: input.fieldValues, aiPrompt: input.customInstructions, aiGenerated: true, status: "DRAFT" } });
    }),
  "drafting.freeform": publicProcedure
    .input(z.object({ documentType: z.string(), practiceArea: z.string(), jurisdiction: z.string(), instructions: z.string(), matterId: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const content = await draftFreeform(input);
      return ctx.db.draftDocument.create({ data: { matterId: input.matterId, title: input.title, content, aiPrompt: input.instructions, aiGenerated: true, status: "DRAFT" } });
    }),
  "drafting.refine": publicProcedure
    .input(z.object({ draftId: z.string(), instructions: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.draftDocument.findUniqueOrThrow({ where: { id: input.draftId } });
      const content = await refineDocument(draft.content, input.instructions);
      return ctx.db.draftDocument.update({ where: { id: input.draftId }, data: { content, version: { increment: 1 }, aiPrompt: input.instructions } });
    }),
  "drafting.suggest": publicProcedure
    .input(z.object({ draftId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.draftDocument.findUniqueOrThrow({ where: { id: input.draftId } });
      return suggestImprovements(draft.content, "Legal Document");
    }),
  "drafting.fromOutline": publicProcedure
    .input(z.object({ outline: z.string(), documentType: z.string(), matterId: z.string(), context: z.string().optional(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const content = await generateFromOutline(input.outline, input.documentType, input.context || "");
      return ctx.db.draftDocument.create({ data: { matterId: input.matterId, title: input.title, content, aiPrompt: input.outline, aiGenerated: true, status: "DRAFT" } });
    }),
  "drafting.list": publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.draftDocument.findMany({ where, orderBy: { updatedAt: "desc" }, take: 50 });
    }),
  "drafting.getById": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.draftDocument.findUniqueOrThrow({ where: { id: input.id } })),
  "drafting.updateStatus": publicProcedure
    .input(z.object({ id: z.string(), status: z.enum(["DRAFT", "REVIEW", "APPROVED", "SENT", "SIGNED"]) }))
    .mutation(async ({ ctx, input }) => ctx.db.draftDocument.update({ where: { id: input.id }, data: { status: input.status } })),

  // ─── Seed Templates ────────────────────────────────────────────
  seedTemplates: publicProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.draftTemplate.count();
    if (existing > 0) return { seeded: false };
    const templates = [
      { name: "Retainer Agreement", category: "General", documentType: "Agreement", practiceArea: "General", isSystem: true, templateContent: "<h1>Retainer Agreement</h1><p>This agreement is entered into by {{clientName}} and the Law Firm...</p>", variables: JSON.stringify([{name:"clientName",label:"Client Name",type:"text",required:true},{name:"hourlyRate",label:"Hourly Rate",type:"number",required:true},{name:"retainerAmount",label:"Retainer Amount",type:"number",required:true}]) },
      { name: "Demand Letter", category: "Litigation", documentType: "Letter", practiceArea: "Litigation", isSystem: true, templateContent: "<p>{{date}}</p><p>{{recipientName}}<br/>{{recipientAddress}}</p><p>Re: {{clientName}} — Demand</p><p>Dear {{recipientName}}:</p><p>{{AI_GENERATE}}</p>", variables: JSON.stringify([{name:"recipientName",label:"Recipient",type:"text",required:true},{name:"recipientAddress",label:"Address",type:"textarea",required:true},{name:"demandAmount",label:"Demand Amount",type:"number",required:true},{name:"claimDescription",label:"Claim",type:"textarea",required:true}]) },
      { name: "Motion to Compel Discovery", category: "Litigation", documentType: "Motion", practiceArea: "Litigation", isSystem: true, templateContent: "<h1>MOTION TO COMPEL DISCOVERY</h1><p>{{courtName}}<br/>Index No. {{indexNumber}}</p><p>{{clientName}}, Plaintiff, v. {{opposingParty}}, Defendant.</p><p>{{AI_GENERATE}}</p>", variables: JSON.stringify([{name:"courtName",label:"Court",type:"text",required:true},{name:"indexNumber",label:"Index Number",type:"text",required:true},{name:"opposingParty",label:"Opposing Party",type:"text",required:true},{name:"deficiencies",label:"Discovery Deficiencies",type:"textarea",required:true}]) },
      { name: "Cease and Desist Letter", category: "IP", documentType: "Letter", practiceArea: "Intellectual Property", isSystem: true, templateContent: "<p>{{date}}</p><p>RE: CEASE AND DESIST — {{ipDescription}}</p><p>Dear {{recipientName}}:</p><p>{{AI_GENERATE}}</p>", variables: JSON.stringify([{name:"recipientName",label:"Recipient",type:"text",required:true},{name:"ipType",label:"IP Type",type:"select",options:["Trademark","Copyright","Patent","Trade Secret"],required:true},{name:"ipDescription",label:"IP Description",type:"textarea",required:true},{name:"infringingActivity",label:"Infringing Activity",type:"textarea",required:true}]) },
      { name: "Petition for Divorce", category: "Family Law", documentType: "Petition", practiceArea: "Family Law", isSystem: true, templateContent: "<h1>SUPREME COURT OF THE STATE OF NEW YORK<br/>COUNTY OF {{county}}</h1><p>{{petitioner}}, Plaintiff, v. {{respondent}}, Defendant.</p><p>VERIFIED COMPLAINT FOR DIVORCE</p><p>{{AI_GENERATE}}</p>", variables: JSON.stringify([{name:"petitioner",label:"Petitioner",type:"text",required:true},{name:"respondent",label:"Respondent",type:"text",required:true},{name:"county",label:"County",type:"text",required:true},{name:"marriageDate",label:"Marriage Date",type:"date",required:true}]) },
    ];
    await ctx.db.draftTemplate.createMany({ data: templates });
    return { seeded: true, count: templates.length };
  }),
});
