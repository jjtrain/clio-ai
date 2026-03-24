export interface ChildSupportInputs {
  payorGrossAnnualIncome: number;
  payeeGrossAnnualIncome: number;
  numberOfChildren: number;
  childrenAges: number[];
  payorOtherChildSupportOrders: number;
  payeeOtherChildSupportOrders: number;
  payorSSTaxDeduction: number;
  payeeSSTaxDeduction: number;
  childHealthInsurancePremium: number;
  childHealthInsurancePaidBy: "payor" | "payee" | "split" | "none";
  childcareExpensesAnnual: number;
  childcareExpensesPaidBy: "payor" | "payee" | "split";
  educationalExpensesAnnual: number;
  educationalExpensesPaidBy: "payor" | "payee" | "split";
  unreimbursedMedicalAnnual: number;
  unreimbursedMedicalPaidBy: "payor" | "payee" | "split";
  custodyArrangement: "sole" | "primary" | "shared";
  payorCustodyPercent: number;
  // NY
  combinedIncomeAboveCap: "discretion_below" | "apply_percentage";
  // CA
  payorTimesharePercent: number;
  payorActualFederalTaxRate: number;
  payorActualStateTaxRate: number;
  payeeActualFederalTaxRate: number;
  payeeActualStateTaxRate: number;
  payorHealthInsurancePremium: number;
  payeeHealthInsurancePremium: number;
  payorMandatoryRetirement: number;
  payeeMandatoryRetirement: number;
  // FL
  overnightsWithPayor: number;
}

export interface ChildSupportResult {
  jurisdiction: string;
  formulaVersion: string;
  guidelineMonthlyAmount: number;
  payorShareMonthly: number;
  payeeShareMonthly: number;
  combinedAdjustedIncome: number;
  payorIncomeShare: number;
  payeeIncomeShare: number;
  baseObligationMonthly: number;
  addOns: AddOnItem[];
  totalWithAddOns: number;
  incomeCapApplied: boolean;
  capAmount?: number;
  aboveCapDiscretionaryAmount?: number;
  sharedCustodyAdjustment?: number;
  adjustedAfterCustody?: number;
  warnings: string[];
  assumptions: string[];
  formulaBreakdown: FormulaStep[];
}

export interface MaintenanceInputs {
  payorGrossAnnualIncome: number;
  payeeGrossAnnualIncome: number;
  payorIncomeCap?: number;
  marriageDurationYears: number;
  payorAge: number;
  payeeAge: number;
  childSupportBeingPaid: number;
  payorMaintainHealthInsurance: boolean;
  jurisdiction: string;
}

export interface MaintenanceResult {
  jurisdiction: string;
  formulaVersion: string;
  isStatutoryFormula: boolean;
  guidelineMonthlyAmount: number;
  durationMonths: number;
  durationBasis: string;
  durationRange?: { min: number; max: number };
  amountRange?: { min: number; max: number };
  formulaBreakdown: FormulaStep[];
  warnings: string[];
  assumptions: string[];
}

export interface FormulaStep {
  label: string;
  formula: string;
  result: number;
  note?: string;
}

export interface AddOnItem {
  label: string;
  annualCost: number;
  monthlyCost: number;
  payorShare: number;
  payeeShare: number;
  payorMonthly: number;
  payeeMonthly: number;
}

export const DEFAULT_CHILD_SUPPORT_INPUTS: ChildSupportInputs = {
  payorGrossAnnualIncome: 100000,
  payeeGrossAnnualIncome: 50000,
  numberOfChildren: 1,
  childrenAges: [8],
  payorOtherChildSupportOrders: 0,
  payeeOtherChildSupportOrders: 0,
  payorSSTaxDeduction: 0,
  payeeSSTaxDeduction: 0,
  childHealthInsurancePremium: 0,
  childHealthInsurancePaidBy: "none",
  childcareExpensesAnnual: 0,
  childcareExpensesPaidBy: "split",
  educationalExpensesAnnual: 0,
  educationalExpensesPaidBy: "split",
  unreimbursedMedicalAnnual: 0,
  unreimbursedMedicalPaidBy: "split",
  custodyArrangement: "sole",
  payorCustodyPercent: 20,
  combinedIncomeAboveCap: "discretion_below",
  payorTimesharePercent: 20,
  payorActualFederalTaxRate: 22,
  payorActualStateTaxRate: 6,
  payeeActualFederalTaxRate: 12,
  payeeActualStateTaxRate: 4,
  payorHealthInsurancePremium: 0,
  payeeHealthInsurancePremium: 0,
  payorMandatoryRetirement: 0,
  payeeMandatoryRetirement: 0,
  overnightsWithPayor: 73,
};
