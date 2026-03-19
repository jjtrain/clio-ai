import { db } from "@/lib/db";
import * as gmail from "@/lib/integrations/gmail";
import * as outlook from "@/lib/integrations/outlook";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const AI_MODEL = "claude-sonnet-4-20250514";

type Provider = "GMAIL" | "OUTLOOK";

function getProvider(provider: Provider) {
  return provider === "GMAIL" ? gmail : outlook;
}

// ─── Send / Reply / Forward ─────────────────────────────────────

export async function sendEmail(params: {
  provider: Provider;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  matterId?: string;
  templateId?: string;
  scheduledFor?: Date;
}) {
  const config = await db.emailIntegration.findUnique({ where: { provider: params.provider as any } });
  if (!config?.isEnabled) return { success: false, error: `${params.provider} not configured` };

  // Apply template if specified
  let { subject, body } = params;
  if (params.templateId) {
    const tpl = await db.emailComposeTemplate.findUnique({ where: { id: params.templateId } });
    if (tpl) {
      subject = tpl.subject || subject;
      body = tpl.bodyHtml || body;
      await db.emailComposeTemplate.update({ where: { id: tpl.id }, data: { usageCount: { increment: 1 } } });
    }
  }

  // Append signature
  if (config.signatureHtml) {
    body = `${body}<br/><br/>${config.signatureHtml}`;
  }

  // Schedule if needed
  if (params.scheduledFor && params.scheduledFor > new Date()) {
    await db.emailSchedule.create({
      data: {
        provider: params.provider as any,
        messageData: JSON.stringify({ to: params.to, cc: params.cc, subject, body }),
        matterId: params.matterId,
        scheduledFor: params.scheduledFor,
        status: "SCHEDULED" as any,
      },
    });
    return { success: true, data: { scheduled: true, scheduledFor: params.scheduledFor } };
  }

  // Send
  let result: any;
  if (params.provider === "GMAIL") {
    result = await gmail.sendMessage({ from: config.emailAddress || "", to: params.to, cc: params.cc, subject, body });
  } else {
    const toArr = params.to.split(",").map(e => e.trim());
    const ccArr = params.cc ? params.cc.split(",").map(e => e.trim()) : undefined;
    result = await outlook.sendMessage({ to: toArr, cc: ccArr, subject, body });
  }
  if (!result.success) return result;

  // Create EmailMessage record
  const record = await db.emailMessage.create({
    data: {
      provider: params.provider as any,
      externalMessageId: result.data?.id || `sent-${Date.now()}`,
      from: config.emailAddress || "",
      fromName: config.defaultFromName || null,
      to: params.to,
      cc: params.cc || null,
      subject,
      bodyHtml: body,
      date: new Date(),
      isSent: true,
      isInbound: false,
      matterId: params.matterId || null,
    },
  });

  return { success: true, data: { message: record, providerResult: result.data } };
}

export async function replyToEmail(messageId: string, body: string) {
  const original = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!original) return { success: false, error: "Message not found" };

  const config = await db.emailIntegration.findUnique({ where: { provider: original.provider as any } });
  if (!config?.isEnabled) return { success: false, error: "Provider not configured" };

  let result: any;
  if (original.provider === "GMAIL") {
    const replyBody = config.signatureHtml ? `${body}<br/><br/>${config.signatureHtml}` : body;
    result = await gmail.sendMessage({
      from: config.emailAddress || "",
      to: original.from,
      subject: `Re: ${original.subject}`,
      body: replyBody,
    });
  } else {
    result = await outlook.replyToMessage(original.externalMessageId, body);
  }
  if (!result.success) return result;

  const record = await db.emailMessage.create({
    data: {
      provider: original.provider,
      externalMessageId: result.data?.id || `reply-${Date.now()}`,
      externalThreadId: original.externalThreadId,
      from: config.emailAddress || "",
      to: original.from,
      subject: `Re: ${original.subject}`,
      bodyHtml: body,
      date: new Date(),
      isSent: true,
      isInbound: false,
      matterId: original.matterId,
    },
  });

  return { success: true, data: record };
}

export async function forwardEmail(messageId: string, to: string, comment?: string) {
  const original = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!original) return { success: false, error: "Message not found" };

  let result: any;
  if (original.provider === "GMAIL") {
    const fwdBody = `${comment || ""}<br/><br/>---------- Forwarded message ----------<br/>${original.bodyHtml || original.bodyText || ""}`;
    result = await gmail.sendMessage({
      from: (await db.emailIntegration.findUnique({ where: { provider: "GMAIL" as any } }))?.emailAddress || "",
      to,
      subject: `Fwd: ${original.subject}`,
      body: fwdBody,
    });
  } else {
    result = await outlook.forwardMessage(original.externalMessageId, to.split(",").map(e => e.trim()), comment);
  }
  if (!result.success) return result;

  const record = await db.emailMessage.create({
    data: {
      provider: original.provider,
      externalMessageId: result.data?.id || `fwd-${Date.now()}`,
      externalThreadId: original.externalThreadId,
      from: (await db.emailIntegration.findUnique({ where: { provider: original.provider as any } }))?.emailAddress || "",
      to,
      subject: `Fwd: ${original.subject}`,
      bodyHtml: comment || "",
      date: new Date(),
      isSent: true,
      isInbound: false,
      matterId: original.matterId,
    },
  });

  return { success: true, data: record };
}

// ─── Filing ─────────────────────────────────────────────────────

export async function fileEmailToMatter(messageId: string, matterId: string, userId?: string) {
  const msg = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!msg) return { success: false, error: "Message not found" };

  const matter = await db.matter.findUnique({ where: { id: matterId } });
  if (!matter) return { success: false, error: "Matter not found" };

  // Save attachments if any
  if (msg.hasAttachments && msg.attachments) {
    const atts = JSON.parse(msg.attachments);
    for (const att of atts) {
      const provider = getProvider(msg.provider as Provider);
      const attResult = await provider.getAttachment(msg.externalMessageId, att.attachmentId);
      if (attResult.success) {
        await db.document.create({
          data: {
            matterId,
            name: att.fileName,
            filename: att.fileName,
            mimeType: att.mimeType || "application/octet-stream",
            size: att.size || 0,
            path: `emails/${msg.id}/${att.fileName}`,
          },
        });
      }
    }
  }

  const updated = await db.emailMessage.update({
    where: { id: messageId },
    data: { matterId, filedAt: new Date(), filedBy: userId, autoFiled: false },
  });

  // Log activity
  await db.matterActivity.create({
    data: {
      matterId,
      type: "NOTE_ADDED" as any,
      description: `Email filed: "${msg.subject}" from ${msg.from}`,
      metadata: JSON.stringify({ emailMessageId: msg.id, subject: msg.subject }),
    },
  });

  return { success: true, data: updated };
}

export async function autoFileEmail(messageId: string) {
  const msg = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.matterId) return { success: false, error: "Not found or already filed" };

  // Check rules first
  const ruleResult = await applyRules(msg);
  if (ruleResult.matterId) {
    await db.emailMessage.update({
      where: { id: messageId },
      data: { matterId: ruleResult.matterId, filedAt: new Date(), autoFiled: true, autoFileConfidence: "rule" },
    });
    return { success: true, data: { matterId: ruleResult.matterId, method: "rule" } };
  }

  // Match sender against clients
  const client = await db.client.findFirst({ where: { email: msg.from } });
  if (client) {
    const matter = await db.matter.findFirst({
      where: { clientId: client.id, status: "OPEN" as any },
      orderBy: { updatedAt: "desc" },
    });
    if (matter) {
      await db.emailMessage.update({
        where: { id: messageId },
        data: { matterId: matter.id, clientId: client.id, filedAt: new Date(), autoFiled: true, autoFileConfidence: "high" },
      });
      return { success: true, data: { matterId: matter.id, method: "client_match" } };
    }
  }

  // Match subject against matter names
  const matters = await db.matter.findMany({ where: { status: "OPEN" as any }, select: { id: true, name: true, matterNumber: true } });
  for (const matter of matters) {
    if (msg.subject.toLowerCase().includes(matter.name.toLowerCase()) ||
        msg.subject.includes(matter.matterNumber)) {
      await db.emailMessage.update({
        where: { id: messageId },
        data: { matterId: matter.id, filedAt: new Date(), autoFiled: true, autoFileConfidence: "medium" },
      });
      return { success: true, data: { matterId: matter.id, method: "subject_match" } };
    }
  }

  return { success: false, error: "No match found" };
}

// ─── Sync ───────────────────────────────────────────────────────

export async function syncInbox(provider: Provider, fullSync = false) {
  const config = await db.emailIntegration.findUnique({ where: { provider: provider as any } });
  if (!config?.isEnabled) return { success: false, error: `${provider} not configured` };

  const p = getProvider(provider);
  let created = 0;

  try {
    if (!fullSync && provider === "GMAIL" && config.historyId) {
      // Incremental via history
      const histResult = await gmail.getHistory(config.historyId, ["messageAdded"]);
      if (histResult.success) {
        for (const record of histResult.data?.history || []) {
          for (const added of record.messagesAdded || []) {
            const msgResult = await gmail.getMessage(added.message.id);
            if (msgResult.success) {
              const parsed = gmail.parseMessage(msgResult.data);
              await db.emailMessage.upsert({
                where: { provider_externalMessageId: { provider: provider as any, externalMessageId: parsed.externalMessageId } },
                create: { provider: provider as any, ...parsed },
                update: { ...parsed },
              });
              created++;
              await autoFileEmail((await db.emailMessage.findUnique({
                where: { provider_externalMessageId: { provider: provider as any, externalMessageId: parsed.externalMessageId } },
              }))!.id);
            }
          }
        }
        const newHistoryId = histResult.data?.historyId;
        if (newHistoryId) await db.emailIntegration.update({ where: { provider: provider as any }, data: { historyId: String(newHistoryId) } });
      }
    } else if (!fullSync && provider === "OUTLOOK" && config.deltaLink) {
      // Incremental via delta
      const deltaResult = await outlook.getDelta(config.deltaLink);
      if (deltaResult.success) {
        for (const msg of deltaResult.data?.value || []) {
          const parsed = outlook.parseMessage(msg);
          await db.emailMessage.upsert({
            where: { provider_externalMessageId: { provider: provider as any, externalMessageId: parsed.externalMessageId } },
            create: { provider: provider as any, ...parsed },
            update: { ...parsed },
          });
          created++;
        }
        const newDelta = deltaResult.data?.["@odata.deltaLink"];
        if (newDelta) await db.emailIntegration.update({ where: { provider: provider as any }, data: { deltaLink: newDelta } });
      }
    } else {
      // Full sync via list
      const listResult = provider === "GMAIL"
        ? await gmail.listMessages("in:inbox", 100)
        : await outlook.listMessages({ top: 100, orderBy: "receivedDateTime desc" });
      if (listResult.success) {
        const items = provider === "GMAIL" ? (listResult.data?.messages || []) : (listResult.data?.value || []);
        for (const item of items) {
          const msgResult = provider === "GMAIL"
            ? await gmail.getMessage(item.id)
            : { success: true, data: item };
          if (msgResult.success) {
            const parsed = provider === "GMAIL" ? gmail.parseMessage(msgResult.data) : outlook.parseMessage(msgResult.data);
            await db.emailMessage.upsert({
              where: { provider_externalMessageId: { provider: provider as any, externalMessageId: parsed.externalMessageId } },
              create: { provider: provider as any, ...parsed },
              update: { ...parsed },
            });
            created++;
          }
        }
      }
    }

    await db.emailIntegration.update({
      where: { provider: provider as any },
      data: { lastSyncAt: new Date(), lastSyncStatus: "success", lastSyncError: null },
    });

    return { success: true, data: { synced: created } };
  } catch (err: any) {
    await db.emailIntegration.update({
      where: { provider: provider as any },
      data: { lastSyncStatus: "error", lastSyncError: err.message },
    });
    return { success: false, error: err.message };
  }
}

// ─── Search & Queries ───────────────────────────────────────────

export async function searchEmails(query: string, opts?: { provider?: Provider; matterId?: string; searchProvider?: boolean }) {
  const where: any = {};
  if (opts?.matterId) where.matterId = opts.matterId;
  if (opts?.provider) where.provider = opts.provider;
  where.OR = [
    { subject: { contains: query, mode: "insensitive" } },
    { from: { contains: query, mode: "insensitive" } },
    { to: { contains: query, mode: "insensitive" } },
    { bodyText: { contains: query, mode: "insensitive" } },
  ];

  const local = await db.emailMessage.findMany({ where, orderBy: { date: "desc" }, take: 50 });

  let providerResults: any[] = [];
  if (opts?.searchProvider && opts?.provider) {
    const p = getProvider(opts.provider);
    const result = await p.searchMessages(query);
    if (result.success) providerResults = result.data?.messages || result.data?.value || [];
  }

  return { success: true, data: { local, provider: providerResults } };
}

export async function getUnfiledEmails(provider?: Provider) {
  const where: any = { matterId: null, isInbound: true };
  if (provider) where.provider = provider;
  const messages = await db.emailMessage.findMany({ where, orderBy: { date: "desc" }, take: 100 });
  return { success: true, data: messages };
}

// ─── Attachments ────────────────────────────────────────────────

export async function saveAttachmentToMatter(messageId: string, attachmentIndex: number, matterId: string) {
  const msg = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!msg?.attachments) return { success: false, error: "No attachments" };

  const atts = JSON.parse(msg.attachments);
  const att = atts[attachmentIndex];
  if (!att) return { success: false, error: "Attachment not found" };

  const p = getProvider(msg.provider as Provider);
  const result = await p.getAttachment(msg.externalMessageId, att.attachmentId);
  if (!result.success) return result;

  const doc = await db.document.create({
    data: {
      matterId,
      name: att.fileName,
      filename: att.fileName,
      mimeType: att.mimeType || "application/octet-stream",
      size: att.size || 0,
      path: `matters/${matterId}/attachments/${att.fileName}`,
    },
  });

  // Track in EmailAttachment
  await db.emailAttachment.create({
    data: {
      messageId: msg.id,
      externalAttachmentId: att.attachmentId,
      fileName: att.fileName,
      mimeType: att.mimeType,
      size: att.size,
      documentId: doc.id,
      savedAt: new Date(),
    },
  });

  return { success: true, data: doc };
}

// ─── Time Entry ─────────────────────────────────────────────────

export async function logTimeFromEmail(messageId: string, userId: string, duration?: number) {
  const msg = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!msg?.matterId) return { success: false, error: "Email not filed to a matter" };

  // AI-generated narrative
  const aiResult = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Write a concise professional time entry description for a lawyer who handled this email. Subject: "${msg.subject}". From: ${msg.from}. To: ${msg.to}. Body preview: "${(msg.bodyText || msg.snippet || "").slice(0, 500)}". One sentence, no quotes.`,
    }],
  });
  const narrative = (aiResult.content[0] as any).text || `Email correspondence re: ${msg.subject}`;

  const entry = await db.timeEntry.create({
    data: {
      matterId: msg.matterId,
      userId,
      description: narrative,
      duration: duration || 6, // default 0.1 hour = 6 minutes
      date: msg.date,
      billable: true,
    },
  });

  await db.emailMessage.update({ where: { id: messageId }, data: { timeEntryId: entry.id, billedMinutes: entry.duration } });

  return { success: true, data: entry };
}

// ─── AI Features ────────────────────────────────────────────────

export async function generateEmailDraft(params: { purpose: string; matterId?: string; context?: string; tone?: string }) {
  let matterContext = "";
  if (params.matterId) {
    const matter = await db.matter.findUnique({ where: { id: params.matterId }, include: { client: true } });
    if (matter) matterContext = `Matter: ${matter.name} (${matter.matterNumber}). Client: ${matter.client.name}. Practice area: ${matter.practiceArea || "general"}.`;
  }

  const result = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `Draft a professional legal email. Purpose: ${params.purpose}. ${matterContext} ${params.context ? `Additional context: ${params.context}` : ""}. Tone: ${params.tone || "professional"}. Return only the email body in HTML. Do not include subject line or signatures.`,
    }],
  });

  return { success: true, data: { body: (result.content[0] as any).text } };
}

export async function summarizeThread(threadId: string) {
  const messages = await db.emailMessage.findMany({
    where: { externalThreadId: threadId },
    orderBy: { date: "asc" },
  });
  if (!messages.length) return { success: false, error: "No messages in thread" };

  const threadText = messages.map(m => `From: ${m.from}\nDate: ${m.date.toISOString()}\nSubject: ${m.subject}\n\n${m.bodyText || m.snippet || ""}`).join("\n---\n");

  const result = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Summarize this email thread for a lawyer. Include key points, decisions, action items, and deadlines. Be concise.\n\n${threadText}`,
    }],
  });

  return { success: true, data: { summary: (result.content[0] as any).text, messageCount: messages.length } };
}

export async function detectActionItems(messageId: string) {
  const msg = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!msg) return { success: false, error: "Message not found" };

  const result = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Extract action items from this email for a lawyer. Subject: "${msg.subject}". From: ${msg.from}.\n\n${msg.bodyText || msg.bodyHtml || ""}.\n\nReturn as JSON array: [{"action": "...", "assignee": "...", "deadline": "..." or null, "priority": "high"|"medium"|"low"}]`,
    }],
  });

  try {
    const text = (result.content[0] as any).text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return { success: true, data: { items } };
  } catch {
    return { success: true, data: { items: [], raw: (result.content[0] as any).text } };
  }
}

// ─── Rules ──────────────────────────────────────────────────────

export async function applyRules(message: any): Promise<{ matterId?: string; labels?: string[]; folder?: string }> {
  const rules = await db.emailRule.findMany({ where: { isActive: true }, orderBy: { priority: "desc" } });
  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditions) as Array<{ field: string; operator: string; value: string }>;
    const actions = JSON.parse(rule.actions) as Array<{ type: string; value: string }>;
    const logic = rule.conditionLogic || "AND";

    const checks = conditions.map(c => {
      const fieldVal = String(message[c.field] || "").toLowerCase();
      const target = c.value.toLowerCase();
      switch (c.operator) {
        case "contains": return fieldVal.includes(target);
        case "equals": return fieldVal === target;
        case "startsWith": return fieldVal.startsWith(target);
        case "endsWith": return fieldVal.endsWith(target);
        default: return false;
      }
    });

    const matched = logic === "AND" ? checks.every(Boolean) : checks.some(Boolean);
    if (!matched) continue;

    await db.emailRule.update({ where: { id: rule.id }, data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() } });

    const result: { matterId?: string; labels?: string[]; folder?: string } = {};
    for (const action of actions) {
      if (action.type === "fileToMatter") result.matterId = action.value;
      if (action.type === "addLabel") (result.labels ??= []).push(action.value);
      if (action.type === "moveToFolder") result.folder = action.value;
    }
    return result;
  }
  return {};
}

// ─── Default Templates ─────────────────────────────────────────

export async function initializeDefaultTemplates() {
  const templates = [
    { name: "Initial Consultation Follow-Up", subject: "Follow-Up: Your Consultation with Our Firm", category: "intake", bodyHtml: "<p>Dear {{clientName}},</p><p>Thank you for meeting with us regarding {{matterDescription}}. We appreciate your trust in our firm.</p><p>As discussed, the next steps are:</p><ul><li>{{nextSteps}}</li></ul><p>Please don't hesitate to reach out with any questions.</p><p>Best regards</p>" },
    { name: "Engagement Letter", subject: "Engagement Letter - {{matterName}}", category: "intake", bodyHtml: "<p>Dear {{clientName}},</p><p>Please find attached our engagement letter for {{matterName}}. Kindly review the terms and return a signed copy at your earliest convenience.</p><p>Key details:</p><ul><li>Scope: {{scope}}</li><li>Fee arrangement: {{feeType}}</li></ul><p>Best regards</p>" },
    { name: "Case Status Update", subject: "Status Update: {{matterName}}", category: "updates", bodyHtml: "<p>Dear {{clientName}},</p><p>I am writing to provide an update on {{matterName}} ({{matterNumber}}).</p><p>{{statusUpdate}}</p><p>Upcoming deadlines:</p><ul><li>{{deadlines}}</li></ul><p>Please let me know if you have any questions.</p><p>Best regards</p>" },
    { name: "Document Request", subject: "Documents Needed: {{matterName}}", category: "requests", bodyHtml: "<p>Dear {{clientName}},</p><p>In connection with {{matterName}}, we need the following documents:</p><ol><li>{{documentList}}</li></ol><p>Please provide these by {{deadline}}.</p><p>Best regards</p>" },
    { name: "Invoice Cover", subject: "Invoice #{{invoiceNumber}} - {{matterName}}", category: "billing", bodyHtml: "<p>Dear {{clientName}},</p><p>Please find attached Invoice #{{invoiceNumber}} for services rendered in connection with {{matterName}}.</p><p>Amount due: {{amount}}</p><p>Payment is due by {{dueDate}}. Please let us know if you have any questions.</p><p>Best regards</p>" },
    { name: "Opposing Counsel Correspondence", subject: "Re: {{matterName}} - {{topic}}", category: "litigation", bodyHtml: "<p>Dear Counsel,</p><p>I am writing on behalf of my client regarding {{matterName}}.</p><p>{{body}}</p><p>Please respond by {{deadline}}.</p><p>Respectfully</p>" },
  ];

  const created = [];
  for (const tpl of templates) {
    const existing = await db.emailComposeTemplate.findFirst({ where: { name: tpl.name } });
    if (!existing) {
      const record = await db.emailComposeTemplate.create({
        data: {
          name: tpl.name,
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          category: tpl.category,
          isActive: true,
        },
      });
      created.push(record);
    }
  }

  return { success: true, data: { created: created.length, templates: created } };
}
