import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding status update triggers...");

  const triggers = [
    // Auto-publish (safe, routine)
    { id: "trigger-checklist-complete", name: "Checklist Complete — Celebration", triggerSource: "checklist_milestone", triggerCondition: { type: "checklist_complete" }, autoPublish: true, approvalRequired: false, cooldownHours: 168, priority: 3, isDefault: true },
    { id: "trigger-invoice-paid", name: "Invoice Payment Received", triggerSource: "billing_event", triggerCondition: { type: "invoice_paid" }, autoPublish: true, approvalRequired: false, cooldownHours: 1, priority: 3, isDefault: true },
    { id: "trigger-checklist-50", name: "Checklist 50% Milestone", triggerSource: "checklist_milestone", triggerCondition: { type: "checklist_milestone", percentage: 50 }, autoPublish: true, approvalRequired: false, cooldownHours: 168, priority: 2, isDefault: true },

    // Approval required
    { id: "trigger-phase-change", name: "Phase Change — Any", triggerSource: "phase_change", triggerCondition: { type: "phase_entered", phase: "any" }, autoPublish: false, approvalRequired: true, cooldownHours: 48, priority: 8, isDefault: true },
    { id: "trigger-court-event", name: "Court Event Completed", triggerSource: "court_event_completed", triggerCondition: { type: "court_event_completed" }, autoPublish: false, approvalRequired: true, cooldownHours: 4, priority: 9, isDefault: true },
    { id: "trigger-demand-letter", name: "Demand Letter Sent", triggerSource: "correspondence_sent", triggerCondition: { type: "correspondence_sent", correspondenceType: "demand_letter" }, autoPublish: false, approvalRequired: true, cooldownHours: 24, priority: 7, isDefault: true },
    { id: "trigger-settlement", name: "Settlement Offer Sent/Received", triggerSource: "settlement_event", triggerCondition: { type: "settlement_event" }, autoPublish: false, approvalRequired: true, cooldownHours: 24, priority: 9, isDefault: true },
    { id: "trigger-deposition", name: "Deposition Completed", triggerSource: "court_event_completed", triggerCondition: { type: "court_event_completed", eventType: "deposition" }, autoPublish: false, approvalRequired: true, cooldownHours: 4, priority: 7, isDefault: true },
    { id: "trigger-inactivity-30", name: "30-Day Inactivity Check-In", triggerSource: "inactivity", triggerCondition: { type: "days_since_update", threshold: 30 }, autoPublish: false, approvalRequired: true, cooldownHours: 168, priority: 5, isDefault: true },
    { id: "trigger-deadline-complete", name: "Key Deadline Completed", triggerSource: "deadline_completed", triggerCondition: { type: "deadline_completed", category: "responsive_pleading" }, autoPublish: false, approvalRequired: true, cooldownHours: 24, priority: 7, isDefault: true },
    { id: "trigger-welcome", name: "New Matter Welcome", triggerSource: "intake_converted", triggerCondition: { type: "intake_converted" }, autoPublish: false, approvalRequired: true, cooldownHours: 1, priority: 10, isDefault: true },

    // Practice-area specific
    { id: "trigger-pi-ime", name: "PI — IME Scheduled", practiceArea: "personal_injury", triggerSource: "calendar_event", triggerCondition: { type: "event_created", eventType: "ime" }, autoPublish: false, approvalRequired: true, cooldownHours: 24, priority: 8, isDefault: true },
    { id: "trigger-imm-rfe", name: "Immigration — RFE Received", practiceArea: "immigration", triggerSource: "document_received", triggerCondition: { type: "document_received", documentType: "rfe" }, autoPublish: false, approvalRequired: true, cooldownHours: 1, priority: 10, isDefault: true },
    { id: "trigger-imm-approved", name: "Immigration — Application Approved", practiceArea: "immigration", triggerSource: "milestone", triggerCondition: { type: "milestone_reached", milestone: "application_approved" }, autoPublish: false, approvalRequired: true, cooldownHours: 1, priority: 10, isDefault: true },
    { id: "trigger-fl-mediation", name: "Family Law — Mediation Scheduled", practiceArea: "family_law", triggerSource: "calendar_event", triggerCondition: { type: "event_created", eventType: "mediation" }, autoPublish: false, approvalRequired: true, cooldownHours: 24, priority: 8, isDefault: true },
    { id: "trigger-re-closing", name: "Real Estate — Closing Date Set", practiceArea: "real_estate", triggerSource: "milestone", triggerCondition: { type: "milestone_reached", milestone: "closing_date_set" }, autoPublish: false, approvalRequired: true, cooldownHours: 1, priority: 9, isDefault: true },
  ];

  for (const t of triggers) {
    await prisma.statusUpdateTrigger.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: null },
      update: { name: t.name, triggerCondition: t.triggerCondition },
    });
  }

  console.log(`Seeded ${triggers.length} triggers.`);

  // Templates
  console.log("Seeding templates...");
  const templates = [
    {
      id: "tmpl-discovery-pi",
      name: "Phase Change — PI — Discovery Started",
      triggerSource: "phase_change",
      practiceArea: "personal_injury",
      tone: "supportive",
      titleTemplate: "Your Case Has Entered the Information Exchange Phase",
      bodyTemplate: `Hello {{clientFirstName}},\n\nYour case has moved into an important phase called information exchange. Here's what that means:\n\n**What's happening:** Both sides are now required to share evidence and information. We've sent formal requests to the other side's attorney.\n\n**What to expect:** This phase typically takes several months. You may be asked to attend a recorded testimony session. Your attorney will prepare you.\n\n**What you can do:** Continue your medical treatment and keep all appointments. Upload any new documents to your portal.\n\nAs always, reach out if you have questions. We're here for you.`,
      milestoneTag: "discovery_started",
      includeNextSteps: true,
    },
    {
      id: "tmpl-court-general",
      name: "Court Event Completed — General",
      triggerSource: "court_event_completed",
      tone: "professional",
      titleTemplate: "Court Update",
      bodyTemplate: `Hello {{clientFirstName}},\n\nYour attorney appeared in court today. Here's a brief update on what happened and what comes next.\n\nPlease don't hesitate to reach out with any questions.`,
      includeNextSteps: true,
    },
    {
      id: "tmpl-checkin",
      name: "Inactivity Check-In — General",
      triggerSource: "inactivity",
      tone: "reassuring",
      titleTemplate: "Checking In On Your Case",
      bodyTemplate: `Hello {{clientFirstName}},\n\nWe wanted to touch base. Even when there isn't a major milestone to report, your legal team is actively working on your behalf.\n\nIf you have any questions, we're always just a message away through your portal.`,
      includeNextSteps: true,
    },
    {
      id: "tmpl-welcome",
      name: "Welcome — New Client",
      triggerSource: "intake_converted",
      tone: "warm",
      titleTemplate: "Welcome to Your Secure Client Portal",
      bodyTemplate: `Hello {{clientFirstName}},\n\nWelcome! This is your secure client portal where you can:\n• Check your case status anytime\n• Send and receive secure messages\n• Upload and view documents\n• Complete your document checklist\n\nYour first step: Please review the document checklist we've prepared.\n\nWe're here for you every step of the way.`,
      includeNextSteps: true,
      clientActionText: "Please review and start completing your document checklist.",
    },
    {
      id: "tmpl-payment-thanks",
      name: "Payment Received — Thank You",
      triggerSource: "billing_event",
      tone: "professional",
      titleTemplate: "Payment Received — Thank You",
      bodyTemplate: `Hello {{clientFirstName}},\n\nWe've received your payment. Thank you for your prompt attention.\n\nIf you have any questions about your account, please reach out.`,
    },
  ];

  for (const t of templates) {
    await prisma.statusUpdateTemplate.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: null },
      update: { name: t.name, bodyTemplate: t.bodyTemplate },
    });
  }

  console.log(`Seeded ${templates.length} templates.`);

  // Demo queue items
  console.log("Seeding demo queue items...");
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (firstMatter) {
    const queueItems = [
      {
        id: "queue-demo-1",
        triggerSource: "phase_change",
        title: "Your Case Has Entered the Information Exchange Phase",
        body: "Hello,\n\nYour case has moved into an important phase called information exchange (formally known as \"discovery\"). Both sides are now required to share evidence. We've sent formal requests to the other side's attorney for documents and answers.\n\nThis phase typically takes several months. Continue your medical treatment and keep all appointments.\n\nWe're here for you.",
        milestone: "discovery_started",
        phase: "Information Exchange",
        phasePercentage: 25,
        practiceArea: firstMatter.practiceArea,
        priority: 8,
        status: "pending_approval",
      },
      {
        id: "queue-demo-2",
        triggerSource: "calendar_event",
        title: "Mediation Session Scheduled",
        body: "Hello,\n\nA mediation session has been scheduled. This is a chance for both sides to work toward an agreement with a neutral mediator. Your attorney will prepare you beforehand so you'll know exactly what to expect.\n\nPlease make sure to keep this date clear in your schedule.",
        practiceArea: "family_law",
        priority: 8,
        status: "pending_approval",
      },
      {
        id: "queue-demo-3",
        triggerSource: "checklist_milestone",
        title: "Great Progress on Your Document Checklist!",
        body: "Hello,\n\nYou've completed half of the items on your document checklist. Great work! Having these documents helps us build the strongest possible case.\n\nKeep up the momentum — check your portal to see which items are still needed.",
        practiceArea: firstMatter.practiceArea,
        priority: 2,
        status: "auto_published",
        deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        id: "queue-demo-4",
        triggerSource: "billing_event",
        title: "Payment Received — Thank You",
        body: "Hello,\n\nWe've received your payment. Thank you for your prompt attention. If you have any questions, please reach out.",
        priority: 3,
        status: "auto_published",
        deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const item of queueItems) {
      await prisma.statusUpdateQueue.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          matterId: firstMatter.id,
          ...item,
          tone: "professional",
          autoPublish: item.status === "auto_published",
          approvalRequired: item.status === "pending_approval",
          deliveryChannels: ["portal", "email"],
          userId: USER_ID,
          firmId: FIRM_ID,
        },
        update: { title: item.title, status: item.status },
      });
    }

    console.log(`Seeded ${queueItems.length} queue items.`);

    // Create a schedule for the demo matter
    await prisma.statusUpdateSchedule.upsert({
      where: { id: "schedule-demo-1" },
      create: {
        id: "schedule-demo-1",
        matterId: firstMatter.id,
        frequencyDays: 30,
        nextRunAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userId: USER_ID,
        firmId: FIRM_ID,
      },
      update: {},
    });

    console.log("Seeded demo schedule.");
  }

  console.log("Status updates seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
