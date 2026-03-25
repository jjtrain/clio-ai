import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/lib/db";

async function postSystemMsg(matterId: string | null, body: string) {
  if (!matterId) return;
  try {
    let thread = await db.matterThread.findUnique({ where: { matterId } });
    if (!thread) thread = await db.matterThread.create({ data: { matterId } });
    await db.matterMessage.create({ data: { threadId: thread.id, matterId, authorId: "system", body, isSystemMessage: true, systemEventType: "CORPORATE" } });
    await db.matterThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 140), messageCount: { increment: 1 } } });
  } catch {}
}

async function recomputeNextDeadline(entityId: string) {
  const nextFiling = await db.entityFiling.findFirst({ where: { entityId, status: { in: ["UPCOMING", "DUE_SOON", "OVERDUE"] } }, orderBy: { dueDate: "asc" } });
  await db.corporateEntity.update({ where: { id: entityId }, data: { nextFilingDeadline: nextFiling?.dueDate || null, nextFilingType: nextFiling?.filingType || null } });
}

const REQUIRED_DOCS: Record<string, Array<{ type: string; label: string; required: boolean }>> = {
  LLC: [{ type: "ARTICLES_OF_ORGANIZATION", label: "Articles of Organization", required: true }, { type: "OPERATING_AGREEMENT", label: "Operating Agreement", required: true }, { type: "EIN_LETTER", label: "EIN Letter", required: false }],
  C_CORP: [{ type: "ARTICLES_OF_INCORPORATION", label: "Articles of Incorporation", required: true }, { type: "BYLAWS", label: "Bylaws", required: true }, { type: "SHAREHOLDER_AGREEMENT", label: "Shareholder Agreement", required: false }, { type: "EIN_LETTER", label: "EIN Letter", required: false }],
  S_CORP: [{ type: "ARTICLES_OF_INCORPORATION", label: "Articles of Incorporation", required: true }, { type: "BYLAWS", label: "Bylaws", required: true }, { type: "SHAREHOLDER_AGREEMENT", label: "Shareholder Agreement", required: false }, { type: "EIN_LETTER", label: "EIN Letter", required: false }],
  LP: [{ type: "ARTICLES_OF_ORGANIZATION", label: "Certificate of Limited Partnership", required: true }, { type: "OPERATING_AGREEMENT", label: "Partnership Agreement", required: true }],
  DEFAULT: [{ type: "EIN_LETTER", label: "EIN Letter", required: false }],
};

export const corporateEntitiesRouter = router({
  getEntitiesForMatter: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ ctx, input }) => {
    const entities = await ctx.db.corporateEntity.findMany({
      where: { matterId: input.matterId }, include: { officers: { where: { isActive: true } }, registeredAgents: { where: { isActive: true } }, filings: { where: { dueDate: { gte: new Date() }, status: { not: "FILED" } }, orderBy: { dueDate: "asc" }, take: 5 }, _count: { select: { documents: true } } },
    });
    const now = new Date();
    const overdue = await ctx.db.entityFiling.count({ where: { entity: { matterId: input.matterId }, status: "OVERDUE" } });
    const dueSoon = await ctx.db.entityFiling.count({ where: { entity: { matterId: input.matterId }, dueDate: { lte: new Date(Date.now() + 30 * 86400000), gte: now }, status: { not: "FILED" } } });
    const upcoming = await ctx.db.entityFiling.count({ where: { entity: { matterId: input.matterId }, dueDate: { lte: new Date(Date.now() + 180 * 86400000), gte: now }, status: { not: "FILED" } } });
    return { entities, deadlineSummary: { overdue, dueSoon, upcoming } };
  }),

  getFirmEntities: publicProcedure.input(z.object({ status: z.string().optional(), entityType: z.string().optional(), stateOfFormation: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const where: any = {};
    if (input?.status) where.status = input.status;
    if (input?.entityType) where.entityType = input.entityType;
    if (input?.stateOfFormation) where.stateOfFormation = input.stateOfFormation;
    return ctx.db.corporateEntity.findMany({ where, include: { officers: { where: { isActive: true }, take: 5 }, _count: { select: { filings: true, documents: true } } }, orderBy: { nextFilingDeadline: "asc" } });
  }),

  getEntity: publicProcedure.input(z.object({ entityId: z.string() })).query(async ({ ctx, input }) => {
    const entity = await ctx.db.corporateEntity.findUniqueOrThrow({
      where: { id: input.entityId },
      include: { officers: { orderBy: [{ isActive: "desc" }, { appointmentDate: "desc" }] }, registeredAgents: { orderBy: { isActive: "desc" } }, filings: { orderBy: { dueDate: "asc" } }, documents: { orderBy: { effectiveDate: "desc" } }, ledger: { orderBy: { transactionDate: "desc" }, include: { fromOfficer: true, toOfficer: true } } },
    });
    const activeOfficers = entity.officers.filter((o) => o.isActive);
    const totalOwnership = activeOfficers.reduce((s, o) => s + Number(o.ownershipPercentage || 0), 0);
    const pendingFilings = entity.filings.filter((f) => f.status !== "FILED" && f.status !== "WAIVED");
    const overdueFilings = entity.filings.filter((f) => f.status === "OVERDUE");
    const docTypes = REQUIRED_DOCS[entity.entityType] || REQUIRED_DOCS.DEFAULT;
    const existingDocTypes = new Set(entity.documents.filter((d) => !d.supersededById).map((d) => d.documentType));
    const documentGaps = docTypes.filter((dt) => !existingDocTypes.has(dt.type));
    return { ...entity, summary: { totalOwnership, activeOfficerCount: activeOfficers.length, pendingFilingsCount: pendingFilings.length, overdueFilingsCount: overdueFilings.length, documentGaps } };
  }),

  createEntity: publicProcedure.input(z.object({ matterId: z.string().optional(), entityName: z.string(), entityType: z.string(), entitySubtype: z.string().optional(), stateOfFormation: z.string(), ein: z.string().optional(), formationDate: z.string().optional(), fiscalYearEnd: z.string().optional(), taxClassification: z.string().optional(), purpose: z.string().optional(), authorizedShares: z.number().optional(), memberCount: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const entity = await ctx.db.corporateEntity.create({ data: { ...input, formationDate: input.formationDate ? new Date(input.formationDate) : null } });
    await postSystemMsg(input.matterId || null, `Corporate entity added: ${input.entityName} (${input.entityType}, ${input.stateOfFormation})`);
    return entity;
  }),

  updateEntity: publicProcedure.input(z.object({ id: z.string(), data: z.record(z.any()) })).mutation(async ({ ctx, input }) => {
    const clean = { ...input.data };
    for (const k of ["formationDate", "dissolutionDate", "operatingAgreementDate", "bylawsDate", "minutesLastUpdated", "annualReportDueDate", "annualReportLastFiled"]) { if (clean[k]) clean[k] = new Date(clean[k]); }
    const entity = await ctx.db.corporateEntity.update({ where: { id: input.id }, data: clean });
    await recomputeNextDeadline(input.id);
    return entity;
  }),

  addOfficer: publicProcedure.input(z.object({ entityId: z.string(), contactName: z.string(), role: z.string(), contactEmail: z.string().optional(), contactPhone: z.string().optional(), ownershipPercentage: z.number().optional(), sharesHeld: z.number().optional(), appointmentDate: z.string().optional(), address: z.string().optional(), roleDetail: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => ctx.db.entityOfficer.create({ data: { ...input, appointmentDate: input.appointmentDate ? new Date(input.appointmentDate) : null } })),

  updateOfficer: publicProcedure.input(z.object({ id: z.string(), data: z.record(z.any()) })).mutation(async ({ ctx, input }) => { const c = { ...input.data }; if (c.appointmentDate) c.appointmentDate = new Date(c.appointmentDate); if (c.resignationDate) c.resignationDate = new Date(c.resignationDate); return ctx.db.entityOfficer.update({ where: { id: input.id }, data: c }); }),

  deactivateOfficer: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => ctx.db.entityOfficer.update({ where: { id: input.id }, data: { isActive: false, resignationDate: new Date() } })),

  addRegisteredAgent: publicProcedure.input(z.object({ entityId: z.string(), agentName: z.string(), agentType: z.string().optional(), serviceName: z.string().optional(), stateOfAppointment: z.string(), agentAddress: z.string().optional(), agentEmail: z.string().optional(), appointmentDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => ctx.db.registeredAgent.create({ data: { ...input, appointmentDate: input.appointmentDate ? new Date(input.appointmentDate) : null } })),

  deactivateRegisteredAgent: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => ctx.db.registeredAgent.update({ where: { id: input.id }, data: { isActive: false } })),

  addFiling: publicProcedure.input(z.object({ entityId: z.string(), filingType: z.string(), filingJurisdiction: z.string(), filingPeriod: z.string().optional(), dueDate: z.string(), fee: z.number().optional(), autoRenew: z.boolean().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const filing = await ctx.db.entityFiling.create({ data: { ...input, dueDate: new Date(input.dueDate) } });
    await recomputeNextDeadline(input.entityId);
    return filing;
  }),

  updateFiling: publicProcedure.input(z.object({ id: z.string(), data: z.record(z.any()) })).mutation(async ({ ctx, input }) => {
    const c = { ...input.data }; if (c.dueDate) c.dueDate = new Date(c.dueDate); if (c.filedDate) c.filedDate = new Date(c.filedDate);
    const filing = await ctx.db.entityFiling.update({ where: { id: input.id }, data: c });
    await recomputeNextDeadline(filing.entityId);
    return filing;
  }),

  markFilingFiled: publicProcedure.input(z.object({ id: z.string(), confirmationNumber: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const filing = await ctx.db.entityFiling.update({ where: { id: input.id }, data: { filedDate: new Date(), status: "FILED", confirmationNumber: input.confirmationNumber } });
    await recomputeNextDeadline(filing.entityId);
    // Auto-generate next year if autoRenew
    if (filing.autoRenew && (filing.filingType === "ANNUAL_REPORT" || filing.filingType === "FRANCHISE_TAX")) {
      const nextDue = new Date(filing.dueDate); nextDue.setFullYear(nextDue.getFullYear() + 1);
      const nextPeriod = filing.filingPeriod ? String(Number(filing.filingPeriod) + 1) : undefined;
      await ctx.db.entityFiling.create({ data: { entityId: filing.entityId, filingType: filing.filingType, filingJurisdiction: filing.filingJurisdiction, filingPeriod: nextPeriod, dueDate: nextDue, autoRenew: true } });
      await recomputeNextDeadline(filing.entityId);
    }
    const entity = await ctx.db.corporateEntity.findUnique({ where: { id: filing.entityId } });
    if (entity?.matterId) await postSystemMsg(entity.matterId, `Filing completed: ${filing.filingType.replace(/_/g, " ")} for ${entity.entityName}${input.confirmationNumber ? ` — confirmation ${input.confirmationNumber}` : ""}`);
    return filing;
  }),

  checkDeadlines: publicProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const filings = await ctx.db.entityFiling.findMany({ where: { status: { in: ["UPCOMING", "DUE_SOON", "OVERDUE"] } }, include: { entity: true } });
    let tasksCreated = 0; let earliest: Date | null = null;

    for (const f of filings) {
      const daysUntil = Math.round((f.dueDate.getTime() - now.getTime()) / 86400000);
      // Update status
      if (daysUntil < 0) await ctx.db.entityFiling.update({ where: { id: f.id }, data: { status: "OVERDUE" } });
      else if (daysUntil <= 30) await ctx.db.entityFiling.update({ where: { id: f.id }, data: { status: "DUE_SOON" } });

      const thresholds = daysUntil < 0 ? ["OVERDUE"] : daysUntil <= 7 ? ["7_DAYS"] : daysUntil <= 30 ? ["30_DAYS"] : daysUntil <= 60 ? ["60_DAYS"] : daysUntil <= 90 ? ["90_DAYS"] : [];
      for (const alertType of thresholds) {
        const existing = await ctx.db.entityDeadlineAlert.findUnique({ where: { filingId_alertType: { filingId: f.id, alertType } } });
        if (!existing && f.entity.matterId) {
          const task = await ctx.db.task.create({ data: { matterId: f.entity.matterId, title: `Filing due: ${f.filingType.replace(/_/g, " ")} — ${f.entity.entityName} (${f.filingJurisdiction})`, description: `Due ${f.dueDate.toLocaleDateString()}. ${daysUntil < 0 ? "OVERDUE" : `${daysUntil} days remaining`}.`, dueDate: f.dueDate, priority: daysUntil <= 30 ? "HIGH" : "MEDIUM", status: "NOT_STARTED" } });
          await ctx.db.entityDeadlineAlert.create({ data: { entityId: f.entityId, filingId: f.id, alertType, taskId: task.id } });
          tasksCreated++;
          if (!earliest || f.dueDate < earliest) earliest = f.dueDate;
        }
      }
    }

    if (tasksCreated > 0) {
      // Post to all affected matters
      const matterIds = Array.from(new Set(filings.filter((f) => f.entity.matterId).map((f) => f.entity.matterId!)));
      for (const mid of matterIds) await postSystemMsg(mid, `${tasksCreated} entity filing deadline task(s) created — earliest due ${earliest?.toLocaleDateString()}`);
    }
    return { tasksCreated, earliestDeadline: earliest };
  }),

  addDocument: publicProcedure.input(z.object({ entityId: z.string(), matterId: z.string().optional(), documentType: z.string(), title: z.string(), fileUrl: z.string().optional(), fileName: z.string().optional(), fileType: z.string().optional(), effectiveDate: z.string().optional(), version: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
    // Supersede prior
    const prior = await ctx.db.entityDocument.findFirst({ where: { entityId: input.entityId, documentType: input.documentType, supersededById: null }, orderBy: { effectiveDate: "desc" } });
    const doc = await ctx.db.entityDocument.create({ data: { ...input, effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null } });
    if (prior) await ctx.db.entityDocument.update({ where: { id: prior.id }, data: { supersededById: doc.id } });
    return doc;
  }),

  addLedgerEntry: publicProcedure.input(z.object({ entityId: z.string(), transactionType: z.string(), transactionDate: z.string(), fromOfficerId: z.string().optional(), toOfficerId: z.string().optional(), shareClass: z.string().optional(), unitsOrShares: z.number(), pricePerUnit: z.number().optional(), consideration: z.string().optional(), certificateNumber: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => ctx.db.entityOwnershipLedger.create({ data: { ...input, transactionDate: new Date(input.transactionDate) } })),

  getDocumentGaps: publicProcedure.input(z.object({ entityId: z.string() })).query(async ({ ctx, input }) => {
    const entity = await ctx.db.corporateEntity.findUniqueOrThrow({ where: { id: input.entityId } });
    const docs = await ctx.db.entityDocument.findMany({ where: { entityId: input.entityId, supersededById: null } });
    const existingTypes = new Set(docs.map((d) => d.documentType));
    const required = REQUIRED_DOCS[entity.entityType] || REQUIRED_DOCS.DEFAULT;
    return required.filter((r) => !existingTypes.has(r.type));
  }),

  generateMinutesShell: publicProcedure.input(z.object({ entityId: z.string(), meetingType: z.string(), meetingDate: z.string() })).mutation(async ({ ctx, input }) => {
    const entity = await ctx.db.corporateEntity.findUniqueOrThrow({ where: { id: input.entityId }, include: { officers: { where: { isActive: true } } } });
    const agendaItems = input.meetingType === "ANNUAL" ? ["Call to order", "Establish quorum", "Approval of prior minutes", "Election of officers", "Financial review", "Old business", "New business", "Adjournment"]
      : input.meetingType === "BOARD" ? ["Call to order", "Approval of prior minutes", "Officer reports", "Committee reports", "Old business", "New business", "Adjournment"]
      : ["Call to order", "Statement of purpose", "Discussion", "Vote", "Adjournment"];
    const shell = { header: { entityName: entity.entityName, entityType: entity.entityType, meetingType: input.meetingType, meetingDate: input.meetingDate, stateOfFormation: entity.stateOfFormation }, officersPresent: entity.officers.map((o) => ({ name: o.contactName, role: o.role })), agendaItems, signatureBlocks: entity.officers.map((o) => ({ name: o.contactName, title: o.role })) };
    const doc = await ctx.db.entityDocument.create({ data: { entityId: input.entityId, matterId: entity.matterId, documentType: "MINUTES", title: `${input.meetingType} Meeting Minutes — ${new Date(input.meetingDate).toLocaleDateString()}`, status: "DRAFT", generatedData: shell as any, effectiveDate: new Date(input.meetingDate) } });
    return { document: doc, shell };
  }),
});
