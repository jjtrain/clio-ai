import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding how-heard options...");
  const options = [
    { value: "friend_family", label: "A friend or family member", category: "client_referral", iconType: "user", hasFollowUp: true, followUpPrompt: "Who referred you? (optional)", sortOrder: 1, translations: { es: "Un amigo o familiar", zh: "朋友或家人介绍" } },
    { value: "referring_attorney", label: "Another attorney", category: "professional_referral", iconType: "briefcase", hasFollowUp: true, followUpPrompt: "Which attorney?", sortOrder: 2 },
    { value: "medical_provider", label: "My doctor or medical provider", category: "professional_referral", iconType: "heart", hasFollowUp: true, followUpPrompt: "Which doctor or practice?", sortOrder: 3 },
    { value: "google_organic", label: "Google search", category: "digital", iconType: "search", sortOrder: 4 },
    { value: "google_ads", label: "Google ad", category: "digital", iconType: "search", sortOrder: 5 },
    { value: "social_media", label: "Facebook or Instagram", category: "digital", iconType: "globe", sortOrder: 6 },
    { value: "yelp", label: "Yelp", category: "directory", iconType: "star", sortOrder: 7 },
    { value: "legal_directory", label: "Avvo or legal directory", category: "directory", iconType: "book", sortOrder: 8 },
    { value: "repeat_client", label: "I've used your firm before", category: "client_referral", iconType: "refresh", sortOrder: 9 },
    { value: "past_client_referral", label: "A past client recommended you", category: "client_referral", iconType: "user", hasFollowUp: true, followUpPrompt: "Who recommended us?", sortOrder: 10 },
    { value: "community", label: "Community organization or event", category: "event", iconType: "building", hasFollowUp: true, followUpPrompt: "Which organization?", sortOrder: 11 },
    { value: "billboard", label: "Billboard or sign", category: "traditional_marketing", iconType: "image", sortOrder: 12 },
    { value: "broadcast", label: "Radio or TV", category: "traditional_marketing", iconType: "radio", sortOrder: 13 },
    { value: "other", label: "Other", category: "other", iconType: "help", hasFollowUp: true, followUpPrompt: "Please tell us more", sortOrder: 99 },
  ];
  for (const o of options) {
    await prisma.howHeardOption.upsert({ where: { value: o.value }, create: { ...o, isActive: true }, update: { label: o.label } });
  }
  console.log(`Seeded ${options.length} how-heard options.`);

  console.log("Seeding referral sources...");
  const sources = [
    { id: "src-drchen", name: "Dr. Michael Chen", sourceType: "medical_provider", category: "professional_referral", contactName: "Dr. Michael Chen", contactTitle: "Orthopedic Surgeon", contactFirm: "Hempstead Orthopedics", contactEmail: "drchen@hempsteadortho.com", practiceArea: "personal_injury", relationship: "strong", totalReferrals: 12, totalConverted: 10, totalRevenue: 98450, trackingCode: "ref-drchen" },
    { id: "src-swilliams", name: "Sarah Williams, Esq.", sourceType: "referring_attorney", category: "professional_referral", contactName: "Sarah Williams", contactTitle: "Partner", contactFirm: "Williams Family Law", contactEmail: "swilliams@williamsfamilylaw.com", practiceArea: "personal_injury", referralAgreement: true, referralFeeType: "percentage", referralFeeAmount: 33.33, relationship: "strong", totalReferrals: 5, totalConverted: 4, totalRevenue: 62000, trackingCode: "ref-swilliams" },
    { id: "src-gads-pi", name: "Google Ads — Personal Injury", sourceType: "google_ads", category: "digital_marketing", practiceArea: "personal_injury", utmSource: "google", utmMedium: "cpc", utmCampaign: "pi-nassau-2026", totalReferrals: 34, totalConverted: 12, totalRevenue: 145000, trackingCode: "ref-gads-pi" },
    { id: "src-google-organic", name: "Google Organic Search", sourceType: "google_organic", category: "organic", totalReferrals: 22, totalConverted: 8, totalRevenue: 67000 },
    { id: "src-rodriguez", name: "John & Maria Rodriguez", sourceType: "past_client", category: "client_referral", contactName: "John & Maria Rodriguez", contactEmail: "rodriguez.family@email.com", practiceArea: "personal_injury", relationship: "strong", totalReferrals: 3, totalConverted: 3, totalRevenue: 42000, trackingCode: "ref-rodriguez" },
    { id: "src-yelp", name: "Yelp Business Page", sourceType: "yelp", category: "directory_listing", totalReferrals: 8, totalConverted: 3, totalRevenue: 28000 },
    { id: "src-ncba", name: "Nassau County Bar Association", sourceType: "bar_association", category: "institutional", contactFirm: "Nassau County Bar Association", totalReferrals: 4, totalConverted: 3, totalRevenue: 35000 },
    { id: "src-fb-imm", name: "Facebook Ads — Immigration", sourceType: "facebook_ads", category: "digital_marketing", practiceArea: "immigration", utmSource: "facebook", utmMedium: "paid", utmCampaign: "imm-fb-2026", totalReferrals: 15, totalConverted: 6, totalRevenue: 54000, trackingCode: "ref-fb-imm" },
  ];
  for (const s of sources) {
    await prisma.referralSource.upsert({ where: { id: s.id }, create: { ...s, isActive: true, firmId: FIRM_ID }, update: { totalReferrals: s.totalReferrals, totalRevenue: s.totalRevenue } });
  }
  console.log(`Seeded ${sources.length} sources.`);

  console.log("Seeding campaigns...");
  const campaigns = [
    { id: "camp-pi-gads", name: "Q1 2026 — PI Google Ads", campaignType: "digital_ad", channel: "google_ads", practiceArea: "personal_injury", startDate: new Date("2026-01-01"), budget: 5000, spent: 3800, utmCampaign: "pi-nassau-2026", totalLeads: 34, totalConsultations: 28, totalRetained: 12, totalRevenue: 145000, costPerLead: 112, costPerRetained: 317, roi: 3716, status: "active" },
    { id: "camp-fb-imm", name: "Q1 2026 — Immigration Facebook", campaignType: "digital_ad", channel: "facebook", practiceArea: "immigration", startDate: new Date("2026-01-01"), budget: 2000, spent: 1600, utmCampaign: "imm-fb-2026", totalLeads: 15, totalConsultations: 10, totalRetained: 6, totalRevenue: 54000, costPerLead: 107, costPerRetained: 267, roi: 3275, status: "active" },
    { id: "camp-drchen", name: "Dr. Chen Referral Relationship", campaignType: "referral_program", practiceArea: "personal_injury", startDate: new Date("2025-01-01"), budget: 1200, spent: 600, totalLeads: 12, totalRetained: 10, totalRevenue: 98450, costPerLead: 50, costPerRetained: 60, roi: 16308, status: "active" },
  ];
  for (const c of campaigns) {
    await prisma.referralCampaign.upsert({ where: { id: c.id }, create: { ...c, firmId: FIRM_ID }, update: { spent: c.spent, totalRevenue: c.totalRevenue } });
  }
  console.log(`Seeded ${campaigns.length} campaigns.`);

  console.log("Seeding demo referrals...");
  const now = new Date();
  const referrals = [
    { sourceId: "src-drchen", clientName: "Alice Johnson", practiceArea: "personal_injury", status: "active_matter", revenue: 15000, referralDate: new Date(now.getTime() - 30 * 86400000) },
    { sourceId: "src-drchen", clientName: "Bob Martinez", practiceArea: "personal_injury", status: "retained", referralDate: new Date(now.getTime() - 10 * 86400000) },
    { sourceId: "src-gads-pi", clientName: "Carol White", practiceArea: "personal_injury", status: "consultation_scheduled", referralDate: new Date(now.getTime() - 3 * 86400000) },
    { sourceId: "src-gads-pi", clientName: "David Brown", practiceArea: "personal_injury", status: "lead", referralDate: new Date(now.getTime() - 1 * 86400000) },
    { sourceId: "src-fb-imm", clientName: "Elena Petrova", practiceArea: "immigration", status: "retained", revenue: 8000, referralDate: new Date(now.getTime() - 20 * 86400000) },
    { sourceId: "src-fb-imm", clientName: "Fatima Ahmed", practiceArea: "immigration", status: "lead", referralDate: new Date(now.getTime() - 2 * 86400000) },
    { sourceId: "src-rodriguez", clientName: "George Kim", practiceArea: "personal_injury", status: "matter_closed", revenue: 22000, referralDate: new Date(now.getTime() - 60 * 86400000) },
    { sourceId: "src-swilliams", clientName: "Helen Turner", practiceArea: "personal_injury", status: "active_matter", revenue: 0, referralDate: new Date(now.getTime() - 15 * 86400000) },
    { sourceId: "src-yelp", clientName: "Ivan Petrov", status: "lost_lead", lostReason: "chose_other_firm", referralDate: new Date(now.getTime() - 25 * 86400000) },
    { sourceId: "src-google-organic", clientName: "Julia Chen", practiceArea: "personal_injury", status: "consultation_completed", referralDate: new Date(now.getTime() - 5 * 86400000) },
  ];
  for (const r of referrals) {
    await prisma.referralEntry.create({ data: { ...r, userId: USER_ID, firmId: FIRM_ID } });
  }
  console.log(`Seeded ${referrals.length} referrals.`);

  console.log("Seeding thank-yous...");
  const thankYous = [
    { sourceId: "src-drchen", occasion: "new_referral", thankYouType: "email", scheduledDate: new Date(now.getTime() - 10 * 86400000), status: "completed", sentAt: new Date(now.getTime() - 10 * 86400000) },
    { sourceId: "src-rodriguez", occasion: "case_settled", thankYouType: "letter", scheduledDate: new Date(now.getTime() - 5 * 86400000), status: "completed", sentAt: new Date(now.getTime() - 4 * 86400000) },
    { sourceId: "src-drchen", occasion: "new_referral", thankYouType: "email", scheduledDate: new Date(now.getTime() + 2 * 86400000), status: "scheduled" },
    { sourceId: "src-ncba", occasion: "holiday", thankYouType: "letter", scheduledDate: new Date(now.getTime() + 30 * 86400000), status: "scheduled" },
    { sourceId: "src-swilliams", occasion: "new_referral", thankYouType: "email", scheduledDate: new Date(now.getTime() - 3 * 86400000), status: "scheduled" }, // overdue
  ];
  for (const t of thankYous) {
    await prisma.referralThankYou.create({ data: { ...t, userId: USER_ID, firmId: FIRM_ID } });
  }
  console.log(`Seeded ${thankYous.length} thank-yous.`);
  console.log("Referral seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
