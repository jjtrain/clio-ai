import type { ChildSupportInputs, ChildSupportResult, FormulaStep, AddOnItem } from "../types";

export const CA_GUIDELINE_VERSION = "CA_GUIDELINE_2024";

// K factor lookup: [children count][HN/TN >= 0.5 ? 0 : 1]
const K_TABLE: Record<number, [number, number]> = {
  1: [0.20, 0.14], 2: [0.25, 0.18], 3: [0.30, 0.22], 4: [0.35, 0.26], 5: [0.40, 0.30],
};

function computeNetMonthlyCA(grossMonthly: number, fedRate: number, stateRate: number, retirement: number, healthIns: number, otherSupport: number): number {
  const ficaRate = 0.0765;
  const fica = grossMonthly * ficaRate;
  const fedTax = grossMonthly * (fedRate / 100);
  const stateTax = grossMonthly * (stateRate / 100);
  return Math.max(0, grossMonthly - fedTax - stateTax - fica - retirement - healthIns - otherSupport);
}

export function calculateCAChildSupport(inputs: ChildSupportInputs): ChildSupportResult {
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Step 1: Net monthly disposable income
  const payorGrossMonthly = inputs.payorGrossAnnualIncome / 12;
  const payeeGrossMonthly = inputs.payeeGrossAnnualIncome / 12;

  const payorNet = computeNetMonthlyCA(payorGrossMonthly, inputs.payorActualFederalTaxRate, inputs.payorActualStateTaxRate, inputs.payorMandatoryRetirement / 12, inputs.payorHealthInsurancePremium / 12, inputs.payorOtherChildSupportOrders / 12);
  const payeeNet = computeNetMonthlyCA(payeeGrossMonthly, inputs.payeeActualFederalTaxRate, inputs.payeeActualStateTaxRate, inputs.payeeMandatoryRetirement / 12, inputs.payeeHealthInsurancePremium / 12, inputs.payeeOtherChildSupportOrders / 12);

  steps.push({ label: "Payor net monthly disposable", formula: `$${payorGrossMonthly.toFixed(0)} gross - taxes - deductions`, result: Math.round(payorNet) });
  steps.push({ label: "Payee net monthly disposable", formula: `$${payeeGrossMonthly.toFixed(0)} gross - taxes - deductions`, result: Math.round(payeeNet) });

  // Step 2: Determine HN and H%
  const payorIsHighEarner = payorNet >= payeeNet;
  const HN = payorIsHighEarner ? payorNet : payeeNet;
  const Hpct = payorIsHighEarner ? inputs.payorTimesharePercent / 100 : (100 - inputs.payorTimesharePercent) / 100;
  steps.push({ label: "High earner (HN)", formula: payorIsHighEarner ? "Payor" : "Payee", result: Math.round(HN) });
  steps.push({ label: "High earner timeshare (H%)", formula: `${(Hpct * 100).toFixed(0)}%`, result: Hpct });

  // Step 3: TN
  const TN = payorNet + payeeNet;
  steps.push({ label: "Total net (TN)", formula: `$${Math.round(payorNet)} + $${Math.round(payeeNet)}`, result: Math.round(TN) });

  // Step 4: K factor
  const n = Math.min(Math.max(inputs.numberOfChildren, 1), 5);
  const hnRatio = TN > 0 ? HN / TN : 0.5;
  const kEntry = K_TABLE[n] || K_TABLE[1];
  const k = hnRatio >= 0.5 ? kEntry[0] : kEntry[1];
  steps.push({ label: `K factor (${n} child${n > 1 ? "ren" : ""})`, formula: `HN/TN = ${(hnRatio * 100).toFixed(0)}% → K = ${k}`, result: k, note: "Family Code § 4055(b)(3)" });

  // Step 5: Apply formula CS = K[HN - (H%)(TN)]
  const CS = Math.max(0, k * (HN - Hpct * TN));
  steps.push({ label: "Guideline child support", formula: `${k} × [$${Math.round(HN)} - (${(Hpct * 100).toFixed(0)}% × $${Math.round(TN)})]`, result: Math.round(CS * 100) / 100, note: "CS = K[HN - (H%)(TN)]" });

  // Step 6: Add-ons (FC § 4062)
  const payorSharePct = TN > 0 ? payorNet / TN : 0.5;
  const addOns: AddOnItem[] = [];
  function addOn(label: string, annual: number): AddOnItem {
    const monthly = annual / 12;
    return { label, annualCost: annual, monthlyCost: monthly, payorShare: payorSharePct, payeeShare: 1 - payorSharePct, payorMonthly: Math.round(monthly * payorSharePct * 100) / 100, payeeMonthly: Math.round(monthly * (1 - payorSharePct) * 100) / 100 };
  }
  if (inputs.childcareExpensesAnnual > 0) addOns.push(addOn("Work-related childcare", inputs.childcareExpensesAnnual));
  if (inputs.unreimbursedMedicalAnnual > 0) addOns.push(addOn("Unreimbursed medical", inputs.unreimbursedMedicalAnnual));
  if (inputs.educationalExpensesAnnual > 0) addOns.push(addOn("Educational expenses (discretionary)", inputs.educationalExpensesAnnual));

  const addOnTotal = addOns.reduce((s, a) => s + a.payorMonthly, 0);
  const total = Math.round((CS + addOnTotal) * 100) / 100;

  // Warnings
  if (inputs.payorTimesharePercent === 50) {
    warnings.push("50/50 timeshare: support is typically based on income difference only. Verify with DissoMaster.");
  }
  warnings.push("CA formula is highly sensitive to timeshare percentage — a 1% change can significantly alter support.");
  assumptions.push("This approximates DissoMaster output but may differ due to tax rate estimation. Use DissoMaster for final figures.");
  assumptions.push("Calculated per California Family Code § 4055.");

  return {
    jurisdiction: "CA", formulaVersion: CA_GUIDELINE_VERSION,
    guidelineMonthlyAmount: total, payorShareMonthly: total, payeeShareMonthly: 0,
    combinedAdjustedIncome: TN * 12, payorIncomeShare: Math.round(payorSharePct * 1000) / 10, payeeIncomeShare: Math.round((1 - payorSharePct) * 1000) / 10,
    baseObligationMonthly: Math.round(CS * 100) / 100, addOns, totalWithAddOns: total,
    incomeCapApplied: false, warnings, assumptions, formulaBreakdown: steps,
  };
}
