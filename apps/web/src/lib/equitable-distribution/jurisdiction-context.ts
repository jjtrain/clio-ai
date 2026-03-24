export interface JurisdictionRule {
  standard: string;
  statute: string;
  presumption: string;
  factors: string[];
  separatePropertyNote?: string;
  caveats: string[];
}

export const JURISDICTION_RULES: Record<string, JurisdictionRule> = {
  NY: {
    standard: "EQUITABLE",
    statute: "DRL § 236B(5)",
    presumption: "No 50/50 presumption — equitable based on statutory factors",
    factors: [
      "Duration of marriage", "Age and health of parties", "Income and earning capacity",
      "Need of custodial parent to occupy marital home", "Loss of inheritance and pension rights",
      "Maintenance award", "Contributions to marital property", "Liquid vs. non-liquid assets",
      "Tax consequences", "Wasteful dissipation of assets", "Transfer without fair consideration",
    ],
    separatePropertyNote: "Pre-marital assets, gifts, inheritances are separate. Passive appreciation of separate property is separate. Active appreciation may be marital.",
    caveats: ["Marital home may be awarded to custodial parent regardless of title", "QDRO required for division of retirement accounts"],
  },
  CA: {
    standard: "COMMUNITY_PROPERTY",
    statute: "Family Code § 2550",
    presumption: "50/50 split of all community property",
    factors: ["All property acquired during marriage is presumed community", "Separate property: pre-marital, gifts, inheritances, post-separation", "Pereira / Van Camp formulas for business appreciation", "Moore/Marsden for mixed real property"],
    separatePropertyNote: "Strict tracing required to overcome community presumption.",
    caveats: ["Equal division is mandatory absent written agreement", "CA has no equitable distribution discretion for community property"],
  },
  FL: {
    standard: "EQUITABLE",
    statute: "F.S. § 61.075",
    presumption: "Equal distribution presumed — but can be rebutted",
    factors: ["Contribution to marriage (including homemaking)", "Economic circumstances", "Duration of marriage", "Career interruptions", "Contribution to education/career of other spouse", "Desirability of retaining marital home", "Intentional dissipation"],
    caveats: ["FL presumes equal split — stronger than NY's equitable standard", "Dissipation can result in unequal distribution"],
  },
  TX: {
    standard: "COMMUNITY_PROPERTY",
    statute: "Texas Family Code § 7.001",
    presumption: "Community property — but court divides 'just and right' (not necessarily 50/50)",
    factors: ["Fault in breakup of marriage", "Disparity in earning capacity", "Benefits the innocent spouse would have received"],
    caveats: ["TX is unique — community property with 'just and right' division", "Fault affects division"],
  },
  IL: {
    standard: "EQUITABLE",
    statute: "750 ILCS 5/503",
    presumption: "No presumption of equal division",
    factors: ["Duration of marriage", "Relevant economic circumstances", "Obligations from prior marriage", "Age, health, and station of parties", "Custodial provisions for children"],
    caveats: ["Dissipation claims have strict procedural requirements", "Non-marital contribution to marital estate may create claim"],
  },
};

export function getJurisdictionContext(jurisdiction: string): JurisdictionRule {
  return JURISDICTION_RULES[jurisdiction.toUpperCase()] || JURISDICTION_RULES.NY;
}

export const ASSET_CATEGORIES = [
  { value: "REAL_PROPERTY", label: "Real Property", isLiability: false },
  { value: "BANK_ACCOUNTS", label: "Bank Accounts", isLiability: false },
  { value: "INVESTMENTS", label: "Investments & Securities", isLiability: false },
  { value: "RETIREMENT", label: "Retirement Accounts", isLiability: false },
  { value: "BUSINESS_INTERESTS", label: "Business Interests", isLiability: false },
  { value: "LIFE_INSURANCE", label: "Life Insurance (CSV)", isLiability: false },
  { value: "VEHICLES", label: "Vehicles", isLiability: false },
  { value: "PERSONAL_PROPERTY", label: "Personal Property", isLiability: false },
  { value: "OTHER_ASSETS", label: "Other Assets", isLiability: false },
  { value: "MORTGAGE", label: "Mortgages", isLiability: true },
  { value: "CREDIT_CARDS", label: "Credit Cards", isLiability: true },
  { value: "LOANS", label: "Loans", isLiability: true },
  { value: "TAX_LIABILITIES", label: "Tax Liabilities", isLiability: true },
  { value: "OTHER_LIABILITIES", label: "Other Liabilities", isLiability: true },
];

export const CLASSIFICATION_OPTIONS = [
  { value: "MARITAL", label: "Marital", color: "bg-blue-100 text-blue-700" },
  { value: "SEPARATE_PAYOR", label: "Separate (A)", color: "bg-purple-100 text-purple-700" },
  { value: "SEPARATE_PAYEE", label: "Separate (B)", color: "bg-green-100 text-green-700" },
  { value: "MIXED", label: "Mixed", color: "bg-yellow-100 text-yellow-700" },
  { value: "DISPUTED", label: "Disputed", color: "bg-amber-100 text-amber-700" },
];

export const DISPOSITION_OPTIONS = [
  { value: "AWARDED_TO_PAYOR", label: "Awarded to A" },
  { value: "AWARDED_TO_PAYEE", label: "Awarded to B" },
  { value: "SOLD_DIVIDED", label: "Sold & Divided" },
  { value: "TRANSFERRED", label: "Transferred (QDRO)" },
  { value: "OFFSET", label: "Offset" },
  { value: "PENDING", label: "Pending" },
];
