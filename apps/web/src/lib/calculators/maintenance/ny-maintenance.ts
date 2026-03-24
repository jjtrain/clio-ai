import type { MaintenanceInputs, MaintenanceResult, FormulaStep } from "../types";
import { getCurrentCaps } from "../cap-registry";

export const NY_MAINTENANCE_VERSION = "NY_MAINTENANCE_2025";

export function calculateNYMaintenance(inputs: MaintenanceInputs): MaintenanceResult {
  const caps = getCurrentCaps("NY_MAINTENANCE");
  const INCOME_CAP = inputs.payorIncomeCap || caps.payorIncomeCap || 228_000;
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Step 1: Cap payor income
  const payorCapped = Math.min(inputs.payorGrossAnnualIncome, INCOME_CAP);
  const payeeGross = inputs.payeeGrossAnnualIncome;
  steps.push({ label: "Payor income (capped)", formula: `min($${inputs.payorGrossAnnualIncome.toLocaleString()}, $${INCOME_CAP.toLocaleString()})`, result: payorCapped });

  // Step 2: Formula A or B
  const hasChildSupport = inputs.childSupportBeingPaid > 0;
  const payorRate = hasChildSupport ? 0.25 : 0.30;
  const payeeRate = 0.20;
  const formulaLabel = hasChildSupport ? "Formula B (with child support)" : "Formula A (no child support)";

  const calc1 = payorRate * payorCapped - payeeRate * payeeGross;
  steps.push({ label: formulaLabel, formula: `${(payorRate * 100)}% × $${payorCapped.toLocaleString()} - ${(payeeRate * 100)}% × $${payeeGross.toLocaleString()}`, result: Math.round(calc1), note: "DRL § 236B(6)(b)" });

  // Step 3: Income cap test
  const incomeCap40 = 0.40 * (payorCapped + payeeGross) - payeeGross;
  const maintenance = Math.max(0, Math.min(calc1, incomeCap40));
  steps.push({ label: "40% income cap test", formula: `40% × ($${payorCapped.toLocaleString()} + $${payeeGross.toLocaleString()}) - $${payeeGross.toLocaleString()}`, result: Math.round(incomeCap40) });
  steps.push({ label: "Guideline annual maintenance", formula: `min($${Math.round(calc1).toLocaleString()}, $${Math.round(incomeCap40).toLocaleString()})`, result: Math.round(maintenance) });

  // Step 4: Monthly
  const monthly = Math.round(maintenance / 12 * 100) / 100;
  steps.push({ label: "Guideline monthly maintenance", formula: `$${Math.round(maintenance).toLocaleString()} ÷ 12`, result: monthly });

  // Step 5: Duration
  const yrs = inputs.marriageDurationYears;
  let minPct: number, maxPct: number;
  if (yrs <= 15) { minPct = 0.15; maxPct = 0.30; }
  else if (yrs <= 20) { minPct = 0.30; maxPct = 0.40; }
  else { minPct = 0.35; maxPct = 0.50; }

  const minMonths = Math.round(yrs * minPct * 12);
  const maxMonths = Math.round(yrs * maxPct * 12);
  const midMonths = Math.round((minMonths + maxMonths) / 2);
  steps.push({ label: "Duration range", formula: `${yrs} year marriage × ${(minPct * 100).toFixed(0)}-${(maxPct * 100).toFixed(0)}%`, result: midMonths, note: `${minMonths}-${maxMonths} months` });

  // Warnings
  if (inputs.payorGrossAnnualIncome > INCOME_CAP) {
    warnings.push(`Payor income exceeds statutory cap of $${INCOME_CAP.toLocaleString()}. Above-cap amount is at court discretion per DRL § 236B(6)(e) factors.`);
  }
  if (payeeGross > inputs.payorGrossAnnualIncome) {
    warnings.push("Payee earns more than payor — guideline produces $0 maintenance. Court may still award based on statutory factors.");
  }
  assumptions.push("Duration is a guideline range. Court has discretion to deviate based on DRL § 236B(6)(e) factors.");
  assumptions.push("Calculated per NY DRL § 236B(6)(b) (2016 Maintenance Reform).");

  return {
    jurisdiction: "NY", formulaVersion: NY_MAINTENANCE_VERSION, isStatutoryFormula: true,
    guidelineMonthlyAmount: monthly, durationMonths: midMonths, durationBasis: "statutory",
    durationRange: { min: minMonths, max: maxMonths },
    formulaBreakdown: steps, warnings, assumptions,
  };
}
