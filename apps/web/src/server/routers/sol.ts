import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as solEngine from "@/lib/sol-engine";

export const solRouter = router({
  // ─── Core (1-10) ──────────────────────────────────────────────────
  list: publicProcedure
    .input(z.object({ status: z.string().optional(), urgency: z.string().optional(), practiceArea: z.string().optional(), jurisdiction: z.string().optional(), matterId: z.string().optional(), assignedTo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.urgency) where.urgency = input.urgency;
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      if (input?.jurisdiction) where.jurisdiction = input.jurisdiction;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.assignedTo) where.assignedTo = input.assignedTo;
      return db.statuteOfLimitations.findMany({ where, include: { matter: true }, orderBy: { expirationDate: "asc" } });
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.statuteOfLimitations.findUniqueOrThrow({ where: { id: input.id }, include: { matter: true, alerts: true } });
    }),

  createFromTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), accrualDate: z.string(), assignedTo: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return solEngine.createFromTemplate({ ...input, accrualDate: new Date(input.accrualDate) });
    }),

  createCustom: publicProcedure
    .input(z.object({ matterId: z.string(), practiceArea: z.string(), jurisdiction: z.string(), causeOfAction: z.string(), accrualDate: z.string(), accrualBasis: z.string(), limitationPeriod: z.string(), limitationDays: z.number(), statute: z.string().optional(), assignedTo: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return solEngine.createCustom({ ...input, accrualDate: new Date(input.accrualDate) });
    }),

  update: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.statuteOfLimitations.update({ where: { id: input.id }, data: input.data });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.sOLAlert.deleteMany({ where: { solId: input.id } });
      return db.statuteOfLimitations.delete({ where: { id: input.id } });
    }),

  markFiled: publicProcedure
    .input(z.object({ id: z.string(), filedDate: z.string(), filedDocumentId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return solEngine.markFiled(input.id, { filedDate: new Date(input.filedDate), filedDocumentId: input.filedDocumentId });
    }),

  markExpired: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.statuteOfLimitations.update({ where: { id: input.id }, data: { status: "SOL_EXPIRED" as any } });
    }),

  markWaived: publicProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.statuteOfLimitations.update({ where: { id: input.id }, data: { status: "SOL_WAIVED" as any, notes: input.notes } });
    }),

  markDismissed: publicProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.statuteOfLimitations.update({ where: { id: input.id }, data: { status: "SOL_DISMISSED" as any, notes: input.notes } });
    }),

  // ─── Tolling (11-13) ──────────────────────────────────────────────
  applyTolling: publicProcedure
    .input(z.object({ id: z.string(), reason: z.string(), startDate: z.string(), endDate: z.string() }))
    .mutation(async ({ input }) => {
      return solEngine.applyTolling(input.id, { reason: input.reason, startDate: new Date(input.startDate), endDate: new Date(input.endDate) });
    }),

  removeTolling: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return solEngine.removeTolling(input.id);
    }),

  getTollingReasons: publicProcedure
    .input(z.object({ jurisdiction: z.string(), practiceArea: z.string() }))
    .query(async ({ input }) => {
      const template = await db.sOLTemplate.findFirst({ where: { jurisdiction: input.jurisdiction, practiceArea: input.practiceArea } });
      return template?.tollingExceptions ? JSON.parse(template.tollingExceptions) : [];
    }),

  // ─── Alerts (14-18) ───────────────────────────────────────────────
  "alerts.list": publicProcedure
    .input(z.object({ solId: z.string().optional(), matterId: z.string().optional(), alertType: z.string().optional(), severity: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.solId) where.solId = input.solId;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.alertType) where.alertType = input.alertType;
      if (input?.severity) where.severity = input.severity;
      return db.sOLAlert.findMany({ where, orderBy: { createdAt: "desc" }, include: { sol: true } });
    }),

  "alerts.acknowledge": publicProcedure
    .input(z.object({ id: z.string(), acknowledgedBy: z.string() }))
    .mutation(async ({ input }) => {
      return db.sOLAlert.update({ where: { id: input.id }, data: { acknowledgedAt: new Date(), acknowledgedBy: input.acknowledgedBy, deliveryStatus: "SDS_ACKNOWLEDGED" as any } });
    }),

  "alerts.getUnacknowledged": publicProcedure
    .query(async () => {
      return db.sOLAlert.findMany({ where: { deliveryStatus: "SDS_PENDING" as any }, include: { sol: true }, orderBy: { createdAt: "desc" } });
    }),

  "alerts.runCheck": publicProcedure
    .mutation(async () => {
      return solEngine.checkAlerts();
    }),

  "alerts.getDailyDigest": publicProcedure
    .query(async () => {
      return solEngine.generateDailyDigest();
    }),

  // ─── Templates (19-26) ────────────────────────────────────────────
  "templates.list": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), jurisdiction: z.string().optional(), isActive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      if (input?.jurisdiction) where.jurisdiction = input.jurisdiction;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return db.sOLTemplate.findMany({ where, orderBy: { displayOrder: "asc" } });
    }),

  "templates.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.sOLTemplate.findUnique({ where: { id: input.id } });
    }),

  "templates.create": publicProcedure
    .input(z.object({ practiceArea: z.string(), jurisdiction: z.string(), causeOfAction: z.string(), limitationPeriod: z.string(), limitationDays: z.number(), statute: z.string(), statuteDescription: z.string().optional(), accrualBasis: z.string(), accrualDescription: z.string().optional(), noticeOfClaimRequired: z.boolean().optional(), noticeOfClaimDays: z.number().optional(), tollingExceptions: z.string().optional(), relatedCausesOfAction: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.sOLTemplate.create({ data: { ...input, accrualBasis: input.accrualBasis as any } });
    }),

  "templates.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.sOLTemplate.update({ where: { id: input.id }, data: input.data });
    }),

  "templates.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.sOLTemplate.delete({ where: { id: input.id } });
    }),

  "templates.seed": publicProcedure
    .mutation(async () => {
      const count = await db.sOLTemplate.count();
      if (count > 0) return { seeded: false, message: `Already seeded (${count} templates exist)`, count };

      const templates = [
        // ── New York (13) ─────────────────────────────────────────
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "General Negligence", limitationPeriod: "3 years", limitationDays: 1095, statute: "CPLR 214(5)", statuteDescription: "Three-year statute for negligence actions", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the negligent act or omission", tollingExceptions: JSON.stringify(["Infancy (CPLR 208)", "Insanity (CPLR 208)", "Continuous treatment doctrine"]), displayOrder: 1 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Medical Malpractice", limitationPeriod: "2.5 years", limitationDays: 913, statute: "CPLR 214-a", statuteDescription: "Two and one-half year statute for medical malpractice", accrualBasis: "AB_DATE_OF_LAST_TREATMENT" as any, accrualDescription: "Date of the act or last date of continuous treatment", tollingExceptions: JSON.stringify(["Continuous treatment doctrine", "Foreign object discovery rule (1 year from discovery)", "Infancy (CPLR 208)"]), displayOrder: 2 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Products Liability", limitationPeriod: "3 years", limitationDays: 1095, statute: "CPLR 214(5)", statuteDescription: "Three-year statute for products liability in negligence", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of injury caused by defective product", tollingExceptions: JSON.stringify(["Infancy (CPLR 208)", "Insanity (CPLR 208)"]), displayOrder: 3 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Wrongful Death", limitationPeriod: "2 years", limitationDays: 730, statute: "EPTL 5-4.1", statuteDescription: "Two-year statute from date of death", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of decedent's death", tollingExceptions: JSON.stringify(["Infancy of distributee"]), displayOrder: 4 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Assault and Battery", limitationPeriod: "1 year", limitationDays: 365, statute: "CPLR 215(3)", statuteDescription: "One-year statute for intentional torts", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the assault or battery", tollingExceptions: JSON.stringify(["Infancy (CPLR 208)", "Insanity (CPLR 208)"]), displayOrder: 5 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Defamation", limitationPeriod: "1 year", limitationDays: 365, statute: "CPLR 215(3)", statuteDescription: "One-year statute for defamation actions", accrualBasis: "AB_DATE_OF_PUBLICATION" as any, accrualDescription: "Date of publication of the defamatory statement", tollingExceptions: JSON.stringify(["Single publication rule"]), displayOrder: 6 },
        { practiceArea: "Contract", jurisdiction: "NY", causeOfAction: "Breach of Contract", limitationPeriod: "6 years", limitationDays: 2190, statute: "CPLR 213(2)", statuteDescription: "Six-year statute for breach of contract actions", accrualBasis: "AB_DATE_OF_BREACH" as any, accrualDescription: "Date of the breach", tollingExceptions: JSON.stringify(["Acknowledgment or part payment", "Defendant absence from state (CPLR 207)"]), displayOrder: 7 },
        { practiceArea: "Contract", jurisdiction: "NY", causeOfAction: "Breach of Warranty (UCC)", limitationPeriod: "4 years", limitationDays: 1460, statute: "UCC 2-725", statuteDescription: "Four-year statute for breach of warranty under UCC", accrualBasis: "AB_DATE_OF_BREACH" as any, accrualDescription: "Date of tender of delivery", tollingExceptions: JSON.stringify(["Future performance warranty extends accrual to date of discovery"]), displayOrder: 8 },
        { practiceArea: "Property", jurisdiction: "NY", causeOfAction: "Property Damage", limitationPeriod: "3 years", limitationDays: 1095, statute: "CPLR 214(4)", statuteDescription: "Three-year statute for property damage claims", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the property damage", tollingExceptions: JSON.stringify(["Infancy (CPLR 208)", "Insanity (CPLR 208)"]), displayOrder: 9 },
        { practiceArea: "Employment", jurisdiction: "NY", causeOfAction: "Employment Discrimination (NYSHRL)", limitationPeriod: "3 years", limitationDays: 1095, statute: "CPLR 214(2); Exec. Law § 297(9)", statuteDescription: "Three-year statute for NYSHRL discrimination claims", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the discriminatory act", tollingExceptions: JSON.stringify(["Continuing violation doctrine", "Filing with EEOC/DHR tolling"]), displayOrder: 10 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Municipal Liability (Notice of Claim)", limitationPeriod: "1 year 90 days", limitationDays: 455, statute: "GML 50-i", statuteDescription: "One year and ninety days against municipality; notice of claim within 90 days", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of incident", noticeOfClaimRequired: true, noticeOfClaimDays: 90, noticeOfClaimDescription: "Notice of Claim must be served within 90 days of accrual (GML 50-e)", tollingExceptions: JSON.stringify(["Infancy (GML 50-e(5))", "Late notice of claim (court permission)"]), displayOrder: 11 },
        { practiceArea: "Fraud", jurisdiction: "NY", causeOfAction: "Fraud", limitationPeriod: "6 years", limitationDays: 2190, statute: "CPLR 213(8)", statuteDescription: "Six years from commission or two years from discovery (whichever is longer)", accrualBasis: "AB_DATE_OF_DISCOVERY" as any, accrualDescription: "Date fraud was committed or discovered (whichever yields longer period)", tollingExceptions: JSON.stringify(["Discovery rule (2 years from discovery, CPLR 203(g))", "Equitable estoppel"]), displayOrder: 12 },
        { practiceArea: "Personal Injury", jurisdiction: "NY", causeOfAction: "Loss of Consortium", limitationPeriod: "3 years", limitationDays: 1095, statute: "CPLR 214(5)", statuteDescription: "Three-year statute, derivative of underlying injury claim", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the underlying injury", tollingExceptions: JSON.stringify(["Same tolling as underlying tort claim"]), displayOrder: 13 },

        // ── California (10) ──────────────────────────────────────
        { practiceArea: "Personal Injury", jurisdiction: "CA", causeOfAction: "General Negligence / Personal Injury", limitationPeriod: "2 years", limitationDays: 730, statute: "CCP § 335.1", statuteDescription: "Two-year statute for personal injury actions", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of injury", tollingExceptions: JSON.stringify(["Minority (CCP § 352)", "Insanity (CCP § 352)", "Imprisonment (CCP § 352.1)", "Delayed discovery"]), displayOrder: 14 },
        { practiceArea: "Personal Injury", jurisdiction: "CA", causeOfAction: "Medical Malpractice", limitationPeriod: "3 years or 1 year from discovery", limitationDays: 1095, statute: "CCP § 340.5", statuteDescription: "Three years from injury or one year from discovery, whichever first", accrualBasis: "AB_DATE_OF_DISCOVERY" as any, accrualDescription: "Earlier of 3 years from injury or 1 year from discovery", tollingExceptions: JSON.stringify(["Minority under 6 (tolled until age 8)", "Foreign body/fraud concealment", "Intent to conceal extends to 3 years from discovery"]), displayOrder: 15 },
        { practiceArea: "Personal Injury", jurisdiction: "CA", causeOfAction: "Wrongful Death", limitationPeriod: "2 years", limitationDays: 730, statute: "CCP § 335.1", statuteDescription: "Two-year statute from date of death", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of decedent's death", tollingExceptions: JSON.stringify(["Minority (CCP § 352)", "Delayed discovery of cause of death"]), displayOrder: 16 },
        { practiceArea: "Personal Injury", jurisdiction: "CA", causeOfAction: "Products Liability", limitationPeriod: "2 years", limitationDays: 730, statute: "CCP § 335.1", statuteDescription: "Two-year statute for products liability", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of injury from defective product", tollingExceptions: JSON.stringify(["Delayed discovery rule", "Minority (CCP § 352)"]), displayOrder: 17 },
        { practiceArea: "Contract", jurisdiction: "CA", causeOfAction: "Breach of Written Contract", limitationPeriod: "4 years", limitationDays: 1460, statute: "CCP § 337", statuteDescription: "Four-year statute for written contract actions", accrualBasis: "AB_DATE_OF_BREACH" as any, accrualDescription: "Date of the breach of written contract", tollingExceptions: JSON.stringify(["Acknowledgment of debt", "Part payment", "Defendant absence from state (CCP § 351)"]), displayOrder: 18 },
        { practiceArea: "Contract", jurisdiction: "CA", causeOfAction: "Breach of Oral Contract", limitationPeriod: "2 years", limitationDays: 730, statute: "CCP § 339", statuteDescription: "Two-year statute for oral contract actions", accrualBasis: "AB_DATE_OF_BREACH" as any, accrualDescription: "Date of the breach of oral contract", tollingExceptions: JSON.stringify(["Acknowledgment of debt", "Part payment"]), displayOrder: 19 },
        { practiceArea: "Property", jurisdiction: "CA", causeOfAction: "Property Damage", limitationPeriod: "3 years", limitationDays: 1095, statute: "CCP § 338(b)", statuteDescription: "Three-year statute for injury to real or personal property", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the property damage", tollingExceptions: JSON.stringify(["Delayed discovery", "Minority (CCP § 352)"]), displayOrder: 20 },
        { practiceArea: "Fraud", jurisdiction: "CA", causeOfAction: "Fraud / Deceit", limitationPeriod: "3 years", limitationDays: 1095, statute: "CCP § 338(d)", statuteDescription: "Three years from discovery of fraud", accrualBasis: "AB_DATE_OF_DISCOVERY" as any, accrualDescription: "Date fraud was discovered or should have been discovered", tollingExceptions: JSON.stringify(["Discovery rule (accrual delayed until discovery)", "Equitable estoppel"]), displayOrder: 21 },
        { practiceArea: "Employment", jurisdiction: "CA", causeOfAction: "Employment Discrimination (FEHA)", limitationPeriod: "3 years", limitationDays: 1095, statute: "Gov. Code § 12960(e)", statuteDescription: "Three years to file complaint with CRD (formerly DFEH)", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the discriminatory act", tollingExceptions: JSON.stringify(["Continuing violation doctrine", "Equitable tolling during CRD investigation"]), displayOrder: 22 },
        { practiceArea: "Personal Injury", jurisdiction: "CA", causeOfAction: "Government Tort Claim", limitationPeriod: "6 months", limitationDays: 180, statute: "Gov. Code § 911.2", statuteDescription: "Six-month deadline to file government tort claim; then 6 months to sue after rejection", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the incident giving rise to the claim", noticeOfClaimRequired: true, noticeOfClaimDays: 180, noticeOfClaimDescription: "Government tort claim must be filed within 6 months (Gov. Code § 911.2)", tollingExceptions: JSON.stringify(["Minority (Gov. Code § 911.4)", "Incapacity", "Late claim application (Gov. Code § 911.4)"]), displayOrder: 23 },

        // ── Federal (3) ─────────────────────────────────────────
        { practiceArea: "Civil Rights", jurisdiction: "Federal", causeOfAction: "Section 1983 Civil Rights", limitationPeriod: "Varies by state", limitationDays: 1095, statute: "42 U.S.C. § 1983", statuteDescription: "Borrows forum state personal injury statute; 3 years used as default", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the constitutional violation", tollingExceptions: JSON.stringify(["Forum state tolling rules apply", "Equitable tolling", "Continuing violation doctrine"]), displayOrder: 24 },
        { practiceArea: "Employment", jurisdiction: "Federal", causeOfAction: "Title VII Employment Discrimination", limitationPeriod: "300 days (with state agency)", limitationDays: 300, statute: "42 U.S.C. § 2000e-5(e)(1)", statuteDescription: "300 days to file EEOC charge (with state/local agency); 180 days without", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of the discriminatory act", tollingExceptions: JSON.stringify(["Continuing violation doctrine (hostile work environment)", "Equitable tolling", "Lilly Ledbetter Fair Pay Act (pay discrimination)"]), displayOrder: 25 },
        { practiceArea: "Employment", jurisdiction: "Federal", causeOfAction: "FLSA Wage Claims", limitationPeriod: "2 years (3 if willful)", limitationDays: 730, statute: "29 U.S.C. § 255(a)", statuteDescription: "Two-year statute; three years for willful violations", accrualBasis: "AB_DATE_OF_INCIDENT" as any, accrualDescription: "Date of each pay period violation", tollingExceptions: JSON.stringify(["Willful violation extends to 3 years (1095 days)", "Equitable tolling", "Each pay period is separate violation"]), displayOrder: 26 },
      ];

      await db.sOLTemplate.createMany({ data: templates });
      return { seeded: true, message: `Seeded ${templates.length} SOL templates`, count: templates.length };
    }),

  "templates.getForMatter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      const where: any = { isActive: true };
      if (matter.practiceArea) where.practiceArea = matter.practiceArea;
      // Matter doesn't have jurisdiction field directly — could be derived from overlay
      return db.sOLTemplate.findMany({ where, orderBy: { displayOrder: "asc" } });
    }),

  "templates.search": publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return db.sOLTemplate.findMany({ where: { causeOfAction: { contains: input.query } }, orderBy: { displayOrder: "asc" } });
    }),

  // ─── AI (27-30) ───────────────────────────────────────────────────
  "ai.suggest": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return solEngine.suggestSOL(input.matterId);
    }),

  "ai.analyzeRisk": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return solEngine.analyzeRisk(input.matterId);
    }),

  "ai.detectMissedClaims": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return solEngine.detectMissedClaims(input.matterId);
    }),

  "ai.getTollingAnalysis": publicProcedure
    .input(z.object({ solId: z.string() }))
    .query(async ({ input }) => {
      return { solId: input.solId, analysis: "Tolling analysis placeholder - AI integration pending" };
    }),

  // ─── Settings (31-32) ─────────────────────────────────────────────
  "settings.get": publicProcedure
    .query(async () => {
      const existing = await db.sOLSettings.findFirst();
      if (existing) return existing;
      return db.sOLSettings.create({ data: { id: "default" } });
    }),

  "settings.update": publicProcedure
    .input(z.object({ data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.sOLSettings.upsert({ where: { id: "default" }, create: { id: "default", ...input.data }, update: input.data });
    }),

  // ─── Reports (33-41) ──────────────────────────────────────────────
  "reports.dashboard": publicProcedure
    .query(async () => {
      const all = await db.statuteOfLimitations.findMany({ where: { status: "SOL_ACTIVE" as any } });
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 86400000);
      const monthEnd = new Date(now.getTime() + 30 * 86400000);
      const byUrgency: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let expiringWeek = 0, expiringMonth = 0;
      for (const sol of all) {
        byUrgency[sol.urgency] = (byUrgency[sol.urgency] || 0) + 1;
        byStatus[sol.status] = (byStatus[sol.status] || 0) + 1;
        const exp = new Date(sol.expirationDate);
        if (exp <= weekEnd) expiringWeek++;
        if (exp <= monthEnd) expiringMonth++;
      }
      return { total: all.length, byUrgency, byStatus, expiringThisWeek: expiringWeek, expiringThisMonth: expiringMonth };
    }),

  "reports.expirationCalendar": publicProcedure
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ input }) => {
      return solEngine.getExpirationCalendar({ start: new Date(input.start), end: new Date(input.end) });
    }),

  "reports.byPracticeArea": publicProcedure
    .query(async () => {
      return db.statuteOfLimitations.groupBy({ by: ["practiceArea"], _count: { id: true }, orderBy: { _count: { id: "desc" } } });
    }),

  "reports.byJurisdiction": publicProcedure
    .query(async () => {
      return db.statuteOfLimitations.groupBy({ by: ["jurisdiction"], _count: { id: true }, orderBy: { _count: { id: "desc" } } });
    }),

  "reports.byAttorney": publicProcedure
    .query(async () => {
      return db.statuteOfLimitations.groupBy({ by: ["assignedTo"], _count: { id: true }, orderBy: { _count: { id: "desc" } } });
    }),

  "reports.alertHistory": publicProcedure
    .input(z.object({ limit: z.number().default(100) }).optional())
    .query(async ({ input }) => {
      return db.sOLAlert.findMany({ orderBy: { createdAt: "desc" }, take: input?.limit ?? 100, include: { sol: true } });
    }),

  "reports.riskAssessment": publicProcedure
    .query(async () => {
      return db.statuteOfLimitations.findMany({ where: { riskLevel: { in: ["SRL_HIGH" as any, "SRL_EXTREME" as any] } }, include: { matter: true }, orderBy: { expirationDate: "asc" } });
    }),

  "reports.weeklyReport": publicProcedure
    .query(async () => {
      return solEngine.generateWeeklyReport();
    }),

  "reports.export": publicProcedure
    .input(z.object({ format: z.enum(["csv", "json", "pdf"]).default("json"), filters: z.record(z.any()).optional() }).optional())
    .query(async ({ input }) => {
      return { format: input?.format ?? "json", status: "Export placeholder - implementation pending", generatedAt: new Date() };
    }),
});
