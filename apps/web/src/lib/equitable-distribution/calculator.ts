/**
 * Equitable Distribution Calculator — pure functions, no DB.
 * All computations run client-side for live updates.
 */

export interface WorksheetRowData {
  id: string;
  category: string;
  description: string;
  classification: string;
  isLiability: boolean;
  payorClaimedValue: number | null;
  payeeClaimedValue: number | null;
  agreedValue: number | null;
  balance: number | null;
  payorBalanceClaim: number | null;
  payeeBalanceClaim: number | null;
  agreedBalance: number | null;
  disposition: string | null;
  awardedTo: string | null;
  offsetAmount: number | null;
  payorFinalShare: number | null;
  payeeFinalShare: number | null;
  isDisputed: boolean;
}

export interface WorksheetTotals {
  totalGrossAssets: number;
  totalGrossLiabilities: number;
  totalGrossNetWorth: number;
  totalMaritalAssets: number;
  totalMaritalLiabilities: number;
  netMaritalEstate: number;
  totalPayorSeparateAssets: number;
  totalPayeeSeparateAssets: number;
  totalDisputedAssets: number;
  totalDisputedLiabilities: number;
  payorAwardedAssets: number;
  payorAwardedLiabilities: number;
  payorNetAward: number;
  payeeAwardedAssets: number;
  payeeAwardedLiabilities: number;
  payeeNetAward: number;
  payorSharePercent: number;
  payeeSharePercent: number;
  equalizationPayment: number;
  equalizationDirection: "payor_to_payee" | "payee_to_payor" | "none";
  undisposedRows: number;
  undisposedValue: number;
  unvaluedRows: number;
  disputedRows: number;
  totalValuationGap: number;
  byCategory: Record<string, { totalValue: number; maritalValue: number; payorAward: number; payeeAward: number; rowCount: number }>;
}

// ─── Value Resolution ───────────────────────────────────────────

export function resolveValue(row: WorksheetRowData): number {
  if (row.agreedValue != null) return row.agreedValue;
  if (row.payorClaimedValue != null && row.payeeClaimedValue != null) return (row.payorClaimedValue + row.payeeClaimedValue) / 2;
  if (row.payorClaimedValue != null) return row.payorClaimedValue;
  if (row.payeeClaimedValue != null) return row.payeeClaimedValue;
  return 0;
}

export function resolveBalance(row: WorksheetRowData): number {
  if (row.agreedBalance != null) return row.agreedBalance;
  if (row.payorBalanceClaim != null && row.payeeBalanceClaim != null) return (row.payorBalanceClaim + row.payeeBalanceClaim) / 2;
  if (row.payorBalanceClaim != null) return row.payorBalanceClaim;
  if (row.payeeBalanceClaim != null) return row.payeeBalanceClaim;
  if (row.balance != null) return row.balance;
  return 0;
}

// ─── Row Computation ────────────────────────────────────────────

export function computeRowEquity(row: WorksheetRowData) {
  const grossValue = row.isLiability ? resolveBalance(row) : resolveValue(row);
  const isValued = grossValue !== 0 || row.agreedValue != null || row.payorClaimedValue != null || row.payeeClaimedValue != null;
  const isClassified = row.classification !== "DISPUTED";
  const isDisposed = !!row.disposition && row.disposition !== "PENDING";

  let effectiveMaritalValue = 0;
  switch (row.classification) {
    case "MARITAL": effectiveMaritalValue = grossValue; break;
    case "SEPARATE_PAYOR": case "SEPARATE_PAYEE": effectiveMaritalValue = 0; break;
    case "MIXED": effectiveMaritalValue = grossValue * 0.5; break; // default 50% marital; attorney adjusts
    case "DISPUTED": effectiveMaritalValue = grossValue; break; // include in gross until resolved
  }

  const valuationGap = (row.payorClaimedValue != null && row.payeeClaimedValue != null)
    ? Math.abs(row.payorClaimedValue - row.payeeClaimedValue) : 0;

  return { grossValue, effectiveMaritalValue, valuationGap, isValued, isClassified, isDisposed };
}

// ─── Worksheet Totals ───────────────────────────────────────────

export function computeWorksheetTotals(rows: WorksheetRowData[]): WorksheetTotals {
  const byCategory: Record<string, { totalValue: number; maritalValue: number; payorAward: number; payeeAward: number; rowCount: number }> = {};

  let totalGrossAssets = 0, totalGrossLiabilities = 0;
  let totalMaritalAssets = 0, totalMaritalLiabilities = 0;
  let totalPayorSep = 0, totalPayeeSep = 0;
  let totalDisputedAssets = 0, totalDisputedLiabilities = 0;
  let payorAwarded = 0, payorAwardedLiab = 0;
  let payeeAwarded = 0, payeeAwardedLiab = 0;
  let undisposedRows = 0, undisposedValue = 0, unvaluedRows = 0, disputedRows = 0;
  let totalValuationGap = 0;

  for (const row of rows) {
    const eq = computeRowEquity(row);
    const cat = row.category;

    if (!byCategory[cat]) byCategory[cat] = { totalValue: 0, maritalValue: 0, payorAward: 0, payeeAward: 0, rowCount: 0 };
    byCategory[cat].rowCount++;

    if (row.isLiability) {
      totalGrossLiabilities += Math.abs(eq.grossValue);
      if (row.classification === "MARITAL" || row.classification === "MIXED" || row.classification === "DISPUTED") {
        totalMaritalLiabilities += Math.abs(eq.effectiveMaritalValue);
      }
      if (row.classification === "DISPUTED") totalDisputedLiabilities += Math.abs(eq.grossValue);
      byCategory[cat].totalValue -= Math.abs(eq.grossValue);
    } else {
      totalGrossAssets += eq.grossValue;
      byCategory[cat].totalValue += eq.grossValue;
      byCategory[cat].maritalValue += eq.effectiveMaritalValue;

      if (row.classification === "MARITAL" || row.classification === "MIXED" || row.classification === "DISPUTED") {
        totalMaritalAssets += eq.effectiveMaritalValue;
      }
      if (row.classification === "SEPARATE_PAYOR") totalPayorSep += eq.grossValue;
      if (row.classification === "SEPARATE_PAYEE") totalPayeeSep += eq.grossValue;
      if (row.classification === "DISPUTED") { totalDisputedAssets += eq.grossValue; disputedRows++; }
    }

    // Disposition tracking
    const pFinal = row.payorFinalShare || 0;
    const eFinal = row.payeeFinalShare || 0;
    if (row.isLiability) { payorAwardedLiab += pFinal; payeeAwardedLiab += eFinal; }
    else { payorAwarded += pFinal; payeeAwarded += eFinal; }
    byCategory[cat].payorAward += pFinal;
    byCategory[cat].payeeAward += eFinal;

    if (!eq.isDisposed) { undisposedRows++; undisposedValue += Math.abs(eq.grossValue); }
    if (!eq.isValued) unvaluedRows++;
    if (row.isDisputed) disputedRows++;
    totalValuationGap += eq.valuationGap;
  }

  const netMarital = totalMaritalAssets - totalMaritalLiabilities;
  const payorNet = payorAwarded - payorAwardedLiab;
  const payeeNet = payeeAwarded - payeeAwardedLiab;
  const payorPct = netMarital > 0 ? Math.round((payorNet / netMarital) * 1000) / 10 : 0;
  const payeePct = netMarital > 0 ? Math.round((payeeNet / netMarital) * 1000) / 10 : 0;

  const eqDiff = payorNet - payeeNet;
  const eqPayment = Math.round(Math.abs(eqDiff) / 2);
  const eqDirection: "payor_to_payee" | "payee_to_payor" | "none" =
    eqDiff > 100 ? "payor_to_payee" : eqDiff < -100 ? "payee_to_payor" : "none";

  return {
    totalGrossAssets, totalGrossLiabilities, totalGrossNetWorth: totalGrossAssets - totalGrossLiabilities,
    totalMaritalAssets, totalMaritalLiabilities, netMaritalEstate: netMarital,
    totalPayorSeparateAssets: totalPayorSep, totalPayeeSeparateAssets: totalPayeeSep,
    totalDisputedAssets, totalDisputedLiabilities,
    payorAwardedAssets: payorAwarded, payorAwardedLiabilities: payorAwardedLiab, payorNetAward: payorNet,
    payeeAwardedAssets: payeeAwarded, payeeAwardedLiabilities: payeeAwardedLiab, payeeNetAward: payeeNet,
    payorSharePercent: payorPct, payeeSharePercent: payeePct,
    equalizationPayment: eqPayment, equalizationDirection: eqDirection,
    undisposedRows, undisposedValue, unvaluedRows, disputedRows, totalValuationGap, byCategory,
  };
}

export function computeEqualizationPayment(payorNet: number, payeeNet: number) {
  const diff = payorNet - payeeNet;
  const amount = Math.round(Math.abs(diff) / 2);
  const direction = diff > 100 ? "payor_to_payee" : diff < -100 ? "payee_to_payor" : "balanced";
  const explanation = direction === "balanced"
    ? "Distribution is approximately equal — no equalization payment needed."
    : direction === "payor_to_payee"
    ? `Payor would pay Payee $${amount.toLocaleString()} to equalize the distribution.`
    : `Payee would pay Payor $${amount.toLocaleString()} to equalize the distribution.`;
  return { amount, direction, explanation };
}
