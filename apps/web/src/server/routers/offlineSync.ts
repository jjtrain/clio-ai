import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

export const offlineSyncRouter = router({
  // 1. getMattersForCache
  getMattersForCache: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return db.matter.findMany({
        orderBy: { updatedAt: "desc" },
        take: input?.limit ?? 10,
        select: { id: true, name: true, updatedAt: true, client: { select: { name: true } } },
      });
    }),

  // 2. downloadMatter
  downloadMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId }, include: { client: true } });
      const voiceNotes = await db.voiceNote.findMany({ where: { matterId: input.matterId }, orderBy: { recordedAt: "desc" }, take: 20, select: { id: true, summary: true, transcription: true, recordedAt: true, category: true } });
      const tasks = await db.task.findMany({ where: { matterId: input.matterId, NOT: { status: "COMPLETED" as any } }, take: 20 });
      const timeEntries = await db.timeEntry.findMany({ where: { matterId: input.matterId }, orderBy: { date: "desc" }, take: 20 });
      const documents = await db.document.findMany({ where: { matterId: input.matterId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, filename: true, createdAt: true } });
      const courtAssignment = await db.matterCourtAssignment.findFirst({ where: { matterId: input.matterId }, include: { court: true, judge: true } });
      const solData = await db.statuteOfLimitations.findFirst({ where: { matterId: input.matterId, status: "SOL_ACTIVE" as any } });
      const customFieldValues = await db.matterCustomFieldValue.findMany({ where: { matterId: input.matterId } });
      return { matter, voiceNotes, tasks, timeEntries, documents, courtAssignment, solData, customFieldValues, downloadedAt: new Date() };
    }),

  // 3. downloadIncrementalUpdate
  downloadIncrementalUpdate: publicProcedure
    .input(z.object({ matterId: z.string(), sinceTimestamp: z.string() }))
    .query(async ({ input }) => {
      const since = new Date(input.sinceTimestamp);
      const matters = await db.matter.findMany({ where: { id: input.matterId, updatedAt: { gt: since } } });
      const notes = await db.voiceNote.findMany({ where: { matterId: input.matterId, updatedAt: { gt: since } } });
      const tasks = await db.task.findMany({ where: { matterId: input.matterId, updatedAt: { gt: since } } });
      const entries = await db.timeEntry.findMany({ where: { matterId: input.matterId, updatedAt: { gt: since } } });
      return { matters, notes, tasks, entries, since: input.sinceTimestamp };
    }),

  // 4. uploadChanges
  uploadChanges: publicProcedure
    .input(z.object({ changes: z.array(z.object({ id: z.string(), entityType: z.string(), entityId: z.string().optional(), changeType: z.string(), fieldChanges: z.string(), createdAt: z.string() })) }))
    .mutation(async ({ input }) => {
      const results: { changeId: string; status: "synced" | "conflict" | "failed" }[] = [];
      for (const change of input.changes) {
        try {
          const data = JSON.parse(change.fieldChanges);
          const model = (db as any)[change.entityType];
          if (change.changeType === "CREATE") {
            await model.create({ data });
          } else if (change.changeType === "UPDATE" && change.entityId) {
            await model.update({ where: { id: change.entityId }, data });
          } else if (change.changeType === "DELETE" && change.entityId) {
            await model.delete({ where: { id: change.entityId } });
          }
          await db.offlineChange.create({ data: { id: change.id, entityType: change.entityType, entityId: change.entityId ?? "", changeType: change.changeType as any, fieldChanges: change.fieldChanges, status: "OCS_SYNCED" as any, syncedAt: new Date() } as any });
          results.push({ changeId: change.id, status: "synced" });
        } catch {
          results.push({ changeId: change.id, status: "failed" });
        }
      }
      return results;
    }),

  // 5. resolveConflict
  resolveConflict: publicProcedure
    .input(z.object({ changeId: z.string(), resolution: z.string(), mergedData: z.string().optional() }))
    .mutation(async ({ input }) => {
      const change = await db.offlineChange.findUniqueOrThrow({ where: { id: input.changeId } });
      if (input.resolution === "local_wins") {
        const data = JSON.parse(input.mergedData ?? (change as any).fieldChanges);
        const model = (db as any)[(change as any).entityType];
        await model.update({ where: { id: (change as any).entityId }, data });
        await db.offlineChange.update({ where: { id: input.changeId }, data: { status: "OCS_SYNCED" as any, resolvedAt: new Date() } as any });
      } else {
        await db.offlineChange.update({ where: { id: input.changeId }, data: { status: "OCS_DISCARDED" as any, resolvedAt: new Date() } as any });
      }
      return { changeId: input.changeId, resolution: input.resolution };
    }),

  // 6. getSyncStatus
  getSyncStatus: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const pendingChanges = await db.offlineChange.count({ where: { userId: input.userId, status: "OCS_PENDING" as any } });
      const lastLog = await db.offlineSyncLog.findFirst({ where: { userId: input.userId }, orderBy: { syncedAt: "desc" } } as any);
      const conflicts = await db.offlineChange.count({ where: { userId: input.userId, status: "OCS_CONFLICT" as any } });
      return { lastSync: (lastLog as any)?.syncedAt ?? null, pendingChanges, conflicts };
    }),

  // 7. logSync
  logSync: publicProcedure
    .input(z.object({ userId: z.string(), syncType: z.string(), direction: z.string(), status: z.string(), mattersDownloaded: z.number().optional(), changesUploaded: z.number().optional(), conflictsDetected: z.number().optional(), duration: z.number().optional(), deviceType: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.offlineSyncLog.create({ data: { ...input, syncedAt: new Date() } as any });
    }),

  // 8. getConfig
  getConfig: publicProcedure
    .query(async () => {
      const config = await db.offlineCacheConfig.findFirst();
      return config ?? { maxCachedMatters: 10, cacheStrategy: "recent", autoSyncOnReconnect: true, syncIntervalMinutes: 15, cacheExpirationHours: 72, conflictStrategy: "ask", cacheSizeLimitMB: 100, cacheDocuments: false, cacheVoiceNotes: true, syncNotifications: true };
    }),

  // 9. updateConfig
  updateConfig: publicProcedure
    .input(z.object({ maxCachedMatters: z.number().optional(), cacheStrategy: z.string().optional(), autoSyncOnReconnect: z.boolean().optional(), syncIntervalMinutes: z.number().optional(), cacheExpirationHours: z.number().optional(), conflictStrategy: z.string().optional(), cacheSizeLimitMB: z.number().optional(), cacheDocuments: z.boolean().optional(), cacheVoiceNotes: z.boolean().optional(), syncNotifications: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return db.offlineCacheConfig.upsert({ where: { id: "default" }, create: { id: "default", ...input } as any, update: input as any });
    }),
});
