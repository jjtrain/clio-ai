import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as legl from "@/lib/integrations/legl";
import * as engine from "@/lib/compliance-engine";

const COMPLIANCE_PROVIDER = ["LEGL"] as const;
const COMPLIANCE_CHECK_TYPE = ["KYC", "AML", "SANCTIONS", "PEP", "ADVERSE_MEDIA", "SOURCE_OF_FUNDS", "SOURCE_OF_WEALTH", "DOCUMENT_VERIFICATION", "ENHANCED_DUE_DILIGENCE", "ONGOING_MONITORING", "FULL_CDD"] as const;
const COMPLIANCE_CHECK_STATUS = ["NOT_STARTED", "PENDING_CLIENT", "IN_PROGRESS", "AWAITING_DOCUMENTS", "UNDER_REVIEW", "PASSED", "FAILED", "REFERRED", "EXPIRED", "CANCELLED"] as const;
const COMPLIANCE_RISK_LEVEL = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH", "PROHIBITED"] as const;
const COMPLIANCE_SUBJECT_TYPE = ["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP", "OTHER"] as const;
const COMPLIANCE_MATCH_RESULT = ["CLEAR", "POTENTIAL_MATCH", "CONFIRMED_MATCH"] as const;
const COMPLIANCE_DOC_TYPE = ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID", "UTILITY_BILL", "BANK_STATEMENT", "TAX_RETURN", "COMPANY_REGISTRATION", "ARTICLES_OF_INCORPORATION", "TRUST_DEED", "PARTNERSHIP_AGREEMENT", "SOURCE_OF_FUNDS_EVIDENCE", "SOURCE_OF_WEALTH_EVIDENCE", "PROOF_OF_ADDRESS", "SELFIE", "OTHER"] as const;
const COMPLIANCE_DOC_STATUS = ["PENDING", "SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED", "EXPIRED"] as const;
const COMPLIANCE_ACTIVITY_TYPE = ["CHECK_INITIATED", "CLIENT_NOTIFIED", "DOCUMENTS_REQUESTED", "DOCUMENT_SUBMITTED", "DOCUMENT_VERIFIED", "DOCUMENT_REJECTED", "SANCTIONS_CLEAR", "SANCTIONS_MATCH", "PEP_CLEAR", "PEP_MATCH", "ADVERSE_MEDIA_CLEAR", "ADVERSE_MEDIA_MATCH", "RISK_ASSESSED", "EDD_REQUIRED", "EDD_COMPLETED", "REVIEW_STARTED", "APPROVED", "FAILED", "REFERRED", "EXPIRED", "RENEWED", "MONITORING_ALERT", "NOTE_ADDED", "STATUS_CHANGED"] as const;
const COMPLIANCE_REPORT_TYPE = ["FIRM_OVERVIEW", "CLIENT_RISK_REGISTER", "EXPIRED_CHECKS", "MONITORING_SUMMARY", "AUDIT_LOG", "SAR_REPORT", "ANNUAL_REVIEW"] as const;

export const complianceRouter = router({
  // ─── Settings ──────────────────────────────────────────────
  "settings.get": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.complianceIntegration.findUnique({ where: { provider: "LEGL" } });
  }),

  "settings.update": publicProcedure
    .input(z.object({
      displayName: z.string().optional(),
      apiKey: z.string().nullable().optional(),
      apiSecret: z.string().nullable().optional(),
      baseUrl: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      firmId: z.string().nullable().optional(),
      accessToken: z.string().nullable().optional(),
      refreshToken: z.string().nullable().optional(),
      webhookUrl: z.string().nullable().optional(),
      webhookSecret: z.string().nullable().optional(),
      isEnabled: z.boolean().optional(),
      autoRunOnNewClient: z.boolean().optional(),
      autoRunOnNewMatter: z.boolean().optional(),
      requireApprovalBeforeMatterStart: z.boolean().optional(),
      defaultRiskThreshold: z.enum(COMPLIANCE_RISK_LEVEL).optional(),
      retentionPeriod: z.number().optional(),
      sanctionsCheckEnabled: z.boolean().optional(),
      pepCheckEnabled: z.boolean().optional(),
      adverseMediaCheckEnabled: z.boolean().optional(),
      documentVerificationEnabled: z.boolean().optional(),
      sourceOfFundsRequired: z.boolean().optional(),
      sourceOfWealthRequired: z.boolean().optional(),
      ongoingMonitoringEnabled: z.boolean().optional(),
      monitoringFrequency: z.string().nullable().optional(),
      settings: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.complianceIntegration.upsert({
        where: { provider: "LEGL" },
        create: { provider: "LEGL", displayName: input.displayName || "Legl", ...input },
        update: input,
      });
    }),

  "settings.test": publicProcedure.mutation(async () => {
    return legl.testConnection();
  }),

  "settings.getHighRiskCountries": publicProcedure.query(async () => {
    return engine.getHighRiskCountries();
  }),

  // ─── Checks ────────────────────────────────────────────────
  "checks.list": publicProcedure
    .input(z.object({
      clientId: z.string().optional(),
      matterId: z.string().optional(),
      status: z.enum(COMPLIANCE_CHECK_STATUS).optional(),
      checkType: z.enum(COMPLIANCE_CHECK_TYPE).optional(),
      overallRiskLevel: z.enum(COMPLIANCE_RISK_LEVEL).optional(),
      provider: z.enum(COMPLIANCE_PROVIDER).optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.checkType) where.checkType = input.checkType;
      if (input?.overallRiskLevel) where.overallRiskLevel = input.overallRiskLevel;
      if (input?.provider) where.provider = input.provider;
      if (input?.search) where.subjectName = { contains: input.search, mode: "insensitive" };
      return ctx.db.complianceCheck.findMany({
        where,
        include: { client: true, matter: true },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 50,
      });
    }),

  "checks.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.complianceCheck.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          documents: true,
          activities: { orderBy: { createdAt: "desc" } },
          client: true,
          matter: true,
        },
      });
    }),

  "checks.initiate": publicProcedure
    .input(z.object({
      clientId: z.string(),
      matterId: z.string().optional(),
      checkType: z.enum(COMPLIANCE_CHECK_TYPE),
      subjectType: z.enum(COMPLIANCE_SUBJECT_TYPE).default("INDIVIDUAL"),
      subjectName: z.string(),
      subjectEmail: z.string().optional(),
      subjectPhone: z.string().optional(),
      subjectDOB: z.string().optional(),
      subjectNationality: z.string().optional(),
      subjectAddress: z.string().optional(),
      subjectIdType: z.string().optional(),
      subjectIdNumber: z.string().optional(),
      companyName: z.string().optional(),
      companyRegistrationNumber: z.string().optional(),
      companyJurisdiction: z.string().optional(),
      companyType: z.string().optional(),
      beneficialOwners: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await legl.initiateCheck({
        subjectType: input.subjectType, name: input.subjectName, email: input.subjectEmail || "",
        phone: input.subjectPhone, dob: input.subjectDOB, nationality: input.subjectNationality,
        address: input.subjectAddress, companyName: input.companyName,
        companyRegistrationNumber: input.companyRegistrationNumber, companyJurisdiction: input.companyJurisdiction,
        checkTypes: [input.checkType], matterId: input.matterId,
      });
      const check = await ctx.db.complianceCheck.create({
        data: {
          provider: "LEGL",
          externalCheckId: result.success ? result.checkId : null,
          clientId: input.clientId,
          matterId: input.matterId,
          checkType: input.checkType,
          status: "IN_PROGRESS",
          subjectType: input.subjectType,
          subjectName: input.subjectName,
          subjectEmail: input.subjectEmail,
          subjectPhone: input.subjectPhone,
          subjectDOB: input.subjectDOB ? new Date(input.subjectDOB) : null,
          subjectNationality: input.subjectNationality,
          subjectAddress: input.subjectAddress,
          subjectIdType: input.subjectIdType,
          subjectIdNumber: input.subjectIdNumber,
          companyName: input.companyName,
          companyRegistrationNumber: input.companyRegistrationNumber,
          companyJurisdiction: input.companyJurisdiction,
          companyType: input.companyType,
          beneficialOwners: input.beneficialOwners,
          rawPayload: result.success ? JSON.stringify(result) : null,
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: check.id,
          activityType: "CHECK_INITIATED",
          description: `${input.checkType} check initiated for ${input.subjectName}`,
        },
      });
      return check;
    }),

  "checks.initiateForLead": publicProcedure
    .input(z.object({
      leadId: z.string(),
      clientId: z.string(),
      checkType: z.enum(COMPLIANCE_CHECK_TYPE),
      subjectName: z.string(),
      subjectEmail: z.string().optional(),
      subjectPhone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await legl.initiateCheck({
        subjectType: "INDIVIDUAL", name: input.subjectName, email: input.subjectEmail || "",
        phone: input.subjectPhone, checkTypes: [input.checkType],
      });
      const check = await ctx.db.complianceCheck.create({
        data: {
          provider: "LEGL",
          externalCheckId: result.success ? result.checkId : null,
          clientId: input.clientId,
          leadId: input.leadId,
          checkType: input.checkType,
          status: "IN_PROGRESS",
          subjectName: input.subjectName,
          subjectEmail: input.subjectEmail,
          subjectPhone: input.subjectPhone,
          rawPayload: result.success ? JSON.stringify(result) : null,
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: check.id,
          activityType: "CHECK_INITIATED",
          description: `${input.checkType} check initiated for lead ${input.subjectName}`,
        },
      });
      return check;
    }),

  "checks.update": publicProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(COMPLIANCE_CHECK_STATUS).optional(),
      overallRiskLevel: z.enum(COMPLIANCE_RISK_LEVEL).optional(),
      riskScore: z.number().optional(),
      sanctionsResult: z.enum(COMPLIANCE_MATCH_RESULT).optional(),
      sanctionsMatches: z.string().optional(),
      pepResult: z.enum(COMPLIANCE_MATCH_RESULT).optional(),
      pepMatches: z.string().optional(),
      adverseMediaResult: z.enum(COMPLIANCE_MATCH_RESULT).optional(),
      adverseMediaMatches: z.string().optional(),
      documentVerificationResult: z.string().optional(),
      sourceOfFundsResult: z.string().optional(),
      sourceOfWealthResult: z.string().optional(),
      enhancedDueDiligenceRequired: z.boolean().optional(),
      eddReason: z.string().optional(),
      eddNotes: z.string().optional(),
      reviewNotes: z.string().optional(),
      decisionReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const check = await ctx.db.complianceCheck.update({ where: { id }, data });
      if (input.status) {
        await ctx.db.complianceActivity.create({
          data: {
            checkId: id,
            activityType: "STATUS_CHANGED",
            description: `Check status updated to ${input.status}`,
          },
        });
      }
      return check;
    }),

  "checks.cancel": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().default("Cancelled by user") }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.id } });
      if (check.externalCheckId) {
        await legl.cancelCheck(check.externalCheckId, input.reason);
      }
      const updated = await ctx.db.complianceCheck.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.id,
          activityType: "STATUS_CHANGED",
          description: "Check cancelled",
        },
      });
      return updated;
    }),

  "checks.approve": publicProcedure
    .input(z.object({ id: z.string(), approvedBy: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      const check = await ctx.db.complianceCheck.update({
        where: { id: input.id },
        data: {
          status: "PASSED",
          approvedBy: input.approvedBy,
          approvedAt: now,
          expiresAt,
          reviewNotes: input.notes,
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.id,
          activityType: "APPROVED",
          description: `Check approved by ${input.approvedBy}. Expires ${expiresAt.toISOString().split("T")[0]}.`,
          performedBy: input.approvedBy,
        },
      });
      return check;
    }),

  "checks.reject": publicProcedure
    .input(z.object({ id: z.string(), rejectedBy: z.string(), decisionReason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.update({
        where: { id: input.id },
        data: {
          status: "FAILED",
          decisionReason: input.decisionReason,
          reviewedBy: input.rejectedBy,
          reviewedAt: new Date(),
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.id,
          activityType: "FAILED",
          description: `Check rejected by ${input.rejectedBy}: ${input.decisionReason}`,
          performedBy: input.rejectedBy,
        },
      });
      return check;
    }),

  "checks.refer": publicProcedure
    .input(z.object({ id: z.string(), referredBy: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.update({
        where: { id: input.id },
        data: {
          status: "REFERRED",
          decisionReason: input.reason,
          reviewedBy: input.referredBy,
          reviewedAt: new Date(),
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.id,
          activityType: "REFERRED",
          description: `Check referred by ${input.referredBy}: ${input.reason}`,
          performedBy: input.referredBy,
        },
      });
      return check;
    }),

  "checks.renew": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.id } });
      const result = await legl.initiateCheck({
        subjectType: existing.subjectType, name: existing.subjectName,
        email: existing.subjectEmail || "", phone: existing.subjectPhone || undefined,
        nationality: existing.subjectNationality || undefined, address: existing.subjectAddress || undefined,
        companyName: existing.companyName || undefined, companyRegistrationNumber: existing.companyRegistrationNumber || undefined,
        companyJurisdiction: existing.companyJurisdiction || undefined,
        checkTypes: [existing.checkType],
      });
      const renewed = await ctx.db.complianceCheck.create({
        data: {
          provider: existing.provider,
          externalCheckId: result.success ? result.checkId : null,
          clientId: existing.clientId,
          matterId: existing.matterId,
          checkType: existing.checkType,
          status: "IN_PROGRESS",
          subjectType: existing.subjectType,
          subjectName: existing.subjectName,
          subjectEmail: existing.subjectEmail,
          subjectPhone: existing.subjectPhone,
          subjectDOB: existing.subjectDOB,
          subjectNationality: existing.subjectNationality,
          subjectAddress: existing.subjectAddress,
          subjectIdType: existing.subjectIdType,
          subjectIdNumber: existing.subjectIdNumber,
          companyName: existing.companyName,
          companyRegistrationNumber: existing.companyRegistrationNumber,
          companyJurisdiction: existing.companyJurisdiction,
          companyType: existing.companyType,
          beneficialOwners: existing.beneficialOwners,
          rawPayload: result.success ? JSON.stringify(result) : null,
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: renewed.id,
          activityType: "RENEWED",
          description: `Renewal of check ${input.id}`,
        },
      });
      // Mark old check as expired
      await ctx.db.complianceCheck.update({
        where: { id: input.id },
        data: { status: "EXPIRED" },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.id,
          activityType: "EXPIRED",
          description: `Check expired — renewed as ${renewed.id}`,
        },
      });
      return renewed;
    }),

  "checks.getStatus": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.id } });
      if (check.externalCheckId) {
        const remote = await legl.getCheck(check.externalCheckId);
        return { local: check.status, remote: remote.success ? remote.data : null };
      }
      return { local: check.status, remote: null };
    }),

  "checks.getMatterGate": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.db.complianceIntegration.findUnique({ where: { provider: "LEGL" } });
      const checks = await ctx.db.complianceCheck.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
      });
      const requireApproval = settings?.requireApprovalBeforeMatterStart ?? true;
      const hasPassedCheck = checks.some((c) => c.status === "PASSED" && (!c.expiresAt || c.expiresAt > new Date()));
      const hasPendingCheck = checks.some((c) => ["IN_PROGRESS", "PENDING_CLIENT", "AWAITING_DOCUMENTS", "UNDER_REVIEW"].includes(c.status));
      const hasFailedCheck = checks.some((c) => c.status === "FAILED");
      return {
        requireApproval,
        canProceed: !requireApproval || hasPassedCheck,
        hasPassedCheck,
        hasPendingCheck,
        hasFailedCheck,
        checks,
      };
    }),

  "checks.resendNotification": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.id } });
      if (check.externalCheckId) {
        const result = await legl.resendClientNotification(check.externalCheckId);
        await ctx.db.complianceActivity.create({
          data: {
            checkId: input.id,
            activityType: "CLIENT_NOTIFIED",
            description: "Client notification resent",
          },
        });
        return result;
      }
      throw new Error("No external check linked — cannot resend notification");
    }),

  "checks.getPortalLink": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.id } });
      if (check.clientPortalUrl) return { url: check.clientPortalUrl };
      if (check.externalCheckId) {
        const result = await legl.generateClientPortalLink(check.externalCheckId);
        if (result.success && result.data?.url) {
          await ctx.db.complianceCheck.update({ where: { id: input.id }, data: { clientPortalUrl: result.data.url } });
          return { url: result.data.url };
        }
      }
      return { url: null };
    }),

  "checks.getRiskAssessment": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.id } });
      if (check.aiRiskAssessment) return JSON.parse(check.aiRiskAssessment);
      const assessment = engine.calculateRiskScore(check);
      await ctx.db.complianceCheck.update({ where: { id: input.id }, data: { riskScore: assessment.score, overallRiskLevel: assessment.riskLevel as any, aiRiskAssessment: JSON.stringify(assessment) } });
      return assessment;
    }),

  "checks.generateRiskNarrative": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return engine.generateRiskNarrative(input.id);
    }),

  // ─── Screening Results ─────────────────────────────────────
  "sanctions.getResults": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      return {
        result: check.sanctionsResult,
        matches: check.sanctionsMatches ? JSON.parse(check.sanctionsMatches) : [],
      };
    }),

  "sanctions.resolveMatch": publicProcedure
    .input(z.object({ checkId: z.string(), matchId: z.string(), resolution: z.enum(COMPLIANCE_MATCH_RESULT), notes: z.string().optional(), resolvedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      const matches = check.sanctionsMatches ? JSON.parse(check.sanctionsMatches) : [];
      const updated = matches.map((m: any) =>
        m.id === input.matchId ? { ...m, resolution: input.resolution, resolvedBy: input.resolvedBy, resolvedAt: new Date().toISOString(), notes: input.notes } : m
      );
      await ctx.db.complianceCheck.update({ where: { id: input.checkId }, data: { sanctionsMatches: JSON.stringify(updated) } });
      const activityType = input.resolution === "CONFIRMED_MATCH" ? "SANCTIONS_MATCH" : "SANCTIONS_CLEAR";
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType,
          description: `Sanctions match ${input.matchId} resolved as ${input.resolution} by ${input.resolvedBy}`,
          performedBy: input.resolvedBy,
        },
      });
      return updated;
    }),

  "pep.getResults": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      return {
        result: check.pepResult,
        matches: check.pepMatches ? JSON.parse(check.pepMatches) : [],
      };
    }),

  "pep.resolveMatch": publicProcedure
    .input(z.object({ checkId: z.string(), matchId: z.string(), resolution: z.enum(COMPLIANCE_MATCH_RESULT), notes: z.string().optional(), resolvedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      const matches = check.pepMatches ? JSON.parse(check.pepMatches) : [];
      const updated = matches.map((m: any) =>
        m.id === input.matchId ? { ...m, resolution: input.resolution, resolvedBy: input.resolvedBy, resolvedAt: new Date().toISOString(), notes: input.notes } : m
      );
      await ctx.db.complianceCheck.update({ where: { id: input.checkId }, data: { pepMatches: JSON.stringify(updated) } });
      const activityType = input.resolution === "CONFIRMED_MATCH" ? "PEP_MATCH" : "PEP_CLEAR";
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType,
          description: `PEP match ${input.matchId} resolved as ${input.resolution} by ${input.resolvedBy}`,
          performedBy: input.resolvedBy,
        },
      });
      return updated;
    }),

  "adverseMedia.getResults": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      return {
        result: check.adverseMediaResult,
        matches: check.adverseMediaMatches ? JSON.parse(check.adverseMediaMatches) : [],
      };
    }),

  "adverseMedia.resolveMatch": publicProcedure
    .input(z.object({ checkId: z.string(), matchId: z.string(), resolution: z.enum(COMPLIANCE_MATCH_RESULT), notes: z.string().optional(), resolvedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      const matches = check.adverseMediaMatches ? JSON.parse(check.adverseMediaMatches) : [];
      const updated = matches.map((m: any) =>
        m.id === input.matchId ? { ...m, resolution: input.resolution, resolvedBy: input.resolvedBy, resolvedAt: new Date().toISOString(), notes: input.notes } : m
      );
      await ctx.db.complianceCheck.update({ where: { id: input.checkId }, data: { adverseMediaMatches: JSON.stringify(updated) } });
      const activityType = input.resolution === "CONFIRMED_MATCH" ? "ADVERSE_MEDIA_MATCH" : "ADVERSE_MEDIA_CLEAR";
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType,
          description: `Adverse media match ${input.matchId} resolved as ${input.resolution} by ${input.resolvedBy}`,
          performedBy: input.resolvedBy,
        },
      });
      return updated;
    }),

  // ─── Documents ─────────────────────────────────────────────
  "documents.list": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.complianceDocument.findMany({
        where: { checkId: input.checkId },
        orderBy: { createdAt: "desc" },
      });
    }),

  "documents.request": publicProcedure
    .input(z.object({
      checkId: z.string(),
      documentType: z.enum(COMPLIANCE_DOC_TYPE),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.complianceDocument.create({
        data: {
          checkId: input.checkId,
          documentType: input.documentType,
          fileName: `${input.documentType}_requested`,
          status: "PENDING",
          notes: input.notes,
        },
      });
      await ctx.db.complianceCheck.update({
        where: { id: input.checkId },
        data: { status: "AWAITING_DOCUMENTS" },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType: "DOCUMENTS_REQUESTED",
          description: `Document requested: ${input.documentType}`,
        },
      });
      return doc;
    }),

  "documents.verify": publicProcedure
    .input(z.object({ id: z.string(), verifiedBy: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.complianceDocument.update({
        where: { id: input.id },
        data: { status: "VERIFIED", verifiedAt: new Date(), verifiedBy: input.verifiedBy, notes: input.notes },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: doc.checkId,
          activityType: "DOCUMENT_VERIFIED",
          description: `Document ${doc.documentType} verified by ${input.verifiedBy}`,
          performedBy: input.verifiedBy,
        },
      });
      return doc;
    }),

  "documents.reject": publicProcedure
    .input(z.object({ id: z.string(), rejectedBy: z.string(), rejectionReason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.complianceDocument.update({
        where: { id: input.id },
        data: { status: "REJECTED", rejectionReason: input.rejectionReason },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: doc.checkId,
          activityType: "DOCUMENT_REJECTED",
          description: `Document ${doc.documentType} rejected by ${input.rejectedBy}: ${input.rejectionReason}`,
          performedBy: input.rejectedBy,
        },
      });
      return doc;
    }),

  "documents.upload": publicProcedure
    .input(z.object({
      checkId: z.string(),
      documentType: z.enum(COMPLIANCE_DOC_TYPE),
      fileName: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      documentId: z.string().optional(),
      issuingCountry: z.string().optional(),
      expiryDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.complianceDocument.create({
        data: {
          checkId: input.checkId,
          documentType: input.documentType,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          documentId: input.documentId,
          issuingCountry: input.issuingCountry,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          status: "SUBMITTED",
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType: "DOCUMENT_SUBMITTED",
          description: `Document uploaded: ${input.documentType} — ${input.fileName}`,
        },
      });
      return doc;
    }),

  // ─── Monitoring ────────────────────────────────────────────
  "monitoring.start": publicProcedure
    .input(z.object({ checkId: z.string(), frequency: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      const result = await legl.startOngoingMonitoring(check.externalCheckId || input.checkId, { frequency: input.frequency || "quarterly" });
      const now = new Date();
      const nextCheck = new Date(now);
      nextCheck.setMonth(nextCheck.getMonth() + 1);
      await ctx.db.complianceCheck.update({
        where: { id: input.checkId },
        data: {
          ongoingMonitoringId: result.success ? result.data?.monitoringId : null,
          lastMonitoringCheck: now,
          nextMonitoringCheck: nextCheck,
        },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType: "STATUS_CHANGED",
          description: `Ongoing monitoring started${input.frequency ? ` (${input.frequency})` : ""}`,
        },
      });
      return result;
    }),

  "monitoring.stop": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      if (check.ongoingMonitoringId) {
        await legl.stopOngoingMonitoring(check.ongoingMonitoringId);
      }
      await ctx.db.complianceCheck.update({
        where: { id: input.checkId },
        data: { ongoingMonitoringId: null, nextMonitoringCheck: null },
      });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType: "STATUS_CHANGED",
          description: "Ongoing monitoring stopped",
        },
      });
      return { success: true };
    }),

  "monitoring.getAlerts": publicProcedure
    .input(z.object({ checkId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.checkId) {
        const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
        return check.monitoringAlerts ? JSON.parse(check.monitoringAlerts) : [];
      }
      // Return all monitoring alerts across all checks
      const checks = await ctx.db.complianceCheck.findMany({ where: { monitoringAlerts: { not: null } }, select: { id: true, subjectName: true, monitoringAlerts: true } });
      const allAlerts: any[] = [];
      for (const c of checks) {
        const alerts = JSON.parse(c.monitoringAlerts!);
        for (const a of alerts) allAlerts.push({ ...a, checkId: c.id, subjectName: c.subjectName });
      }
      return allAlerts;
    }),

  "monitoring.acknowledgeAlert": publicProcedure
    .input(z.object({ checkId: z.string(), alertId: z.string(), acknowledgedBy: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      const alerts = check.monitoringAlerts ? JSON.parse(check.monitoringAlerts) : [];
      const updated = alerts.map((a: any) =>
        a.id === input.alertId ? { ...a, acknowledged: true, acknowledgedBy: input.acknowledgedBy, acknowledgedAt: new Date().toISOString(), notes: input.notes } : a
      );
      await ctx.db.complianceCheck.update({ where: { id: input.checkId }, data: { monitoringAlerts: JSON.stringify(updated) } });
      await ctx.db.complianceActivity.create({
        data: {
          checkId: input.checkId,
          activityType: "MONITORING_ALERT",
          description: `Monitoring alert ${input.alertId} acknowledged by ${input.acknowledgedBy}`,
          performedBy: input.acknowledgedBy,
        },
      });
      return updated;
    }),

  "monitoring.getStatus": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await ctx.db.complianceCheck.findUniqueOrThrow({ where: { id: input.checkId } });
      return {
        isActive: !!check.ongoingMonitoringId,
        monitoringId: check.ongoingMonitoringId,
        lastCheck: check.lastMonitoringCheck,
        nextCheck: check.nextMonitoringCheck,
        alertCount: check.monitoringAlerts ? JSON.parse(check.monitoringAlerts).length : 0,
      };
    }),

  // ─── Policies ──────────────────────────────────────────────
  "policies.list": publicProcedure
    .input(z.object({
      subjectType: z.enum(COMPLIANCE_SUBJECT_TYPE).optional(),
      practiceArea: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.subjectType) where.subjectType = input.subjectType;
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.compliancePolicy.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  "policies.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.compliancePolicy.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "policies.create": publicProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      subjectType: z.enum(COMPLIANCE_SUBJECT_TYPE),
      requiredChecks: z.string(),
      requiredDocuments: z.string(),
      riskThresholds: z.string().optional(),
      eddTriggers: z.string().optional(),
      practiceArea: z.string().optional(),
      matterValueThreshold: z.number().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        // Unset any existing default for this subject type
        await ctx.db.compliancePolicy.updateMany({
          where: { subjectType: input.subjectType, isDefault: true },
          data: { isDefault: false },
        });
      }
      return ctx.db.compliancePolicy.create({ data: input });
    }),

  "policies.update": publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      subjectType: z.enum(COMPLIANCE_SUBJECT_TYPE).optional(),
      requiredChecks: z.string().optional(),
      requiredDocuments: z.string().optional(),
      riskThresholds: z.string().optional(),
      eddTriggers: z.string().optional(),
      practiceArea: z.string().optional(),
      matterValueThreshold: z.number().optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (input.isDefault && input.subjectType) {
        await ctx.db.compliancePolicy.updateMany({
          where: { subjectType: input.subjectType, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return ctx.db.compliancePolicy.update({ where: { id }, data });
    }),

  "policies.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.compliancePolicy.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  "policies.determine": publicProcedure
    .input(z.object({
      subjectType: z.enum(COMPLIANCE_SUBJECT_TYPE),
      practiceArea: z.string().optional(),
      matterValue: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Find the most specific matching active policy
      const policies = await ctx.db.compliancePolicy.findMany({
        where: { isActive: true, subjectType: input.subjectType },
        orderBy: { createdAt: "desc" },
      });
      // Prefer practice-area-specific policy
      if (input.practiceArea) {
        const specific = policies.find((p) => p.practiceArea === input.practiceArea);
        if (specific) return specific;
      }
      // Fall back to default
      const defaultPolicy = policies.find((p) => p.isDefault);
      if (defaultPolicy) return defaultPolicy;
      // Fall back to any matching policy
      return policies[0] || null;
    }),

  "policies.initialize": publicProcedure.mutation(async () => {
    return engine.initializeDefaultPolicies();
  }),

  // ─── Reports ───────────────────────────────────────────────
  "reports.dashboard": publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.complianceCheck.count();
    const byStatus = await ctx.db.complianceCheck.groupBy({ by: ["status"], _count: true });
    const byRisk = await ctx.db.complianceCheck.groupBy({ by: ["overallRiskLevel"], _count: true });
    const expiringSoon = await ctx.db.complianceCheck.count({
      where: {
        status: "PASSED",
        expiresAt: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() },
      },
    });
    const expired = await ctx.db.complianceCheck.count({
      where: { status: "PASSED", expiresAt: { lt: new Date() } },
    });
    const pendingReview = await ctx.db.complianceCheck.count({
      where: { status: "UNDER_REVIEW" },
    });
    const recentActivity = await ctx.db.complianceActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { check: { select: { subjectName: true, checkType: true } } },
    });
    return { total, byStatus, byRisk, expiringSoon, expired, pendingReview, recentActivity };
  }),

  "reports.clientRiskRegister": publicProcedure.query(async ({ ctx }) => {
    const clients = await ctx.db.client.findMany({
      where: { complianceChecks: { some: {} } },
      include: {
        complianceChecks: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            overallRiskLevel: true,
            riskScore: true,
            checkType: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });
    return clients.map((c) => {
      const latest = c.complianceChecks[0];
      return {
        clientId: c.id,
        clientName: c.name,
        latestCheckId: latest?.id,
        latestStatus: latest?.status,
        riskLevel: latest?.overallRiskLevel,
        riskScore: latest?.riskScore,
        checkType: latest?.checkType,
        expiresAt: latest?.expiresAt,
        lastChecked: latest?.createdAt,
      };
    });
  }),

  "reports.expiring": publicProcedure
    .input(z.object({ days: z.number().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() + (input?.days || 30) * 86400000);
      return ctx.db.complianceCheck.findMany({
        where: {
          status: "PASSED",
          expiresAt: { lte: cutoff, gte: new Date() },
        },
        include: { client: true, matter: true },
        orderBy: { expiresAt: "asc" },
      });
    }),

  "reports.auditLog": publicProcedure
    .input(z.object({
      checkId: z.string().optional(),
      activityType: z.enum(COMPLIANCE_ACTIVITY_TYPE).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.checkId) where.checkId = input.checkId;
      if (input?.activityType) where.activityType = input.activityType;
      if (input?.from || input?.to) {
        where.createdAt = {};
        if (input?.from) where.createdAt.gte = new Date(input.from);
        if (input?.to) where.createdAt.lte = new Date(input.to);
      }
      return ctx.db.complianceActivity.findMany({
        where,
        include: { check: { select: { subjectName: true, checkType: true, clientId: true } } },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 100,
      });
    }),

  "reports.sarTemplate": publicProcedure
    .input(z.object({ checkId: z.string() }))
    .query(async ({ input }) => {
      return engine.generateSARReport(input.checkId);
    }),

  "reports.firmOverview": publicProcedure
    .input(z.object({ period: z.string().optional() }))
    .query(async ({ input }) => {
      return engine.getComplianceDashboardData();
    }),

  "reports.annualReview": publicProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      const dashboard = await engine.getComplianceDashboardData();
      const auditLog = await engine.generateAuditLog({ from: `${input.year}-01-01`, to: `${input.year}-12-31` });
      return { year: input.year, dashboard, auditLogEntries: auditLog.length, generatedAt: new Date().toISOString() };
    }),

  "reports.export": publicProcedure
    .input(z.object({
      reportType: z.enum(COMPLIANCE_REPORT_TYPE),
      period: z.string().optional(),
      format: z.enum(["pdf", "xlsx", "csv"]).default("pdf"),
    }))
    .mutation(async ({ input }) => {
      return { message: `Export of ${input.reportType} in ${input.format} format will be generated.`, status: "pending" };
    }),

  // ─── Built-in Screening ────────────────────────────────────
  "builtin.sanctions": publicProcedure
    .input(z.object({
      name: z.string(),
      dateOfBirth: z.string().optional(),
      nationality: z.string().optional(),
      idNumber: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return engine.runBuiltInSanctionsCheck(input.name, input.dateOfBirth, input.nationality);
    }),

  "builtin.pep": publicProcedure
    .input(z.object({
      name: z.string(),
      dateOfBirth: z.string().optional(),
      nationality: z.string().optional(),
      jurisdiction: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return engine.runBuiltInPEPCheck(input.name, input.nationality);
    }),

  "builtin.adverseMedia": publicProcedure
    .input(z.object({
      name: z.string(),
      companyName: z.string().optional(),
      jurisdiction: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return engine.runBuiltInAdverseMediaCheck(input.name, input.companyName);
    }),

  "builtin.fullCheck": publicProcedure
    .input(z.object({
      name: z.string(),
      dateOfBirth: z.string().optional(),
      nationality: z.string().optional(),
      idNumber: z.string().optional(),
      companyName: z.string().optional(),
      jurisdiction: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [sanctions, pep, adverseMedia] = await Promise.all([
        engine.runBuiltInSanctionsCheck(input.name, input.dateOfBirth, input.nationality),
        engine.runBuiltInPEPCheck(input.name, input.nationality),
        engine.runBuiltInAdverseMediaCheck(input.name, input.companyName),
      ]);

      // Calculate combined risk score
      let riskScore = 0;
      if (sanctions.matches?.length) riskScore += 40;
      if (pep.matches?.length) riskScore += 30;
      if (adverseMedia.matches?.length) riskScore += 30;
      const riskLevel = riskScore >= 70 ? "VERY_HIGH" : riskScore >= 40 ? "HIGH" : riskScore >= 20 ? "MEDIUM" : "LOW";

      return {
        sanctions,
        pep,
        adverseMedia,
        combined: {
          riskScore,
          riskLevel,
          totalMatches: (sanctions.matches?.length || 0) + (pep.matches?.length || 0) + (adverseMedia.matches?.length || 0),
        },
        disclaimer: "IMPORTANT: These AI-powered screening results are provided for informational purposes only and do not constitute legal advice. Results should be independently verified by qualified compliance professionals before making any decisions. False positives and false negatives are possible. This tool does not replace proper KYC/AML due diligence procedures or professional legal judgment.",
      };
    }),
});

// Need to import db for standalone operations
import { db } from "@/lib/db";
