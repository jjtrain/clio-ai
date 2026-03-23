import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding court holidays...");

  // ─── Court Holidays 2026 ──────────────────────────────────────────────
  const holidays2026 = [
    { name: "New Year's Day", date: new Date("2026-01-01"), jurisdiction: "all", isRecurring: true, recurMonth: 1, recurDay: 1 },
    { name: "MLK Day", date: new Date("2026-01-19"), jurisdiction: "all", isRecurring: true, recurRule: "third_monday_january" },
    { name: "Lincoln's Birthday", date: new Date("2026-02-12"), jurisdiction: "ny_state", isRecurring: true, recurMonth: 2, recurDay: 12 },
    { name: "Presidents' Day", date: new Date("2026-02-16"), jurisdiction: "all", isRecurring: true, recurRule: "third_monday_february" },
    { name: "Memorial Day", date: new Date("2026-05-25"), jurisdiction: "all", isRecurring: true, recurRule: "last_monday_may" },
    { name: "Juneteenth", date: new Date("2026-06-19"), jurisdiction: "all", isRecurring: true, recurMonth: 6, recurDay: 19 },
    { name: "Independence Day", date: new Date("2026-07-04"), jurisdiction: "all", isRecurring: true, recurMonth: 7, recurDay: 4 },
    { name: "Labor Day", date: new Date("2026-09-07"), jurisdiction: "all", isRecurring: true, recurRule: "first_monday_september" },
    { name: "Columbus Day", date: new Date("2026-10-12"), jurisdiction: "all", isRecurring: true, recurRule: "second_monday_october" },
    { name: "Election Day", date: new Date("2026-11-03"), jurisdiction: "ny_state", isRecurring: true, recurRule: "first_tuesday_after_first_monday_november" },
    { name: "Veterans Day", date: new Date("2026-11-11"), jurisdiction: "all", isRecurring: true, recurMonth: 11, recurDay: 11 },
    { name: "Thanksgiving", date: new Date("2026-11-26"), jurisdiction: "all", isRecurring: true, recurRule: "fourth_thursday_november" },
    { name: "Day After Thanksgiving", date: new Date("2026-11-27"), jurisdiction: "all", isRecurring: true, recurRule: "friday_after_fourth_thursday_november" },
    { name: "Christmas", date: new Date("2026-12-25"), jurisdiction: "all", isRecurring: true, recurMonth: 12, recurDay: 25 },
  ];

  // ─── Court Holidays 2027 ──────────────────────────────────────────────
  const holidays2027 = [
    { name: "New Year's Day", date: new Date("2027-01-01"), jurisdiction: "all", isRecurring: true, recurMonth: 1, recurDay: 1 },
    { name: "MLK Day", date: new Date("2027-01-18"), jurisdiction: "all", isRecurring: true, recurRule: "third_monday_january" },
    { name: "Lincoln's Birthday", date: new Date("2027-02-12"), jurisdiction: "ny_state", isRecurring: true, recurMonth: 2, recurDay: 12 },
    { name: "Presidents' Day", date: new Date("2027-02-15"), jurisdiction: "all", isRecurring: true, recurRule: "third_monday_february" },
    { name: "Memorial Day", date: new Date("2027-05-31"), jurisdiction: "all", isRecurring: true, recurRule: "last_monday_may" },
    { name: "Juneteenth", date: new Date("2027-06-19"), jurisdiction: "all", isRecurring: true, recurMonth: 6, recurDay: 19 },
    { name: "Independence Day", date: new Date("2027-07-04"), jurisdiction: "all", isRecurring: true, recurMonth: 7, recurDay: 4 },
    { name: "Labor Day", date: new Date("2027-09-06"), jurisdiction: "all", isRecurring: true, recurRule: "first_monday_september" },
    { name: "Columbus Day", date: new Date("2027-10-11"), jurisdiction: "all", isRecurring: true, recurRule: "second_monday_october" },
    { name: "Election Day", date: new Date("2027-11-02"), jurisdiction: "ny_state", isRecurring: true, recurRule: "first_tuesday_after_first_monday_november" },
    { name: "Veterans Day", date: new Date("2027-11-11"), jurisdiction: "all", isRecurring: true, recurMonth: 11, recurDay: 11 },
    { name: "Thanksgiving", date: new Date("2027-11-25"), jurisdiction: "all", isRecurring: true, recurRule: "fourth_thursday_november" },
    { name: "Day After Thanksgiving", date: new Date("2027-11-26"), jurisdiction: "all", isRecurring: true, recurRule: "friday_after_fourth_thursday_november" },
    { name: "Christmas", date: new Date("2027-12-25"), jurisdiction: "all", isRecurring: true, recurMonth: 12, recurDay: 25 },
  ];

  const allHolidays = [...holidays2026, ...holidays2027];

  for (const h of allHolidays) {
    await (prisma as any).courtHoliday.upsert({
      where: {
        id: `${h.name.replace(/[^a-zA-Z]/g, "_").toLowerCase()}_${h.date.toISOString().split("T")[0]}_${h.jurisdiction}`,
      },
      update: h,
      create: {
        id: `${h.name.replace(/[^a-zA-Z]/g, "_").toLowerCase()}_${h.date.toISOString().split("T")[0]}_${h.jurisdiction}`,
        ...h,
      },
    });
  }

  console.log(`Seeded ${allHolidays.length} court holidays.`);

  // ─── Deadline Rules ───────────────────────────────────────────────────
  console.log("Seeding deadline rules...");

  const rules = [
    // NY Supreme -- Complaint Served
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Answer/Responsive Pleading Due", description: "Defendant must file answer or responsive pleading", ruleReference: "CPLR 3012(a)", category: "responsive_pleading", calendarDays: 20, mailAdditionalDays: 10, subServiceAdditionalDays: 11, nailMailAdditionalDays: 11, priority: "critical", sortOrder: 1 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Demand for Bill of Particulars", description: "Demand for verified bill of particulars", ruleReference: "CPLR 3041", category: "discovery", calendarDays: 30, mailAdditionalDays: 5, priority: "high", sortOrder: 2, dependsOnRule: "Answer/Responsive Pleading Due" },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Preliminary Conference Request", description: "Request for preliminary conference (RJI must be filed)", ruleReference: "22 NYCRR 202.12", category: "administrative", calendarDays: 45, priority: "normal", sortOrder: 3 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Discovery Demand Deadline", description: "Combined discovery demands", ruleReference: "CPLR 3120", category: "discovery", calendarDays: 120, priority: "high", sortOrder: 4 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Note of Issue Filing Deadline", description: "File note of issue to place case on trial calendar", ruleReference: "22 NYCRR 202.21", category: "trial_prep", calendarDays: 365, priority: "high", sortOrder: 5 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Expert Disclosure Deadline", description: "Expert disclosure per preliminary conference order", ruleReference: "22 NYCRR 202.17", category: "trial_prep", calendarDays: 305, priority: "high", sortOrder: 6 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Summary Judgment Motion Deadline", description: "Last day to file motion for summary judgment", ruleReference: "CPLR 3212(a)", category: "motion", calendarDays: 425, priority: "critical", sortOrder: 7, dependsOnRule: "Note of Issue Filing Deadline" },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Trial Ready", description: "Case must be trial ready per court scheduling order", ruleReference: "22 NYCRR 202.21", category: "trial_prep", calendarDays: 540, priority: "high", sortOrder: 8 },

    // NY Supreme -- Motion Filed
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Opposition Papers Due", description: "Opposition papers due 7 days before return date", ruleReference: "CPLR 2214(b)", category: "motion", calendarDays: -7, priority: "critical", sortOrder: 1 },
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Reply Papers Due", description: "Reply papers due on return date or per court rules", ruleReference: "CPLR 2214(b)", category: "motion", calendarDays: 0, priority: "high", sortOrder: 2 },
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Decision Expected", description: "Court must decide within 60 days of submission", ruleReference: "22 NYCRR 202.48", category: "administrative", calendarDays: 60, priority: "normal", sortOrder: 3 },

    // NY Supreme -- Note of Issue Filed
    { triggerEvent: "note_of_issue_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Summary Judgment Deadline", description: "Motion for summary judgment must be filed within 60 days", ruleReference: "CPLR 3212(a)", category: "motion", calendarDays: 60, priority: "critical", sortOrder: 1 },
    { triggerEvent: "note_of_issue_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Strike Note of Issue Motion", description: "Motion to vacate note of issue", ruleReference: "22 NYCRR 202.21(e)", category: "motion", calendarDays: 20, priority: "high", sortOrder: 2 },
    { triggerEvent: "note_of_issue_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Pre-Trial Conference", description: "Pre-trial conference per court scheduling", ruleReference: "22 NYCRR 202.26", category: "trial_prep", calendarDays: 90, priority: "normal", sortOrder: 3 },
    { triggerEvent: "note_of_issue_filed", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Trial Date", description: "Trial date per court scheduling", ruleReference: "22 NYCRR 202.21", category: "trial_prep", calendarDays: 180, priority: "critical", sortOrder: 4 },

    // NY Supreme -- Discovery Commenced
    { triggerEvent: "discovery_commenced", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Document Demand Response", description: "Response to document demands", ruleReference: "CPLR 3122", category: "discovery", calendarDays: 20, mailAdditionalDays: 5, priority: "high", sortOrder: 1 },
    { triggerEvent: "discovery_commenced", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Interrogatory Responses", description: "Answers to interrogatories due", ruleReference: "CPLR 3133", category: "discovery", calendarDays: 20, mailAdditionalDays: 5, priority: "high", sortOrder: 2 },
    { triggerEvent: "discovery_commenced", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Deposition Scheduling", description: "Depositions must be scheduled", ruleReference: "CPLR 3107", category: "discovery", calendarDays: 60, priority: "normal", sortOrder: 3 },
    { triggerEvent: "discovery_commenced", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Expert Disclosure Deadline", description: "Expert disclosure deadline per court order", ruleReference: "22 NYCRR 202.17", category: "discovery", calendarDays: 120, priority: "high", sortOrder: 4 },
    { triggerEvent: "discovery_commenced", practiceArea: "general", jurisdiction: "ny_supreme", deadlineName: "Discovery Cutoff", description: "All discovery must be completed", ruleReference: "22 NYCRR 202.12", category: "discovery", calendarDays: 180, priority: "critical", sortOrder: 5 },

    // Federal EDNY -- Complaint Served
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Answer Due", description: "Answer or responsive pleading due", ruleReference: "FRCP 12(a)(1)", category: "responsive_pleading", calendarDays: 21, mailAdditionalDays: 3, priority: "critical", sortOrder: 1 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Rule 26(f) Conference", description: "Parties must confer at least 21 days before scheduling conference", ruleReference: "FRCP 26(f)", category: "discovery", calendarDays: 60, priority: "high", sortOrder: 2 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Initial Disclosures", description: "Initial disclosures due 14 days after Rule 26(f) conference", ruleReference: "FRCP 26(a)(1)", category: "discovery", calendarDays: 74, priority: "high", sortOrder: 3, dependsOnRule: "Rule 26(f) Conference" },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Fact Discovery Cutoff", description: "Fact discovery closes per scheduling order", ruleReference: "FRCP 16(b)", category: "discovery", calendarDays: 270, priority: "high", sortOrder: 4 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Expert Reports Due", description: "Expert witness reports due per scheduling order", ruleReference: "FRCP 26(a)(2)", category: "discovery", calendarDays: 300, priority: "high", sortOrder: 5 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Rebuttal Expert Reports", description: "Rebuttal expert reports due 30 days after initial reports", ruleReference: "FRCP 26(a)(2)(D)", category: "discovery", calendarDays: 330, priority: "high", sortOrder: 6, dependsOnRule: "Expert Reports Due" },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Discovery Cutoff", description: "All discovery must be completed", ruleReference: "FRCP 16(b)", category: "discovery", calendarDays: 300, priority: "critical", sortOrder: 7 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Dispositive Motion Deadline", description: "Last day for dispositive motions", ruleReference: "Per scheduling order", category: "motion", calendarDays: 360, priority: "critical", sortOrder: 8 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Pre-Trial Order Due", description: "Joint pre-trial order due per court order", ruleReference: "FRCP 16(e)", category: "trial_prep", calendarDays: 390, priority: "high", sortOrder: 9 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Trial Date", description: "Trial date per scheduling order", ruleReference: "FRCP 16", category: "trial_prep", calendarDays: 450, priority: "critical", sortOrder: 11 },

    // Federal SDNY -- Complaint Served
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Answer Due", description: "Answer or responsive pleading due", ruleReference: "FRCP 12(a)(1)", category: "responsive_pleading", calendarDays: 21, mailAdditionalDays: 3, priority: "critical", sortOrder: 1 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Rule 26(f) Conference", description: "Parties must confer", ruleReference: "FRCP 26(f)", category: "discovery", calendarDays: 60, priority: "high", sortOrder: 2 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Initial Disclosures", description: "Initial disclosures due 14 days after 26(f) conference", ruleReference: "FRCP 26(a)(1)", category: "discovery", calendarDays: 74, priority: "high", sortOrder: 3, dependsOnRule: "Rule 26(f) Conference" },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Fact Discovery Cutoff", description: "Fact discovery closes", ruleReference: "FRCP 16(b)", category: "discovery", calendarDays: 270, priority: "high", sortOrder: 4 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Expert Reports Due", description: "Expert reports due", ruleReference: "FRCP 26(a)(2)", category: "discovery", calendarDays: 300, priority: "high", sortOrder: 5 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Rebuttal Expert Reports", description: "Rebuttal expert reports due", ruleReference: "FRCP 26(a)(2)(D)", category: "discovery", calendarDays: 330, priority: "high", sortOrder: 6 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Dispositive Motion Deadline", description: "Last day for dispositive motions", ruleReference: "Per scheduling order", category: "motion", calendarDays: 360, priority: "critical", sortOrder: 8 },
    { triggerEvent: "complaint_served", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Trial Date", description: "Trial date per scheduling order", ruleReference: "FRCP 16", category: "trial_prep", calendarDays: 450, priority: "critical", sortOrder: 10 },

    // Federal EDNY -- Motion Filed
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Opposition Due", description: "Opposition papers due", ruleReference: "Local Rule 6.1", category: "motion", calendarDays: 14, mailAdditionalDays: 3, priority: "critical", sortOrder: 1 },
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Reply Due", description: "Reply papers due 7 days after opposition", ruleReference: "Local Rule 6.1", category: "motion", calendarDays: 21, priority: "high", sortOrder: 2, dependsOnRule: "Opposition Due" },
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_federal_edny", deadlineName: "Decision Expected", description: "No fixed deadline for federal decisions", ruleReference: "Per court practice", category: "administrative", calendarDays: 90, priority: "low", sortOrder: 3 },

    // Federal SDNY -- Motion Filed
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Opposition Due", description: "Opposition papers due", ruleReference: "Local Rule 6.1", category: "motion", calendarDays: 14, mailAdditionalDays: 3, priority: "critical", sortOrder: 1 },
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Reply Due", description: "Reply papers due", ruleReference: "Local Rule 6.1", category: "motion", calendarDays: 21, priority: "high", sortOrder: 2, dependsOnRule: "Opposition Due" },
    { triggerEvent: "motion_filed", practiceArea: "general", jurisdiction: "ny_federal_sdny", deadlineName: "Decision Expected", description: "No fixed deadline for federal decisions", ruleReference: "Per court practice", category: "administrative", calendarDays: 90, priority: "low", sortOrder: 3 },

    // NY PI additions
    { triggerEvent: "complaint_served", practiceArea: "personal_injury", jurisdiction: "ny_supreme", deadlineName: "90-Day Demand for Complaint", description: "If defendant: demand plaintiff serve complaint within 90 days", ruleReference: "CPLR 3012(b)", category: "responsive_pleading", calendarDays: 90, priority: "high", sortOrder: 10 },
    { triggerEvent: "complaint_served", practiceArea: "personal_injury", jurisdiction: "ny_supreme", deadlineName: "IME Scheduling", description: "Independent medical examination scheduling after bill of particulars served", ruleReference: "CPLR 3121", category: "discovery", calendarDays: 60, priority: "normal", sortOrder: 11 },
    { triggerEvent: "complaint_served", practiceArea: "personal_injury", jurisdiction: "ny_supreme", deadlineName: "No-Fault / Insurance Disclosure", description: "No-fault and insurance disclosure per case requirements", ruleReference: "CPLR 3101", category: "discovery", calendarDays: 45, priority: "normal", sortOrder: 12 },
    { triggerEvent: "complaint_served", practiceArea: "personal_injury", jurisdiction: "ny_supreme", deadlineName: "Mediation Deadline", description: "Mediation deadline per court part rules", ruleReference: "22 NYCRR 202.12", category: "administrative", calendarDays: 270, priority: "normal", sortOrder: 13 },

    // NY Family Court
    { triggerEvent: "petition_filed", practiceArea: "family_law", jurisdiction: "ny_family", deadlineName: "Return Date", description: "Court appearance on return date", ruleReference: "FCA", category: "administrative", calendarDays: 21, priority: "critical", sortOrder: 1 },
    { triggerEvent: "petition_filed", practiceArea: "family_law", jurisdiction: "ny_family", deadlineName: "Answer Due", description: "Answer to petition due on or before return date", ruleReference: "FCA", category: "responsive_pleading", calendarDays: 20, mailAdditionalDays: 5, priority: "critical", sortOrder: 2 },
    { triggerEvent: "petition_filed", practiceArea: "family_law", jurisdiction: "ny_family", deadlineName: "Discovery (Limited)", description: "Limited discovery per court order", ruleReference: "FCA 165", category: "discovery", calendarDays: 45, priority: "normal", sortOrder: 3 },
    { triggerEvent: "petition_filed", practiceArea: "family_law", jurisdiction: "ny_family", deadlineName: "Hearing / Trial Date", description: "Hearing or trial date per court scheduling", ruleReference: "FCA", category: "trial_prep", calendarDays: 90, priority: "high", sortOrder: 4 },
    { triggerEvent: "petition_filed", practiceArea: "family_law", jurisdiction: "ny_family", deadlineName: "Order to Show Cause", description: "Order to show cause as scheduled by court", ruleReference: "FCA", category: "motion", calendarDays: 14, priority: "critical", sortOrder: 5 },

    // NY Surrogate
    { triggerEvent: "probate_filed", practiceArea: "estate_planning", jurisdiction: "ny_surrogate", deadlineName: "Citation Return Date", description: "Return date on citation", ruleReference: "SCPA", category: "administrative", calendarDays: 28, priority: "critical", sortOrder: 1 },
    { triggerEvent: "probate_filed", practiceArea: "estate_planning", jurisdiction: "ny_surrogate", deadlineName: "Objections Due", description: "Deadline for filing objections to probate", ruleReference: "SCPA", category: "responsive_pleading", calendarDays: 28, priority: "critical", sortOrder: 2 },
    { triggerEvent: "probate_filed", practiceArea: "estate_planning", jurisdiction: "ny_surrogate", deadlineName: "SCPA 1404 Examination", description: "Notice for examination of attesting witnesses", ruleReference: "SCPA 1404", category: "discovery", calendarDays: 10, priority: "high", sortOrder: 3 },
    { triggerEvent: "probate_filed", practiceArea: "estate_planning", jurisdiction: "ny_surrogate", deadlineName: "Accounting Deadline", description: "Accounting deadline per court order", ruleReference: "SCPA 2208", category: "filing", calendarDays: 180, priority: "high", sortOrder: 4 },
  ];

  for (const rule of rules) {
    const ruleId = `${rule.triggerEvent}_${rule.jurisdiction}_${rule.deadlineName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`.substring(0, 50);
    await (prisma as any).deadlineRule.upsert({
      where: { id: ruleId },
      update: {
        ...rule,
        firmId: null,
        isActive: true,
        mailAdditionalDays: rule.mailAdditionalDays ?? 0,
        subServiceAdditionalDays: (rule as any).subServiceAdditionalDays ?? 0,
        nailMailAdditionalDays: (rule as any).nailMailAdditionalDays ?? 0,
      },
      create: {
        id: ruleId,
        ...rule,
        firmId: null,
        isActive: true,
        mailAdditionalDays: rule.mailAdditionalDays ?? 0,
        subServiceAdditionalDays: (rule as any).subServiceAdditionalDays ?? 0,
        nailMailAdditionalDays: (rule as any).nailMailAdditionalDays ?? 0,
      },
    });
  }

  console.log(`Seeded ${rules.length} deadline rules.`);

  // ─── Demo Deadline Chain ──────────────────────────────────────────────
  console.log("Creating demo deadline chain...");

  const demoChainId = "demo-complaint-served-pi";
  await (prisma as any).deadlineChain.upsert({
    where: { id: demoChainId },
    update: {},
    create: {
      id: demoChainId,
      name: "Smith v. Jones — Post-Service Deadlines",
      triggerEvent: "complaint_served",
      triggerDate: new Date("2026-03-01"),
      triggerDescription: "Complaint served on defendant via personal service",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      serviceMethod: "personal",
      status: "active",
      userId: "default",
      firmId: "default",
    },
  });

  // Calculate deadlines for demo chain
  const demoDeadlines = [
    { name: "Answer/Responsive Pleading Due", description: "Defendant must file answer or responsive pleading", ruleReference: "CPLR 3012(a)", category: "responsive_pleading", baseCalcDays: 20, adjustmentDays: 0, totalDays: 20, deadlineDate: new Date("2026-03-23"), originalDate: new Date("2026-03-21"), adjustedForWeekend: true, priority: "critical", sortOrder: 1 },
    { name: "Demand for Bill of Particulars", description: "Demand for verified bill of particulars", ruleReference: "CPLR 3041", category: "discovery", baseCalcDays: 30, adjustmentDays: 0, totalDays: 30, deadlineDate: new Date("2026-03-31"), originalDate: new Date("2026-03-31"), adjustedForWeekend: false, priority: "high", sortOrder: 2 },
    { name: "No-Fault / Insurance Disclosure", description: "No-fault and insurance disclosure", ruleReference: "CPLR 3101", category: "discovery", baseCalcDays: 45, adjustmentDays: 0, totalDays: 45, deadlineDate: new Date("2026-04-15"), originalDate: new Date("2026-04-15"), adjustedForWeekend: false, priority: "normal", sortOrder: 3 },
    { name: "Preliminary Conference Request", description: "Request for preliminary conference", ruleReference: "22 NYCRR 202.12", category: "administrative", baseCalcDays: 45, adjustmentDays: 0, totalDays: 45, deadlineDate: new Date("2026-04-15"), originalDate: new Date("2026-04-15"), adjustedForWeekend: false, priority: "normal", sortOrder: 4 },
    { name: "IME Scheduling", description: "Independent medical examination scheduling", ruleReference: "CPLR 3121", category: "discovery", baseCalcDays: 60, adjustmentDays: 0, totalDays: 60, deadlineDate: new Date("2026-04-30"), originalDate: new Date("2026-04-30"), adjustedForWeekend: false, priority: "normal", sortOrder: 5 },
    { name: "90-Day Demand for Complaint", description: "Demand plaintiff serve complaint within 90 days", ruleReference: "CPLR 3012(b)", category: "responsive_pleading", baseCalcDays: 90, adjustmentDays: 0, totalDays: 90, deadlineDate: new Date("2026-05-29"), originalDate: new Date("2026-05-29"), adjustedForWeekend: false, priority: "high", sortOrder: 6 },
    { name: "Discovery Demand Deadline", description: "Combined discovery demands", ruleReference: "CPLR 3120", category: "discovery", baseCalcDays: 120, adjustmentDays: 0, totalDays: 120, deadlineDate: new Date("2026-06-29"), originalDate: new Date("2026-06-29"), adjustedForWeekend: false, priority: "high", sortOrder: 7 },
    { name: "Mediation Deadline", description: "Mediation deadline per court part rules", ruleReference: "22 NYCRR 202.12", category: "administrative", baseCalcDays: 270, adjustmentDays: 0, totalDays: 270, deadlineDate: new Date("2026-11-26"), originalDate: new Date("2026-11-25"), adjustedForHoliday: true, holidayName: "Thanksgiving", priority: "normal", sortOrder: 8 },
    { name: "Expert Disclosure Deadline", description: "Expert disclosure per preliminary conference order", ruleReference: "22 NYCRR 202.17", category: "trial_prep", baseCalcDays: 305, adjustmentDays: 0, totalDays: 305, deadlineDate: new Date("2026-12-31"), originalDate: new Date("2026-12-31"), adjustedForWeekend: false, priority: "high", sortOrder: 9 },
    { name: "Note of Issue Filing Deadline", description: "File note of issue to place case on trial calendar", ruleReference: "22 NYCRR 202.21", category: "trial_prep", baseCalcDays: 365, adjustmentDays: 0, totalDays: 365, deadlineDate: new Date("2027-03-01"), originalDate: new Date("2027-03-01"), adjustedForWeekend: false, priority: "high", sortOrder: 10 },
  ];

  // Clear existing demo deadlines
  await (prisma as any).calculatedDeadline.deleteMany({
    where: { chainId: demoChainId },
  });

  for (const dl of demoDeadlines) {
    await (prisma as any).calculatedDeadline.create({
      data: {
        chainId: demoChainId,
        ...dl,
        adjustedForWeekend: dl.adjustedForWeekend ?? false,
        adjustedForHoliday: (dl as any).adjustedForHoliday ?? false,
        holidayName: (dl as any).holidayName ?? null,
        isBusinessDays: false,
        status: dl.deadlineDate < new Date() ? "completed" : "pending",
        completedAt: dl.deadlineDate < new Date() ? dl.deadlineDate : null,
        reminderDays: dl.priority === "critical" ? [30, 14, 7, 3, 1] : [14, 7, 3, 1],
        userId: "default",
        firmId: "default",
      },
    });
  }

  console.log(`Created demo chain with ${demoDeadlines.length} deadlines.`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
