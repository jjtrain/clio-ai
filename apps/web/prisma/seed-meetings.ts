import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding meetings data...");

  const firmId = "demo-firm";
  const now = new Date();
  const day = (offset: number) => new Date(now.getTime() + offset * 86400000);

  const matters = await prisma.matter.findMany({ take: 4, select: { id: true, name: true } });
  const clients = await prisma.client.findMany({ take: 4, select: { id: true, name: true, email: true } });

  const meetings = [
    {
      firmId, matterId: matters[0]?.id, title: "Client Consultation — Johnson Case", provider: "ZOOM" as const,
      externalMeetingId: "zoom-demo-001", joinUrl: "https://zoom.us/j/1234567890", hostUrl: "https://zoom.us/s/1234567890",
      password: "abc123", scheduledAt: day(1), durationMinutes: 60, status: "SCHEDULED" as const,
      attendees: [
        { email: clients[0]?.email || "client@example.com", name: clients[0]?.name || "Jane Johnson", role: "ATTENDEE" as const },
        { email: "attorney@demo-firm.com", name: "Sarah Chen", role: "HOST" as const },
      ],
    },
    {
      firmId, matterId: matters[1]?.id, title: "Settlement Discussion — Apex Industries", provider: "TEAMS" as const,
      externalMeetingId: "teams-demo-001", joinUrl: "https://teams.microsoft.com/l/meetup-join/demo-link",
      scheduledAt: day(3), durationMinutes: 45, status: "SCHEDULED" as const,
      attendees: [
        { email: "ceo@apexindustries.com", name: "Robert Apex", role: "ATTENDEE" as const },
        { email: "attorney@demo-firm.com", name: "Sarah Chen", role: "HOST" as const },
        { email: "paralegal@demo-firm.com", name: "Maria Rodriguez", role: "ATTENDEE" as const },
      ],
    },
    {
      firmId, matterId: matters[2]?.id, title: "Expert Witness Prep", provider: "ZOOM" as const,
      externalMeetingId: "zoom-demo-002", joinUrl: "https://zoom.us/j/9876543210", password: "expert99",
      scheduledAt: day(7), durationMinutes: 90, status: "SCHEDULED" as const,
      attendees: [
        { email: "expert@medical-consulting.com", name: "Dr. Lisa Wang", role: "ATTENDEE" as const },
        { email: "attorney@demo-firm.com", name: "Sarah Chen", role: "HOST" as const },
      ],
    },
    {
      firmId, matterId: matters[0]?.id, title: "Deposition Review Meeting", provider: "ZOOM" as const,
      externalMeetingId: "zoom-demo-003", joinUrl: "https://zoom.us/j/5555555555",
      scheduledAt: day(-3), durationMinutes: 30, status: "COMPLETED" as const,
      startedAt: day(-3), endedAt: new Date(day(-3).getTime() + 35 * 60000), actualDurationMins: 35,
      attendees: [
        { email: "attorney@demo-firm.com", name: "Sarah Chen", role: "HOST" as const },
        { email: "associate@demo-firm.com", name: "James Park", role: "ATTENDEE" as const },
      ],
    },
    {
      firmId, title: "Team Standup", provider: "TEAMS" as const,
      externalMeetingId: "teams-demo-002", joinUrl: "https://teams.microsoft.com/l/meetup-join/standup",
      scheduledAt: day(-1), durationMinutes: 15, status: "COMPLETED" as const,
      startedAt: day(-1), endedAt: new Date(day(-1).getTime() + 12 * 60000), actualDurationMins: 12,
      attendees: [
        { email: "attorney@demo-firm.com", name: "Sarah Chen", role: "HOST" as const },
        { email: "paralegal@demo-firm.com", name: "Maria Rodriguez", role: "ATTENDEE" as const },
        { email: "associate@demo-firm.com", name: "James Park", role: "ATTENDEE" as const },
      ],
    },
  ];

  let count = 0;
  for (const m of meetings) {
    const { attendees, ...meetingData } = m;
    const existing = await prisma.meetingEvent.findFirst({ where: { externalMeetingId: m.externalMeetingId } });
    if (existing) continue;

    await prisma.meetingEvent.create({
      data: {
        ...meetingData,
        attendees: { create: attendees },
      },
    });
    count++;
  }

  console.log(`Seeded ${count} meeting events.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
