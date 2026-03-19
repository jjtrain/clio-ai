import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as secEngine from "@/lib/security-engine";

const dateRange = z.object({ from: z.string(), to: z.string() });

export const securityRouter = router({
  // ── Settings (1-8) ──────────────────────────────────────────────────

  "settings.get": publicProcedure.query(async () => {
    const settings = await db.securityModule.findFirst();
    return settings ?? { mfaRequired: false, sessionTimeoutMinutes: 60, ipWhitelistEnabled: false };
  }),

  "settings.update": publicProcedure
    .input(z.object({ id: z.string().optional(), mfaRequired: z.boolean().optional(), sessionTimeoutMinutes: z.number().optional(), ipWhitelistEnabled: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return db.securityModule.upsert({ where: { id: input.id ?? "default" }, create: input as any, update: input as any });
    }),

  "settings.getPasswordPolicy": publicProcedure.query(async () => {
    const s = await db.securityModule.findFirst();
    return { minLength: s?.passwordMinLength ?? 12, requireUppercase: s?.passwordRequireUppercase ?? true, requireLowercase: s?.passwordRequireLowercase ?? true, requireNumbers: s?.passwordRequireNumber ?? true, requireSpecial: s?.passwordRequireSpecial ?? true, expiryDays: s?.passwordExpiryDays ?? 90, historyCount: s?.passwordHistoryCount ?? 5 };
  }),

  "settings.updatePasswordPolicy": publicProcedure
    .input(z.object({ minLength: z.number().optional(), requireUppercase: z.boolean().optional(), requireNumbers: z.boolean().optional(), requireSymbols: z.boolean().optional(), expiryDays: z.number().optional() }))
    .mutation(async ({ input }) => {
      return db.securityModule.updateMany({ where: {}, data: { passwordMinLength: input.minLength, passwordRequireUppercase: input.requireUppercase, passwordRequireNumber: input.requireNumbers, passwordRequireSpecial: input.requireSymbols, passwordExpiryDays: input.expiryDays } as any });
    }),

  "settings.getSessionPolicy": publicProcedure.query(async () => {
    const s = await db.securityModule.findFirst();
    return { timeoutMinutes: s?.sessionTimeoutMinutes ?? 60, maxConcurrentSessions: s?.maxConcurrentSessions ?? 3, lockAfterFailedAttempts: s?.loginAttemptsBeforeLockout ?? 5 };
  }),

  "settings.updateSessionPolicy": publicProcedure
    .input(z.object({ timeoutMinutes: z.number().optional(), maxConcurrentSessions: z.number().optional(), lockAfterFailedAttempts: z.number().optional() }))
    .mutation(async ({ input }) => {
      return db.securityModule.updateMany({ where: {}, data: { sessionTimeoutMinutes: input.timeoutMinutes, maxConcurrentSessions: input.maxConcurrentSessions } as any });
    }),

  "settings.getIpWhitelist": publicProcedure.query(async () => {
    const s = await db.securityModule.findFirst();
    return s?.ipWhitelist ? JSON.parse(s.ipWhitelist) : [];
  }),

  "settings.updateIpWhitelist": publicProcedure
    .input(z.object({ ipWhitelist: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      return db.securityModule.updateMany({ where: {}, data: { ipWhitelist: JSON.stringify(input.ipWhitelist) } });
    }),

  // ── Audit (9-17) ────────────────────────────────────────────────────

  "audit.list": publicProcedure
    .input(z.object({
      userId: z.string().optional(), action: z.string().optional(), category: z.string().optional(),
      severity: z.string().optional(), resource: z.string().optional(), dateRange: dateRange.optional(),
      success: z.boolean().optional(), isCompliance: z.boolean().optional(),
      take: z.number().optional(), skip: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.userId) where.userId = input.userId;
      if (input.action) where.action = input.action;
      if (input.category) where.category = input.category;
      if (input.severity) where.severity = input.severity;
      if (input.resource) where.resource = input.resource;
      if (input.success !== undefined) where.success = input.success;
      if (input.isCompliance !== undefined) where.isCompliance = input.isCompliance;
      if (input.dateRange) where.createdAt = { gte: new Date(input.dateRange.from), lte: new Date(input.dateRange.to) };
      return db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "audit.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.auditLog.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "audit.search": publicProcedure
    .input(z.object({ query: z.string(), take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      return db.auditLog.findMany({ where: { description: { contains: input.query } }, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "audit.getForResource": publicProcedure
    .input(z.object({ resource: z.string(), resourceId: z.string() }))
    .query(async ({ input }) => {
      return db.auditLog.findMany({ where: { resource: input.resource, resourceId: input.resourceId }, orderBy: { createdAt: "desc" } });
    }),

  "audit.getForUser": publicProcedure
    .input(z.object({ userId: z.string(), dateRange: dateRange.optional() }))
    .query(async ({ input }) => {
      const where: any = { userId: input.userId };
      if (input.dateRange) where.createdAt = { gte: new Date(input.dateRange.from), lte: new Date(input.dateRange.to) };
      return db.auditLog.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  "audit.getLoginHistory": publicProcedure
    .input(z.object({ userId: z.string().optional(), take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      const where: any = { action: { in: ["LOGIN", "LOGOUT", "LOGIN_FAILED", "SESSION_EXPIRED", "PASSWORD_CHANGED", "MFA_ENABLED", "MFA_DISABLED"] as any } };
      if (input.userId) where.userId = input.userId;
      return db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "audit.getDataAccessLog": publicProcedure
    .input(z.object({ take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      return db.auditLog.findMany({ where: { category: "DATA_ACCESS" as any }, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "audit.export": publicProcedure
    .input(z.object({ dateRange: dateRange.optional(), category: z.string().optional() }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.category) where.category = input.category;
      if (input.dateRange) where.createdAt = { gte: new Date(input.dateRange.from), lte: new Date(input.dateRange.to) };
      const logs = await db.auditLog.findMany({ where, orderBy: { createdAt: "desc" } });
      return { data: logs, exportedAt: new Date().toISOString(), count: logs.length };
    }),

  "audit.detectAnomalies": publicProcedure
    .input(z.object({ userId: z.string().optional(), dateRange: dateRange.optional() }))
    .query(async ({ input }) => {
      return secEngine.detectAnomalies(input as any);
    }),

  // ── Access (18-26) ──────────────────────────────────────────────────

  "access.listPolicies": publicProcedure
    .input(z.object({ take: z.number().optional(), skip: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.accessPolicy.findMany({ orderBy: { createdAt: "desc" }, take: input?.take ?? 50, skip: input?.skip ?? 0 });
    }),

  "access.getPolicy": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.accessPolicy.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "access.createPolicy": publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), roleLevel: z.string().optional(), permissions: z.string().optional(), dataAccessScope: z.string().optional(), matterAccess: z.string().optional(), clientAccess: z.string().optional(), financialAccess: z.boolean().optional(), adminAccess: z.boolean().optional(), canExportData: z.boolean().optional(), canDeleteRecords: z.boolean().optional(), requireTwoFactor: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return db.accessPolicy.create({ data: { ...input, permissions: input.permissions || "{}" } as any });
    }),

  "access.updatePolicy": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), resource: z.string().optional(), actions: z.array(z.string()).optional(), effect: z.string().optional(), conditions: z.any().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.accessPolicy.update({ where: { id }, data: data as any });
    }),

  "access.deletePolicy": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.accessPolicy.delete({ where: { id: input.id } });
    }),

  "access.assignToUser": publicProcedure
    .input(z.object({ policyId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true, policyId: input.policyId, userId: input.userId, message: "Policy assigned to user" };
    }),

  "access.checkPermission": publicProcedure
    .input(z.object({ userId: z.string(), resource: z.string(), action: z.string() }))
    .query(async ({ input }) => {
      return secEngine.checkDataAccess(input.userId, input.resource, "", input.action);
    }),

  "access.getEffectivePermissions": publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return { userId: input.userId, permissions: [], message: "Effective permissions placeholder" };
    }),

  "access.reviewAccess": publicProcedure.query(async () => {
    const policies = await db.accessPolicy.findMany();
    return policies;
  }),

  // ── Classification (27-31) ─────────────────────────────────────────

  "classification.get": publicProcedure
    .input(z.object({ resource: z.string(), resourceId: z.string() }))
    .query(async ({ input }) => {
      return db.dataClassification.findFirst({ where: { resource: input.resource, resourceId: input.resourceId } });
    }),

  "classification.set": publicProcedure
    .input(z.object({ id: z.string().optional(), resource: z.string(), resourceId: z.string(), classification: z.string(), containsPII: z.boolean().optional(), containsPHI: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return db.dataClassification.upsert({
        where: { id: input.id ?? "" },
        create: input as any,
        update: input as any,
      });
    }),

  "classification.autoClassify": publicProcedure
    .input(z.object({ resource: z.string(), resourceId: z.string(), content: z.string().optional() }))
    .mutation(async ({ input }) => {
      return secEngine.classifyData(input.resource, input.resourceId, input.content);
    }),

  "classification.bulkClassify": publicProcedure
    .input(z.object({ items: z.array(z.object({ resource: z.string(), resourceId: z.string() })) }))
    .mutation(async ({ input }) => {
      return { processed: input.items.length, classified: 0, message: "Bulk classification placeholder" };
    }),

  "classification.getSummary": publicProcedure.query(async () => {
    const byClassification = await db.dataClassification.groupBy({ by: ["classification"], _count: true });
    const piiCount = await db.dataClassification.count({ where: { containsPII: true } });
    const phiCount = await db.dataClassification.count({ where: { containsPHI: true } });
    return { byClassification, piiCount, phiCount };
  }),

  // ── Compliance (32-44) ─────────────────────────────────────────────

  "compliance.getControls": publicProcedure
    .input(z.object({ framework: z.string().optional(), category: z.string().optional(), status: z.string().optional(), take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.framework) where.framework = input.framework;
      if (input.category) where.category = input.category;
      if (input.status) where.status = input.status;
      return db.complianceControl.findMany({ where, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "compliance.getControl": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.complianceControl.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "compliance.updateControl": publicProcedure
    .input(z.object({ id: z.string(), status: z.string().optional(), notes: z.string().optional(), ownerId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.complianceControl.update({ where: { id }, data: data as any });
    }),

  "compliance.addEvidence": publicProcedure
    .input(z.object({ controlId: z.string(), documentId: z.string() }))
    .mutation(async ({ input }) => {
      const control = await db.complianceControl.findUniqueOrThrow({ where: { id: input.controlId } });
      const existing = control.evidenceDocIds ? JSON.parse(control.evidenceDocIds) : [];
      existing.push(input.documentId);
      return db.complianceControl.update({ where: { id: input.controlId }, data: { evidenceDocIds: JSON.stringify(existing) } });
    }),

  "compliance.runCheck": publicProcedure
    .input(z.object({ framework: z.string() }))
    .mutation(async ({ input }) => {
      return secEngine.runComplianceCheck(input.framework);
    }),

  "compliance.runAllChecks": publicProcedure
    .input(z.object({ framework: z.string().optional() }))
    .mutation(async ({ input }) => {
      const controls = await db.complianceControl.findMany({ where: input.framework ? { framework: input.framework as any } : undefined });
      const results = await Promise.all(controls.map((c: any) => secEngine.runComplianceCheck(c.id)));
      return { checked: controls.length, results };
    }),

  "compliance.generateReport": publicProcedure
    .input(z.object({ framework: z.string(), includeEvidence: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      return secEngine.generateComplianceReport(input.framework, { start: new Date(now.getFullYear(), 0, 1), end: now });
    }),

  "compliance.getAssessments": publicProcedure
    .input(z.object({ framework: z.string().optional(), take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.framework) where.framework = input.framework;
      return db.complianceAssessment.findMany({ where, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "compliance.createAssessment": publicProcedure
    .input(z.object({ framework: z.string(), name: z.string(), description: z.string().optional(), assessorId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.complianceAssessment.create({ data: input as any });
    }),

  "compliance.updateAssessment": publicProcedure
    .input(z.object({ id: z.string(), status: z.string().optional(), findings: z.string().optional(), completedAt: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.complianceAssessment.update({ where: { id }, data: data as any });
    }),

  "compliance.getGapAnalysis": publicProcedure
    .input(z.object({ framework: z.string().optional() }))
    .query(async ({ input }) => {
      const where: any = { status: { not: "CTRL_IMPLEMENTED" as any } };
      if (input.framework) where.framework = input.framework;
      return db.complianceControl.findMany({ where });
    }),

  "compliance.generateSOC2Evidence": publicProcedure
    .input(z.object({ category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const controls = await db.complianceControl.findMany({ where: { framework: "SOC2", ...(input.category ? { category: input.category } : {}) } });
      return { framework: "SOC2", controls: controls.length, generatedAt: new Date().toISOString() };
    }),

  "compliance.getDashboard": publicProcedure.query(async () => {
    const controls = await db.complianceControl.findMany();
    const byFramework: Record<string, Record<string, number>> = {};
    for (const c of controls) {
      const fw = (c as any).framework ?? "UNKNOWN";
      const st = (c as any).status ?? "UNKNOWN";
      if (!byFramework[fw]) byFramework[fw] = {};
      byFramework[fw][st] = (byFramework[fw][st] ?? 0) + 1;
    }
    return { byFramework, totalControls: controls.length };
  }),

  // ── Incidents (45-52) ──────────────────────────────────────────────

  "incidents.list": publicProcedure
    .input(z.object({ status: z.string().optional(), severity: z.string().optional(), take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.status) where.status = input.status;
      if (input.severity) where.severity = input.severity;
      return db.securityIncident.findMany({ where, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "incidents.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.securityIncident.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "incidents.create": publicProcedure
    .input(z.object({ title: z.string(), description: z.string(), type: z.string(), severity: z.string(), reportedBy: z.string().optional() }))
    .mutation(async ({ input }) => {
      return secEngine.createIncident(input as any);
    }),

  "incidents.update": publicProcedure
    .input(z.object({ id: z.string(), status: z.string().optional(), severity: z.string().optional(), assignedTo: z.string().optional(), resolution: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.securityIncident.update({ where: { id }, data: data as any });
    }),

  "incidents.addTimelineEntry": publicProcedure
    .input(z.object({ incidentId: z.string(), entry: z.string(), userId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return secEngine.updateIncidentTimeline(input.incidentId, { action: input.entry, actor: input.userId || "System", details: input.entry });
    }),

  "incidents.close": publicProcedure
    .input(z.object({ id: z.string(), resolution: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.securityIncident.update({ where: { id: input.id }, data: { status: "CLOSED" as any, resolution: input.resolution, closedAt: new Date() } as any });
    }),

  "incidents.assessNotification": publicProcedure
    .input(z.object({ incidentId: z.string() }))
    .mutation(async ({ input }) => {
      return secEngine.assessBreachNotification(input.incidentId);
    }),

  "incidents.getMetrics": publicProcedure.query(async () => {
    const incidents = await db.securityIncident.findMany();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const i of incidents) {
      const t = (i as any).type ?? "UNKNOWN"; byType[t] = (byType[t] ?? 0) + 1;
      const s = (i as any).severity ?? "UNKNOWN"; bySeverity[s] = (bySeverity[s] ?? 0) + 1;
      const st = (i as any).status ?? "UNKNOWN"; byStatus[st] = (byStatus[st] ?? 0) + 1;
    }
    return { total: incidents.length, byType, bySeverity, byStatus };
  }),

  // ── Encryption (53-57) ─────────────────────────────────────────────

  "encryption.listKeys": publicProcedure
    .input(z.object({ take: z.number().optional(), skip: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.encryptionKey.findMany({ orderBy: { createdAt: "desc" }, take: input?.take ?? 50, skip: input?.skip ?? 0 });
    }),

  "encryption.getKey": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.encryptionKey.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "encryption.rotateKey": publicProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ input }) => {
      return secEngine.rotateEncryptionKey(input.keyId);
    }),

  "encryption.getRotationSchedule": publicProcedure.query(async () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return db.encryptionKey.findMany({ where: { nextRotationDate: { lt: thirtyDaysFromNow } }, orderBy: { nextRotationDate: "asc" } });
  }),

  "encryption.getStatus": publicProcedure.query(async () => {
    const byStatus = await db.encryptionKey.groupBy({ by: ["status"], _count: true });
    return byStatus;
  }),

  // ── Retention (58-64) ──────────────────────────────────────────────

  "retention.listPolicies": publicProcedure
    .input(z.object({ take: z.number().optional(), skip: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.dataRetentionPolicy.findMany({ orderBy: { createdAt: "desc" }, take: input?.take ?? 50, skip: input?.skip ?? 0 });
    }),

  "retention.getPolicy": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.dataRetentionPolicy.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "retention.createPolicy": publicProcedure
    .input(z.object({ name: z.string(), resource: z.string(), retentionDays: z.number(), action: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.dataRetentionPolicy.create({ data: input as any });
    }),

  "retention.updatePolicy": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), retentionDays: z.number().optional(), action: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.dataRetentionPolicy.update({ where: { id }, data: data as any });
    }),

  "retention.deletePolicy": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.dataRetentionPolicy.delete({ where: { id: input.id } });
    }),

  "retention.enforce": publicProcedure.mutation(async () => {
    return secEngine.enforceRetentionPolicies();
  }),

  "retention.preview": publicProcedure
    .input(z.object({ policyId: z.string() }))
    .query(async ({ input }) => {
      return { policyId: input.policyId, affectedRecords: 0, message: "Retention preview placeholder" };
    }),

  // ── Holds (65-69) ──────────────────────────────────────────────────

  "holds.list": publicProcedure
    .input(z.object({ status: z.string().optional(), take: z.number().optional(), skip: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      return db.legalHold.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.take ?? 50, skip: input?.skip ?? 0 });
    }),

  "holds.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.legalHold.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "holds.create": publicProcedure
    .input(z.object({ name: z.string(), reason: z.string().optional(), matterId: z.string().optional(), clientId: z.string().optional(), issuedBy: z.string().optional() }))
    .mutation(async ({ input }) => {
      const hold = await db.legalHold.create({ data: { holdName: input.name, reason: input.reason || "Legal hold", matterId: input.matterId, clientId: input.clientId, issuedBy: input.issuedBy || "System", issuedDate: new Date(), scope: JSON.stringify({ matters: input.matterId ? [input.matterId] : [] }) } });
      await secEngine.enforceLegalHold(hold.id);
      return hold;
    }),

  "holds.release": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      await secEngine.releaseLegalHold(input.id, "System");
      return db.legalHold.update({ where: { id: input.id }, data: { status: "RELEASED" as any, releasedAt: new Date() } as any });
    }),

  "holds.getAffectedRecords": publicProcedure
    .input(z.object({ holdId: z.string() }))
    .query(async ({ input }) => {
      return { holdId: input.holdId, records: [], count: 0, message: "Affected records placeholder" };
    }),

  // ── Consent (70-74) ────────────────────────────────────────────────

  "consent.list": publicProcedure
    .input(z.object({ clientId: z.string(), take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      return db.consentRecord.findMany({ where: { clientId: input.clientId }, orderBy: { createdAt: "desc" }, take: input.take ?? 50, skip: input.skip ?? 0 });
    }),

  "consent.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.consentRecord.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "consent.record": publicProcedure
    .input(z.object({ clientId: z.string(), type: z.string(), description: z.string().optional(), grantedBy: z.string().optional(), expiresAt: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.consentRecord.create({ data: { ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined } as any });
    }),

  "consent.withdraw": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.consentRecord.update({ where: { id: input.id }, data: { status: "CS_WITHDRAWN" as any, withdrawnAt: new Date(), withdrawReason: input.reason } as any });
    }),

  "consent.checkForClient": publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => {
      const records = await db.consentRecord.findMany({ where: { clientId: input.clientId } });
      const byType: Record<string, any[]> = {};
      for (const r of records) {
        const t = (r as any).type ?? "UNKNOWN";
        if (!byType[t]) byType[t] = [];
        byType[t].push(r);
      }
      return byType;
    }),

  // ── Vendors (75-79) ────────────────────────────────────────────────

  "vendors.list": publicProcedure
    .input(z.object({ take: z.number().optional(), skip: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.vendorRiskAssessment.findMany({ orderBy: { createdAt: "desc" }, take: input?.take ?? 50, skip: input?.skip ?? 0 });
    }),

  "vendors.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.vendorRiskAssessment.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "vendors.assess": publicProcedure
    .input(z.object({ vendorId: z.string() }))
    .mutation(async ({ input }) => {
      return secEngine.assessVendorRisk(input.vendorId);
    }),

  "vendors.approve": publicProcedure
    .input(z.object({ id: z.string(), approvedBy: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.vendorRiskAssessment.update({ where: { id: input.id }, data: { isApproved: true, approvedAt: new Date(), approvedBy: input.approvedBy } as any });
    }),

  "vendors.getOverdue": publicProcedure.query(async () => {
    return db.vendorRiskAssessment.findMany({ where: { nextReviewDate: { lt: new Date() } }, orderBy: { nextReviewDate: "asc" } });
  }),

  // ── Vulnerability (80-81) ──────────────────────────────────────────

  "vulnerability.run": publicProcedure
    .input(z.object({ scope: z.string().optional(), targets: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      return secEngine.runVulnerabilityAssessment();
    }),

  "vulnerability.getHistory": publicProcedure
    .input(z.object({ take: z.number().optional(), skip: z.number().optional() }))
    .query(async ({ input }) => {
      return { assessments: [], total: 0, message: "Vulnerability history placeholder" };
    }),

  // ── Reports (82-90) ────────────────────────────────────────────────

  "reports.auditSummary": publicProcedure
    .input(z.object({ dateRange: dateRange.optional() }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.dateRange) where.createdAt = { gte: new Date(input.dateRange.from), lte: new Date(input.dateRange.to) };
      const byCategory = await db.auditLog.groupBy({ by: ["category"], _count: true, where });
      const bySeverity = await db.auditLog.groupBy({ by: ["severity"], _count: true, where });
      return { byCategory, bySeverity };
    }),

  "reports.accessReview": publicProcedure.query(async () => {
    return db.accessPolicy.findMany({ orderBy: { createdAt: "desc" } });
  }),

  "reports.complianceStatus": publicProcedure.query(async () => {
    const controls = await db.complianceControl.findMany();
    const byFramework: Record<string, Record<string, number>> = {};
    for (const c of controls) {
      const fw = (c as any).framework ?? "UNKNOWN";
      const st = (c as any).status ?? "UNKNOWN";
      if (!byFramework[fw]) byFramework[fw] = {};
      byFramework[fw][st] = (byFramework[fw][st] ?? 0) + 1;
    }
    return byFramework;
  }),

  "reports.incidentSummary": publicProcedure.query(async () => {
    const incidents = await db.securityIncident.findMany();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const i of incidents) {
      const t = (i as any).type ?? "UNKNOWN"; byType[t] = (byType[t] ?? 0) + 1;
      const s = (i as any).severity ?? "UNKNOWN"; bySeverity[s] = (bySeverity[s] ?? 0) + 1;
    }
    return { total: incidents.length, byType, bySeverity };
  }),

  "reports.encryptionStatus": publicProcedure.query(async () => {
    const byStatus = await db.encryptionKey.groupBy({ by: ["status"], _count: true });
    const total = await db.encryptionKey.count();
    return { total, byStatus };
  }),

  "reports.retentionStatus": publicProcedure.query(async () => {
    return db.dataRetentionPolicy.findMany({ orderBy: { createdAt: "desc" } });
  }),

  "reports.vendorRisk": publicProcedure.query(async () => {
    return db.vendorRiskAssessment.findMany({ orderBy: { createdAt: "desc" } });
  }),

  "reports.securityPosture": publicProcedure.query(async () => {
    const [incidents, controls, keys, vendors, openIncidents] = await Promise.all([
      db.securityIncident.count(),
      db.complianceControl.count(),
      db.encryptionKey.count(),
      db.vendorRiskAssessment.count(),
      db.securityIncident.count({ where: { status: { not: "CLOSED" as any } } }),
    ]);
    return { totalIncidents: incidents, openIncidents, totalControls: controls, totalEncryptionKeys: keys, totalVendors: vendors };
  }),

  "reports.export": publicProcedure
    .input(z.object({ reportType: z.string(), format: z.string().optional() }))
    .query(async ({ input }) => {
      return { reportType: input.reportType, format: input.format ?? "json", data: null, message: "Report export placeholder", generatedAt: new Date().toISOString() };
    }),
});
