import type { ChildSupportInputs, ChildSupportResult, FormulaStep, AddOnItem } from "../types";

export const FL_INCOME_SHARES_VERSION = "FL_INCOME_SHARES_2023";

// FL Schedule of Basic Obligations (condensed — monthly combined net income → obligation by children)
// Source: F.S. § 61.30 Schedule
const FL_SCHEDULE: Array<[number, number[]]> = [
  [800, [190, 211, 213, 214, 215]], [1000, [213, 302, 305, 307, 308]],
  [1500, [280, 437, 476, 492, 505]], [2000, [347, 541, 590, 611, 627]],
  [2500, [414, 646, 704, 729, 748]], [3000, [467, 736, 815, 848, 872]],
  [3500, [520, 809, 900, 940, 969]], [4000, [573, 882, 984, 1031, 1066]],
  [4500, [619, 949, 1064, 1118, 1159]], [5000, [665, 1015, 1140, 1202, 1249]],
  [6000, [749, 1134, 1280, 1357, 1416]], [7000, [828, 1242, 1409, 1500, 1571]],
  [8000, [901, 1341, 1527, 1632, 1715]], [9000, [969, 1432, 1637, 1755, 1849]],
  [10000, [1033, 1517, 1740, 1871, 1975]],
];

function lookupFLObligation(combinedNet: number, children: number): number {
  const col = Math.min(Math.max(children, 1), 5) - 1;
  const capped = Math.min(combinedNet, 10000);
  let prevRow = FL_SCHEDULE[0];
  for (const row of FL_SCHEDULE) {
    if (row[0] > capped) {
      // Interpolate
      const ratio = (capped - prevRow[0]) / (row[0] - prevRow[0]);
      return prevRow[1][col] + ratio * (row[1][col] - prevRow[1][col]);
    }
    prevRow = row;
  }
  return prevRow[1][col];
}

export function calculateFLChildSupport(inputs: ChildSupportInputs): ChildSupportResult {
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Step 1: Net monthly income (simplified: gross × 0.75)
  const payorNetMonthly = (inputs.payorGrossAnnualIncome / 12) * 0.75;
  const payeeNetMonthly = (inputs.payeeGrossAnnualIncome / 12) * 0.75;
  steps.push({ label: "Payor net monthly (estimated)", formula: `$${Math.round(inputs.payorGrossAnnualIncome / 12)} × 75%`, result: Math.round(payorNetMonthly) });
  steps.push({ label: "Payee net monthly (estimated)", formula: `$${Math.round(inputs.payeeGrossAnnualIncome / 12)} × 75%`, result: Math.round(payeeNetMonthly) });

  // Step 2: Combined
  const combinedNet = payorNetMonthly + payeeNetMonthly;
  steps.push({ label: "Combined net monthly", formula: "", result: Math.round(combinedNet) });

  // Step 3: Schedule lookup
  const n = Math.min(Math.max(inputs.numberOfChildren, 1), 5);
  const basicObligation = lookupFLObligation(combinedNet, n);
  steps.push({ label: "Basic obligation (FL Schedule)", formula: `Schedule lookup at $${Math.round(combinedNet)}/mo, ${n} child${n > 1 ? "ren" : ""}`, result: Math.round(basicObligation * 100) / 100, note: "F.S. § 61.30" });

  // Step 4: Pro-rata
  const payorPct = combinedNet > 0 ? payorNetMonthly / combinedNet : 0.5;
  let payorObligation = basicObligation * payorPct;
  steps.push({ label: "Payor share", formula: `${(payorPct * 100).toFixed(1)}% of $${Math.round(basicObligation)}`, result: Math.round(payorObligation * 100) / 100 });

  // Step 5: Overnights adjustment
  if (inputs.overnightsWithPayor >= 73) {
    const payeeObligation = basicObligation * (1 - payorPct);
    const adjusted = payorObligation * 1.5 * (inputs.overnightsWithPayor / 365) - payeeObligation * (1 - inputs.overnightsWithPayor / 365);
    payorObligation = Math.max(0, adjusted);
    steps.push({ label: "Shared parenting adjustment", formula: `${inputs.overnightsWithPayor} overnights (${((inputs.overnightsWithPayor / 365) * 100).toFixed(0)}%)`, result: Math.round(payorObligation * 100) / 100, note: "§ 61.30(11)(b)" });
  }

  // Add-ons
  const addOns: AddOnItem[] = [];
  if (inputs.childcareExpensesAnnual > 0) {
    const m = inputs.childcareExpensesAnnual / 12;
    addOns.push({ label: "Childcare", annualCost: inputs.childcareExpensesAnnual, monthlyCost: m, payorShare: payorPct, payeeShare: 1 - payorPct, payorMonthly: Math.round(m * payorPct * 100) / 100, payeeMonthly: Math.round(m * (1 - payorPct) * 100) / 100 });
  }

  const addOnTotal = addOns.reduce((s, a) => s + a.payorMonthly, 0);
  const total = Math.round((payorObligation + addOnTotal) * 100) / 100;

  if (combinedNet > 10000) warnings.push("Combined net income exceeds FL schedule maximum ($10,000). Above-schedule amount is discretionary.");
  assumptions.push("Net income estimated at 75% of gross. For accurate calculation, enter actual tax deductions.");
  assumptions.push("Calculated per Florida Statute § 61.30 (Income Shares Model).");

  return {
    jurisdiction: "FL", formulaVersion: FL_INCOME_SHARES_VERSION,
    guidelineMonthlyAmount: total, payorShareMonthly: total, payeeShareMonthly: 0,
    combinedAdjustedIncome: combinedNet * 12, payorIncomeShare: Math.round(payorPct * 1000) / 10, payeeIncomeShare: Math.round((1 - payorPct) * 1000) / 10,
    baseObligationMonthly: Math.round(payorObligation * 100) / 100, addOns, totalWithAddOns: total,
    incomeCapApplied: combinedNet > 10000, capAmount: 10000,
    warnings, assumptions, formulaBreakdown: steps,
  };
}
