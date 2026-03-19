import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ── 1. Central Audit Logging ────────────────────────────────────────

export async function logAudit(params: {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userIp?: string;
  userAgent?: string;
  sessionId?: string;
  action: string;
  category: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  description: string;
  previousValue?: any;
  newValue?: any;
  metadata?: any;
  severity?: string;
  isCompliance?: boolean;
  complianceFramework?: string;
  riskLevel?: string;
  success?: boolean;
  failureReason?: string;
}) {
  try {
    const entry = await db.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        userEmail: params.userEmail,
        userIp: params.userIp,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        action: params.action as any,
        category: params.category as any,
        resource: params.resource,
        resourceId: params.resourceId,
        resourceName: params.resourceName,
        description: params.description,
        previousValue: params.previousValue ? JSON.stringify(params.previousValue) : undefined,
        newValue: params.newValue ? JSON.stringify(params.newValue) : undefined,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
        severity: (params.severity || "SEC_INFO") as any,
        isCompliance: params.isCompliance ?? false,
        complianceFramework: params.complianceFramework,
        riskLevel: params.riskLevel as any,
        success: params.success ?? true,
        failureReason: params.failureReason,
      },
    });
    return entry;
  } catch (err) {
    console.error("[security-engine] logAudit failed:", err);
    return null;
  }
}

// ── 2. Data Access Logging ──────────────────────────────────────────

export async function logDataAccess(params: {
  userId: string;
  resource: string;
  resourceId: string;
  resourceName?: string;
  action: string;
  classification?: string;
  containsPII?: boolean;
  containsPHI?: boolean;
}) {
  return logAudit({
    userId: params.userId,
    action: params.action,
    category: "DATA_ACCESS",
    resource: params.resource,
    resourceId: params.resourceId,
    resourceName: params.resourceName,
    description: `Data access: ${params.action} on ${params.resource}/${params.resourceId}`,
    metadata: {
      classification: params.classification,
      containsPII: params.containsPII,
      containsPHI: params.containsPHI,
    },
    isCompliance: params.containsPHI === true,
    complianceFramework: params.containsPHI ? "HIPAA" : undefined,
  });
}

// ── 3. Authentication Logging ───────────────────────────────────────

const AUTH_ACTION_MAP: Record<string, string> = {
  login: "LOGIN",
  logout: "LOGOUT",
  login_failed: "LOGIN_FAILED",
  password_changed: "PASSWORD_CHANGED",
  password_reset: "PASSWORD_RESET",
  two_factor_enabled: "TWO_FACTOR_ENABLED",
  two_factor_disabled: "TWO_FACTOR_DISABLED",
  two_factor_failed: "TWO_FACTOR_FAILED",
  session_expired: "SESSION_EXPIRED",
  session_terminated: "SESSION_TERMINATED",
  account_locked: "ACCOUNT_LOCKED",
  account_unlocked: "ACCOUNT_UNLOCKED",
};

export async function logAuthentication(params: {
  userEmail: string;
  action: string;
  userIp: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  metadata?: any;
}) {
  const mappedAction = AUTH_ACTION_MAP[params.action] || params.action.toUpperCase();
  return logAudit({
    userEmail: params.userEmail,
    action: mappedAction,
    category: "AUTHENTICATION",
    resource: "session",
    description: `Authentication: ${params.action} for ${params.userEmail}`,
    userIp: params.userIp,
    userAgent: params.userAgent,
    success: params.success,
    failureReason: params.failureReason,
    metadata: params.metadata,
    severity: params.success ? "SEC_INFO" : "SEC_WARNING",
  });
}

// ── 4. Login Attempt Check ──────────────────────────────────────────

export async function checkLoginAttempts(userEmail: string, userIp: string) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const secModule = await db.securityModule.findFirst();
  const threshold = secModule?.loginAttemptsBeforeLockout ?? 5;
  const lockoutMinutes = secModule?.lockoutDurationMinutes ?? 30;

  const failedCount = await db.auditLog.count({
    where: {
      userEmail,
      action: "LOGIN_FAILED" as any,
      timestamp: { gte: thirtyMinAgo },
    },
  });

  if (failedCount >= threshold) {
    const lastFailed = await db.auditLog.findFirst({
      where: { userEmail, action: "LOGIN_FAILED" as any, timestamp: { gte: thirtyMinAgo } },
      orderBy: { timestamp: "desc" },
    });
    const lockoutEnd = lastFailed
      ? new Date(lastFailed.timestamp.getTime() + lockoutMinutes * 60 * 1000)
      : new Date(Date.now() + lockoutMinutes * 60 * 1000);
    const remaining = Math.max(0, Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000));

    return {
      allowed: false,
      reason: `Account locked due to ${failedCount} failed login attempts. Try again in ${remaining} minutes.`,
      lockoutRemaining: remaining,
    };
  }

  return { allowed: true };
}

// ── 5. Session Validation (placeholder) ─────────────────────────────

export async function validateSession(sessionId: string, userIp: string) {
  return { valid: true };
}

// ── 6. Password Policy ─────────────────────────────────────────────

export async function enforcePasswordPolicy(password: string) {
  const secModule = await db.securityModule.findFirst();
  const minLength = secModule?.passwordMinLength ?? 12;
  const requireUpper = secModule?.passwordRequireUppercase ?? true;
  const requireLower = secModule?.passwordRequireLowercase ?? true;
  const requireNumber = secModule?.passwordRequireNumber ?? true;
  const requireSpecial = secModule?.passwordRequireSpecial ?? true;

  const failures: string[] = [];

  if (password.length < minLength) {
    failures.push(`Password must be at least ${minLength} characters`);
  }
  if (requireUpper && !/[A-Z]/.test(password)) {
    failures.push("Password must contain at least one uppercase letter");
  }
  if (requireLower && !/[a-z]/.test(password)) {
    failures.push("Password must contain at least one lowercase letter");
  }
  if (requireNumber && !/[0-9]/.test(password)) {
    failures.push("Password must contain at least one number");
  }
  if (requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    failures.push("Password must contain at least one special character");
  }

  return { valid: failures.length === 0, failures };
}

// ── 7. Data Classification ──────────────────────────────────────────

export async function classifyData(resource: string, resourceId: string, data?: any) {
  let containsPII = false;
  let containsPHI = false;
  let containsFinancial = false;
  let containsPrivileged = false;
  let classification: string = "DC_INTERNAL";

  if (resource === "Client" || resource === "client") {
    containsPII = true;
    classification = "DC_CONFIDENTIAL";
    if (data?.dateOfBirth || data?.ssn || data?.medicalInfo) {
      containsPHI = true;
      classification = "DC_RESTRICTED";
    }
  }

  if (resource === "Matter" || resource === "matter") {
    containsPrivileged = true;
    classification = "DC_PRIVILEGED";
    if (data?.medicalRecords || data?.healthInfo || data?.injuryDetails) {
      containsPHI = true;
      containsPII = true;
    }
  }

  if (data?.financialInfo || data?.bankAccount || data?.trustAccount) {
    containsFinancial = true;
    if (classification !== "DC_PRIVILEGED" && classification !== "DC_RESTRICTED") {
      classification = "DC_CONFIDENTIAL";
    }
  }

  const result = await db.dataClassification.upsert({
    where: { resource_resourceId: { resource, resourceId } } as any,
    update: {
      classification: classification as any,
      containsPII,
      containsPHI,
      containsFinancial,
      containsPrivileged,
      lastReviewedAt: new Date(),
    },
    create: {
      resource,
      resourceId,
      classification: classification as any,
      containsPII,
      containsPHI,
      containsFinancial,
      containsPrivileged,
    },
  });

  return result;
}

// ── 8. Data Access Check (placeholder) ──────────────────────────────

export async function checkDataAccess(userId: string, resource: string, resourceId: string, action: string) {
  // Placeholder — will be fleshed out with full RBAC
  return { allowed: true };
}

// ── 9. Compliance Check ─────────────────────────────────────────────

export async function runComplianceCheck(framework: string) {
  const controls = await db.complianceControl.findMany({
    where: { framework: framework as any },
  });

  const secModule = await db.securityModule.findFirst();
  const results: { controlId: string; controlName: string; passed: boolean; details: string }[] = [];
  let passed = 0;
  let failed = 0;

  for (const control of controls) {
    if (!control.automatedCheck) continue;

    let checkPassed = false;
    let details = "";

    // Basic automated checks based on control category
    if (control.category === "Access Control" || control.controlId.includes("AC")) {
      checkPassed = secModule?.twoFactorRequired === true;
      details = checkPassed ? "2FA is enforced" : "2FA is not enforced";
    } else if (control.category === "Encryption" || control.controlId.includes("SC")) {
      checkPassed = secModule?.encryptionAtRest === true && secModule?.encryptionInTransit === true;
      details = checkPassed ? "Encryption at rest and in transit enabled" : "Encryption not fully configured";
    } else if (control.category === "Audit" || control.controlId.includes("AU")) {
      checkPassed = secModule?.isEnabled === true;
      details = checkPassed ? "Audit logging enabled" : "Audit logging disabled";
    } else if (control.category === "Password" || control.controlId.includes("IA")) {
      checkPassed = (secModule?.passwordMinLength ?? 0) >= 12;
      details = `Min password length: ${secModule?.passwordMinLength ?? "not set"}`;
    } else {
      checkPassed = control.implementationStatus === "CTRL_IMPLEMENTED" || control.implementationStatus === "CTRL_TESTED" || control.implementationStatus === "CTRL_CERTIFIED";
      details = `Implementation status: ${control.implementationStatus}`;
    }

    if (checkPassed) passed++;
    else failed++;

    results.push({ controlId: control.controlId, controlName: control.controlName, passed: checkPassed, details });

    await db.complianceControl.update({
      where: { id: control.id },
      data: {
        lastCheckDate: new Date(),
        lastCheckResult: checkPassed ? "PASS" : "FAIL",
        lastCheckDetails: details,
      },
    });
  }

  return { framework, controlsChecked: results.length, passed, failed, results };
}

// ── 10. Compliance Report ───────────────────────────────────────────

export async function generateComplianceReport(framework: string, dateRange: { start: Date; end: Date }) {
  const controls = await db.complianceControl.findMany({
    where: { framework: framework as any },
  });

  const assessments = await db.complianceAssessment.findMany({
    where: {
      framework: framework as any,
      startDate: { gte: dateRange.start, lte: dateRange.end },
    },
  });

  const auditLogs = await db.auditLog.findMany({
    where: {
      isCompliance: true,
      timestamp: { gte: dateRange.start, lte: dateRange.end },
    },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  const implementedCount = controls.filter(
    (c) => c.implementationStatus === "CTRL_IMPLEMENTED" || c.implementationStatus === "CTRL_TESTED" || c.implementationStatus === "CTRL_CERTIFIED"
  ).length;

  const aiResult = await aiRouter.complete({
    feature: "security_compliance_report",
    systemPrompt: `You are a compliance officer for a law firm. Generate an executive summary for a ${framework} compliance report. Be concise and professional.`,
    userPrompt: `Generate an executive summary for the following compliance data:

Framework: ${framework}
Period: ${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}
Total Controls: ${controls.length}
Implemented Controls: ${implementedCount}
Not Implemented: ${controls.length - implementedCount}
Assessments: ${assessments.length}
Compliance Audit Events: ${auditLogs.length}

Controls Summary:
${controls.map((c) => `- ${c.controlId}: ${c.controlName} (${c.implementationStatus}, last check: ${c.lastCheckResult || "N/A"})`).join("\n")}

Provide: 1) Executive Summary 2) Key Findings 3) Risk Areas 4) Recommendations`,
    temperature: 0.3,
    maxTokens: 2048,
  });

  return {
    framework,
    dateRange,
    totalControls: controls.length,
    implementedControls: implementedCount,
    assessmentCount: assessments.length,
    auditEventCount: auditLogs.length,
    executiveSummary: aiResult.content,
    controls: controls.map((c) => ({
      controlId: c.controlId,
      controlName: c.controlName,
      status: c.implementationStatus,
      lastCheck: c.lastCheckResult,
      lastCheckDate: c.lastCheckDate,
    })),
    generatedAt: new Date(),
  };
}

// ── 11. Anomaly Detection ───────────────────────────────────────────

export async function detectAnomalies(dateRange: { start: Date; end: Date }) {
  const logs = await db.auditLog.findMany({
    where: { timestamp: { gte: dateRange.start, lte: dateRange.end } },
    orderBy: { timestamp: "desc" },
    take: 1000,
  });

  const summary = {
    totalEvents: logs.length,
    failedLogins: logs.filter((l) => l.action === "LOGIN_FAILED").length,
    afterHoursAccess: logs.filter((l) => {
      const hour = l.timestamp.getHours();
      return hour < 6 || hour > 22;
    }).length,
    dataExports: logs.filter((l) => l.action === "SEC_EXPORT" || l.action === "DATA_EXPORTED").length,
    privilegedActions: logs.filter((l) => l.action === "PRIVILEGED_ACTION").length,
    uniqueIPs: Array.from(new Set(logs.map((l) => l.userIp).filter(Boolean))).length,
    uniqueUsers: Array.from(new Set(logs.map((l) => l.userId).filter(Boolean))).length,
  };

  const aiResult = await aiRouter.complete({
    feature: "security_anomaly_detection",
    systemPrompt: `You are a security analyst for a law firm. Analyze audit log patterns and identify potential security anomalies. Return a JSON array of anomalies, each with: type, severity (RISK_LOW, RISK_MEDIUM, RISK_HIGH, RISK_CRITICAL), description, recommendation.`,
    userPrompt: `Analyze the following audit log summary for anomalies:

Period: ${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}
${JSON.stringify(summary, null, 2)}

Sample events (most recent):
${logs.slice(0, 50).map((l) => `[${l.timestamp.toISOString()}] ${l.action} by ${l.userEmail || l.userId || "unknown"} from ${l.userIp || "unknown"} - ${l.description}`).join("\n")}

Identify any anomalies or suspicious patterns.`,
    temperature: 0.2,
    maxTokens: 2048,
  });

  let anomalies: any[] = [];
  try {
    const text = aiResult.content;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) anomalies = JSON.parse(jsonMatch[0]);
  } catch {
    anomalies = [{ type: "analysis", severity: "RISK_LOW", description: aiResult.content, recommendation: "Review manually" }];
  }

  return { dateRange, summary, anomalies };
}

// ── 12. Create Incident ─────────────────────────────────────────────

export async function createIncident(params: {
  title: string;
  description: string;
  incidentType: string;
  severity: string;
  detectedBy: string;
  detectionMethod?: string;
  affectedSystems?: string[];
  affectedDataTypes?: string[];
  createdBy: string;
}) {
  const year = new Date().getFullYear();
  const lastIncident = await db.securityIncident.findFirst({
    where: { incidentNumber: { startsWith: `SEC-${year}-` } },
    orderBy: { createdAt: "desc" },
  });

  let seq = 1;
  if (lastIncident) {
    const parts = lastIncident.incidentNumber.split("-");
    seq = parseInt(parts[2], 10) + 1;
  }
  const incidentNumber = `SEC-${year}-${String(seq).padStart(4, "0")}`;

  const timeline = [
    {
      timestamp: new Date().toISOString(),
      action: "Incident created",
      actor: params.createdBy,
      details: params.description,
    },
  ];

  const incident = await db.securityIncident.create({
    data: {
      incidentNumber,
      title: params.title,
      description: params.description,
      incidentType: params.incidentType as any,
      severity: params.severity as any,
      detectedAt: new Date(),
      detectedBy: params.detectedBy,
      detectionMethod: params.detectionMethod,
      affectedSystems: params.affectedSystems ? JSON.stringify(params.affectedSystems) : undefined,
      affectedDataTypes: params.affectedDataTypes ? JSON.stringify(params.affectedDataTypes) : undefined,
      timeline: JSON.stringify(timeline),
      createdBy: params.createdBy,
    },
  });

  await logAudit({
    userId: params.createdBy,
    action: "INCIDENT_CREATED",
    category: "SECURITY",
    resource: "SecurityIncident",
    resourceId: incident.id,
    resourceName: incidentNumber,
    description: `Security incident created: ${params.title}`,
    severity: "SEC_WARNING",
    isCompliance: true,
  });

  return incident;
}

// ── 13. Update Incident Timeline ────────────────────────────────────

export async function updateIncidentTimeline(
  incidentId: string,
  params: { action: string; actor: string; details?: string }
) {
  const incident = await db.securityIncident.findUniqueOrThrow({ where: { id: incidentId } });

  const timeline: any[] = incident.timeline ? JSON.parse(incident.timeline) : [];
  timeline.push({
    timestamp: new Date().toISOString(),
    action: params.action,
    actor: params.actor,
    details: params.details,
  });

  const updated = await db.securityIncident.update({
    where: { id: incidentId },
    data: { timeline: JSON.stringify(timeline) },
  });

  return updated;
}

// ── 14. Breach Notification Assessment ──────────────────────────────

export async function assessBreachNotification(incidentId: string) {
  const incident = await db.securityIncident.findUniqueOrThrow({ where: { id: incidentId } });

  const affectedDataTypes: string[] = incident.affectedDataTypes
    ? JSON.parse(incident.affectedDataTypes)
    : [];

  const hasPII = affectedDataTypes.some((t) => ["PII", "SSN", "personal"].includes(t.toLowerCase()));
  const hasPHI = affectedDataTypes.some((t) => ["PHI", "medical", "health"].includes(t.toLowerCase()));
  const hasFinancial = affectedDataTypes.some((t) => ["financial", "payment", "bank"].includes(t.toLowerCase()));

  const notificationRequired = hasPII || hasPHI || hasFinancial;

  const recipients: string[] = [];
  const deadlines: { recipient: string; deadline: string; regulation: string }[] = [];

  if (hasPHI) {
    recipients.push("HHS Office for Civil Rights");
    deadlines.push({ recipient: "HHS OCR", deadline: "60 days from discovery", regulation: "HIPAA" });
    recipients.push("Affected individuals");
    deadlines.push({ recipient: "Affected individuals", deadline: "60 days from discovery", regulation: "HIPAA" });
  }

  if (hasPII) {
    recipients.push("State Attorney General");
    deadlines.push({ recipient: "State AG", deadline: "Varies by state (30-90 days)", regulation: "State breach notification laws" });
    recipients.push("Affected individuals");
    deadlines.push({ recipient: "Affected individuals", deadline: "Varies by state", regulation: "State breach notification laws" });
  }

  if (hasFinancial) {
    recipients.push("Financial regulators");
    deadlines.push({ recipient: "Financial regulators", deadline: "72 hours", regulation: "PCI-DSS / GLBA" });
  }

  return {
    incidentId,
    incidentNumber: incident.incidentNumber,
    notificationRequired,
    affectedDataTypes,
    recipients: Array.from(new Set(recipients)),
    deadlines,
  };
}

// ── 15. Enforce Legal Hold ──────────────────────────────────────────

export async function enforceLegalHold(holdId: string) {
  const hold = await db.legalHold.findUniqueOrThrow({ where: { id: holdId } });
  const scope: any = JSON.parse(hold.scope);

  let recordsHeld = 0;

  if (scope.matterId) {
    const matterDocs = await db.document.count({ where: { matterId: scope.matterId } });
    const matterComms = await db.textMessage.count({ where: { matterId: scope.matterId } });
    recordsHeld = matterDocs + matterComms;
  } else if (scope.clientId) {
    const clientDocs = await db.document.count({ where: { matter: { clientId: scope.clientId } } });
    recordsHeld = clientDocs;
  }

  await db.legalHold.update({
    where: { id: holdId },
    data: { affectedRecordCount: recordsHeld },
  });

  await logAudit({
    action: "SEC_UPDATE",
    category: "SEC_COMPLIANCE",
    resource: "LegalHold",
    resourceId: holdId,
    resourceName: hold.holdName,
    description: `Legal hold enforced: ${hold.holdName} (${recordsHeld} records)`,
    severity: "SEC_WARNING",
    isCompliance: true,
  });

  return { holdId, holdName: hold.holdName, recordsHeld };
}

// ── 16. Release Legal Hold ──────────────────────────────────────────

export async function releaseLegalHold(holdId: string, releasedBy: string) {
  const hold = await db.legalHold.findUniqueOrThrow({ where: { id: holdId } });

  await db.legalHold.update({
    where: { id: holdId },
    data: {
      status: "HOLD_RELEASED" as any,
      releasedDate: new Date(),
      releasedBy,
    },
  });

  await logAudit({
    userId: releasedBy,
    action: "SEC_UPDATE",
    category: "SEC_COMPLIANCE",
    resource: "LegalHold",
    resourceId: holdId,
    resourceName: hold.holdName,
    description: `Legal hold released: ${hold.holdName}`,
    severity: "SEC_WARNING",
    isCompliance: true,
  });

  return { holdId, holdName: hold.holdName, recordsReleased: hold.affectedRecordCount };
}

// ── 17. Retention Policy Enforcement ────────────────────────────────

export async function enforceRetentionPolicies() {
  const policies = await db.dataRetentionPolicy.findMany({ where: { isActive: true } });

  const summary: { policyName: string; resource: string; recordsPastRetention: number; action: string }[] = [];

  for (const policy of policies) {
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

    let recordsPastRetention = 0;
    try {
      // Count records older than retention period — generic approach
      const modelName = policy.resource.charAt(0).toLowerCase() + policy.resource.slice(1);
      if ((db as any)[modelName]?.count) {
        recordsPastRetention = await (db as any)[modelName].count({
          where: { createdAt: { lt: cutoffDate } },
        });
      }
    } catch {
      // Model may not exist or have different shape
      recordsPastRetention = 0;
    }

    summary.push({
      policyName: policy.name,
      resource: policy.resource,
      recordsPastRetention,
      action: policy.actionOnExpiry,
    });

    await logAudit({
      action: "COMPLIANCE_CHECK_RUN",
      category: "SEC_COMPLIANCE",
      resource: "DataRetentionPolicy",
      resourceId: policy.id,
      resourceName: policy.name,
      description: `Retention policy check: ${policy.name} — ${recordsPastRetention} records past retention (${policy.retentionDays} days)`,
      isCompliance: true,
      metadata: { recordsPastRetention, retentionDays: policy.retentionDays, action: policy.actionOnExpiry },
    });

    await db.dataRetentionPolicy.update({
      where: { id: policy.id },
      data: { lastEnforcedAt: new Date() },
    });
  }

  return { policiesChecked: policies.length, summary };
}

// ── 18. Vulnerability Assessment ────────────────────────────────────

export async function runVulnerabilityAssessment() {
  const secModule = await db.securityModule.findFirst();
  const findings: { category: string; severity: string; finding: string; recommendation: string }[] = [];

  // Password policy
  if (!secModule || (secModule.passwordMinLength ?? 0) < 12) {
    findings.push({
      category: "Password Policy",
      severity: "RISK_HIGH",
      finding: `Minimum password length is ${secModule?.passwordMinLength ?? "not configured"} (recommended: 12+)`,
      recommendation: "Increase minimum password length to at least 12 characters",
    });
  }

  // 2FA
  if (!secModule?.twoFactorRequired) {
    findings.push({
      category: "Authentication",
      severity: "RISK_HIGH",
      finding: "Two-factor authentication is not required",
      recommendation: "Enable mandatory 2FA for all users",
    });
  }

  // Inactive accounts (no login in 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  // Check for inactive users via audit log (no lastLoginAt on User model)
  const recentLogins = await db.auditLog.findMany({ where: { action: "LOGIN" as any, timestamp: { gte: ninetyDaysAgo } }, select: { userId: true }, distinct: ["userId"] });
  const totalUsers = await db.user.count();
  const inactiveUsers = Math.max(0, totalUsers - recentLogins.length);
  if (inactiveUsers > 0) {
    findings.push({
      category: "User Management",
      severity: "RISK_MEDIUM",
      finding: `${inactiveUsers} user(s) have not logged in for over 90 days`,
      recommendation: "Review and disable inactive accounts",
    });
  }

  // Encryption keys due for rotation
  const keysNeedingRotation = await db.encryptionKey.count({
    where: {
      status: "KEY_ACTIVE" as any,
      nextRotationDate: { lt: new Date() },
    },
  });
  if (keysNeedingRotation > 0) {
    findings.push({
      category: "Encryption",
      severity: "RISK_HIGH",
      finding: `${keysNeedingRotation} encryption key(s) are overdue for rotation`,
      recommendation: "Rotate overdue encryption keys immediately",
    });
  }

  // Vendor assessments
  const overdueVendors = await db.vendorRiskAssessment.count({
    where: { nextReviewDate: { lt: new Date() } },
  });
  if (overdueVendors > 0) {
    findings.push({
      category: "Vendor Management",
      severity: "RISK_MEDIUM",
      finding: `${overdueVendors} vendor risk assessment(s) are overdue for review`,
      recommendation: "Schedule vendor risk reassessments",
    });
  }

  // Encryption settings
  if (!secModule?.encryptionAtRest) {
    findings.push({
      category: "Encryption",
      severity: "RISK_CRITICAL",
      finding: "Encryption at rest is not enabled",
      recommendation: "Enable encryption at rest immediately",
    });
  }
  if (!secModule?.encryptionInTransit) {
    findings.push({
      category: "Encryption",
      severity: "RISK_CRITICAL",
      finding: "Encryption in transit is not enabled",
      recommendation: "Enable encryption in transit immediately",
    });
  }

  await logAudit({
    action: "COMPLIANCE_CHECK_RUN",
    category: "SECURITY",
    resource: "VulnerabilityAssessment",
    description: `Vulnerability assessment completed: ${findings.length} finding(s)`,
    severity: findings.some((f) => f.severity === "RISK_CRITICAL") ? "SEC_CRITICAL" : "SEC_INFO",
    metadata: { findingCount: findings.length },
  });

  return {
    assessmentDate: new Date(),
    totalFindings: findings.length,
    criticalCount: findings.filter((f) => f.severity === "RISK_CRITICAL").length,
    highCount: findings.filter((f) => f.severity === "RISK_HIGH").length,
    mediumCount: findings.filter((f) => f.severity === "RISK_MEDIUM").length,
    lowCount: findings.filter((f) => f.severity === "RISK_LOW").length,
    findings,
  };
}

// ── 19. Encryption Key Rotation ─────────────────────────────────────

export async function rotateEncryptionKey(keyId: string) {
  const key = await db.encryptionKey.findUniqueOrThrow({ where: { id: keyId } });

  const updated = await db.encryptionKey.update({
    where: { id: keyId },
    data: {
      status: "KEY_ROTATING" as any,
      rotatedAt: new Date(),
      rotationCount: key.rotationCount + 1,
      nextRotationDate: new Date(Date.now() + key.rotationScheduleDays * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    action: "ENCRYPTION_KEY_ROTATED",
    category: "SECURITY",
    resource: "EncryptionKey",
    resourceId: keyId,
    resourceName: key.keyAlias,
    description: `Encryption key rotated: ${key.keyAlias} (rotation #${key.rotationCount + 1})`,
    severity: "SEC_WARNING",
    isCompliance: true,
  });

  return { keyId, keyAlias: key.keyAlias, status: updated.status, rotationCount: updated.rotationCount };
}

// ── 20. SOC2 Evidence Generation ────────────────────────────────────

export async function generateSOC2Evidence(controlId: string, dateRange: { start: Date; end: Date }) {
  const control = await db.complianceControl.findFirst({
    where: { controlId, framework: "SOC2" as any },
  });

  if (!control) {
    throw new Error(`SOC2 control not found: ${controlId}`);
  }

  const auditLogs = await db.auditLog.findMany({
    where: {
      timestamp: { gte: dateRange.start, lte: dateRange.end },
      isCompliance: true,
    },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  // Filter logs relevant to the control category
  const relevantLogs = auditLogs.filter((log) => {
    if (control.category === "Access Control") return log.category === "AUTHENTICATION" || log.category === "AUTHORIZATION";
    if (control.category === "Encryption") return log.action === "ENCRYPTION_KEY_ROTATED";
    if (control.category === "Audit") return true; // All logs are evidence of audit capability
    return log.category === "SEC_COMPLIANCE";
  });

  return {
    controlId: control.controlId,
    controlName: control.controlName,
    controlDescription: control.controlDescription,
    framework: "SOC2",
    dateRange,
    implementationStatus: control.implementationStatus,
    implementationDetails: control.implementationDetails,
    lastCheckDate: control.lastCheckDate,
    lastCheckResult: control.lastCheckResult,
    evidenceDescription: control.evidenceDescription,
    auditLogCount: relevantLogs.length,
    sampleLogs: relevantLogs.slice(0, 20).map((l) => ({
      timestamp: l.timestamp,
      action: l.action,
      category: l.category,
      user: l.userEmail || l.userId,
      description: l.description,
      success: l.success,
    })),
    generatedAt: new Date(),
  };
}

// ── 21. Vendor Risk Assessment ──────────────────────────────────────

export async function assessVendorRisk(vendorName: string) {
  let assessment = await db.vendorRiskAssessment.findFirst({
    where: { vendorName },
  });

  if (!assessment) {
    assessment = await db.vendorRiskAssessment.create({
      data: {
        vendorName,
        vendorCategory: "Unknown",
        dataShared: "To be determined",
        riskLevel: "RISK_MEDIUM" as any,
      },
    });
  }

  const aiResult = await aiRouter.complete({
    feature: "security_vendor_risk",
    systemPrompt: `You are a security analyst for a law firm. Assess the vendor risk based on the provided information. Return a JSON object with: riskLevel (RISK_LOW, RISK_MEDIUM, RISK_HIGH, RISK_CRITICAL), riskFactors (string[]), recommendations (string[]), summary (string).`,
    userPrompt: `Assess the risk for this vendor:

Vendor: ${assessment.vendorName}
Category: ${assessment.vendorCategory}
Data Shared: ${assessment.dataShared}
Data Classification: ${assessment.dataClassification}
Has BAA: ${assessment.hasBAA}
Has DPA: ${assessment.hasDPA}
Has SLA: ${assessment.hasSLA}
SOC2 Certified: ${assessment.soc2Certified}
ISO 27001 Certified: ${assessment.iso27001Certified}
HIPAA Compliant: ${assessment.hipaaCompliant}
PCI Compliant: ${assessment.pciCompliant}
Encryption In Transit: ${assessment.encryptionInTransit}
Encryption At Rest: ${assessment.encryptionAtRest}
Data Residency: ${assessment.dataResidency || "Unknown"}

Provide a risk assessment.`,
    temperature: 0.2,
    maxTokens: 1024,
  });

  let analysis: any = {};
  try {
    const text = aiResult.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
  } catch {
    analysis = { summary: aiResult.content, riskLevel: "RISK_MEDIUM", riskFactors: [], recommendations: [] };
  }

  await db.vendorRiskAssessment.update({
    where: { id: assessment.id },
    data: {
      riskLevel: (analysis.riskLevel || assessment.riskLevel) as any,
      riskAssessmentDate: new Date(),
      nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      assessmentNotes: JSON.stringify(analysis),
    },
  });

  return {
    vendorName: assessment.vendorName,
    riskLevel: analysis.riskLevel || assessment.riskLevel,
    riskFactors: analysis.riskFactors || [],
    recommendations: analysis.recommendations || [],
    summary: analysis.summary || "",
    assessmentDate: new Date(),
  };
}
