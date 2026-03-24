import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding action rules...");

  const rules = [
    // Universal Rules
    {
      id: "rule-client-update-overdue",
      name: "Client Update Overdue",
      description: "Triggers when there has been no client communication for 30+ days",
      triggerType: "inactivity",
      triggerCondition: { type: "client_contact_gap", daysThreshold: 30 },
      actionTemplate: {
        title: "Send client status update",
        description: "No client communication in over 30 days. Clients appreciate regular updates even when there's nothing major to report.",
        actionType: "client_communication",
        urgency: "this_week",
        priority: 6,
        suggestedFeature: "correspondence",
        suggestedAction: { feature: "correspondence", params: { correspondenceType: "client_update_email" } },
        estimatedTime: "15-30 minutes",
      },
      isDefault: true,
    },
    {
      id: "rule-matter-inactivity",
      name: "Matter Inactivity Alert",
      description: "Triggers when a matter has had no activity for 21+ days",
      triggerType: "inactivity",
      triggerCondition: { type: "matter_inactivity", daysThreshold: 21 },
      actionTemplate: {
        title: "Review matter status — no activity in 21 days",
        description: "This matter has had no logged activity for 3 weeks. Review the case status and determine if action is needed or if the matter is in a natural waiting period.",
        actionType: "strategic",
        urgency: "this_week",
        priority: 5,
        estimatedTime: "15 minutes",
      },
      isDefault: true,
    },
    {
      id: "rule-unbilled-time",
      name: "Unbilled Time Threshold",
      description: "Triggers when unbilled hours exceed 15 hours on a matter",
      triggerType: "billing_trigger",
      triggerCondition: { type: "unbilled_hours", hoursThreshold: 15 },
      actionTemplate: {
        title: "Generate invoice — unbilled hours accumulating",
        description: "Unbilled time has exceeded the recommended threshold. Generate and send an invoice to maintain cash flow.",
        actionType: "billing",
        urgency: "this_week",
        priority: 4,
        suggestedFeature: "billing",
        suggestedAction: { feature: "billing", params: { action: "create_invoice" } },
        estimatedTime: "15-30 minutes",
      },
      isDefault: true,
    },
    {
      id: "rule-deadline-no-prep",
      name: "Deadline Approaching — No Prep Work",
      description: "Triggers when a deadline is within 14 days and no preparatory work has been logged",
      triggerType: "deadline_approaching",
      triggerCondition: { type: "deadline_no_prep", daysThreshold: 14, requiredActivityTypes: ["drafting", "research", "filing"] },
      actionTemplate: {
        title: "Prepare for approaching deadline",
        description: "A deadline is approaching in [daysRemaining] days and no preparatory work has been logged.",
        actionType: "deadline_response",
        urgency: "this_week",
        priority: 8,
        suggestedFeature: "deadline_calculator",
        estimatedTime: "Varies",
      },
      isDefault: true,
    },
    {
      id: "rule-deadline-overdue",
      name: "Overdue Deadline — Escalation",
      description: "Triggers when a deadline has passed without being marked complete",
      triggerType: "deadline_approaching",
      triggerCondition: { type: "deadline_overdue" },
      actionTemplate: {
        title: "OVERDUE: [deadline name] was due [days] ago",
        description: "A deadline has passed without being marked complete. Take immediate action or file for an extension.",
        actionType: "deadline_response",
        urgency: "immediate",
        priority: 10,
        estimatedTime: "Immediate attention required",
      },
      isDefault: true,
    },
    {
      id: "rule-doc-review-flags",
      name: "Document Review Flags Unresolved",
      description: "Triggers when critical/high document review flags have been open for 7+ days",
      triggerType: "document_review_result",
      triggerCondition: { type: "unresolved_critical_flags", daysThreshold: 7 },
      actionTemplate: {
        title: "Address unresolved document review findings",
        description: "Critical or high-severity flags from a document review have been open for over 7 days without resolution.",
        actionType: "document_review",
        urgency: "this_week",
        priority: 7,
        suggestedFeature: "document_review",
        estimatedTime: "30-60 minutes",
      },
      isDefault: true,
    },
    {
      id: "rule-new-matter-onboarding",
      name: "New Matter Onboarding Checklist",
      description: "Triggers when a new matter is created from intake",
      triggerType: "intake_conversion",
      triggerCondition: { type: "new_matter_created", daysThreshold: 3 },
      actionTemplate: {
        title: "Complete new matter onboarding",
        description: "New matter created from intake — send welcome email, schedule initial consultation, set up deadline chains, and request necessary documents from client.",
        actionType: "administrative",
        urgency: "this_week",
        priority: 7,
        estimatedTime: "30-45 minutes",
      },
      isDefault: true,
    },
    {
      id: "rule-prediction-drop",
      name: "Prediction Score Drop Alert",
      description: "Triggers when prediction score drops by 10+ points",
      triggerType: "prediction_change",
      triggerCondition: { type: "score_declined", threshold: 10 },
      actionTemplate: {
        title: "Case outlook declining — review strategy",
        description: "The predictive score for this matter has dropped significantly. Review recent developments and risk factors, and consider strategic adjustments.",
        actionType: "strategic",
        urgency: "this_week",
        priority: 7,
        suggestedFeature: "prediction",
        estimatedTime: "30 minutes",
      },
      isDefault: true,
    },

    // PI-specific rules
    {
      id: "rule-pi-bop",
      name: "PI — Bill of Particulars Due",
      description: "Triggers when Bill of Particulars deadline approaches in PI cases",
      practiceArea: "personal_injury",
      casePhase: "pleadings",
      triggerType: "deadline_approaching",
      triggerCondition: { type: "deadline_category", category: "responsive_pleading", name_contains: "bill_of_particulars", daysThreshold: 14 },
      actionTemplate: {
        title: "Draft and serve Bill of Particulars",
        description: "Bill of Particulars deadline is approaching.",
        actionType: "filing",
        urgency: "this_week",
        priority: 8,
        practiceAreaContext: "For PI cases, the BOP should detail: nature of injuries, body parts affected, duration of disability, medical providers, special damages breakdown (medical bills, lost wages), and theory of liability.",
        ruleReference: "CPLR 3041-3044",
        estimatedTime: "1-2 hours",
      },
      isDefault: true,
    },
    {
      id: "rule-pi-discovery-demands",
      name: "PI — Discovery Demands Not Served",
      description: "Triggers when discovery cutoff approaches and no demands have been served",
      practiceArea: "personal_injury",
      casePhase: "discovery",
      triggerType: "deadline_approaching",
      triggerCondition: { type: "discovery_cutoff_approaching", daysThreshold: 30, demandsSent: false },
      actionTemplate: {
        title: "Draft and serve interrogatories and document demands",
        description: "Discovery cutoff is approaching and no discovery demands have been served. Serve combined demands immediately to ensure responses are due before the cutoff.",
        actionType: "discovery",
        urgency: "immediate",
        priority: 9,
        suggestedFeature: "correspondence",
        suggestedAction: { feature: "correspondence", params: { correspondenceType: "discovery_request_cover" } },
        practiceAreaContext: "For PI auto accident cases, interrogatories should cover: accident circumstances, witness identification, insurance information, prior claims, and medical history. Document demands should request: accident report, insurance policy, photos/video, vehicle repair records, cell phone records, and all insurer correspondence.",
        ruleReference: "CPLR 3120, 3130",
        estimatedTime: "2-3 hours",
      },
      isDefault: true,
    },

    // Family Law
    {
      id: "rule-fl-snw",
      name: "FL — Statement of Net Worth",
      description: "Triggers when entering discovery phase in family law matters",
      practiceArea: "family_law",
      casePhase: "discovery",
      triggerType: "phase_transition",
      triggerCondition: {},
      actionTemplate: {
        title: "Prepare and file Statement of Net Worth",
        description: "Discovery phase in family court requires a Statement of Net Worth. Gather financial documentation from client.",
        actionType: "filing",
        urgency: "this_week",
        priority: 8,
        practiceAreaContext: "The SNW requires: income from all sources, monthly expenses, assets (real property, bank accounts, retirement, investments, vehicles, personal property), liabilities, and health insurance. Request 3 years of tax returns, bank statements, retirement statements, and pay stubs from client.",
        ruleReference: "22 NYCRR 202.16(b)",
        estimatedTime: "2-4 hours",
      },
      isDefault: true,
    },

    // Immigration
    {
      id: "rule-imm-visa-expiration",
      name: "IMM — Visa Expiration Approaching",
      description: "Triggers when client visa expiration is within 90 days",
      practiceArea: "immigration",
      triggerType: "deadline_approaching",
      triggerCondition: { type: "custom_deadline", name_contains: "visa_expiration", daysThreshold: 90 },
      actionTemplate: {
        title: "File extension or change of status before visa expiration",
        description: "Client's visa/status expires soon. File for extension or change of status to maintain lawful presence.",
        actionType: "filing",
        urgency: "immediate",
        priority: 10,
        practiceAreaContext: "File the petition before expiration to preserve lawful status. If H-1B, ensure employer petition is prepared. If F-1, coordinate with DSO. Filing receipt provides continued authorization in most cases. Consider premium processing if deadline is tight.",
        estimatedTime: "4-8 hours for petition preparation",
      },
      isDefault: true,
    },
  ];

  for (const rule of rules) {
    await prisma.actionRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        practiceArea: rule.practiceArea || null,
        casePhase: rule.casePhase || null,
        triggerType: rule.triggerType,
        triggerCondition: rule.triggerCondition,
        actionTemplate: rule.actionTemplate,
        isActive: true,
        isDefault: rule.isDefault,
        firmId: null, // platform defaults
      },
      update: {
        name: rule.name,
        description: rule.description,
        triggerCondition: rule.triggerCondition,
        actionTemplate: rule.actionTemplate,
      },
    });
  }

  console.log(`Seeded ${rules.length} action rules.`);

  // Seed demo actions (linked to first matter found)
  console.log("Seeding demo actions...");

  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (firstMatter) {
    const demoActions = [
      {
        id: "demo-action-1",
        title: "OVERDUE: Answer due in Smith v. Jones was due 3 days ago",
        description: "The deadline to file an answer has passed. File immediately or seek an extension to avoid default.",
        actionType: "deadline_response",
        urgency: "immediate",
        priority: 10,
        source: "rule",
        triggerEvent: "Deadline overdue",
        estimatedTime: "Immediate attention required",
      },
      {
        id: "demo-action-2",
        title: "Draft and serve interrogatories and document demands",
        description: "Discovery cutoff is in 14 days and no discovery demands have been served. Serve combined demands immediately.",
        actionType: "discovery",
        urgency: "immediate",
        priority: 9,
        source: "rule",
        triggerEvent: "Discovery cutoff approaching",
        suggestedFeature: "correspondence",
        practiceAreaContext: "For PI auto accident cases, interrogatories should cover: accident circumstances, witness identification, insurance information, prior claims, and medical history.",
        ruleReference: "CPLR 3120, 3130",
        estimatedTime: "2-3 hours",
      },
      {
        id: "demo-action-3",
        title: "Send client status update to Rodriguez",
        description: "No client communication in 32 days. Clients appreciate regular updates even when there's nothing major to report.",
        actionType: "client_communication",
        urgency: "this_week",
        priority: 7,
        source: "rule",
        triggerEvent: "Client contact gap > 30 days",
        suggestedFeature: "correspondence",
        estimatedTime: "15-30 minutes",
      },
      {
        id: "demo-action-4",
        title: "Generate invoice — 22 unbilled hours ($6,600)",
        description: "Unbilled time has exceeded the recommended threshold. Generate and send an invoice to maintain cash flow.",
        actionType: "billing",
        urgency: "this_week",
        priority: 6,
        source: "rule",
        triggerEvent: "Unbilled hours > 15",
        suggestedFeature: "billing",
        estimatedTime: "15-30 minutes",
      },
      {
        id: "demo-action-5",
        title: "Address 5 unresolved flags from discovery response review",
        description: "Critical deficiencies identified in opposing counsel's discovery responses. Draft follow-up demand letter addressing inadequate responses.",
        actionType: "document_review",
        urgency: "next_two_weeks",
        priority: 6,
        source: "ai",
        triggerEvent: "Unresolved document review flags",
        suggestedFeature: "document_review",
        reasoning: "The document review completed 8 days ago identified 5 high-severity flags including incomplete interrogatory answers and missing documents. These need to be addressed before the discovery cutoff.",
        estimatedTime: "1-2 hours",
      },
      {
        id: "demo-action-6",
        title: "Schedule expert witness consultation for medical causation opinion",
        description: "The matter requires medical expert testimony to establish causation. Schedule an initial consultation to discuss the case and obtain a preliminary opinion.",
        actionType: "expert",
        urgency: "this_month",
        priority: 5,
        source: "ai",
        reasoning: "The case is in the discovery phase and opposing counsel will likely challenge medical causation. Having an expert opinion early strengthens settlement negotiations.",
        suggestedFeature: "calendar",
        estimatedTime: "30 minutes to schedule, 1-2 hours for consultation",
      },
      {
        id: "demo-action-7",
        title: "Review and update retainer agreement for fee increase",
        description: "The current retainer rate has been in effect for over a year. Consider discussing a rate adjustment with the client during the next status update.",
        actionType: "administrative",
        urgency: "when_possible",
        priority: 3,
        source: "ai",
        estimatedTime: "15 minutes",
      },
    ];

    for (const action of demoActions) {
      await prisma.matterAction.upsert({
        where: { id: action.id },
        create: {
          id: action.id,
          matterId: firstMatter.id,
          title: action.title,
          description: action.description,
          actionType: action.actionType,
          urgency: action.urgency,
          priority: action.priority,
          source: action.source,
          triggerEvent: action.triggerEvent || null,
          reasoning: action.reasoning || null,
          practiceAreaContext: action.practiceAreaContext || null,
          ruleReference: action.ruleReference || null,
          suggestedFeature: action.suggestedFeature || null,
          estimatedTime: action.estimatedTime || null,
          status: "pending",
          userId: USER_ID,
          firmId: FIRM_ID,
        },
        update: {
          title: action.title,
          description: action.description,
          priority: action.priority,
        },
      });
    }

    console.log(`Seeded ${demoActions.length} demo actions.`);

    // Seed activity log
    console.log("Seeding activity log...");
    const now = new Date();
    const activityEntries = [
      { activityType: "correspondence_sent", description: "Letter sent to opposing counsel re: discovery extension request", daysAgo: 3 },
      { activityType: "document_reviewed", description: "Document review completed — 5 flags identified in opposing counsel's interrogatory responses", daysAgo: 8 },
      { activityType: "court_appearance", description: "Preliminary conference — Judge set discovery cutoff for April 15, 2026", daysAgo: 15 },
      { activityType: "client_call", description: "Phone call with client — discussed case status and upcoming depositions", daysAgo: 20 },
      { activityType: "time_entry", description: "Billed 3.5h for legal research on motion standards", daysAgo: 5 },
      { activityType: "filing_submitted", description: "Filed Notice of Appearance and Preliminary Conference Request", daysAgo: 25 },
      { activityType: "correspondence_received", description: "Received opposing counsel's initial disclosures", daysAgo: 12 },
      { activityType: "note_added", description: "Case strategy meeting notes — discussed settlement range and expert needs", daysAgo: 18 },
      { activityType: "deadline_completed", description: "Completed: File Answer to Complaint (on time)", daysAgo: 22 },
      { activityType: "invoice_sent", description: "Invoice #1045 sent to client — $4,200 for January services", daysAgo: 28 },
      { activityType: "client_meeting", description: "Initial client meeting — reviewed facts and discussed litigation strategy", daysAgo: 30 },
      { activityType: "discovery_served", description: "Served initial interrogatories and document demands on opposing counsel", daysAgo: 10 },
      { activityType: "prediction_updated", description: "Case prediction score updated: 72 → 68 (slight decline due to missing medical records)", daysAgo: 7 },
      { activityType: "payment_received", description: "Payment received from client — $4,200 for Invoice #1045", daysAgo: 14 },
      { activityType: "correspondence_sent", description: "Demand letter sent to insurance company re: policy limits disclosure", daysAgo: 11 },
    ];

    for (const entry of activityEntries) {
      const occurredAt = new Date(now);
      occurredAt.setDate(occurredAt.getDate() - entry.daysAgo);

      await prisma.matterActivityLog.create({
        data: {
          matterId: firstMatter.id,
          activityType: entry.activityType,
          description: entry.description,
          occurredAt,
          firmId: FIRM_ID,
        },
      });
    }

    console.log(`Seeded ${activityEntries.length} activity log entries.`);

    // Seed phase history
    const phases = [
      { phase: "pre_litigation", startedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), endedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) },
      { phase: "pleadings", startedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), endedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) },
      { phase: "discovery", startedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), endedAt: null },
    ];

    for (const phase of phases) {
      await prisma.matterPhaseHistory.create({
        data: {
          matterId: firstMatter.id,
          phase: phase.phase,
          startedAt: phase.startedAt,
          endedAt: phase.endedAt,
          firmId: FIRM_ID,
        },
      });
    }

    console.log("Seeded phase history.");
  } else {
    console.log("No open matter found for demo actions — skipping.");
  }

  console.log("Next actions seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
