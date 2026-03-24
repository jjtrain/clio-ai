import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";

// ==========================================
// AI STATUS UPDATE GENERATOR
// ==========================================

const STATUS_UPDATE_PROMPT = `You are a legal assistant helping an attorney write a case status update for their client portal. The client is NOT a lawyer — write in clear, plain English.

Rules:
- No legal jargon unless you also explain it in parentheses
- Be reassuring but honest
- Explain what happened, what it means, and what happens next
- Keep it 2-4 paragraphs
- Use "we" for the firm and "you/your" for the client
- Never share strategy, prediction scores, or internal assessments
- End with what the client should expect next

Return JSON: { "title": "...", "body": "...", "milestone": "..." }
Only return the JSON.`;

export async function generateStatusUpdateDraft(matterId: string, firmId: string): Promise<{
  title: string;
  body: string;
  milestone: string | null;
}> {
  // Gather recent activity
  const activities = await db.matterActivityLog.findMany({
    where: { matterId },
    orderBy: { occurredAt: "desc" },
    take: 10,
  });

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: { client: { select: { name: true } } },
  });

  if (!matter) throw new Error("Matter not found");

  const activitySummary = activities.map((a) =>
    `${new Date(a.occurredAt).toLocaleDateString()}: ${a.description}`
  ).join("\n");

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: STATUS_UPDATE_PROMPT,
      messages: [{
        role: "user",
        content: `Matter: ${matter.name}\nPractice Area: ${matter.practiceArea || "General"}\nClient: ${matter.client?.name}\n\nRecent Activity:\n${activitySummary}\n\nGenerate a status update for the client.`,
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return {
      title: json.title || "Case Update",
      body: json.body || "Your attorney will provide an update soon.",
      milestone: json.milestone || null,
    };
  } catch {
    return {
      title: "Case Update",
      body: "Your attorney is working on your case and will provide a detailed update soon.",
      milestone: null,
    };
  }
}

// ==========================================
// CLIENT CHECKLIST GENERATOR
// ==========================================

const CHECKLISTS: Record<string, Array<{ label: string; priority: string }>> = {
  personal_injury: [
    { label: "Photos of your injuries (all body parts affected)", priority: "asap" },
    { label: "Photos of vehicle damage", priority: "asap" },
    { label: "Copy of police/accident report", priority: "asap" },
    { label: "Insurance information (your policy and the other driver's)", priority: "asap" },
    { label: "Medical records and bills from all treating providers", priority: "when_can" },
    { label: "Proof of lost wages (pay stubs, employer letter)", priority: "when_can" },
    { label: "Prescription receipts", priority: "when_can" },
    { label: "List of all doctors and therapists you've seen", priority: "when_can" },
  ],
  family_law: [
    { label: "Last 3 years of tax returns (personal and business)", priority: "asap" },
    { label: "Last 6 months of bank statements (all accounts)", priority: "asap" },
    { label: "Retirement/pension account statements", priority: "asap" },
    { label: "Real estate documents (deed, mortgage, appraisal)", priority: "when_can" },
    { label: "Most recent pay stubs (4-6 weeks)", priority: "asap" },
    { label: "List of monthly expenses", priority: "when_can" },
    { label: "Life insurance and health insurance policies", priority: "when_can" },
    { label: "Vehicle titles and loan statements", priority: "when_can" },
    { label: "Business financial statements (if applicable)", priority: "optional" },
    { label: "Prenuptial or postnuptial agreement (if applicable)", priority: "optional" },
  ],
  immigration: [
    { label: "Valid passport (all pages with stamps)", priority: "asap" },
    { label: "Current visa/I-94", priority: "asap" },
    { label: "Previous immigration applications and approvals", priority: "asap" },
    { label: "Employment verification letter from sponsor", priority: "when_can" },
    { label: "Educational credentials and evaluations", priority: "when_can" },
    { label: "Birth certificate (with certified translation if not in English)", priority: "when_can" },
    { label: "Marriage certificate (if applicable)", priority: "optional" },
    { label: "Tax returns (last 3 years)", priority: "when_can" },
    { label: "Passport-style photos (2x2 inches)", priority: "when_can" },
  ],
  corporate: [
    { label: "Corporate formation documents", priority: "asap" },
    { label: "Operating agreements / Bylaws", priority: "asap" },
    { label: "Financial statements (last 3 years)", priority: "when_can" },
    { label: "Existing contracts relevant to the engagement", priority: "when_can" },
    { label: "Regulatory filings and licenses", priority: "when_can" },
    { label: "Cap table / Shareholder information", priority: "optional" },
  ],
  real_estate: [
    { label: "Purchase/sale contract", priority: "asap" },
    { label: "Property deed", priority: "asap" },
    { label: "Mortgage pre-approval letter", priority: "asap" },
    { label: "Home inspection report", priority: "when_can" },
    { label: "Title insurance commitment", priority: "when_can" },
    { label: "Homeowner's insurance policy", priority: "when_can" },
    { label: "Survey/plot plan", priority: "optional" },
  ],
  estate: [
    { label: "Death certificate (certified copies)", priority: "asap" },
    { label: "Original will and/or trust documents", priority: "asap" },
    { label: "List of assets and account numbers", priority: "asap" },
    { label: "List of debts and creditors", priority: "when_can" },
    { label: "Life insurance policies", priority: "when_can" },
    { label: "Real estate deeds", priority: "when_can" },
    { label: "Vehicle titles", priority: "when_can" },
    { label: "Most recent tax return of the deceased", priority: "when_can" },
  ],
};

export function generateClientChecklist(practiceArea: string): Array<{ id: string; label: string; priority: string; isCompleted: boolean }> {
  const key = practiceArea.toLowerCase().replace(/\s+/g, "_");
  const items = CHECKLISTS[key] || CHECKLISTS.personal_injury;

  return items.map((item, i) => ({
    id: `item-${i + 1}`,
    label: item.label,
    priority: item.priority,
    isCompleted: false,
  }));
}

// ==========================================
// NOTIFICATION ENGINE
// ==========================================

export async function notifyClient(params: {
  portalUserId: string;
  matterId?: string;
  type: string;
  title: string;
  body: string;
  linkTo?: string;
}): Promise<void> {
  // Create portal notification
  await db.portalNotification.create({
    data: {
      portalUserId: params.portalUserId,
      matterId: params.matterId,
      type: params.type,
      title: params.title,
      body: params.body,
      linkTo: params.linkTo,
    },
  });

  // TODO: Check notification prefs and send email/SMS if enabled
}

export async function notifyNewMessage(portalUserId: string, matterId: string, senderName: string) {
  await notifyClient({
    portalUserId,
    matterId,
    type: "message",
    title: `New message from ${senderName}`,
    body: `You have a new message from your attorney. Log in to view it.`,
    linkTo: `/portal/matter/${matterId}/messages`,
  });
}

export async function notifyDocumentShared(portalUserId: string, matterId: string, documentName: string) {
  await notifyClient({
    portalUserId,
    matterId,
    type: "document",
    title: "New document shared",
    body: `A new document "${documentName}" has been shared with you.`,
    linkTo: `/portal/matter/${matterId}/documents`,
  });
}

export async function notifyStatusUpdate(portalUserId: string, matterId: string, updateTitle: string) {
  await notifyClient({
    portalUserId,
    matterId,
    type: "status_update",
    title: "Case status update",
    body: updateTitle,
    linkTo: `/portal/matter/${matterId}`,
  });
}

export async function notifyInvoiceReady(portalUserId: string, matterId: string, amount: string) {
  await notifyClient({
    portalUserId,
    matterId,
    type: "invoice",
    title: "New invoice available",
    body: `A new invoice for ${amount} is ready for your review.`,
    linkTo: `/portal/matter/${matterId}/billing`,
  });
}

export async function notifySignatureNeeded(portalUserId: string, matterId: string, documentName: string) {
  await notifyClient({
    portalUserId,
    matterId,
    type: "signature",
    title: "Signature requested",
    body: `Please sign "${documentName}" at your earliest convenience.`,
    linkTo: `/portal/matter/${matterId}/documents`,
  });
}

// ==========================================
// MAGIC LINK AUTH
// ==========================================

export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

// ==========================================
// ANALYTICS
// ==========================================

export async function getPortalAnalytics(firmId: string): Promise<{
  totalAccounts: number;
  activeClients: number;
  messagesSent: number;
  documentsShared: number;
  avgSatisfaction: number;
}> {
  const totalAccounts = await db.clientPortalUser.count({ where: { firmId } });
  const activeClients = await db.clientPortalUser.count({
    where: { firmId, isActive: true, lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });
  const messagesSent = await db.clientPortalMessage.count();
  const documentsShared = await db.portalDocument.count({ where: { firmId } });

  const feedback = await db.portalFeedback.aggregate({
    where: { firmId, ratingType: "satisfaction" },
    _avg: { score: true },
  });

  return {
    totalAccounts,
    activeClients,
    messagesSent,
    documentsShared,
    avgSatisfaction: feedback._avg.score || 0,
  };
}
