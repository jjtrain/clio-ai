import type { ChildSupportInputs, ChildSupportResult, FormulaStep } from "../types";
import { getCurrentCaps } from "../cap-registry";

export const TX_PERCENTAGE_VERSION = "TX_PERCENTAGE_2024";
const TX_PERCENTAGES: Record<number, number> = { 1: 0.20, 2: 0.25, 3: 0.30, 4: 0.35, 5: 0.40, 6: 0.40 };

export function calculateTXChildSupport(inputs: ChildSupportInputs): ChildSupportResult {
  const caps = getCurrentCaps("TX_NET_RESOURCES");
  const NET_RESOURCES_CAP = caps.monthlyCap || 9200;
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Step 1: Net monthly resources (TX has no state income tax)
  const grossMonthly = inputs.payorGrossAnnualIncome / 12;
  const ficaRate = 0.0765;
  const estFedRate = grossMonthly > 8000 ? 0.22 : grossMonthly > 4000 ? 0.12 : 0.10;
  const netMonthly = grossMonthly - (grossMonthly * estFedRate) - (grossMonthly * ficaRate) - (inputs.childHealthInsurancePaidBy === "payor" ? inputs.childHealthInsurancePremium : 0);
  steps.push({ label: "Payor gross monthly", formula: `$${inputs.payorGrossAnnualIncome.toLocaleString()} ÷ 12`, result: Math.round(grossMonthly) });
  steps.push({ label: "Payor net monthly resources", formula: `$${Math.round(grossMonthly)} - fed tax - FICA - child health ins`, result: Math.round(netMonthly), note: "Texas Family Code § 154.062" });

  // Step 2: Apply percentage
  const n = Math.min(Math.max(inputs.numberOfChildren, 1), 6);
  const rate = TX_PERCENTAGES[n];
  const cappedNet = Math.min(netMonthly, NET_RESOURCES_CAP);
  const guideline = cappedNet * rate;
  steps.push({ label: `TX guideline (${n} child${n > 1 ? "ren" : ""})`, formula: `min($${Math.round(netMonthly)}, $${NET_RESOURCES_CAP}) × ${(rate * 100)}%`, result: Math.round(guideline * 100) / 100, note: "§ 154.125" });

  // Step 3: Multiple family adjustment
  let adjusted = guideline;
  if (inputs.payorOtherChildSupportOrders > 0) {
    const otherKids = 1; // simplified
    const multiRate = rate - 0.05 * otherKids;
    adjusted = cappedNet * Math.max(multiRate, 0.10);
    steps.push({ label: "Multiple family adjustment", formula: `Adjusted rate for other children`, result: Math.round(adjusted * 100) / 100, note: "§ 154.128" });
    assumptions.push("Multiple family adjustment estimated — verify with actual number of other children.");
  }

  // Step 4: Above cap
  if (netMonthly > NET_RESOURCES_CAP) {
    warnings.push(`Payor net resources ($${Math.round(netMonthly).toLocaleString()}/mo) exceed the $${NET_RESOURCES_CAP.toLocaleString()} guideline cap. Court may order additional support based on proven child needs.`);
  }

  assumptions.push("Calculated per Texas Family Code § 154.125-128. TX has no state income tax.");

  return {
    jurisdiction: "TX", formulaVersion: TX_PERCENTAGE_VERSION,
    guidelineMonthlyAmount: Math.round(adjusted * 100) / 100,
    payorShareMonthly: Math.round(adjusted * 100) / 100, payeeShareMonthly: 0,
    combinedAdjustedIncome: inputs.payorGrossAnnualIncome + inputs.payeeGrossAnnualIncome,
    payorIncomeShare: 100, payeeIncomeShare: 0,
    baseObligationMonthly: Math.round(adjusted * 100) / 100,
    addOns: [], totalWithAddOns: Math.round(adjusted * 100) / 100,
    incomeCapApplied: netMonthly > NET_RESOURCES_CAP, capAmount: NET_RESOURCES_CAP,
    warnings, assumptions, formulaBreakdown: steps,
  };
}
