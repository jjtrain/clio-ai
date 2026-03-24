import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TYPES
// ==========================================

export interface AuditableEntry {
  id: string;
  matterId: string;
  matterName?: string;
  userId: string;
  attorney?: string;
  description: string;
  duration: number; // minutes
  hours: number;
  date: Date;
  rate?: number;
  amount?: number;
  billable: boolean;
  taskCategory?: string;
  activityCode?: string;
  status?: string;
}

export interface AuditFlag {
  timeEntryId?: string;
  invoiceId?: string;
  flagType: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  description: string;
  recommendation?: string;
  suggestedDescription?: string;
  suggestedHours?: number;
  currentValue?: string;
  expectedValue?: string;
  ruleReference?: string;
  financialImpact?: number;
  sortOrder?: number;
}

export interface AuditResult {
  flags: AuditFlag[];
  grade: string;
  summary: string;
  recommendations: Array<{ action: string; priority: string; impact: string }>;
  estimatedSavings: number;
  estimatedRisk: number;
  totalEntriesReviewed: number;
  totalHoursReviewed: number;
  totalAmountReviewed: number;
}

interface Guideline {
  id: string;
  name: string;
  guidelineType: string;
  rule: any;
  description: string;
  practiceArea?: string | null;
  clientId?: string | null;
}

interface Benchmark {
  taskCategory: string;
  practiceArea?: string | null;
  experienceLevel?: string | null;
  minHours: number;
  maxHours: number;
  avgHours: number;
}

// ==========================================
// MAIN AUDIT FUNCTION
// ==========================================

export async function runFullAudit(params: {
  entries: AuditableEntry[];
  matterId?: string;
  invoiceId?: string;
  auditType: string;
  guidelines?: Guideline[];
  benchmarks?: Benchmark[];
}): Promise<AuditResult> {
  const { entries, guidelines = [], benchmarks = [] } = params;

  if (entries.length === 0) {
    return {
      flags: [],
      grade: "A",
      summary: "No time entries to audit.",
      recommendations: [],
      estimatedSavings: 0,
      estimatedRisk: 0,
      totalEntriesReviewed: 0,
      totalHoursReviewed: 0,
      totalAmountReviewed: 0,
    };
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 1. Run all rule-based checks (fast, deterministic)
  const ruleFlags: AuditFlag[] = [
    ...checkBlockBilling(entries),
    ...checkDuplicateEntries(entries),
    ...checkRateConsistency(entries),
    ...checkRoundedTime(entries),
    ...checkWeekendAfterHours(entries),
    ...checkChronologicalGaps(entries),
    ...checkMultipleAttorneysSameTask(entries),
    ...checkGuidelineCompliance(entries, guidelines),
  ];

  // 2. Run AI-powered analysis
  let aiFlags: AuditFlag[] = [];
  try {
    const descriptionFlags = await analyzeDescriptionQuality(entries);
    const timeFlags = await analyzeTimeReasonableness(entries, benchmarks);
    aiFlags = [...descriptionFlags, ...timeFlags];
  } catch (error) {
    console.error("[BillingAudit] AI analysis failed, continuing with rule-based checks only:", error);
  }

  const allFlags = [...ruleFlags, ...aiFlags];

  // Assign sort order by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  allFlags.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));
  allFlags.forEach((f, i) => { f.sortOrder = i; });

  // 3. Score and grade
  const grade = calculateGrade(allFlags);
  const estimatedRisk = allFlags.reduce((sum, f) => sum + (f.financialImpact || 0), 0);
  const estimatedSavings = estimatedRisk * 0.7; // catching issues saves ~70% of risk

  // 4. Generate summary and recommendations
  const summary = generateSummary(entries, allFlags, grade, totalHours, totalAmount);
  const recommendations = generateRecommendations(allFlags);

  return {
    flags: allFlags,
    grade,
    summary,
    recommendations,
    estimatedSavings,
    estimatedRisk,
    totalEntriesReviewed: entries.length,
    totalHoursReviewed: totalHours,
    totalAmountReviewed: totalAmount,
  };
}

// ==========================================
// RULE-BASED CHECKS
// ==========================================

export function checkBlockBilling(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const actionVerbs = /\b(research|draft|review|prepare|attend|confer|analyz|discuss|meet|call|email|correspond|file|negotiate|depos|exam|interview|investigate)\w*/gi;
  const taskSeparators = /[;]|\band\b|\//g;

  for (const entry of entries) {
    const desc = entry.description;
    const tasks = desc.split(taskSeparators).filter((t) => t.trim().length > 5);
    const verbMatches = desc.match(actionVerbs) || [];
    const uniqueVerbs = new Set(verbMatches.map((v) => v.toLowerCase().slice(0, 6)));

    if (tasks.length >= 3 || (entry.hours > 2 && uniqueVerbs.size >= 3)) {
      const severity = entry.hours > 2 ? "high" : "medium";
      flags.push({
        timeEntryId: entry.id,
        flagType: "block_billing",
        severity,
        category: "description_quality",
        title: "Block billing detected",
        description: `Entry contains ${tasks.length >= 3 ? tasks.length : uniqueVerbs.size} distinct tasks billed as a single ${entry.hours}h entry. Block billing makes it impossible for clients to evaluate reasonableness of time spent on each task.`,
        recommendation: `Break into ${tasks.length >= 3 ? tasks.length : uniqueVerbs.size} separate entries with individual time allocations for each task.`,
        currentValue: `${entry.hours}h combined for ${uniqueVerbs.size} tasks`,
        financialImpact: entry.amount ? entry.amount * 0.15 : undefined,
      });
    } else if (entry.hours > 3 && uniqueVerbs.size >= 2 && !desc.includes(":")) {
      flags.push({
        timeEntryId: entry.id,
        flagType: "block_billing",
        severity: "medium",
        category: "description_quality",
        title: "Possible block billing",
        description: `${entry.hours}h entry with multiple tasks but no time allocation breakdown.`,
        recommendation: "Consider breaking into separate entries or adding task-level time allocations.",
        financialImpact: entry.amount ? entry.amount * 0.1 : undefined,
      });
    }
  }

  return flags;
}

export function checkDuplicateEntries(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];

      // Same attorney, same date
      if (a.userId === b.userId && isSameDay(a.date, b.date)) {
        const similarity = calculateSimilarity(a.description, b.description);

        if (similarity > 0.9) {
          flags.push({
            timeEntryId: a.id,
            flagType: "duplicate_entry",
            severity: "critical",
            category: "duplicate_detection",
            title: "Duplicate entry detected",
            description: `Near-identical entries on ${formatDate(a.date)}: "${a.description.slice(0, 80)}..." (${a.hours}h) and "${b.description.slice(0, 80)}..." (${b.hours}h). Similarity: ${Math.round(similarity * 100)}%.`,
            recommendation: "Remove one of the duplicate entries.",
            currentValue: `${a.hours + b.hours}h total`,
            expectedValue: `${Math.max(a.hours, b.hours)}h`,
            financialImpact: Math.min(a.amount || 0, b.amount || 0),
          });
        } else if (similarity > 0.7 && a.hours === b.hours) {
          flags.push({
            timeEntryId: a.id,
            flagType: "duplicate_entry",
            severity: "high",
            category: "duplicate_detection",
            title: "Possible duplicate entry",
            description: `Similar entries on ${formatDate(a.date)} with same hours (${a.hours}h). Review to confirm both are legitimate.`,
            recommendation: "Verify these are distinct billable activities.",
            financialImpact: Math.min(a.amount || 0, b.amount || 0) * 0.5,
          });
        }
      }
    }
  }

  return flags;
}

export function checkRateConsistency(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  // Group by attorney
  const byAttorney = groupBy(entries.filter((e) => e.rate), "userId");

  for (const [userId, attorneyEntries] of Object.entries(byAttorney)) {
    const rates = new Set(attorneyEntries.map((e) => e.rate));
    if (rates.size > 1) {
      const rateList = Array.from(rates).sort();
      flags.push({
        flagType: "rate_inconsistency",
        severity: "high",
        category: "rate_compliance",
        title: "Rate inconsistency",
        description: `Attorney has entries at different rates: ${rateList.map((r) => `$${r}/hr`).join(", ")}. Unless a rate change occurred, all entries should use the same rate.`,
        recommendation: "Verify the correct rate and update inconsistent entries.",
        currentValue: rateList.map((r) => `$${r}`).join(", "),
      });
    }
  }

  return flags;
}

export function checkRoundedTime(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  // Check for pattern of all round numbers
  const roundEntries = entries.filter((e) => e.hours === Math.round(e.hours));
  const roundPct = entries.length > 3 ? roundEntries.length / entries.length : 0;

  if (roundPct > 0.7 && entries.length >= 5) {
    flags.push({
      flagType: "rounded_time",
      severity: "medium",
      category: "time_accuracy",
      title: "Excessive time rounding pattern",
      description: `${Math.round(roundPct * 100)}% of entries (${roundEntries.length}/${entries.length}) are round numbers. This pattern suggests time is being estimated rather than tracked accurately.`,
      recommendation: "Use a timer or more granular time tracking to improve accuracy.",
    });
  }

  // Check minimum billing padding (e.g., 0.5h for quick tasks)
  for (const entry of entries) {
    const desc = entry.description.toLowerCase();
    const isQuickTask = /\b(email|voicemail|quick|brief|short)\b/.test(desc) &&
      !/\b(draft|review|research|prepare|extensive)\b/.test(desc);

    if (isQuickTask && entry.hours >= 0.5) {
      flags.push({
        timeEntryId: entry.id,
        flagType: "minimum_billing_excessive",
        severity: "low",
        category: "time_accuracy",
        title: "Potential minimum billing padding",
        description: `"${entry.description.slice(0, 80)}" billed at ${entry.hours}h — this appears to be a quick task that may be padded to meet a minimum billing increment.`,
        recommendation: "Verify actual time spent; consider reducing to 0.1-0.2h for brief communications.",
        currentValue: `${entry.hours}h`,
        expectedValue: "0.1-0.2h",
        financialImpact: entry.rate ? (entry.hours - 0.2) * Number(entry.rate) : undefined,
      });
    }
  }

  return flags;
}

export function checkWeekendAfterHours(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  const weekendEntries = entries.filter((e) => {
    const day = new Date(e.date).getDay();
    return day === 0 || day === 6;
  });

  if (weekendEntries.length > 3) {
    const totalWeekendHours = weekendEntries.reduce((sum, e) => sum + e.hours, 0);
    flags.push({
      flagType: "weekend_billing",
      severity: "info",
      category: "pattern_analysis",
      title: "Weekend billing pattern",
      description: `${weekendEntries.length} entries totaling ${totalWeekendHours.toFixed(1)}h billed on weekends. While legitimate, some clients may question weekend work.`,
      recommendation: "Ensure weekend work was necessary and descriptions explain the urgency.",
    });
  }

  return flags;
}

export function checkChronologicalGaps(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  if (entries.length < 3) return flags;

  // Group by matter
  const byMatter = groupBy(entries, "matterId");

  for (const [matterId, matterEntries] of Object.entries(byMatter)) {
    const sorted = [...matterEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = daysBetween(new Date(prev.date), new Date(curr.date));

      if (gap > 14 && curr.hours > 5) {
        flags.push({
          timeEntryId: curr.id,
          flagType: "chronological_gap",
          severity: "medium",
          category: "pattern_analysis",
          title: "Billing gap followed by large entry",
          description: `${gap}-day gap in billing on this matter, followed by a ${curr.hours}h entry. This may indicate time reconstruction rather than contemporaneous recording.`,
          recommendation: "Verify time was tracked contemporaneously. If reconstructed, add a note explaining the gap.",
        });
      }
    }
  }

  return flags;
}

export function checkMultipleAttorneysSameTask(entries: AuditableEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  // Group by date + matter
  const grouped = new Map<string, AuditableEntry[]>();
  for (const entry of entries) {
    const key = `${formatDate(entry.date)}-${entry.matterId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  for (const [, group] of Array.from(grouped)) {
    if (group.length < 2) continue;

    // Find entries with similar descriptions from different attorneys
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].userId === group[j].userId) continue;

        const similarity = calculateSimilarity(group[i].description, group[j].description);
        if (similarity > 0.6) {
          flags.push({
            timeEntryId: group[i].id,
            flagType: "multiple_attorneys_same_task",
            severity: "medium",
            category: "value_justification",
            title: "Multiple attorneys billing similar task",
            description: `Two attorneys billed for similar work on ${formatDate(group[i].date)}: "${group[i].description.slice(0, 60)}..." (${group[i].hours}h) and "${group[j].description.slice(0, 60)}..." (${group[j].hours}h). Total: ${(group[i].hours + group[j].hours).toFixed(1)}h.`,
            recommendation: "Verify both attorneys' involvement was necessary. If legitimate (e.g., second chair), add justification to descriptions.",
            financialImpact: Math.min(group[i].amount || 0, group[j].amount || 0),
          });
        }
      }
    }
  }

  return flags;
}

export function checkGuidelineCompliance(entries: AuditableEntry[], guidelines: Guideline[]): AuditFlag[] {
  const flags: AuditFlag[] = [];

  for (const guideline of guidelines) {
    const rule = guideline.rule as any;
    if (!rule) continue;

    switch (guideline.guidelineType) {
      case "task_time_limit": {
        // e.g., rule: { taskCategory: "research", maxHoursPerMonth: 10 }
        if (rule.taskCategory && rule.maxHoursPerMonth) {
          const matching = entries.filter((e) => e.taskCategory === rule.taskCategory);
          const totalHours = matching.reduce((sum, e) => sum + e.hours, 0);
          if (totalHours > rule.maxHoursPerMonth) {
            flags.push({
              flagType: "guideline_violation",
              severity: "high",
              category: "guideline_compliance",
              title: `Exceeds ${rule.taskCategory} time limit`,
              description: `${totalHours.toFixed(1)}h of ${rule.taskCategory} exceeds the ${rule.maxHoursPerMonth}h monthly limit per ${guideline.name}.`,
              recommendation: `Reduce ${rule.taskCategory} time to within ${rule.maxHoursPerMonth}h or obtain pre-approval for excess.`,
              currentValue: `${totalHours.toFixed(1)}h`,
              expectedValue: `≤ ${rule.maxHoursPerMonth}h`,
              ruleReference: guideline.name,
            });
          }
        }
        break;
      }

      case "rate_cap": {
        // e.g., rule: { maxRate: 450 }
        if (rule.maxRate) {
          for (const entry of entries) {
            if (entry.rate && entry.rate > rule.maxRate) {
              flags.push({
                timeEntryId: entry.id,
                flagType: "guideline_violation",
                severity: "high",
                category: "rate_compliance",
                title: "Rate exceeds client cap",
                description: `Rate $${entry.rate}/hr exceeds the cap of $${rule.maxRate}/hr per ${guideline.name}.`,
                recommendation: `Reduce rate to $${rule.maxRate}/hr or obtain client approval for the higher rate.`,
                currentValue: `$${entry.rate}/hr`,
                expectedValue: `≤ $${rule.maxRate}/hr`,
                ruleReference: guideline.name,
                financialImpact: entry.hours * (Number(entry.rate) - rule.maxRate),
              });
            }
          }
        }
        break;
      }

      case "prohibited_task": {
        // e.g., rule: { keywords: ["file organization", "internal conference"] }
        if (rule.keywords) {
          for (const entry of entries) {
            const desc = entry.description.toLowerCase();
            for (const keyword of rule.keywords) {
              if (desc.includes(keyword.toLowerCase())) {
                flags.push({
                  timeEntryId: entry.id,
                  flagType: "guideline_violation",
                  severity: "high",
                  category: "guideline_compliance",
                  title: "Prohibited task billed",
                  description: `Entry includes "${keyword}" which is a non-billable task per ${guideline.name}.`,
                  recommendation: "Remove this entry or mark as non-billable.",
                  ruleReference: guideline.name,
                  financialImpact: entry.amount,
                });
              }
            }
          }
        }
        break;
      }

      case "block_billing_rule": {
        // Client prohibits block billing entirely
        for (const entry of entries) {
          const verbs = entry.description.match(/\b(research|draft|review|prepare|attend|confer|analyz)\w*/gi) || [];
          if (new Set(verbs.map((v) => v.toLowerCase().slice(0, 6))).size >= 2 && entry.hours > 1) {
            flags.push({
              timeEntryId: entry.id,
              flagType: "guideline_violation",
              severity: "critical",
              category: "guideline_compliance",
              title: "Block billing prohibited by client",
              description: `Client guidelines prohibit block billing. Entry "${entry.description.slice(0, 80)}..." contains multiple tasks in a single entry.`,
              recommendation: "Break into separate entries with individual time for each task.",
              ruleReference: guideline.name,
            });
          }
        }
        break;
      }
    }
  }

  return flags;
}

// ==========================================
// AI-POWERED ANALYSIS
// ==========================================

const DESCRIPTION_ANALYSIS_PROMPT = `You are a legal billing compliance expert. Analyze these time entries for description quality issues.

For each problematic entry, return a JSON array of flags:
[
  {
    "entryId": "id",
    "flagType": "vague_description" | "no_value_description" | "missing_detail",
    "severity": "high" | "medium" | "low",
    "title": "short title",
    "description": "explanation of the issue",
    "suggestedDescription": "improved description text",
    "recommendation": "what to fix"
  }
]

Flag entries that:
1. "vague_description": Use generic language like "Work on case", "Legal research", "Review documents" without specifics (what was researched? which documents? what issue?)
2. "no_value_description": Describe administrative tasks as attorney work ("Organize file", "Update calendar", "Save document")
3. "missing_detail": Missing critical details — what motion was drafted? which witness was prepared? what was the court appearance for?

Good descriptions include: specific document names, motion types, witness names, legal issues researched, opposing party actions responded to, and case milestones.

Only flag genuinely problematic entries. Do not flag entries that are already specific enough. Return [] if no issues found.
Return ONLY the JSON array, nothing else.`;

export async function analyzeDescriptionQuality(entries: AuditableEntry[]): Promise<AuditFlag[]> {
  if (entries.length === 0) return [];

  const anthropic = new Anthropic();
  const entrySummary = entries.slice(0, 50).map((e) => ({
    id: e.id,
    description: e.description,
    hours: e.hours,
    date: formatDate(e.date),
    taskCategory: e.taskCategory,
  }));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: DESCRIPTION_ANALYSIS_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(entrySummary, null, 2) }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((f: any) => ({
      timeEntryId: f.entryId,
      flagType: f.flagType || "vague_description",
      severity: f.severity || "medium",
      category: "description_quality",
      title: f.title || "Description quality issue",
      description: f.description,
      recommendation: f.recommendation,
      suggestedDescription: f.suggestedDescription,
    }));
  } catch {
    return [];
  }
}

const TIME_ANALYSIS_PROMPT = `You are a legal billing expert. Analyze these time entries for time reasonableness.

Benchmarks for common tasks:
- Brief email/voicemail: 0.1-0.2h
- Standard phone call: 0.2-0.5h
- Document review (per page): 0.05-0.1h
- Legal research (per issue): 1-4h
- Draft simple motion: 2-6h
- Draft complex motion: 4-12h
- Court appearance: 1-4h (plus prep)
- Deposition: 3-8h
- Client meeting: 0.5-2h
- Travel: actual time only

For each entry with unreasonable time, return JSON:
[
  {
    "entryId": "id",
    "flagType": "excessive_time",
    "severity": "high" | "medium",
    "title": "short title",
    "description": "why this seems excessive",
    "suggestedHours": 2.0,
    "recommendation": "what to do"
  }
]

Only flag clearly excessive entries. Return [] if all entries look reasonable.
Return ONLY the JSON array.`;

export async function analyzeTimeReasonableness(entries: AuditableEntry[], benchmarks: Benchmark[]): Promise<AuditFlag[]> {
  if (entries.length === 0) return [];

  const anthropic = new Anthropic();
  const entrySummary = entries.slice(0, 50).map((e) => ({
    id: e.id,
    description: e.description,
    hours: e.hours,
    date: formatDate(e.date),
    taskCategory: e.taskCategory,
  }));

  const benchmarkText = benchmarks.length > 0
    ? "\n\nFirm-specific benchmarks:\n" + benchmarks.map((b) =>
        `${b.taskCategory}: ${b.minHours}-${b.maxHours}h (avg ${b.avgHours}h)`
      ).join("\n")
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: TIME_ANALYSIS_PROMPT + benchmarkText,
    messages: [{ role: "user", content: JSON.stringify(entrySummary, null, 2) }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((f: any) => {
      const entry = entries.find((e) => e.id === f.entryId);
      return {
        timeEntryId: f.entryId,
        flagType: f.flagType || "excessive_time",
        severity: f.severity || "medium",
        category: "time_accuracy",
        title: f.title || "Excessive time",
        description: f.description,
        recommendation: f.recommendation,
        suggestedHours: f.suggestedHours,
        currentValue: entry ? `${entry.hours}h` : undefined,
        expectedValue: f.suggestedHours ? `${f.suggestedHours}h` : undefined,
        financialImpact: entry && f.suggestedHours && entry.rate
          ? (entry.hours - f.suggestedHours) * Number(entry.rate)
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

// ==========================================
// SCORING & GRADING
// ==========================================

function calculateGrade(flags: AuditFlag[]): string {
  if (flags.length === 0) return "A";

  const critical = flags.filter((f) => f.severity === "critical").length;
  const high = flags.filter((f) => f.severity === "high").length;
  const medium = flags.filter((f) => f.severity === "medium").length;

  const score = critical * 25 + high * 10 + medium * 3;

  if (score === 0) return "A";
  if (score <= 10) return "B";
  if (score <= 30) return "C";
  if (score <= 60) return "D";
  return "F";
}

function generateSummary(
  entries: AuditableEntry[],
  flags: AuditFlag[],
  grade: string,
  totalHours: number,
  totalAmount: number
): string {
  if (flags.length === 0) {
    return `Audit complete: ${entries.length} entries (${totalHours.toFixed(1)}h, $${totalAmount.toFixed(2)}) reviewed. No issues found — ready to send.`;
  }

  const critical = flags.filter((f) => f.severity === "critical").length;
  const high = flags.filter((f) => f.severity === "high").length;
  const medium = flags.filter((f) => f.severity === "medium").length;
  const low = flags.filter((f) => f.severity === "low").length;

  const parts: string[] = [];
  parts.push(`Audit complete: ${entries.length} entries (${totalHours.toFixed(1)}h, $${totalAmount.toFixed(2)}) reviewed.`);
  parts.push(`Grade: ${grade}.`);
  parts.push(`Found ${flags.length} issues:`);
  if (critical > 0) parts.push(`${critical} critical`);
  if (high > 0) parts.push(`${high} high`);
  if (medium > 0) parts.push(`${medium} medium`);
  if (low > 0) parts.push(`${low} low`);

  const totalImpact = flags.reduce((sum, f) => sum + (f.financialImpact || 0), 0);
  if (totalImpact > 0) {
    parts.push(`Estimated financial impact: $${totalImpact.toFixed(2)}.`);
  }

  if (grade === "F" || grade === "D") {
    parts.push("Resolve critical and high-severity issues before sending to client.");
  }

  return parts.join(" ");
}

function generateRecommendations(flags: AuditFlag[]): Array<{ action: string; priority: string; impact: string }> {
  const recommendations: Array<{ action: string; priority: string; impact: string }> = [];

  const typeCounts = flags.reduce<Record<string, number>>((acc, f) => {
    acc[f.flagType] = (acc[f.flagType] || 0) + 1;
    return acc;
  }, {});

  if (typeCounts.block_billing) {
    recommendations.push({
      action: `Split ${typeCounts.block_billing} block-billed entries into individual task entries`,
      priority: "high",
      impact: "Prevents client disputes over time allocation",
    });
  }

  if (typeCounts.duplicate_entry) {
    recommendations.push({
      action: `Review and remove ${typeCounts.duplicate_entry} potential duplicate entries`,
      priority: "critical",
      impact: "Prevents double-billing and client trust issues",
    });
  }

  if (typeCounts.vague_description || typeCounts.no_value_description || typeCounts.missing_detail) {
    const total = (typeCounts.vague_description || 0) + (typeCounts.no_value_description || 0) + (typeCounts.missing_detail || 0);
    recommendations.push({
      action: `Improve ${total} entry descriptions with specific details`,
      priority: "high",
      impact: "Reduces client write-down requests and billing inquiries",
    });
  }

  if (typeCounts.excessive_time) {
    recommendations.push({
      action: `Review ${typeCounts.excessive_time} entries with potentially excessive time`,
      priority: "medium",
      impact: "Ensures billing reflects actual work performed",
    });
  }

  if (typeCounts.rate_inconsistency || typeCounts.guideline_violation) {
    recommendations.push({
      action: "Review rate and guideline compliance issues",
      priority: "high",
      impact: "Maintains client billing agreement compliance",
    });
  }

  return recommendations;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function isSameDay(a: Date, b: Date): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of Array.from(wordsA)) {
    if (wordsB.has(word)) intersection++;
  }

  return (2 * intersection) / (wordsA.size + wordsB.size);
}

function groupBy<T extends Record<string, any>>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}
