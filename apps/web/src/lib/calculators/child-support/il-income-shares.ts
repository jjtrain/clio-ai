import type { ChildSupportInputs, ChildSupportResult, FormulaStep } from "../types";

export const IL_INCOME_SHARES_VERSION = "IL_INCOME_SHARES_2024";

// IL Basic Obligation Schedule (condensed — monthly combined net → obligation by children)
const IL_SCHEDULE: Array<[number, number[]]> = [
  [1000, [172, 264, 314, 354, 382]], [1500, [258, 396, 471, 531, 573]],
  [2000, [344, 528, 628, 708, 764]], [2500, [430, 660, 785, 885, 955]],
  [3000, [506, 778, 930, 1052, 1138]], [3500, [566, 876, 1058, 1200, 1302]],
  [4000, [626, 972, 1180, 1342, 1460]], [5000, [740, 1150, 1400, 1600, 1745]],
  [6000, [848, 1310, 1600, 1836, 2010]], [7000, [946, 1454, 1784, 2054, 2258]],
  [8000, [1036, 1584, 1952, 2254, 2488]], [9000, [1118, 1702, 2106, 2438, 2700]],
  [10000, [1192, 1808, 2246, 2608, 2898]],
];

function lookupILObligation(combinedNet: number, children: number): number {
  const col = Math.min(Math.max(children, 1), 5) - 1;
  const capped = Math.min(combinedNet, 10000);
  let prev = IL_SCHEDULE[0];
  for (const row of IL_SCHEDULE) {
    if (row[0] > capped) {
      const ratio = (capped - prev[0]) / (row[0] - prev[0]);
      return prev[1][col] + ratio * (row[1][col] - prev[1][col]);
    }
    prev = row;
  }
  return prev[1][col];
}

export function calculateILChildSupport(inputs: ChildSupportInputs): ChildSupportResult {
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // IL flat tax: 4.95%
  const IL_TAX_RATE = 0.0495;
  const FICA_RATE = 0.0765;
  const estFedRate = inputs.payorGrossAnnualIncome > 90000 ? 0.22 : 0.12;

  const payorNetMonthly = (inputs.payorGrossAnnualIncome / 12) * (1 - estFedRate - IL_TAX_RATE - FICA_RATE);
  const payeeNetMonthly = (inputs.payeeGrossAnnualIncome / 12) * (1 - (inputs.payeeGrossAnnualIncome > 90000 ? 0.22 : 0.12) - IL_TAX_RATE - FICA_RATE);

  steps.push({ label: "Payor net monthly", formula: `Gross - fed tax - IL 4.95% - FICA`, result: Math.round(payorNetMonthly) });
  steps.push({ label: "Payee net monthly", formula: `Gross - fed tax - IL 4.95% - FICA`, result: Math.round(payeeNetMonthly) });

  const combinedNet = payorNetMonthly + payeeNetMonthly;
  const n = Math.min(Math.max(inputs.numberOfChildren, 1), 5);
  const basicObligation = lookupILObligation(combinedNet, n);
  steps.push({ label: "Basic obligation (IL Schedule)", formula: `${n} child${n > 1 ? "ren" : ""} at $${Math.round(combinedNet)}/mo combined`, result: Math.round(basicObligation) });

  const payorPct = combinedNet > 0 ? payorNetMonthly / combinedNet : 0.5;
  let obligation = basicObligation * payorPct;
  steps.push({ label: "Payor share", formula: `${(payorPct * 100).toFixed(1)}%`, result: Math.round(obligation * 100) / 100 });

  // Shared parenting adjustment (>146 overnights = 40%)
  if (inputs.payorCustodyPercent > 40 || (inputs.overnightsWithPayor && inputs.overnightsWithPayor >= 146)) {
    const factor = 1.5;
    const payeeObligation = basicObligation * (1 - payorPct);
    obligation = Math.max(0, obligation * factor * (inputs.payorCustodyPercent / 100) - payeeObligation * ((100 - inputs.payorCustodyPercent) / 100));
    steps.push({ label: "Shared parenting adjustment", formula: "750 ILCS 5/505(a)(3.8)", result: Math.round(obligation * 100) / 100 });
  }

  assumptions.push("Illinois flat income tax rate: 4.95%. Federal rate estimated from income brackets.");
  assumptions.push("Calculated per 750 ILCS 5/505 (Income Shares Model).");

  return {
    jurisdiction: "IL", formulaVersion: IL_INCOME_SHARES_VERSION,
    guidelineMonthlyAmount: Math.round(obligation * 100) / 100,
    payorShareMonthly: Math.round(obligation * 100) / 100, payeeShareMonthly: 0,
    combinedAdjustedIncome: combinedNet * 12, payorIncomeShare: Math.round(payorPct * 1000) / 10, payeeIncomeShare: Math.round((1 - payorPct) * 1000) / 10,
    baseObligationMonthly: Math.round(obligation * 100) / 100, addOns: [], totalWithAddOns: Math.round(obligation * 100) / 100,
    incomeCapApplied: false, warnings, assumptions, formulaBreakdown: steps,
  };
}
