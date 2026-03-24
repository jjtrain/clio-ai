import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding pulse templates...");

  const templates = [
    {
      id: "pulse-tmpl-first-month",
      name: "First Month Check-In",
      triggerMilestone: "first_month",
      question: "Hi {{firstName}}, how would you rate your experience with us so far?",
      questionType: "emoji_5",
      followUpQuestion: "What could we do better? (optional)",
      emailSubject: "How are we doing, {{firstName}}?",
      deliveryDelay: 0,
      reminderAfterHours: 48,
      maxReminders: 1,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-discovery",
      name: "Discovery Phase Satisfaction",
      triggerMilestone: "discovery_started",
      practiceArea: "personal_injury",
      question: "How satisfied are you with how your case is progressing through the information exchange phase?",
      questionType: "scale_1_5",
      followUpQuestion: "Is there anything we could explain better about this phase of your case?",
      emailSubject: "How are we doing on your case, {{firstName}}?",
      deliveryDelay: 24,
      reminderAfterHours: 72,
      maxReminders: 1,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-case-closed",
      name: "Case Closed — NPS",
      triggerMilestone: "case_closed",
      question: "On a scale of 0-10, how likely are you to recommend our firm to a friend or family member?",
      questionType: "nps_0_10",
      followUpQuestion: "What was the best part of working with us? What could we improve?",
      emailSubject: "Thank you — we'd love your feedback",
      deliveryDelay: 48,
      reminderAfterHours: 120,
      maxReminders: 2,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-court-event",
      name: "Post Court Event",
      triggerMilestone: "post_event",
      question: "How well did we prepare you for today's court appearance?",
      questionType: "thumbs",
      followUpQuestion: "Anything else you'd like us to know?",
      emailSubject: "Quick check-in after today",
      deliveryDelay: 4,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-quarterly",
      name: "Quarterly Check-In",
      triggerMilestone: "quarterly_checkin",
      question: "How satisfied are you with the communication and updates you're receiving about your case?",
      questionType: "scale_1_5",
      followUpQuestion: "How can we improve your experience?",
      emailSubject: "A quick check-in — we value your feedback",
      deliveryDelay: 0,
      reminderAfterHours: 96,
      maxReminders: 1,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-family-sensitive",
      name: "Family Law — Sensitivity Check",
      triggerMilestone: "first_month",
      practiceArea: "family_law",
      question: "We know this is a difficult time. How supported do you feel by our team?",
      questionType: "emoji_5",
      followUpQuestion: "Is there anything we can do to make this process easier for you?",
      emailSubject: "A quick check-in — we'd love your feedback",
      deliveryDelay: 0,
      reminderAfterHours: 72,
      maxReminders: 1,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-immigration",
      name: "Immigration — Application Filed",
      triggerMilestone: "case_opened",
      practiceArea: "immigration",
      question: "How satisfied are you with the application preparation process?",
      questionType: "scale_1_5",
      followUpQuestion: "What could we improve about the filing process?",
      emailSubject: "How is your experience with our immigration team?",
      deliveryDelay: 48,
      isDefault: true,
    },
    {
      id: "pulse-tmpl-corporate",
      name: "Corporate — Mid-Engagement Pulse",
      triggerMilestone: "quarterly_checkin",
      practiceArea: "corporate",
      question: "How would you rate the quality and responsiveness of our legal team?",
      questionType: "scale_1_5",
      followUpQuestion: "Any areas where we could better serve your business needs?",
      emailSubject: "Quick pulse check on your engagement",
      deliveryDelay: 0,
      isDefault: true,
    },
  ];

  for (const t of templates) {
    await prisma.pulseTemplate.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: null },
      update: { name: t.name, question: t.question },
    });
  }

  console.log(`Seeded ${templates.length} templates.`);

  // Triggers
  console.log("Seeding pulse triggers...");

  const triggers = [
    { id: "pulse-trig-first-month", name: "First Month Satisfaction", triggerSource: "time_based", triggerCondition: { milestone: "first_month", daysAfter: 30 }, templateId: "pulse-tmpl-first-month", isDefault: true },
    { id: "pulse-trig-discovery", name: "PI Discovery Phase", triggerSource: "phase_change", triggerCondition: { milestone: "discovery_started" }, practiceArea: "personal_injury", templateId: "pulse-tmpl-discovery", isDefault: true },
    { id: "pulse-trig-case-closed", name: "Case Closed NPS", triggerSource: "case_closed", triggerCondition: { milestone: "case_closed" }, templateId: "pulse-tmpl-case-closed", isDefault: true },
    { id: "pulse-trig-court", name: "Post Court Event", triggerSource: "event_completed", triggerCondition: { milestone: "post_event", eventType: "court_appearance" }, templateId: "pulse-tmpl-court-event", isDefault: true },
    { id: "pulse-trig-quarterly", name: "Quarterly Check-In", triggerSource: "time_based", triggerCondition: { milestone: "quarterly_checkin", daysAfter: 90 }, templateId: "pulse-tmpl-quarterly", isDefault: true },
    { id: "pulse-trig-fl-month", name: "Family Law First Month", triggerSource: "time_based", triggerCondition: { milestone: "first_month", daysAfter: 30 }, practiceArea: "family_law", templateId: "pulse-tmpl-family-sensitive", isDefault: true },
    { id: "pulse-trig-imm-filed", name: "Immigration Application Filed", triggerSource: "milestone", triggerCondition: { milestone: "case_opened" }, practiceArea: "immigration", templateId: "pulse-tmpl-immigration", isDefault: true },
  ];

  for (const t of triggers) {
    await prisma.pulseTrigger.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: null },
      update: { name: t.name },
    });
  }

  console.log(`Seeded ${triggers.length} triggers.`);

  // Demo survey responses
  console.log("Seeding demo survey responses...");

  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (firstMatter) {
    const demoSurveys = [
      { score: 5, responseLabel: "Very Happy", questionType: "emoji_5", triggerMilestone: "first_month", followUpResponse: "Very impressed with how responsive the team has been. Always available when I have questions.", clientName: "John Smith", status: "responded" },
      { score: 4, responseLabel: "Satisfied", questionType: "scale_1_5", triggerMilestone: "discovery_started", followUpResponse: "Everything is going well. Just wish the process was a bit faster.", clientName: "Maria Rodriguez", status: "responded" },
      { score: 9, responseLabel: "Promoter", questionType: "nps_0_10", triggerMilestone: "case_closed", followUpResponse: "Excellent representation from start to finish. Would absolutely recommend to anyone.", clientName: "Robert Chen", status: "responded" },
      { score: 2, responseLabel: "Dissatisfied", questionType: "scale_1_5", triggerMilestone: "quarterly_checkin", followUpResponse: "Haven't heard from my attorney in weeks. Feeling left in the dark.", clientName: "Angela Davis", status: "responded" },
      { score: 1, responseLabel: "Thumbs Up", questionType: "thumbs", triggerMilestone: "post_event", clientName: "James Wilson", status: "responded" },
      { score: null, responseLabel: null, questionType: "emoji_5", triggerMilestone: "first_month", clientName: "Sarah Thompson", status: "delivered" },
    ];

    for (let i = 0; i < demoSurveys.length; i++) {
      const s = demoSurveys[i];
      const id = `pulse-demo-${i + 1}`;
      await prisma.pulseSurvey.upsert({
        where: { id },
        create: {
          id,
          matterId: firstMatter.id,
          clientName: s.clientName,
          practiceArea: firstMatter.practiceArea,
          triggerMilestone: s.triggerMilestone,
          question: "How satisfied are you with our services?",
          questionType: s.questionType,
          followUpQuestion: "What could we improve?",
          responseToken: `demo-token-${i + 1}-${Date.now()}`,
          tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          score: s.score,
          responseLabel: s.responseLabel,
          followUpResponse: s.followUpResponse || null,
          respondedAt: s.status === "responded" ? new Date(Date.now() - (i + 1) * 3 * 24 * 60 * 60 * 1000) : null,
          status: s.status,
          deliveredAt: new Date(Date.now() - (i + 1) * 4 * 24 * 60 * 60 * 1000),
          deliveryChannels: ["portal", "email"],
          userId: USER_ID,
          firmId: FIRM_ID,
        },
        update: {},
      });
    }

    console.log(`Seeded ${demoSurveys.length} demo surveys.`);
  }

  console.log("Pulse seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
