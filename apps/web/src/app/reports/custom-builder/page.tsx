"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  BarChart3,
  X,
  Play,
  Save,
  Download,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  PieChart,
  LineChart,
  Table,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type FieldMeta = {
  key: string;
  label: string;
  entity: string;
  type: string;
  options?: string[];
  description?: string;
};

type FilterRow = {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "between" | "contains";
  value: any;
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "not equal",
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
  in: "in",
  between: "between",
  contains: "contains",
};

const CHART_ICONS: Record<string, any> = {
  table: Table,
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
};

export default function CustomReportBuilderPage() {
  const registryQuery = trpc.reportBuilder.getFieldRegistry.useQuery();
  const savedReportsQuery = trpc.reportBuilder.listSavedReports.useQuery();
  const runMutation = trpc.reportBuilder.runReport.useMutation();
  const saveMutation = trpc.reportBuilder.saveReport.useMutation({
    onSuccess: () => {
      savedReportsQuery.refetch();
      setSaveDialogOpen(false);
    },
  });
  const deleteMutation = trpc.reportBuilder.deleteReport.useMutation({
    onSuccess: () => savedReportsQuery.refetch(),
  });
  const duplicateMutation = trpc.reportBuilder.duplicateReport.useMutation({
    onSuccess: () => savedReportsQuery.refetch(),
  });

  const fields: FieldMeta[] = registryQuery.data || [];
  const saved = savedReportsQuery.data || [];

  // Builder state
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [groupBy, setGroupBy] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [chartType, setChartType] = useState<"table" | "bar" | "line" | "pie">("table");
  const [limit, setLimit] = useState(500);
  const [results, setResults] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState<Record<string, boolean>>({
    matter: true,
    client: true,
    billing: true,
    attorney: true,
  });

  const entities = Array.from(new Set(fields.map((f) => f.entity)));

  function toggleEntity(entity: string) {
    setExpandedEntities((prev) => ({ ...prev, [entity]: !prev[entity] }));
  }

  function addField(key: string) {
    if (!selectedFields.includes(key)) {
      setSelectedFields([...selectedFields, key]);
    }
  }

  function removeField(key: string) {
    setSelectedFields(selectedFields.filter((f) => f !== key));
    setFilters(filters.filter((f) => f.field !== key));
    if (groupBy === key) setGroupBy("");
    if (sortBy === key) setSortBy("");
  }

  function addFilter() {
    if (selectedFields.length === 0) return;
    setFilters([...filters, { field: selectedFields[0], operator: "eq", value: "" }]);
  }

  function updateFilter(idx: number, updates: Partial<FilterRow>) {
    setFilters(filters.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  }

  function removeFilter(idx: number) {
    setFilters(filters.filter((_, i) => i !== idx));
  }

  function runReport() {
    if (selectedFields.length === 0) return;
    runMutation.mutate(
      {
        fields: selectedFields,
        filters,
        groupBy: groupBy || undefined,
        sortBy: sortBy || undefined,
        sortDir,
        chartType,
        limit,
      },
      { onSuccess: (data) => setResults(data) }
    );
  }

  function handleSave() {
    if (!reportName) return;
    saveMutation.mutate({
      id: editingId || undefined,
      name: reportName,
      description: reportDesc || undefined,
      config: {
        fields: selectedFields,
        filters,
        groupBy: groupBy || undefined,
        sortBy: sortBy || undefined,
        sortDir,
        chartType,
        limit,
      },
    });
  }

  function loadReport(config: any) {
    setSelectedFields(config.fields || []);
    setFilters(config.filters || []);
    setGroupBy(config.groupBy || "");
    setSortBy(config.sortBy || "");
    setSortDir(config.sortDir || "desc");
    setChartType(config.chartType || "table");
    setLimit(config.limit || 500);
    setResults(null);
  }

  function exportCsv() {
    if (!results || results.rows.length === 0) return;
    const header = results.columns.map((c) => {
      const meta = fields.find((f) => f.key === c);
      return meta?.label || c;
    }).join(",");
    const csvRows = results.rows.map((row) =>
      results.columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getFieldMeta(key: string): FieldMeta | undefined {
    return fields.find((f) => f.key === key);
  }

  function formatCell(value: any, fieldKey: string): string {
    if (value === null || value === undefined) return "—";
    const meta = getFieldMeta(fieldKey);
    if (!meta) return String(value);
    if (meta.type === "currency") return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (meta.type === "date") return value ? new Date(value).toLocaleDateString() : "—";
    if (meta.type === "number") return Number(value).toLocaleString();
    return String(value);
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-indigo-600" />
            Custom Report Builder
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Select fields, add filters, and run reports — no SQL needed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSavedPanel(!showSavedPanel)}>
            <BookOpen className="h-4 w-4 mr-1" /> Saved ({saved.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setReportName("");
              setReportDesc("");
              setSaveDialogOpen(true);
            }}
            disabled={selectedFields.length === 0}
          >
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button size="sm" onClick={runReport} disabled={selectedFields.length === 0 || runMutation.isLoading}>
            {runMutation.isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Run
          </Button>
        </div>
      </div>

      {/* Save dialog */}
      {saveDialogOpen && (
        <Card className="p-4 border-indigo-200 bg-indigo-50/50">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600">Report Name</label>
              <Input
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="e.g. Revenue by Practice Area"
                className="mt-1 h-8 text-sm bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600">Description (optional)</label>
              <Input
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Brief description..."
                className="mt-1 h-8 text-sm bg-white"
              />
            </div>
            <Button size="sm" onClick={handleSave} disabled={!reportName || saveMutation.isLoading}>
              {saveMutation.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {editingId ? "Update" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Saved reports panel */}
      {showSavedPanel && saved.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Saved Reports</h3>
          <div className="space-y-1">
            {saved.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                <button className="text-left flex-1" onClick={() => { loadReport(r.config); setShowSavedPanel(false); }}>
                  <span className="text-sm font-medium text-gray-800">{r.name}</span>
                  {r.description && <span className="text-xs text-gray-400 ml-2">{r.description}</span>}
                  {r.isTemplate && <Badge className="ml-2 text-[10px] bg-indigo-100 text-indigo-700">Template</Badge>}
                </button>
                <div className="flex gap-1">
                  <button onClick={() => duplicateMutation.mutate({ id: r.id })} className="p-1 text-gray-400 hover:text-gray-600">
                    <Copy className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteMutation.mutate({ id: r.id })} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Field Picker */}
        <div className="col-span-3">
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Available Fields</h3>
            {entities.map((entity) => (
              <div key={entity} className="mb-1">
                <button
                  onClick={() => toggleEntity(entity)}
                  className="flex items-center gap-1 w-full text-left text-xs font-semibold text-gray-600 py-1 hover:text-gray-900"
                >
                  {expandedEntities[entity] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {entity.charAt(0).toUpperCase() + entity.slice(1)}
                </button>
                {expandedEntities[entity] && (
                  <div className="ml-4 space-y-0.5">
                    {fields.filter((f) => f.entity === entity).map((field) => {
                      const isSelected = selectedFields.includes(field.key);
                      return (
                        <button
                          key={field.key}
                          onClick={() => (isSelected ? removeField(field.key) : addField(field.key))}
                          className={cn(
                            "flex items-center justify-between w-full text-left text-xs py-1 px-2 rounded",
                            isSelected ? "bg-indigo-100 text-indigo-800 font-medium" : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          <span>{field.label}</span>
                          <Badge className="text-[9px] px-1" variant="outline">
                            {field.type}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>

        {/* Center: Canvas */}
        <div className="col-span-6 space-y-4">
          {/* Selected field chips */}
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Report Columns ({selectedFields.length})
            </h3>
            {selectedFields.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                Click fields on the left to add columns
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedFields.map((key) => {
                  const meta = getFieldMeta(key);
                  return (
                    <Badge
                      key={key}
                      className="text-xs px-2 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 cursor-default flex items-center gap-1"
                    >
                      {meta?.label || key}
                      <button onClick={() => removeField(key)} className="hover:text-red-600 ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Filters */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filters
              </h3>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addFilter} disabled={selectedFields.length === 0}>
                + Add
              </Button>
            </div>
            {filters.length === 0 ? (
              <p className="text-xs text-gray-400">No filters — showing all data</p>
            ) : (
              <div className="space-y-2">
                {filters.map((f, idx) => {
                  const meta = getFieldMeta(f.field);
                  return (
                    <div key={idx} className="flex gap-2 items-center">
                      <Select value={f.field} onValueChange={(v) => updateFilter(idx, { field: v })}>
                        <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {selectedFields.map((fk) => (
                            <SelectItem key={fk} value={fk}>{getFieldMeta(fk)?.label || fk}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={f.operator} onValueChange={(v: any) => updateFilter(idx, { operator: v })}>
                        <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(OPERATOR_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {meta?.type === "enum" && meta.options ? (
                        <Select value={String(f.value)} onValueChange={(v) => updateFilter(idx, { value: f.operator === "in" ? v.split(",") : v })}>
                          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {meta.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={Array.isArray(f.value) ? f.value.join(", ") : String(f.value || "")}
                          onChange={(e) => {
                            const val = f.operator === "in" ? e.target.value.split(",").map((s) => s.trim()) : e.target.value;
                            updateFilter(idx, { value: val });
                          }}
                          className="h-7 text-xs flex-1"
                          placeholder="Value..."
                        />
                      )}
                      <button onClick={() => removeFilter(idx)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Results table */}
          {results && (
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Results ({results.rows.length} rows)
                </h3>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={exportCsv}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              <div className="overflow-auto max-h-[500px] rounded border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {results.columns.map((col) => (
                        <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                          {getFieldMeta(col)?.label || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {results.columns.map((col) => (
                          <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                            {formatCell(row[col], col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.rows.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No data matches your criteria</p>
              )}
            </Card>
          )}
        </div>

        {/* Right: Controls */}
        <div className="col-span-3 space-y-4">
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Display</h3>
            <div className="grid grid-cols-4 gap-1 mb-3">
              {(["table", "bar", "line", "pie"] as const).map((ct) => {
                const Icon = CHART_ICONS[ct];
                return (
                  <button
                    key={ct}
                    onClick={() => setChartType(ct)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-2 rounded text-xs",
                      chartType === ct ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {ct}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Group By</label>
                <Select value={groupBy || "none"} onValueChange={(v) => setGroupBy(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {selectedFields.map((fk) => (
                      <SelectItem key={fk} value={fk}>{getFieldMeta(fk)?.label || fk}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Sort By</label>
                <Select value={sortBy || "none"} onValueChange={(v) => setSortBy(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default</SelectItem>
                    {selectedFields.map((fk) => (
                      <SelectItem key={fk} value={fk}>{getFieldMeta(fk)?.label || fk}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Direction</label>
                <Select value={sortDir} onValueChange={(v: any) => setSortDir(v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Row Limit</label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 500)}
                  className="h-7 text-xs mt-0.5"
                  min={1}
                  max={5000}
                />
              </div>
            </div>
          </Card>

          {/* Quick stats from results */}
          {results && groupBy && (
            <Card className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Grouped Summary
              </h3>
              <div className="space-y-1">
                {results.rows.map((row, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-700 truncate">{row[groupBy] || "Unknown"}</span>
                    {row._count != null && (
                      <Badge variant="outline" className="text-[10px]">{row._count}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
