import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// 1. AI Conversation Engine
// ---------------------------------------------------------------------------

export async function processMessage(params: {
  sessionToken: string;
  message: string;
}): Promise<{ response: string; extractedData?: any; questionComplete?: boolean }> {
  const session = await (db as any).intakeSession.findUnique({
    where: { sessionToken: params.sessionToken },
  });
  if (!session) throw new Error("Session not found");

  // Get the screening flow
  let flow: any = null;
  if (session.flowId) {
    flow = await (db as any).intakeScreeningFlow.findUnique({
      where: { id: session.flowId },
    });
  }
  if (!flow && session.practiceArea) {
    flow = await (db as any).intakeScreeningFlow.findFirst({
      where: { practiceArea: session.practiceArea, isDefault: true, isActive: true },
    });
  }

  const conversationLog = (session.conversationLog || []) as any[];
  conversationLog.push({
    role: "user",
    content: params.message,
    timestamp: new Date().toISOString(),
  });

  // Build conversation context for AI
  const questions = flow?.questions || [];
  const currentIdx = session.currentQuestionIndex || 0;
  const currentQuestion = questions[currentIdx];
  const extractedData = session.extractedData || {};

  const systemPrompt = `You are a legal intake assistant for a law firm. You're conducting a confidential intake screening.
${session.practiceArea ? `Practice Area: ${session.practiceArea}` : ""}
${currentQuestion ? `Current question to extract: "${currentQuestion.text}" (Category: ${currentQuestion.category})` : "Conversational intake - gather relevant details."}

RULES:
- Be warm, professional, and empathetic
- Ask one question at a time
- If the user's response answers the current question, extract the data and move to the next question
- If the user seems distressed or mentions emergencies (domestic violence, immediate danger), acknowledge immediately and flag as emergency
- Keep responses concise (2-3 sentences max)
- Never provide legal advice - you are gathering information for an attorney review
- If the user asks about costs/fees, say "Our attorneys will discuss fees during your consultation"

Previously extracted data: ${JSON.stringify(extractedData)}

Return JSON only:
{
  "response": "Your conversational response to the user",
  "extractedField": "field_name_or_null",
  "extractedValue": "value_or_null",
  "questionAnswered": true_or_false,
  "urgencyDetected": "emergency|urgent|normal",
  "practiceAreaDetected": "practice_area_or_null"
}`;

  const conversationHistory = conversationLog
    .slice(-10)
    .map((m: any) => `${m.role === "user" ? "Client" : "Assistant"}: ${m.content}`)
    .join("\n");

  const result = await aiRouter.complete({
    feature: "intake_screening",
    systemPrompt,
    userPrompt: `Conversation so far:\n${conversationHistory}\n\nClient's latest message: ${params.message}`,
    maxTokens: 1024,
    temperature: 0.4,
  });

  let parsed: any;
  try {
    let jsonStr = result.content;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    parsed = { response: result.content.replace(/[{}]/g, "").trim(), questionAnswered: false };
  }

  // Update extracted data
  const newExtracted = { ...extractedData };
  if (parsed.extractedField && parsed.extractedValue) {
    newExtracted[parsed.extractedField] = parsed.extractedValue;
  }

  // Auto-detect practice area
  let practiceArea = session.practiceArea;
  if (!practiceArea && parsed.practiceAreaDetected) {
    practiceArea = parsed.practiceAreaDetected;
    // Try to find a matching flow
    const matchingFlow = await (db as any).intakeScreeningFlow.findFirst({
      where: { practiceArea, isDefault: true, isActive: true },
    });
    if (matchingFlow) {
      flow = matchingFlow;
    }
  }

  // Add AI response to log
  conversationLog.push({
    role: "assistant",
    content: parsed.response,
    timestamp: new Date().toISOString(),
  });

  // Update session
  const nextIdx = parsed.questionAnswered ? currentIdx + 1 : currentIdx;
  const urgencyLevel = parsed.urgencyDetected === "emergency" ? "emergency"
    : parsed.urgencyDetected === "urgent" ? "urgent"
    : session.urgencyLevel;

  await (db as any).intakeSession.update({
    where: { sessionToken: params.sessionToken },
    data: {
      conversationLog,
      extractedData: newExtracted,
      practiceArea: practiceArea || session.practiceArea,
      flowId: flow?.id || session.flowId,
      currentQuestionIndex: nextIdx,
      messagesCount: session.messagesCount + 2,
      urgencyLevel,
      lastActivityAt: new Date(),
    },
  });

  return {
    response: parsed.response,
    extractedData: parsed.extractedField ? { [parsed.extractedField]: parsed.extractedValue } : undefined,
    questionComplete: parsed.questionAnswered,
  };
}

// ---------------------------------------------------------------------------
// 2. Lead Scoring
// ---------------------------------------------------------------------------

export function calculateLeadScore(
  extractedData: any,
  practiceArea: string,
  conversationLog: any[],
): { score: number; grade: string; factors: Array<{ factor: string; points: number; description: string }> } {
  const factors: Array<{ factor: string; points: number; description: string }> = [];
  let score = 30; // base score

  if (practiceArea === "personal_injury") {
    // Liability
    if (extractedData?.atFault === "other_driver" || extractedData?.liability === "clear") {
      factors.push({ factor: "Clear Liability", points: 20, description: "Other party clearly at fault" });
      score += 20;
    } else if (extractedData?.atFault === "shared") {
      factors.push({ factor: "Shared Fault", points: -10, description: "Potential comparative fault issue" });
      score -= 10;
    }
    // Injuries
    if (extractedData?.injuries || extractedData?.injuryDescription) {
      factors.push({ factor: "Documented Injuries", points: 15, description: "Injuries described" });
      score += 15;
    }
    // Medical treatment
    if (extractedData?.medicalTreatment === "er_and_ongoing") {
      factors.push({ factor: "Active Treatment", points: 15, description: "ER visit + ongoing treatment" });
      score += 15;
    } else if (extractedData?.medicalTreatment === "doctor_only") {
      factors.push({ factor: "Seeing Doctor", points: 12, description: "Under medical care" });
      score += 12;
    }
    // Police report
    if (extractedData?.policeReport === "yes" || extractedData?.policeReport === true) {
      factors.push({ factor: "Police Report", points: 5, description: "Incident documented by police" });
      score += 5;
    }
    // No prior attorney
    if (extractedData?.priorAttorney === "no" || extractedData?.priorAttorney === false) {
      factors.push({ factor: "No Prior Attorney", points: 10, description: "First consultation" });
      score += 10;
    }
    // Insurance
    if (extractedData?.insuranceCompany || extractedData?.otherDriverInsurance) {
      factors.push({ factor: "Insurance Identified", points: 5, description: "Other party's insurance known" });
      score += 5;
    }
  } else if (practiceArea === "immigration") {
    if (extractedData?.currentStatus && extractedData.currentStatus !== "undocumented") {
      factors.push({ factor: "Valid Status", points: 10, description: "Currently in valid immigration status" });
      score += 10;
    }
    if (extractedData?.employerSponsor === "yes" || extractedData?.employerSponsor === true) {
      factors.push({ factor: "Employer Sponsor", points: 15, description: "Employer willing to sponsor" });
      score += 15;
    }
    if (extractedData?.priorDenials === "no" || extractedData?.priorDenials === false) {
      factors.push({ factor: "No Prior Denials", points: 10, description: "Clean application history" });
      score += 10;
    }
    if (extractedData?.removalProceedings === "yes" || extractedData?.removalProceedings === true) {
      factors.push({ factor: "Removal Proceedings", points: 15, description: "Emergency - in removal proceedings" });
      score += 15;
    }
  } else if (practiceArea === "family_law") {
    if (extractedData?.children === "yes_minor") {
      factors.push({ factor: "Minor Children", points: 5, description: "Children involved - higher complexity" });
      score += 5;
    }
    if (extractedData?.assets === "significant") {
      factors.push({ factor: "Significant Assets", points: 10, description: "Complex asset division needed" });
      score += 10;
    }
    if (extractedData?.domesticViolence === "yes" || extractedData?.domesticViolence === true) {
      factors.push({ factor: "DV Emergency", points: 20, description: "Domestic violence - urgent protective action needed" });
      score += 20;
    }
    if (extractedData?.contested === "contested") {
      factors.push({ factor: "Contested Divorce", points: 10, description: "Full litigation expected" });
      score += 10;
    }
    if (extractedData?.spouseAttorney === "yes" || extractedData?.spouseAttorney === true) {
      factors.push({ factor: "Opposing Counsel", points: 5, description: "Spouse has attorney - need to act" });
      score += 5;
    }
  }

  // Contact info provided bonus
  const contact = extractedData?.contactInfo || {};
  if (contact.phone || contact.email || extractedData?.phone || extractedData?.email) {
    factors.push({ factor: "Contact Info Provided", points: 5, description: "Can follow up with client" });
    score += 5;
  }

  // Engagement score (messages sent)
  if (conversationLog.length >= 10) {
    factors.push({ factor: "High Engagement", points: 5, description: "Client engaged deeply in conversation" });
    score += 5;
  }

  score = Math.min(100, Math.max(0, score));

  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";

  return { score, grade, factors };
}

// ---------------------------------------------------------------------------
// 3. AI Summary Generation
// ---------------------------------------------------------------------------

export async function generateIntakeSummary(session: any): Promise<string> {
  const result = await aiRouter.complete({
    feature: "intake_screening",
    systemPrompt: `You are a legal intake analyst. Generate a concise attorney-ready summary of this intake session.

Format:
**Client:** [name] | **Phone:** [phone] | **Email:** [email]
**Practice Area:** [area] | **Lead Grade:** [grade] ([score]/100)
**Summary:** [2-3 sentence overview]
**Key Facts:** [bullet list of important facts]
**Urgency:** [level + reason if elevated]
**Recommended Next Steps:** [1-2 specific actions]`,
    userPrompt: `Practice area: ${session.practiceArea}
Extracted data: ${JSON.stringify(session.extractedData)}
Contact info: ${JSON.stringify(session.contactInfo)}
Lead score: ${session.leadScore}, Grade: ${session.leadGrade}
Urgency: ${session.urgencyLevel}
Conversation had ${session.messagesCount} messages.`,
    maxTokens: 1024,
    temperature: 0.2,
  });

  return result.content;
}

// ---------------------------------------------------------------------------
// 4. Session Management
// ---------------------------------------------------------------------------

export async function startSession(params: {
  firmId: string;
  source?: string;
  sourceDetail?: string;
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clientLanguage?: string;
}): Promise<{ sessionToken: string; welcomeMessage: string }> {
  const session = await (db as any).intakeSession.create({
    data: {
      firmId: params.firmId,
      source: params.source || "website_widget",
      sourceDetail: params.sourceDetail,
      referrerUrl: params.referrerUrl,
      utmSource: params.utmSource,
      utmMedium: params.utmMedium,
      utmCampaign: params.utmCampaign,
      clientLanguage: params.clientLanguage || "en",
      status: "active",
      conversationLog: [{
        role: "assistant",
        content: "Hello! I'm the intake assistant. I'll ask you a few questions to help our attorneys understand your situation. Everything you share is confidential. What brings you to us today?",
        timestamp: new Date().toISOString(),
      }],
      messagesCount: 1,
    },
  });

  return {
    sessionToken: session.sessionToken,
    welcomeMessage: "Hello! I'm the intake assistant. I'll ask you a few questions to help our attorneys understand your situation. Everything you share is confidential. What brings you to us today?",
  };
}

export async function endSession(sessionToken: string): Promise<any> {
  const session = await (db as any).intakeSession.findUnique({
    where: { sessionToken },
  });
  if (!session) throw new Error("Session not found");

  // Calculate lead score
  const { score, grade, factors } = calculateLeadScore(
    session.extractedData || {},
    session.practiceArea || "general",
    session.conversationLog || [],
  );

  // Generate AI summary
  let summary = "";
  try {
    const sessionWithScore = { ...session, leadScore: score, leadGrade: grade };
    summary = await generateIntakeSummary(sessionWithScore);
  } catch {
    summary = `Lead: ${grade} grade (${score}/100). Practice area: ${session.practiceArea || "unknown"}.`;
  }

  // Determine status
  const status = score >= 40 ? "qualified" : "disqualified";

  // Route to attorney
  let assignedTo: string | undefined;
  let assignedToName: string | undefined;
  let routingReason: string | undefined;

  try {
    const rules = await (db as any).intakeRoutingRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });

    for (const rule of rules) {
      const matchesPractice = !rule.practiceArea || rule.practiceArea === session.practiceArea;
      const conditions = rule.conditions || {};
      const matchesGrade = !conditions.minLeadGrade || grade <= conditions.minLeadGrade;

      if (matchesPractice && matchesGrade && rule.currentLeadCount < rule.maxActiveLeads) {
        assignedTo = rule.assignToUserId || undefined;
        assignedToName = rule.assignToName;
        routingReason = `Matched routing rule: ${rule.name}`;

        // Update lead count
        await (db as any).intakeRoutingRule.update({
          where: { id: rule.id },
          data: { currentLeadCount: rule.currentLeadCount + 1 },
        });
        break;
      }
    }
  } catch { /* routing is optional */ }

  // Update session
  const updated = await (db as any).intakeSession.update({
    where: { sessionToken },
    data: {
      status,
      leadScore: score,
      leadGrade: grade,
      scoringBreakdown: factors,
      aiSummary: summary,
      assignedTo,
      assignedToName,
      routingReason,
      completedAt: new Date(),
    },
  });

  return updated;
}

export async function submitContactInfo(sessionToken: string, contactInfo: any): Promise<any> {
  return (db as any).intakeSession.update({
    where: { sessionToken },
    data: {
      contactInfo,
      extractedData: {
        ...((await (db as any).intakeSession.findUnique({ where: { sessionToken } }))?.extractedData || {}),
        contactInfo,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 5. Conflict Check (Simple)
// ---------------------------------------------------------------------------

export async function performConflictCheck(session: any): Promise<{
  hasConflict: boolean;
  conflictDetails?: string;
  checkedAgainst: string[];
}> {
  const checkedAgainst: string[] = [];
  const extracted = session.extractedData || {};
  const contact = session.contactInfo || extracted.contactInfo || {};

  // Get opposing party names from extracted data
  const opposingNames: string[] = [];
  if (extracted.opposingParty) opposingNames.push(extracted.opposingParty);
  if (extracted.opposingPartyName) opposingNames.push(extracted.opposingPartyName);
  if (extracted.spouseName) opposingNames.push(extracted.spouseName);

  if (opposingNames.length === 0 && !contact.lastName) {
    return { hasConflict: false, checkedAgainst: [] };
  }

  // Check against existing matters
  try {
    const matters = await db.matter.findMany({
      select: { id: true, name: true },
      take: 500,
    });

    for (const matter of matters) {
      checkedAgainst.push(matter.name);
      for (const name of opposingNames) {
        if (matter.name.toLowerCase().includes(name.toLowerCase())) {
          return {
            hasConflict: true,
            conflictDetails: `Potential conflict: opposing party "${name}" appears in existing matter "${matter.name}"`,
            checkedAgainst,
          };
        }
      }
    }
  } catch { /* matters table may not be accessible */ }

  return { hasConflict: false, checkedAgainst };
}

// ---------------------------------------------------------------------------
// 6. Conversion to Matter
// ---------------------------------------------------------------------------

export async function convertToMatter(sessionId: string): Promise<{ matterId: string }> {
  const session = await (db as any).intakeSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error("Session not found");

  const contact = session.contactInfo || session.extractedData?.contactInfo || {};
  const extracted = session.extractedData || {};

  const clientName = contact.firstName && contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.fullName || "New Client";

  const matterName = `${clientName} — ${(session.practiceArea || "General").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}`;

  // Create client
  let client;
  try {
    client = await db.client.create({
      data: {
        name: clientName,
        email: contact.email,
        phone: contact.phone,
        notes: `Intake source: ${session.source}. ${session.aiSummary || ""}`.substring(0, 2000),
      },
    });
  } catch {
    // Use a default placeholder
    client = { id: "default-client" };
  }

  // Create matter
  let matter;
  try {
    matter = await db.matter.create({
      data: {
        clientId: client.id,
        name: matterName,
        description: session.aiSummary || `Converted from intake session. Practice area: ${session.practiceArea}`,
        matterNumber: `INT-${Date.now().toString(36).toUpperCase()}`,
        practiceArea: session.practiceArea,
      },
    });
  } catch {
    matter = { id: `matter-${Date.now()}` };
  }

  // Update session
  await (db as any).intakeSession.update({
    where: { id: sessionId },
    data: {
      status: "converted",
      convertedMatterId: matter.id,
    },
  });

  return { matterId: matter.id };
}

// ---------------------------------------------------------------------------
// 7. Default Screening Flows
// ---------------------------------------------------------------------------

export function getDefaultFlows(): any[] {
  return [
    {
      name: "PI — Auto Accident Screening",
      practiceArea: "personal_injury",
      subCategory: "auto_accident",
      isDefault: true,
      welcomeMessage: "Hi there! I'm the intake assistant. I'm sorry to hear you may have been in an accident. I'll ask you a few questions to help our attorneys understand your situation. Everything you share is confidential. Let's start — can you tell me what happened?",
      questions: [
        { id: "incident_description", text: "Can you tell me what happened?", type: "free_text", category: "incident", required: true, scoreWeight: 0 },
        { id: "incident_date", text: "When did the accident happen?", type: "date", category: "incident", required: true, scoreWeight: 5 },
        { id: "incident_location", text: "Where did the accident take place?", type: "text", category: "incident", required: true, scoreWeight: 0 },
        { id: "at_fault", text: "In your view, who was at fault?", type: "single_choice", category: "incident", required: true, scoreWeight: 8, options: [{ value: "other_driver", label: "The other driver", score: 20 }, { value: "shared", label: "Both of us", score: 5 }, { value: "me", label: "I may have been at fault", score: -10 }, { value: "unsure", label: "I'm not sure", score: 0 }] },
        { id: "police_report", text: "Was a police report filed?", type: "yes_no", category: "incident", scoreWeight: 3 },
        { id: "injuries", text: "Were you injured? Describe your injuries.", type: "free_text", category: "injury", required: true, scoreWeight: 7 },
        { id: "medical_treatment", text: "Have you seen a doctor?", type: "single_choice", category: "medical", scoreWeight: 7, options: [{ value: "er_and_ongoing", label: "ER + ongoing treatment", score: 15 }, { value: "doctor_only", label: "Yes, seeing a doctor", score: 12 }, { value: "er_only", label: "ER but no follow-up", score: 8 }, { value: "not_yet", label: "Not yet", score: 3 }, { value: "no", label: "No plans to", score: -5 }] },
        { id: "prior_attorney", text: "Have you spoken with another attorney?", type: "yes_no", category: "legal", scoreWeight: 5 },
        { id: "contact_name", text: "May I get your name?", type: "text", category: "contact", required: true },
        { id: "contact_phone", text: "Best phone number?", type: "phone", category: "contact", required: true },
        { id: "contact_email", text: "Email address?", type: "email", category: "contact", required: true },
      ],
      qualificationRules: { minScore: 40, autoQualifyScore: 70 },
      closingMessageQualified: "Thank you! Based on what you've shared, our attorneys can help. Someone will contact you soon. In the meantime: follow your doctor's plan, don't give recorded statements to insurance, and keep all receipts.",
      closingMessageUnqualified: "Thank you for sharing your situation. This may not be something our firm handles, but we recommend contacting your local bar association for assistance.",
    },
    {
      name: "Immigration — Visa & Status Screening",
      practiceArea: "immigration",
      subCategory: "visa",
      isDefault: true,
      welcomeMessage: "Hello! I'm the intake assistant for our immigration practice. I can help our attorneys understand your situation. Everything is confidential. What brings you to us today?",
      questions: [
        { id: "situation_description", text: "Describe your immigration situation.", type: "free_text", category: "incident", required: true },
        { id: "current_status", text: "What is your current immigration status?", type: "single_choice", category: "legal", required: true, scoreWeight: 5, options: [{ value: "h1b", label: "H-1B", score: 10 }, { value: "f1", label: "F-1 Student", score: 8 }, { value: "green_card", label: "Green Card", score: 10 }, { value: "tourist_b1b2", label: "B-1/B-2", score: 5 }, { value: "daca", label: "DACA", score: 7 }, { value: "undocumented", label: "Undocumented", score: 3 }, { value: "other", label: "Other", score: 5 }] },
        { id: "visa_expiration", text: "When does your status expire?", type: "date", category: "urgency", required: true, scoreWeight: 5 },
        { id: "employer_sponsor", text: "Do you have an employer willing to sponsor?", type: "yes_no", category: "legal", scoreWeight: 4 },
        { id: "removal_proceedings", text: "Are you in removal proceedings?", type: "yes_no", category: "urgency", scoreWeight: 8 },
        { id: "prior_denials", text: "Any prior visa denials?", type: "yes_no", category: "legal", scoreWeight: 3 },
        { id: "contact_name", text: "May I get your name?", type: "text", category: "contact", required: true },
        { id: "contact_phone", text: "Best phone number?", type: "phone", category: "contact", required: true },
        { id: "contact_email", text: "Email address?", type: "email", category: "contact", required: true },
      ],
      qualificationRules: { minScore: 35, autoQualifyScore: 65 },
      emergencyProtocol: { triggers: ["removal_proceedings=yes"], action: "immediate_notification", message: "URGENT: Potential removal case" },
      closingMessageQualified: "Thank you! An immigration attorney will review your case and contact you soon.",
      closingMessageUnqualified: "Thank you for sharing. We recommend consulting with a local immigration legal aid organization.",
    },
    {
      name: "Family Law — Divorce Screening",
      practiceArea: "family_law",
      subCategory: "divorce",
      isDefault: true,
      welcomeMessage: "Hello, I'm the intake assistant for our family law practice. I understand this may be a difficult time. I'll ask a few questions so we can best assist you. Everything is confidential.",
      questions: [
        { id: "situation", text: "Tell me about your situation.", type: "free_text", category: "incident", required: true },
        { id: "married_duration", text: "How long married?", type: "text", category: "incident" },
        { id: "children", text: "Do you have children?", type: "single_choice", category: "incident", scoreWeight: 3, options: [{ value: "yes_minor", label: "Yes, under 18", score: 5 }, { value: "yes_adult", label: "Yes, over 18", score: 2 }, { value: "no", label: "No", score: 0 }] },
        { id: "contested", text: "Will your spouse agree to terms?", type: "single_choice", category: "legal", scoreWeight: 5, options: [{ value: "contested", label: "We disagree on major issues", score: 10 }, { value: "somewhat", label: "Agree on some things", score: 7 }, { value: "uncontested", label: "We mostly agree", score: 5 }] },
        { id: "domestic_violence", text: "Any safety concerns or domestic violence?", type: "yes_no", category: "urgency", scoreWeight: 10 },
        { id: "assets", text: "Significant assets to divide?", type: "single_choice", category: "financial", scoreWeight: 5, options: [{ value: "significant", label: "Yes, significant", score: 10 }, { value: "moderate", label: "Some", score: 5 }, { value: "minimal", label: "Minimal", score: 2 }] },
        { id: "spouse_attorney", text: "Has your spouse hired an attorney?", type: "yes_no", category: "urgency", scoreWeight: 4 },
        { id: "contact_name", text: "May I get your name?", type: "text", category: "contact", required: true },
        { id: "contact_phone", text: "Best phone number?", type: "phone", category: "contact", required: true },
        { id: "contact_email", text: "Email address?", type: "email", category: "contact", required: true },
      ],
      qualificationRules: { minScore: 35, autoQualifyScore: 60 },
      emergencyProtocol: { triggers: ["domestic_violence=yes"], action: "immediate_notification", urgencyOverride: "emergency", message: "EMERGENCY: DV situation — contact ASAP" },
      closingMessageQualified: "Thank you. A family law attorney will contact you to discuss your options.",
      closingMessageUnqualified: "Thank you for sharing. We recommend consulting your local bar association.",
    },
  ];
}

// ---------------------------------------------------------------------------
// 8. Sample Sessions for Demo
// ---------------------------------------------------------------------------

export function getSampleSessions(): any[] {
  return [
    {
      id: "sample-session-1",
      sessionToken: "sample-token-1",
      firmId: "default",
      status: "qualified",
      practiceArea: "personal_injury",
      subCategory: "auto_accident",
      source: "website_widget",
      contactInfo: { firstName: "Maria", lastName: "Garcia", email: "maria.garcia@email.com", phone: "(555) 234-5678", bestTimeToCall: "afternoon" },
      extractedData: { incidentDate: "2026-02-15", location: "Route 110 & Main St, Farmingdale NY", atFault: "other_driver", policeReport: "yes", injuries: "Herniated disc L4-L5, cervical strain", medicalTreatment: "er_and_ongoing", priorAttorney: "no", insuranceCompany: "State Farm" },
      aiSummary: "**Client:** Maria Garcia | **Phone:** (555) 234-5678 | **Email:** maria.garcia@email.com\n**Practice Area:** Personal Injury (Auto) | **Lead Grade:** A (85/100)\n**Summary:** Rear-end collision on 2/15/2026, other driver at fault per police report. Client has documented herniated disc with ongoing orthopedic treatment. Insurance identified as State Farm. No prior attorney.\n**Key Facts:** Clear liability, documented injuries with MRI, active treatment, police report filed, insurance identified\n**Urgency:** Normal\n**Recommended Next Steps:** Schedule consultation within 24 hours. Request police report and medical records.",
      leadScore: 85,
      leadGrade: "A",
      scoringBreakdown: [
        { factor: "Clear Liability", points: 20, description: "Other party at fault" },
        { factor: "Documented Injuries", points: 15, description: "Herniated disc documented" },
        { factor: "Active Treatment", points: 15, description: "ER + ongoing orthopedic care" },
        { factor: "Police Report", points: 5, description: "Incident documented" },
        { factor: "No Prior Attorney", points: 10, description: "First consultation" },
        { factor: "Insurance Identified", points: 5, description: "State Farm" },
        { factor: "Contact Info", points: 5, description: "Full contact provided" },
        { factor: "High Engagement", points: 5, description: "Detailed conversation" },
      ],
      urgencyLevel: "normal",
      assignedToName: "Jacob Rubinstein",
      messagesCount: 22,
      completedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: "sample-session-2",
      sessionToken: "sample-token-2",
      firmId: "default",
      status: "qualified",
      practiceArea: "immigration",
      source: "google_ads",
      contactInfo: { firstName: "Raj", lastName: "Patel", email: "raj.patel@email.com", phone: "(555) 345-6789" },
      extractedData: { currentStatus: "h1b", visaExpiration: "2026-07-15", employerSponsor: "yes", removalProceedings: "no", priorDenials: "no" },
      aiSummary: "**Client:** Raj Patel | **Lead Grade:** B (64/100)\n**Summary:** H-1B holder, visa expires in 4 months, employer willing to sponsor green card. Clean record.\n**Recommended:** Schedule consultation, begin EB-2/EB-3 evaluation.",
      leadScore: 64,
      leadGrade: "B",
      scoringBreakdown: [
        { factor: "Valid Status", points: 10, description: "H-1B holder" },
        { factor: "Employer Sponsor", points: 15, description: "Employer willing" },
        { factor: "No Prior Denials", points: 10, description: "Clean history" },
        { factor: "Contact Info", points: 5, description: "Provided" },
      ],
      urgencyLevel: "normal",
      assignedToName: "Jacob Rubinstein",
      messagesCount: 16,
      completedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 25 * 3600000).toISOString(),
    },
    {
      id: "sample-session-3",
      sessionToken: "sample-token-3",
      firmId: "default",
      status: "needs_review",
      practiceArea: "family_law",
      source: "website_widget",
      contactInfo: { firstName: "Sarah", lastName: "Johnson", email: "sarah.j@email.com", phone: "(555) 456-7890" },
      extractedData: { marriedDuration: "3 years", children: "no", contested: "uncontested", assets: "minimal", domesticViolence: "no" },
      aiSummary: "**Client:** Sarah Johnson | **Lead Grade:** C (42/100)\n**Summary:** Considering uncontested divorce, 3 years married, no children, minimal assets.\n**Recommended:** May qualify for simplified procedure. Low-complexity matter.",
      leadScore: 42,
      leadGrade: "C",
      scoringBreakdown: [
        { factor: "Contact Info", points: 5, description: "Provided" },
        { factor: "Engagement", points: 5, description: "Moderate" },
      ],
      urgencyLevel: "low",
      messagesCount: 12,
      completedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 49 * 3600000).toISOString(),
    },
  ];
}
