import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding workflow templates...");

  // PI — Auto Accident
  const piWf = await prisma.workflowTemplate.create({
    data: {
      name: "PI — Auto Accident (NY Supreme Court)", practiceArea: "personal_injury", caseType: "auto_accident",
      jurisdiction: "NY-SUPREME", isDefault: true, isSystemTemplate: true,
      description: "Complete PI auto accident workflow: 13 stages from intake through post-settlement with task cascades, document generation, discovery checklists, deadline rules, and automated client communications.",
      stagesConfig: [
        { name: "Intake", color: "#6366f1", description: "Client signed, retainer pending", isRequired: true },
        { name: "Investigation", color: "#f59e0b", description: "Evidence collection, preservation", isRequired: true },
        { name: "Medical Treatment", color: "#10b981", description: "Client treating", isRequired: true },
        { name: "Demand Package", color: "#3b82f6", description: "Preparing demand", isRequired: true },
        { name: "Negotiation", color: "#8b5cf6", description: "Negotiating with carrier", isRequired: true },
        { name: "Litigation Filed", color: "#ef4444", description: "Complaint filed", isRequired: false },
        { name: "Discovery", color: "#f97316", description: "Active discovery", isRequired: false },
        { name: "IME / DME", color: "#ec4899", description: "Medical exam", isRequired: false },
        { name: "Mediation", color: "#14b8a6", description: "Mediation", isRequired: false },
        { name: "Trial Prep", color: "#dc2626", description: "Preparing for trial", isRequired: false },
        { name: "Trial", color: "#b91c1c", description: "Active trial", isRequired: false },
        { name: "Settlement / Verdict", color: "#16a34a", description: "Resolution reached", isRequired: true },
        { name: "Post-Settlement", color: "#15803d", description: "Liens, disbursements", isRequired: true },
      ],
      intakeConfig: { sections: [
        { name: "Accident Details", fields: [
          { name: "incidentDate", label: "Date of Accident", type: "date", required: true },
          { name: "incidentLocation", label: "Location", type: "text", required: true },
          { name: "accidentType", label: "Type", type: "select", options: ["Rear-end", "T-bone", "Head-on", "Multi-vehicle", "Other"], required: true },
          { name: "policeReportFiled", label: "Police Report Filed?", type: "boolean", required: true },
          { name: "incidentDescription", label: "Description", type: "textarea", required: true },
        ]},
        { name: "Injuries", fields: [
          { name: "injuredBodyParts", label: "Injured Body Parts", type: "multiselect", options: ["Head/Brain", "Neck", "Back", "Shoulder", "Knee", "Hip", "Other"] },
          { name: "injurySeverity", label: "Severity", type: "select", options: ["Minor", "Moderate", "Serious", "Catastrophic"] },
        ]},
        { name: "Insurance", fields: [
          { name: "clientInsurance", label: "Client's Auto Insurance", type: "text", required: true },
          { name: "opposingCarrier", label: "Defendant's Carrier", type: "text" },
          { name: "opposingPolicyLimits", label: "Policy Limits", type: "currency" },
        ]},
      ]},
      billingConfig: { type: "CONTINGENCY", contingencyPct: 33.33, postLitigationPct: 40, trustRequired: false },
      tags: ["contingency", "no-fault", "ny-supreme", "auto-accident"],
    },
  });

  // Task cascades, docs, deadlines, checklist, automations for PI
  await prisma.wFTemplateChecklist.createMany({ data: [
    { workflowTemplateId: piWf.id, title: "Retainer agreement signed", category: "intake", triggerStage: "Intake", isRequired: true, dueOffsetDays: 3, sequenceNumber: 1 },
    { workflowTemplateId: piWf.id, title: "HIPAA authorizations signed", category: "intake", triggerStage: "Intake", isRequired: true, dueOffsetDays: 3, sequenceNumber: 2 },
    { workflowTemplateId: piWf.id, title: "No-fault application filed", category: "intake", triggerStage: "Intake", isRequired: true, dueOffsetDays: 5, sequenceNumber: 3 },
    { workflowTemplateId: piWf.id, title: "Preservation letters sent", category: "investigation", triggerStage: "Investigation", isRequired: true, dueOffsetDays: 1, sequenceNumber: 4 },
    { workflowTemplateId: piWf.id, title: "Police report ordered", category: "investigation", triggerStage: "Investigation", dueOffsetDays: 2, sequenceNumber: 5 },
    { workflowTemplateId: piWf.id, title: "All medical records received", category: "demand", triggerStage: "Demand Package", isRequired: true, sequenceNumber: 6 },
    { workflowTemplateId: piWf.id, title: "Demand reviewed with client", category: "demand", triggerStage: "Demand Package", isRequired: true, sequenceNumber: 7 },
    { workflowTemplateId: piWf.id, title: "Complaint filed", category: "litigation", triggerStage: "Litigation Filed", isRequired: true, sequenceNumber: 8 },
    { workflowTemplateId: piWf.id, title: "All defendants served", category: "litigation", triggerStage: "Litigation Filed", isRequired: true, sequenceNumber: 9 },
    { workflowTemplateId: piWf.id, title: "Liens identified", category: "settlement", triggerStage: "Settlement / Verdict", isRequired: true, sequenceNumber: 10 },
    { workflowTemplateId: piWf.id, title: "Settlement statement signed", category: "settlement", triggerStage: "Settlement / Verdict", isRequired: true, sequenceNumber: 11 },
    { workflowTemplateId: piWf.id, title: "Disbursement check issued", category: "closing", triggerStage: "Post-Settlement", isRequired: true, sequenceNumber: 12 },
  ]});

  await prisma.wFTemplateDeadline.createMany({ data: [
    { workflowTemplateId: piWf.id, name: "Statute of Limitations", triggerEvent: "field:incidentDate", triggerField: "incidentDate", offsetDays: 1095, category: "sol", isCritical: true, legalBasis: "CPLR §214", sequenceNumber: 1 },
    { workflowTemplateId: piWf.id, name: "Notice of Claim (municipal)", triggerEvent: "field:incidentDate", triggerField: "incidentDate", offsetDays: 90, category: "filing", isCritical: true, legalBasis: "GML §50-e", conditionalOn: "opposing.isMunicipal == true", sequenceNumber: 2 },
    { workflowTemplateId: piWf.id, name: "No-Fault Application", triggerEvent: "field:incidentDate", triggerField: "incidentDate", offsetDays: 30, category: "filing", legalBasis: "Insurance Law §5106", sequenceNumber: 3 },
    { workflowTemplateId: piWf.id, name: "Answer Due (after service)", triggerEvent: "field:servedAt", triggerField: "servedAt", offsetDays: 20, category: "response", legalBasis: "CPLR §3012", sequenceNumber: 4 },
  ]});

  await prisma.wFTemplateAutomation.createMany({ data: [
    { workflowTemplateId: piWf.id, name: "Welcome email on intake", triggerType: "stage_enter", triggerStage: "Intake", actions: [{ type: "send_email", config: { templateName: "PI Welcome Email", to: "client" } }], sequenceNumber: 1 },
    { workflowTemplateId: piWf.id, name: "30-day follow-up on demand", triggerType: "stage_enter", triggerStage: "Negotiation", actions: [{ type: "create_task", config: { title: "Follow up with adjuster", dueOffsetDays: 30, priority: "HIGH" } }], sequenceNumber: 2 },
    { workflowTemplateId: piWf.id, name: "Settlement portal notification", triggerType: "stage_enter", triggerStage: "Settlement / Verdict", actions: [{ type: "send_to_portal", config: { message: "Great news — your case has reached a resolution." } }], sequenceNumber: 3 },
    { workflowTemplateId: piWf.id, name: "Post-settlement lien task", triggerType: "stage_enter", triggerStage: "Post-Settlement", actions: [{ type: "create_task", config: { title: "Resolve all outstanding liens before disbursement", priority: "CRITICAL", dueOffsetDays: 14 } }], sequenceNumber: 4 },
  ]});

  await prisma.wFTemplateDiscovery.create({
    data: { workflowTemplateId: piWf.id, discoveryTemplateName: "Personal Injury — Auto Accident (NY)", autoGenerateOn: "stage:Discovery", generationMode: "hybrid" },
  });

  console.log("Seeded PI Auto Accident workflow.");

  // Family Law — Contested Divorce
  const flWf = await prisma.workflowTemplate.create({
    data: {
      name: "Family Law — Contested Divorce (NY)", practiceArea: "family_law", caseType: "contested_divorce",
      jurisdiction: "NY-SUPREME", isDefault: true, isSystemTemplate: true,
      description: "Contested divorce workflow with financial disclosure, mediation, and trial prep stages.",
      stagesConfig: [
        { name: "Intake", color: "#6366f1", isRequired: true },
        { name: "Retainer Signed", color: "#10b981", isRequired: true },
        { name: "Summons Filed", color: "#f59e0b", isRequired: true },
        { name: "Preliminary Conference", color: "#3b82f6", isRequired: true },
        { name: "Discovery / Disclosure", color: "#f97316", isRequired: true },
        { name: "Expert Reports", color: "#8b5cf6", isRequired: false },
        { name: "Negotiation / Mediation", color: "#14b8a6", isRequired: true },
        { name: "Trial Prep", color: "#dc2626", isRequired: false },
        { name: "Trial", color: "#b91c1c", isRequired: false },
        { name: "Post-Judgment", color: "#16a34a", isRequired: true },
        { name: "Closed", color: "#6b7280", isRequired: true },
      ],
      billingConfig: { type: "HOURLY", hourlyRate: 350, retainerAmount: 5000, trustRequired: true },
      tags: ["hourly", "contested", "ny-supreme", "family"],
    },
  });

  await prisma.wFTemplateDeadline.createMany({ data: [
    { workflowTemplateId: flWf.id, name: "File RJI", triggerEvent: "field:summonsFiled", triggerField: "summonsFiled", offsetDays: 45, category: "filing", legalBasis: "22 NYCRR §202.6", sequenceNumber: 1 },
    { workflowTemplateId: flWf.id, name: "Net Worth Statement", triggerEvent: "field:preliminaryConferenceDate", triggerField: "preliminaryConferenceDate", offsetDays: -3, offsetDirection: "before", category: "filing", legalBasis: "DRL §236(B)(4)", sequenceNumber: 2 },
  ]});

  await prisma.wFTemplateChecklist.createMany({ data: [
    { workflowTemplateId: flWf.id, title: "Retainer agreement signed", category: "intake", triggerStage: "Intake", isRequired: true, dueOffsetDays: 3, sequenceNumber: 1 },
    { workflowTemplateId: flWf.id, title: "Statement of Net Worth prepared", category: "discovery", triggerStage: "Discovery / Disclosure", isRequired: true, dueOffsetDays: 10, sequenceNumber: 2 },
    { workflowTemplateId: flWf.id, title: "Discovery demands served", category: "discovery", triggerStage: "Discovery / Disclosure", isRequired: true, dueOffsetDays: 7, sequenceNumber: 3 },
    { workflowTemplateId: flWf.id, title: "QDRO submission deadline calendared", category: "closing", triggerStage: "Post-Judgment", sequenceNumber: 4 },
  ]});

  await prisma.wFTemplateDiscovery.create({
    data: { workflowTemplateId: flWf.id, discoveryTemplateName: "Family Law — Contested Divorce (NY)", autoGenerateOn: "stage:Discovery / Disclosure", generationMode: "hybrid" },
  });

  console.log("Seeded Family Law Contested Divorce workflow.");

  // Real Estate — Residential Purchase
  await prisma.workflowTemplate.create({
    data: {
      name: "Real Estate — Residential Purchase (NY)", practiceArea: "real_estate", caseType: "residential_purchase",
      jurisdiction: "NY", isDefault: true, isSystemTemplate: true,
      stagesConfig: [
        { name: "Intake", color: "#6366f1", isRequired: true },
        { name: "Contract Review", color: "#f59e0b", isRequired: true },
        { name: "Due Diligence", color: "#3b82f6", isRequired: true },
        { name: "Mortgage Commitment", color: "#10b981", isRequired: true },
        { name: "Title Search", color: "#8b5cf6", isRequired: true },
        { name: "Pre-Closing", color: "#f97316", isRequired: true },
        { name: "Closing", color: "#16a34a", isRequired: true },
        { name: "Post-Closing", color: "#15803d", isRequired: true },
      ],
      billingConfig: { type: "FLAT_FEE", flatFee: 2000 },
      tags: ["flat-fee", "residential", "closing"],
    },
  });

  // Immigration — Removal Defense
  await prisma.workflowTemplate.create({
    data: {
      name: "Immigration — Removal Defense", practiceArea: "immigration", caseType: "removal_defense",
      isDefault: true, isSystemTemplate: true,
      stagesConfig: [
        { name: "Intake", color: "#6366f1", isRequired: true },
        { name: "FOIA Filed", color: "#f59e0b", isRequired: true },
        { name: "Master Calendar", color: "#3b82f6", isRequired: true },
        { name: "Individual Hearing Prep", color: "#8b5cf6", isRequired: true },
        { name: "Individual Hearing", color: "#ef4444", isRequired: true },
        { name: "Decision", color: "#16a34a", isRequired: true },
        { name: "Appeal", color: "#f97316", isRequired: false },
        { name: "Closed", color: "#6b7280", isRequired: true },
      ],
      billingConfig: { type: "FLAT_FEE", flatFee: 7500 },
      tags: ["removal", "immigration-court", "eoir"],
    },
  });

  // Criminal — Felony
  await prisma.workflowTemplate.create({
    data: {
      name: "Criminal Defense — Felony (NY)", practiceArea: "criminal_defense", caseType: "felony",
      jurisdiction: "NY", isDefault: true, isSystemTemplate: true,
      stagesConfig: [
        { name: "Intake", color: "#6366f1", isRequired: true },
        { name: "Arraignment", color: "#ef4444", isRequired: true },
        { name: "Grand Jury", color: "#f59e0b", isRequired: false },
        { name: "Indictment", color: "#f97316", isRequired: false },
        { name: "CPL 245 Discovery", color: "#3b82f6", isRequired: true },
        { name: "Motions", color: "#8b5cf6", isRequired: false },
        { name: "Plea Negotiations", color: "#14b8a6", isRequired: true },
        { name: "Trial Prep", color: "#dc2626", isRequired: false },
        { name: "Trial", color: "#b91c1c", isRequired: false },
        { name: "Sentencing", color: "#f97316", isRequired: false },
        { name: "Post-Conviction", color: "#6b7280", isRequired: false },
        { name: "Closed", color: "#6b7280", isRequired: true },
      ],
      billingConfig: { type: "FLAT_FEE_WITH_MILESTONES", milestones: [{ stage: "Arraignment", amount: 5000 }, { stage: "Indictment", amount: 5000 }, { stage: "Trial", amount: 10000 }] },
      tags: ["criminal", "felony", "cpl-245"],
    },
  });

  // General Litigation — Breach of Contract
  await prisma.workflowTemplate.create({
    data: {
      name: "General Litigation — Breach of Contract (NY)", practiceArea: "litigation", caseType: "breach_of_contract",
      jurisdiction: "NY-SUPREME", isDefault: true, isSystemTemplate: true,
      stagesConfig: [
        { name: "Intake", color: "#6366f1", isRequired: true },
        { name: "Pre-Suit Demand", color: "#f59e0b", isRequired: true },
        { name: "Litigation Filed", color: "#ef4444", isRequired: false },
        { name: "Answer / Responsive", color: "#3b82f6", isRequired: false },
        { name: "Discovery", color: "#f97316", isRequired: false },
        { name: "Motion Practice", color: "#8b5cf6", isRequired: false },
        { name: "Mediation", color: "#14b8a6", isRequired: false },
        { name: "Trial Prep", color: "#dc2626", isRequired: false },
        { name: "Trial", color: "#b91c1c", isRequired: false },
        { name: "Post-Trial", color: "#16a34a", isRequired: false },
        { name: "Closed", color: "#6b7280", isRequired: true },
      ],
      billingConfig: { type: "HOURLY", hourlyRate: 400, retainerAmount: 10000, trustRequired: true },
      tags: ["hourly", "breach", "commercial"],
    },
  });

  console.log("Seeded 6 workflow templates (PI, Family, Real Estate, Immigration, Criminal, Contract).");
  console.log("Workflow template seeding complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
