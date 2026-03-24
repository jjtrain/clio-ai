import type { ChildSupportInputs, ChildSupportResult, FormulaStep, AddOnItem } from "../types";
import { getCurrentCaps } from "../cap-registry";

export const NY_CSSA_VERSION = "NY_CSSA_2025";

const CSSA_PERCENTAGES: Record<number, number> = { 1: 0.17, 2: 0.25, 3: 0.29, 4: 0.31, 5: 0.35 };

export function calculateNYChildSupport(inputs: ChildSupportInputs): ChildSupportResult {
  const caps = getCurrentCaps("NY_CSSA");
  const COMBINED_INCOME_CAP = caps.combinedIncomeCap || 183_000;
  const SELF_SUPPORT_RESERVE = caps.selfSupportReserve || 18_347;
  const steps: FormulaStep[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Step 1-2: Adjusted income
  const payorAdj = inputs.payorGrossAnnualIncome - inputs.payorSSTaxDeduction - inputs.payorOtherChildSupportOrders;
  const payeeAdj = inputs.payeeGrossAnnualIncome - inputs.payeeSSTaxDeduction - inputs.payeeOtherChildSupportOrders;
  steps.push({ label: "Payor adjusted gross income", formula: `$${inputs.payorGrossAnnualIncome.toLocaleString()} - deductions`, result: payorAdj });
  steps.push({ label: "Payee adjusted gross income", formula: `$${inputs.payeeGrossAnnualIncome.toLocaleString()} - deductions`, result: payeeAdj });

  // Step 3: Combined
  const combined = payorAdj + payeeAdj;
  steps.push({ label: "Combined parental income", formula: `$${payorAdj.toLocaleString()} + $${payeeAdj.toLocaleString()}`, result: combined });

  // Step 4: CSSA percentage
  const n = Math.min(Math.max(inputs.numberOfChildren, 1), 5);
  const rate = CSSA_PERCENTAGES[n];
  steps.push({ label: `CSSA percentage (${inputs.numberOfChildren} child${inputs.numberOfChildren > 1 ? "ren" : ""})`, formula: `${(rate * 100).toFixed(0)}%`, result: rate, note: "DRL § 240(1-b)(c)(2)" });

  // Step 5: Cap handling
  let baseObligation: number;
  let incomeCapApplied = false;
  let aboveCapAmount: number | undefined;

  if (combined <= COMBINED_INCOME_CAP) {
    baseObligation = combined * rate;
    steps.push({ label: "Basic child support obligation", formula: `$${combined.toLocaleString()} × ${(rate * 100)}%`, result: baseObligation });
  } else {
    incomeCapApplied = true;
    const belowCapObligation = COMBINED_INCOME_CAP * rate;
    steps.push({ label: "Obligation on capped income", formula: `$${COMBINED_INCOME_CAP.toLocaleString()} × ${(rate * 100)}%`, result: belowCapObligation, note: `Combined income exceeds $${COMBINED_INCOME_CAP.toLocaleString()} cap` });

    if (inputs.combinedIncomeAboveCap === "apply_percentage") {
      aboveCapAmount = (combined - COMBINED_INCOME_CAP) * rate;
      baseObligation = belowCapObligation + aboveCapAmount;
      steps.push({ label: "Above-cap obligation (percentage applied)", formula: `$${(combined - COMBINED_INCOME_CAP).toLocaleString()} × ${(rate * 100)}%`, result: aboveCapAmount });
    } else {
      baseObligation = belowCapObligation;
      aboveCapAmount = undefined;
      warnings.push(`Combined income of $${combined.toLocaleString()} exceeds the $${COMBINED_INCOME_CAP.toLocaleString()} CSSA cap. Amount above cap is at court discretion per DRL § 240(1-b)(c)(3).`);
    }
    steps.push({ label: "Total basic obligation", formula: "", result: baseObligation });
  }

  // Step 6: Pro-rata shares
  const payorSharePct = combined > 0 ? payorAdj / combined : 0.5;
  const payeeSharePct = 1 - payorSharePct;
  const payorAnnual = baseObligation * payorSharePct;
  const payorMonthly = Math.round(payorAnnual / 12 * 100) / 100;
  steps.push({ label: "Payor's pro-rata share", formula: `${(payorSharePct * 100).toFixed(1)}% of $${Math.round(baseObligation).toLocaleString()}`, result: payorAnnual });
  steps.push({ label: "Payor monthly obligation", formula: `$${Math.round(payorAnnual).toLocaleString()} ÷ 12`, result: payorMonthly });

  // Step 7: Add-ons
  const addOns: AddOnItem[] = [];
  function computeAddOn(label: string, annual: number, paidBy: string): AddOnItem {
    const monthly = annual / 12;
    let pShare = 0, eShare = 0;
    if (paidBy === "payee") { pShare = monthly * payorSharePct; eShare = monthly * payeeSharePct; }
    else if (paidBy === "payor") { pShare = monthly * payorSharePct; eShare = monthly * payeeSharePct; }
    else { pShare = monthly * payorSharePct; eShare = monthly * payeeSharePct; }
    return { label, annualCost: annual, monthlyCost: monthly, payorShare: payorSharePct, payeeShare: payeeSharePct, payorMonthly: Math.round(pShare * 100) / 100, payeeMonthly: Math.round(eShare * 100) / 100 };
  }

  if (inputs.childcareExpensesAnnual > 0) addOns.push(computeAddOn("Work-related childcare", inputs.childcareExpensesAnnual, inputs.childcareExpensesPaidBy));
  if (inputs.childHealthInsurancePremium > 0) addOns.push(computeAddOn("Child health insurance", inputs.childHealthInsurancePremium * 12, inputs.childHealthInsurancePaidBy));
  if (inputs.educationalExpensesAnnual > 0) addOns.push(computeAddOn("Educational expenses", inputs.educationalExpensesAnnual, inputs.educationalExpensesPaidBy));
  if (inputs.unreimbursedMedicalAnnual > 0) addOns.push(computeAddOn("Unreimbursed medical", inputs.unreimbursedMedicalAnnual, inputs.unreimbursedMedicalPaidBy));

  const addOnTotal = addOns.reduce((s, a) => s + a.payorMonthly, 0);
  let totalMonthly = payorMonthly + addOnTotal;

  // Step 9: Shared custody adjustment
  let sharedAdj: number | undefined;
  if (inputs.custodyArrangement === "shared" && inputs.payorCustodyPercent > 40) {
    sharedAdj = totalMonthly * (1 - inputs.payorCustodyPercent / 50);
    totalMonthly = Math.max(0, sharedAdj);
    steps.push({ label: "Shared custody adjustment", formula: `$${payorMonthly.toFixed(2)} × (1 - ${inputs.payorCustodyPercent}%/50%)`, result: totalMonthly, note: "Allen v. Allen adjustment — discretionary" });
    warnings.push("Shared custody adjustment is discretionary in NY. Court may deviate. Consult case law.");
  }

  // Warnings
  if (inputs.payorGrossAnnualIncome < SELF_SUPPORT_RESERVE) {
    warnings.push(`Payor income may be below self-support reserve ($${SELF_SUPPORT_RESERVE.toLocaleString()}) — court may deviate downward.`);
  }
  if (inputs.numberOfChildren > 5) {
    assumptions.push("For 6+ children, the 35% rate is the statutory minimum. Court may apply a higher percentage.");
  }
  assumptions.push("Calculated per NY DRL § 240(1-b) (Child Support Standards Act).");

  return {
    jurisdiction: "NY", formulaVersion: NY_CSSA_VERSION,
    guidelineMonthlyAmount: Math.round(totalMonthly * 100) / 100,
    payorShareMonthly: Math.round(totalMonthly * 100) / 100,
    payeeShareMonthly: 0,
    combinedAdjustedIncome: combined,
    payorIncomeShare: Math.round(payorSharePct * 1000) / 10,
    payeeIncomeShare: Math.round(payeeSharePct * 1000) / 10,
    baseObligationMonthly: payorMonthly,
    addOns, totalWithAddOns: Math.round(totalMonthly * 100) / 100,
    incomeCapApplied, capAmount: COMBINED_INCOME_CAP,
    aboveCapDiscretionaryAmount: aboveCapAmount,
    sharedCustodyAdjustment: sharedAdj,
    adjustedAfterCustody: sharedAdj ? totalMonthly : undefined,
    warnings, assumptions, formulaBreakdown: steps,
  };
}
