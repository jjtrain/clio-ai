import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { assembleDocument, previewAssembly, parseTemplate, validateTemplate } from "@/lib/assembly-engine";
import { seedDataSources, resolveLookupByName } from "@/lib/assembly-data-sources";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const documentAssemblyRouter = router({
  // TEMPLATES
  getTemplates: publicProcedure.input(z.object({ practiceArea: z.string().optional(), documentType: z.string().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.documentType) where.documentType = input.documentType;
      if (input.status) where.status = input.status; else where.status = { not: "archived" };
      return ctx.db.assemblyTemplate.findMany({ where, orderBy: [{ practiceArea: "asc" }, { name: "asc" }], include: { _count: { select: { documents: true } } } });
    }),

  getTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.assemblyTemplate.findUnique({ where: { id: input.templateId } });
  }),

  createTemplate: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), documentType: z.string(), practiceArea: z.string(), jurisdiction: z.string().optional(), content: z.string(), headerContent: z.string().optional(), footerContent: z.string().optional(), mergeFieldSchema: z.any(), conditionalRules: z.any().optional(), computedFields: z.any().optional(), signatureBlocks: z.any().optional(), styleConfig: z.any().optional(), tags: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.assemblyTemplate.create({ data: { ...input, status: "active", firmId: DEFAULT_FIRM_ID, createdBy: DEFAULT_USER_ID } });
    }),

  updateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string().optional(), content: z.string().optional(), mergeFieldSchema: z.any().optional(), conditionalRules: z.any().optional(), computedFields: z.any().optional(), status: z.string().optional(), headerContent: z.string().optional(), footerContent: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { templateId, ...data } = input; return ctx.db.assemblyTemplate.update({ where: { id: templateId }, data: { ...data, version: { increment: 1 } } }); }),

  duplicateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), newName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orig = await ctx.db.assemblyTemplate.findUnique({ where: { id: input.templateId } });
      if (!orig) throw new Error("Template not found");
      const { id, createdAt, updatedAt, usageCount, lastUsedAt, ...data } = orig;
      return ctx.db.assemblyTemplate.create({ data: { ...data, name: input.newName, parentTemplateId: id, isSystemTemplate: false, version: 1, status: "draft" } });
    }),

  deleteTemplate: publicProcedure.input(z.object({ templateId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.assemblyTemplate.update({ where: { id: input.templateId }, data: { status: "archived" } });
  }),

  validateTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ input }) => { return validateTemplate(input.templateId); }),

  parseTemplate: publicProcedure.input(z.object({ content: z.string() })).query(({ input }) => { return parseTemplate(input.content); }),

  // ASSEMBLY
  assembleDocument: publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), overrides: z.any().optional() }))
    .mutation(async ({ input }) => { return assembleDocument({ ...input, assembledBy: DEFAULT_USER_ID }); }),

  previewAssembly: publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), overrides: z.any().optional() }))
    .query(async ({ input }) => { return previewAssembly(input); }),

  // DOCUMENTS
  getDocuments: publicProcedure.input(z.object({ matterId: z.string().optional(), templateId: z.string().optional(), status: z.string().optional(), limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.templateId) where.templateId = input.templateId;
      if (input.status) where.status = input.status;
      return ctx.db.assembledDocument.findMany({ where, include: { template: { select: { name: true, documentType: true } } }, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  getDocument: publicProcedure.input(z.object({ documentId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.assembledDocument.findUnique({ where: { id: input.documentId }, include: { template: true } });
  }),

  updateDocumentStatus: publicProcedure
    .input(z.object({ documentId: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { status: input.status };
      if (input.status === "approved") { data.approvedBy = DEFAULT_USER_ID; data.approvedAt = new Date(); }
      if (input.status === "review") { data.reviewedBy = DEFAULT_USER_ID; data.reviewedAt = new Date(); }
      return ctx.db.assembledDocument.update({ where: { id: input.documentId }, data });
    }),

  regenerateDocument: publicProcedure
    .input(z.object({ documentId: z.string(), overrides: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.assembledDocument.findUnique({ where: { id: input.documentId } });
      if (!doc) throw new Error("Document not found");
      return assembleDocument({ templateId: doc.templateId, matterId: doc.matterId, overrides: input.overrides, assembledBy: DEFAULT_USER_ID });
    }),

  // DATA SOURCES
  getDataSources: publicProcedure.query(async ({ ctx }) => { return ctx.db.assemblyDataSource.findMany({ orderBy: { sourceKey: "asc" } }); }),
  seedDataSources: publicProcedure.mutation(async () => { const count = await seedDataSources(); return { seeded: count }; }),

  // LOOKUP TABLES
  getLookupTables: publicProcedure.query(async ({ ctx }) => { return ctx.db.assemblyLookupTable.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { name: "asc" } }); }),

  getLookupTable: publicProcedure.input(z.object({ tableId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.assemblyLookupTable.findUnique({ where: { id: input.tableId } });
  }),

  createLookupTable: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), practiceArea: z.string().optional(), lookupKey: z.string(), entries: z.any(), defaultEntry: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.assemblyLookupTable.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  updateLookupTable: publicProcedure
    .input(z.object({ tableId: z.string(), entries: z.any().optional(), defaultEntry: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { const { tableId, ...data } = input; return ctx.db.assemblyLookupTable.update({ where: { id: tableId }, data }); }),

  resolveLookup: publicProcedure
    .input(z.object({ tableName: z.string(), lookupValue: z.string() }))
    .query(async ({ input }) => { return resolveLookupByName(input.tableName, DEFAULT_FIRM_ID, input.lookupValue); }),

  // SNIPPETS
  getSnippets: publicProcedure.input(z.object({ category: z.string().optional(), practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.category) where.category = input.category;
      if (input.practiceArea) where.OR = [{ practiceArea: input.practiceArea }, { practiceArea: null }];
      return ctx.db.assemblySnippet.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] });
    }),

  createSnippet: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), category: z.string(), practiceArea: z.string().optional(), content: z.string(), tags: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.assemblySnippet.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  updateSnippet: publicProcedure
    .input(z.object({ snippetId: z.string(), name: z.string().optional(), content: z.string().optional(), category: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { snippetId, ...data } = input; return ctx.db.assemblySnippet.update({ where: { id: snippetId }, data }); }),

  deleteSnippet: publicProcedure.input(z.object({ snippetId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.assemblySnippet.delete({ where: { id: input.snippetId } });
  }),

  // STATS
  getStats: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.assemblyTemplate.count({ where: { firmId: DEFAULT_FIRM_ID, status: "active" } });
    const documents = await ctx.db.assembledDocument.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const snippets = await ctx.db.assemblySnippet.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const lookups = await ctx.db.assemblyLookupTable.count({ where: { firmId: DEFAULT_FIRM_ID } });
    return { templates, documents, snippets, lookups };
  }),
});
