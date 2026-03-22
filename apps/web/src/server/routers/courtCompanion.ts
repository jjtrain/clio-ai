import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

export const courtCompanionRouter = router({
  // 1. getMatterBrief
  getMatterBrief: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const matter = await db.matter.findUnique({
        where: { id: input.matterId },
        include: { client: true, _count: { select: { timeEntries: true } } },
      }) as any;
      const tasks = await db.task.findMany({
        where: { matterId: input.matterId, status: { not: "COMPLETED" }, dueDate: { lte: tomorrow } },
      }) as any;
      const courtAssignment = await db.matterCourtAssignment.findFirst({
        where: { matterId: input.matterId },
        include: { court: true, judge: true },
      }) as any;
      const recentNotes = await db.voiceNote.findMany({
        where: { matterId: input.matterId },
        take: 5, orderBy: { recordedAt: "desc" },
        select: { id: true, summary: true, recordedAt: true, category: true },
      }) as any;
      const activeSol = await db.statuteOfLimitations.findFirst({
        where: { matterId: input.matterId, status: "SOL_ACTIVE" as any },
        orderBy: { expirationDate: "asc" },
      }) as any;
      const courtReminders = await db.courtRuleReminder.findMany({
        where: { matterId: input.matterId, status: "RMS_PENDING" as any },
        take: 5,
      }) as any;
      const documents = await db.document.findMany({
        where: { matterId: input.matterId },
        take: 5, orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true },
      }) as any;
      const ca = courtAssignment as any;
      return {
        matter: { id: matter?.id, name: matter?.name, status: matter?.status, practiceArea: matter?.practiceArea, description: matter?.description },
        client: { name: matter?.client?.name, phone: matter?.client?.phone, email: matter?.client?.email },
        indexNumber: ca?.indexNumber,
        court: { name: ca?.court?.name, judge: ca?.judge?.name, part: ca?.part, courtroom: ca?.courtroom, clerkPhone: ca?.court?.clerkPhone },
        opposingParty: ca?.opposingParty,
        opposingCounsel: ca?.opposingCounsel,
        upcomingDates: ca?.upcomingDates,
        recentNotes, activeSol, courtReminders, documents, tasks,
        financials: { timeEntryCount: matter?._count?.timeEntries },
      } as any;
    }),

  // 2. getQuickFacts
  getQuickFacts: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUnique({ where: { id: input.matterId }, include: { client: true } }) as any;
      const ca = await db.matterCourtAssignment.findFirst({
        where: { matterId: input.matterId }, include: { judge: true },
      }) as any;
      return {
        matterName: matter?.name, clientName: matter?.client?.name, clientPhone: matter?.client?.phone,
        opposingCounsel: ca?.opposingCounsel, judge: ca?.judge?.name,
        nextCourtDate: ca?.nextCourtDate, indexNumber: ca?.indexNumber,
      } as any;
    }),

  // 3. startSession
  startSession: publicProcedure
    .input(z.object({ matterId: z.string(), userId: z.string(), userEmail: z.string().optional(), deviceType: z.string().optional() }))
    .mutation(async ({ input }) => {
      const session = await db.courtCompanionSession.create({
        data: { matterId: input.matterId, userId: input.userId, userEmail: input.userEmail, deviceType: input.deviceType, startedAt: new Date() } as any,
      }) as any;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const matter = await db.matter.findUnique({ where: { id: input.matterId }, include: { client: true } }) as any;
      const ca = await db.matterCourtAssignment.findFirst({ where: { matterId: input.matterId }, include: { court: true, judge: true } }) as any;
      return { session, brief: { matter, courtAssignment: ca } } as any;
    }),

  // 4. endSession
  endSession: publicProcedure
    .input(z.object({ sessionId: z.string(), outcome: z.string().optional(), nextSteps: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.courtCompanionSession.update({
        where: { id: input.sessionId },
        data: { endedAt: new Date(), outcome: input.outcome, nextSteps: input.nextSteps } as any,
      }) as any;
    }),

  // 5. addQuickNote
  addQuickNote: publicProcedure
    .input(z.object({ sessionId: z.string(), text: z.string(), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const session = await db.courtCompanionSession.findUnique({ where: { id: input.sessionId } }) as any;
      const quickNotes = JSON.parse((session?.quickNotes as string) || "[]");
      quickNotes.push({ text: input.text, timestamp: new Date().toISOString(), category: input.category });
      await db.courtCompanionSession.update({ where: { id: input.sessionId }, data: { quickNotes: JSON.stringify(quickNotes) } as any });
      return quickNotes;
    }),

  // 6. addChecklistItem
  addChecklistItem: publicProcedure
    .input(z.object({ sessionId: z.string(), item: z.string() }))
    .mutation(async ({ input }) => {
      const session = await db.courtCompanionSession.findUnique({ where: { id: input.sessionId } }) as any;
      const checklist = JSON.parse((session?.checklist as string) || "[]");
      checklist.push({ item: input.item, checked: false, addedAt: new Date().toISOString() });
      await db.courtCompanionSession.update({ where: { id: input.sessionId }, data: { checklist: JSON.stringify(checklist) } as any });
      return checklist;
    }),

  // 7. toggleChecklistItem
  toggleChecklistItem: publicProcedure
    .input(z.object({ sessionId: z.string(), itemIndex: z.number() }))
    .mutation(async ({ input }) => {
      const session = await db.courtCompanionSession.findUnique({ where: { id: input.sessionId } }) as any;
      const checklist = JSON.parse((session?.checklist as string) || "[]");
      if (checklist[input.itemIndex]) checklist[input.itemIndex].checked = !checklist[input.itemIndex].checked;
      await db.courtCompanionSession.update({ where: { id: input.sessionId }, data: { checklist: JSON.stringify(checklist) } as any });
      return checklist;
    }),

  // 8. getRecentSessions
  getRecentSessions: publicProcedure
    .input(z.object({ userId: z.string().optional(), matterId: z.string().optional(), limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.userId) where.userId = input.userId;
      if (input?.matterId) where.matterId = input.matterId;
      return db.courtCompanionSession.findMany({
        where, include: { matter: { select: { name: true } } },
        orderBy: { startedAt: "desc" }, take: input?.limit || 10,
      }) as any;
    }),

  // 9. getSessionDetail
  getSessionDetail: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return db.courtCompanionSession.findUnique({
        where: { id: input.sessionId }, include: { matter: true },
      }) as any;
    }),

  // 10. convertSessionNotes
  convertSessionNotes: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const session = await db.courtCompanionSession.findUnique({ where: { id: input.sessionId } }) as any;
      const quickNotes = JSON.parse((session?.quickNotes as string) || "[]");
      let count = 0;
      for (const note of quickNotes) {
        await db.voiceNote.create({
          data: { matterId: session.matterId, transcription: note.text, category: note.category || "VNC_GENERAL", authorName: "Court Companion", transcriptionStatus: "TS_COMPLETED" } as any,
        });
        count++;
      }
      return { count };
    }),

  // 11. convertNextSteps
  convertNextSteps: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const session = await db.courtCompanionSession.findUnique({ where: { id: input.sessionId } }) as any;
      const lines = (session?.nextSteps || "").split(/[\n.;]+/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      let count = 0;
      for (const line of lines) {
        await db.task.create({ data: { title: line, matterId: session.matterId, status: "NOT_STARTED" } as any });
        count++;
      }
      return { count };
    }),

  // 12. getRecentMatters
  getRecentMatters: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const matters = await db.matter.findMany({
        orderBy: { updatedAt: "desc" }, take: input?.limit || 10,
        include: { client: { select: { name: true } } },
      }) as any[];
      return matters.map((m: any) => ({ id: m.id, name: m.name, clientName: m.client?.name, practiceArea: m.practiceArea }));
    }),
});
