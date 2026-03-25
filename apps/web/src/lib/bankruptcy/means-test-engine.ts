/**
 * Means test calculation engine — pure functions, no DB calls.
 * Implements Chapter 7 (Forms 122A-1/2) and Chapter 13 (Forms 122C-1/2).
 */

export interface IncomeSource {
  sourceType: string;
  isSocialSecurity: boolean;
  months: number[]; // 6 months
}

export interface MeansTestInputs {
  householdSize: number;
  filingState: string;
  filingCounty: string;
  incomeSources: IncomeSource[];
  stateMedianIncome: number;
  // Expenses
  nationalStandardTotal: number;
  housingAllowance: number;
  actualHousingPayment: number;
  vehicleOwnershipAllowance: number;
  vehicleOperatingAllowance: number;
  actualVehiclePayment: number;
  vehicleCount: number;
  healthcareOOP: number;
  healthcareInsurance: number;
  taxes: number;
  involuntaryDeductions: number;
  lifeInsurance: number;
  courtOrderedPayments: number;
  educationDisabledChild: number;
  childcare: number;
  telecom: number;
  securedDebtPayments: number;
  priorityDebtPayments: number;
  chapter13Admin: number;
  otherNecessary: number;
  // Debt
  totalNonpriorityUnsecuredDebt: number;
}

export interface AllowedExpenses {
  nationalStandard: number;
  housing: number;
  transportation: number;
  healthcare: number;
  taxes: number;
  otherDeductions: number;
  debtPayments: number;
  total: number;
  breakdown: Array<{ lineNumber: string; label: string; amount: number }>;
}

export interface MeansTestResult {
  currentMonthlyIncome: number;
  annualizedIncome: number;
  stateMedianIncome: number;
  isAboveMedian: boolean;
  totalAllowedExpenses: number;
  disposableIncome: number;
  presumptionArises: boolean;
  presumptionReason: string;
  chapter13MonthlyPayment: number;
  chapter13PlanMonths: number;
  calculationDetail: Array<{ lineNumber: string; label: string; value: number; note?: string }>;
}

export function computeCurrentMonthlyIncome(incomeSources: IncomeSource[]): number {
  let total = 0;
  for (const source of incomeSources) {
    if (source.isSocialSecurity) continue; // Excluded per § 101(10A)
    const sum = source.months.reduce((s, m) => s + (m || 0), 0);
    total += sum / 6;
  }
  return Math.round(total * 100) / 100;
}

export function computeAnnualizedIncome(cmi: number): number {
  return Math.round(cmi * 12 * 100) / 100;
}

export function isAboveMedian(annualizedIncome: number, medianIncome: number): boolean {
  return annualizedIncome > medianIncome;
}

export function computeAllowedExpenses(inputs: MeansTestInputs): AllowedExpenses {
  const breakdown: Array<{ lineNumber: string; label: string; amount: number }> = [];

  const national = inputs.nationalStandardTotal;
  breakdown.push({ lineNumber: "6", label: "IRS National Standards", amount: national });

  const housing = Math.min(inputs.actualHousingPayment || inputs.housingAllowance, inputs.housingAllowance);
  breakdown.push({ lineNumber: "8A", label: "IRS Local Standard — Housing & Utilities", amount: housing });

  let transport = 0;
  if (inputs.vehicleCount >= 1) {
    transport += inputs.vehicleOwnershipAllowance;
    transport += inputs.vehicleOperatingAllowance;
    breakdown.push({ lineNumber: "13A", label: "Vehicle Ownership (1st car)", amount: inputs.vehicleOwnershipAllowance });
    breakdown.push({ lineNumber: "14A", label: "Vehicle Operating (1st car)", amount: inputs.vehicleOperatingAllowance });
  }
  if (inputs.vehicleCount >= 2) {
    transport += inputs.vehicleOwnershipAllowance;
    transport += inputs.vehicleOperatingAllowance;
    breakdown.push({ lineNumber: "13B", label: "Vehicle Ownership (2nd car)", amount: inputs.vehicleOwnershipAllowance });
    breakdown.push({ lineNumber: "14B", label: "Vehicle Operating (2nd car)", amount: inputs.vehicleOperatingAllowance });
  }

  const healthcare = inputs.healthcareOOP + inputs.healthcareInsurance;
  breakdown.push({ lineNumber: "19", label: "Health care", amount: healthcare });

  breakdown.push({ lineNumber: "21", label: "Taxes", amount: inputs.taxes });
  breakdown.push({ lineNumber: "22", label: "Involuntary deductions", amount: inputs.involuntaryDeductions });
  breakdown.push({ lineNumber: "23", label: "Life insurance", amount: inputs.lifeInsurance });
  breakdown.push({ lineNumber: "24", label: "Court-ordered payments", amount: inputs.courtOrderedPayments });
  breakdown.push({ lineNumber: "25", label: "Education — disabled child", amount: inputs.educationDisabledChild });
  breakdown.push({ lineNumber: "26", label: "Childcare", amount: inputs.childcare });
  breakdown.push({ lineNumber: "27", label: "Telecommunications", amount: inputs.telecom });

  const otherDed = inputs.taxes + inputs.involuntaryDeductions + inputs.lifeInsurance + inputs.courtOrderedPayments + inputs.educationDisabledChild + inputs.childcare + inputs.telecom + inputs.otherNecessary;

  const debtPayments = inputs.securedDebtPayments + inputs.priorityDebtPayments + inputs.chapter13Admin;
  breakdown.push({ lineNumber: "42", label: "Secured debt payments / 60", amount: inputs.securedDebtPayments });
  breakdown.push({ lineNumber: "43", label: "Priority debt payments / 60", amount: inputs.priorityDebtPayments });

  const total = national + housing + transport + healthcare + otherDed + debtPayments;
  breakdown.push({ lineNumber: "44", label: "Total allowed deductions", amount: total });

  return { nationalStandard: national, housing, transportation: transport, healthcare, taxes: inputs.taxes, otherDeductions: otherDed, debtPayments, total, breakdown };
}

export function computeDisposableIncome(cmi: number, allowedExpenses: AllowedExpenses): number {
  return Math.round((cmi - allowedExpenses.total) * 100) / 100;
}

export function computeChapter7Presumption(disposableIncome: number, totalNonpriorityUnsecuredDebt: number): { presumptionArises: boolean; reason: string } {
  const monthly = disposableIncome;
  const over60 = monthly * 60;

  if (over60 >= 10000) {
    // Above $10,000 — presumption arises
    return { presumptionArises: true, reason: `Disposable income × 60 months = $${Math.round(over60).toLocaleString()} exceeds $10,000 threshold` };
  }

  if (over60 >= 6000) {
    // Between $6,000 and $10,000 — check 25% test
    const threshold25 = totalNonpriorityUnsecuredDebt * 0.25;
    if (over60 >= threshold25) {
      return { presumptionArises: true, reason: `Disposable income × 60 = $${Math.round(over60).toLocaleString()} exceeds 25% of nonpriority unsecured debt ($${Math.round(threshold25).toLocaleString()})` };
    }
    return { presumptionArises: false, reason: `Disposable income × 60 = $${Math.round(over60).toLocaleString()} — between $6,000–$10,000 but below 25% of unsecured debt` };
  }

  return { presumptionArises: false, reason: `Disposable income × 60 months = $${Math.round(over60).toLocaleString()} — below $6,000 threshold` };
}

export function runFullMeansTest(inputs: MeansTestInputs): MeansTestResult {
  const cmi = computeCurrentMonthlyIncome(inputs.incomeSources);
  const annualized = computeAnnualizedIncome(cmi);
  const aboveMedian = isAboveMedian(annualized, inputs.stateMedianIncome);
  const expenses = computeAllowedExpenses(inputs);
  const disposable = computeDisposableIncome(cmi, expenses);
  const presumption = computeChapter7Presumption(disposable, inputs.totalNonpriorityUnsecuredDebt);

  const planMonths = aboveMedian ? 60 : 36;
  const ch13Monthly = Math.max(0, disposable);

  const detail: MeansTestResult["calculationDetail"] = [
    { lineNumber: "3", label: "Current monthly income (CMI)", value: cmi },
    { lineNumber: "4", label: "Annualized CMI", value: annualized },
    { lineNumber: "5", label: "State median family income", value: inputs.stateMedianIncome },
    { lineNumber: "5b", label: "Above median?", value: aboveMedian ? 1 : 0, note: aboveMedian ? "YES — full means test required" : "NO — presumption does not arise" },
    ...expenses.breakdown,
    { lineNumber: "45", label: "Monthly disposable income", value: disposable },
    { lineNumber: "46", label: "60-month total", value: disposable * 60 },
  ];

  return {
    currentMonthlyIncome: cmi, annualizedIncome: annualized, stateMedianIncome: inputs.stateMedianIncome,
    isAboveMedian: aboveMedian, totalAllowedExpenses: expenses.total, disposableIncome: disposable,
    presumptionArises: presumption.presumptionArises, presumptionReason: presumption.reason,
    chapter13MonthlyPayment: ch13Monthly, chapter13PlanMonths: planMonths, calculationDetail: detail,
  };
}
