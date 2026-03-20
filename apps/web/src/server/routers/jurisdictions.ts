import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

export const jurisdictionsRouter = router({
  // ──────────────────────────────────────────
  // Jurisdiction Profiles (1-5)
  // ──────────────────────────────────────────

  "jurisdictions.list": publicProcedure
    .input(
      z.object({
        jurisdictionType: z.string().optional(),
        state: z.string().optional(),
        isActive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const { jurisdictionType, state, isActive } = input || {};
      return db.jurisdictionProfile.findMany({
        where: {
          ...(jurisdictionType ? { jurisdictionType: jurisdictionType as any } : {}),
          ...(state ? { state } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: { _count: { select: { configs: true } } },
        orderBy: { jurisdictionName: "asc" },
      });
    }),

  "jurisdictions.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.jurisdictionProfile.findUnique({
        where: { id: input.id },
        include: { configs: true },
      });
    }),

  "jurisdictions.create": publicProcedure
    .input(
      z.object({
        jurisdiction: z.string(),
        jurisdictionName: z.string(),
        jurisdictionType: z.string(),
        parentJurisdiction: z.string().optional(),
        state: z.string().optional(),
        timezone: z.string().optional(),
        courtSystem: z.string().optional(),
        filingFees: z.string().optional(),
        efiling: z.string().optional(),
        barRequirements: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.jurisdictionProfile.create({
        data: { ...input, jurisdictionType: input.jurisdictionType as any },
      });
    }),

  "jurisdictions.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ input }) => {
      return db.jurisdictionProfile.update({
        where: { id: input.id },
        data: input.data as any,
      });
    }),

  "jurisdictions.getByState": publicProcedure
    .input(z.object({ state: z.string() }))
    .query(async ({ input }) => {
      return db.jurisdictionProfile.findMany({
        where: { state: input.state },
      });
    }),

  // ──────────────────────────────────────────
  // Practice Area + Jurisdiction Configs (6-11)
  // ──────────────────────────────────────────

  "configs.list": publicProcedure
    .input(
      z.object({
        practiceArea: z.string().optional(),
        jurisdictionId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const { practiceArea, jurisdictionId } = input || {};
      return db.practiceAreaJurisdiction.findMany({
        where: {
          ...(practiceArea ? { practiceArea } : {}),
          ...(jurisdictionId ? { jurisdictionId } : {}),
        },
        include: {
          jurisdiction: true,
          _count: { select: { forms: true, deadlines: true } },
        },
        orderBy: { displayName: "asc" },
      });
    }),

  "configs.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.practiceAreaJurisdiction.findUnique({
        where: { id: input.id },
        include: {
          jurisdiction: true,
          forms: { orderBy: { displayOrder: "asc" } },
          deadlines: { orderBy: { displayOrder: "asc" } },
        },
      });
    }),

  "configs.create": publicProcedure
    .input(
      z.object({
        practiceArea: z.string(),
        jurisdictionId: z.string(),
        displayName: z.string(),
        statuteReferences: z.string().optional(),
        filingRequirements: z.string().optional(),
        courtRules: z.string().optional(),
        standardForms: z.string().optional(),
        deadlineRules: z.string().optional(),
        defaultFields: z.string().optional(),
        terminologyMap: z.string().optional(),
        localResources: z.string().optional(),
        limitationsPeriodsStr: z.string().optional(),
        serviceRules: z.string().optional(),
        discoveryRules: z.string().optional(),
        trialProcedures: z.string().optional(),
        appealRules: z.string().optional(),
        feeSchedule: z.string().optional(),
        aiPromptContext: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.practiceAreaJurisdiction.create({ data: input });
    }),

  "configs.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaJurisdiction.update({
        where: { id: input.id },
        data: input.data as any,
      });
    }),

  "configs.getForMatter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
      });
      if (!overlay) return null;
      return db.practiceAreaJurisdiction.findUnique({
        where: { id: overlay.practiceAreaJurisdictionId },
        include: {
          jurisdiction: true,
          forms: { orderBy: { displayOrder: "asc" } },
          deadlines: { orderBy: { displayOrder: "asc" } },
        },
      });
    }),

  "configs.getAvailable": publicProcedure.query(async () => {
    const configs = await db.practiceAreaJurisdiction.findMany({
      where: { isActive: true },
      include: { jurisdiction: true },
      orderBy: { practiceArea: "asc" },
    });
    const grouped: Record<string, typeof configs> = {};
    for (const c of configs) {
      (grouped[c.practiceArea] ??= []).push(c);
    }
    return grouped;
  }),

  // ──────────────────────────────────────────
  // Forms (12-18)
  // ──────────────────────────────────────────

  "forms.list": publicProcedure
    .input(
      z.object({
        configId: z.string(),
        category: z.string().optional(),
        isRequired: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.jurisdictionForm.findMany({
        where: {
          practiceAreaJurisdictionId: input.configId,
          ...(input.category ? { category: input.category } : {}),
          ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        },
        orderBy: { displayOrder: "asc" },
      });
    }),

  "forms.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.jurisdictionForm.findUnique({ where: { id: input.id } });
    }),

  "forms.create": publicProcedure
    .input(
      z.object({
        configId: z.string(),
        formNumber: z.string(),
        formName: z.string(),
        category: z.string(),
        description: z.string().optional(),
        formUrl: z.string().optional(),
        templateId: z.string().optional(),
        isRequired: z.boolean().optional(),
        requiredWhen: z.string().optional(),
        filingFee: z.number().optional(),
        filingLocation: z.string().optional(),
        instructions: z.string().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { configId, filingFee, ...rest } = input;
      return db.jurisdictionForm.create({
        data: {
          ...rest,
          practiceAreaJurisdictionId: configId,
          ...(filingFee !== undefined ? { filingFee } : {}),
        },
      });
    }),

  "forms.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ input }) => {
      return db.jurisdictionForm.update({
        where: { id: input.id },
        data: input.data as any,
      });
    }),

  "forms.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.jurisdictionForm.delete({ where: { id: input.id } });
    }),

  "forms.getRequired": publicProcedure
    .input(z.object({ configId: z.string() }))
    .query(async ({ input }) => {
      return db.jurisdictionForm.findMany({
        where: { practiceAreaJurisdictionId: input.configId, isRequired: true },
        orderBy: { displayOrder: "asc" },
      });
    }),

  "forms.getChecklist": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
      });
      if (!overlay) return [];
      const forms = await db.jurisdictionForm.findMany({
        where: { practiceAreaJurisdictionId: overlay.practiceAreaJurisdictionId },
        orderBy: { displayOrder: "asc" },
      });
      const docs = await db.document.findMany({
        where: { matterId: input.matterId },
        select: { name: true },
      });
      const docNames = new Set(docs.map((d) => d.name));
      return forms.map((f) => ({ ...f, filed: docNames.has(f.formName) }));
    }),

  // ──────────────────────────────────────────
  // Deadlines (19-25)
  // ──────────────────────────────────────────

  "deadlines.list": publicProcedure
    .input(
      z.object({
        configId: z.string(),
        category: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.jurisdictionDeadline.findMany({
        where: {
          practiceAreaJurisdictionId: input.configId,
          ...(input.category ? { category: input.category } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
        orderBy: { displayOrder: "asc" },
      });
    }),

  "deadlines.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.jurisdictionDeadline.findUnique({ where: { id: input.id } });
    }),

  "deadlines.create": publicProcedure
    .input(
      z.object({
        configId: z.string(),
        name: z.string(),
        triggerEvent: z.string(),
        days: z.number(),
        calendarType: z.string().optional(),
        statute: z.string().optional(),
        isDefault: z.boolean().optional(),
        priority: z.string().optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { configId, calendarType, ...rest } = input;
      return db.jurisdictionDeadline.create({
        data: {
          ...rest,
          practiceAreaJurisdictionId: configId,
          ...(calendarType ? { calendarType: calendarType as any } : {}),
        },
      });
    }),

  "deadlines.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ input }) => {
      return db.jurisdictionDeadline.update({
        where: { id: input.id },
        data: input.data as any,
      });
    }),

  "deadlines.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.jurisdictionDeadline.delete({ where: { id: input.id } });
    }),

  "deadlines.applyToMatter": publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        triggerEvent: z.string(),
        triggerDate: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
      });
      if (!overlay) throw new Error("No jurisdiction overlay for this matter");
      const rules = await db.jurisdictionDeadline.findMany({
        where: {
          practiceAreaJurisdictionId: overlay.practiceAreaJurisdictionId,
          triggerEvent: input.triggerEvent,
        },
      });
      const base = new Date(input.triggerDate);
      const tasks = await Promise.all(
        rules.map((r) => {
          const due = new Date(base);
          due.setDate(due.getDate() + r.days);
          return db.task.create({
            data: {
              matterId: input.matterId,
              title: r.name,
              dueDate: due,
              priority: r.priority as any,
              status: "TODO" as any,
            },
          });
        })
      );
      return tasks;
    }),

  "deadlines.preview": publicProcedure
    .input(
      z.object({
        configId: z.string(),
        triggerEvent: z.string(),
        triggerDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      const rules = await db.jurisdictionDeadline.findMany({
        where: {
          practiceAreaJurisdictionId: input.configId,
          triggerEvent: input.triggerEvent,
        },
      });
      const base = new Date(input.triggerDate);
      return rules.map((r) => {
        const due = new Date(base);
        due.setDate(due.getDate() + r.days);
        return { ...r, dueDate: due.toISOString() };
      });
    }),

  // ──────────────────────────────────────────
  // Matter Overlay (26-32)
  // ──────────────────────────────────────────

  "overlay.apply": publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        practiceArea: z.string(),
        jurisdictionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const config = await db.practiceAreaJurisdiction.findFirst({
        where: { practiceArea: input.practiceArea, jurisdictionId: input.jurisdictionId },
      });
      if (!config) throw new Error("No config found for this practice area + jurisdiction");
      return db.matterJurisdictionOverlay.create({
        data: {
          matterId: input.matterId,
          practiceAreaJurisdictionId: config.id,
        },
      });
    }),

  "overlay.get": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
        include: {
          practiceAreaJurisdiction: { include: { jurisdiction: true } },
        },
      });
    }),

  "overlay.remove": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => {
      return db.matterJurisdictionOverlay.delete({
        where: { matterId: input.matterId },
      });
    }),

  "overlay.getTerminology": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
        include: { practiceAreaJurisdiction: true },
      });
      if (!overlay) return null;
      const raw = overlay.practiceAreaJurisdiction.terminologyMap;
      return raw ? JSON.parse(raw) : {};
    }),

  "overlay.getStatutes": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
        include: { practiceAreaJurisdiction: true },
      });
      if (!overlay) return null;
      const raw = overlay.practiceAreaJurisdiction.statuteReferences;
      return raw ? JSON.parse(raw) : {};
    }),

  "overlay.getForms": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
      });
      if (!overlay) return [];
      const forms = await db.jurisdictionForm.findMany({
        where: { practiceAreaJurisdictionId: overlay.practiceAreaJurisdictionId },
        orderBy: { displayOrder: "asc" },
      });
      const docs = await db.document.findMany({
        where: { matterId: input.matterId },
        select: { name: true },
      });
      const docNames = new Set(docs.map((d) => d.name));
      return forms.map((f) => ({ ...f, filed: docNames.has(f.formName) }));
    }),

  "overlay.getDeadlines": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
      });
      if (!overlay) return [];
      return db.jurisdictionDeadline.findMany({
        where: { practiceAreaJurisdictionId: overlay.practiceAreaJurisdictionId },
        orderBy: { displayOrder: "asc" },
      });
    }),

  // ──────────────────────────────────────────
  // AI Integration (33-34)
  // ──────────────────────────────────────────

  "ai.getContext": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
        include: { practiceAreaJurisdiction: true },
      });
      if (!overlay) return null;
      return overlay.practiceAreaJurisdiction.aiPromptContext ?? null;
    }),

  "ai.suggestJurisdiction": publicProcedure
    .input(
      z.object({
        courtName: z.string().optional(),
        state: z.string().optional(),
        caseType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      if (!input.state) return [];
      const profiles = await db.jurisdictionProfile.findMany({
        where: { state: input.state },
      });
      const suggestions = [];
      for (const p of profiles) {
        const configs = await db.practiceAreaJurisdiction.findMany({
          where: { jurisdictionId: p.id },
          select: { practiceArea: true, displayName: true, id: true },
        });
        suggestions.push({ jurisdiction: p, configs });
      }
      return suggestions;
    }),

  // ──────────────────────────────────────────
  // Terminology (35-36)
  // ──────────────────────────────────────────

  "terminology.translate": publicProcedure
    .input(
      z.object({
        terms: z.array(z.string()),
        jurisdictionId: z.string(),
        practiceArea: z.string(),
      })
    )
    .query(async ({ input }) => {
      const config = await db.practiceAreaJurisdiction.findFirst({
        where: { jurisdictionId: input.jurisdictionId, practiceArea: input.practiceArea },
      });
      if (!config?.terminologyMap) return input.terms.map((t) => ({ term: t, translated: t }));
      const map: Record<string, string> = JSON.parse(config.terminologyMap);
      return input.terms.map((t) => ({
        term: t,
        translated: map[t] ?? t,
      }));
    }),

  "terminology.getForUI": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
        include: { practiceAreaJurisdiction: true },
      });
      if (!overlay) return {} as Record<string, string>;
      const raw = overlay.practiceAreaJurisdiction.terminologyMap;
      return raw ? (JSON.parse(raw) as Record<string, string>) : ({} as Record<string, string>);
    }),

  // ──────────────────────────────────────────
  // Reports (37-38)
  // ──────────────────────────────────────────

  "reports.coverageMap": publicProcedure.query(async () => {
    const configs = await db.practiceAreaJurisdiction.findMany({
      include: { jurisdiction: true, _count: { select: { forms: true, deadlines: true } } },
    });
    const matrix: Record<string, Record<string, { configId: string; forms: number; deadlines: number }>> = {};
    for (const c of configs) {
      (matrix[c.practiceArea] ??= {})[c.jurisdiction.jurisdictionName] = {
        configId: c.id,
        forms: c._count.forms,
        deadlines: c._count.deadlines,
      };
    }
    return matrix;
  }),

  "reports.formCompleteness": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const overlay = await db.matterJurisdictionOverlay.findUnique({
        where: { matterId: input.matterId },
      });
      if (!overlay) return { total: 0, filed: 0, missing: 0, forms: [] };
      const forms = await db.jurisdictionForm.findMany({
        where: { practiceAreaJurisdictionId: overlay.practiceAreaJurisdictionId },
        orderBy: { displayOrder: "asc" },
      });
      const docs = await db.document.findMany({
        where: { matterId: input.matterId },
        select: { name: true },
      });
      const docNames = new Set(docs.map((d) => d.name));
      const checklist = forms.map((f) => ({ ...f, filed: docNames.has(f.formName) }));
      const filedCount = checklist.filter((f) => f.filed).length;
      return { total: forms.length, filed: filedCount, missing: forms.length - filedCount, forms: checklist };
    }),

  // ──────────────────────────────────────────
  // Seeding (39)
  // ──────────────────────────────────────────

  "seed": publicProcedure.mutation(async () => {
    const existing = await db.jurisdictionProfile.findFirst();
    if (existing) return { profilesCreated: 0, configsCreated: 0, formsCreated: 0, deadlinesCreated: 0, message: "Seed data already exists" };

    let profilesCreated = 0;
    let configsCreated = 0;
    let formsCreated = 0;
    let deadlinesCreated = 0;

    // ── Jurisdiction Profiles ──
    const ny = await db.jurisdictionProfile.create({
      data: {
        jurisdiction: "ny_state",
        jurisdictionName: "New York State",
        jurisdictionType: "JUR_STATE" as any,
        state: "NY",
        timezone: "America/New_York",
        courtSystem: JSON.stringify({ trial: "Supreme Court", family: "Family Court", surrogate: "Surrogate's Court", civil: "Civil Court", criminal: "Criminal Court" }),
        filingFees: JSON.stringify({ supreme_court_index: 210, motion_fee: 45, jury_demand: 65, poor_person_relief: 0 }),
        efiling: JSON.stringify({ system: "NYSCEF", url: "https://iapps.courts.state.ny.us/nyscef", mandatory: true, counties: "all" }),
        barRequirements: JSON.stringify({ admission: "NY Bar Exam or UBE transfer", cle: "24 credits biennially", registration: "biennial registration required" }),
      },
    });
    profilesCreated++;

    const ca = await db.jurisdictionProfile.create({
      data: {
        jurisdiction: "ca_state",
        jurisdictionName: "California",
        jurisdictionType: "JUR_STATE" as any,
        state: "CA",
        timezone: "America/Los_Angeles",
        courtSystem: JSON.stringify({ trial: "Superior Court", appellate: "Court of Appeal", supreme: "Supreme Court" }),
        filingFees: JSON.stringify({ unlimited_civil: 435, limited_civil: 75, family_law_petition: 435, motion_fee: 60 }),
        efiling: JSON.stringify({ system: "Various by county", mandatory: "most counties", url: "https://www.courts.ca.gov/efiling.htm" }),
        barRequirements: JSON.stringify({ admission: "California Bar Exam", cle: "25 hours per 3-year period", mcle: "required" }),
      },
    });
    profilesCreated++;

    const fedEdny = await db.jurisdictionProfile.create({
      data: {
        jurisdiction: "fed_edny",
        jurisdictionName: "Federal - Eastern District of New York",
        jurisdictionType: "JUR_FEDERAL_DISTRICT" as any,
        parentJurisdiction: "ny_state",
        state: "NY",
        timezone: "America/New_York",
        courtSystem: JSON.stringify({ court: "U.S. District Court, Eastern District of New York", divisions: ["Brooklyn", "Central Islip"], chief_judge: "Chief Judge" }),
        filingFees: JSON.stringify({ civil_filing: 402, motion_fee: 0, appeal_fee: 505 }),
        efiling: JSON.stringify({ system: "CM/ECF", url: "https://ecf.nyed.uscourts.gov", mandatory: true }),
        barRequirements: JSON.stringify({ admission: "EDNY bar admission required", sponsorship: "member of EDNY bar must sponsor" }),
      },
    });
    profilesCreated++;

    // ── NY Family Law Config ──
    const nyFamily = await db.practiceAreaJurisdiction.create({
      data: {
        practiceArea: "family",
        jurisdictionId: ny.id,
        displayName: "New York Family Law",
        statuteReferences: JSON.stringify({ drl: "Domestic Relations Law", fca: "Family Court Act", cplr: "CPLR", eptl: "Estates, Powers & Trusts Law" }),
        filingRequirements: JSON.stringify({ residency: "At least one party must meet NY residency requirements under DRL §230", grounds: "DRL §170 - irretrievable breakdown for 6+ months, or fault-based grounds", filing_location: "Supreme Court of the county where either party resides" }),
        courtRules: JSON.stringify({ preliminary_conference: "Required within 45 days of RJI filing", compliance_conference: "Scheduled as needed", automatic_orders: "DRL §236(B)(2) automatic orders upon filing" }),
        terminologyMap: JSON.stringify({ complaint: "Summons with Notice / Verified Complaint", petitioner: "Plaintiff", respondent: "Defendant", custody: "Custody and Parenting Time", alimony: "Maintenance", marital_property: "Equitable Distribution", parenting_plan: "Parenting Plan" }),
        serviceRules: JSON.stringify({ personal_service: "Required for initial summons", substituted_service: "Available after diligent attempts", service_by_publication: "Court order required" }),
        aiPromptContext: "New York family law jurisdiction. Key statutes: DRL (Domestic Relations Law), FCA (Family Court Act). Equitable distribution state. Maintenance guidelines under DRL §236(B)(6). Child support follows CSSA (Child Support Standards Act). Custody standard: best interests of the child.",
      },
    });
    configsCreated++;

    // NY Family Law Forms
    const nyFamilyForms = [
      { formNumber: "UD-1", formName: "Action for Divorce - Verified Complaint", category: "Initiating", description: "Verified Complaint for divorce action in Supreme Court", isRequired: true, filingFee: 210, filingLocation: "Supreme Court", displayOrder: 1 },
      { formNumber: "UD-2", formName: "Summons With Notice", category: "Initiating", description: "Summons with Notice for uncontested divorce", isRequired: true, displayOrder: 2 },
      { formNumber: "UD-3", formName: "Affirmation of Regularity", category: "Initiating", description: "Affirmation that procedural requirements have been met", isRequired: true, displayOrder: 3 },
      { formNumber: "UD-4", formName: "Affidavit of Service", category: "Service", description: "Proof of service of summons and complaint", isRequired: true, displayOrder: 4 },
      { formNumber: "UD-5", formName: "Affidavit of Defendant", category: "Response", description: "Defendant's sworn affidavit in uncontested divorce", isRequired: false, requiredWhen: "uncontested", displayOrder: 5 },
      { formNumber: "UD-6", formName: "Sworn Statement of Removal of Barriers to Remarriage", category: "Compliance", description: "Statement regarding removal of barriers to religious remarriage", isRequired: false, requiredWhen: "religious_marriage", displayOrder: 6 },
      { formNumber: "UD-7", formName: "Affidavit of Plaintiff", category: "Initiating", description: "Plaintiff's sworn statement in support of divorce", isRequired: true, displayOrder: 7 },
      { formNumber: "UD-8", formName: "Child Support Worksheet", category: "Financial", description: "Child Support Standards Act worksheet for calculating support", isRequired: false, requiredWhen: "children_involved", filingFee: 0, displayOrder: 8 },
      { formNumber: "UD-9", formName: "Maintenance Worksheet", category: "Financial", description: "Worksheet for temporary and post-divorce maintenance calculations", isRequired: false, requiredWhen: "maintenance_requested", displayOrder: 9 },
      { formNumber: "UD-10", formName: "Findings of Fact / Conclusions of Law", category: "Judgment", description: "Court findings of fact and conclusions of law", isRequired: true, displayOrder: 10 },
      { formNumber: "UD-11", formName: "Judgment of Divorce", category: "Judgment", description: "Final judgment dissolving the marriage", isRequired: true, displayOrder: 11 },
      { formNumber: "UD-11a", formName: "Part B - Divorce and Child Disposition", category: "Judgment", description: "Supplemental judgment provisions for child custody and support", isRequired: false, requiredWhen: "children_involved", displayOrder: 12 },
      { formNumber: "RJI", formName: "Request for Judicial Intervention", category: "Initiating", description: "Request to assign a judge to the case", isRequired: true, filingFee: 95, filingLocation: "Supreme Court", displayOrder: 13 },
      { formNumber: "UCS-841", formName: "Statement of Net Worth", category: "Financial", description: "Comprehensive financial disclosure required in contested matters", isRequired: false, requiredWhen: "contested", displayOrder: 14 },
    ];
    for (const form of nyFamilyForms) {
      await db.jurisdictionForm.create({
        data: { ...form, practiceAreaJurisdictionId: nyFamily.id } as any,
      });
      formsCreated++;
    }

    // NY Family Law Deadlines
    const nyFamilyDeadlines = [
      { name: "File Request for Judicial Intervention", triggerEvent: "filing_date", days: 45, calendarType: "CDT_CALENDAR" as any, statute: "22 NYCRR §202.6", isDefault: true, priority: "HIGH", category: "Filing", notes: "RJI must be filed within 45 days of filing or upon first motion", displayOrder: 1 },
      { name: "Preliminary Conference", triggerEvent: "rji_filed", days: 45, calendarType: "CDT_CALENDAR" as any, statute: "22 NYCRR §202.16(a)", isDefault: true, priority: "HIGH", category: "Conference", notes: "Court must schedule within 45 days of RJI", displayOrder: 2 },
      { name: "Statement of Net Worth Due", triggerEvent: "rji_filed", days: 10, calendarType: "CDT_BUSINESS" as any, statute: "22 NYCRR §202.16(b)", isDefault: true, priority: "HIGH", category: "Financial", notes: "Must be filed and served within 10 business days of RJI", displayOrder: 3 },
      { name: "Answer Due After Personal Service", triggerEvent: "service_date", days: 20, calendarType: "CDT_CALENDAR" as any, statute: "CPLR §320(a)", isDefault: true, priority: "HIGH", category: "Response", notes: "Defendant must answer within 20 days of personal service within NY", displayOrder: 4 },
      { name: "Answer Due After Service Outside NY", triggerEvent: "service_date", days: 30, calendarType: "CDT_CALENDAR" as any, statute: "CPLR §320(a)", isDefault: true, priority: "HIGH", category: "Response", notes: "30 days if served outside New York", displayOrder: 5 },
      { name: "Automatic Orders Effective", triggerEvent: "filing_date", days: 0, calendarType: "CDT_CALENDAR" as any, statute: "DRL §236(B)(2)", isDefault: true, priority: "CRITICAL", category: "Compliance", notes: "Automatic orders take effect upon filing for plaintiff, upon service for defendant", displayOrder: 6 },
      { name: "Note of Issue Filing Deadline", triggerEvent: "preliminary_conference", days: 180, calendarType: "CDT_CALENDAR" as any, statute: "22 NYCRR §202.21", isDefault: true, priority: "MEDIUM", category: "Trial Prep", notes: "Note of Issue typically due within 6 months of preliminary conference, but varies by judge", displayOrder: 7 },
      { name: "Motion Return Date", triggerEvent: "motion_filed", days: 8, calendarType: "CDT_BUSINESS" as any, statute: "CPLR §2214(b)", isDefault: true, priority: "HIGH", category: "Motions", notes: "Minimum 8 days notice for motion on notice", displayOrder: 8 },
    ];
    for (const dl of nyFamilyDeadlines) {
      await db.jurisdictionDeadline.create({
        data: { ...dl, practiceAreaJurisdictionId: nyFamily.id },
      });
      deadlinesCreated++;
    }

    // ── NY Personal Injury Config ──
    const nyPI = await db.practiceAreaJurisdiction.create({
      data: {
        practiceArea: "personal_injury",
        jurisdictionId: ny.id,
        displayName: "New York Personal Injury",
        statuteReferences: JSON.stringify({ cplr: "CPLR", vt_law: "Vehicle & Traffic Law", gen_oblig: "General Obligations Law", workers_comp: "Workers Compensation Law" }),
        terminologyMap: JSON.stringify({ complaint: "Summons and Complaint", discovery: "Disclosure", deposition: "Examination Before Trial (EBT)", interrogatories: "Interrogatories" }),
        aiPromptContext: "New York personal injury law. Key statutes: CPLR for procedure, VTL for motor vehicle accidents. Comparative negligence state (CPLR §1411). Statute of limitations: 3 years for personal injury, 2 years for medical malpractice. No-fault threshold applies to motor vehicle cases (Insurance Law §5102(d)).",
      },
    });
    configsCreated++;

    // ── NY General Litigation Config ──
    const nyLit = await db.practiceAreaJurisdiction.create({
      data: {
        practiceArea: "general_litigation",
        jurisdictionId: ny.id,
        displayName: "New York General Litigation",
        statuteReferences: JSON.stringify({ cplr: "CPLR", judiciary_law: "Judiciary Law", court_rules: "22 NYCRR" }),
        terminologyMap: JSON.stringify({ complaint: "Summons and Complaint", discovery: "Disclosure", summary_judgment: "Summary Judgment under CPLR §3212", class_action: "Class Action under CPLR Article 9" }),
        aiPromptContext: "New York general civil litigation. Governed by CPLR. Supreme Court has unlimited jurisdiction. Filing in county where cause of action arose or party resides. E-filing mandatory in most counties via NYSCEF.",
      },
    });
    configsCreated++;

    // ── CA Family Law Config ──
    const caFamily = await db.practiceAreaJurisdiction.create({
      data: {
        practiceArea: "family",
        jurisdictionId: ca.id,
        displayName: "California Family Law",
        statuteReferences: JSON.stringify({ fam_code: "Family Code", ccp: "Code of Civil Procedure", prob_code: "Probate Code", welf_inst: "Welfare & Institutions Code" }),
        filingRequirements: JSON.stringify({ residency: "6 months in California, 3 months in county of filing", grounds: "Irreconcilable differences (no-fault)", filing_location: "Superior Court of the county", cooling_off: "6-month waiting period from service" }),
        courtRules: JSON.stringify({ disclosure: "Preliminary and final declarations of disclosure required", mediation: "Mandatory mediation for custody disputes", settlement_conference: "Mandatory settlement conference before trial" }),
        terminologyMap: JSON.stringify({ complaint: "Petition", petitioner: "Petitioner", respondent: "Respondent", custody: "Custody and Visitation", alimony: "Spousal Support", marital_property: "Community Property", parenting_plan: "Parenting Plan" }),
        serviceRules: JSON.stringify({ personal_service: "Required for initial petition", substituted_service: "Available after reasonable diligence", service_by_mail: "Allowed for subsequent documents" }),
        aiPromptContext: "California family law jurisdiction. Community property state. Key statute: Family Code. Spousal support factors under Family Code §4320. Child support follows statewide guidelines (FC §4050-4076). Best interests of child standard for custody. 6-month residency requirement. Mandatory disclosure requirements.",
      },
    });
    configsCreated++;

    // CA Family Law Forms
    const caFamilyForms = [
      { formNumber: "FL-100", formName: "Petition - Marriage/Domestic Partnership", category: "Initiating", description: "Petition to initiate dissolution, legal separation, or nullity", isRequired: true, filingFee: 435, filingLocation: "Superior Court", displayOrder: 1 },
      { formNumber: "FL-110", formName: "Summons (Family Law)", category: "Initiating", description: "Summons to be served with the petition", isRequired: true, displayOrder: 2 },
      { formNumber: "FL-115", formName: "Proof of Service of Summons", category: "Service", description: "Proof that summons and petition were served", isRequired: true, displayOrder: 3 },
      { formNumber: "FL-120", formName: "Response - Marriage/Domestic Partnership", category: "Response", description: "Respondent's response to the petition", isRequired: false, requiredWhen: "contested", filingFee: 435, displayOrder: 4 },
      { formNumber: "FL-140", formName: "Declaration of Disclosure", category: "Financial", description: "Cover sheet for preliminary and final declarations of disclosure", isRequired: true, displayOrder: 5 },
      { formNumber: "FL-141", formName: "Declaration Re: Service of Declaration of Disclosure", category: "Financial", description: "Proof of service of disclosure documents", isRequired: true, displayOrder: 6 },
      { formNumber: "FL-142", formName: "Schedule of Assets and Debts", category: "Financial", description: "Detailed listing of community and separate assets and debts", isRequired: true, displayOrder: 7 },
      { formNumber: "FL-150", formName: "Income and Expense Declaration", category: "Financial", description: "Declaration of income, expenses, and financial circumstances", isRequired: true, displayOrder: 8 },
      { formNumber: "FL-155", formName: "Financial Statement (Simplified)", category: "Financial", description: "Simplified financial statement for straightforward cases", isRequired: false, displayOrder: 9 },
      { formNumber: "FL-160", formName: "Property Declaration", category: "Financial", description: "Declaration of community and separate property for division", isRequired: false, requiredWhen: "property_division", displayOrder: 10 },
      { formNumber: "FL-170", formName: "Declaration for Default or Uncontested Dissolution", category: "Judgment", description: "Declaration in support of default or uncontested judgment", isRequired: false, requiredWhen: "uncontested", displayOrder: 11 },
      { formNumber: "FL-180", formName: "Judgment (Family Law)", category: "Judgment", description: "Final judgment of dissolution, legal separation, or nullity", isRequired: true, displayOrder: 12 },
      { formNumber: "FL-190", formName: "Notice of Entry of Judgment", category: "Judgment", description: "Notice that judgment has been entered", isRequired: true, displayOrder: 13 },
      { formNumber: "FL-300", formName: "Request for Order", category: "Motions", description: "Request for court orders regarding custody, support, or property", isRequired: false, filingFee: 60, displayOrder: 14 },
      { formNumber: "FL-311", formName: "Child Custody and Visitation Application Attachment", category: "Custody", description: "Attachment for custody and visitation requests", isRequired: false, requiredWhen: "children_involved", displayOrder: 15 },
      { formNumber: "FL-341", formName: "Child Custody and Visitation Order Attachment", category: "Custody", description: "Court order attachment for custody and visitation", isRequired: false, requiredWhen: "children_involved", displayOrder: 16 },
      { formNumber: "FL-342", formName: "Child Support Information and Order Attachment", category: "Financial", description: "Court order attachment for child support", isRequired: false, requiredWhen: "children_involved", displayOrder: 17 },
    ];
    for (const form of caFamilyForms) {
      await db.jurisdictionForm.create({
        data: { ...form, practiceAreaJurisdictionId: caFamily.id } as any,
      });
      formsCreated++;
    }

    // CA Family Law Deadlines
    const caFamilyDeadlines = [
      { name: "Response Due After Service", triggerEvent: "service_date", days: 30, calendarType: "CDT_CALENDAR" as any, statute: "CCP §412.20(a)(3)", isDefault: true, priority: "HIGH", category: "Response", notes: "Respondent has 30 days after service to file a response", displayOrder: 1 },
      { name: "Preliminary Declaration of Disclosure Due", triggerEvent: "filing_date", days: 60, calendarType: "CDT_CALENDAR" as any, statute: "Family Code §2104", isDefault: true, priority: "HIGH", category: "Financial", notes: "Must be served within 60 days of filing the petition", displayOrder: 2 },
      { name: "Final Declaration of Disclosure Due", triggerEvent: "filing_date", days: 0, calendarType: "CDT_CALENDAR" as any, statute: "Family Code §2105", isDefault: true, priority: "MEDIUM", category: "Financial", notes: "Must be served before or at time of entering agreement or trial. No fixed day count — depends on case progress.", displayOrder: 3 },
      { name: "Earliest Judgment Date (Cooling Off Period)", triggerEvent: "service_date", days: 180, calendarType: "CDT_CALENDAR" as any, statute: "Family Code §2339(a)", isDefault: true, priority: "MEDIUM", category: "Judgment", notes: "Judgment cannot be entered until 6 months from date of service of petition", displayOrder: 4 },
      { name: "Request for Order Hearing (Minimum Notice)", triggerEvent: "rfo_filed", days: 16, calendarType: "CDT_CALENDAR" as any, statute: "CCP §1005(b)", isDefault: true, priority: "HIGH", category: "Motions", notes: "Minimum 16 court days before hearing for noticed motion", displayOrder: 5 },
      { name: "Responsive Declaration Due", triggerEvent: "rfo_hearing", days: -9, calendarType: "CDT_CALENDAR" as any, statute: "Family Code §217", isDefault: true, priority: "HIGH", category: "Motions", notes: "Must be filed and served at least 9 court days before hearing", displayOrder: 6 },
      { name: "Mandatory Custody Mediation", triggerEvent: "custody_dispute_filed", days: 30, calendarType: "CDT_CALENDAR" as any, statute: "Family Code §3170", isDefault: true, priority: "HIGH", category: "Custody", notes: "Court must order mediation before custody hearing", displayOrder: 7 },
    ];
    for (const dl of caFamilyDeadlines) {
      await db.jurisdictionDeadline.create({
        data: { ...dl, practiceAreaJurisdictionId: caFamily.id },
      });
      deadlinesCreated++;
    }

    // ── Federal EDNY General Litigation Config ──
    const fedLit = await db.practiceAreaJurisdiction.create({
      data: {
        practiceArea: "general_litigation",
        jurisdictionId: fedEdny.id,
        displayName: "Federal - EDNY General Litigation",
        statuteReferences: JSON.stringify({ frcp: "Federal Rules of Civil Procedure", fre: "Federal Rules of Evidence", local_rules: "EDNY Local Civil Rules", title_28: "28 U.S.C." }),
        filingRequirements: JSON.stringify({ jurisdiction: "Federal question (28 USC §1331) or diversity (28 USC §1332)", amount_in_controversy: "$75,000+ for diversity", filing_location: "Brooklyn or Central Islip division", cover_sheet: "JS-44 Civil Cover Sheet required" }),
        courtRules: JSON.stringify({ initial_conference: "Rule 16 conference required", discovery_plan: "26(f) conference and discovery plan required", pretrial_order: "Final pretrial order required" }),
        terminologyMap: JSON.stringify({ complaint: "Complaint", discovery: "Discovery", deposition: "Deposition", interrogatories: "Interrogatories", summary_judgment: "Summary Judgment under FRCP Rule 56" }),
        serviceRules: JSON.stringify({ personal_service: "FRCP Rule 4", waiver_of_service: "Rule 4(d) waiver available", service_deadline: "90 days from filing" }),
        aiPromptContext: "Federal litigation in the Eastern District of New York. Governed by FRCP, FRE, and EDNY Local Rules. Mandatory initial disclosures under Rule 26(a). Discovery governed by Rules 26-37. Summary judgment under Rule 56. Trial procedures under Rules 38-53.",
      },
    });
    configsCreated++;

    // Federal EDNY Deadlines
    const fedEdnyDeadlines = [
      { name: "Service of Process Deadline", triggerEvent: "filing_date", days: 90, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 4(m)", isDefault: true, priority: "CRITICAL", category: "Service", notes: "Complaint must be served within 90 days of filing", displayOrder: 1 },
      { name: "Answer Due After Service", triggerEvent: "service_date", days: 21, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 12(a)(1)(A)(i)", isDefault: true, priority: "HIGH", category: "Response", notes: "Answer due 21 days after service of summons and complaint", displayOrder: 2 },
      { name: "Answer Due After Waiver of Service", triggerEvent: "waiver_sent", days: 60, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 4(d)(3)", isDefault: true, priority: "HIGH", category: "Response", notes: "60 days after waiver request sent (90 days if outside US)", displayOrder: 3 },
      { name: "Rule 12 Motion Deadline", triggerEvent: "service_date", days: 21, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 12(a)", isDefault: true, priority: "HIGH", category: "Motions", notes: "Rule 12(b) motions due before or with the answer", displayOrder: 4 },
      { name: "Rule 26(f) Conference", triggerEvent: "filing_date", days: 90, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 26(f)", isDefault: true, priority: "HIGH", category: "Discovery", notes: "Parties must confer at least 21 days before Rule 16 conference", displayOrder: 5 },
      { name: "Initial Disclosures Due", triggerEvent: "rule_26f_conference", days: 14, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 26(a)(1)", isDefault: true, priority: "HIGH", category: "Discovery", notes: "Due within 14 days after Rule 26(f) conference", displayOrder: 6 },
      { name: "Discovery Plan Due", triggerEvent: "rule_26f_conference", days: 14, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 26(f)(3)", isDefault: true, priority: "HIGH", category: "Discovery", notes: "Must be submitted within 14 days after Rule 26(f) conference", displayOrder: 7 },
      { name: "Summary Judgment Motion Deadline", triggerEvent: "discovery_end", days: 30, calendarType: "CDT_CALENDAR" as any, statute: "FRCP Rule 56 / Local Rule", isDefault: true, priority: "MEDIUM", category: "Motions", notes: "Typically 30 days after close of discovery per scheduling order", displayOrder: 8 },
      { name: "Pretrial Submissions Due", triggerEvent: "trial_date", days: -14, calendarType: "CDT_CALENDAR" as any, statute: "EDNY Local Rule 56.1", isDefault: true, priority: "HIGH", category: "Trial Prep", notes: "Pretrial memoranda and exhibits typically due 14 days before trial", displayOrder: 9 },
    ];
    for (const dl of fedEdnyDeadlines) {
      await db.jurisdictionDeadline.create({
        data: { ...dl, practiceAreaJurisdictionId: fedLit.id },
      });
      deadlinesCreated++;
    }

    return { profilesCreated, configsCreated, formsCreated, deadlinesCreated };
  }),
});
