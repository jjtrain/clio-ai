import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding fee split templates...");
  const templates = [
    { id: "fst-pi-referral", name: "Standard PI Referral (1/3 of Attorney Fee)", agreementType: "referral_fee", practiceArea: "personal_injury", splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", defaultParticipants: [{ role: "lead_counsel", isOurFirm: true, splitPercentage: 66.67, responsibilities: ["client_contact", "case_management", "discovery", "negotiation", "trial"] }, { role: "referral_source", isOurFirm: false, splitPercentage: 33.33, responsibilities: [], form1099Required: true }] },
    { id: "fst-5050", name: "50/50 Co-Counsel", agreementType: "co_counsel", splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", defaultParticipants: [{ role: "co_counsel", isOurFirm: true, splitPercentage: 50, responsibilities: ["client_contact", "case_management"] }, { role: "co_counsel", isOurFirm: false, splitPercentage: 50, responsibilities: ["trial", "negotiation"], form1099Required: true }] },
    { id: "fst-6040", name: "60/40 Co-Counsel (Lead/Support)", agreementType: "co_counsel", splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", defaultParticipants: [{ role: "lead_counsel", isOurFirm: true, splitPercentage: 60, responsibilities: ["client_contact", "case_management", "trial"] }, { role: "co_counsel", isOurFirm: false, splitPercentage: 40, responsibilities: ["discovery", "research"] }] },
    { id: "fst-of-counsel", name: "Of-Counsel 25%", agreementType: "of_counsel", splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", defaultParticipants: [{ role: "lead_counsel", isOurFirm: true, splitPercentage: 75 }, { role: "of_counsel", isOurFirm: false, splitPercentage: 25 }] },
    { id: "fst-forwarding", name: "Forwarding Fee 25%", agreementType: "forwarding_fee", splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", defaultParticipants: [{ role: "lead_counsel", isOurFirm: false, splitPercentage: 75, responsibilities: ["client_contact", "case_management", "trial"] }, { role: "forwarding_attorney", isOurFirm: true, splitPercentage: 25, responsibilities: [] }] },
    { id: "fst-tiered", name: "PI Referral — Tiered by Recovery", agreementType: "referral_fee", practiceArea: "personal_injury", splitMethod: "tiered", splitBasis: "attorney_fee", defaultParticipants: [{ role: "lead_counsel", isOurFirm: true }, { role: "referral_source", isOurFirm: false }], tiers: [{ maxRecovery: 100000, ourPercentage: 60, referralPercentage: 40 }, { maxRecovery: 500000, ourPercentage: 67, referralPercentage: 33 }, { maxRecovery: null, ourPercentage: 75, referralPercentage: 25 }] },
  ];
  for (const t of templates) { await prisma.feeSplitTemplate.upsert({ where: { id: t.id }, create: { ...t, isActive: true, firmId: null }, update: {} }); }
  console.log(`Seeded ${templates.length} templates.`);

  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (!firstMatter) { console.log("No matter — skipping agreements."); return; }

  console.log("Seeding demo agreements...");
  // Agreement 1: Referral with Williams
  const agr1 = await prisma.feeSplitAgreement.upsert({
    where: { id: "fsa-williams" },
    create: {
      id: "fsa-williams", matterId: firstMatter.id, matterName: "Johnson PI", agreementType: "referral_fee", referralSourceId: "src-swilliams",
      splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", totalFeePercentage: 33.33, recoveryAmount: 300000, totalFeeAmount: 99990,
      ethicsCompliance: { clientConsentObtained: true, consentDate: "2025-06-15", writtenAgreement: true, proportionalResponsibility: true, totalFeeReasonable: true },
      status: "active", activatedAt: new Date("2025-06-15"), userId: USER_ID, firmId: FIRM_ID,
    },
    update: {},
  });

  await prisma.feeSplitParticipant.upsert({
    where: { id: "fsp-rubinstein-1" },
    create: { id: "fsp-rubinstein-1", agreementId: agr1.id, role: "lead_counsel", isOurFirm: true, firmName: "Rubinstein Law Firm", attorneyName: "Jacob Rubinstein, Esq.", splitPercentage: 66.67, responsibilities: ["client_contact", "case_management", "discovery", "negotiation"], disbursementMethod: "trust_transfer", disbursementStatus: "disbursed", disbursedAmount: 66660 },
    update: {},
  });

  await prisma.feeSplitParticipant.upsert({
    where: { id: "fsp-williams" },
    create: { id: "fsp-williams", agreementId: agr1.id, role: "referral_source", isOurFirm: false, firmName: "Williams Family Law", attorneyName: "Sarah Williams, Esq.", email: "swilliams@williamsfamilylaw.com", barNumber: "NY-54321", splitPercentage: 33.33, responsibilities: [], disbursementMethod: "trust_check", disbursementStatus: "pending", disbursedAmount: 0, form1099Required: true },
    update: {},
  });

  // Disbursements
  await prisma.feeSplitDisbursement.create({ data: { agreementId: agr1.id, participantId: "fsp-rubinstein-1", amount: 66660, description: "Rubinstein earned fee (66.67%)", method: "trust_transfer", status: "completed", completedAt: new Date("2026-03-20"), userId: USER_ID, firmId: FIRM_ID } });
  await prisma.feeSplitDisbursement.create({ data: { agreementId: agr1.id, participantId: "fsp-williams", amount: 33330, description: "Williams referral fee (33.33%)", method: "trust_check", status: "pending", userId: USER_ID, firmId: FIRM_ID } });

  // Agreement 2: Co-counsel
  const agr2 = await prisma.feeSplitAgreement.upsert({
    where: { id: "fsa-cocounsel" },
    create: {
      id: "fsa-cocounsel", matterId: firstMatter.id, matterName: "Smith Complex Litigation", agreementType: "co_counsel",
      splitMethod: "percentage_of_fee", splitBasis: "attorney_fee", totalFeePercentage: 33.33,
      ethicsCompliance: { clientConsentObtained: true, writtenAgreement: true, proportionalResponsibility: true, totalFeeReasonable: true },
      status: "active", userId: USER_ID, firmId: FIRM_ID,
    },
    update: {},
  });

  await prisma.feeSplitParticipant.create({ data: { agreementId: agr2.id, role: "lead_counsel", isOurFirm: true, firmName: "Rubinstein Law Firm", attorneyName: "Jacob Rubinstein, Esq.", splitPercentage: 60, responsibilities: ["client_contact", "case_management", "negotiation"] } });
  await prisma.feeSplitParticipant.create({ data: { agreementId: agr2.id, role: "co_counsel", isOurFirm: false, firmName: "Chen & Associates", attorneyName: "David Chen, Esq.", email: "dchen@chenlaw.com", splitPercentage: 40, responsibilities: ["discovery", "trial"], form1099Required: true } });

  // Origination credit
  await prisma.originationCredit.create({ data: { attorneyId: USER_ID, attorneyName: "Jacob Rubinstein", matterId: firstMatter.id, matterName: firstMatter.name, creditPercentage: 100, totalRevenue: 284000, creditAmount: 284000, firmId: FIRM_ID } });

  console.log("Fee split seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
