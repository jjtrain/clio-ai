import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/lib/db";

async function postSystemMessage(matterId: string, body: string, eventType?: string) {
  try {
    let thread = await db.matterThread.findUnique({ where: { matterId } });
    if (!thread) thread = await db.matterThread.create({ data: { matterId } });
    await db.matterMessage.create({ data: { threadId: thread.id, matterId, authorId: "system", body, isSystemMessage: true, systemEventType: eventType } });
    await db.matterThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 140), messageCount: { increment: 1 } } });
  } catch {}
}

export const criminalRouter = router({
  getCriminalCase: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.criminalCase.findUnique({
        where: { matterId: input.matterId },
        include: {
          charges: { orderBy: { createdAt: "asc" } },
          appearances: { orderBy: { appearanceDate: "desc" } },
          pleaNegotiations: { orderBy: { offerDate: "desc" } },
        },
      });
    }),

  upsertCriminalCase: publicProcedure
    .input(z.object({
      matterId: z.string(),
      chargeLevel: z.string().optional(),
      caseNumber: z.string().optional(),
      indictmentNumber: z.string().optional(),
      arrestDate: z.string().optional(),
      arraignmentDate: z.string().optional(),
      prelimHearingDate: z.string().optional(),
      bailAmount: z.number().optional(),
      bailStatus: z.string().optional(),
      bondAgent: z.string().optional(),
      bondAmount: z.number().optional(),
      nextAppearanceDate: z.string().optional(),
      nextAppearanceType: z.string().optional(),
      judgeAssigned: z.string().optional(),
      prosecutorName: z.string().optional(),
      prosecutorOffice: z.string().optional(),
      publicDefender: z.boolean().optional(),
      defenseNotes: z.string().optional(),
      casePhase: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { matterId, ...data } = input;
      const clean: any = { ...data };
      if (data.arrestDate) clean.arrestDate = new Date(data.arrestDate);
      if (data.arraignmentDate) clean.arraignmentDate = new Date(data.arraignmentDate);
      if (data.prelimHearingDate) clean.prelimHearingDate = new Date(data.prelimHearingDate);
      if (data.nextAppearanceDate) clean.nextAppearanceDate = new Date(data.nextAppearanceDate);
      return ctx.db.criminalCase.upsert({
        where: { matterId },
        create: { matterId, ...clean },
        update: clean,
      });
    }),

  addCharge: publicProcedure
    .input(z.object({
      criminalCaseId: z.string(),
      chargeCode: z.string(),
      chargeDescription: z.string(),
      statute: z.string().optional(),
      chargeClass: z.string().optional(),
      countsCharged: z.number().default(1),
      severity: z.number().optional(),
      mandatoryMinimumMonths: z.number().optional(),
      maximumMonths: z.number().optional(),
      enhancement: z.boolean().optional(),
      enhancementDescription: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.criminalCharge.create({ data: input })),

  updateCharge: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ ctx, input }) => ctx.db.criminalCharge.update({ where: { id: input.id }, data: input.data })),

  dismissCharge: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.criminalCharge.update({
        where: { id: input.id },
        data: { disposition: "DISMISSED", dispositionDate: new Date() },
      });
    }),

  addAppearance: publicProcedure
    .input(z.object({
      criminalCaseId: z.string(),
      matterId: z.string().optional(),
      appearanceDate: z.string(),
      appearanceType: z.string(),
      judgePresiding: z.string().optional(),
      adaAppearing: z.string().optional(),
      defenseAttorneyId: z.string().optional(),
      courtroom: z.string().optional(),
      outcome: z.string().optional(),
      outcomeDetail: z.string().optional(),
      nextDate: z.string().optional(),
      nextDateType: z.string().optional(),
      bailAction: z.string().optional(),
      newBailAmount: z.number().optional(),
      pleaOffered: z.boolean().optional(),
      pleaOfferedDetail: z.string().optional(),
      pleaAccepted: z.boolean().optional(),
      motionsFiled: z.any().optional(),
      orderIssued: z.boolean().optional(),
      orderDetail: z.string().optional(),
      attendanceStatus: z.string().default("APPEARED"),
      benchWarrantIssued: z.boolean().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const appearance = await ctx.db.courtAppearance.create({
        data: {
          ...input,
          appearanceDate: new Date(input.appearanceDate),
          nextDate: input.nextDate ? new Date(input.nextDate) : null,
          motionsFiled: input.motionsFiled || undefined,
        },
      });

      const crimCase = await ctx.db.criminalCase.findUniqueOrThrow({ where: { id: input.criminalCaseId } });

      // Auto-set arraignment date
      if (input.appearanceType === "ARRAIGNMENT" && !crimCase.arraignmentDate) {
        await ctx.db.criminalCase.update({
          where: { id: input.criminalCaseId },
          data: { arraignmentDate: new Date(input.appearanceDate), casePhase: "ARRAIGNMENT" },
        });
      }

      // Update next appearance on case
      if (input.nextDate) {
        await ctx.db.criminalCase.update({
          where: { id: input.criminalCaseId },
          data: { nextAppearanceDate: new Date(input.nextDate), nextAppearanceType: input.nextDateType },
        });
      }

      // Update bail if changed
      if (input.bailAction && input.bailAction !== "NONE") {
        const bailUpdate: any = {};
        if (input.bailAction === "SET" || input.bailAction === "MODIFIED") {
          bailUpdate.bailAmount = input.newBailAmount;
          bailUpdate.bailStatus = "CASH";
        } else if (input.bailAction === "REVOKED") {
          bailUpdate.bailStatus = "DENIED";
        } else if (input.bailAction === "RELEASED") {
          bailUpdate.bailStatus = "ROR";
          bailUpdate.bailAmount = 0;
        }
        if (Object.keys(bailUpdate).length > 0) {
          await ctx.db.criminalCase.update({ where: { id: input.criminalCaseId }, data: bailUpdate });
        }
      }

      // Auto-create FTA task
      if (input.attendanceStatus === "FAILED_TO_APPEAR" && crimCase.matterId) {
        await ctx.db.task.create({
          data: {
            matterId: crimCase.matterId,
            title: `Follow up on FTA — ${crimCase.caseNumber || "case"}`,
            description: `Defendant failed to appear on ${new Date(input.appearanceDate).toLocaleDateString()}. Coordinate with client and court immediately.`,
            dueDate: new Date(Date.now() + 3 * 86400000),
            priority: "HIGH",
            status: "NOT_STARTED",
          },
        });
      }

      // Auto-create bench warrant task
      if (input.benchWarrantIssued && crimCase.matterId) {
        await ctx.db.task.create({
          data: {
            matterId: crimCase.matterId,
            title: `Bench warrant issued — arrange surrender or bond`,
            description: `Bench warrant issued on ${new Date(input.appearanceDate).toLocaleDateString()}. Arrange voluntary surrender or secure bond immediately.`,
            dueDate: new Date(Date.now() + 86400000),
            priority: "HIGH",
            status: "NOT_STARTED",
          },
        });
      }

      // Post system message to matter thread
      if (crimCase.matterId) {
        const outcomeText = input.outcome ? ` — ${input.outcome}` : "";
        postSystemMessage(crimCase.matterId, `Court appearance logged: ${input.appearanceType.replace(/_/g, " ")} on ${new Date(input.appearanceDate).toLocaleDateString()}${outcomeText}`, "COURT_APPEARANCE");
      }

      return appearance;
    }),

  updateAppearance: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ ctx, input }) => {
      const clean = { ...input.data };
      if (clean.appearanceDate) clean.appearanceDate = new Date(clean.appearanceDate);
      if (clean.nextDate) clean.nextDate = new Date(clean.nextDate);
      return ctx.db.courtAppearance.update({ where: { id: input.id }, data: clean });
    }),

  getAppearanceHistory: publicProcedure
    .input(z.object({ criminalCaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.courtAppearance.findMany({
        where: { criminalCaseId: input.criminalCaseId },
        orderBy: { appearanceDate: "asc" },
      });
    }),

  addPleaNegotiation: publicProcedure
    .input(z.object({
      criminalCaseId: z.string(),
      offerDate: z.string(),
      offeredBy: z.string(),
      chargesOffered: z.any().optional(),
      sentenceOffered: z.string().optional(),
      conditions: z.string().optional(),
      authorizedById: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pleaNegotiation.create({
        data: { ...input, offerDate: new Date(input.offerDate), chargesOffered: input.chargesOffered || undefined },
      });
    }),

  updatePleaNegotiation: publicProcedure
    .input(z.object({ id: z.string(), status: z.string().optional(), responseDate: z.string().optional(), responseNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const clean: any = { ...data };
      if (data.responseDate) clean.responseDate = new Date(data.responseDate);
      return ctx.db.pleaNegotiation.update({ where: { id }, data: clean });
    }),

  generateCaseChronology: publicProcedure
    .input(z.object({ criminalCaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const crimCase = await ctx.db.criminalCase.findUniqueOrThrow({
        where: { id: input.criminalCaseId },
        include: {
          charges: { orderBy: { createdAt: "asc" } },
          appearances: { orderBy: { appearanceDate: "asc" } },
          pleaNegotiations: { orderBy: { offerDate: "asc" } },
        },
      });

      const matter = await ctx.db.matter.findUnique({
        where: { id: crimCase.matterId },
        include: { client: { select: { name: true } } },
      });

      return {
        header: {
          defendant: matter?.client?.name || "Unknown",
          caseNumber: crimCase.caseNumber,
          indictmentNumber: crimCase.indictmentNumber,
          judge: crimCase.judgeAssigned,
          prosecutor: `${crimCase.prosecutorName || ""}${crimCase.prosecutorOffice ? ` (${crimCase.prosecutorOffice})` : ""}`,
          chargeLevel: crimCase.chargeLevel,
          casePhase: crimCase.casePhase,
          dispositionType: crimCase.dispositionType,
        },
        charges: crimCase.charges,
        appearances: crimCase.appearances.map((a) => ({
          date: a.appearanceDate, type: a.appearanceType, judge: a.judgePresiding,
          ada: a.adaAppearing, courtroom: a.courtroom, outcome: a.outcome,
          outcomeDetail: a.outcomeDetail, nextDate: a.nextDate, nextDateType: a.nextDateType,
          bailAction: a.bailAction, attendanceStatus: a.attendanceStatus,
          benchWarrant: a.benchWarrantIssued, motions: a.motionsFiled,
        })),
        pleaHistory: crimCase.pleaNegotiations,
        currentStatus: { phase: crimCase.casePhase, disposition: crimCase.dispositionType, bail: crimCase.bailStatus, nextAppearance: crimCase.nextAppearanceDate },
      };
    }),

  updateCasePhase: publicProcedure
    .input(z.object({ criminalCaseId: z.string(), casePhase: z.string(), dispositionType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.casePhase === "SENTENCING") {
        const crimCase = await ctx.db.criminalCase.findUniqueOrThrow({ where: { id: input.criminalCaseId } });
        if (crimCase.dispositionType === "PENDING" && !input.dispositionType) {
          throw new Error("Disposition must be set before advancing to sentencing phase");
        }
      }
      return ctx.db.criminalCase.update({
        where: { id: input.criminalCaseId },
        data: { casePhase: input.casePhase, dispositionType: input.dispositionType || undefined },
      });
    }),

  updateDisposition: publicProcedure
    .input(z.object({ criminalCaseId: z.string(), dispositionType: z.string(), dispositionDate: z.string().optional(), sentenceType: z.string().optional(), sentenceSummary: z.string().optional(), probationMonths: z.number().optional(), fineAmount: z.number().optional(), restitutionAmount: z.number().optional(), communityServiceHours: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { criminalCaseId, ...data } = input;
      const clean: any = { ...data };
      if (data.dispositionDate) clean.dispositionDate = new Date(data.dispositionDate);
      if (data.dispositionType !== "PENDING") clean.casePhase = "CLOSED";
      return ctx.db.criminalCase.update({ where: { id: criminalCaseId }, data: clean });
    }),

  getBailHistory: publicProcedure
    .input(z.object({ criminalCaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.courtAppearance.findMany({
        where: { criminalCaseId: input.criminalCaseId, bailAction: { not: "NONE" }, NOT: { bailAction: null } },
        orderBy: { appearanceDate: "asc" },
        select: { id: true, appearanceDate: true, appearanceType: true, bailAction: true, newBailAmount: true, outcome: true },
      });
    }),
});
