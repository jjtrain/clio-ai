import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as scanEngine from "@/lib/scanner-engine";

export const scannerRouter = router({
  upload: publicProcedure
    .input(z.object({
      imageUrl: z.string(),
      userId: z.string(),
      userEmail: z.string().optional(),
      imageFormat: z.string().optional(),
      matterId: z.string().optional(),
      deviceType: z.string().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const scan = await db.scannedDocument.create({
        data: {
          imageUrl: input.imageUrl,
          userId: input.userId,
          userEmail: input.userEmail,
          imageFormat: input.imageFormat,
          matterId: input.matterId,
          deviceType: input.deviceType,
          location: input.location,
          status: "SCN_UPLOADING" as any,
        },
      });
      scanEngine.processScannedDocument(scan.id).catch(console.error);
      return scan;
    }),

  list: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
      matterId: z.string().optional(),
      status: z.string().optional(),
      documentType: z.string().optional(),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
      page: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.userId) where.userId = input.userId;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.documentType) where.documentType = input.documentType;
      if (input?.dateRange) where.scannedAt = { gte: new Date(input.dateRange.from), lte: new Date(input.dateRange.to) };
      const page = input?.page ?? 1;
      return db.scannedDocument.findMany({ where, orderBy: { scannedAt: "desc" }, take: 20, skip: (page - 1) * 20 });
    }),

  get: publicProcedure
    .input(z.object({ scanId: z.string() }))
    .query(async ({ input }) => {
      return db.scannedDocument.findUnique({ where: { id: input.scanId } });
    }),

  update: publicProcedure
    .input(z.object({ scanId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.scannedDocument.update({ where: { id: input.scanId }, data: input.data });
    }),

  delete: publicProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input }) => {
      return db.scannedDocument.delete({ where: { id: input.scanId } });
    }),

  process: publicProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input }) => {
      return scanEngine.processScannedDocument(input.scanId);
    }),

  reprocess: publicProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input }) => {
      await db.scannedDocument.update({
        where: { id: input.scanId },
        data: { status: "SCN_UPLOADING" as any, ocrText: null, aiDocumentType: null, aiSuggestedName: null, aiSummary: null, aiExtractedEntities: null, aiSuggestedMatter: null } as any,
      });
      return scanEngine.processScannedDocument(input.scanId);
    }),

  fileToMatter: publicProcedure
    .input(z.object({ scanId: z.string(), matterId: z.string(), fileName: z.string().optional() }))
    .mutation(async ({ input }) => {
      return scanEngine.fileToMatter(input.scanId, input.matterId, input.fileName);
    }),

  assignMatter: publicProcedure
    .input(z.object({ scanId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => {
      return db.scannedDocument.update({ where: { id: input.scanId }, data: { matterId: input.matterId } });
    }),

  rename: publicProcedure
    .input(z.object({ scanId: z.string(), name: z.string() }))
    .mutation(async ({ input }) => {
      return db.scannedDocument.update({ where: { id: input.scanId }, data: { userAssignedName: input.name } });
    }),

  mergePages: publicProcedure
    .input(z.object({ scanIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      return scanEngine.mergeScanPages(input.scanIds);
    }),

  addPage: publicProcedure
    .input(z.object({ parentScanId: z.string(), imageUrl: z.string() }))
    .mutation(async ({ input }) => {
      const parent = await db.scannedDocument.findUniqueOrThrow({ where: { id: input.parentScanId } });
      const newScan = await db.scannedDocument.create({
        data: {
          imageUrl: input.imageUrl,
          userId: parent.userId,
          relatedScanIds: [input.parentScanId] as any,
          status: "SCN_UPLOADING" as any,
        },
      });
      const existing = (parent.relatedScanIds as string[] | null) ?? [];
      await db.scannedDocument.update({
        where: { id: input.parentScanId },
        data: { relatedScanIds: [...existing, newScan.id] as any },
      });
      return newScan;
    }),

  extractContact: publicProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input }) => {
      const scan = await db.scannedDocument.findUniqueOrThrow({ where: { id: input.scanId } });
      return scanEngine.extractBusinessCard(scan.ocrText ?? "");
    }),

  "settings.get": publicProcedure
    .query(async () => {
      const settings = await db.scannerSettings.findFirst();
      if (settings) return settings;
      return db.scannerSettings.create({ data: { id: "default" } });
    }),

  "settings.update": publicProcedure
    .input(z.object({ data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.scannerSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...input.data } as any,
        update: input.data as any,
      });
    }),
});
