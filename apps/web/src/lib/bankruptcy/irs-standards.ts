/**
 * IRS National and Local Standards for bankruptcy means test.
 * Source: https://www.justice.gov/ust/means-testing
 * ⚠️ VERIFY before filing — IRS updates these periodically.
 */
export const IRS_EFFECTIVE_DATE = "2024-04-01";

// National Standards (monthly) by household size: 1, 2, 3, 4+
export const IRS_NATIONAL_STANDARDS: Record<string, number[]> = {
  FOOD: [417, 752, 889, 1049],
  HOUSEKEEPING_SUPPLIES: [42, 80, 69, 80],
  APPAREL_SERVICES: [99, 161, 208, 250],
  PERSONAL_CARE: [45, 76, 70, 82],
  MISCELLANEOUS: [186, 349, 349, 402],
};

export function getNationalStandard(category: string, householdSize: number): number {
  const data = IRS_NATIONAL_STANDARDS[category];
  if (!data) return 0;
  const idx = Math.min(Math.max(householdSize, 1), 4) - 1;
  return data[idx];
}

export function getTotalNationalStandard(householdSize: number): number {
  return Object.values(IRS_NATIONAL_STANDARDS).reduce((s, arr) => {
    const idx = Math.min(Math.max(householdSize, 1), 4) - 1;
    return s + arr[idx];
  }, 0);
}

// Local Standards — Housing + Utilities (monthly by state, household sizes 1-4+)
// Top 10 most populous states + statewide figures
export const IRS_LOCAL_STANDARDS_HOUSING: Record<string, number[]> = {
  CA: [2147, 2523, 2523, 2719],
  TX: [1458, 1713, 1713, 1847],
  FL: [1538, 1808, 1808, 1949],
  NY: [1893, 2224, 2224, 2398],
  PA: [1224, 1439, 1439, 1551],
  IL: [1356, 1594, 1594, 1718],
  OH: [1074, 1262, 1262, 1361],
  GA: [1273, 1496, 1496, 1613],
  NC: [1194, 1403, 1403, 1513],
  MI: [1119, 1315, 1315, 1418],
  // Default for unlisted states
  DEFAULT: [1200, 1410, 1410, 1520],
};

export function getHousingStandard(state: string, _county: string, householdSize: number): number {
  const data = IRS_LOCAL_STANDARDS_HOUSING[state.toUpperCase()] || IRS_LOCAL_STANDARDS_HOUSING.DEFAULT;
  const idx = Math.min(Math.max(householdSize, 1), 4) - 1;
  return data[idx];
}

// Local Standards — Transportation (monthly)
export const IRS_TRANSPORT = {
  OWNERSHIP_1: 588,    // 1st vehicle ownership allowance
  OWNERSHIP_2: 588,    // 2nd vehicle
  OPERATING_1: 268,    // 1st vehicle operating
  OPERATING_2: 268,    // 2nd vehicle operating
  PUBLIC_TRANSPORT: 242, // no vehicle
};

export function getTransportStandard(_region: string, ownsVehicle: boolean, vehicleCount: number = 1): {
  ownership: number; operating: number; publicTransport: number;
} {
  if (!ownsVehicle) return { ownership: 0, operating: 0, publicTransport: IRS_TRANSPORT.PUBLIC_TRANSPORT };
  return {
    ownership: vehicleCount >= 2 ? IRS_TRANSPORT.OWNERSHIP_1 + IRS_TRANSPORT.OWNERSHIP_2 : IRS_TRANSPORT.OWNERSHIP_1,
    operating: vehicleCount >= 2 ? IRS_TRANSPORT.OPERATING_1 + IRS_TRANSPORT.OPERATING_2 : IRS_TRANSPORT.OPERATING_1,
    publicTransport: 0,
  };
}

// Healthcare out-of-pocket (per person per month)
export const HEALTHCARE_OOP_PER_PERSON = 75;
