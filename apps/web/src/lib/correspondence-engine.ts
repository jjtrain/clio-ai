import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// Context Gathering
// ---------------------------------------------------------------------------

export async function gatherMatterContext(matterId: string) {
  try {
    const matter = await db.matter.findUnique({
      where: { id: matterId },
      include: {
        client: true,
        relatedParties: true,
        events: true,
        tasks: true,
      } as any,
    });
    if (!matter) return null;
    return {
      matterName: (matter as any).name || matter.description,
      caseNumber: (matter as any).matterNumber,
      practiceArea: (matter as any).practiceArea || "general",
      status: matter.status,
      clientName:
        (matter as any).client?.name ||
        (matter as any).client?.firstName +
          " " +
          (matter as any).client?.lastName,
      parties: ((matter as any).relatedParties || []).map((p: any) => ({
        name: p.name,
        role: p.role,
        firm: p.firm,
      })),
      upcomingEvents: ((matter as any).events || [])
        .filter((e: any) => new Date(e.startTime) > new Date())
        .slice(0, 5),
      recentTasks: ((matter as any).tasks || []).slice(-5),
      openDate: matter.openDate,
    };
  } catch {
    return null;
  }
}

export async function gatherContactHistory(
  matterId: string,
  recipientType: string,
) {
  try {
    const drafts = await (db as any).correspondenceDraft.findMany({
      where: { matterId, recipientType, status: "sent" },
      orderBy: { sentAt: "desc" },
      take: 5,
    });
    return drafts;
  } catch {
    return [];
  }
}

export async function gatherCourtContext(courtId: string) {
  try {
    const rules =
      (await (db as any).courtFilingRule?.findMany?.({
        where: { courtId },
        take: 10,
      })) || [];
    return { courtId, rules };
  } catch {
    return { courtId, rules: [] };
  }
}

export async function gatherDeadlineContext(matterId: string) {
  try {
    const events = await db.calendarEvent.findMany({
      where: {
        matterId,
        startTime: { gte: new Date() },
        eventType: {
          in: ["matter_deadline", "court_filing", "statute_tracker"],
        },
      } as any,
      orderBy: { startTime: "asc" },
      take: 10,
    });
    return events;
  } catch {
    return [];
  }
}

export async function buildPromptContext(
  matterId: string,
  correspondenceType: string,
  recipientType: string,
) {
  const [matter, history, deadlines] = await Promise.all([
    gatherMatterContext(matterId),
    gatherContactHistory(matterId, recipientType),
    gatherDeadlineContext(matterId),
  ]);

  let contextBlock = `## Matter Context\n`;
  if (matter) {
    contextBlock += `- Case: ${matter.matterName} (${matter.caseNumber})\n`;
    contextBlock += `- Practice Area: ${matter.practiceArea}\n`;
    contextBlock += `- Status: ${matter.status}\n`;
    contextBlock += `- Client: ${matter.clientName}\n`;
    if (matter.parties.length > 0) {
      contextBlock += `- Parties:\n${matter.parties.map((p: any) => `  - ${p.name} (${p.role}${p.firm ? `, ${p.firm}` : ""})`).join("\n")}\n`;
    }
  }
  if (deadlines.length > 0) {
    contextBlock += `\n## Upcoming Deadlines\n${deadlines.map((d: any) => `- ${d.title}: ${new Date(d.startTime).toLocaleDateString()}`).join("\n")}\n`;
  }
  if (history.length > 0) {
    contextBlock += `\n## Previous Correspondence\n${history.map((h: any) => `- ${new Date(h.sentAt).toLocaleDateString()}: ${h.subject || h.correspondenceType}`).join("\n")}\n`;
  }
  return { context: contextBlock, matter, history, deadlines };
}

// ---------------------------------------------------------------------------
// AI Drafting Functions
// ---------------------------------------------------------------------------

export async function getLetterhead(userId: string, firmId: string) {
  try {
    const lh = await (db as any).firmLetterhead.findFirst({
      where: { userId, isDefault: true },
    });
    return (
      lh || {
        firmName: "Rubinstein Law Firm",
        attorneyName: "Jacob Rubinstein, Esq.",
        address: "Woodmere, NY",
        phone: "(555) 000-0000",
        email: "jrubinstein@rubinsteinlaw.com",
      }
    );
  } catch {
    return {
      firmName: "Rubinstein Law Firm",
      attorneyName: "Jacob Rubinstein, Esq.",
      address: "Woodmere, NY",
      phone: "(555) 000-0000",
      email: "jrubinstein@rubinsteinlaw.com",
    };
  }
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional:
    "Use a balanced, business-like tone. Be clear and direct while remaining courteous.",
  firm: "Use an assertive, direct tone. Be strong in your positions without being hostile.",
  cordial:
    "Use a warm, relationship-building tone. Be friendly while maintaining professionalism.",
  urgent:
    "Emphasize time-sensitivity. Use action-requiring language. Be clear about deadlines.",
  sympathetic:
    "Use an understanding, supportive tone. Show empathy while being professional.",
  formal_court:
    "Use strict judicial conventions. Be highly formal, precise, and deferential to the court.",
};

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  email:
    "Format as a professional email with Subject line, greeting, body paragraphs, closing, and signature block.",
  letter:
    "Format as a formal business letter with date, recipient address block, RE: line, salutation, body paragraphs, closing, and signature block.",
  filing_cover:
    "Format as a court filing cover letter with case caption (case name, index/docket number, court), list of enclosed documents, body, certificate of service, and signature block.",
};

export async function generateDraft(params: {
  matterId: string;
  correspondenceType: string;
  recipientType: string;
  tone?: string;
  format?: string;
  additionalInstructions?: string;
  recipientName?: string;
  recipientFirm?: string;
  userId: string;
  firmId: string;
}) {
  const { context, matter } = await buildPromptContext(
    params.matterId,
    params.correspondenceType,
    params.recipientType,
  );
  const letterhead = await getLetterhead(params.userId, params.firmId);
  const tone = params.tone || "professional";
  const format = params.format || "email";

  const systemPrompt = `You are a legal correspondence assistant for ${(letterhead as any).firmName}. Draft professional legal correspondence based on the provided matter context.

## Your Firm
- Firm: ${(letterhead as any).firmName}
- Attorney: ${(letterhead as any).attorneyName}
- Address: ${(letterhead as any).address}
- Phone: ${(letterhead as any).phone}
- Email: ${(letterhead as any).email}

## Tone
${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}

## Format
${FORMAT_INSTRUCTIONS[format] || FORMAT_INSTRUCTIONS.email}

## Important Rules
- Use proper legal formatting and conventions
- Reference the case by name and number where appropriate
- Do not fabricate specific facts, dates, or dollar amounts — use [VERIFY] placeholders where attorney should confirm
- Include all standard legal correspondence elements for this type
- Be concise but thorough`;

  const userPrompt = `Draft a ${params.correspondenceType.replace(/_/g, " ")} ${format === "email" ? "email" : "letter"} for the following matter.

${context}

Recipient: ${params.recipientName || params.recipientType.replace(/_/g, " ")}${params.recipientFirm ? ` at ${params.recipientFirm}` : ""}

${params.additionalInstructions ? `Additional instructions: ${params.additionalInstructions}` : ""}

Generate the complete ${format === "email" ? "email" : "letter"} now, including subject/RE line.`;

  const result = await aiRouter.complete({
    feature: "correspondence",
    systemPrompt,
    userPrompt,
  });

  // Parse subject from generated text
  const lines = result.content.split("\n");
  let subject = "";
  let body = result.content;
  for (const line of lines) {
    if (
      line.toLowerCase().startsWith("subject:") ||
      line.toLowerCase().startsWith("re:")
    ) {
      subject = line.replace(/^(subject|re):\s*/i, "").trim();
      body = result.content.replace(line, "").trim();
      break;
    }
  }

  // Save to DB
  const draft = await (db as any).correspondenceDraft.create({
    data: {
      matterId: params.matterId,
      matterName: matter?.matterName,
      correspondenceType: params.correspondenceType,
      recipientType: params.recipientType,
      recipientName: params.recipientName,
      recipientFirm: params.recipientFirm,
      subject,
      body,
      tone,
      format,
      status: "draft",
      aiPromptUsed: userPrompt,
      aiContextSummary: context,
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  return draft;
}

export async function regenerateDraft(draftId: string, feedback?: string) {
  const original = await (db as any).correspondenceDraft.findUnique({
    where: { id: draftId },
  });
  if (!original) throw new Error("Draft not found");

  const { context } = await buildPromptContext(
    original.matterId,
    original.correspondenceType,
    original.recipientType,
  );
  const letterhead = await getLetterhead(original.userId, original.firmId);

  const systemPrompt = `You are a legal correspondence assistant for ${(letterhead as any).firmName}. You previously drafted a ${original.correspondenceType.replace(/_/g, " ")} that needs revision.

## Tone: ${TONE_INSTRUCTIONS[original.tone] || TONE_INSTRUCTIONS.professional}
## Format: ${FORMAT_INSTRUCTIONS[original.format] || FORMAT_INSTRUCTIONS.email}`;

  const userPrompt = `Here is the original draft:

${original.editedBody || original.body}

${context}

${feedback ? `Attorney feedback: ${feedback}` : "Please improve this draft."}

Generate the revised ${original.format === "email" ? "email" : "letter"} now.`;

  const result = await aiRouter.complete({
    feature: "correspondence",
    systemPrompt,
    userPrompt,
  });

  const newDraft = await (db as any).correspondenceDraft.create({
    data: {
      matterId: original.matterId,
      matterName: original.matterName,
      correspondenceType: original.correspondenceType,
      recipientType: original.recipientType,
      recipientName: original.recipientName,
      recipientEmail: original.recipientEmail,
      recipientFirm: original.recipientFirm,
      subject: original.subject,
      body: result.content,
      tone: original.tone,
      format: original.format,
      status: "draft",
      aiPromptUsed: userPrompt,
      aiContextSummary: original.aiContextSummary,
      parentDraftId: draftId,
      version: (original.version || 1) + 1,
      userId: original.userId,
      firmId: original.firmId,
    },
  });

  return newDraft;
}

export async function generateVariants(params: {
  matterId: string;
  correspondenceType: string;
  recipientType: string;
  recipientName?: string;
  recipientFirm?: string;
  userId: string;
  firmId: string;
}) {
  const tones = ["professional", "firm", "cordial"];
  const drafts = await Promise.all(
    tones.map((tone) => generateDraft({ ...params, tone })),
  );
  return drafts;
}

export async function quickDraft(params: {
  matterId?: string;
  freeformInstruction: string;
  userId: string;
  firmId: string;
}) {
  // Use AI to parse intent from freeform instruction
  const parseResult = await aiRouter.complete({
    feature: "correspondence",
    systemPrompt: "You parse legal correspondence requests. Return JSON only.",
    userPrompt: `Parse this request into structured parameters. Return JSON: { "correspondenceType": "opposing_counsel_letter|client_update_email|court_filing_cover|demand_letter|settlement_offer|scheduling_letter|custom", "recipientType": "opposing_counsel|client|court_clerk|judge|insurance_adjuster|custom", "tone": "professional|firm|cordial|urgent|sympathetic|formal_court", "format": "email|letter|filing_cover", "additionalInstructions": "extracted specific details" }

Request: "${params.freeformInstruction}"`,
  });

  let parsed;
  try {
    parsed = JSON.parse(parseResult.content);
  } catch {
    parsed = {
      correspondenceType: "custom",
      recipientType: "custom",
      tone: "professional",
      format: "email",
      additionalInstructions: params.freeformInstruction,
    };
  }

  return generateDraft({
    matterId: params.matterId || "unknown",
    correspondenceType: parsed.correspondenceType,
    recipientType: parsed.recipientType,
    tone: parsed.tone,
    format: parsed.format,
    additionalInstructions:
      parsed.additionalInstructions || params.freeformInstruction,
    userId: params.userId,
    firmId: params.firmId,
  });
}

// ---------------------------------------------------------------------------
// Template Functions
// ---------------------------------------------------------------------------

export async function getTemplatesForType(
  correspondenceType: string,
  practiceArea?: string,
) {
  try {
    const where: any = { correspondenceType };
    if (practiceArea) where.practiceArea = practiceArea;
    return await (db as any).correspondenceTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function saveAsTemplate(
  draftId: string,
  name: string,
  practiceArea?: string,
) {
  const draft = await (db as any).correspondenceDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) throw new Error("Draft not found");
  return (db as any).correspondenceTemplate.create({
    data: {
      name,
      correspondenceType: draft.correspondenceType,
      recipientType: draft.recipientType,
      tone: draft.tone,
      format: draft.format,
      promptTemplate: draft.aiPromptUsed || "",
      bodyTemplate: draft.editedBody || draft.body,
      practiceArea: practiceArea || null,
      isDefault: false,
      isShared: true,
      userId: draft.userId,
      firmId: draft.firmId,
    },
  });
}

export function getDefaultTemplates() {
  return [
    {
      name: "Meet and Confer",
      correspondenceType: "opposing_counsel_letter",
      recipientType: "opposing_counsel",
      tone: "professional",
      format: "letter",
      practiceArea: "general",
      promptTemplate:
        "Draft a meet and confer letter regarding the discovery dispute in this matter. Reference the relevant discovery requests/responses at issue. Propose specific dates for a conference. Mention the court's requirement for meet and confer before filing a motion to compel.",
    },
    {
      name: "Extension Request",
      correspondenceType: "opposing_counsel_letter",
      recipientType: "opposing_counsel",
      tone: "cordial",
      format: "letter",
      practiceArea: "general",
      promptTemplate:
        "Draft a letter requesting an extension for the upcoming deadline in this matter. Provide a reasonable explanation. Propose a new deadline. Note willingness to reciprocate. Reference any applicable court rules on stipulated extensions.",
    },
    {
      name: "Case Status Update",
      correspondenceType: "client_update_email",
      recipientType: "client",
      tone: "professional",
      format: "email",
      practiceArea: "general",
      promptTemplate:
        "Draft a client update email summarizing recent activity in this matter. Explain next steps in plain language avoiding unnecessary legal jargon. Include upcoming dates the client should know about. End with an invitation to call with questions.",
    },
    {
      name: "Welcome New Client",
      correspondenceType: "client_update_email",
      recipientType: "client",
      tone: "cordial",
      format: "email",
      practiceArea: "general",
      promptTemplate:
        "Draft a welcome email to a new client. Thank them for choosing the firm. Outline what to expect in the coming weeks. List any documents or information needed from them. Provide direct contact information. Set expectations for communication frequency.",
    },
    {
      name: "Motion Cover Letter",
      correspondenceType: "court_filing_cover",
      recipientType: "court_clerk",
      tone: "formal_court",
      format: "filing_cover",
      practiceArea: "general",
      promptTemplate:
        "Draft a cover letter for filing a motion in this matter. Include the case caption with index/docket number. List enclosed documents. Include certificate of service.",
    },
    {
      name: "General Filing Cover",
      correspondenceType: "court_filing_cover",
      recipientType: "court_clerk",
      tone: "formal_court",
      format: "filing_cover",
      practiceArea: "general",
      promptTemplate:
        "Draft a cover letter for filing documents in this matter. Include proper case caption, list of enclosed documents, and certificate of service.",
    },
    {
      name: "PI Demand Letter",
      correspondenceType: "demand_letter",
      recipientType: "insurance_adjuster",
      tone: "firm",
      format: "letter",
      practiceArea: "personal_injury",
      promptTemplate:
        "Draft a demand letter. Outline liability facts. Summarize injuries and medical treatment. Detail economic damages (medical bills, lost wages) and non-economic damages. State the demand amount as [VERIFY: demand amount]. Set a response deadline of [VERIFY: response deadline]. Reference willingness to pursue litigation if not resolved.",
    },
    {
      name: "Settlement Offer",
      correspondenceType: "settlement_offer",
      recipientType: "opposing_counsel",
      tone: "professional",
      format: "letter",
      practiceArea: "general",
      promptTemplate:
        "Draft a settlement offer letter. Reference prior negotiations if any. State the proposed terms as [VERIFY: settlement terms]. Outline conditions and timeline for acceptance. Note this offer is made pursuant to settlement privilege and is inadmissible.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Formatting Functions
// ---------------------------------------------------------------------------

export function formatAsEmail(
  body: string,
  letterhead: any,
  subject: string,
  recipientName?: string,
) {
  return `Subject: ${subject}\n\nDear ${recipientName || "Counsel"},\n\n${body}\n\nSincerely,\n\n${letterhead.attorneyName}\n${letterhead.firmName}\n${letterhead.phone}\n${letterhead.email}`;
}

export function formatAsLetter(
  body: string,
  letterhead: any,
  recipientName?: string,
  recipientAddress?: string,
  subject?: string,
) {
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${letterhead.firmName}\n${letterhead.address}\n${letterhead.phone}\n${letterhead.email}\n\n${date}\n\n${recipientName || "[Recipient]"}\n${recipientAddress || "[Address]"}\n\nRe: ${subject || "[Case Reference]"}\n\nDear ${recipientName || "Counsel"}:\n\n${body}\n\nVery truly yours,\n\n${letterhead.attorneyName}\n${letterhead.firmName}`;
}

export function formatAsFilingCover(
  body: string,
  letterhead: any,
  courtName?: string,
  caseCaption?: string,
  caseNumber?: string,
) {
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${letterhead.firmName}\n${letterhead.address}\n${letterhead.phone}\n\n${date}\n\nClerk of the Court\n${courtName || "[Court Name]"}\n\nRe: ${caseCaption || "[Case Caption]"}\n    Index/Docket No.: ${caseNumber || "[Number]"}\n\nDear Clerk:\n\n${body}\n\nRespectfully submitted,\n\n${letterhead.attorneyName}\n${letterhead.firmName}`;
}
