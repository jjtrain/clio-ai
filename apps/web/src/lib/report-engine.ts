import { db } from "@/lib/db";

// ==========================================
// FIELD REGISTRY
// ==========================================

export interface ReportField {
  key: string;
  label: string;
  entity: string;
  type: "string" | "number" | "currency" | "date" | "enum" | "boolean";
  options?: string[];
  description?: string;
}

export const FIELD_REGISTRY: ReportField[] = [
  // Matter
  { key: "matter.name", label: "Matter Name", entity: "matter", type: "string" },
  { key: "matter.matterNumber", label: "Case Number", entity: "matter", type: "string" },
  { key: "matter.practiceArea", label: "Practice Area", entity: "matter", type: "enum", options: ["personal_injury", "family_law", "immigration", "corporate", "real_estate", "criminal_defense", "estate_planning", "litigation"] },
  { key: "matter.status", label: "Matter Status", entity: "matter", type: "enum", options: ["OPEN", "CLOSED", "PENDING"] },
  { key: "matter.pipelineStage", label: "Pipeline Stage", entity: "matter", type: "enum", options: ["NEW", "CONSULTATION", "CONFLICT_CHECK", "RETAINER_SENT", "RETAINED", "ACTIVE"] },
  { key: "matter.openDate", label: "Date Opened", entity: "matter", type: "date" },
  { key: "matter.closeDate", label: "Date Closed", entity: "matter", type: "date" },
  { key: "matter.duration", label: "Case Duration (days)", entity: "matter", type: "number", description: "Days from open to close (or to today if still open)" },
  { key: "matter.intakeSource", label: "Intake Source", entity: "matter", type: "string" },

  // Client
  { key: "client.name", label: "Client Name", entity: "client", type: "string" },
  { key: "client.email", label: "Client Email", entity: "client", type: "string" },
  { key: "client.phone", label: "Client Phone", entity: "client", type: "string" },

  // Billing
  { key: "billing.totalBilled", label: "Total Billed", entity: "billing", type: "currency", description: "Sum of all invoice totals" },
  { key: "billing.collected", label: "Amount Collected", entity: "billing", type: "currency", description: "Sum of all amounts paid" },
  { key: "billing.outstanding", label: "Outstanding Balance", entity: "billing", type: "currency" },
  { key: "billing.collectionRate", label: "Collection Rate (%)", entity: "billing", type: "number" },
  { key: "billing.totalHours", label: "Total Hours", entity: "billing", type: "number" },

  // Attorney
  { key: "attorney.name", label: "Attorney Name", entity: "attorney", type: "string" },
];

export interface ReportConfig {
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  chartType?: "table" | "bar" | "line" | "pie";
  limit?: number;
}

export interface ReportFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "between" | "contains";
  value: any;
}

// ==========================================
// REPORT EXECUTION
// ==========================================

export async function executeReport(config: ReportConfig, firmId: string): Promise<{ columns: string[]; rows: any[] }> {
  // Fetch matters with relations
  const where: any = {};

  // Apply filters
  for (const filter of config.filters) {
    if (filter.field === "matter.practiceArea" && filter.operator === "in") {
      where.practiceArea = { in: filter.value };
    }
    if (filter.field === "matter.status" && filter.operator === "in") {
      where.status = { in: filter.value };
    }
    if (filter.field === "matter.openDate" && filter.operator === "gte") {
      where.openDate = { ...(where.openDate || {}), gte: new Date(filter.value) };
    }
    if (filter.field === "matter.openDate" && filter.operator === "lte") {
      where.openDate = { ...(where.openDate || {}), lte: new Date(filter.value) };
    }
    if (filter.field === "matter.name" && filter.operator === "contains") {
      where.name = { contains: filter.value, mode: "insensitive" };
    }
  }

  const matters = await db.matter.findMany({
    where,
    include: {
      client: { select: { name: true, email: true, phone: true } },
      invoices: { select: { total: true, amountPaid: true, issueDate: true } },
      timeEntries: { select: { hours: true, duration: true } },
    },
    take: config.limit || 500,
    orderBy: config.sortBy === "matter.openDate" ? { openDate: config.sortDir || "desc" }
      : config.sortBy === "matter.name" ? { name: config.sortDir || "asc" }
      : { updatedAt: "desc" },
  });

  const now = new Date();

  // Transform to flat rows
  const rows = matters.map((m) => {
    const totalBilled = m.invoices.reduce((s, inv) => s + Number(inv.total), 0);
    const collected = m.invoices.reduce((s, inv) => s + Number(inv.amountPaid), 0);
    const totalHours = m.timeEntries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
    const duration = m.closeDate
      ? Math.ceil((m.closeDate.getTime() - m.openDate.getTime()) / 86400000)
      : Math.ceil((now.getTime() - m.openDate.getTime()) / 86400000);

    return {
      "matter.name": m.name,
      "matter.matterNumber": m.matterNumber,
      "matter.practiceArea": m.practiceArea,
      "matter.status": m.status,
      "matter.pipelineStage": m.pipelineStage,
      "matter.openDate": m.openDate,
      "matter.closeDate": m.closeDate,
      "matter.duration": duration,
      "matter.intakeSource": m.intakeSource,
      "client.name": m.client?.name,
      "client.email": m.client?.email,
      "client.phone": m.client?.phone,
      "billing.totalBilled": totalBilled,
      "billing.collected": collected,
      "billing.outstanding": totalBilled - collected,
      "billing.collectionRate": totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : null,
      "billing.totalHours": Math.round(totalHours * 10) / 10,
      "attorney.name": null, // would resolve from matter assignment
    };
  });

  // Group if requested
  if (config.groupBy) {
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      const key = String(row[config.groupBy] || "Unknown");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    // Return aggregated rows
    const aggRows = Object.entries(grouped).map(([groupVal, groupRows]) => {
      const agg: any = { [config.groupBy!]: groupVal, _count: groupRows.length };

      // Aggregate numeric/currency fields
      for (const field of config.fields) {
        const meta = FIELD_REGISTRY.find((f) => f.key === field);
        if (meta && (meta.type === "currency" || meta.type === "number") && field !== config.groupBy) {
          agg[field] = groupRows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
          agg[`${field}_avg`] = agg[field] / groupRows.length;
        }
      }

      return agg;
    });

    return { columns: [config.groupBy, "_count", ...config.fields.filter((f) => f !== config.groupBy)], rows: aggRows };
  }

  // Filter to selected fields only
  const filteredRows = rows.map((row) => {
    const filtered: any = {};
    for (const field of config.fields) {
      filtered[field] = row[field];
    }
    return filtered;
  });

  return { columns: config.fields, rows: filteredRows };
}
