import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding timeline templates...");

  const piTemplate = {
    id: "tmpl-pi-timeline",
    name: "Personal Injury — Full Case Timeline",
    practiceArea: "personal_injury",
    isDefault: true,
    milestones: [
      { id: "pi-1", title: "Case Opened", clientDescription: "Your attorney has taken on your case and is reviewing the details.", phase: "pre_litigation", iconType: "star", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 0 },
      { id: "pi-2", title: "Investigation Completed", clientDescription: "We've gathered the initial evidence and reviewed your situation.", phase: "pre_litigation", iconType: "shield", importance: "normal", category: "legal_proceeding", typicalDaysFromStart: 14 },
      { id: "pi-3", title: "Demand Letter Sent", clientDescription: "We've sent a formal demand to the insurance company requesting fair compensation.", phase: "pre_litigation", iconType: "mail", importance: "major", category: "communication", typicalDaysFromStart: 30 },
      { id: "pi-4", title: "Lawsuit Filed", clientDescription: "We've officially filed your lawsuit with the court.", phase: "pleadings", iconType: "gavel", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 60 },
      { id: "pi-5", title: "Other Side Responds", clientDescription: "The other side has filed their response to your lawsuit.", phase: "pleadings", iconType: "file", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 90 },
      { id: "pi-6", title: "Information Exchange Begins", clientDescription: "Both sides are now sharing evidence and information.", phase: "discovery", iconType: "file", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 100 },
      { id: "pi-7", title: "Depositions Taken", clientDescription: "Recorded testimony sessions have been conducted.", phase: "discovery", iconType: "user", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 180 },
      { id: "pi-8", title: "Independent Medical Exam", clientDescription: "A medical examination requested by the other side has been completed.", phase: "discovery", iconType: "user", importance: "normal", category: "legal_proceeding", typicalDaysFromStart: 200, requiresClientAction: true, clientActionText: "Attend the scheduled examination" },
      { id: "pi-9", title: "Discovery Complete", clientDescription: "The information exchange phase has concluded.", phase: "discovery", iconType: "check", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 270 },
      { id: "pi-10", title: "Settlement Negotiations", clientDescription: "We're actively negotiating with the other side to reach a fair resolution.", phase: "settlement", iconType: "dollar", importance: "major", category: "communication", typicalDaysFromStart: 300 },
      { id: "pi-11", title: "Mediation", clientDescription: "A neutral mediator is helping both sides work toward an agreement.", phase: "settlement", iconType: "user", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 330 },
      { id: "pi-12", title: "Case Resolved", clientDescription: "Your case has been resolved. Your attorney will discuss the details with you.", phase: "settlement", iconType: "star", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 365 },
    ],
  };

  await prisma.timelineTemplate.upsert({
    where: { id: piTemplate.id },
    create: { ...piTemplate, isActive: true, firmId: null },
    update: { milestones: piTemplate.milestones },
  });

  const flTemplate = {
    id: "tmpl-fl-timeline",
    name: "Family Law — Divorce Timeline",
    practiceArea: "family_law",
    isDefault: true,
    milestones: [
      { id: "fl-1", title: "Initial Consultation", clientDescription: "Your attorney has reviewed your situation and discussed your options.", phase: "pre_litigation", iconType: "user", importance: "major", category: "communication", typicalDaysFromStart: 0 },
      { id: "fl-2", title: "Papers Filed", clientDescription: "The necessary paperwork has been filed with the court.", phase: "pleadings", iconType: "gavel", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 14 },
      { id: "fl-3", title: "Other Side Served", clientDescription: "Your spouse has been officially notified of the filing.", phase: "pleadings", iconType: "mail", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 21 },
      { id: "fl-4", title: "Financial Disclosure", clientDescription: "Both sides are sharing financial information for a fair outcome.", phase: "discovery", iconType: "file", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 45, requiresClientAction: true, clientActionText: "Gather and submit financial documents" },
      { id: "fl-5", title: "Mediation Scheduled", clientDescription: "A mediation session is scheduled to try to reach an agreement.", phase: "settlement", iconType: "user", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 90 },
      { id: "fl-6", title: "Agreement Reached", clientDescription: "An agreement has been reached. Your attorney will explain the terms.", phase: "settlement", iconType: "check", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 120 },
      { id: "fl-7", title: "Final Judgment", clientDescription: "The court has issued the final judgment. This chapter is closing.", phase: "closed", iconType: "star", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 150 },
    ],
  };

  await prisma.timelineTemplate.upsert({
    where: { id: flTemplate.id },
    create: { ...flTemplate, isActive: true, firmId: null },
    update: { milestones: flTemplate.milestones },
  });

  const immTemplate = {
    id: "tmpl-imm-timeline",
    name: "Immigration — Application Timeline",
    practiceArea: "immigration",
    isDefault: true,
    milestones: [
      { id: "imm-1", title: "Consultation & Strategy", clientDescription: "Your attorney has reviewed your case and developed a strategy.", phase: "pre_litigation", iconType: "user", importance: "major", category: "communication", typicalDaysFromStart: 0 },
      { id: "imm-2", title: "Documents Gathered", clientDescription: "All necessary documents have been collected and prepared.", phase: "pre_litigation", iconType: "file", importance: "normal", category: "document", typicalDaysFromStart: 21, requiresClientAction: true, clientActionText: "Submit all required documents" },
      { id: "imm-3", title: "Application Filed", clientDescription: "Your application has been submitted to USCIS.", phase: "pleadings", iconType: "mail", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 30 },
      { id: "imm-4", title: "Receipt Notice", clientDescription: "USCIS has acknowledged receipt of your application.", phase: "pleadings", iconType: "check", importance: "normal", category: "legal_proceeding", typicalDaysFromStart: 45 },
      { id: "imm-5", title: "Biometrics Appointment", clientDescription: "Fingerprints and photos taken at the USCIS office.", phase: "discovery", iconType: "user", importance: "normal", category: "legal_proceeding", typicalDaysFromStart: 60, requiresClientAction: true, clientActionText: "Attend biometrics appointment" },
      { id: "imm-6", title: "Interview Scheduled", clientDescription: "Your interview with USCIS has been scheduled.", phase: "discovery", iconType: "calendar", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 180 },
      { id: "imm-7", title: "Interview Completed", clientDescription: "Your interview has been completed. We're awaiting a decision.", phase: "discovery", iconType: "check", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 195 },
      { id: "imm-8", title: "Decision", clientDescription: "A decision has been made on your application.", phase: "closed", iconType: "star", importance: "major", category: "legal_proceeding", typicalDaysFromStart: 210 },
    ],
  };

  await prisma.timelineTemplate.upsert({
    where: { id: immTemplate.id },
    create: { ...immTemplate, isActive: true, firmId: null },
    update: { milestones: immTemplate.milestones },
  });

  console.log("Seeded 3 timeline templates (PI, Family Law, Immigration).");

  // Seed demo timeline events
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (firstMatter) {
    console.log("Seeding demo timeline events...");
    const now = new Date();

    const events = [
      { eventType: "milestone", category: "legal_proceeding", timelineStatus: "completed", title: "Case Opened", clientDescription: "Your attorney took on your case and began reviewing the details of your situation.", date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), iconType: "star", importance: "major", phaseTag: "pre_litigation" },
      { eventType: "milestone", category: "communication", timelineStatus: "completed", title: "Demand Letter Sent", clientDescription: "We sent a formal demand to the insurance company outlining your injuries and requesting fair compensation.", date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), iconType: "mail", importance: "major", phaseTag: "pre_litigation" },
      { eventType: "phase_change", category: "legal_proceeding", timelineStatus: "completed", title: "Lawsuit Filed", clientDescription: "We officially filed your lawsuit with the court. The case has been assigned to a judge.", date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), iconType: "gavel", importance: "major", phaseTag: "pleadings" },
      { eventType: "document_shared", category: "document", timelineStatus: "completed", title: "Complaint Filed with Court", clientDescription: "The formal complaint document has been filed and is available in your documents.", date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), iconType: "file", importance: "normal", phaseTag: "pleadings" },
      { eventType: "milestone", category: "legal_proceeding", timelineStatus: "completed", title: "Other Side Responded", clientDescription: "The other side's attorney filed their response to your lawsuit. Your attorney is reviewing it.", date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), iconType: "file", importance: "major", phaseTag: "pleadings" },
      { eventType: "phase_change", category: "legal_proceeding", timelineStatus: "current", title: "Information Exchange Phase", clientDescription: "Both sides are now sharing evidence. We've sent formal requests for documents and information.", date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), iconType: "flag", importance: "major", phaseTag: "discovery" },
      { eventType: "court_event", category: "legal_proceeding", timelineStatus: "completed", title: "Preliminary Conference", clientDescription: "Your attorney appeared in court for a scheduling conference. The judge set deadlines for the next steps.", date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), iconType: "gavel", importance: "normal", phaseTag: "discovery" },
      { eventType: "client_action", category: "client_task", timelineStatus: "completed", title: "Document Checklist Completed", clientDescription: "Thank you for providing all the requested documents! This helps us build a strong case.", date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), iconType: "check", importance: "normal", phaseTag: "discovery" },
      { eventType: "payment", category: "financial", timelineStatus: "completed", title: "Payment Received", clientDescription: "Your payment of $1,000 has been received. Thank you.", date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), iconType: "dollar", importance: "minor", phaseTag: "discovery" },
      // Upcoming/anticipated
      { eventType: "anticipated_event", category: "legal_proceeding", timelineStatus: "upcoming", title: "Depositions", clientDescription: "Recorded testimony sessions will be scheduled. Your attorney will prepare you beforehand.", date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), isEstimatedDate: true, dateLabel: "Expected: May 2026", iconType: "user", importance: "major", phaseTag: "discovery" },
      { eventType: "future_milestone", category: "legal_proceeding", timelineStatus: "anticipated", title: "Discovery Complete", clientDescription: "The information exchange phase will conclude, and we'll move toward resolution.", date: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), isEstimatedDate: true, dateLabel: "Expected: July 2026", iconType: "check", importance: "major", phaseTag: "discovery" },
      { eventType: "future_milestone", category: "communication", timelineStatus: "anticipated", title: "Settlement Negotiations", clientDescription: "We'll negotiate with the other side to try to reach a fair resolution.", date: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000), isEstimatedDate: true, dateLabel: "Expected: August 2026", iconType: "dollar", importance: "major", phaseTag: "settlement" },
    ];

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      await prisma.clientTimelineEvent.create({
        data: {
          matterId: firstMatter.id,
          ...e,
          isEstimatedDate: e.isEstimatedDate || false,
          isVisibleToClient: true,
          requiresClientAction: false,
          clientActionCompleted: false,
          sourceType: "manual",
          sortOrder: i,
          userId: USER_ID,
          firmId: FIRM_ID,
        },
      });
    }

    // Create timeline config
    await prisma.timelineConfig.upsert({
      where: { matterId: firstMatter.id },
      create: {
        matterId: firstMatter.id,
        templateId: "tmpl-pi-timeline",
        showEstimatedDates: true,
        showPhaseGroups: true,
        showDocuments: true,
        showPayments: true,
        showClientActions: true,
        customWelcomeNote: "This timeline shows the key events in your case and what to expect next. We update it as your case progresses.",
        userId: USER_ID,
        firmId: FIRM_ID,
      },
      update: {},
    });

    console.log(`Seeded ${events.length} timeline events and config.`);
  }

  console.log("Timeline seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
