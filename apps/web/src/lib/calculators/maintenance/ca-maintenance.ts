import type { MaintenanceInputs, MaintenanceResult, FormulaStep } from "../types";

export const CA_MAINTENANCE_VERSION = "CA_ADVISORY_2024";

export function calculateCAMaintenance(inputs: MaintenanceInputs): MaintenanceResult {
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  const monthlyDiff = (inputs.payorGrossAnnualIncome - inputs.payeeGrossAnnualIncome) / 12;
  steps.push({ label: "Monthly income disparity", formula: `($${(inputs.payorGrossAnnualIncome / 12).toFixed(0)} - $${(inputs.payeeGrossAnnualIncome / 12).toFixed(0)})`, result: Math.round(monthlyDiff) });

  if (monthlyDiff <= 0) {
    return {
      jurisdiction: "CA", formulaVersion: CA_MAINTENANCE_VERSION, isStatutoryFormula: false,
      guidelineMonthlyAmount: 0, durationMonths: 0, durationBasis: "advisory",
      amountRange: { min: 0, max: 0 },
      formulaBreakdown: steps,
      warnings: ["Payee earns equal to or more than payor — no spousal support indicated."],
      assumptions: ["California has no statutory spousal support formula for long-term orders."],
    };
  }

  const low = Math.round(monthlyDiff * 0.30);
  const mid = Math.round(monthlyDiff * 0.35);
  const high = Math.round(monthlyDiff * 0.40);
  steps.push({ label: "Advisory range (30-40% of disparity)", formula: `$${low} – $${mid} – $${high}/mo`, result: mid });

  // Duration
  const yrs = inputs.marriageDurationYears;
  let durationNote: string;
  let minDur: number, maxDur: number;
  if (yrs < 10) {
    minDur = Math.round(yrs * 0.5 * 12);
    maxDur = Math.round(yrs * 0.5 * 12);
    durationNote = `Short-term marriage: ~${(yrs * 0.5).toFixed(1)} years (half the marriage length)`;
  } else {
    minDur = Math.round(yrs * 0.5 * 12);
    maxDur = 0; // indefinite
    durationNote = "Marriage of 10+ years — court retains indefinite jurisdiction per FC § 4336";
  }
  steps.push({ label: "Advisory duration", formula: durationNote, result: minDur || yrs * 6 });

  warnings.push("California does not have a statutory spousal support formula for long-term orders. These figures are advisory estimates based on common judicial heuristics and Santa Clara / Alameda County local guidelines.");
  assumptions.push("Actual orders are highly fact-specific. Use DissoMaster or XSpouse for formal calculations.");
  assumptions.push("Advisory ranges per FC § 4320 factors.");

  return {
    jurisdiction: "CA", formulaVersion: CA_MAINTENANCE_VERSION, isStatutoryFormula: false,
    guidelineMonthlyAmount: mid,
    durationMonths: minDur || yrs * 6,
    durationBasis: "advisory",
    amountRange: { min: low, max: high },
    durationRange: maxDur === 0 ? undefined : { min: minDur, max: maxDur },
    formulaBreakdown: steps, warnings, assumptions,
  };
}
