import type { FieldMapping } from "./types";

export function applyFieldMappings(sourceRecord: Record<string, any>, mappings: FieldMapping[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const mapping of mappings) {
    let value = sourceRecord[mapping.sourceField];
    if (mapping.transform === "combine_name" && sourceRecord.firstName && sourceRecord.lastName) {
      value = `${sourceRecord.firstName} ${sourceRecord.lastName}`.trim();
    } else if (mapping.transform === "lowercase") {
      value = String(value || "").toLowerCase();
    } else if (mapping.transform === "to_date") {
      value = value ? new Date(value).toISOString() : null;
    }
    result[mapping.destField] = value;
  }
  return result;
}

export const DEFAULT_CONTACT_MAPPINGS: FieldMapping[] = [
  { sourceField: "firstName", destField: "firstName" }, { sourceField: "lastName", destField: "lastName" },
  { sourceField: "email", destField: "email" }, { sourceField: "phone", destField: "phone" },
  { sourceField: "type", destField: "type" },
];

export const DEFAULT_MATTER_MAPPINGS: FieldMapping[] = [
  { sourceField: "name", destField: "name" }, { sourceField: "status", destField: "status" },
  { sourceField: "clientId", destField: "clientId" }, { sourceField: "practiceArea", destField: "practiceArea" },
  { sourceField: "openDate", destField: "openDate" }, { sourceField: "closeDate", destField: "closeDate" },
];
