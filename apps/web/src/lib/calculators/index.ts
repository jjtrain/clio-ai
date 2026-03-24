export type { ChildSupportInputs, ChildSupportResult, MaintenanceInputs, MaintenanceResult, FormulaStep, AddOnItem } from "./types";
export { DEFAULT_CHILD_SUPPORT_INPUTS } from "./types";
export { getCurrentCaps } from "./cap-registry";

import type { ChildSupportInputs, ChildSupportResult, MaintenanceInputs, MaintenanceResult } from "./types";
import { calculateNYChildSupport, NY_CSSA_VERSION } from "./child-support/ny-cssa";
import { calculateCAChildSupport, CA_GUIDELINE_VERSION } from "./child-support/ca-guideline";
import { calculateFLChildSupport, FL_INCOME_SHARES_VERSION } from "./child-support/fl-income-shares";
import { calculateTXChildSupport, TX_PERCENTAGE_VERSION } from "./child-support/tx-percentage";
import { calculateILChildSupport, IL_INCOME_SHARES_VERSION } from "./child-support/il-income-shares";
import { calculateNYMaintenance, NY_MAINTENANCE_VERSION } from "./maintenance/ny-maintenance";
import { calculateCAMaintenance, CA_MAINTENANCE_VERSION } from "./maintenance/ca-maintenance";

export function calculateChildSupport(inputs: ChildSupportInputs, jurisdiction: string): ChildSupportResult {
  switch (jurisdiction.toUpperCase()) {
    case "NY": return calculateNYChildSupport(inputs);
    case "CA": return calculateCAChildSupport(inputs);
    case "FL": return calculateFLChildSupport(inputs);
    case "TX": return calculateTXChildSupport(inputs);
    case "IL": return calculateILChildSupport(inputs);
    default: throw new Error(`Unsupported jurisdiction: ${jurisdiction}. Supported: NY, CA, FL, TX, IL`);
  }
}

export function calculateMaintenance(inputs: MaintenanceInputs, jurisdiction: string): MaintenanceResult {
  switch (jurisdiction.toUpperCase()) {
    case "NY": return calculateNYMaintenance(inputs);
    case "CA": return calculateCAMaintenance(inputs);
    default:
      // Generic advisory for other jurisdictions
      return calculateCAMaintenance({ ...inputs, jurisdiction });
  }
}

export function getFormulaVersion(jurisdiction: string, calcType: string): string {
  const j = jurisdiction.toUpperCase();
  if (calcType === "CHILD_SUPPORT" || calcType === "COMBINED") {
    switch (j) {
      case "NY": return NY_CSSA_VERSION;
      case "CA": return CA_GUIDELINE_VERSION;
      case "FL": return FL_INCOME_SHARES_VERSION;
      case "TX": return TX_PERCENTAGE_VERSION;
      case "IL": return IL_INCOME_SHARES_VERSION;
    }
  }
  if (calcType === "MAINTENANCE" || calcType === "COMBINED") {
    switch (j) {
      case "NY": return NY_MAINTENANCE_VERSION;
      case "CA": return CA_MAINTENANCE_VERSION;
    }
  }
  return `${j}_ADVISORY_2024`;
}

export const SUPPORTED_JURISDICTIONS = [
  { code: "NY", name: "New York", flag: "🗽", childSupport: true, maintenance: true, maintenanceType: "statutory" },
  { code: "CA", name: "California", flag: "🌴", childSupport: true, maintenance: true, maintenanceType: "advisory" },
  { code: "FL", name: "Florida", flag: "🌞", childSupport: true, maintenance: false, maintenanceType: null },
  { code: "TX", name: "Texas", flag: "⭐", childSupport: true, maintenance: false, maintenanceType: null },
  { code: "IL", name: "Illinois", flag: "🏙️", childSupport: true, maintenance: false, maintenanceType: null },
];
