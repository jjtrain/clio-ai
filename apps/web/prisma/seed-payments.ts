import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding payment methods...");

  const methods = [
    { id: "pm-visa-4242", clientName: "John Smith", clientEmail: "john.smith@example.com", methodType: "credit_card", cardBrand: "visa", lastFour: "4242", expiryMonth: 8, expiryYear: 2027, processorToken: "tok_sim_visa4242", isDefault: true },
    { id: "pm-mc-8888", clientName: "Maria Rodriguez", clientEmail: "maria.r@example.com", methodType: "credit_card", cardBrand: "mastercard", lastFour: "8888", expiryMonth: 12, expiryYear: 2026, processorToken: "tok_sim_mc8888", isDefault: true },
  ];

  for (const m of methods) {
    await prisma.clientPaymentMethod.upsert({
      where: { id: m.id },
      create: { ...m, isActive: true, verifiedAt: new Date(), firmId: FIRM_ID },
      update: {},
    });
  }

  console.log("Seeding payment plans...");
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  if (!firstMatter) { console.log("No open matter — skipping."); return; }

  // Plan 1: Flat fee installment (active, auto-pay)
  const plan1 = await prisma.autoPayPlan.upsert({
    where: { id: "plan-flat-fee-1" },
    create: {
      id: "plan-flat-fee-1",
      matterId: firstMatter.id,
      matterName: firstMatter.name,
      clientName: "John Smith",
      clientEmail: "john.smith@example.com",
      planName: "Smith — Flat Fee Installments",
      planType: "flat_fee_installment",
      billingType: "flat_fee",
      totalAmount: 12000,
      totalPaid: 5000,
      remainingBalance: 7000,
      installmentAmount: 1000,
      installmentCount: 12,
      completedInstallments: 5,
      frequency: "monthly_1st",
      startDate: new Date("2025-10-01"),
      nextPaymentDate: new Date("2026-04-01"),
      lastPaymentDate: new Date("2026-03-01"),
      lastPaymentAmount: 1000,
      autoPayEnabled: true,
      paymentMethodId: "pm-visa-4242",
      depositAccount: "operating",
      status: "active",
      clientSignedAt: new Date("2025-09-28"),
      userId: USER_ID,
      firmId: FIRM_ID,
    },
    update: {},
  });

  // Generate scheduled payments for plan 1
  for (let i = 1; i <= 12; i++) {
    const date = new Date("2025-10-01");
    date.setMonth(date.getMonth() + i - 1);
    await prisma.scheduledPayment.upsert({
      where: { id: `sp-plan1-${i}` },
      create: {
        id: `sp-plan1-${i}`,
        planId: plan1.id,
        matterId: firstMatter.id,
        sequenceNumber: i,
        scheduledDate: date,
        amount: 1000,
        totalDue: 1000,
        status: i <= 5 ? "completed" : "scheduled",
        completedAt: i <= 5 ? date : null,
        transactionId: i <= 5 ? `txn_sim_plan1_${i}` : null,
        userId: USER_ID,
        firmId: FIRM_ID,
      },
      update: {},
    });
  }

  // Plan 2: Retainer replenishment
  await prisma.autoPayPlan.upsert({
    where: { id: "plan-retainer-1" },
    create: {
      id: "plan-retainer-1",
      matterId: firstMatter.id,
      clientName: "Maria Rodriguez",
      clientEmail: "maria.r@example.com",
      planName: "Rodriguez — Retainer Replenishment",
      planType: "retainer_replenishment",
      billingType: "hourly",
      installmentAmount: 5000,
      frequency: "monthly_1st",
      startDate: new Date("2025-12-01"),
      autoPayEnabled: true,
      paymentMethodId: "pm-mc-8888",
      retainerMinBalance: 1000,
      retainerTargetBalance: 5000,
      currentRetainerBalance: 3200,
      depositAccount: "trust",
      status: "active",
      totalPaid: 10000,
      completedInstallments: 2,
      userId: USER_ID,
      firmId: FIRM_ID,
    },
    update: {},
  });

  // Plan 3: Manual payment arrangement with missed payment
  await prisma.autoPayPlan.upsert({
    where: { id: "plan-arrangement-1" },
    create: {
      id: "plan-arrangement-1",
      matterId: firstMatter.id,
      clientName: "Angela Davis",
      clientEmail: "angela.d@example.com",
      planName: "Davis — Payment Arrangement",
      planType: "payment_arrangement",
      billingType: "flat_fee",
      totalAmount: 7500,
      totalPaid: 1875,
      remainingBalance: 5625,
      installmentAmount: 625,
      installmentCount: 12,
      completedInstallments: 3,
      frequency: "monthly_15th",
      startDate: new Date("2025-12-15"),
      autoPayEnabled: false,
      depositAccount: "operating",
      status: "active",
      missedPayments: 1,
      consecutiveMissed: 0,
      userId: USER_ID,
      firmId: FIRM_ID,
    },
    update: {},
  });

  // Plan 4: Completed
  await prisma.autoPayPlan.upsert({
    where: { id: "plan-completed-1" },
    create: {
      id: "plan-completed-1",
      matterId: firstMatter.id,
      clientName: "Robert Chen",
      clientEmail: "robert.c@example.com",
      planName: "Chen — Flat Fee (Completed)",
      planType: "flat_fee_installment",
      billingType: "flat_fee",
      totalAmount: 3000,
      totalPaid: 3000,
      remainingBalance: 0,
      installmentAmount: 500,
      installmentCount: 6,
      completedInstallments: 6,
      frequency: "monthly_1st",
      startDate: new Date("2025-06-01"),
      status: "completed",
      userId: USER_ID,
      firmId: FIRM_ID,
    },
    update: {},
  });

  // Seed receipts
  console.log("Seeding receipts...");
  for (let i = 1; i <= 5; i++) {
    await prisma.paymentReceipt.upsert({
      where: { receiptNumber: `REC-2026-${String(i).padStart(4, "0")}` },
      create: {
        transactionId: `txn_sim_plan1_${i}`,
        matterId: firstMatter.id,
        planId: plan1.id,
        receiptNumber: `REC-2026-${String(i).padStart(4, "0")}`,
        clientName: "John Smith",
        clientEmail: "john.smith@example.com",
        amount: 1000,
        paymentMethod: "Visa ending in 4242",
        paymentDate: new Date(2025, 9 + i - 1, 1),
        description: `Installment ${i} of 12 — Smith Flat Fee`,
        depositAccount: "operating",
        sentVia: { portal: true, email: true },
        firmId: FIRM_ID,
      },
      update: {},
    });
  }

  console.log("Payment plans seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
