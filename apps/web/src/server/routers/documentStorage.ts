import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { initializeMatterFolder, getMatterDocumentIndex, getStorageStats, searchAcrossProviders } from "@/lib/document-storage-engine";
import { dropboxTestConnection, dropboxListFolder, dropboxSearch, boxTestConnection, boxListFolder, gdriveTestConnection, gdriveListFolder, gdriveSearch, onedriveTestConnection, onedriveListFolder, onedriveSearch } from "@/lib/integrations/storage-providers";

const STORAGE_PROVIDERS = ["DROPBOX", "BOX", "GOOGLE_DRIVE", "ONEDRIVE"] as const;
function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const documentStorageRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.storageIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), accessToken: i.accessToken ? "***" : null, refreshToken: i.refreshToken ? "***" : null }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(STORAGE_PROVIDERS), displayName: z.string().optional(), accessToken: z.string().optional().nullable(), refreshToken: z.string().optional().nullable(), accountEmail: z.string().optional().nullable(), rootFolderId: z.string().optional().nullable(), rootFolderPath: z.string().optional().nullable(), isEnabled: z.boolean().optional(), autoSync: z.boolean().optional(), syncDirection: z.string().optional(), folderStructure: z.string().optional(), conflictResolution: z.string().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.accessToken === "***") delete clean.accessToken;
      if (clean.refreshToken === "***") delete clean.refreshToken;
      return ctx.db.storageIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(STORAGE_PROVIDERS) }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { DROPBOX: dropboxTestConnection, BOX: boxTestConnection, GOOGLE_DRIVE: gdriveTestConnection, ONEDRIVE: onedriveTestConnection };
      return (tests[input.provider] || (() => ({ success: false, error: "Unknown" })))();
    }),

  // ─── Folders ───────────────────────────────────────────────────
  "folders.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), provider: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.provider) where.provider = input.provider;
      return ctx.db.storageFolder.findMany({ where, orderBy: { name: "asc" } });
    }),
  "folders.initialize": publicProcedure
    .input(z.object({ matterId: z.string(), provider: z.enum(STORAGE_PROVIDERS).optional() }))
    .mutation(async ({ input }) => {
      if (input.provider) return initializeMatterFolder(input.matterId, input.provider);
      // All enabled providers
      const integrations = await (await import("@/lib/db")).db.storageIntegration.findMany({ where: { isEnabled: true } });
      const results: any[] = [];
      for (const int of integrations) { results.push({ provider: int.provider, ...(await initializeMatterFolder(input.matterId, int.provider)) }); }
      return { results };
    }),
  "folders.browse": publicProcedure
    .input(z.object({ provider: z.enum(STORAGE_PROVIDERS), folderId: z.string().optional(), path: z.string().optional() }))
    .query(async ({ input }) => {
      if (input.provider === "DROPBOX") return dropboxListFolder(input.path || "");
      if (input.provider === "BOX") return boxListFolder(input.folderId || "0");
      if (input.provider === "GOOGLE_DRIVE") return gdriveListFolder(input.folderId || "root");
      if (input.provider === "ONEDRIVE") return onedriveListFolder(input.folderId);
      return { success: false, error: "Unknown provider" };
    }),

  // ─── Files ─────────────────────────────────────────────────────
  "files.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), provider: z.string().optional(), folderId: z.string().optional(), syncStatus: z.string().optional(), search: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.provider) where.provider = input.provider;
      if (input?.folderId) where.folderId = input.folderId;
      if (input?.syncStatus) where.syncStatus = input.syncStatus;
      if (input?.search) where.name = { contains: input.search, mode: "insensitive" };
      return ctx.db.storageFile.findMany({ where, orderBy: { lastModifiedAt: "desc" }, take: input?.limit || 50 });
    }),
  "files.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.storageFile.findUniqueOrThrow({ where: { id: input.id } })),
  "files.search": publicProcedure
    .input(z.object({ query: z.string(), matterId: z.string().optional(), provider: z.enum(STORAGE_PROVIDERS).optional() }))
    .mutation(async ({ input }) => {
      if (input.provider) {
        if (input.provider === "DROPBOX") return dropboxSearch(input.query);
        if (input.provider === "GOOGLE_DRIVE") return gdriveSearch(input.query);
        if (input.provider === "ONEDRIVE") return onedriveSearch(input.query);
      }
      return { success: true, data: await searchAcrossProviders(input.query, input.matterId) };
    }),
  "files.linkToDocument": publicProcedure
    .input(z.object({ fileId: z.string(), documentId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.storageFile.update({ where: { id: input.fileId }, data: { documentId: input.documentId } })),

  // ─── Sharing ───────────────────────────────────────────────────
  "share.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), fileId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.fileId) where.fileId = input.fileId;
      return ctx.db.shareLink.findMany({ where, orderBy: { createdAt: "desc" } });
    }),
  "share.create": publicProcedure
    .input(z.object({ provider: z.string(), fileId: z.string().optional(), folderId: z.string().optional(), matterId: z.string().optional(), url: z.string(), permission: z.string().default("VIEW"), password: z.string().optional(), expiresAt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.shareLink.create({ data: { ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined } })),
  "share.revoke": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.shareLink.update({ where: { id: input.id }, data: { isActive: false } })),

  // ─── Sync ──────────────────────────────────────────────────────
  "sync.status": publicProcedure.query(async () => getStorageStats()),
  "sync.getConflicts": publicProcedure.query(async ({ ctx }) => ctx.db.storageFile.findMany({ where: { syncStatus: "CONFLICT" } })),
  "sync.resolveConflict": publicProcedure
    .input(z.object({ fileId: z.string(), resolution: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.storageFile.update({ where: { id: input.fileId }, data: { syncStatus: "SYNCED" } })),

  // ─── Document Index ────────────────────────────────────────────
  "index.matter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => getMatterDocumentIndex(input.matterId)),

  // ─── Folder Templates ──────────────────────────────────────────
  "templates.list": publicProcedure.query(async ({ ctx }) => ctx.db.matterFolderTemplate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  "templates.create": publicProcedure
    .input(z.object({ name: z.string(), practiceArea: z.string().optional(), subfolders: z.string(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.matterFolderTemplate.create({ data: input })),
  "templates.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), practiceArea: z.string().optional(), subfolders: z.string().optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.matterFolderTemplate.update({ where: { id }, data }); }),
  "templates.seed": publicProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.matterFolderTemplate.count();
    if (existing > 0) return { seeded: false };
    const templates = [
      { name: "Default Litigation", practiceArea: "Litigation", isDefault: true, subfolders: JSON.stringify([{name:"Pleadings"},{name:"Discovery",subfolders:[{name:"Interrogatories"},{name:"Document Requests"},{name:"Depositions"}]},{name:"Motions"},{name:"Correspondence"},{name:"Research"},{name:"Court Orders"},{name:"Billing"}]) },
      { name: "Family Law", practiceArea: "Family Law", subfolders: JSON.stringify([{name:"Pleadings"},{name:"Financial Disclosure"},{name:"Custody"},{name:"Support Calculations"},{name:"Settlement"},{name:"Correspondence"},{name:"Billing"}]) },
      { name: "Personal Injury", practiceArea: "Personal Injury", subfolders: JSON.stringify([{name:"Pleadings"},{name:"Medical Records"},{name:"Discovery"},{name:"Demand Package"},{name:"Insurance"},{name:"Settlement"},{name:"Expert Reports"},{name:"Billing"}]) },
      { name: "Corporate", practiceArea: "Corporate", subfolders: JSON.stringify([{name:"Formation Documents"},{name:"Agreements"},{name:"Corporate Records"},{name:"Due Diligence"},{name:"Closing"},{name:"Compliance"},{name:"Correspondence"},{name:"Billing"}]) },
    ];
    await ctx.db.matterFolderTemplate.createMany({ data: templates });
    return { seeded: true, count: templates.length };
  }),

  // ─── Activity ──────────────────────────────────────────────────
  "activity.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), fileId: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.fileId) where.fileId = input.fileId;
      return ctx.db.storageActivity.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async () => getStorageStats()),
});
