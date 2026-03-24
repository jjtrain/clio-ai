import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding court calendar events...");

  const firmId = "demo-firm";
  const now = new Date();
  const day = (offset: number) => new Date(now.getTime() + offset * 86400000);

  // Find some matters to link events to
  const matters = await prisma.matter.findMany({ take: 6, select: { id: true, name: true, matterNumber: true } });

  const events = [
    // Upcoming hearings (next 30 days)
    {
      firmId,
      matterId: matters[0]?.id || null,
      source: "MANUAL",
      eventType: "HEARING",
      title: "Motion to Dismiss Hearing",
      courtName: "Supreme Court, New York County",
      judgeAssigned: "Hon. Maria Torres",
      caseNumber: matters[0]?.matterNumber || "2024-CV-01234",
      scheduledAt: day(3),
      location: "Courtroom 418, 60 Centre St, New York, NY",
      notes: "Defendant's motion to dismiss for failure to state a claim. Bring all exhibits A-F.",
      status: "SCHEDULED",
    },
    {
      firmId,
      matterId: matters[1]?.id || null,
      source: "MANUAL",
      eventType: "CONFERENCE",
      title: "Initial Pretrial Conference",
      courtName: "US District Court, SDNY",
      judgeAssigned: "Hon. Robert Chen",
      caseNumber: "1:24-cv-05678",
      scheduledAt: day(7),
      location: "Courtroom 26B, 500 Pearl St, New York, NY",
      notes: "Bring proposed discovery schedule and case management plan.",
      status: "SCHEDULED",
    },
    {
      firmId,
      matterId: matters[2]?.id || null,
      source: "MANUAL",
      eventType: "FILING_DEADLINE",
      title: "Opposition Brief Due",
      courtName: "Supreme Court, Kings County",
      judgeAssigned: "Hon. Patricia Williams",
      caseNumber: "2024-CV-09876",
      scheduledAt: day(14),
      notes: "Response to plaintiff's motion for summary judgment. 25-page limit.",
      status: "SCHEDULED",
    },
    {
      firmId,
      matterId: matters[0]?.id || null,
      source: "MANUAL",
      eventType: "TRIAL",
      title: "Jury Trial - Day 1",
      courtName: "Supreme Court, New York County",
      judgeAssigned: "Hon. Maria Torres",
      caseNumber: matters[0]?.matterNumber || "2024-CV-01234",
      scheduledAt: day(28),
      endTime: day(32),
      location: "Courtroom 418, 60 Centre St, New York, NY",
      notes: "5-day trial. Jury selection begins at 9:30 AM.",
      status: "SCHEDULED",
    },
    {
      firmId,
      matterId: matters[3]?.id || null,
      source: "COURTLISTENER",
      externalId: "cl-demo-001",
      eventType: "MOTION",
      title: "Motion for Protective Order Filed",
      courtName: "US District Court, EDNY",
      judgeAssigned: "Hon. Sarah Kim",
      caseNumber: "1:23-cv-04321",
      scheduledAt: day(10),
      location: "Courtroom 8D, 225 Cadman Plaza E, Brooklyn, NY",
      status: "SCHEDULED",
    },
    // Overdue event
    {
      firmId,
      matterId: matters[4]?.id || null,
      source: "MANUAL",
      eventType: "FILING_DEADLINE",
      title: "Amended Complaint Filing Deadline",
      courtName: "Supreme Court, Queens County",
      judgeAssigned: "Hon. David Park",
      caseNumber: "2024-CV-05555",
      scheduledAt: day(-3),
      notes: "OVERDUE — was due 3 days ago. Request extension ASAP.",
      status: "SCHEDULED",
    },
    // Completed event
    {
      firmId,
      matterId: matters[1]?.id || null,
      source: "IMPORT",
      externalId: "ics-demo-001",
      eventType: "HEARING",
      title: "Discovery Dispute Hearing",
      courtName: "US District Court, SDNY",
      judgeAssigned: "Hon. Robert Chen",
      caseNumber: "1:24-cv-05678",
      scheduledAt: day(-10),
      location: "Courtroom 26B, 500 Pearl St, New York, NY",
      notes: "Resolved — court granted motion to compel with modified scope.",
      status: "COMPLETED",
    },
    // Another upcoming
    {
      firmId,
      matterId: matters[5]?.id || null,
      source: "MANUAL",
      eventType: "JUDGMENT",
      title: "Summary Judgment Decision Expected",
      courtName: "Supreme Court, Nassau County",
      caseNumber: "2023-CV-11111",
      scheduledAt: day(21),
      notes: "Decision on cross-motions for summary judgment filed 6 weeks ago.",
      status: "SCHEDULED",
    },
    // Conference next week
    {
      firmId,
      matterId: matters[2]?.id || null,
      source: "MANUAL",
      eventType: "CONFERENCE",
      title: "Settlement Conference",
      courtName: "Supreme Court, Kings County",
      judgeAssigned: "Hon. Patricia Williams",
      caseNumber: "2024-CV-09876",
      scheduledAt: day(5),
      location: "Judge's Chambers, 360 Adams St, Brooklyn, NY",
      notes: "Both parties must appear with settlement authority. Bring latest demand and offer figures.",
      status: "SCHEDULED",
    },
  ];

  let count = 0;
  for (const event of events) {
    // Avoid duplicates on re-run
    const existing = event.externalId
      ? await prisma.courtEvent.findFirst({ where: { firmId, externalId: event.externalId, source: event.source } })
      : await prisma.courtEvent.findFirst({ where: { firmId, title: event.title, scheduledAt: event.scheduledAt } });

    if (existing) {
      await prisma.courtEvent.update({ where: { id: existing.id }, data: event as any });
    } else {
      await prisma.courtEvent.create({ data: event as any });
    }
    count++;
  }

  // Also create a CourtIntegration for CourtListener
  await prisma.courtIntegration.upsert({
    where: { firmId_provider: { firmId, provider: "COURTLISTENER" } },
    create: {
      firmId,
      provider: "COURTLISTENER",
      status: "active",
      caseNumbers: [
        { caseNumber: "1:24-cv-05678", matterId: matters[1]?.id },
        { caseNumber: "1:23-cv-04321", matterId: matters[3]?.id },
      ] as any,
    },
    update: {},
  });

  console.log(`Seeded ${count} court events + 1 CourtListener integration.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
