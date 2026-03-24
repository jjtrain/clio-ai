import { db } from "@/lib/db";

/**
 * Auto-filing engine for Gmail messages.
 * Tries filing rules → client email matching → matter address matching.
 */
export async function autoFileMessage(messageId: string): Promise<boolean> {
  const message = await db.emailMessage.findUniqueOrThrow({ where: { id: messageId } });
  if (message.matterId) return true; // Already filed

  const fromEmail = extractEmailAddr(message.from);
  const toEmails = (message.to || "").split(",").map(extractEmailAddr).filter(Boolean);
  const ccEmails = (message.cc || "").split(",").map(extractEmailAddr).filter(Boolean);
  const allAddresses = [fromEmail, ...toEmails, ...ccEmails].filter(Boolean);

  // Step 1 — Check EmailFilingRules (ordered by priority desc)
  const rules = await db.emailFilingRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  for (const rule of rules) {
    let matches = true;

    if (rule.fromDomain) {
      const domain = fromEmail.split("@")[1]?.toLowerCase();
      if (domain !== rule.fromDomain.toLowerCase()) matches = false;
    }
    if (rule.fromAddress && fromEmail.toLowerCase() !== rule.fromAddress.toLowerCase()) {
      matches = false;
    }
    if (rule.subjectContains && !message.subject.toLowerCase().includes(rule.subjectContains.toLowerCase())) {
      matches = false;
    }
    if (rule.toAddress) {
      const matchTo = toEmails.some((e) => e.toLowerCase() === rule.toAddress!.toLowerCase());
      if (!matchTo) matches = false;
    }

    if (matches && rule.matterId) {
      await db.emailMessage.update({
        where: { id: messageId },
        data: { matterId: rule.matterId, autoFiled: true, filedAt: new Date() },
      });

      // Update thread
      if (message.externalThreadId) {
        const thread = await db.emailThread.findFirst({
          where: { provider: "GMAIL", externalThreadId: message.externalThreadId },
        });
        if (thread && !thread.matterId) {
          await db.emailThread.update({ where: { id: thread.id }, data: { matterId: rule.matterId } });
        }
      }

      // Update rule match count
      await db.emailFilingRule.update({
        where: { id: rule.id },
        data: { /* matchCount increment not available without raw SQL, skip */ },
      });

      return true;
    }
  }

  // Step 2 — Client email matching
  for (const addr of allAddresses) {
    if (!addr) continue;
    const client = await db.client.findFirst({
      where: { email: { equals: addr, mode: "insensitive" } },
      include: { matters: { where: { status: "OPEN" }, select: { id: true }, take: 5 } },
    });

    if (client && client.matters.length === 1) {
      const matterId = client.matters[0].id;
      await db.emailMessage.update({
        where: { id: messageId },
        data: { matterId, clientId: client.id, autoFiled: true, filedAt: new Date(), autoFileConfidence: "high" },
      });

      if (message.externalThreadId) {
        const thread = await db.emailThread.findFirst({
          where: { provider: "GMAIL", externalThreadId: message.externalThreadId },
        });
        if (thread && !thread.matterId) {
          await db.emailThread.update({ where: { id: thread.id }, data: { matterId, clientId: client.id } });
        }
      }

      return true;
    }

    if (client && client.matters.length > 1) {
      // Multiple matters — file to client but not matter (needs manual review)
      await db.emailMessage.update({
        where: { id: messageId },
        data: { clientId: client.id, autoFileConfidence: "low" },
      });
      return false;
    }
  }

  // Step 3 — Per-matter inbound address matching (e.g. matter-slug@mail.managal.app)
  for (const addr of toEmails) {
    if (addr.includes("@mail.managal.app") || addr.includes("@mail.managal.com")) {
      const slug = addr.split("@")[0];
      const matter = await db.matter.findFirst({
        where: { OR: [{ matterNumber: slug }, { name: { contains: slug, mode: "insensitive" } }] },
      });
      if (matter) {
        await db.emailMessage.update({
          where: { id: messageId },
          data: { matterId: matter.id, autoFiled: true, filedAt: new Date(), autoFileConfidence: "high" },
        });
        return true;
      }
    }
  }

  return false;
}

// ─── Manual Filing ──────────────────────────────────────────────

export async function manualFileMessage(messageId: string, matterId: string, userId: string): Promise<void> {
  await db.emailMessage.update({
    where: { id: messageId },
    data: { matterId, autoFiled: false, filedBy: userId, filedAt: new Date() },
  });

  // Update thread if all messages go to same matter
  const message = await db.emailMessage.findUniqueOrThrow({ where: { id: messageId } });
  if (message.externalThreadId) {
    const threadMessages = await db.emailMessage.findMany({
      where: { externalThreadId: message.externalThreadId },
      select: { matterId: true },
    });
    const allSameMatter = threadMessages.every((m) => m.matterId === matterId || !m.matterId);
    if (allSameMatter) {
      const thread = await db.emailThread.findFirst({
        where: { provider: "GMAIL", externalThreadId: message.externalThreadId },
      });
      if (thread) {
        await db.emailThread.update({ where: { id: thread.id }, data: { matterId } });
      }
    }
  }
}

function extractEmailAddr(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return (match ? match[1] : addr).trim().toLowerCase();
}
