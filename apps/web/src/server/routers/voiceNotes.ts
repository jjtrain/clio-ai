import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as vnEngine from "@/lib/voice-note-engine";

export const voiceNotesRouter = router({
  // 1. create
  create: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        transcription: z.string(),
        audioDuration: z.number().optional(),
        audioFormat: z.string().optional(),
        category: z.string().optional(),
        authorName: z.string(),
        authorEmail: z.string().optional(),
        deviceType: z.string().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const note = await db.voiceNote.create({
        data: { ...input, transcriptionStatus: "TS_PROCESSING" as any } as any,
      });
      vnEngine.processVoiceNote(note.id).catch(console.error);
      return note;
    }),

  // 2. list
  list: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        authorEmail: z.string().optional(),
        category: z.string().optional(),
        isPinned: z.boolean().optional(),
        search: z.string().optional(),
        skip: z.number().optional(),
        take: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const where: any = {};
      if (input.matterId) where.matterId = input.matterId;
      if (input.authorEmail) where.authorEmail = input.authorEmail;
      if (input.category) where.category = input.category;
      if (input.isPinned !== undefined) where.isPinned = input.isPinned;
      if (input.search) where.transcription = { contains: input.search, mode: "insensitive" };
      return db.voiceNote.findMany({
        where,
        include: { matter: { select: { name: true } } },
        orderBy: { recordedAt: "desc" },
        skip: input.skip || 0,
        take: input.take || 50,
      });
    }),

  // 3. get
  get: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .query(async ({ input }) => {
      return db.voiceNote.findUnique({
        where: { id: input.voiceNoteId },
        include: { matter: true },
      });
    }),

  // 4. update
  update: publicProcedure
    .input(
      z.object({
        voiceNoteId: z.string(),
        editedTranscription: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(),
        isPrivileged: z.boolean().optional(),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { voiceNoteId, editedTranscription, ...rest } = input;
      const data: any = { ...rest };
      if (editedTranscription !== undefined) {
        data.editedTranscription = editedTranscription;
        data.transcriptionStatus = "TS_EDITED" as any;
      }
      return db.voiceNote.update({ where: { id: voiceNoteId }, data });
    }),

  // 5. delete
  delete: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      return db.voiceNote.delete({ where: { id: input.voiceNoteId } });
    }),

  // 6. search
  search: publicProcedure
    .input(z.object({ query: z.string(), matterId: z.string().optional() }))
    .query(async ({ input }) => {
      return vnEngine.searchNotes(input.query, input.matterId);
    }),

  // 7. pin
  pin: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      const note = await db.voiceNote.findUniqueOrThrow({ where: { id: input.voiceNoteId } });
      return db.voiceNote.update({
        where: { id: input.voiceNoteId },
        data: { isPinned: !(note as any).isPinned },
      });
    }),

  // 8. process
  process: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      return vnEngine.processVoiceNote(input.voiceNoteId);
    }),

  // 9. reprocess
  reprocess: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      await db.voiceNote.update({
        where: { id: input.voiceNoteId },
        data: { transcriptionStatus: "TS_PROCESSING" as any },
      });
      return vnEngine.processVoiceNote(input.voiceNoteId);
    }),

  // 10. transcribeAudio
  transcribeAudio: publicProcedure
    .input(z.object({ voiceNoteId: z.string(), transcription: z.string() }))
    .mutation(async ({ input }) => {
      return db.voiceNote.update({
        where: { id: input.voiceNoteId },
        data: { transcription: input.transcription } as any,
      });
    }),

  // 11. convertToTimeEntry
  convertToTimeEntry: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      const note = await db.voiceNote.findUniqueOrThrow({ where: { id: input.voiceNoteId } }) as any;
      const entry = await db.timeEntry.create({
        data: {
          matterId: note.matterId,
          userId: note.authorEmail || "system",
          description: note.suggestedActivity || "Voice note",
          duration: note.suggestedDuration || 6,
          date: note.recordedAt,
          billable: true,
          rate: null,
        } as any,
      });
      await db.voiceNote.update({ where: { id: input.voiceNoteId }, data: { timeEntryId: entry.id } as any });
      return entry;
    }),

  // 12. convertToDocketEntry
  convertToDocketEntry: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      const note = await db.voiceNote.findUniqueOrThrow({ where: { id: input.voiceNoteId } }) as any;
      const docket = note.suggestedDocketEntry ? JSON.parse(note.suggestedDocketEntry) : {};
      const task = await db.task.create({
        data: {
          matterId: note.matterId,
          title: docket.title || "Docket entry from voice note",
          description: docket.description || note.summary,
          dueDate: docket.date ? new Date(docket.date) : null,
        } as any,
      });
      return task;
    }),

  // 13. convertToTasks
  convertToTasks: publicProcedure
    .input(z.object({ voiceNoteId: z.string() }))
    .mutation(async ({ input }) => {
      const note = await db.voiceNote.findUniqueOrThrow({ where: { id: input.voiceNoteId } }) as any;
      const tasks = note.suggestedTasks ? JSON.parse(note.suggestedTasks) : [];
      for (const t of tasks) {
        await db.task.create({
          data: {
            matterId: note.matterId,
            title: t.title,
            description: t.description,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
          } as any,
        });
      }
      return { count: tasks.length };
    }),

  // 14. dismissSuggestion
  dismissSuggestion: publicProcedure
    .input(z.object({ voiceNoteId: z.string(), type: z.enum(["timeEntry", "docketEntry", "tasks"]) }))
    .mutation(async ({ input }) => {
      const clearMap: Record<string, any> = {
        timeEntry: { suggestedDuration: null, suggestedActivity: null, suggestedDescription: null, suggestedBillable: null },
        docketEntry: { suggestedDocketEntry: null },
        tasks: { suggestedTasks: null },
      };
      return db.voiceNote.update({
        where: { id: input.voiceNoteId },
        data: clearMap[input.type],
      });
    }),

  // 15. listByMatter
  listByMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return db.voiceNote.findMany({
        where: { matterId: input.matterId },
        orderBy: { recordedAt: "desc" },
      });
    }),

  // 16. listRecent
  listRecent: publicProcedure.query(async () => {
    return db.voiceNote.findMany({ orderBy: { recordedAt: "desc" }, take: 20 });
  }),

  // 17. getStats
  getStats: publicProcedure.query(async () => {
    const total = await db.voiceNote.count();
    const byCategory = await db.voiceNote.groupBy({ by: ["category"] as any, _count: true });
    const durAgg = await db.voiceNote.aggregate({ _sum: { audioDuration: true } } as any);
    return { total, byCategory, totalDuration: (durAgg as any)._sum?.audioDuration || 0 };
  }),

  // 18-19. settings
  settings: router({
    get: publicProcedure.query(async () => {
      const existing = await db.voiceNoteSettings.findFirst();
      if (existing) return existing;
      return db.voiceNoteSettings.create({ data: {} as any });
    }),

    update: publicProcedure
      .input(
        z.object({
          autoSuggestTimeEntries: z.boolean().optional(),
          autoSuggestDocketEntries: z.boolean().optional(),
          autoSuggestTasks: z.boolean().optional(),
          defaultCategory: z.string().optional(),
          transcriptionProvider: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await db.voiceNoteSettings.findFirst();
        if (existing) {
          return db.voiceNoteSettings.update({ where: { id: existing.id }, data: input as any });
        }
        return db.voiceNoteSettings.create({ data: input as any });
      }),
  }),
});
