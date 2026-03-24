import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding appointment types...");

  const types = [
    { id: "type-initial", name: "Free Initial Consultation", description: "Discuss your situation with an attorney. No cost, no obligation.", duration: 30, bufferAfter: 15, locationType: "flexible", virtualPlatform: "zoom", autoConfirm: true, maxAdvanceDays: 30, minAdvanceHours: 24, maxPerDay: 4, isPublic: true, preparationInstructions: "Please have ready: a brief summary of your situation, any relevant documents, insurance information if applicable.", followUpActions: { createTimeEntry: false, sendSurvey: true, scheduleFollowUp: true } },
    { id: "type-status", name: "Case Status Meeting", duration: 30, locationType: "flexible", virtualPlatform: "zoom", requiresMatter: true, allowedBookers: "clients", autoConfirm: true, maxPerDay: 6, isPublic: false, followUpActions: { createTimeEntry: true } },
    { id: "type-depo-prep", name: "Deposition Preparation", practiceArea: "personal_injury", duration: 60, locationType: "in_person", requiresMatter: true, allowedBookers: "clients", autoConfirm: false, minAdvanceHours: 48, maxPerDay: 2, isPublic: false, preparationInstructions: "Review your bill of particulars. Bring a list of your doctors and medications.", followUpActions: { createTimeEntry: true, sendSurvey: true } },
    { id: "type-doc-review", name: "Document Review Session", duration: 45, locationType: "flexible", virtualPlatform: "zoom", requiresMatter: true, allowedBookers: "clients", autoConfirm: true, maxPerDay: 4, isPublic: false, preparationInstructions: "Upload documents to your portal before the appointment.", followUpActions: { createTimeEntry: true } },
    { id: "type-immigration", name: "Immigration Consultation", practiceArea: "immigration", duration: 45, locationType: "flexible", virtualPlatform: "zoom", allowedBookers: "both", autoConfirm: true, maxPerDay: 4, maxAdvanceDays: 45, isPublic: true, preparationInstructions: "Bring: passport, current visa/I-94, USCIS correspondence, employment letter if applicable.", followUpActions: { createTimeEntry: false, sendSurvey: true, scheduleFollowUp: true } },
    { id: "type-family", name: "Family Law Consultation", practiceArea: "family_law", duration: 45, locationType: "flexible", virtualPlatform: "zoom", allowedBookers: "both", autoConfirm: true, maxPerDay: 3, isPublic: true, preparationInstructions: "If available: recent tax returns, pay stubs, bank statements, list of major assets and debts.", followUpActions: { createTimeEntry: false, sendSurvey: true, scheduleFollowUp: true } },
    { id: "type-settlement", name: "Settlement Discussion", duration: 60, locationType: "in_person", requiresMatter: true, allowedBookers: "clients", autoConfirm: false, maxPerDay: 2, isPublic: false, followUpActions: { createTimeEntry: true } },
    { id: "type-phone", name: "Quick Phone Check-In", duration: 15, locationType: "phone", requiresMatter: true, allowedBookers: "clients", autoConfirm: true, maxPerDay: 8, maxPerWeek: 20, bufferAfter: 5, minAdvanceHours: 4, isPublic: false, followUpActions: { createTimeEntry: true } },
  ];

  for (const t of types) {
    await prisma.appointmentType.upsert({
      where: { id: t.id },
      create: { ...t, isActive: true, firmId: FIRM_ID },
      update: { name: t.name, duration: t.duration },
    });
  }
  console.log(`Seeded ${types.length} appointment types.`);

  // Attorney availability (Mon-Fri 9-5 with lunch break)
  console.log("Seeding availability...");
  const firstUser = await prisma.user.findFirst();
  const attorneyId = firstUser?.id || USER_ID;

  for (let day = 1; day <= 5; day++) {
    const locationType = day === 5 ? "virtual" : "both";
    for (const block of [{ start: "09:00", end: "12:00" }, { start: "13:00", end: day === 5 ? "16:00" : "17:00" }]) {
      await prisma.attorneyAvailability.create({
        data: { attorneyId, dayOfWeek: day, startTime: block.start, endTime: block.end, isAvailable: true, locationType, recurrenceType: "weekly", firmId: FIRM_ID },
      });
    }
  }
  console.log("Seeded weekly availability.");

  // Booking page config
  await prisma.bookingPageConfig.upsert({
    where: { slug: "rubinstein-law" },
    create: {
      slug: "rubinstein-law",
      title: "Schedule a Consultation — Rubinstein Law Firm",
      subtitle: "Free initial consultations for personal injury, immigration, and family law",
      enabledTypeIds: ["type-initial", "type-immigration", "type-family"],
      collectReason: true, collectPhone: true,
      languages: ["en", "es"],
      isActive: true, firmId: FIRM_ID,
    },
    update: {},
  });

  // Demo appointments
  console.log("Seeding demo appointments...");
  const now = new Date();

  const appointments = [
    { id: "appt-1", typeId: "type-initial", clientName: "John Smith", clientEmail: "john@example.com", startTime: new Date(now.getTime() - 3 * 86400000), duration: 30, locationType: "virtual", meetingUrl: "https://meet.managal.app/abc123", status: "completed", completedAt: new Date(now.getTime() - 3 * 86400000), bookingSource: "public_page" },
    { id: "appt-2", typeId: "type-status", clientName: "Maria Rodriguez", clientEmail: "maria@example.com", startTime: new Date(now.getTime() + 86400000 + 10 * 3600000), duration: 30, locationType: "virtual", meetingUrl: "https://meet.managal.app/def456", status: "confirmed", bookingSource: "portal" },
    { id: "appt-3", typeId: "type-depo-prep", clientName: "Robert Chen", clientEmail: "robert@example.com", startTime: new Date(now.getTime() + 5 * 86400000 + 14 * 3600000), duration: 60, locationType: "in_person", location: "123 Main St, Suite 200", status: "confirmed", bookingSource: "manual" },
    { id: "appt-4", typeId: "type-immigration", clientName: "Yuki Tanaka", clientEmail: "yuki@example.com", startTime: new Date(now.getTime() + 7 * 86400000 + 11 * 3600000), duration: 45, locationType: "virtual", meetingUrl: "https://meet.managal.app/ghi789", status: "confirmed", bookingSource: "public_page" },
    { id: "appt-5", typeId: "type-doc-review", clientName: "Angela Davis", clientEmail: "angela@example.com", startTime: new Date(now.getTime() - 86400000 + 15 * 3600000), duration: 45, locationType: "virtual", status: "cancelled", cancellationReason: "Client rescheduled", cancelledBy: "client", cancelledAt: new Date(now.getTime() - 2 * 86400000) },
    { id: "appt-6", typeId: "type-phone", clientName: "James Wilson", clientEmail: "james@example.com", startTime: new Date(now.getTime() - 2 * 86400000 + 14 * 3600000), duration: 15, locationType: "phone", status: "no_show", noShowAt: new Date(now.getTime() - 2 * 86400000 + 14.5 * 3600000) },
  ];

  for (const appt of appointments) {
    const endTime = new Date(appt.startTime.getTime() + appt.duration * 60 * 1000);
    await prisma.scheduledAppointment.upsert({
      where: { id: appt.id },
      create: {
        ...appt, endTime, attorneyId,
        confirmationSentAt: new Date(),
        firmId: FIRM_ID,
      },
      update: {},
    });
  }
  console.log(`Seeded ${appointments.length} demo appointments.`);
  console.log("Scheduling seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
