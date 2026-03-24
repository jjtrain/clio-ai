import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding digest preferences...");

  // Get all users
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  if (users.length === 0) {
    console.log("No users found — creating demo user preference only");
    await prisma.digestPreference.upsert({
      where: { userId: "demo-user" },
      create: {
        userId: "demo-user",
        enabled: true,
        sendHour: 7,
        timezone: "America/New_York",
        sections: {
          deadlines: true,
          tasks: true,
          unbilled: true,
          hearings: true,
          payments: true,
          stats: true,
        },
      },
      update: { enabled: true },
    });
    console.log("Seeded 1 digest preference (demo-user).");
    return;
  }

  let count = 0;
  for (const user of users) {
    await prisma.digestPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        enabled: true,
        sendHour: 7,
        timezone: "America/New_York",
        sections: {
          deadlines: true,
          tasks: true,
          unbilled: true,
          hearings: true,
          payments: true,
          stats: true,
        },
      },
      update: { enabled: true },
    });
    count++;
  }

  console.log(`Seeded ${count} digest preferences for all users.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
