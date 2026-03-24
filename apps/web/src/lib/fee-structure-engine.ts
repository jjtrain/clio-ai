import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TEMPLATE APPLICATION
// ==========================================

export async function applyTemplateToMatter(matterId: string, templateId: string, userId: string, firmId: string): Promise<any> {
  const template = await db.feeStructureTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Template not found");

  const structure = await db.matterFeeStructure.upsert({
    where: { matterId },
    create: {
      matterId,
      templateId,
      templateName: template.name,
      phases: template.phases as any,
      contingencySchedule: template.contingencySchedule as any,
      retainerRequired: template.retainerRequired,
      retainerAmount: template.retainerAmount,
      retainerType: template.retainerType,
      expenseHandling: template.expenseHandling,
      expenseCap: template.expenseCap,
      totalEstimate: template.totalEstimate as any,
      clientFacingDescription: template.clientFacingDescription,
      budgetAlertThreshold: 0.8,
      userId,
      firmId,
    },
    update: {
      templateId,
      templateName: template.name,
      phases: template.phases as any,
      contingencySchedule: template.contingencySchedule as any,
      totalEstimate: template.totalEstimate as any,
    },
  });

  // Create initial phase completions
  const phases = template.phases as any[];
  if (phases.length > 0) {
    await db.phaseCompletion.create({
      data: {
        feeStructureId: structure.id,
        phaseId: phases[0].id || "phase-1",
        phaseName: phases[0].name,
        billingModel: phases[0].billingModel,
        status: "active",
        startedAt: new Date(),
        flatFeeAmount: phases[0].flatFeeAmount,
        capAmount: phases[0].capAmount,
        userId,
        firmId,
      },
    });

    await db.matterFeeStructure.update({
      where: { id: structure.id },
      data: { currentPhaseId: phases[0].id || "phase-1" },
    });
  }

  return structure;
}

// ==========================================
// PHASE MANAGEMENT
// ==========================================

export async function completePhase(matterId: string, phaseId: string, data: { recoveryAmount?: number; notes?: string }, userId: string, firmId: string): Promise<void> {
  const structure = await db.matterFeeStructure.findUnique({ where: { matterId }, include: { phaseCompletions: true } });
  if (!structure) throw new Error("Fee structure not found");

  // Complete current phase
  await db.phaseCompletion.updateMany({
    where: { feeStructureId: structure.id, phaseId },
    data: { status: "completed", completedAt: new Date(), recoveryAmount: data.recoveryAmount, notes: data.notes },
  });

  // Activate next phase
  const phases = structure.phases as any[];
  const currentIdx = phases.findIndex((p: any) => (p.id || `phase-${phases.indexOf(p) + 1}`) === phaseId);
  if (currentIdx >= 0 && currentIdx < phases.length - 1) {
    const next = phases[currentIdx + 1];
    const nextId = next.id || `phase-${currentIdx + 2}`;

    await db.phaseCompletion.create({
      data: {
        feeStructureId: structure.id,
        phaseId: nextId,
        phaseName: next.name,
        billingModel: next.billingModel,
        status: "active",
        startedAt: new Date(),
        flatFeeAmount: next.flatFeeAmount,
        capAmount: next.capAmount,
        userId,
        firmId,
      },
    });

    await db.matterFeeStructure.update({
      where: { matterId },
      data: { currentPhaseId: nextId },
    });
  } else {
    await db.matterFeeStructure.update({
      where: { matterId },
      data: { currentPhaseId: null, status: "completed" },
    });
  }
}

// ==========================================
// CONTINGENCY CALCULATION
// ==========================================

export function calculateContingencyFee(schedule: any[], recoveryAmount: number, expenses: number = 0): {
  grossRecovery: number; expenses: number; netRecovery: number;
  applicableTier: string; feePercentage: number; fee: number; clientNet: number;
} {
  if (!schedule || schedule.length === 0) {
    return { grossRecovery: recoveryAmount, expenses, netRecovery: recoveryAmount - expenses, applicableTier: "Standard", feePercentage: 33.33, fee: recoveryAmount * 0.3333, clientNet: recoveryAmount * 0.6667 - expenses };
  }

  // Find applicable tier (last matching)
  let tier = schedule[0];
  for (const t of schedule) {
    if (!t.minRecovery || recoveryAmount >= t.minRecovery) tier = t;
  }

  const base = tier.base === "net" ? recoveryAmount - expenses : recoveryAmount;
  const fee = Math.min(base * (tier.percentage / 100), tier.cappedAt || Infinity);
  const clientNet = recoveryAmount - expenses - fee;

  return {
    grossRecovery: recoveryAmount,
    expenses,
    netRecovery: recoveryAmount - expenses,
    applicableTier: tier.tierName || tier.tier,
    feePercentage: tier.percentage,
    fee,
    clientNet,
  };
}

// ==========================================
// BUDGET TRACKING
// ==========================================

export async function checkBudgetStatus(matterId: string): Promise<{
  totalBilled: number; totalEstimateLow: number; totalEstimateHigh: number;
  percentUsed: number; isOverBudget: boolean; alertNeeded: boolean;
  phases: Array<{ name: string; model: string; billed: number; estimateLow: number; estimateHigh: number; status: string }>;
}> {
  const structure = await db.matterFeeStructure.findUnique({
    where: { matterId },
    include: { phaseCompletions: true },
  });

  if (!structure) return { totalBilled: 0, totalEstimateLow: 0, totalEstimateHigh: 0, percentUsed: 0, isOverBudget: false, alertNeeded: false, phases: [] };

  const estimate = (structure.totalEstimate as any) || {};
  const totalBilled = structure.phaseCompletions.reduce((sum, p) => sum + p.amountBilled, 0);
  const totalHigh = estimate.high || 0;
  const percentUsed = totalHigh > 0 ? totalBilled / totalHigh : 0;
  const threshold = structure.budgetAlertThreshold || 0.8;

  const phases = structure.phaseCompletions.map((p) => ({
    name: p.phaseName,
    model: p.billingModel,
    billed: p.amountBilled,
    estimateLow: 0,
    estimateHigh: p.capAmount || 0,
    status: p.status,
  }));

  return {
    totalBilled,
    totalEstimateLow: estimate.low || 0,
    totalEstimateHigh: totalHigh,
    percentUsed: Math.round(percentUsed * 100),
    isOverBudget: totalBilled > totalHigh && totalHigh > 0,
    alertNeeded: percentUsed >= threshold && !structure.budgetAlertTriggered,
    phases,
  };
}

// ==========================================
// CLIENT FEE EXPLANATION
// ==========================================

export async function generateClientFeeExplanation(matterId: string): Promise<string> {
  const structure = await db.matterFeeStructure.findUnique({ where: { matterId } });
  if (!structure) return "Fee information will be available soon.";

  if (structure.clientFacingDescription) return structure.clientFacingDescription;

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "You are a legal billing assistant. Write a clear, plain-English explanation of a law firm's fee structure for a client. Be warm and transparent. No jargon. Explain each phase simply.",
      messages: [{ role: "user", content: `Fee structure: ${JSON.stringify(structure.phases)}\nExpense handling: ${structure.expenseHandling}\nRetainer: ${structure.retainerRequired ? `$${structure.retainerAmount} (${structure.retainerType})` : "None"}\n\nWrite a client-friendly explanation.` }],
    });
    return response.content[0]?.type === "text" ? response.content[0].text : "Please ask your attorney about your fee arrangement.";
  } catch {
    return "Please ask your attorney about your fee arrangement.";
  }
}

// ==========================================
// RATE LOOKUP
// ==========================================

export async function getEffectiveRate(matterId: string, attorneyId: string | null, role: string, firmId: string): Promise<number> {
  // Check matter-specific rate first
  if (matterId) {
    const matterRate = await db.hourlyRateSchedule.findFirst({
      where: { matterId, role, effectiveDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
      orderBy: { effectiveDate: "desc" },
    });
    if (matterRate) return matterRate.rate;
  }

  // Fall back to firm default
  const firmRate = await db.hourlyRateSchedule.findFirst({
    where: { matterId: null, firmId, role, effectiveDate: { lte: new Date() } },
    orderBy: { effectiveDate: "desc" },
  });

  return firmRate?.rate || 350; // fallback default
}
