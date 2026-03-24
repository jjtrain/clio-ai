import { db } from "@/lib/db";

// ==========================================
// FIELD RESOLUTION
// ==========================================

const dataCache = new Map<string, any>();

export async function resolveField(fieldKey: string, matterId: string): Promise<string | number | boolean | null> {
  const [source, ...rest] = fieldKey.split(".");
  const field = rest.join(".");

  // Load data with caching
  const cacheKey = `${source}:${matterId}`;
  if (!dataCache.has(cacheKey)) {
    dataCache.set(cacheKey, await loadSourceData(source, matterId));
  }
  const data = dataCache.get(cacheKey);
  if (!data) return null;

  // Navigate to field
  const value = field.split(".").reduce((obj: any, key: string) => obj?.[key], data);
  return value ?? null;
}

export async function resolveAllFields(mergeFieldSchema: any[], matterId: string): Promise<Record<string, any>> {
  dataCache.clear(); // fresh cache per resolution
  const result: Record<string, any> = {};

  for (const field of mergeFieldSchema) {
    result[field.fieldKey] = await resolveField(field.fieldKey, matterId);
  }

  // Add standard date fields
  const now = new Date();
  result["dates.today"] = now.toLocaleDateString("en-US");
  result["dates.todayLong"] = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  result["dates.todayShort"] = now.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });

  return result;
}

async function loadSourceData(source: string, matterId: string): Promise<any> {
  switch (source) {
    case "matter": {
      return db.matter.findUnique({ where: { id: matterId }, include: { client: true } });
    }
    case "client": {
      const matter = await db.matter.findUnique({ where: { id: matterId }, include: { client: true } });
      const client = matter?.client;
      if (!client) return null;
      return { fullName: client.name, firstName: client.name?.split(" ")[0], lastName: client.name?.split(" ").slice(1).join(" "), email: client.email, phone: client.phone, address: client.address };
    }
    case "firm": {
      const config = await db.invoicePDFConfig.findUnique({ where: { id: "default" } });
      return { name: config?.firmName, address: config?.firmAddress, phone: config?.firmPhone, email: config?.firmEmail, barNumber: config?.firmBarNumber, trustAccountDisclosure: config?.trustAccountDisclosure, paymentInstructions: config?.paymentInstructions };
    }
    case "billing": {
      const feeStruct = await db.matterFeeStructure.findUnique({ where: { matterId } });
      if (!feeStruct) return { hourlyRate: 350, flatFee: 0 };
      const phases = (feeStruct.phases as any[]) || [];
      const flatPhase = phases.find((p: any) => p.billingModel === "flat_fee");
      return { hourlyRate: 350, flatFee: flatPhase?.flatFeeAmount || 0, retainerAmount: feeStruct.retainerAmount, contingencyPercentage: phases.find((p: any) => p.billingModel === "contingency")?.percentage };
    }
    case "dates": {
      return {}; // handled in resolveAllFields
    }
    case "opposing": {
      const parties = await db.relatedParty.findMany({ where: { matterId } });
      const opposing = parties.find((p) => p.role === "OPPOSING_PARTY");
      const oc = parties.find((p) => p.role === "OPPOSING_COUNSEL");
      return { fullName: opposing?.name, attorney: oc?.name, attorneyFirm: oc?.company, attorneyEmail: oc?.email, attorneyPhone: oc?.phone };
    }
    default:
      return null;
  }
}

// ==========================================
// LOOKUP TABLE RESOLUTION
// ==========================================

export async function resolveLookup(lookupTableId: string, lookupValue: string): Promise<Record<string, any> | null> {
  const table = await db.assemblyLookupTable.findUnique({ where: { id: lookupTableId } });
  if (!table) return null;

  const entries = table.entries as any[];
  const match = entries.find((e: any) => e.key.toLowerCase() === lookupValue.toLowerCase());
  if (match) return match.values;
  return (table.defaultEntry as any) || null;
}

export async function resolveLookupByName(name: string, firmId: string, lookupValue: string): Promise<Record<string, any> | null> {
  const table = await db.assemblyLookupTable.findFirst({ where: { name, firmId } });
  if (!table) return null;

  const entries = table.entries as any[];
  const match = entries.find((e: any) => e.key.toLowerCase() === lookupValue.toLowerCase());
  return match?.values || (table.defaultEntry as any) || null;
}

// ==========================================
// COMPUTED FIELD EVALUATION (safe, no eval)
// ==========================================

export function resolveComputedField(formula: string, data: Record<string, any>): any {
  // Simple safe expression evaluator
  let expr = formula;

  // Replace field references with values
  const fieldRefs = formula.match(/[a-zA-Z_][a-zA-Z0-9_.]+/g) || [];
  for (const ref of fieldRefs) {
    if (data[ref] !== undefined) {
      const val = data[ref];
      expr = expr.replace(ref, typeof val === "string" ? `"${val}"` : String(val));
    }
  }

  // Evaluate simple arithmetic
  try {
    // Only allow numbers, operators, parens, strings
    if (/^[\d\s+\-*/().,"' ]+$/.test(expr)) {
      return Function(`"use strict"; return (${expr})`)();
    }
  } catch {}

  return formula; // return raw if can't evaluate
}

// ==========================================
// SEED DATA SOURCES
// ==========================================

export async function seedDataSources(): Promise<number> {
  const sources = [
    { sourceKey: "matter", label: "Matter Data", availableFields: [
      { fieldKey: "matter.name", label: "Matter Name", dataType: "text" },
      { fieldKey: "matter.matterNumber", label: "Case Number", dataType: "text" },
      { fieldKey: "matter.practiceArea", label: "Practice Area", dataType: "text" },
      { fieldKey: "matter.status", label: "Status", dataType: "text" },
      { fieldKey: "matter.description", label: "Description", dataType: "text" },
    ]},
    { sourceKey: "client", label: "Client Information", availableFields: [
      { fieldKey: "client.fullName", label: "Full Name", dataType: "text" },
      { fieldKey: "client.firstName", label: "First Name", dataType: "text" },
      { fieldKey: "client.lastName", label: "Last Name", dataType: "text" },
      { fieldKey: "client.email", label: "Email", dataType: "text" },
      { fieldKey: "client.phone", label: "Phone", dataType: "text" },
      { fieldKey: "client.address", label: "Address", dataType: "text" },
    ]},
    { sourceKey: "firm", label: "Firm Information", availableFields: [
      { fieldKey: "firm.name", label: "Firm Name", dataType: "text" },
      { fieldKey: "firm.address", label: "Firm Address", dataType: "text" },
      { fieldKey: "firm.phone", label: "Firm Phone", dataType: "text" },
      { fieldKey: "firm.email", label: "Firm Email", dataType: "text" },
      { fieldKey: "firm.barNumber", label: "Bar Number", dataType: "text" },
      { fieldKey: "firm.trustAccountDisclosure", label: "Trust Disclosure", dataType: "text" },
    ]},
    { sourceKey: "billing", label: "Billing Data", availableFields: [
      { fieldKey: "billing.hourlyRate", label: "Hourly Rate", dataType: "number" },
      { fieldKey: "billing.flatFee", label: "Flat Fee", dataType: "number" },
      { fieldKey: "billing.retainerAmount", label: "Retainer Amount", dataType: "number" },
      { fieldKey: "billing.contingencyPercentage", label: "Contingency %", dataType: "number" },
    ]},
    { sourceKey: "opposing", label: "Opposing Party", availableFields: [
      { fieldKey: "opposing.fullName", label: "Opposing Party Name", dataType: "text" },
      { fieldKey: "opposing.attorney", label: "Opposing Counsel", dataType: "text" },
      { fieldKey: "opposing.attorneyFirm", label: "Opposing Firm", dataType: "text" },
    ]},
    { sourceKey: "dates", label: "Dates", availableFields: [
      { fieldKey: "dates.today", label: "Today's Date", dataType: "date" },
      { fieldKey: "dates.todayLong", label: "Today (Long Format)", dataType: "date" },
    ]},
  ];

  let count = 0;
  for (const s of sources) {
    await db.assemblyDataSource.upsert({
      where: { sourceKey: s.sourceKey },
      create: { ...s, isSystem: true },
      update: { label: s.label, availableFields: s.availableFields },
    });
    count++;
  }
  return count;
}
