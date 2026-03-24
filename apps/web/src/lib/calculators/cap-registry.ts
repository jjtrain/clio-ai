// ⚠️  UPDATE ANNUALLY: NY CSSA cap announced by OCA each March
// ⚠️  UPDATE ANNUALLY: NY Maintenance cap per DRL § 236B(6)(b)
// ⚠️  UPDATE ANNUALLY: TX net resources cap per OAG guidance
// Source: https://www.nycourts.gov/divorce/child_support.shtml (NY)
// Source: https://www.texasattorneygeneral.gov (TX)

export const CAP_REGISTRY: Record<string, Record<number, Record<string, number>>> = {
  NY_CSSA: {
    2022: { combinedIncomeCap: 154_000, selfSupportReserve: 16_900 },
    2023: { combinedIncomeCap: 163_000, selfSupportReserve: 17_226 },
    2024: { combinedIncomeCap: 163_000, selfSupportReserve: 17_226 },
    2025: { combinedIncomeCap: 183_000, selfSupportReserve: 18_347 },
  },
  NY_MAINTENANCE: {
    2023: { payorIncomeCap: 184_000 },
    2024: { payorIncomeCap: 203_000 },
    2025: { payorIncomeCap: 228_000 },
  },
  TX_NET_RESOURCES: {
    2023: { monthlyCap: 9_200 },
    2024: { monthlyCap: 9_200 },
    2025: { monthlyCap: 9_200 },
  },
  FL_SCHEDULE_MAX: {
    2023: { combinedNetIncomeCap: 10_000 },
    2024: { combinedNetIncomeCap: 10_000 },
    2025: { combinedNetIncomeCap: 10_000 },
  },
};

export function getCurrentCaps(registryKey: string): Record<string, number> {
  const registry = CAP_REGISTRY[registryKey];
  if (!registry) return {};
  const currentYear = new Date().getFullYear();
  return registry[currentYear] || registry[Math.max(...Object.keys(registry).map(Number))] || {};
}
