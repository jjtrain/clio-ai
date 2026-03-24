import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Gmail integration data...");

  // Create a mock GmailConnection (not actually connected)
  const users = await prisma.user.findMany({ take: 1 });
  const userId = users[0]?.id || "demo-user";

  await prisma.gmailConnection.upsert({
    where: { userId },
    create: {
      userId,
      email: "attorney@demo-firm.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      tokenExpiry: new Date(Date.now() + 3600000),
      syncEnabled: true,
      lastSyncAt: new Date(Date.now() - 3600000),
    },
    update: {},
  });

  // Create filing rules
  const rules = [
    { name: "Court Filings from NY Courts", priority: 10, fromDomain: "courts.ny.gov", isActive: true },
    { name: "Client: Apex Industries", priority: 5, fromDomain: "apexindustries.com", isActive: true },
    { name: "Opposing Counsel - Smith & Jones", priority: 3, fromDomain: "smithjones.law", isActive: true },
    { name: "Insurance Correspondence", priority: 1, subjectContains: "claim number", isActive: true },
  ];

  let ruleCount = 0;
  for (const rule of rules) {
    const existing = await prisma.emailFilingRule.findFirst({ where: { name: rule.name } });
    if (!existing) {
      await prisma.emailFilingRule.create({ data: rule });
      ruleCount++;
    }
  }

  // Create some mock email threads and messages for the UI
  const matters = await prisma.matter.findMany({ take: 3, select: { id: true, name: true } });
  const clients = await prisma.client.findMany({ take: 3, select: { id: true, name: true, email: true } });

  const now = new Date();
  const threads = [
    {
      provider: "GMAIL" as const,
      externalThreadId: `thread-${Date.now()}-1`,
      subject: "Discovery Document Request - Johnson v. Metro Corp",
      participants: "opposing@smithjones.law, attorney@demo-firm.com",
      messageCount: 3,
      lastMessageDate: new Date(now.getTime() - 2 * 3600000),
      lastMessageSnippet: "Please find attached the requested documents per our agreement...",
      lastMessageFrom: "opposing@smithjones.law",
      matterId: matters[0]?.id || null,
    },
    {
      provider: "GMAIL" as const,
      externalThreadId: `thread-${Date.now()}-2`,
      subject: "Re: Settlement Offer - Apex Industries Matter",
      participants: "ceo@apexindustries.com, attorney@demo-firm.com, paralegal@demo-firm.com",
      messageCount: 5,
      lastMessageDate: new Date(now.getTime() - 5 * 3600000),
      lastMessageSnippet: "We are willing to consider the revised terms. Can we schedule a call?",
      lastMessageFrom: "ceo@apexindustries.com",
      matterId: matters[1]?.id || null,
      clientId: clients[0]?.id || null,
    },
    {
      provider: "GMAIL" as const,
      externalThreadId: `thread-${Date.now()}-3`,
      subject: "Court Date Confirmation - March 28, 2026",
      participants: "clerk@courts.ny.gov, attorney@demo-firm.com",
      messageCount: 1,
      lastMessageDate: new Date(now.getTime() - 24 * 3600000),
      lastMessageSnippet: "This is to confirm your scheduled appearance on March 28...",
      lastMessageFrom: "clerk@courts.ny.gov",
    },
    {
      provider: "GMAIL" as const,
      externalThreadId: `thread-${Date.now()}-4`,
      subject: "New Client Inquiry - Personal Injury",
      participants: "prospect@gmail.com, attorney@demo-firm.com",
      messageCount: 2,
      lastMessageDate: new Date(now.getTime() - 3 * 3600000),
      lastMessageSnippet: "I was referred by a friend. I was involved in a car accident last week...",
      lastMessageFrom: "prospect@gmail.com",
      // No matterId — unfiled
    },
  ];

  let threadCount = 0;
  for (const thread of threads) {
    const existing = await prisma.emailThread.findFirst({
      where: { provider: "GMAIL", externalThreadId: thread.externalThreadId },
    });
    if (!existing) {
      const created = await prisma.emailThread.create({ data: thread as any });

      // Create messages for the thread
      await prisma.emailMessage.create({
        data: {
          provider: "GMAIL",
          externalMessageId: `msg-${Date.now()}-${threadCount}-1`,
          externalThreadId: thread.externalThreadId,
          from: thread.lastMessageFrom,
          fromName: thread.lastMessageFrom.split("@")[0],
          to: "attorney@demo-firm.com",
          subject: thread.subject,
          bodyHtml: `<p>${thread.lastMessageSnippet}</p>`,
          bodyText: thread.lastMessageSnippet || "",
          snippet: thread.lastMessageSnippet,
          date: thread.lastMessageDate,
          isRead: threadCount < 2,
          isInbound: true,
          folder: "INBOX",
          matterId: thread.matterId || null,
          autoFiled: !!thread.matterId,
        },
      });

      threadCount++;
    }
  }

  // Create email rules for the existing EmailRule model too
  const emailRules = [
    { name: "Auto-file court notices", conditions: JSON.stringify({ from: "courts.ny.gov" }), actions: JSON.stringify({ file: true }), priority: 10, isActive: true },
    { name: "Flag insurance emails", conditions: JSON.stringify({ subject: "claim" }), actions: JSON.stringify({ label: "Insurance" }), priority: 5, isActive: true },
  ];

  for (const rule of emailRules) {
    const existing = await prisma.emailRule.findFirst({ where: { name: rule.name } });
    if (!existing) {
      await prisma.emailRule.create({ data: rule });
    }
  }

  console.log(`Seeded: 1 GmailConnection, ${ruleCount} filing rules, ${threadCount} threads with messages, 2 email rules.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
