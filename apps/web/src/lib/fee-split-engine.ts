import { db } from "@/lib/db";

export function calculateFeeSplit(params: {
  recoveryAmount: number; totalFeePercentage: number; expenses: number;
  participants: Array<{ id: string; splitPercentage: number; isOurFirm: boolean }>;
  splitBasis: string; tiers?: any[];
}): { totalFee: number; netFee: number; shares: Array<{ participantId: string; amount: number; isOurFirm: boolean }> } {
  let totalFee: number;

  if (params.tiers && params.tiers.length > 0) {
    // Tiered calculation
    const tier = params.tiers.find((t: any) => !t.maxRecovery || params.recoveryAmount <= t.maxRecovery) || params.tiers[params.tiers.length - 1];
    totalFee = params.recoveryAmount * (params.totalFeePercentage / 100);
  } else {
    totalFee = params.recoveryAmount * (params.totalFeePercentage / 100);
  }

  const base = params.splitBasis === "net_recovery" ? totalFee - params.expenses : totalFee;

  const shares = params.participants.map((p) => ({
    participantId: p.id,
    amount: Math.round(base * (p.splitPercentage / 100) * 100) / 100,
    isOurFirm: p.isOurFirm,
  }));

  return { totalFee, netFee: totalFee - params.expenses, shares };
}

export async function checkEthicsCompliance(agreementId: string): Promise<{
  compliant: boolean;
  items: Array<{ requirement: string; met: boolean; reference: string }>;
}> {
  const agreement = await db.feeSplitAgreement.findUnique({ where: { id: agreementId }, include: { participants: true } });
  if (!agreement) return { compliant: false, items: [] };

  const ethics = (agreement.ethicsCompliance as any) || {};
  const items = [
    { requirement: "Client consent to fee sharing (written)", met: !!ethics.clientConsentObtained, reference: "NY RPC 1.5(g)(1)" },
    { requirement: "Written fee-sharing agreement between attorneys", met: !!ethics.writtenAgreement, reference: "NY RPC 1.5(g)(2)" },
    { requirement: "Each attorney's responsibilities defined", met: agreement.participants.every((p) => p.responsibilities && (p.responsibilities as any[]).length > 0 || p.isOurFirm), reference: "NY RPC 1.5(g)(2)" },
    { requirement: "Proportional or joint responsibility confirmed", met: !!ethics.proportionalResponsibility, reference: "NY RPC 1.5(g)(3)" },
    { requirement: "Total fee reasonable", met: !!ethics.totalFeeReasonable, reference: "NY RPC 1.5(a)" },
  ];

  return { compliant: items.every((i) => i.met), items };
}

export async function processFeeSplitDisbursement(disbursementId: string): Promise<void> {
  const disb = await db.feeSplitDisbursement.findUnique({ where: { id: disbursementId }, include: { agreement: true } });
  if (!disb || disb.status !== "approved") throw new Error("Disbursement not approved");

  // In production: create trust transaction, process payment
  await db.feeSplitDisbursement.update({
    where: { id: disbursementId },
    data: { status: "completed", completedAt: new Date() },
  });

  // Update participant disbursed amount
  await db.feeSplitParticipant.update({
    where: { id: disb.participantId },
    data: { disbursedAmount: { increment: disb.amount }, disbursementStatus: "disbursed" },
  });
}

export async function getDashboardStats(firmId: string) {
  const agreements = await db.feeSplitAgreement.findMany({ where: { firmId } });
  const active = agreements.filter((a) => a.status === "active" || a.status === "disbursing");
  const pendingDisb = await db.feeSplitDisbursement.count({ where: { firmId, status: { in: ["pending", "approved"] } } });
  const totalDisbursed = await db.feeSplitDisbursement.aggregate({ where: { firmId, status: "completed" }, _sum: { amount: true } });
  const form1099Due = await db.feeSplitParticipant.count({ where: { form1099Required: true, form1099Generated: false, disbursedAmount: { gt: 600 } } });

  return {
    totalAgreements: agreements.length,
    activeAgreements: active.length,
    pendingDisbursements: pendingDisb,
    totalDisbursed: totalDisbursed._sum.amount || 0,
    form1099Due,
  };
}
