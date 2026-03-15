import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  summarizeMedicalRecords,
  analyzeLienPositions,
  generateDemandLetter,
  calculateSettlementDistribution,
} from "@/lib/ai-medical";

export const medicalRecordsRouter = router({
  // ─── Providers ─────────────────────────────────────────────────

  listProviders: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }
      if (input?.type) {
        where.type = input.type;
      }
      const providers = await ctx.db.medicalProvider.findMany({
        where,
        include: { _count: { select: { records: true, liens: true } } },
        orderBy: { name: "asc" },
      });
      return providers;
    }),

  getProvider: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.medicalProvider.findUniqueOrThrow({
        where: { id: input.id },
        include: { records: { orderBy: { dateOfService: "desc" } }, liens: true },
      });
    }),

  createProvider: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["HOSPITAL", "ER", "PRIMARY_CARE", "SPECIALIST", "SURGEON", "CHIROPRACTOR", "PHYSICAL_THERAPY", "IMAGING", "PHARMACY", "AMBULANCE", "MENTAL_HEALTH", "OTHER"]),
        phone: z.string().optional(),
        fax: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        contactPerson: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.medicalProvider.create({ data: input });
    }),

  updateProvider: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        type: z.enum(["HOSPITAL", "ER", "PRIMARY_CARE", "SPECIALIST", "SURGEON", "CHIROPRACTOR", "PHYSICAL_THERAPY", "IMAGING", "PHARMACY", "AMBULANCE", "MENTAL_HEALTH", "OTHER"]).optional(),
        phone: z.string().optional(),
        fax: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        contactPerson: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.medicalProvider.update({ where: { id }, data });
    }),

  deleteProvider: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.medicalRecord.count({ where: { providerId: input.id } });
      if (count > 0) throw new Error("Cannot delete provider with linked records");
      return ctx.db.medicalProvider.delete({ where: { id: input.id } });
    }),

  // ─── Records ───────────────────────────────────────────────────

  listRecords: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.medicalRecord.findMany({
        where: { matterId: input.matterId },
        include: { provider: true },
        orderBy: { dateOfService: "asc" },
      });
    }),

  getRecord: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.medicalRecord.findUniqueOrThrow({
        where: { id: input.id },
        include: { provider: true },
      });
    }),

  createRecord: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        providerId: z.string().optional(),
        providerName: z.string().min(1),
        recordType: z.enum(["OFFICE_VISIT", "ER_VISIT", "HOSPITAL_ADMISSION", "SURGERY", "IMAGING", "LAB_WORK", "PHYSICAL_THERAPY", "PRESCRIPTION", "AMBULANCE", "MENTAL_HEALTH", "DENTAL", "OTHER"]),
        dateOfService: z.string().or(z.date()),
        endDate: z.string().or(z.date()).optional(),
        description: z.string().optional(),
        diagnosis: z.string().optional(),
        treatingPhysician: z.string().optional(),
        totalCharges: z.number().optional(),
        amountPaid: z.number().optional(),
        adjustments: z.number().optional(),
        outstandingBalance: z.number().optional(),
        requestStatus: z.enum(["NOT_REQUESTED", "REQUESTED", "RECEIVED", "REVIEWED", "SUMMARIZED"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.medicalRecord.create({
        data: {
          ...input,
          dateOfService: new Date(input.dateOfService),
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        },
      });
    }),

  updateRecord: publicProcedure
    .input(
      z.object({
        id: z.string(),
        providerId: z.string().optional().nullable(),
        providerName: z.string().optional(),
        recordType: z.enum(["OFFICE_VISIT", "ER_VISIT", "HOSPITAL_ADMISSION", "SURGERY", "IMAGING", "LAB_WORK", "PHYSICAL_THERAPY", "PRESCRIPTION", "AMBULANCE", "MENTAL_HEALTH", "DENTAL", "OTHER"]).optional(),
        dateOfService: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional().nullable(),
        description: z.string().optional(),
        diagnosis: z.string().optional(),
        treatingPhysician: z.string().optional(),
        totalCharges: z.number().optional().nullable(),
        amountPaid: z.number().optional().nullable(),
        adjustments: z.number().optional().nullable(),
        outstandingBalance: z.number().optional().nullable(),
        requestStatus: z.enum(["NOT_REQUESTED", "REQUESTED", "RECEIVED", "REVIEWED", "SUMMARIZED"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, dateOfService, endDate, ...rest } = input;
      const data: any = { ...rest };
      if (dateOfService) data.dateOfService = new Date(dateOfService);
      if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
      return ctx.db.medicalRecord.update({ where: { id }, data });
    }),

  deleteRecord: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.medicalRecord.delete({ where: { id: input.id } });
    }),

  updateRequestStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        requestStatus: z.enum(["NOT_REQUESTED", "REQUESTED", "RECEIVED", "REVIEWED", "SUMMARIZED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: any = { requestStatus: input.requestStatus };
      if (input.requestStatus === "REQUESTED") data.requestedAt = new Date();
      if (input.requestStatus === "RECEIVED") data.receivedAt = new Date();
      return ctx.db.medicalRecord.update({ where: { id: input.id }, data });
    }),

  bulkCreateRecords: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        records: z.array(
          z.object({
            providerId: z.string().optional(),
            providerName: z.string().min(1),
            recordType: z.enum(["OFFICE_VISIT", "ER_VISIT", "HOSPITAL_ADMISSION", "SURGERY", "IMAGING", "LAB_WORK", "PHYSICAL_THERAPY", "PRESCRIPTION", "AMBULANCE", "MENTAL_HEALTH", "DENTAL", "OTHER"]),
            dateOfService: z.string().or(z.date()),
            endDate: z.string().or(z.date()).optional(),
            description: z.string().optional(),
            diagnosis: z.string().optional(),
            treatingPhysician: z.string().optional(),
            totalCharges: z.number().optional(),
            amountPaid: z.number().optional(),
            adjustments: z.number().optional(),
            outstandingBalance: z.number().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.records.map((r) => ({
        ...r,
        matterId: input.matterId,
        dateOfService: new Date(r.dateOfService),
        endDate: r.endDate ? new Date(r.endDate) : undefined,
      }));
      return ctx.db.medicalRecord.createMany({ data });
    }),

  getRecordsSummary: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.medicalRecord.findMany({
        where: { matterId: input.matterId },
        include: { provider: true },
        orderBy: { dateOfService: "asc" },
      });

      let totalCharges = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;
      const byProvider: Record<string, { name: string; charges: number; count: number }> = {};

      for (const r of records) {
        const charges = Number(r.totalCharges || 0);
        const paid = Number(r.amountPaid || 0);
        const outstanding = Number(r.outstandingBalance || 0);
        totalCharges += charges;
        totalPaid += paid;
        totalOutstanding += outstanding;

        const pName = r.providerName;
        if (!byProvider[pName]) byProvider[pName] = { name: pName, charges: 0, count: 0 };
        byProvider[pName].charges += charges;
        byProvider[pName].count += 1;
      }

      return {
        totalRecords: records.length,
        totalCharges,
        totalPaid,
        totalOutstanding,
        byProvider: Object.values(byProvider),
        timeline: records.map((r) => ({
          id: r.id,
          date: r.dateOfService,
          provider: r.providerName,
          type: r.recordType,
          charges: Number(r.totalCharges || 0),
        })),
      };
    }),

  aiSummarize: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const records = await ctx.db.medicalRecord.findMany({
        where: { matterId: input.matterId },
        orderBy: { dateOfService: "asc" },
      });

      const summary = await summarizeMedicalRecords(
        records.map((r) => ({
          provider: r.providerName,
          type: r.recordType,
          date: r.dateOfService.toISOString().split("T")[0],
          description: r.description || undefined,
          diagnosis: r.diagnosis || undefined,
          charges: Number(r.totalCharges || 0),
        }))
      );

      await ctx.db.injuryCaseDetails.updateMany({
        where: { matterId: input.matterId },
        data: { aiSummary: JSON.stringify(summary) },
      });

      return summary;
    }),

  // ─── Liens ─────────────────────────────────────────────────────

  listLiens: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.medicalLien.findMany({
        where: { matterId: input.matterId },
        include: { provider: true },
        orderBy: { priority: "asc" },
      });
    }),

  getLien: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.medicalLien.findUniqueOrThrow({
        where: { id: input.id },
        include: { provider: true },
      });
    }),

  createLien: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        providerId: z.string().optional(),
        providerName: z.string().min(1),
        lienType: z.enum(["HOSPITAL", "MEDICAL_PROVIDER", "HEALTH_INSURANCE", "MEDICARE", "MEDICAID", "ERISA", "WORKERS_COMP", "CHILD_SUPPORT", "GOVERNMENT", "OTHER"]),
        originalAmount: z.number(),
        negotiatedAmount: z.number().optional(),
        paidAmount: z.number().optional(),
        status: z.enum(["PENDING", "VERIFIED", "NEGOTIATING", "AGREED", "PAID", "DISPUTED", "WAIVED"]).optional(),
        priority: z.number().optional(),
        lienHolderName: z.string().min(1),
        lienHolderContact: z.string().optional(),
        assertedDate: z.string().or(z.date()).optional(),
        dueDate: z.string().or(z.date()).optional(),
        lienLetterReceivedAt: z.string().or(z.date()).optional(),
        reductionPercentage: z.number().optional(),
        reductionNotes: z.string().optional(),
        documentId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { assertedDate, dueDate, lienLetterReceivedAt, ...rest } = input;
      return ctx.db.medicalLien.create({
        data: {
          ...rest,
          assertedDate: assertedDate ? new Date(assertedDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          lienLetterReceivedAt: lienLetterReceivedAt ? new Date(lienLetterReceivedAt) : undefined,
        },
      });
    }),

  updateLien: publicProcedure
    .input(
      z.object({
        id: z.string(),
        providerId: z.string().optional().nullable(),
        providerName: z.string().optional(),
        lienType: z.enum(["HOSPITAL", "MEDICAL_PROVIDER", "HEALTH_INSURANCE", "MEDICARE", "MEDICAID", "ERISA", "WORKERS_COMP", "CHILD_SUPPORT", "GOVERNMENT", "OTHER"]).optional(),
        originalAmount: z.number().optional(),
        negotiatedAmount: z.number().optional().nullable(),
        paidAmount: z.number().optional().nullable(),
        status: z.enum(["PENDING", "VERIFIED", "NEGOTIATING", "AGREED", "PAID", "DISPUTED", "WAIVED"]).optional(),
        priority: z.number().optional(),
        lienHolderName: z.string().optional(),
        lienHolderContact: z.string().optional().nullable(),
        assertedDate: z.string().or(z.date()).optional().nullable(),
        dueDate: z.string().or(z.date()).optional().nullable(),
        lienLetterReceivedAt: z.string().or(z.date()).optional().nullable(),
        reductionPercentage: z.number().optional().nullable(),
        reductionNotes: z.string().optional().nullable(),
        documentId: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, assertedDate, dueDate, lienLetterReceivedAt, ...rest } = input;
      const data: any = { ...rest };
      if (assertedDate !== undefined) data.assertedDate = assertedDate ? new Date(assertedDate) : null;
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
      if (lienLetterReceivedAt !== undefined) data.lienLetterReceivedAt = lienLetterReceivedAt ? new Date(lienLetterReceivedAt) : null;
      return ctx.db.medicalLien.update({ where: { id }, data });
    }),

  deleteLien: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.medicalLien.delete({ where: { id: input.id } });
    }),

  getLienSummary: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const liens = await ctx.db.medicalLien.findMany({ where: { matterId: input.matterId } });
      let totalOriginal = 0;
      let totalNegotiated = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      for (const l of liens) {
        const orig = Number(l.originalAmount || 0);
        const neg = Number(l.negotiatedAmount || orig);
        const paid = Number(l.paidAmount || 0);
        totalOriginal += orig;
        totalNegotiated += neg;
        totalPaid += paid;
        totalOutstanding += neg - paid;
      }

      return {
        totalOriginal,
        totalNegotiated,
        totalPaid,
        totalOutstanding,
        reductionPercentage: totalOriginal > 0 ? ((totalOriginal - totalNegotiated) / totalOriginal) * 100 : 0,
        count: liens.length,
      };
    }),

  aiNegotiationStrategy: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const liens = await ctx.db.medicalLien.findMany({ where: { matterId: input.matterId }, orderBy: { priority: "asc" } });
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });

      const settlementAmount = Number(caseDetails?.settlementAmount || caseDetails?.demandAmount || 0);
      const feePercentage = Number(caseDetails?.attorneyFeePercentage || 33.33);
      const attorneyFee = settlementAmount * (feePercentage / 100);

      return analyzeLienPositions(
        liens.map((l) => ({
          type: l.lienType,
          holder: l.lienHolderName,
          amount: Number(l.originalAmount),
          priority: l.priority,
        })),
        settlementAmount,
        attorneyFee,
        0
      );
    }),

  // ─── Case Details ──────────────────────────────────────────────

  getCaseDetails: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });
    }),

  createCaseDetails: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        dateOfIncident: z.string().or(z.date()),
        incidentType: z.enum(["AUTO_ACCIDENT", "SLIP_FALL", "MEDICAL_MALPRACTICE", "PRODUCT_LIABILITY", "WORK_INJURY", "DOG_BITE", "ASSAULT", "PREMISES_LIABILITY", "OTHER"]),
        incidentDescription: z.string().optional(),
        injuryDescription: z.string().optional(),
        liabilityAssessment: z.string().optional(),
        insuranceCompany: z.string().optional(),
        claimNumber: z.string().optional(),
        adjusterName: z.string().optional(),
        adjusterPhone: z.string().optional(),
        adjusterEmail: z.string().optional(),
        policyLimits: z.number().optional(),
        umUimLimits: z.number().optional(),
        attorneyFeePercentage: z.number().optional(),
        caseStatus: z.enum(["PRE_SUIT", "TREATMENT", "MAX_MEDICAL_IMPROVEMENT", "DEMAND_SENT", "NEGOTIATION", "LITIGATION", "MEDIATION", "TRIAL", "SETTLED", "CLOSED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.injuryCaseDetails.create({
        data: {
          ...input,
          dateOfIncident: new Date(input.dateOfIncident),
        },
      });
    }),

  updateCaseDetails: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        dateOfIncident: z.string().or(z.date()).optional(),
        incidentType: z.enum(["AUTO_ACCIDENT", "SLIP_FALL", "MEDICAL_MALPRACTICE", "PRODUCT_LIABILITY", "WORK_INJURY", "DOG_BITE", "ASSAULT", "PREMISES_LIABILITY", "OTHER"]).optional(),
        incidentDescription: z.string().optional().nullable(),
        injuryDescription: z.string().optional().nullable(),
        liabilityAssessment: z.string().optional().nullable(),
        insuranceCompany: z.string().optional().nullable(),
        claimNumber: z.string().optional().nullable(),
        adjusterName: z.string().optional().nullable(),
        adjusterPhone: z.string().optional().nullable(),
        adjusterEmail: z.string().optional().nullable(),
        policyLimits: z.number().optional().nullable(),
        umUimLimits: z.number().optional().nullable(),
        demandAmount: z.number().optional().nullable(),
        settlementAmount: z.number().optional().nullable(),
        attorneyFeePercentage: z.number().optional().nullable(),
        caseStatus: z.enum(["PRE_SUIT", "TREATMENT", "MAX_MEDICAL_IMPROVEMENT", "DEMAND_SENT", "NEGOTIATION", "LITIGATION", "MEDIATION", "TRIAL", "SETTLED", "CLOSED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { matterId, dateOfIncident, ...rest } = input;
      const data: any = { ...rest };
      if (dateOfIncident) data.dateOfIncident = new Date(dateOfIncident);
      return ctx.db.injuryCaseDetails.update({ where: { matterId }, data });
    }),

  calculateTotals: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const records = await ctx.db.medicalRecord.findMany({ where: { matterId: input.matterId } });
      const liens = await ctx.db.medicalLien.findMany({ where: { matterId: input.matterId } });

      const totalMedicalSpecials = records.reduce((sum, r) => sum + Number(r.totalCharges || 0), 0);
      const totalLienAmount = liens.reduce((sum, l) => sum + Number(l.negotiatedAmount || l.originalAmount || 0), 0);

      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });
      const feePercentage = Number(caseDetails?.attorneyFeePercentage || 0);
      const settlement = Number(caseDetails?.settlementAmount || 0);
      const attorneyFeeAmount = settlement * (feePercentage / 100);
      const netToClient = settlement - attorneyFeeAmount - totalLienAmount;

      return ctx.db.injuryCaseDetails.update({
        where: { matterId: input.matterId },
        data: { totalMedicalSpecials, totalLienAmount, attorneyFeeAmount, netToClient },
      });
    }),

  // ─── Settlement Distribution ───────────────────────────────────

  createDistribution: publicProcedure
    .input(z.object({ matterId: z.string(), settlementAmount: z.number(), costs: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });
      const liens = await ctx.db.medicalLien.findMany({ where: { matterId: input.matterId }, orderBy: { priority: "asc" } });

      const feePercentage = Number(caseDetails?.attorneyFeePercentage || 33.33);
      const costs = input.costs || 0;

      const result = await calculateSettlementDistribution(
        input.settlementAmount,
        feePercentage,
        costs,
        liens.map((l) => ({
          holder: l.lienHolderName,
          amount: Number(l.originalAmount),
          negotiatedAmount: l.negotiatedAmount ? Number(l.negotiatedAmount) : undefined,
        }))
      );

      return ctx.db.settlementDistribution.create({
        data: {
          matterId: input.matterId,
          settlementAmount: input.settlementAmount,
          lineItems: JSON.stringify(result.distribution),
          status: "DRAFT",
        },
      });
    }),

  getDistribution: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.settlementDistribution.findFirst({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
      });
    }),

  updateDistribution: publicProcedure
    .input(
      z.object({
        id: z.string(),
        lineItems: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.settlementDistribution.update({ where: { id }, data });
    }),

  approveDistribution: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.settlementDistribution.update({
        where: { id: input.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
    }),

  markDistributed: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.settlementDistribution.update({
        where: { id: input.id },
        data: { status: "DISTRIBUTED", distributedAt: new Date() },
      });
    }),

  // ─── Demand ────────────────────────────────────────────────────

  generateDemandLetter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({
        where: { matterId: input.matterId },
        include: { matter: { include: { client: true } } },
      });
      const records = await ctx.db.medicalRecord.findMany({
        where: { matterId: input.matterId },
        orderBy: { dateOfService: "asc" },
      });

      const totalSpecials = records.reduce((sum, r) => sum + Number(r.totalCharges || 0), 0);

      return generateDemandLetter(
        {
          incidentType: caseDetails?.incidentType,
          dateOfIncident: caseDetails?.dateOfIncident?.toISOString().split("T")[0],
          incidentDescription: caseDetails?.incidentDescription || undefined,
          injuryDescription: caseDetails?.injuryDescription || undefined,
          liabilityAssessment: caseDetails?.liabilityAssessment || undefined,
          insuranceCompany: caseDetails?.insuranceCompany || undefined,
          claimNumber: caseDetails?.claimNumber || undefined,
          policyLimits: caseDetails?.policyLimits ? Number(caseDetails.policyLimits) : undefined,
          clientName: caseDetails?.matter?.client?.name,
          matterName: caseDetails?.matter?.name,
        },
        records.map((r) => ({
          provider: r.providerName,
          type: r.recordType,
          date: r.dateOfService.toISOString().split("T")[0],
          description: r.description || undefined,
          diagnosis: r.diagnosis || undefined,
          charges: Number(r.totalCharges || 0),
        })),
        totalSpecials
      );
    }),

  // ─── Dashboard Queries ─────────────────────────────────────────

  listCases: publicProcedure.query(async ({ ctx }) => {
    const cases = await ctx.db.injuryCaseDetails.findMany({
      include: { matter: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
    });
    return cases;
  }),

  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const activeCases = await ctx.db.injuryCaseDetails.count({
      where: { caseStatus: { not: "CLOSED" } },
    });
    const totalSpecials = await ctx.db.injuryCaseDetails.aggregate({
      _sum: { totalMedicalSpecials: true },
    });
    const totalLiens = await ctx.db.injuryCaseDetails.aggregate({
      _sum: { totalLienAmount: true },
    });
    const pendingRequests = await ctx.db.medicalRecord.count({
      where: { requestStatus: "REQUESTED" },
    });
    return {
      activeCases,
      totalSpecials: Number(totalSpecials._sum.totalMedicalSpecials || 0),
      totalLiens: Number(totalLiens._sum.totalLienAmount || 0),
      pendingRequests,
    };
  }),
});
