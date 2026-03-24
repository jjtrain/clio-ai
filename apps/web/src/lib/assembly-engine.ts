import { db } from "@/lib/db";
import { resolveAllFields, resolveLookupByName, resolveComputedField } from "./assembly-data-sources";

// ==========================================
// PIPE FORMATTERS
// ==========================================

const formatters: Record<string, (val: any) => string> = {
  currency: (v) => typeof v === "number" ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(v),
  number: (v) => typeof v === "number" ? v.toLocaleString() : String(v),
  upper: (v) => String(v).toUpperCase(),
  lower: (v) => String(v).toLowerCase(),
  title: (v) => String(v).replace(/\b\w/g, (c) => c.toUpperCase()),
  longDate: (v) => { try { return new Date(v).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch { return String(v); } },
  shortDate: (v) => { try { return new Date(v).toLocaleDateString("en-US"); } catch { return String(v); } },
  ordinal: (v) => { try { const d = new Date(v); const day = d.getDate(); const suffix = [, "st", "nd", "rd"][(day % 100 >> 3) ^ 1 && day % 10] || "th"; return `${day}${suffix} day of ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`; } catch { return String(v); } },
  spell: (v) => numberToWords(Number(v)),
  spellDollars: (v) => `${numberToWords(Math.floor(Number(v)))} and ${String(Math.round((Number(v) % 1) * 100)).padStart(2, "0")}/100 Dollars`,
  yesNo: (v) => v ? "Yes" : "No",
};

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 1000000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  return String(n);
}

// ==========================================
// TEMPLATE PROCESSING
// ==========================================

function applyFormatter(value: any, formatter: string): string {
  if (value === null || value === undefined) return "";
  if (formatter.startsWith("default:")) return value || formatter.slice(8);
  return (formatters[formatter] || String)(value);
}

function processConditionals(content: string, data: Record<string, any>): string {
  // Process {% if %} ... {% elif %} ... {% else %} ... {% endif %}
  const ifRegex = /\{%\s*if\s+(.+?)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;

  return content.replace(ifRegex, (_, condition, body) => {
    // Split on elif/else
    const parts = body.split(/\{%\s*(?:elif\s+(.+?)|else)\s*%\}/);
    const conditions = [condition];
    const blocks = [parts[0]];

    for (let i = 1; i < parts.length; i += 2) {
      conditions.push(parts[i] || "true"); // else = always true
      blocks.push(parts[i + 1] || "");
    }

    for (let i = 0; i < conditions.length; i++) {
      if (evaluateCondition(conditions[i], data)) {
        return blocks[i];
      }
    }
    return "";
  });
}

function evaluateCondition(condition: string, data: Record<string, any>): boolean {
  if (!condition || condition === "true") return true;

  // Parse: field operator value
  const match = condition.match(/^\s*(.+?)\s+(==|!=|>|<|>=|<=|contains|is_empty|is_not_empty|in)\s*(.*?)\s*$/);
  if (!match) return false;

  const [, fieldKey, operator, rawValue] = match;
  const fieldVal = resolveFieldFromData(fieldKey.trim(), data);
  const compareVal = rawValue?.replace(/^["']|["']$/g, "").trim();

  switch (operator) {
    case "==": return String(fieldVal) === compareVal;
    case "!=": return String(fieldVal) !== compareVal;
    case ">": return Number(fieldVal) > Number(compareVal);
    case "<": return Number(fieldVal) < Number(compareVal);
    case ">=": return Number(fieldVal) >= Number(compareVal);
    case "<=": return Number(fieldVal) <= Number(compareVal);
    case "contains": return String(fieldVal).toLowerCase().includes(compareVal.toLowerCase());
    case "is_empty": return !fieldVal;
    case "is_not_empty": return !!fieldVal;
    case "in": {
      const vals = compareVal.replace(/[\[\]]/g, "").split(",").map((v: string) => v.trim().replace(/["']/g, ""));
      return vals.includes(String(fieldVal));
    }
    default: return false;
  }
}

function resolveFieldFromData(key: string, data: Record<string, any>): any {
  return data[key] ?? data[key.replace(/\./g, "_")] ?? null;
}

function processMergeFields(content: string, data: Record<string, any>): string {
  return content.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
    const parts = expr.trim().split("|").map((p: string) => p.trim());
    const fieldKey = parts[0];
    let value = resolveFieldFromData(fieldKey, data);

    // Apply formatters
    for (let i = 1; i < parts.length; i++) {
      value = applyFormatter(value, parts[i]);
    }

    return value !== null && value !== undefined ? String(value) : "";
  });
}

async function processSnippets(content: string, firmId: string): Promise<string> {
  const snippetRegex = /\{%\s*snippet\s+"(.+?)"\s*%\}/g;
  let result = content;
  let match;

  while ((match = snippetRegex.exec(content)) !== null) {
    const snippetName = match[1];
    const snippet = await db.assemblySnippet.findFirst({
      where: { name: snippetName, firmId },
    });
    result = result.replace(match[0], snippet?.content || `[Snippet not found: ${snippetName}]`);
  }

  return result;
}

// ==========================================
// MAIN ASSEMBLY
// ==========================================

export async function assembleDocument(params: {
  templateId: string; matterId: string; overrides?: Record<string, any>; assembledBy: string;
}): Promise<{ document: any; warnings: string[] }> {
  const template = await db.assemblyTemplate.findUnique({ where: { id: params.templateId } });
  if (!template) throw new Error("Template not found");

  const matter = await db.matter.findUnique({ where: { id: params.matterId }, include: { client: true } });
  if (!matter) throw new Error("Matter not found");

  const warnings: string[] = [];

  // Resolve all merge fields
  const mergeFieldSchema = template.mergeFieldSchema as any[];
  let data = await resolveAllFields(mergeFieldSchema, params.matterId);

  // Apply overrides
  if (params.overrides) {
    data = { ...data, ...params.overrides };
  }

  // Resolve computed fields
  const computedFields = (template.computedFields as any[]) || [];
  const computedValues: Record<string, any> = {};
  for (const cf of computedFields) {
    computedValues[cf.fieldKey] = resolveComputedField(cf.formula, data);
    data[cf.fieldKey] = computedValues[cf.fieldKey];
  }

  // Check for missing required fields
  for (const field of mergeFieldSchema) {
    if (field.isRequired && (data[field.fieldKey] === null || data[field.fieldKey] === undefined)) {
      warnings.push(`Missing required field: ${field.label} (${field.fieldKey})`);
    }
  }

  // Process template content
  let content = template.content;
  content = await processSnippets(content, template.firmId);
  content = processConditionals(content, data);
  content = processMergeFields(content, data);

  // Process header/footer
  let header = template.headerContent || "";
  header = processMergeFields(header, data);
  let footer = template.footerContent || "";
  footer = processMergeFields(footer, data);

  const fullContent = `${header}${content}${footer}`;

  // Track which conditionals were resolved
  const resolvedConditions = { mergeFieldCount: mergeFieldSchema.length, resolvedCount: Object.keys(data).filter((k) => data[k] !== null).length };

  // Create document record
  const document = await db.assembledDocument.create({
    data: {
      templateId: params.templateId,
      matterId: params.matterId,
      title: `${template.name} — ${matter.client?.name || matter.name}`,
      assembledContent: fullContent,
      mergeData: data,
      resolvedConditions,
      computedValues,
      assembledBy: params.assembledBy,
      firmId: template.firmId,
    },
  });

  // Update template usage
  await db.assemblyTemplate.update({
    where: { id: params.templateId },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });

  return { document, warnings };
}

// ==========================================
// PREVIEW (no DB write)
// ==========================================

export async function previewAssembly(params: {
  templateId: string; matterId: string; overrides?: Record<string, any>;
}): Promise<{ html: string; resolvedFields: Record<string, any>; warnings: string[] }> {
  const template = await db.assemblyTemplate.findUnique({ where: { id: params.templateId } });
  if (!template) throw new Error("Template not found");

  const warnings: string[] = [];
  const mergeFieldSchema = template.mergeFieldSchema as any[];
  let data = await resolveAllFields(mergeFieldSchema, params.matterId);
  if (params.overrides) data = { ...data, ...params.overrides };

  const computedFields = (template.computedFields as any[]) || [];
  for (const cf of computedFields) data[cf.fieldKey] = resolveComputedField(cf.formula, data);

  for (const field of mergeFieldSchema) {
    if (field.isRequired && !data[field.fieldKey]) warnings.push(`Missing: ${field.label}`);
  }

  let content = template.content;
  content = await processSnippets(content, template.firmId);
  content = processConditionals(content, data);
  content = processMergeFields(content, data);

  return { html: content, resolvedFields: data, warnings };
}

// ==========================================
// TEMPLATE PARSING
// ==========================================

export function parseTemplate(content: string): {
  mergeFields: string[]; conditionals: string[]; snippets: string[];
} {
  const mergeFields = Array.from(new Set((content.match(/\{\{(.+?)\}\}/g) || []).map((m) => m.replace(/\{\{|\}\}/g, "").split("|")[0].trim())));
  const conditionals = Array.from(new Set((content.match(/\{%\s*if\s+(.+?)\s*%\}/g) || []).map((m) => m.replace(/\{%\s*if\s+|\s*%\}/g, ""))));
  const snippets = Array.from(new Set((content.match(/\{%\s*snippet\s+"(.+?)"\s*%\}/g) || []).map((m) => m.replace(/\{%\s*snippet\s+"|\"\s*%\}/g, ""))));

  return { mergeFields, conditionals, snippets };
}

export async function validateTemplate(templateId: string): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  const template = await db.assemblyTemplate.findUnique({ where: { id: templateId } });
  if (!template) return { isValid: false, errors: ["Template not found"], warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check balanced blocks
  const ifCount = (template.content.match(/\{%\s*if\s/g) || []).length;
  const endifCount = (template.content.match(/\{%\s*endif\s*%\}/g) || []).length;
  if (ifCount !== endifCount) errors.push(`Unbalanced conditionals: ${ifCount} if blocks, ${endifCount} endif blocks`);

  // Check snippets exist
  const parsed = parseTemplate(template.content);
  for (const snippetName of parsed.snippets) {
    const exists = await db.assemblySnippet.findFirst({ where: { name: snippetName, firmId: template.firmId } });
    if (!exists) warnings.push(`Snippet "${snippetName}" not found`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}
