import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const SYSTEM_REPORTS = [
  {
    name: "Revenue Summary",
    description: "Overview of invoiced revenue by status with totals",
    reportType: "FINANCIAL" as const,
    dataSource: "invoices",
    columns: JSON.stringify([
      { field: "invoiceNumber", label: "Invoice #", visible: true, sortOrder: 0, format: "text" },
      { field: "client.name", label: "Client", visible: true, sortOrder: 1, format: "text" },
      { field: "matter.name", label: "Matter", visible: true, sortOrder: 2, format: "text" },
      { field: "total", label: "Total", visible: true, sortOrder: 3, format: "currency" },
      { field: "amountPaid", label: "Paid", visible: true, sortOrder: 4, format: "currency" },
      { field: "status", label: "Status", visible: true, sortOrder: 5, format: "badge" },
      { field: "issueDate", label: "Issue Date", visible: true, sortOrder: 6, format: "date" },
      { field: "paidAt", label: "Paid Date", visible: true, sortOrder: 7, format: "date" },
    ]),
    filters: JSON.stringify([{ field: "status", operator: "in", value: ["SENT", "PAID", "OVERDUE"], label: "Sent, Paid, or Overdue" }]),
    groupBy: "status",
    aggregations: JSON.stringify([
      { field: "total", function: "SUM", label: "Total Billed" },
      { field: "amountPaid", function: "SUM", label: "Total Collected" },
      { field: "id", function: "COUNT", label: "Invoice Count" },
    ]),
    chartType: "bar",
    chartConfig: JSON.stringify({ xField: "status", yField: "total" }),
    dateRange: JSON.stringify({ type: "this_month" }),
  },
  {
    name: "Billable Hours Report",
    description: "Time entries filtered to billable work, grouped by timekeeper",
    reportType: "TIME" as const,
    dataSource: "timeEntries",
    columns: JSON.stringify([
      { field: "date", label: "Date", visible: true, sortOrder: 0, format: "date" },
      { field: "user.name", label: "Timekeeper", visible: true, sortOrder: 1, format: "text" },
      { field: "matter.name", label: "Matter", visible: true, sortOrder: 2, format: "text" },
      { field: "matter.client.name", label: "Client", visible: true, sortOrder: 3, format: "text" },
      { field: "description", label: "Description", visible: true, sortOrder: 4, format: "text" },
      { field: "duration", label: "Hours", visible: true, sortOrder: 5, format: "duration" },
      { field: "rate", label: "Rate", visible: true, sortOrder: 6, format: "currency" },
      { field: "billable", label: "Billable", visible: true, sortOrder: 7, format: "badge" },
    ]),
    filters: JSON.stringify([{ field: "billable", operator: "equals", value: true, label: "Billable only" }]),
    groupBy: "user.name",
    aggregations: JSON.stringify([
      { field: "duration", function: "SUM", label: "Total Hours" },
      { field: "amount", function: "SUM", label: "Total Value" },
    ]),
    chartType: "bar",
    chartConfig: JSON.stringify({ xField: "user.name", yField: "duration" }),
    dateRange: JSON.stringify({ type: "this_month" }),
  },
  {
    name: "Matter Status Report",
    description: "Active matters organized by pipeline stage",
    reportType: "MATTERS" as const,
    dataSource: "matters",
    columns: JSON.stringify([
      { field: "name", label: "Matter", visible: true, sortOrder: 0, format: "text" },
      { field: "matterNumber", label: "Matter #", visible: true, sortOrder: 1, format: "text" },
      { field: "client.name", label: "Client", visible: true, sortOrder: 2, format: "text" },
      { field: "practiceArea", label: "Practice Area", visible: true, sortOrder: 3, format: "text" },
      { field: "pipelineStage", label: "Stage", visible: true, sortOrder: 4, format: "badge" },
      { field: "status", label: "Status", visible: true, sortOrder: 5, format: "badge" },
      { field: "openDate", label: "Opened", visible: true, sortOrder: 6, format: "date" },
    ]),
    filters: JSON.stringify([{ field: "status", operator: "notIn", value: ["CLOSED"], label: "Not closed" }]),
    groupBy: "pipelineStage",
    aggregations: JSON.stringify([{ field: "id", function: "COUNT", label: "Total Matters" }]),
    chartType: "pie",
    chartConfig: JSON.stringify({ categoryField: "pipelineStage", valueField: "count" }),
    dateRange: null,
  },
  {
    name: "Client Acquisition Report",
    description: "Lead sources and conversion tracking",
    reportType: "LEADS" as const,
    dataSource: "leads",
    columns: JSON.stringify([
      { field: "name", label: "Name", visible: true, sortOrder: 0, format: "text" },
      { field: "email", label: "Email", visible: true, sortOrder: 1, format: "text" },
      { field: "source", label: "Source", visible: true, sortOrder: 2, format: "badge" },
      { field: "status", label: "Status", visible: true, sortOrder: 3, format: "badge" },
      { field: "practiceArea", label: "Practice Area", visible: true, sortOrder: 4, format: "text" },
      { field: "createdAt", label: "Created", visible: true, sortOrder: 5, format: "date" },
      { field: "convertedAt", label: "Converted", visible: true, sortOrder: 6, format: "date" },
    ]),
    filters: JSON.stringify([]),
    groupBy: "source",
    aggregations: JSON.stringify([
      { field: "id", function: "COUNT", label: "Total Leads" },
    ]),
    chartType: "pie",
    chartConfig: JSON.stringify({ categoryField: "source", valueField: "count" }),
    dateRange: JSON.stringify({ type: "last_90_days" }),
  },
  {
    name: "Accounts Receivable Aging",
    description: "Outstanding invoices grouped by aging bucket",
    reportType: "FINANCIAL" as const,
    dataSource: "invoices",
    columns: JSON.stringify([
      { field: "invoiceNumber", label: "Invoice #", visible: true, sortOrder: 0, format: "text" },
      { field: "client.name", label: "Client", visible: true, sortOrder: 1, format: "text" },
      { field: "total", label: "Total", visible: true, sortOrder: 2, format: "currency" },
      { field: "amountPaid", label: "Paid", visible: true, sortOrder: 3, format: "currency" },
      { field: "balance", label: "Balance", visible: true, sortOrder: 4, format: "currency" },
      { field: "dueDate", label: "Due Date", visible: true, sortOrder: 5, format: "date" },
      { field: "agingBucket", label: "Aging", visible: true, sortOrder: 6, format: "badge" },
      { field: "status", label: "Status", visible: true, sortOrder: 7, format: "badge" },
    ]),
    filters: JSON.stringify([{ field: "status", operator: "in", value: ["SENT", "OVERDUE"], label: "Outstanding only" }]),
    groupBy: "agingBucket",
    aggregations: JSON.stringify([{ field: "balance", function: "SUM", label: "Total Outstanding" }]),
    chartType: "bar",
    chartConfig: JSON.stringify({ xField: "agingBucket", yField: "balance" }),
    dateRange: null,
  },
  {
    name: "Appointment Summary",
    description: "Consultation appointments with fees and status",
    reportType: "APPOINTMENTS" as const,
    dataSource: "appointments",
    columns: JSON.stringify([
      { field: "clientName", label: "Client", visible: true, sortOrder: 0, format: "text" },
      { field: "practiceArea", label: "Practice Area", visible: true, sortOrder: 1, format: "text" },
      { field: "startTime", label: "Date/Time", visible: true, sortOrder: 2, format: "date" },
      { field: "status", label: "Status", visible: true, sortOrder: 3, format: "badge" },
      { field: "paymentStatus", label: "Payment", visible: true, sortOrder: 4, format: "badge" },
      { field: "consultationFee", label: "Fee", visible: true, sortOrder: 5, format: "currency" },
    ]),
    filters: JSON.stringify([]),
    groupBy: "status",
    aggregations: JSON.stringify([
      { field: "id", function: "COUNT", label: "Total Appointments" },
      { field: "consultationFee", function: "SUM", label: "Total Fees" },
    ]),
    chartType: "pie",
    chartConfig: JSON.stringify({ categoryField: "status", valueField: "count" }),
    dateRange: JSON.stringify({ type: "this_month" }),
  },
];

function getDateRange(dateRange: any): { gte?: Date; lte?: Date } | null {
  if (!dateRange) return null;
  const dr = typeof dateRange === "string" ? JSON.parse(dateRange) : dateRange;
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (dr.type) {
    case "last_7_days": return { gte: new Date(now.getTime() - 7 * 86400000) };
    case "last_30_days": return { gte: new Date(now.getTime() - 30 * 86400000) };
    case "last_90_days": return { gte: new Date(now.getTime() - 90 * 86400000) };
    case "this_month": return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "this_quarter": {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      return { gte: new Date(now.getFullYear(), qm, 1) };
    }
    case "this_year": return { gte: new Date(now.getFullYear(), 0, 1) };
    case "last_year": return {
      gte: new Date(now.getFullYear() - 1, 0, 1),
      lte: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59),
    };
    case "custom":
      return {
        ...(dr.startDate ? { gte: new Date(dr.startDate) } : {}),
        ...(dr.endDate ? { lte: new Date(dr.endDate) } : {}),
      };
    default: return null;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((v, k) => v?.[k], obj);
}

async function executeReport(db: any, def: {
  dataSource: string;
  columns: string;
  filters: string;
  groupBy?: string | null;
  sortBy?: string | null;
  sortDirection?: string;
  aggregations?: string | null;
  dateRange?: string | null;
}, dateRangeOverride?: any) {
  const startTime = Date.now();
  const columns = JSON.parse(def.columns);
  const filters = JSON.parse(def.filters);
  const aggregations = def.aggregations ? JSON.parse(def.aggregations) : [];
  const dateRange = getDateRange(dateRangeOverride || def.dateRange);

  let rows: any[] = [];
  const where: any = {};

  // Build filter conditions
  for (const f of filters) {
    const val = f.value;
    switch (f.operator) {
      case "equals": where[f.field] = val; break;
      case "contains": where[f.field] = { contains: val, mode: "insensitive" }; break;
      case "gt": where[f.field] = { gt: parseFloat(val) }; break;
      case "lt": where[f.field] = { lt: parseFloat(val) }; break;
      case "gte": where[f.field] = { gte: parseFloat(val) }; break;
      case "lte": where[f.field] = { lte: parseFloat(val) }; break;
      case "in": where[f.field] = { in: Array.isArray(val) ? val : [val] }; break;
      case "notIn": where[f.field] = { notIn: Array.isArray(val) ? val : [val] }; break;
      case "isNull": where[f.field] = null; break;
      case "isNotNull": where[f.field] = { not: null }; break;
    }
  }

  // Query per data source
  switch (def.dataSource) {
    case "invoices": {
      const dateField = "issueDate";
      if (dateRange) where[dateField] = { ...(where[dateField] || {}), ...dateRange };
      const raw = await db.invoice.findMany({
        where,
        include: { matter: { include: { client: true } } },
        orderBy: def.sortBy ? { [def.sortBy.split(".")[0]]: def.sortDirection || "desc" } : { issueDate: "desc" },
      });
      rows = raw.map((inv: any) => {
        const total = parseFloat(inv.total?.toString() || "0");
        const paid = parseFloat(inv.amountPaid?.toString() || "0");
        const balance = total - paid;
        let agingBucket = "Current";
        if (inv.status === "OVERDUE" || inv.status === "SENT") {
          const days = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
          if (days > 90) agingBucket = "90+ Days";
          else if (days > 60) agingBucket = "60-90 Days";
          else if (days > 30) agingBucket = "30-60 Days";
          else if (days > 0) agingBucket = "1-30 Days";
        }
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          "client.name": inv.matter?.client?.name,
          "matter.name": inv.matter?.name,
          "matter.practiceArea": inv.matter?.practiceArea,
          total, subtotal: parseFloat(inv.subtotal?.toString() || "0"),
          taxAmount: parseFloat(inv.taxAmount?.toString() || "0"),
          amountPaid: paid, balance, status: inv.status,
          issueDate: inv.issueDate, dueDate: inv.dueDate, paidAt: inv.paidAt,
          agingBucket,
        };
      });
      break;
    }
    case "timeEntries": {
      const dateField = "date";
      if (dateRange) where[dateField] = { ...(where[dateField] || {}), ...dateRange };
      const raw = await db.timeEntry.findMany({
        where,
        include: { matter: { include: { client: true } }, user: true },
        orderBy: def.sortBy ? { [def.sortBy.split(".")[0]]: def.sortDirection || "desc" } : { date: "desc" },
      });
      rows = raw.map((te: any) => {
        const hours = te.duration / 60;
        const rate = parseFloat(te.rate?.toString() || "0");
        return {
          id: te.id, description: te.description,
          duration: Math.round(hours * 100) / 100,
          date: te.date, billable: te.billable, rate,
          amount: Math.round(hours * rate * 100) / 100,
          "user.name": te.user?.name,
          "matter.name": te.matter?.name,
          "matter.client.name": te.matter?.client?.name,
        };
      });
      break;
    }
    case "matters": {
      const dateField = "openDate";
      if (dateRange) where[dateField] = { ...(where[dateField] || {}), ...dateRange };
      const raw = await db.matter.findMany({
        where,
        include: { client: true, _count: { select: { timeEntries: true, documents: true, invoices: true } } },
        orderBy: def.sortBy ? { [def.sortBy.split(".")[0]]: def.sortDirection || "desc" } : { openDate: "desc" },
      });
      rows = raw.map((m: any) => ({
        id: m.id, name: m.name, matterNumber: m.matterNumber,
        status: m.status, pipelineStage: m.pipelineStage,
        practiceArea: m.practiceArea, openDate: m.openDate, closeDate: m.closeDate,
        "client.name": m.client?.name,
        timeEntryCount: m._count?.timeEntries, documentCount: m._count?.documents, invoiceCount: m._count?.invoices,
      }));
      break;
    }
    case "clients": {
      const dateField = "createdAt";
      if (dateRange) where[dateField] = { ...(where[dateField] || {}), ...dateRange };
      const raw = await db.client.findMany({
        where,
        include: { _count: { select: { matters: true } } },
        orderBy: def.sortBy ? { [def.sortBy.split(".")[0]]: def.sortDirection || "desc" } : { createdAt: "desc" },
      });
      rows = raw.map((c: any) => ({
        id: c.id, name: c.name, email: c.email, phone: c.phone,
        status: c.status, createdAt: c.createdAt,
        matterCount: c._count?.matters,
      }));
      break;
    }
    case "leads": {
      const dateField = "createdAt";
      if (dateRange) where[dateField] = { ...(where[dateField] || {}), ...dateRange };
      const raw = await db.lead.findMany({
        where,
        orderBy: def.sortBy ? { [def.sortBy.split(".")[0]]: def.sortDirection || "desc" } : { createdAt: "desc" },
      });
      rows = raw.map((l: any) => ({
        id: l.id, name: l.name, email: l.email, phone: l.phone,
        source: l.source, status: l.status, priority: l.priority,
        practiceArea: l.practiceArea, createdAt: l.createdAt, convertedAt: l.convertedAt,
      }));
      break;
    }
    case "appointments": {
      const dateField = "startTime";
      if (dateRange) where[dateField] = { ...(where[dateField] || {}), ...dateRange };
      const raw = await db.appointment.findMany({
        where,
        orderBy: def.sortBy ? { [def.sortBy.split(".")[0]]: def.sortDirection || "desc" } : { startTime: "desc" },
      });
      rows = raw.map((a: any) => ({
        id: a.id, clientName: a.clientName, clientEmail: a.clientEmail,
        practiceArea: a.practiceArea, startTime: a.startTime, endTime: a.endTime,
        status: a.status, paymentStatus: a.paymentStatus,
        consultationFee: parseFloat(a.consultationFee?.toString() || "0"),
      }));
      break;
    }
  }

  // Group data
  let groups: Record<string, any[]> | null = null;
  if (def.groupBy) {
    groups = {};
    for (const row of rows) {
      const key = String(getNestedValue(row, def.groupBy) ?? "Other");
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
  }

  // Calculate aggregations
  const aggResults: Array<{ label: string; value: number; formatted?: string }> = [];
  for (const agg of aggregations) {
    let value = 0;
    if (agg.function === "COUNT") {
      value = rows.length;
    } else {
      const nums = rows.map((r) => {
        const v = getNestedValue(r, agg.field);
        return typeof v === "number" ? v : parseFloat(v) || 0;
      }).filter((n) => !isNaN(n));
      switch (agg.function) {
        case "SUM": value = nums.reduce((a, b) => a + b, 0); break;
        case "AVG": value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break;
        case "MIN": value = nums.length ? Math.min(...nums) : 0; break;
        case "MAX": value = nums.length ? Math.max(...nums) : 0; break;
      }
    }
    aggResults.push({ label: agg.label, value: Math.round(value * 100) / 100 });
  }

  // Build chart data
  let chartData: any[] | null = null;
  if (def.groupBy && groups) {
    chartData = Object.entries(groups).map(([key, gRows]) => ({
      name: key,
      count: gRows.length,
      total: gRows.reduce((s, r) => {
        const cols = JSON.parse(def.columns);
        const currCol = cols.find((c: any) => c.format === "currency");
        const field = currCol?.field || "total";
        const v = getNestedValue(r, field);
        return s + (typeof v === "number" ? v : parseFloat(v) || 0);
      }, 0),
    }));
  }

  const executionTimeMs = Date.now() - startTime;
  return {
    columns: JSON.parse(def.columns).filter((c: any) => c.visible),
    rows,
    groups,
    aggregations: aggResults,
    chartData,
    totalRows: rows.length,
    executionTimeMs,
  };
}

async function ensureSystemReports(db: any) {
  const count = await db.reportDefinition.count({ where: { isSystem: true } });
  if (count === 0) {
    for (const report of SYSTEM_REPORTS) {
      await db.reportDefinition.create({
        data: { ...report, reportType: report.reportType as any, isSystem: true },
      });
    }
  }
}

export const reportsRouter = router({
  list: publicProcedure
    .input(z.object({
      reportType: z.string().optional(),
      isFavorite: z.boolean().optional(),
      isSystem: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await ensureSystemReports(ctx.db);
      const where: any = {};
      if (input?.reportType) where.reportType = input.reportType;
      if (input?.isFavorite !== undefined) where.isFavorite = input.isFavorite;
      if (input?.isSystem !== undefined) where.isSystem = input.isSystem;
      return ctx.db.reportDefinition.findMany({
        where,
        orderBy: [{ isSystem: "desc" }, { isFavorite: "desc" }, { updatedAt: "desc" }],
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.reportDefinition.findUniqueOrThrow({ where: { id: input.id } });
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      reportType: z.string(),
      dataSource: z.string(),
      columns: z.string(),
      filters: z.string(),
      groupBy: z.string().optional(),
      sortBy: z.string().optional(),
      sortDirection: z.string().default("desc"),
      aggregations: z.string().optional(),
      chartType: z.string().optional(),
      chartConfig: z.string().optional(),
      dateRange: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reportDefinition.create({
        data: { ...input, reportType: input.reportType as any },
      });
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      reportType: z.string().optional(),
      dataSource: z.string().optional(),
      columns: z.string().optional(),
      filters: z.string().optional(),
      groupBy: z.string().nullable().optional(),
      sortBy: z.string().nullable().optional(),
      sortDirection: z.string().optional(),
      aggregations: z.string().nullable().optional(),
      chartType: z.string().nullable().optional(),
      chartConfig: z.string().nullable().optional(),
      dateRange: z.string().nullable().optional(),
      isScheduled: z.boolean().optional(),
      scheduleFrequency: z.string().nullable().optional(),
      scheduleRecipients: z.string().nullable().optional(),
      isFavorite: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.reportDefinition.update({
        where: { id },
        data: { ...data, reportType: data.reportType as any },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.reportDefinition.findUniqueOrThrow({ where: { id: input.id } });
      if (report.isSystem) throw new Error("Cannot delete system reports");
      return ctx.db.reportDefinition.delete({ where: { id: input.id } });
    }),

  duplicate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.reportDefinition.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.reportDefinition.create({
        data: {
          name: `Copy of ${r.name}`, description: r.description, reportType: r.reportType,
          dataSource: r.dataSource, columns: r.columns, filters: r.filters,
          groupBy: r.groupBy, sortBy: r.sortBy, sortDirection: r.sortDirection,
          aggregations: r.aggregations, chartType: r.chartType, chartConfig: r.chartConfig,
          dateRange: r.dateRange,
        },
      });
    }),

  toggleFavorite: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.reportDefinition.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.reportDefinition.update({
        where: { id: input.id },
        data: { isFavorite: !r.isFavorite },
      });
    }),

  run: publicProcedure
    .input(z.object({
      reportId: z.string(),
      dateRangeOverride: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const def = await ctx.db.reportDefinition.findUniqueOrThrow({ where: { id: input.reportId } });
      const result = await executeReport(ctx.db, def, input.dateRangeOverride);

      await ctx.db.reportExecution.create({
        data: {
          reportId: input.reportId,
          resultData: JSON.stringify({ rows: result.rows, aggregations: result.aggregations, chartData: result.chartData }),
          rowCount: result.totalRows,
          executionTimeMs: result.executionTimeMs,
        },
      });

      await ctx.db.reportDefinition.update({
        where: { id: input.reportId },
        data: { lastRunAt: new Date() },
      });

      return result;
    }),

  preview: publicProcedure
    .input(z.object({
      dataSource: z.string(),
      columns: z.string(),
      filters: z.string(),
      groupBy: z.string().nullable().optional(),
      sortBy: z.string().nullable().optional(),
      sortDirection: z.string().default("desc"),
      aggregations: z.string().nullable().optional(),
      dateRange: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return executeReport(ctx.db, {
        dataSource: input.dataSource,
        columns: input.columns,
        filters: input.filters,
        groupBy: input.groupBy,
        sortBy: input.sortBy,
        sortDirection: input.sortDirection,
        aggregations: input.aggregations,
        dateRange: input.dateRange,
      });
    }),

  getHistory: publicProcedure
    .input(z.object({ reportId: z.string(), limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.reportExecution.findMany({
        where: { reportId: input.reportId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: { id: true, rowCount: true, executionTimeMs: true, exportFormat: true, createdAt: true },
      });
    }),

  getExecution: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.reportExecution.findUniqueOrThrow({ where: { id: input.id } });
    }),

  exportCsv: publicProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const def = await ctx.db.reportDefinition.findUniqueOrThrow({ where: { id: input.reportId } });
      const result = await executeReport(ctx.db, def);
      const cols = result.columns;
      const header = cols.map((c: any) => c.label).join(",");
      const csvRows = result.rows.map((row: any) =>
        cols.map((c: any) => {
          const val = getNestedValue(row, c.field);
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(",")
      );
      const csv = [header, ...csvRows].join("\n");

      await ctx.db.reportExecution.create({
        data: {
          reportId: input.reportId,
          resultData: JSON.stringify({ rowCount: result.totalRows }),
          rowCount: result.totalRows,
          executionTimeMs: result.executionTimeMs,
          exportFormat: "csv",
        },
      });

      return { csv, filename: `${def.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv` };
    }),

  getUsageStats: publicProcedure.query(async ({ ctx }) => {
    const totalReports = await ctx.db.reportDefinition.count();
    const scheduledCount = await ctx.db.reportDefinition.count({ where: { isScheduled: true } });
    const totalExecutions = await ctx.db.reportExecution.count();
    return { totalReports, scheduledCount, totalExecutions };
  }),
});
