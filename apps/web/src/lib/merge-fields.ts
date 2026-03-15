// Merge field system for document templates

export interface MergeField {
  key: string;
  label: string;
  source: string;
  path: string;
}

export interface MergeFieldSetDef {
  name: string;
  description: string;
  fields: MergeField[];
}

export const SYSTEM_FIELD_SETS: Record<string, MergeFieldSetDef> = {
  CLIENT_FIELDS: {
    name: "Client Fields",
    description: "Fields populated from the linked client record",
    fields: [
      { key: "CLIENT_NAME", label: "Client full name", source: "client", path: "name" },
      { key: "CLIENT_EMAIL", label: "Client email", source: "client", path: "email" },
      { key: "CLIENT_PHONE", label: "Client phone", source: "client", path: "phone" },
      { key: "CLIENT_ADDRESS", label: "Client address", source: "client", path: "address" },
    ],
  },
  MATTER_FIELDS: {
    name: "Matter Fields",
    description: "Fields populated from the linked matter record",
    fields: [
      { key: "MATTER_NAME", label: "Matter name", source: "matter", path: "name" },
      { key: "MATTER_NUMBER", label: "Matter number", source: "matter", path: "matterNumber" },
      { key: "PRACTICE_AREA", label: "Practice area", source: "matter", path: "practiceArea" },
      { key: "MATTER_DESCRIPTION", label: "Matter description", source: "matter", path: "description" },
      { key: "OPEN_DATE", label: "Matter open date", source: "matter", path: "openDate" },
    ],
  },
  FIRM_FIELDS: {
    name: "Firm Fields",
    description: "Fields populated from firm settings",
    fields: [
      { key: "FIRM_NAME", label: "Firm name", source: "settings", path: "firmName" },
      { key: "FIRM_ADDRESS", label: "Full firm address", source: "settings", path: "fullAddress" },
      { key: "FIRM_PHONE", label: "Firm phone", source: "settings", path: "phone" },
      { key: "FIRM_EMAIL", label: "Firm email", source: "settings", path: "email" },
      { key: "FIRM_WEBSITE", label: "Firm website", source: "settings", path: "website" },
    ],
  },
  ATTORNEY_FIELDS: {
    name: "Attorney Fields",
    description: "Fields populated from the current user/attorney",
    fields: [
      { key: "ATTORNEY_NAME", label: "Attorney name", source: "user", path: "name" },
      { key: "ATTORNEY_EMAIL", label: "Attorney email", source: "user", path: "email" },
      { key: "ATTORNEY_PHONE", label: "Attorney phone", source: "user", path: "phone" },
    ],
  },
  DATE_FIELDS: {
    name: "Date Fields",
    description: "Auto-populated date fields",
    fields: [
      { key: "TODAY", label: "Today's date (MM/DD/YYYY)", source: "date", path: "today" },
      { key: "TODAY_LONG", label: "Today's date (long format)", source: "date", path: "todayLong" },
      { key: "CURRENT_YEAR", label: "Current year", source: "date", path: "year" },
    ],
  },
  OPPOSING_PARTY_FIELDS: {
    name: "Opposing Party Fields",
    description: "Fields from opposing parties on the matter",
    fields: [
      { key: "OPPOSING_PARTY_NAME", label: "Opposing party name", source: "relatedParty", path: "opposingParty" },
      { key: "OPPOSING_COUNSEL_NAME", label: "Opposing counsel name", source: "relatedParty", path: "opposingCounsel" },
      { key: "OPPOSING_COUNSEL_FIRM", label: "Opposing counsel firm", source: "relatedParty", path: "opposingCounselFirm" },
    ],
  },
  COURT_FIELDS: {
    name: "Court Fields",
    description: "Court-related fields (manually filled per document)",
    fields: [
      { key: "COURT_NAME", label: "Court name", source: "custom", path: "" },
      { key: "CASE_NUMBER", label: "Case number", source: "custom", path: "" },
      { key: "JUDGE_NAME", label: "Judge name", source: "custom", path: "" },
      { key: "COURT_ADDRESS", label: "Court address", source: "custom", path: "" },
    ],
  },
};

export function getSystemMergeFields(): MergeFieldSetDef[] {
  return Object.values(SYSTEM_FIELD_SETS);
}

export function getAllSystemFieldKeys(): string[] {
  return Object.values(SYSTEM_FIELD_SETS).flatMap((s) => s.fields.map((f) => f.key));
}

export async function resolveFields(
  db: any,
  matterId?: string,
  clientId?: string
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};

  // Date fields
  const now = new Date();
  resolved.TODAY = `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getDate().toString().padStart(2, "0")}/${now.getFullYear()}`;
  resolved.TODAY_LONG = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  resolved.CURRENT_YEAR = now.getFullYear().toString();

  // Firm fields
  const settings = await db.settings.findUnique({ where: { id: "default" } });
  if (settings) {
    resolved.FIRM_NAME = settings.firmName || "";
    resolved.FIRM_ADDRESS = [settings.address, settings.city, settings.state, settings.zip].filter(Boolean).join(", ");
    resolved.FIRM_PHONE = settings.phone || "";
    resolved.FIRM_EMAIL = settings.email || "";
    resolved.FIRM_WEBSITE = settings.website || "";
  }

  // Matter fields
  let matter: any = null;
  if (matterId) {
    matter = await db.matter.findUnique({
      where: { id: matterId },
      include: { client: true, relatedParties: true },
    });
    if (matter) {
      resolved.MATTER_NAME = matter.name || "";
      resolved.MATTER_NUMBER = matter.matterNumber || "";
      resolved.PRACTICE_AREA = matter.practiceArea || "";
      resolved.MATTER_DESCRIPTION = matter.description || "";
      resolved.OPEN_DATE = matter.openDate ? new Date(matter.openDate).toLocaleDateString("en-US") : "";

      // Client from matter
      if (matter.client) {
        resolved.CLIENT_NAME = matter.client.name || "";
        resolved.CLIENT_EMAIL = matter.client.email || "";
        resolved.CLIENT_PHONE = matter.client.phone || "";
        resolved.CLIENT_ADDRESS = matter.client.address || "";
      }

      // Opposing parties
      if (matter.relatedParties?.length) {
        const opposing = matter.relatedParties.find((rp: any) => rp.role === "OPPOSING_PARTY");
        const counsel = matter.relatedParties.find((rp: any) => rp.role === "OPPOSING_COUNSEL");
        if (opposing) resolved.OPPOSING_PARTY_NAME = opposing.name || "";
        if (counsel) {
          resolved.OPPOSING_COUNSEL_NAME = counsel.name || "";
          resolved.OPPOSING_COUNSEL_FIRM = counsel.company || "";
        }
      }
    }
  }

  // Client fields (direct, if no matter or override)
  if (clientId && !matter?.client) {
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (client) {
      resolved.CLIENT_NAME = client.name || "";
      resolved.CLIENT_EMAIL = client.email || "";
      resolved.CLIENT_PHONE = client.phone || "";
      resolved.CLIENT_ADDRESS = client.address || "";
    }
  }

  return resolved;
}

export function applyMergeFields(template: string, fields: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(fields)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val || `[${key}]`);
  }
  // Highlight unresolved fields in yellow
  result = result.replace(/\{\{(\w+)\}\}/g, '<span style="background:#FEF3C7;padding:2px 4px;border-radius:2px;">[$1]</span>');
  return result;
}

export function extractUsedFields(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, ""))));
}

export function validateTemplate(
  template: string,
  availableFields: string[]
): { valid: boolean; missingFields: string[]; unusedFields: string[] } {
  const used = extractUsedFields(template);
  const missingFields = used.filter((f) => !availableFields.includes(f));
  const unusedFields = availableFields.filter((f) => !used.includes(f));
  return { valid: missingFields.length === 0, missingFields, unusedFields };
}
