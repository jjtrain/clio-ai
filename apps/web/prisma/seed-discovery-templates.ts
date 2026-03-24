import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding discovery templates...");

  // PI — Auto Accident
  const piTemplate = await prisma.discoveryCLTemplate.create({
    data: {
      name: "Personal Injury — Auto Accident (NY)", practiceArea: "personal_injury",
      caseTypes: ["auto_accident", "rear_end_collision", "multi_vehicle"], jurisdiction: "NY",
      description: "Comprehensive PI auto accident discovery checklist for NY Supreme Court including CPLR citations and sample demand language.",
      isDefault: true, isSystemTemplate: true,
    },
  });

  const piSections: Array<{ name: string; category: string; items: Array<{ title: string; priority?: string; legalBasis?: string; sampleLanguage?: string; practiceNote?: string; isRequired?: boolean; conditionalOn?: string; tags?: string[] }> }> = [
    { name: "Interrogatories to Serve", category: "INTERROGATORIES_TO_SERVE", items: [
      { title: "Identity and background of all defendants/drivers", legalBasis: "CPLR §3130", sampleLanguage: "State your full name, address, date of birth, driver's license number, and state of issuance.", practiceNote: "Essential for confirming proper defendants; cross-check with police report.", priority: "CRITICAL" },
      { title: "Description of the accident", sampleLanguage: "Describe in full detail how the accident occurred, including direction of travel, speed, and point of impact." },
      { title: "Prior accidents or violations of defendant", sampleLanguage: "Identify all motor vehicle accidents you were involved in during the 10 years prior, and all traffic violations within 5 years.", practiceNote: "Critical for pattern of negligence; may support punitive damages." },
      { title: "Employment and distraction at time of accident", sampleLanguage: "Were you on duty for any employer? Were you using a cell phone or electronic device?" },
      { title: "Insurance coverage — all defendants", legalBasis: "CPLR §3101(f)", sampleLanguage: "Identify all insurance policies that may provide coverage, including insurer name, policy number, and coverage limits.", priority: "CRITICAL" },
      { title: "Prior knowledge of vehicle defects" },
      { title: "Vehicle ownership and maintenance records" },
      { title: "Traffic signals, signs, and road conditions" },
      { title: "Witnesses known to defendant" },
      { title: "Post-accident actions taken" },
      { title: "Photographs or recordings taken" },
      { title: "Social media activity (day of and after accident)", practiceNote: "NY courts have allowed social media discovery in PI cases." },
      { title: "Alcohol / drug use" },
      { title: "Prior claims and lawsuits by defendant" },
      { title: "No-fault application filed", legalBasis: "Insurance Law §5106" },
    ]},
    { name: "Documents to Demand", category: "DOCUMENTS_TO_DEMAND", items: [
      { title: "Police/accident report (MV-104)", priority: "CRITICAL" },
      { title: "All photographs and videos of accident scene" },
      { title: "Vehicle maintenance and inspection records (3 years)" },
      { title: "Defendant's cell phone records (day of accident ± 24 hrs)", practiceNote: "Subpoena carrier if defendant denies use." },
      { title: "Insurance policy declarations pages", priority: "CRITICAL" },
      { title: "No-fault claim records (NF-2, NF-3, NF-10)" },
      { title: "Prior accident reports involving defendant or vehicle" },
      { title: "Dashcam footage" },
      { title: "Traffic camera footage", priority: "CRITICAL", practiceNote: "NYC DOT retains footage only 30 days. File subpoena immediately." },
      { title: "Employer records if defendant was on duty" },
      { title: "Vehicle inspection/registration records (DMV)" },
      { title: "Black box / EDR data", practiceNote: "Most vehicles 2004+ have EDR. Demand preservation immediately." },
      { title: "Toxicology / blood alcohol records", conditionalOn: "matter.isDWI == true" },
      { title: "Defendant's driving record (DMV abstract)" },
      { title: "GPS data / navigation records" },
      { title: "Social media posts from date of accident onward" },
      { title: "All communications regarding the accident" },
      { title: "Prior lawsuits and claims records" },
    ]},
    { name: "Documents to Produce", category: "DOCUMENTS_TO_PRODUCE", items: [
      { title: "All medical records and bills (all providers, 5 years prior)", priority: "CRITICAL" },
      { title: "Pharmacy records" },
      { title: "Health insurance records and EOBs" },
      { title: "Lost wage documentation (pay stubs, W-2s, employer letter)" },
      { title: "Prior injury records relating to same body parts", practiceNote: "Pre-existing conditions reduce but don't bar recovery in NY." },
      { title: "No-fault records and PIP payments received" },
      { title: "Workers' compensation records", isRequired: false },
      { title: "Plaintiff's cell phone records (day of accident)" },
      { title: "Photographs taken by plaintiff" },
      { title: "Social media posts by plaintiff" },
      { title: "Prior lawsuits or claims by plaintiff" },
      { title: "Expert reports obtained" },
    ]},
    { name: "Depositions to Notice", category: "DEPOSITIONS_TO_NOTICE", items: [
      { title: "Defendant driver", priority: "CRITICAL", practiceNote: "Depose before they review their own interrogatory answers if possible." },
      { title: "Vehicle owner (if different from driver)" },
      { title: "Eyewitnesses identified in interrogatory answers" },
      { title: "Responding police officer(s)" },
      { title: "Plaintiff's treating physician(s)", practiceNote: "Schedule after records received. Prepare 'threshold' questions for serious injury under Insurance Law §5102(d)." },
      { title: "Defendant's expert witness(es)" },
    ]},
    { name: "Subpoenas to Issue", category: "SUBPOENAS_TO_ISSUE", items: [
      { title: "Hospital and ER records" },
      { title: "Primary care physician records" },
      { title: "Specialist records (orthopedic, neurological)" },
      { title: "Physical therapy records" },
      { title: "Employment and wage records" },
      { title: "Traffic camera footage — NYC DOT / municipality", priority: "CRITICAL" },
      { title: "Cell carrier records for defendant's phone" },
      { title: "Vehicle EDR / black box data" },
    ]},
    { name: "Expert Witnesses", category: "EXPERT_WITNESSES", items: [
      { title: "Medical expert / IME physician", practiceNote: "In threshold cases, need expert for serious injury under §5102(d)." },
      { title: "Accident reconstruction expert", isRequired: false, practiceNote: "Required if liability disputed." },
      { title: "Vocational rehabilitation expert", isRequired: false, conditionalOn: "damages.lostWages > 50000" },
      { title: "Life care planner (catastrophic injury)", isRequired: false, conditionalOn: "damages.permanentInjury == true" },
    ]},
    { name: "Preservation Holds", category: "PRESERVATION_HOLDS", items: [
      { title: "Send litigation hold letter to defendant", priority: "CRITICAL" },
      { title: "Demand EDR preservation in writing", priority: "CRITICAL" },
      { title: "Demand dashcam footage preservation" },
      { title: "Notify municipality to preserve traffic camera footage", priority: "CRITICAL", practiceNote: "NYC DOT 30-day retention. Send certified letter same day." },
      { title: "Instruct client to preserve all social media" },
    ]},
    { name: "ESI Discovery", category: "ESI_DISCOVERY", items: [
      { title: "Defendant's cell phone ESI — texts and app data" },
      { title: "Vehicle telematics data (OnStar, fleet GPS)" },
      { title: "Social media ESI — metadata, deleted posts" },
      { title: "Surveillance footage (Ring cameras, business cameras)", practiceNote: "Send preservation letters to nearby businesses within 48 hours." },
    ]},
  ];

  for (let s = 0; s < piSections.length; s++) {
    const sec = await prisma.discoveryCLTemplateSection.create({
      data: { templateId: piTemplate.id, name: piSections[s].name, category: piSections[s].category, sequenceNumber: s + 1 },
    });
    for (let i = 0; i < piSections[s].items.length; i++) {
      const item = piSections[s].items[i];
      await prisma.discoveryCLTemplateItem.create({
        data: {
          sectionId: sec.id, title: item.title, description: item.sampleLanguage ? `Sample: ${item.sampleLanguage}` : null,
          legalBasis: item.legalBasis, sampleLanguage: item.sampleLanguage, practiceNote: item.practiceNote,
          category: piSections[s].category, priority: item.priority || "STANDARD",
          isRequired: item.isRequired ?? true, conditionalOn: item.conditionalOn, tags: item.tags, sequenceNumber: i + 1,
        },
      });
    }
  }
  console.log(`Seeded PI auto accident template with ${piSections.reduce((s, sec) => s + sec.items.length, 0)} items.`);

  // Family Law — Contested Divorce (abbreviated)
  const flTemplate = await prisma.discoveryCLTemplate.create({
    data: { name: "Family Law — Contested Divorce (NY)", practiceArea: "family_law", caseTypes: ["contested_divorce"], jurisdiction: "NY", isDefault: true, isSystemTemplate: true },
  });

  const flSections = [
    { name: "Interrogatories to Serve", category: "INTERROGATORIES_TO_SERVE", items: [
      { title: "All income sources (salary, bonuses, deferred comp, stock options)", priority: "CRITICAL", legalBasis: "DRL §236(B)" },
      { title: "All assets held individually or jointly", priority: "CRITICAL" },
      { title: "All debts and liabilities" },
      { title: "Business ownership interests" },
      { title: "Pension/retirement accounts" },
      { title: "Digital assets / cryptocurrency" },
    ]},
    { name: "Documents to Demand", category: "DOCUMENTS_TO_DEMAND", items: [
      { title: "Tax returns (3 years personal + business)", priority: "CRITICAL" },
      { title: "Bank account statements (all accounts, 3 years)", priority: "CRITICAL" },
      { title: "Pay stubs (12 months) and employment contracts" },
      { title: "Business records: P&L, balance sheet, corporate returns", practiceNote: "If self-employed, income often understated. Cross-reference lifestyle." },
      { title: "Real property deeds and mortgage statements" },
      { title: "Credit card statements (3 years)" },
      { title: "Loan applications (5 years)", practiceNote: "Loan applications show accurate income — people don't lie to banks." },
      { title: "Pension and retirement account statements" },
      { title: "Pre-nuptial or post-nuptial agreements" },
    ]},
    { name: "Subpoenas to Issue", category: "SUBPOENAS_TO_ISSUE", items: [
      { title: "IRS tax transcript (Form 4506)" },
      { title: "Employer payroll records" },
      { title: "All financial institutions" },
      { title: "Cryptocurrency exchanges", practiceNote: "NY courts allow crypto exchange subpoenas." },
    ]},
    { name: "Expert Witnesses", category: "EXPERT_WITNESSES", items: [
      { title: "Forensic accountant", isRequired: false, conditionalOn: "matter.hasBusinessInterests == true", priority: "CRITICAL" },
      { title: "Business valuator", isRequired: false },
      { title: "Child psychologist / forensic evaluator", isRequired: false, conditionalOn: "matter.hasCustodyDispute == true" },
      { title: "Real estate appraiser", isRequired: false },
    ]},
    { name: "Items to Verify", category: "ITEMS_TO_VERIFY", items: [
      { title: "Run asset search on opposing spouse" },
      { title: "Check deed records for recent transfers", practiceNote: "Spouses sometimes transfer property to hide assets." },
      { title: "Check business filings (Secretary of State)" },
      { title: "Check for hidden bank accounts via lifestyle analysis" },
    ]},
  ];

  for (let s = 0; s < flSections.length; s++) {
    const sec = await prisma.discoveryCLTemplateSection.create({
      data: { templateId: flTemplate.id, name: flSections[s].name, category: flSections[s].category, sequenceNumber: s + 1 },
    });
    for (let i = 0; i < flSections[s].items.length; i++) {
      const item = flSections[s].items[i] as any;
      await prisma.discoveryCLTemplateItem.create({
        data: { sectionId: sec.id, title: item.title, legalBasis: item.legalBasis || null, practiceNote: item.practiceNote || null, category: flSections[s].category, priority: item.priority || "STANDARD", isRequired: item.isRequired ?? true, conditionalOn: item.conditionalOn || null, sequenceNumber: i + 1 },
      });
    }
  }
  console.log(`Seeded Family Law template with ${flSections.reduce((s, sec) => s + sec.items.length, 0)} items.`);

  console.log("Discovery template seeding complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
