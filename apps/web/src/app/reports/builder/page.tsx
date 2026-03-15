"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  Play,
  Loader2,
} from "lucide-react";

const DATA_SOURCES = [
  { value: "invoices", label: "Invoices", fields: ["invoiceNumber", "client.name", "matter.name", "total", "amountPaid", "balance", "status", "issueDate", "dueDate", "paidAt", "agingBucket"] },
  { value: "timeEntries", label: "Time Entries", fields: ["date", "user.name", "matter.name", "matter.client.name", "description", "duration", "rate", "amount", "billable"] },
  { value: "matters", label: "Matters", fields: ["name", "matterNumber", "client.name", "practiceArea", "pipelineStage", "status", "openDate", "closeDate"] },
  { value: "clients", label: "Clients", fields: ["name", "email", "phone", "status", "createdAt", "matterCount"] },
  { value: "leads", label: "Leads", fields: ["name", "email", "phone", "source", "status", "priority", "practiceArea", "createdAt", "convertedAt"] },
  { value: "appointments", label: "Appointments", fields: ["clientName", "clientEmail", "practiceArea", "startTime", "endTime", "status", "paymentStatus", "consultationFee"] },
];

const REPORT_TYPES = [
  { value: "FINANCIAL", label: "Financial" },
  { value: "MATTERS", label: "Matters" },
  { value: "CLIENTS", label: "Clients" },
  { value: "TIME", label: "Time" },
  { value: "LEADS", label: "Leads" },
  { value: "APPOINTMENTS", label: "Appointments" },
  { value: "CUSTOM", label: "Custom" },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lte", label: "Less or equal" },
  { value: "in", label: "In (comma-separated)" },
  { value: "notIn", label: "Not in" },
  { value: "isNull", label: "Is empty" },
  { value: "isNotNull", label: "Is not empty" },
];

const DATE_RANGES = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
];

const AGG_FUNCTIONS = [
  { value: "COUNT", label: "Count" },
  { value: "SUM", label: "Sum" },
  { value: "AVG", label: "Average" },
  { value: "MIN", label: "Min" },
  { value: "MAX", label: "Max" },
];

const FORMAT_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "duration", label: "Duration" },
  { value: "badge", label: "Badge" },
];

interface Column {
  field: string;
  label: string;
  visible: boolean;
  sortOrder: number;
  format: string;
}

interface Filter {
  field: string;
  operator: string;
  value: any;
  label: string;
}

interface Aggregation {
  field: string;
  function: string;
  label: string;
}

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <ReportBuilderContent />
    </Suspense>
  );
}

function ReportBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId");
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reportType, setReportType] = useState("CUSTOM");
  const [dataSource, setDataSource] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDirection, setSortDirection] = useState("desc");
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);
  const [chartType, setChartType] = useState("");
  const [dateRangeType, setDateRangeType] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: existingReport } = trpc.reports.getById.useQuery(
    { id: reportId! },
    { enabled: !!reportId }
  );

  const createReport = trpc.reports.create.useMutation({
    onSuccess: (data) => {
      toast({ title: "Report created" });
      router.push(`/reports/${data.id}`);
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateReport = trpc.reports.update.useMutation({
    onSuccess: () => {
      toast({ title: "Report updated" });
      router.push(`/reports/${reportId}`);
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const previewReport = trpc.reports.preview.useMutation({
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreview(true);
    },
  });

  // Load existing report data
  useEffect(() => {
    if (existingReport) {
      setName(existingReport.name);
      setDescription(existingReport.description || "");
      setReportType(existingReport.reportType);
      setDataSource(existingReport.dataSource);
      setColumns(JSON.parse(existingReport.columns));
      setFilters(JSON.parse(existingReport.filters));
      setGroupBy(existingReport.groupBy || "");
      setSortBy(existingReport.sortBy || "");
      setSortDirection(existingReport.sortDirection || "desc");
      setAggregations(existingReport.aggregations ? JSON.parse(existingReport.aggregations) : []);
      setChartType(existingReport.chartType || "");
      if (existingReport.dateRange) {
        const dr = JSON.parse(existingReport.dateRange);
        setDateRangeType(dr.type || "");
      }
    }
  }, [existingReport]);

  // When data source changes, set default columns
  const handleDataSourceChange = (source: string) => {
    setDataSource(source);
    const ds = DATA_SOURCES.find((d) => d.value === source);
    if (ds) {
      setColumns(
        ds.fields.map((field, i) => ({
          field,
          label: field.split(".").pop()!.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim(),
          visible: true,
          sortOrder: i,
          format: field.includes("Date") || field.includes("date") || field === "createdAt" || field === "convertedAt" || field === "startTime" || field === "endTime"
            ? "date"
            : field.includes("total") || field.includes("amount") || field.includes("rate") || field.includes("Fee") || field === "balance"
            ? "currency"
            : field === "duration"
            ? "duration"
            : field === "status" || field === "billable" || field === "pipelineStage" || field === "source" || field === "priority" || field === "paymentStatus" || field === "agingBucket"
            ? "badge"
            : "text",
        }))
      );
      setFilters([]);
      setAggregations([]);
      setGroupBy("");
      setSortBy("");
    }
  };

  const addFilter = () => {
    const ds = DATA_SOURCES.find((d) => d.value === dataSource);
    if (!ds) return;
    setFilters([...filters, { field: ds.fields[0], operator: "equals", value: "", label: "" }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    setFilters(filters.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const addAggregation = () => {
    const ds = DATA_SOURCES.find((d) => d.value === dataSource);
    if (!ds) return;
    setAggregations([...aggregations, { field: "id", function: "COUNT", label: "Count" }]);
  };

  const removeAggregation = (index: number) => {
    setAggregations(aggregations.filter((_, i) => i !== index));
  };

  const updateAggregation = (index: number, updates: Partial<Aggregation>) => {
    setAggregations(aggregations.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const toggleColumnVisibility = (index: number) => {
    setColumns(columns.map((c, i) => (i === index ? { ...c, visible: !c.visible } : c)));
  };

  const updateColumnFormat = (index: number, format: string) => {
    setColumns(columns.map((c, i) => (i === index ? { ...c, format } : c)));
  };

  const updateColumnLabel = (index: number, label: string) => {
    setColumns(columns.map((c, i) => (i === index ? { ...c, label } : c)));
  };

  const handlePreview = () => {
    if (!dataSource || columns.length === 0) return;
    previewReport.mutate({
      dataSource,
      columns: JSON.stringify(columns),
      filters: JSON.stringify(filters),
      groupBy: groupBy || null,
      sortBy: sortBy || null,
      sortDirection,
      aggregations: aggregations.length > 0 ? JSON.stringify(aggregations) : null,
      dateRange: dateRangeType ? JSON.stringify({ type: dateRangeType }) : null,
    });
  };

  const handleSave = () => {
    if (!name || !dataSource) {
      toast({ title: "Name and data source are required", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      description,
      reportType,
      dataSource,
      columns: JSON.stringify(columns),
      filters: JSON.stringify(filters),
      groupBy: groupBy || undefined,
      sortBy: sortBy || undefined,
      sortDirection,
      aggregations: aggregations.length > 0 ? JSON.stringify(aggregations) : undefined,
      chartType: chartType || undefined,
      chartConfig: chartType && groupBy ? JSON.stringify({ xField: groupBy, yField: "total" }) : undefined,
      dateRange: dateRangeType ? JSON.stringify({ type: dateRangeType }) : undefined,
    };

    if (reportId) {
      updateReport.mutate({ id: reportId, ...payload });
    } else {
      createReport.mutate(payload);
    }
  };

  const currentFields = DATA_SOURCES.find((d) => d.value === dataSource)?.fields || [];
  const isSaving = createReport.isPending || updateReport.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/reports"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {reportId ? "Edit Report" : "New Report"}
            </h1>
            <p className="text-sm text-gray-500">Configure your custom report</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={!dataSource || previewReport.isPending}>
            {previewReport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Preview
          </Button>
          <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {reportId ? "Update" : "Save"} Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Report Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly Revenue Report" className="mt-1" />
              </div>
              <div>
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="mt-1" rows={2} />
            </div>
          </div>

          {/* Data Source */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Data Source</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Source</Label>
                <Select value={dataSource} onValueChange={handleDataSourceChange}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select data source" /></SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Range</Label>
                <Select value={dateRangeType} onValueChange={setDateRangeType}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All time" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    {DATE_RANGES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Columns */}
          {columns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Columns</h2>
              <div className="space-y-2">
                {columns.map((col, i) => (
                  <div key={col.field} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <button onClick={() => toggleColumnVisibility(i)} className="flex-shrink-0">
                      {col.visible ? <Eye className="h-4 w-4 text-blue-500" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                    </button>
                    <Input
                      value={col.label}
                      onChange={(e) => updateColumnLabel(i, e.target.value)}
                      className="flex-1 h-8 text-sm bg-white"
                    />
                    <span className="text-xs text-gray-400 hidden sm:block">{col.field}</span>
                    <Select value={col.format} onValueChange={(v) => updateColumnFormat(i, v)}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          {dataSource && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Filters</h2>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="mr-1.5 h-3 w-3" />Add Filter
                </Button>
              </div>
              {filters.length === 0 && (
                <p className="text-sm text-gray-400">No filters applied — all records will be included</p>
              )}
              {filters.map((filter, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Select value={filter.field} onValueChange={(v) => updateFilter(i, { field: v })}>
                    <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentFields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filter.operator} onValueChange={(v) => updateFilter(i, { operator: v })}>
                    <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {filter.operator !== "isNull" && filter.operator !== "isNotNull" && (
                    <Input
                      value={typeof filter.value === "object" ? JSON.stringify(filter.value) : String(filter.value)}
                      onChange={(e) => {
                        let val: any = e.target.value;
                        if (filter.operator === "in" || filter.operator === "notIn") {
                          val = val.split(",").map((s: string) => s.trim());
                        }
                        updateFilter(i, { value: val });
                      }}
                      placeholder="Value..."
                      className="w-[160px] h-8 text-sm"
                    />
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFilter(i)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Grouping & Sorting */}
          {dataSource && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Grouping & Sorting</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Group By</Label>
                  <Select value={groupBy} onValueChange={setGroupBy}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {currentFields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      {currentFields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Direction</Label>
                  <Select value={sortDirection} onValueChange={setSortDirection}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Aggregations */}
          {dataSource && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Aggregations</h2>
                <Button variant="outline" size="sm" onClick={addAggregation}>
                  <Plus className="mr-1.5 h-3 w-3" />Add
                </Button>
              </div>
              {aggregations.length === 0 && (
                <p className="text-sm text-gray-400">No aggregations — add summary calculations</p>
              )}
              {aggregations.map((agg, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Select value={agg.function} onValueChange={(v) => updateAggregation(i, { function: v })}>
                    <SelectTrigger className="w-[110px] h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AGG_FUNCTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={agg.field} onValueChange={(v) => updateAggregation(i, { field: v })}>
                    <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">id (for counting)</SelectItem>
                      {currentFields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={agg.label}
                    onChange={(e) => updateAggregation(i, { label: e.target.value })}
                    placeholder="Label"
                    className="flex-1 h-8 text-sm"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAggregation(i)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          {dataSource && groupBy && groupBy !== "none" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Visualization</h2>
              <div>
                <Label>Chart Type</Label>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger className="mt-1 w-[200px]"><SelectValue placeholder="No chart" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No chart</SelectItem>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sticky top-6">
            <h2 className="font-semibold text-gray-900 mb-4">Preview</h2>
            {!showPreview && !previewReport.isPending && (
              <div className="text-center py-8">
                <Play className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click Preview to see results</p>
              </div>
            )}
            {previewReport.isPending && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            )}
            {showPreview && previewData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{previewData.totalRows} rows</span>
                  <span className="text-gray-400">{previewData.executionTimeMs}ms</span>
                </div>
                {previewData.aggregations?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {previewData.aggregations.map((agg: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{agg.label}</p>
                        <p className="text-lg font-semibold text-gray-900">{agg.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
                {previewData.rows?.length > 0 && (
                  <div className="overflow-auto max-h-[400px] rounded border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {previewData.columns?.slice(0, 4).map((col: any) => (
                            <th key={col.field} className="text-left px-2 py-1.5 font-medium text-gray-600">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.rows.slice(0, 20).map((row: any, i: number) => (
                          <tr key={i}>
                            {previewData.columns?.slice(0, 4).map((col: any) => (
                              <td key={col.field} className="px-2 py-1.5 text-gray-700 truncate max-w-[120px]">
                                {row[col.field] != null ? String(row[col.field]) : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {previewData.rows?.length > 20 && (
                  <p className="text-xs text-gray-400 text-center">Showing 20 of {previewData.totalRows} rows</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
