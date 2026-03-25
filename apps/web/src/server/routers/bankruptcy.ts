import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/lib/db";
import { getMedianIncome } from "@/lib/bankruptcy/median-income";
import { getTotalNationalStandard, getHousingStandard, getTransportStandard, HEALTHCARE_OOP_PER_PERSON } from "@/lib/bankruptcy/irs-standards";
import { computeCurrentMonthlyIncome, computeAnnualizedIncome, isAboveMedian, computeAllowedExpenses, computeDisposableIncome, computeChapter7Presumption, type MeansTestInputs } from "@/lib/bankruptcy/means-test-engine";

async function postSystemMsg(matterId: string, body: string) {
  try {
    let thread = await db.matterThread.findUnique({ where: { matterId } });
    if (!thread) thread = await db.matterThread.create({ data: { matterId } });
    await db.matterMessage.create({ data: { threadId: thread.id, matterId, authorId: "system", body, isSystemMessage: true, systemEventType: "BANKRUPTCY" } });
    await db.matterThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 140), messageCount: { increment: 1 } } });
  } catch {}
}

export const bankruptcyRouter = router({
  getOrCreateCase: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ ctx, input }) => {
    let bc = await ctx.db.bankruptcyCase.findUnique({ where: { matterId: input.matterId }, include: { incomeSources: true, expenses: true, assets: true, creditors: true, snapshots: { orderBy: { snapshotDate: "desc" }, take: 1 } } });
    if (!bc) {
      const now = new Date();
      const lookbackEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prior month
      const lookbackStart = new Date(lookbackEnd.getFullYear(), lookbackEnd.getMonth() - 5, 1);
      bc = await ctx.db.bankruptcyCase.create({ data: { matterId: input.matterId, lookbackStartDate: lookbackStart, lookbackEndDate: lookbackEnd }, include: { incomeSources: true, expenses: true, assets: true, creditors: true, snapshots: { take: 1 } } });
    }
    return bc;
  }),

  updateCase: publicProcedure.input(z.object({ id: z.string(), data: z.record(z.any()) })).mutation(async ({ ctx, input }) => {
    const clean = { ...input.data };
    for (const k of ["filingDate", "lookbackStartDate", "lookbackEndDate", "attorney341Date"]) { if (clean[k]) clean[k] = new Date(clean[k]); }
    if (clean.filingDate) {
      const fd = new Date(clean.filingDate);
      clean.lookbackEndDate = new Date(fd.getFullYear(), fd.getMonth(), 0);
      clean.lookbackStartDate = new Date(clean.lookbackEndDate.getFullYear(), clean.lookbackEndDate.getMonth() - 5, 1);
    }
    return ctx.db.bankruptcyCase.update({ where: { id: input.id }, data: clean });
  }),

  addIncomeSource: publicProcedure.input(z.object({ caseId: z.string(), sourceType: z.string(), description: z.string().optional(), isSocialSecurity: z.boolean().optional(), isSpouseIncome: z.boolean().optional(), month1: z.number().optional(), month2: z.number().optional(), month3: z.number().optional(), month4: z.number().optional(), month5: z.number().optional(), month6: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const months = [input.month1 || 0, input.month2 || 0, input.month3 || 0, input.month4 || 0, input.month5 || 0, input.month6 || 0];
    const avg = months.reduce((s, m) => s + m, 0) / 6;
    return ctx.db.bankruptcyIncomeSource.create({ data: { ...input, averageMonthly: Math.round(avg * 100) / 100, annualAmount: Math.round(avg * 12 * 100) / 100 } });
  }),

  updateIncomeSource: publicProcedure.input(z.object({ id: z.string(), data: z.record(z.any()) })).mutation(async ({ ctx, input }) => {
    const src = await ctx.db.bankruptcyIncomeSource.update({ where: { id: input.id }, data: input.data });
    const months = [Number(src.month1), Number(src.month2), Number(src.month3), Number(src.month4), Number(src.month5), Number(src.month6)];
    const avg = months.reduce((s, m) => s + m, 0) / 6;
    return ctx.db.bankruptcyIncomeSource.update({ where: { id: input.id }, data: { averageMonthly: Math.round(avg * 100) / 100, annualAmount: Math.round(avg * 12 * 100) / 100 } });
  }),

  deleteIncomeSource: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => ctx.db.bankruptcyIncomeSource.delete({ where: { id: input.id } })),

  addAsset: publicProcedure.input(z.object({ caseId: z.string(), assetType: z.string(), description: z.string(), currentValue: z.number(), exemptionClaimed: z.number().optional(), exemptionBasis: z.string().optional(), lienAmount: z.number().optional(), lienHolder: z.string().optional(), location: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const netEquity = input.currentValue - (input.exemptionClaimed || 0) - (input.lienAmount || 0);
    return ctx.db.bankruptcyAsset.create({ data: { ...input, netEquity, isExempt: netEquity <= 0 } });
  }),

  deleteAsset: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => ctx.db.bankruptcyAsset.delete({ where: { id: input.id } })),

  addCreditor: publicProcedure.input(z.object({ caseId: z.string(), creditorName: z.string(), creditorType: z.string(), claimAmount: z.number(), accountNumberLast4: z.string().optional(), isDisputed: z.boolean().optional(), collateralDescription: z.string().optional(), collateralValue: z.number().optional(), priorityType: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => ctx.db.bankruptcyCreditor.create({ data: input })),

  deleteCreditor: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => ctx.db.bankruptcyCreditor.delete({ where: { id: input.id } })),

  recalculate: publicProcedure.input(z.object({ caseId: z.string() })).mutation(async ({ ctx, input }) => {
    const bc = await ctx.db.bankruptcyCase.findUniqueOrThrow({ where: { id: input.caseId }, include: { incomeSources: true, expenses: true, creditors: true } });
    if (!bc.filingState) return { error: "Filing state required" };

    const median = getMedianIncome(bc.filingState, bc.householdSize);
    const incomeSources = bc.incomeSources.map((s) => ({
      sourceType: s.sourceType, isSocialSecurity: s.isSocialSecurity,
      months: [Number(s.month1), Number(s.month2), Number(s.month3), Number(s.month4), Number(s.month5), Number(s.month6)],
    }));

    const cmi = computeCurrentMonthlyIncome(incomeSources);
    const annualized = computeAnnualizedIncome(cmi);
    const above = isAboveMedian(annualized, median);

    const national = getTotalNationalStandard(bc.householdSize);
    const housing = getHousingStandard(bc.filingState, bc.filingCounty || "", bc.householdSize);
    const transport = getTransportStandard("DEFAULT", true, 1);
    const healthcare = HEALTHCARE_OOP_PER_PERSON * bc.householdSize;
    const totalExpenses = bc.expenses.reduce((s, e) => s + Number(e.deductibleAmount || 0), 0);
    const unsecuredDebt = bc.creditors.filter((c) => c.creditorType === "GENERAL_UNSECURED").reduce((s, c) => s + Number(c.claimAmount), 0);

    const disposable = Math.round((cmi - (totalExpenses || national + housing + transport.ownership + transport.operating + healthcare)) * 100) / 100;
    const presumption = computeChapter7Presumption(disposable, unsecuredDebt);

    await ctx.db.bankruptcyCase.update({
      where: { id: input.caseId },
      data: {
        currentMonthlyIncome: cmi, annualizedIncome: annualized, stateMedianIncome: median,
        isAboveMedian: above, meansTestComplete: true, presumptionArises: presumption.presumptionArises,
        chapter13DisposableIncome: Math.max(0, disposable), chapter13PlanMonths: above ? 60 : 36,
        estimatedUnsecuredDebt: unsecuredDebt, lastCalculatedAt: new Date(),
      },
    });

    // Snapshot
    await ctx.db.meansTestSnapshot.create({
      data: {
        caseId: input.caseId, chapterFiled: bc.chapterFiled, currentMonthlyIncome: cmi,
        annualizedIncome: annualized, stateMedianIncome: median, isAboveMedian: above,
        totalAllowedExpenses: totalExpenses || (national + housing + transport.ownership + transport.operating + healthcare),
        disposableIncome: disposable, presumptionArises: presumption.presumptionArises,
        formData: { incomeSources: bc.incomeSources, expenses: bc.expenses } as any,
        calculationDetail: [
          { lineNumber: "3", label: "Current Monthly Income", value: cmi },
          { lineNumber: "4", label: "Annualized", value: annualized },
          { lineNumber: "5", label: "State Median", value: median },
          { lineNumber: "45", label: "Disposable Income", value: disposable },
        ] as any,
      },
    });

    await postSystemMsg(bc.matterId, `Means test calculated — CMI: $${Math.round(cmi).toLocaleString()}/mo, ${above ? "ABOVE" : "BELOW"} median, presumption ${presumption.presumptionArises ? "arises" : "does not arise"}`);

    return { cmi, annualized, median, above, disposable, presumption };
  }),

  getSnapshots: publicProcedure.input(z.object({ caseId: z.string() })).query(async ({ ctx, input }) =>
    ctx.db.meansTestSnapshot.findMany({ where: { caseId: input.caseId }, orderBy: { snapshotDate: "desc" } }),
  ),

  detectIssues: publicProcedure.input(z.object({ caseId: z.string() })).query(async ({ ctx, input }) => {
    const bc = await ctx.db.bankruptcyCase.findUniqueOrThrow({ where: { id: input.caseId }, include: { incomeSources: true, creditors: true } });
    const issues: Array<{ severity: string; code: string; description: string; recommendation: string }> = [];

    if (bc.presumptionArises && !bc.rebuttingCircumstances) {
      issues.push({ severity: "HIGH", code: "REBUTTAL", description: "Presumption of abuse arises but no rebuttal circumstances documented", recommendation: "Document special circumstances that justify filing under Chapter 7 despite the presumption" });
    }
    for (const s of bc.incomeSources) {
      if (s.isSocialSecurity === false && s.sourceType === "SOCIAL_SECURITY") {
        issues.push({ severity: "HIGH", code: "SS_FLAG", description: `Income source "${s.description}" is Social Security type but not flagged as excluded`, recommendation: "Toggle the Social Security exclusion flag — SS income is excluded from CMI per § 101(10A)" });
      }
      const months = [Number(s.month1), Number(s.month2), Number(s.month3), Number(s.month4), Number(s.month5), Number(s.month6)];
      if (months.some((m) => m === 0) && months.some((m) => m > 0)) {
        issues.push({ severity: "LOW", code: "ZERO_MONTH", description: `Income source "${s.description || s.sourceType}" has $0 in some months`, recommendation: "Verify whether $0 months represent actual non-receipt or missing data" });
      }
    }
    if (bc.isAboveMedian && bc.chapterFiled === "CHAPTER_7") {
      issues.push({ severity: "MEDIUM", code: "ABOVE_CH7", description: "Above-median debtor filing Chapter 7 — means test will apply", recommendation: "Ensure all IRS allowances are properly claimed. Consider whether Chapter 13 is more appropriate." });
    }

    return issues;
  }),

  autoCreateTasks: publicProcedure.input(z.object({ caseId: z.string() })).mutation(async ({ ctx, input }) => {
    const bc = await ctx.db.bankruptcyCase.findUniqueOrThrow({ where: { id: input.caseId } });
    const issues = await ctx.db.$queryRaw`SELECT 1` as any; // Placeholder — re-use detectIssues logic
    let created = 0;

    if (bc.presumptionArises && !bc.presumptionRebutted) {
      const exists = await ctx.db.task.findFirst({ where: { matterId: bc.matterId, title: { contains: "means test rebuttal" } } });
      if (!exists) { await ctx.db.task.create({ data: { matterId: bc.matterId, title: "Document means test rebuttal circumstances — presumption of abuse arises", priority: "HIGH", status: "NOT_STARTED", dueDate: new Date(Date.now() + 14 * 86400000) } }); created++; }
    }
    if (bc.chapter13PlanMonths === 60) {
      const exists = await ctx.db.task.findFirst({ where: { matterId: bc.matterId, title: { contains: "60-month Chapter 13" } } });
      if (!exists) { await ctx.db.task.create({ data: { matterId: bc.matterId, title: "Prepare 60-month Chapter 13 plan (above-median debtor)", priority: "MEDIUM", status: "NOT_STARTED", dueDate: new Date(Date.now() + 30 * 86400000) } }); created++; }
    }
    if (bc.attorney341Date) {
      const exists = await ctx.db.task.findFirst({ where: { matterId: bc.matterId, title: { contains: "341 meeting" } } });
      if (!exists) { await ctx.db.task.create({ data: { matterId: bc.matterId, title: "Prepare client for 341 meeting", priority: "HIGH", status: "NOT_STARTED", dueDate: new Date(new Date(bc.attorney341Date).getTime() - 7 * 86400000) } }); created++; }
    }

    if (created > 0) await postSystemMsg(bc.matterId, `${created} bankruptcy task(s) created`);
    return { created };
  }),
});
