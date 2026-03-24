import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

async function main() {
  console.log("Seeding realization rate data...");

  const firmId = "demo-firm";
  const now = new Date();

  // ─── Attorneys with deliberate variance ───
  const attorneys = [
    { id: "att-star", name: "Sarah Chen", billingPct: [88, 95], collectionPct: [90, 98], rate: 350, hoursRange: [140, 170] },
    { id: "att-solid", name: "James Park", billingPct: [82, 90], collectionPct: [85, 93], rate: 300, hoursRange: [130, 160] },
    { id: "att-avg", name: "Maria Rodriguez", billingPct: [75, 85], collectionPct: [78, 88], rate: 275, hoursRange: [120, 150] },
    { id: "att-struggling", name: "David Kim", billingPct: [60, 72], collectionPct: [55, 68], rate: 250, hoursRange: [100, 140] },
    { id: "att-junior", name: "Emily Watson", billingPct: [50, 65], collectionPct: [45, 60], rate: 200, hoursRange: [110, 145] },
  ];

  const practiceAreas = ["personal_injury", "family_law", "immigration", "corporate"];

  // ─── Clients with variance ───
  const clients = [
    { id: "cl-great", name: "Apex Industries", collectionMult: 1.0 },
    { id: "cl-good", name: "Wilson Holdings", collectionMult: 0.92 },
    { id: "cl-ok", name: "Metro Services LLC", collectionMult: 0.82 },
    { id: "cl-bad", name: "Discount Mart Inc", collectionMult: 0.55 },
    { id: "cl-terrible", name: "Ghost Ventures", collectionMult: 0.35 },
  ];

  // Generate 12 months of snapshots
  let totalSnaps = 0;

  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Attorney snapshots
    for (const att of attorneys) {
      const hoursWorked = rand(att.hoursRange[0], att.hoursRange[1]);
      const billingRate = rand(att.billingPct[0], att.billingPct[1]);
      const collectionRate = rand(att.collectionPct[0], att.collectionPct[1]);
      const hoursBilled = Math.round(hoursWorked * (billingRate / 100) * 10) / 10;
      const amountBilled = Math.round(hoursBilled * att.rate);
      const amountCollected = Math.round(amountBilled * (collectionRate / 100));
      const potentialRevenue = hoursWorked * att.rate;
      const combinedRate = potentialRevenue > 0 ? Math.round((amountCollected / potentialRevenue) * 1000) / 10 : 0;
      const severity = combinedRate < 50 ? "critical" : combinedRate < 70 ? "warning" : null;

      await prisma.realizationSnapshot.upsert({
        where: { firmId_dimension_dimensionId_period: { firmId, dimension: "ATTORNEY", dimensionId: att.id, period } },
        create: {
          firmId, dimension: "ATTORNEY", dimensionId: att.id, dimensionLabel: att.name, period,
          hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: att.rate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity, trend: monthOffset < 11 ? "stable" : null,
        },
        update: {
          hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: att.rate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
      });
      totalSnaps++;
    }

    // Practice Area snapshots
    for (const pa of practiceAreas) {
      const base = pa === "corporate" ? { billing: [85, 95], collection: [88, 96] }
        : pa === "personal_injury" ? { billing: [70, 82], collection: [65, 80] }
        : pa === "family_law" ? { billing: [75, 88], collection: [72, 85] }
        : { billing: [80, 92], collection: [82, 95] }; // immigration

      const hoursWorked = rand(200, 400);
      const billingRate = rand(base.billing[0], base.billing[1]);
      const collectionRate = rand(base.collection[0], base.collection[1]);
      const avgRate = pa === "corporate" ? 350 : pa === "personal_injury" ? 275 : pa === "family_law" ? 250 : 225;
      const hoursBilled = Math.round(hoursWorked * (billingRate / 100) * 10) / 10;
      const amountBilled = Math.round(hoursBilled * avgRate);
      const amountCollected = Math.round(amountBilled * (collectionRate / 100));
      const potentialRevenue = hoursWorked * avgRate;
      const combinedRate = potentialRevenue > 0 ? Math.round((amountCollected / potentialRevenue) * 1000) / 10 : 0;
      const severity = combinedRate < 50 ? "critical" : combinedRate < 70 ? "warning" : null;

      await prisma.realizationSnapshot.upsert({
        where: { firmId_dimension_dimensionId_period: { firmId, dimension: "PRACTICE_AREA", dimensionId: pa, period } },
        create: {
          firmId, dimension: "PRACTICE_AREA", dimensionId: pa,
          dimensionLabel: pa.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          period, hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: avgRate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
        update: {
          hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: avgRate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
      });
      totalSnaps++;
    }

    // Client snapshots
    for (const cl of clients) {
      const hoursWorked = rand(30, 120);
      const billingRate = rand(70, 92);
      const avgRate = rand(250, 350);
      const hoursBilled = Math.round(hoursWorked * (billingRate / 100) * 10) / 10;
      const amountBilled = Math.round(hoursBilled * avgRate);
      const collectionRate = Math.round(cl.collectionMult * rand(85, 100) * 10) / 10;
      const amountCollected = Math.round(amountBilled * (collectionRate / 100));
      const potentialRevenue = hoursWorked * avgRate;
      const combinedRate = potentialRevenue > 0 ? Math.round((amountCollected / potentialRevenue) * 1000) / 10 : 0;
      const severity = combinedRate < 50 ? "critical" : combinedRate < 70 ? "warning" : null;

      await prisma.realizationSnapshot.upsert({
        where: { firmId_dimension_dimensionId_period: { firmId, dimension: "CLIENT", dimensionId: cl.id, period } },
        create: {
          firmId, dimension: "CLIENT", dimensionId: cl.id, dimensionLabel: cl.name,
          period, hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: avgRate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
        update: {
          hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: avgRate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
      });
      totalSnaps++;
    }

    // Matter Type snapshots (mirrors practice area with slight variation)
    for (const pa of practiceAreas) {
      const hoursWorked = rand(180, 380);
      const billingRate = rand(72, 90);
      const collectionRate = rand(70, 92);
      const avgRate = rand(240, 340);
      const hoursBilled = Math.round(hoursWorked * (billingRate / 100) * 10) / 10;
      const amountBilled = Math.round(hoursBilled * avgRate);
      const amountCollected = Math.round(amountBilled * (collectionRate / 100));
      const potentialRevenue = hoursWorked * avgRate;
      const combinedRate = potentialRevenue > 0 ? Math.round((amountCollected / potentialRevenue) * 1000) / 10 : 0;
      const severity = combinedRate < 50 ? "critical" : combinedRate < 70 ? "warning" : null;

      await prisma.realizationSnapshot.upsert({
        where: { firmId_dimension_dimensionId_period: { firmId, dimension: "MATTER_TYPE", dimensionId: pa, period } },
        create: {
          firmId, dimension: "MATTER_TYPE", dimensionId: pa,
          dimensionLabel: pa.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          period, hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: avgRate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
        update: {
          hoursWorked, hoursBilled, amountBilled, amountCollected, standardRate: avgRate,
          billingRealizationRate: billingRate, collectionRealizationRate: collectionRate,
          combinedRealizationRate: combinedRate, severity,
        },
      });
      totalSnaps++;
    }
  }

  // Now set trends by comparing consecutive months
  const allSnaps = await prisma.realizationSnapshot.findMany({ where: { firmId }, orderBy: { period: "asc" } });
  const byKey = new Map<string, typeof allSnaps>();
  for (const s of allSnaps) {
    const key = `${s.dimension}::${s.dimensionId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(s);
  }

  let trendUpdates = 0;
  for (const [, snaps] of Array.from(byKey)) {
    for (let i = 1; i < snaps.length; i++) {
      const diff = snaps[i].combinedRealizationRate - snaps[i - 1].combinedRealizationRate;
      const trend = diff > 3 ? "improving" : diff < -3 ? "declining" : "stable";
      if (snaps[i].trend !== trend) {
        await prisma.realizationSnapshot.update({ where: { id: snaps[i].id }, data: { trend } });
        trendUpdates++;
      }
    }
  }

  console.log(`Seeded ${totalSnaps} realization snapshots with ${trendUpdates} trend updates.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
