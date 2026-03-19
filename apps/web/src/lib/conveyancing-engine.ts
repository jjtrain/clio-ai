import { db } from "@/lib/db";
import * as lcs from "@/lib/integrations/lcs";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

// ── Matter Management ───────────────────────────────────────────────

export async function createConveyancingMatter(params: {
  matterId: string; clientId: string; transactionType: string; propertyAddress: string;
  salePrice?: number; closingDate?: string | Date; buyerName?: string; sellerName?: string; notes?: string;
  [key: string]: any;
}) {
  const matter = await db.conveyancingMatter.create({
    data: {
      matterId: params.matterId, clientId: params.clientId,
      transactionType: params.transactionType as any, propertyAddress: params.propertyAddress,
      salePrice: params.salePrice || null, closingDate: params.closingDate || null,
      buyerName: params.buyerName || null, sellerName: params.sellerName || null,
      status: "INTAKE", notes: params.notes || null,
    },
  });

  // Sync to LCS if configured
  const config = await db.conveyancingIntegration.findUnique({ where: { provider: "LCS" } });
  if (config?.isEnabled) {
    const lcsResult = await lcs.createMatter({
      transaction_type: params.transactionType, property_address: params.propertyAddress,
      sale_price: params.salePrice, closing_date: params.closingDate ? String(params.closingDate) : undefined,
      buyer_name: params.buyerName, seller_name: params.sellerName,
    });
    if (lcsResult.success) {
      await db.conveyancingMatter.update({
        where: { id: matter.id }, data: { externalMatterId: lcsResult.data.id, provider: "LCS" },
      });
    }
  }

  // Auto-generate checklist
  await generateClosingChecklist(matter.id);

  // Log activity
  await db.conveyancingActivity.create({
    data: {
      conveyancingMatterId: matter.id, activityType: "MATTER_CREATED" as any,
      description: `Conveyancing matter created for ${params.propertyAddress}`,
      metadata: JSON.stringify(params),
    },
  });

  return matter;
}

// ── Closing Checklist ───────────────────────────────────────────────

export async function generateClosingChecklist(conveyancingMatterId: string) {
  const matter = await db.conveyancingMatter.findUnique({ where: { id: conveyancingMatterId }, include: { matter: true } });
  if (!matter) throw new Error("Conveyancing matter not found.");

  // Try to find a matching template
  const template = await db.closingChecklistTemplate.findFirst({
    where: { transactionType: matter.transactionType },
  });

  let items: { title: string; description: string; category: string; order: number; isRequired: boolean }[];

  const templateItems = template ? JSON.parse(template.items) : [];
  if (templateItems.length > 0) {
    items = templateItems.map((t: any, i: number) => ({
      title: t.title, description: t.description || "", category: t.category || "GENERAL",
      order: t.order ?? i, isRequired: t.isRequired ?? true,
    }));
  } else {
    // AI-generate checklist items
    const message = await anthropic.messages.create({
      model: MODEL, max_tokens: 2048,
      messages: [{ role: "user", content: `Generate a closing checklist for a ${matter.transactionType} real estate conveyancing transaction at ${matter.propertyAddress}. Return JSON array of items with fields: title, description, category (TITLE, FINANCIAL, LEGAL, DOCUMENT, INSPECTION), isRequired (boolean). Include 10-15 essential items.` }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    items = parsed.map((p: any, i: number) => ({
      title: p.title, description: p.description || "", category: p.category || "GENERAL",
      order: i, isRequired: p.isRequired ?? true,
    }));
  }

  const serializedItems = items.map((item, i) => ({ ...item, id: `item-${i}`, order: i, status: "not_started" }));
  const checklist = await db.closingChecklist.create({
    data: {
      conveyancingMatterId,
      items: JSON.stringify(serializedItems),
      totalCount: serializedItems.length,
      completedCount: 0,
      completionPercentage: 0,
      lastUpdated: new Date(),
    },
  });

  return checklist;
}

// ── Prorations & Adjustments ────────────────────────────────────────

export async function calculateProrations(conveyancingMatterId: string, closingDate: Date) {
  const matter = await db.conveyancingMatter.findUnique({ where: { id: conveyancingMatterId } });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const yearStart = new Date(closingDate.getFullYear(), 0, 1);
  const daysInYear = 365;
  const dayOfYear = Math.floor((closingDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
  const sellerShare = dayOfYear / daysInYear;
  const buyerShare = 1 - sellerShare;

  const estimatedTax = (matter.salePrice?.toNumber() || 0) * 0.012; // ~1.2% property tax estimate
  const waterSewer = 1200; // annual estimate
  const maintenance = matter.propertyType === "CONDO" || matter.propertyType === "COOP" ? 6000 : 0;

  const adjustments = [
    { type: "PROPERTY_TAX", annual: estimatedTax, sellerAmount: estimatedTax * sellerShare, buyerAmount: estimatedTax * buyerShare },
    { type: "WATER_SEWER", annual: waterSewer, sellerAmount: waterSewer * sellerShare, buyerAmount: waterSewer * buyerShare },
    ...(maintenance > 0 ? [{ type: "MAINTENANCE", annual: maintenance, sellerAmount: maintenance * sellerShare, buyerAmount: maintenance * buyerShare }] : []),
  ];

  const records = [];
  for (const adj of adjustments) {
    const record = await db.closingAdjustment.create({
      data: {
        conveyancingMatterId, adjustmentType: "TAX_PRORATION" as any, prorationType: "ANNUAL" as any,
        description: `${adj.type.replace(/_/g, " ")} proration`,
        totalAmount: adj.annual, adjustedAmount: adj.sellerAmount,
        prorationDate: closingDate,
        daysInPeriod: daysInYear, sellerDays: dayOfYear, buyerDays: daysInYear - dayOfYear,
        creditTo: adj.sellerAmount > adj.buyerAmount ? "BUYER" as any : "SELLER" as any,
      },
    });
    records.push(record);
  }

  return records;
}

// ── Closing Statement ───────────────────────────────────────────────

export async function generateClosingStatement(conveyancingMatterId: string, statementType: "BUYER" | "SELLER") {
  const matter = await db.conveyancingMatter.findUnique({
    where: { id: conveyancingMatterId },
    include: { matter: { include: { client: true } }, adjustments: true },
  });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const price = matter.purchasePrice?.toNumber() || matter.salePrice?.toNumber() || 0;
  const mortgage = matter.mortgageAmount?.toNumber() || 0;
  const deposit = matter.contractDeposit?.toNumber() || 0;
  const transferTax = matter.transferTaxAmount?.toNumber() || 0;

  const buyerDebits = [{ description: "Purchase Price", amount: price }, { description: "Recording Fees", amount: matter.recordingFees?.toNumber() || 0 }];
  const buyerCredits = [{ description: "Mortgage", amount: mortgage }, { description: "Contract Deposit", amount: deposit }];
  const buyerTotalDebits = buyerDebits.reduce((s, d) => s + d.amount, 0);
  const buyerTotalCredits = buyerCredits.reduce((s, c) => s + c.amount, 0);

  const statement = await db.closingStatement.create({
    data: {
      conveyancingMatterId, statementType: statementType as any, status: "DRAFT",
      purchasePrice: price,
      buyerDebits: JSON.stringify(buyerDebits), buyerCredits: JSON.stringify(buyerCredits),
      buyerTotalDebits, buyerTotalCredits, buyerBalanceDue: buyerTotalDebits - buyerTotalCredits,
      sellerDebits: JSON.stringify([{ description: "Transfer Tax", amount: transferTax }]),
      sellerCredits: JSON.stringify([{ description: "Sale Price", amount: price }]),
      sellerTotalDebits: transferTax, sellerTotalCredits: price, sellerNetProceeds: price - transferTax,
      adjustments: JSON.stringify(matter.adjustments.map(a => ({ description: a.description, amount: Number(a.adjustedAmount) }))),
    },
  });

  return statement;
}

// ── Tax Calculations ────────────────────────────────────────────────

export function calculateTransferTax(salePrice: number, state: string, county?: string, propertyType?: string) {
  // NY transfer tax calculation
  const nyStateTax = salePrice * 0.004; // 0.4%
  const mansionTax = salePrice > 1_000_000 ? salePrice * 0.01 : 0; // 1% on sales > $1M
  const supplementalMansionTax = salePrice > 2_000_000 ? salePrice * 0.0025 : 0;

  let countyTax = 0;
  if (county?.toUpperCase() === "NEW YORK" || county?.toUpperCase() === "NYC") {
    countyTax = salePrice * 0.01425; // NYC transfer tax ~1.425% for > $500k
    if (salePrice <= 500_000) countyTax = salePrice * 0.01;
  }

  return {
    salePrice, state, county, propertyType,
    breakdown: {
      stateTransferTax: nyStateTax, mansionTax, supplementalMansionTax, countyTax,
    },
    total: nyStateTax + mansionTax + supplementalMansionTax + countyTax,
  };
}

export function calculateMortgageTax(mortgageAmount: number, state: string, county?: string) {
  // NY mortgage recording tax
  const stateTax = mortgageAmount * 0.005; // 0.5% state
  let localTax = 0;
  if (county?.toUpperCase() === "NEW YORK" || county?.toUpperCase() === "NYC") {
    localTax = mortgageAmount > 500_000 ? mortgageAmount * 0.01925 : mortgageAmount * 0.018;
  } else {
    localTax = mortgageAmount * 0.005; // 0.5% local default
  }

  return {
    mortgageAmount, state, county,
    breakdown: { stateMortgageTax: stateTax, localMortgageTax: localTax },
    total: stateTax + localTax,
  };
}

// ── Title Exceptions ────────────────────────────────────────────────

export async function trackTitleExceptions(conveyancingMatterId: string) {
  const matter = await db.conveyancingMatter.findUnique({
    where: { id: conveyancingMatterId }, include: { titleExceptions: true },
  });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const open = matter.titleExceptions.filter((e: any) => e.status === "OPEN");
  const cleared = matter.titleExceptions.filter((e: any) => e.status === "CLEARED");
  const total = matter.titleExceptions.length;

  return {
    total, open: open.length, cleared: cleared.length,
    allCleared: open.length === 0 && total > 0,
    exceptions: matter.titleExceptions,
  };
}

export async function clearTitleException(exceptionId: string, params: { clearedBy: string; clearanceMethod: string; notes?: string }) {
  const exception = await db.titleException.update({
    where: { id: exceptionId },
    data: { status: "CLEARED", clearedBy: params.clearedBy, clearanceMethod: params.clearanceMethod, clearedDate: new Date(), notes: params.notes || null },
  });

  await db.conveyancingActivity.create({
    data: {
      conveyancingMatterId: exception.conveyancingMatterId, activityType: "TITLE_CLEARED" as any,
      description: `Title exception cleared: ${exception.description || exception.id}`,
      metadata: JSON.stringify(params),
    },
  });

  return exception;
}

// ── Document Generation ─────────────────────────────────────────────

export async function generateDocument(conveyancingMatterId: string, documentType: string) {
  const matter = await db.conveyancingMatter.findUnique({
    where: { id: conveyancingMatterId }, include: { matter: { include: { client: true } } },
  });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const message = await anthropic.messages.create({
    model: MODEL, max_tokens: 8192,
    messages: [{ role: "user", content: `Generate a ${documentType} document for this real estate conveyancing transaction. Return as HTML.

Property: ${matter.propertyAddress}
Transaction Type: ${matter.transactionType}
Sale Price: $${matter.salePrice?.toNumber() || 0}
Buyer: ${matter.buyerName || "TBD"} | Seller: ${matter.sellerName || "TBD"}
Closing Date: ${matter.closingDate?.toISOString() || "TBD"}
Client: ${matter.matter.client.name} | Matter: ${matter.matter.name}

Generate a professional, jurisdiction-appropriate document.` }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  return { documentType, content, generatedAt: new Date().toISOString() };
}

// ── Closing Costs ───────────────────────────────────────────────────

export async function getClosingCosts(conveyancingMatterId: string) {
  const matter = await db.conveyancingMatter.findUnique({ where: { id: conveyancingMatterId } });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const salePrice = matter.salePrice?.toNumber() || 0;
  const transferTax = calculateTransferTax(salePrice, "NY");
  const titleInsurance = salePrice * 0.004;
  const attorneyFee = 2500;
  const recordingFees = 500;
  const titleSearch = 750;

  const buyerCosts = {
    titleInsurance, attorneyFee, recordingFees, titleSearch,
    miscellaneous: 500, total: titleInsurance + attorneyFee + recordingFees + titleSearch + 500,
  };
  const sellerCosts = {
    transferTax: transferTax.total, attorneyFee, recordingFees: 250,
    satisfactionFees: 150, miscellaneous: 300,
    total: transferTax.total + attorneyFee + 250 + 150 + 300,
  };

  return { salePrice, buyerCosts, sellerCosts, combinedTotal: buyerCosts.total + sellerCosts.total };
}

// ── Closing Package ─────────────────────────────────────────────────

export async function generateClosingPackage(conveyancingMatterId: string) {
  const matter = await db.conveyancingMatter.findUnique({
    where: { id: conveyancingMatterId },
    include: { matter: { include: { client: true } }, adjustments: true, statements: true, titleExceptions: true, checklists: true },
  });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const docTypes = ["DEED", "CLOSING_STATEMENT", "TITLE_REPORT", "TRANSFER_TAX_RETURN", "AFFIDAVIT_OF_TITLE"];
  const documents = [];
  for (const docType of docTypes) {
    const doc = await generateDocument(conveyancingMatterId, docType);
    documents.push(doc);
  }

  await db.conveyancingActivity.create({
    data: {
      conveyancingMatterId, activityType: "DOCUMENT_GENERATED" as any,
      description: `Closing package generated with ${documents.length} documents`,
      metadata: JSON.stringify({ documentTypes: docTypes }),
    },
  });

  return {
    matterId: matter.id, propertyAddress: matter.propertyAddress,
    documents: documents.map(d => ({ type: d.documentType, generatedAt: d.generatedAt })),
    adjustments: matter.adjustments.length, statements: matter.statements.length,
    titleExceptions: matter.titleExceptions.length,
  };
}

// ── Closing Readiness ───────────────────────────────────────────────

export async function checkClosingReadiness(conveyancingMatterId: string) {
  const matter = await db.conveyancingMatter.findUnique({
    where: { id: conveyancingMatterId },
    include: { checklists: true, titleExceptions: true, statements: true, adjustments: true },
  });
  if (!matter) throw new Error("Conveyancing matter not found.");

  const blockers: string[] = [];
  const warnings: string[] = [];

  // Check checklist completion
  const allItems = matter.checklists.flatMap(c => c.items);
  const completedItems = allItems.filter((i: any) => i.status === "COMPLETED");
  const requiredIncomplete = allItems.filter((i: any) => i.isRequired && i.status !== "COMPLETED");
  const completionPercentage = allItems.length > 0 ? Math.round((completedItems.length / allItems.length) * 100) : 0;
  if (requiredIncomplete.length > 0) blockers.push(`${requiredIncomplete.length} required checklist items incomplete`);

  // Check title exceptions
  const openExceptions = matter.titleExceptions.filter((e: any) => e.status === "OPEN");
  if (openExceptions.length > 0) blockers.push(`${openExceptions.length} unresolved title exceptions`);

  // Check closing statements
  if (matter.statements.length === 0) warnings.push("No closing statements generated");

  // Check closing date
  if (!matter.closingDate) blockers.push("No closing date set");
  else if (matter.closingDate < new Date()) warnings.push("Closing date is in the past");

  // Check financials
  if (matter.adjustments.length === 0) warnings.push("No adjustments/prorations calculated");

  return {
    readyToClose: blockers.length === 0,
    blockers, warnings, completionPercentage,
    summary: {
      checklistItems: { total: allItems.length, completed: completedItems.length },
      titleExceptions: { total: matter.titleExceptions.length, open: openExceptions.length },
      statements: matter.statements.length,
      adjustments: matter.adjustments.length,
    },
  };
}

// ── Post-Closing ────────────────────────────────────────────────────

export async function postClosingWorkflow(conveyancingMatterId: string) {
  const matter = await db.conveyancingMatter.findUnique({
    where: { id: conveyancingMatterId }, include: { matter: true },
  });
  if (!matter) throw new Error("Conveyancing matter not found.");

  await db.conveyancingMatter.update({ where: { id: conveyancingMatterId }, data: { status: "POST_CLOSING" } });

  const tasks = [
    { title: "Record deed with county clerk", dueInDays: 5, category: "RECORDING" },
    { title: "Record mortgage/deed of trust", dueInDays: 5, category: "RECORDING" },
    { title: "Disburse funds per closing statement", dueInDays: 1, category: "FINANCIAL" },
    { title: "Send title insurance policy", dueInDays: 30, category: "TITLE" },
    { title: "File transfer tax returns", dueInDays: 15, category: "TAX" },
    { title: "Send closing package to client", dueInDays: 3, category: "CLIENT" },
    { title: "Update property records", dueInDays: 10, category: "RECORDING" },
    { title: "Confirm mortgage payoff received", dueInDays: 7, category: "FINANCIAL" },
  ];

  const now = new Date();
  for (const task of tasks) {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + task.dueInDays);
    await db.task.create({
      data: {
        matterId: matter.matterId, title: task.title,
        description: `Post-closing task: ${task.title}`, dueDate,
        status: "PENDING" as any, priority: "HIGH" as any,
      },
    });
  }

  await db.conveyancingActivity.create({
    data: {
      conveyancingMatterId, activityType: "STATUS_CHANGED" as any,
      description: `Post-closing workflow initiated with ${tasks.length} tasks`,
      metadata: JSON.stringify({ tasks: tasks.map(t => t.title) }),
    },
  });

  return tasks.map(t => ({ ...t, dueDate: new Date(now.getTime() + t.dueInDays * 86400000) }));
}

// ── Templates ───────────────────────────────────────────────────────

export async function initializeDefaultTemplates() {
  const templates = [
    { name: "Residential Purchase", transactionType: "PURCHASE", items: [
      { title: "Order title search", category: "TITLE", order: 0, isRequired: true },
      { title: "Review title report", category: "TITLE", order: 1, isRequired: true },
      { title: "Obtain survey", category: "DOCUMENT", order: 2, isRequired: true },
      { title: "Review contract of sale", category: "LEGAL", order: 3, isRequired: true },
      { title: "Order municipal searches", category: "TITLE", order: 4, isRequired: true },
      { title: "Confirm mortgage commitment", category: "FINANCIAL", order: 5, isRequired: true },
      { title: "Calculate closing adjustments", category: "FINANCIAL", order: 6, isRequired: true },
      { title: "Prepare closing statement", category: "FINANCIAL", order: 7, isRequired: true },
      { title: "Schedule closing", category: "GENERAL", order: 8, isRequired: true },
      { title: "Prepare deed", category: "DOCUMENT", order: 9, isRequired: true },
    ]},
    { name: "Residential Sale", transactionType: "SALE", items: [
      { title: "Gather property documents", category: "DOCUMENT", order: 0, isRequired: true },
      { title: "Review contract of sale", category: "LEGAL", order: 1, isRequired: true },
      { title: "Order payoff statement", category: "FINANCIAL", order: 2, isRequired: true },
      { title: "Resolve title exceptions", category: "TITLE", order: 3, isRequired: true },
      { title: "Prepare transfer tax returns", category: "TAX", order: 4, isRequired: true },
      { title: "Calculate closing adjustments", category: "FINANCIAL", order: 5, isRequired: true },
      { title: "Prepare closing statement", category: "FINANCIAL", order: 6, isRequired: true },
      { title: "Prepare deed for execution", category: "DOCUMENT", order: 7, isRequired: true },
    ]},
    { name: "Refinance", transactionType: "REFINANCE", items: [
      { title: "Order title search", category: "TITLE", order: 0, isRequired: true },
      { title: "Review title report", category: "TITLE", order: 1, isRequired: true },
      { title: "Obtain payoff statement", category: "FINANCIAL", order: 2, isRequired: true },
      { title: "Review mortgage documents", category: "LEGAL", order: 3, isRequired: true },
      { title: "Prepare closing statement", category: "FINANCIAL", order: 4, isRequired: true },
      { title: "Schedule closing", category: "GENERAL", order: 5, isRequired: true },
    ]},
    { name: "Condo Purchase", transactionType: "CONDO", items: [
      { title: "Order title search", category: "TITLE", order: 0, isRequired: true },
      { title: "Review offering plan", category: "LEGAL", order: 1, isRequired: true },
      { title: "Review condo board financials", category: "FINANCIAL", order: 2, isRequired: true },
      { title: "Board application and approval", category: "LEGAL", order: 3, isRequired: true },
      { title: "Lien search on unit", category: "TITLE", order: 4, isRequired: true },
      { title: "Confirm maintenance/common charges", category: "FINANCIAL", order: 5, isRequired: true },
      { title: "Calculate closing adjustments", category: "FINANCIAL", order: 6, isRequired: true },
      { title: "Prepare closing statement", category: "FINANCIAL", order: 7, isRequired: true },
    ]},
    { name: "Commercial Purchase", transactionType: "COMMERCIAL", items: [
      { title: "Order title search", category: "TITLE", order: 0, isRequired: true },
      { title: "Environmental assessment (Phase I)", category: "INSPECTION", order: 1, isRequired: true },
      { title: "Review lease agreements", category: "LEGAL", order: 2, isRequired: true },
      { title: "Zoning compliance review", category: "LEGAL", order: 3, isRequired: true },
      { title: "Obtain survey and site plan", category: "DOCUMENT", order: 4, isRequired: true },
      { title: "Review financial statements", category: "FINANCIAL", order: 5, isRequired: true },
      { title: "Calculate closing adjustments", category: "FINANCIAL", order: 6, isRequired: true },
      { title: "Prepare closing statement", category: "FINANCIAL", order: 7, isRequired: true },
      { title: "Prepare deed and transfer documents", category: "DOCUMENT", order: 8, isRequired: true },
    ]},
  ];

  let count = 0;
  for (const tmpl of templates) {
    const existing = await db.closingChecklistTemplate.findFirst({ where: { transactionType: tmpl.transactionType as any } });
    if (!existing) {
      await db.closingChecklistTemplate.create({
        data: {
          name: tmpl.name, transactionType: tmpl.transactionType as any,
          role: (tmpl as any).role || "BUYER_ATTORNEY" as any,
          items: JSON.stringify(tmpl.items),
        },
      });
      count++;
    }
  }

  return count;
}
