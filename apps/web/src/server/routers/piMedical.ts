import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { chartsquadTestConnection, chartsquadSubmitRequest, chartsquadGetRequest } from "@/lib/integrations/chartsquad";
import { precedentTestConnection, precedentCreateDemand, precedentGetDemand, precedentDeliverDemand } from "@/lib/integrations/precedent";
import { autorequestTestConnection, autorequestSubmitRequest, autorequestGetRequest } from "@/lib/integrations/autorequest";

const PI_PROVIDERS = ["CHARTSQUAD", "PRECEDENT", "AUTOREQUEST"] as const;
function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const piMedicalRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.pImedIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(PI_PROVIDERS), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), firmId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), autoAttachToMatter: z.boolean().optional(), autoCreateChronology: z.boolean().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      return ctx.db.pImedIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(PI_PROVIDERS) }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { CHARTSQUAD: chartsquadTestConnection, PRECEDENT: precedentTestConnection, AUTOREQUEST: autorequestTestConnection };
      return (tests[input.provider] || (() => ({ success: false, error: "Unknown" })))();
    }),

  // ─── Record Requests ───────────────────────────────────────────
  "requests.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), providerName: z.string().optional(), providerType: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.providerName) where.providerName = { contains: input.providerName, mode: "insensitive" };
      if (input?.providerType) where.providerType = input.providerType;
      return ctx.db.medicalRecordRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),
  "requests.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.medicalRecordRequest.findUniqueOrThrow({ where: { id: input.id } })),
  "requests.create": publicProcedure
    .input(z.object({ matterId: z.string(), clientId: z.string(), patientName: z.string(), providerName: z.string(), providerType: z.string().default("PHYSICIAN"), providerAddress: z.string().optional(), providerPhone: z.string().optional(), providerFax: z.string().optional(), recordType: z.string().default("ALL_RECORDS"), dateRangeStart: z.string().optional(), dateRangeEnd: z.string().optional(), requestMethod: z.string().default("FAX"), rushRequested: z.boolean().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Try ChartSquad first, then AutoRequest
      let provider = "MANUAL";
      let externalId: string | undefined;
      let estimatedDate: string | undefined;

      const csResult = await chartsquadSubmitRequest({ patientName: input.patientName, providerName: input.providerName, providerFax: input.providerFax, recordType: input.recordType, dateRangeStart: input.dateRangeStart, dateRangeEnd: input.dateRangeEnd, rushRequested: input.rushRequested, notes: input.notes });
      if (csResult.success) {
        provider = "CHARTSQUAD";
        externalId = (csResult as any).data?.requestId;
        estimatedDate = (csResult as any).data?.estimatedCompletionDate;
      } else {
        const arResult = await autorequestSubmitRequest({ patientName: input.patientName, providerName: input.providerName, providerFax: input.providerFax, recordType: input.recordType, dateRangeStart: input.dateRangeStart, dateRangeEnd: input.dateRangeEnd, rushRequested: input.rushRequested });
        if (arResult.success) {
          provider = "AUTOREQUEST";
          externalId = (arResult as any).data?.requestId;
        }
      }

      // Add to provider directory
      await ctx.db.providerDirectory.upsert({
        where: { id: `dir_${input.providerName.toLowerCase().replace(/\s+/g, "_")}` },
        create: { name: input.providerName, providerType: input.providerType, address: input.providerAddress, phone: input.providerPhone, fax: input.providerFax, timesUsed: 1, lastUsed: new Date() },
        update: { timesUsed: { increment: 1 }, lastUsed: new Date() },
      }).catch(() => {});

      return ctx.db.medicalRecordRequest.create({
        data: {
          provider, matterId: input.matterId, clientId: input.clientId,
          patientName: input.patientName, providerName: input.providerName,
          providerType: input.providerType, providerAddress: input.providerAddress,
          providerPhone: input.providerPhone, providerFax: input.providerFax,
          recordType: input.recordType, requestMethod: input.requestMethod,
          dateRangeStart: input.dateRangeStart ? new Date(input.dateRangeStart) : undefined,
          dateRangeEnd: input.dateRangeEnd ? new Date(input.dateRangeEnd) : undefined,
          rushRequested: input.rushRequested || false, notes: input.notes,
          externalRequestId: externalId,
          estimatedCompletionDate: estimatedDate ? new Date(estimatedDate) : undefined,
          status: provider !== "MANUAL" ? "SUBMITTED" : "DRAFT",
          submittedDate: provider !== "MANUAL" ? new Date() : undefined,
        },
      });
    }),
  "requests.cancel": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.medicalRecordRequest.update({ where: { id: input.id }, data: { status: "CANCELLED" } })),
  "requests.markReceived": publicProcedure
    .input(z.object({ id: z.string(), pageCount: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.medicalRecordRequest.update({ where: { id: input.id }, data: { status: "RECEIVED", receivedDate: new Date(), pageCount: input.pageCount } })),

  // ─── Medical Bills ─────────────────────────────────────────────
  "bills.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), lienType: z.string().optional(), limit: z.number().default(100) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.lienType) where.lienType = input.lienType;
      return ctx.db.medicalBill.findMany({ where, orderBy: { serviceDate: "desc" }, take: input?.limit || 100 });
    }),
  "bills.create": publicProcedure
    .input(z.object({ matterId: z.string(), clientId: z.string(), providerName: z.string(), providerType: z.string().default("PHYSICIAN"), serviceDate: z.string().optional(), description: z.string(), chargedAmount: z.number(), adjustments: z.number().optional(), insurancePaid: z.number().optional(), patientPaid: z.number().optional(), outstandingBalance: z.number().optional(), lienAmount: z.number().optional(), lienType: z.string().optional(), cptCode: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.medicalBill.create({ data: { ...input, serviceDate: input.serviceDate ? new Date(input.serviceDate) : undefined } })),
  "bills.update": publicProcedure
    .input(z.object({ id: z.string(), negotiatedAmount: z.number().optional().nullable(), lienStatus: z.string().optional(), isPaid: z.boolean().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.medicalBill.update({ where: { id }, data }); }),
  "bills.calculateSpecials": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bills = await ctx.db.medicalBill.findMany({ where: { matterId: input.matterId } });
      const totalCharged = bills.reduce((s, b) => s + Number(b.chargedAmount), 0);
      const totalAdjustments = bills.reduce((s, b) => s + Number(b.adjustments), 0);
      const totalInsurance = bills.reduce((s, b) => s + Number(b.insurancePaid), 0);
      const totalPatient = bills.reduce((s, b) => s + Number(b.patientPaid), 0);
      const totalOutstanding = bills.reduce((s, b) => s + Number(b.outstandingBalance), 0);
      const totalLiens = bills.filter((b) => b.lienAmount).reduce((s, b) => s + Number(b.lienAmount || 0), 0);
      const totalNegotiated = bills.filter((b) => b.negotiatedAmount).reduce((s, b) => s + Number(b.negotiatedAmount || 0), 0);
      const byProvider: Record<string, number> = {};
      for (const b of bills) byProvider[b.providerName] = (byProvider[b.providerName] || 0) + Number(b.chargedAmount);
      return { totalCharged, totalAdjustments, totalInsurance, totalPatient, totalOutstanding, totalLiens, totalNegotiated, netSpecials: totalCharged - totalAdjustments, byProvider, billCount: bills.length };
    }),

  // ─── Chronology ────────────────────────────────────────────────
  "chronology.get": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.medicalChronology.findFirst({ where: { matterId: input.matterId }, orderBy: { lastUpdated: "desc" } })),
  "chronology.build": publicProcedure
    .input(z.object({ matterId: z.string(), clientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bills = await ctx.db.medicalBill.findMany({ where: { matterId: input.matterId }, orderBy: { serviceDate: "asc" } });
      const entries = bills.filter((b) => b.serviceDate).map((b) => ({
        date: b.serviceDate!.toISOString().split("T")[0], provider: b.providerName, providerType: b.providerType,
        description: b.description, significance: "routine", diagnoses: b.icdCodes ? JSON.parse(b.icdCodes) : [], source: "bill_import",
      }));

      const providers = new Set(bills.map((b) => b.providerName));
      const dates = bills.filter((b) => b.serviceDate).map((b) => b.serviceDate!);
      const startDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : undefined;
      const endDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;

      return ctx.db.medicalChronology.upsert({
        where: { id: `chrono_${input.matterId}` },
        create: { matterId: input.matterId, clientId: input.clientId, entries: JSON.stringify(entries), totalProviders: providers.size, totalVisits: entries.length, dateRangeStart: startDate, dateRangeEnd: endDate, lastUpdated: new Date() },
        update: { entries: JSON.stringify(entries), totalProviders: providers.size, totalVisits: entries.length, dateRangeStart: startDate, dateRangeEnd: endDate, lastUpdated: new Date(), status: "IN_PROGRESS" },
      }).catch(async () => {
        return ctx.db.medicalChronology.create({
          data: { matterId: input.matterId, clientId: input.clientId, entries: JSON.stringify(entries), totalProviders: providers.size, totalVisits: entries.length, dateRangeStart: startDate, dateRangeEnd: endDate, lastUpdated: new Date() },
        });
      });
    }),

  // ─── Demand Packages ───────────────────────────────────────────
  "demands.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      return ctx.db.demandPackage.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),
  "demands.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.demandPackage.findUniqueOrThrow({ where: { id: input.id } })),
  "demands.create": publicProcedure
    .input(z.object({ matterId: z.string(), clientId: z.string(), insurerName: z.string(), insurerAddress: z.string().optional(), adjustorName: z.string().optional(), adjustorEmail: z.string().optional(), claimNumber: z.string().optional(), policyNumber: z.string().optional(), policyLimits: z.number().optional(), demandAmount: z.number().optional(), incidentDate: z.string().optional(), incidentDescription: z.string().optional(), liabilityTheory: z.string().optional(), injuryDescription: z.string().optional(), lostWages: z.number().optional(), multiplier: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Calculate totals
      const bills = await ctx.db.medicalBill.findMany({ where: { matterId: input.matterId } });
      const specialDamages = bills.reduce((s, b) => s + Number(b.chargedAmount) - Number(b.adjustments), 0) + (input.lostWages || 0);
      const mult = input.multiplier || 3;
      const generalDamages = specialDamages * mult;
      const totalDamages = specialDamages + generalDamages;

      // Try Precedent
      let provider: string | null = null;
      let externalId: string | undefined;
      const prResult = await precedentCreateDemand({ clientName: "Client", incidentDate: input.incidentDate || "", incidentDescription: input.incidentDescription || "", medicalBills: bills.map((b) => ({ provider: b.providerName, date: b.serviceDate?.toISOString().split("T")[0], amount: Number(b.chargedAmount), description: b.description })), demandAmount: input.demandAmount || totalDamages, jurisdiction: "General", insurer: input.insurerName, claimNumber: input.claimNumber });
      if (prResult.success) { provider = "PRECEDENT"; externalId = (prResult as any).data?.demandId; }

      return ctx.db.demandPackage.create({
        data: {
          provider, externalDemandId: externalId, matterId: input.matterId, clientId: input.clientId,
          insurerName: input.insurerName, insurerAddress: input.insurerAddress,
          adjustorName: input.adjustorName, adjustorEmail: input.adjustorEmail,
          claimNumber: input.claimNumber, policyNumber: input.policyNumber, policyLimits: input.policyLimits,
          demandAmount: input.demandAmount || totalDamages,
          incidentDate: input.incidentDate ? new Date(input.incidentDate) : undefined,
          incidentDescription: input.incidentDescription, liabilityTheory: input.liabilityTheory,
          injuryDescription: input.injuryDescription, lostWages: input.lostWages,
          specialDamagesTotal: specialDamages, generalDamagesTotal: generalDamages,
          totalDamages, multiplier: mult, notes: input.notes,
          status: provider ? "IN_PROGRESS" : "DRAFT",
        },
      });
    }),
  "demands.deliver": publicProcedure
    .input(z.object({ id: z.string(), method: z.string(), recipientEmail: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const demand = await ctx.db.demandPackage.findUniqueOrThrow({ where: { id: input.id } });
      if (demand.externalDemandId && demand.provider === "PRECEDENT") {
        await precedentDeliverDemand(demand.externalDemandId, { method: input.method, recipientEmail: input.recipientEmail });
      }
      const responseDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return ctx.db.demandPackage.update({ where: { id: input.id }, data: { status: "SENT", deliveryMethod: input.method, sentDate: new Date(), responseDeadline } });
    }),
  "demands.recordCounter": publicProcedure
    .input(z.object({ id: z.string(), amount: z.number(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const demand = await ctx.db.demandPackage.findUniqueOrThrow({ where: { id: input.id } });
      const log = demand.negotiationLog ? JSON.parse(demand.negotiationLog) : [];
      log.push({ date: new Date().toISOString(), type: "counter", amount: input.amount, description: input.notes || "Counter-offer received" });
      return ctx.db.demandPackage.update({ where: { id: input.id }, data: { counterOfferAmount: input.amount, status: "COUNTER_RECEIVED", negotiationLog: JSON.stringify(log) } });
    }),

  // ─── Provider Directory ────────────────────────────────────────
  "providers.list": publicProcedure
    .input(z.object({ providerType: z.string().optional(), city: z.string().optional(), state: z.string().optional(), search: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };
      if (input?.providerType) where.providerType = input.providerType;
      if (input?.city) where.city = { contains: input.city, mode: "insensitive" };
      if (input?.state) where.state = input.state;
      if (input?.search) where.name = { contains: input.search, mode: "insensitive" };
      return ctx.db.providerDirectory.findMany({ where, orderBy: { timesUsed: "desc" }, take: input?.limit || 50 });
    }),
  "providers.create": publicProcedure
    .input(z.object({ name: z.string(), providerType: z.string(), specialty: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), phone: z.string().optional(), fax: z.string().optional(), email: z.string().optional(), contactPerson: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.providerDirectory.create({ data: input })),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeRequests = await ctx.db.medicalRecordRequest.count({ where: { status: { notIn: ["RECEIVED", "CANCELLED", "REJECTED"] } } });
    const receivedMonth = await ctx.db.medicalRecordRequest.count({ where: { status: "RECEIVED", receivedDate: { gte: monthStart } } });
    const allBills = await ctx.db.medicalBill.findMany();
    const totalSpecials = allBills.reduce((s, b) => s + Number(b.chargedAmount) - Number(b.adjustments), 0);
    const totalLiens = allBills.filter((b) => b.lienAmount).reduce((s, b) => s + Number(b.lienAmount || 0), 0);
    const activeDemands = await ctx.db.demandPackage.count({ where: { status: { notIn: ["SETTLED", "REJECTED", "LITIGATION"] } } });

    const completed = await ctx.db.medicalRecordRequest.findMany({ where: { status: "RECEIVED", submittedDate: { not: null }, receivedDate: { not: null } } });
    const avgDays = completed.length > 0 ? completed.reduce((s, r) => s + Math.floor((r.receivedDate!.getTime() - r.submittedDate!.getTime()) / (1000 * 60 * 60 * 24)), 0) / completed.length : 0;

    return { activeRequests, receivedMonth, totalSpecials, totalLiens, activeDemands, avgDaysToReceive: Math.round(avgDays) };
  }),
});
