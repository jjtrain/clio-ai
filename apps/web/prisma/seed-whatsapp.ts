import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding WhatsApp data...");

  // Create mock connection
  const connection = await prisma.whatsAppConnection.upsert({
    where: { firmId: "demo-firm" },
    create: {
      firmId: "demo-firm",
      wabaId: "123456789012345",
      phoneNumberId: "987654321098765",
      phoneNumber: "+12125551234",
      displayName: "Demo Law Firm",
      accessToken: "mock-whatsapp-token",
      webhookVerifyToken: crypto.randomBytes(16).toString("hex"),
      qualityRating: "GREEN",
      lastSyncAt: new Date(),
    },
    update: {},
  });

  // Create templates
  const templates = [
    { name: "appointment_reminder", category: "UTILITY", status: "APPROVED",
      components: [{ type: "BODY", text: "Hi {{1}}, reminder: appointment with {{2}} on {{3}} at {{4}}. Reply to confirm." }],
      variableMapping: { "1": "contact.firstName", "2": "attorney.name", "3": "appointment.date", "4": "appointment.time" } },
    { name: "document_request", category: "UTILITY", status: "APPROVED",
      components: [{ type: "BODY", text: "Hi {{1}}, we need documents for your {{2}} matter: {{3}}." }],
      variableMapping: { "1": "contact.firstName", "2": "matter.practiceArea", "3": "custom.documentList" } },
    { name: "intake_follow_up", category: "UTILITY", status: "APPROVED",
      components: [{ type: "BODY", text: "Hi {{1}}, thank you for contacting {{2}}. An attorney will be in touch within one business day." }],
      variableMapping: { "1": "contact.firstName", "2": "firm.name" } },
    { name: "invoice_reminder", category: "UTILITY", status: "PENDING",
      components: [{ type: "BODY", text: "Hi {{1}}, invoice #{{2}} for ${{3}} is due on {{4}}." }],
      variableMapping: { "1": "contact.firstName", "2": "invoice.number", "3": "invoice.amount", "4": "invoice.dueDate" } },
  ];

  let templateCount = 0;
  for (const t of templates) {
    const existing = await prisma.whatsAppTemplate.findFirst({ where: { name: t.name, connectionId: connection.id } });
    if (!existing) {
      await prisma.whatsAppTemplate.create({
        data: { connectionId: connection.id, firmId: "demo-firm", waTemplateId: `tpl-${t.name}`, ...t as any },
      });
      templateCount++;
    }
  }

  // Create conversations + messages
  const matters = await prisma.matter.findMany({ take: 3, select: { id: true, name: true } });
  const now = new Date();

  const convos = [
    {
      clientPhone: "+15551234567", clientName: "Jane Johnson",
      matterId: matters[0]?.id, status: "OPEN", autoFiled: true,
      windowExpiresAt: new Date(now.getTime() + 20 * 3600000),
      messages: [
        { direction: "INBOUND", bodyText: "Hi, I wanted to check on the status of my case. Is there any update?", sentAt: new Date(now.getTime() - 4 * 3600000), status: "READ" },
        { direction: "OUTBOUND", bodyText: "Hello Jane! Yes, we received the documents from opposing counsel yesterday. I'll review them this week and call you Friday.", sentAt: new Date(now.getTime() - 3.5 * 3600000), status: "READ", senderName: "Sarah Chen" },
        { direction: "INBOUND", bodyText: "That's great news! I'll be available Friday afternoon. Thank you!", sentAt: new Date(now.getTime() - 3 * 3600000), status: "READ" },
      ],
    },
    {
      clientPhone: "+15559876543", clientName: "Robert Apex",
      matterId: matters[1]?.id, status: "OPEN", autoFiled: true,
      windowExpiresAt: new Date(now.getTime() + 12 * 3600000),
      messages: [
        { direction: "OUTBOUND", bodyText: null, templateName: "document_request", messageType: "TEMPLATE", sentAt: new Date(now.getTime() - 48 * 3600000), status: "DELIVERED", senderName: "Sarah Chen" },
        { direction: "INBOUND", bodyText: "I'll gather those documents and send them over tomorrow.", sentAt: new Date(now.getTime() - 6 * 3600000), status: "DELIVERED" },
        { direction: "INBOUND", messageType: "DOCUMENT", bodyText: "Here are the financial statements", mediaFilename: "Q4_Financials_2025.pdf", mediaMimeType: "application/pdf", sentAt: new Date(now.getTime() - 2 * 3600000), status: "DELIVERED" },
      ],
    },
    {
      clientPhone: "+15555555555", clientName: "Unknown Caller",
      matterId: null, status: "PENDING", autoFiled: false,
      windowExpiresAt: new Date(now.getTime() + 22 * 3600000),
      messages: [
        { direction: "INBOUND", bodyText: "Hi, I was in a car accident last week and I need a lawyer. Can someone help me?", sentAt: new Date(now.getTime() - 1 * 3600000), status: "DELIVERED" },
      ],
    },
  ];

  let convCount = 0;
  for (const c of convos) {
    const { messages, ...convData } = c;
    const existing = await prisma.whatsAppConversation.findFirst({ where: { connectionId: connection.id, clientPhone: c.clientPhone } });
    if (existing) continue;

    const conv = await prisma.whatsAppConversation.create({
      data: {
        ...convData,
        connectionId: connection.id,
        firmId: "demo-firm",
        lastMessageAt: messages[messages.length - 1].sentAt,
        lastMessageSnippet: (messages[messages.length - 1].bodyText || `[${messages[messages.length - 1].messageType || "Message"}]`).slice(0, 100),
        unreadCount: c.status === "PENDING" ? 1 : 0,
      } as any,
    });

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      await prisma.whatsAppMessage.create({
        data: {
          conversationId: conv.id,
          matterId: convData.matterId,
          waMessageId: `wamid-${conv.id}-${i}`,
          direction: msg.direction as any,
          messageType: (msg.messageType || "TEXT") as any,
          bodyText: msg.bodyText || null,
          templateName: msg.templateName || null,
          mediaFilename: (msg as any).mediaFilename || null,
          mediaMimeType: (msg as any).mediaMimeType || null,
          sentAt: msg.sentAt,
          status: msg.status as any,
          senderName: msg.senderName || (msg.direction === "INBOUND" ? c.clientName : null),
          readAt: msg.status === "READ" ? new Date(msg.sentAt.getTime() + 60000) : null,
          deliveredAt: ["DELIVERED", "READ"].includes(msg.status) ? new Date(msg.sentAt.getTime() + 5000) : null,
        },
      });
    }
    convCount++;
  }

  console.log(`Seeded: 1 WhatsApp connection, ${templateCount} templates, ${convCount} conversations.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
