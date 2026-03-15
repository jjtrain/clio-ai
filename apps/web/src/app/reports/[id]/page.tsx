"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  Download,
  Pencil,
  CalendarClock,
  Loader2,
  Clock,
  FileBarChart,
  TrendingUp,
  BarChart3,
} from "lucide-react";

const DATE_RANGES = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
];

function formatCellValue(value: any, format: string): string {
  if (value == null) return "—";
  switch (format) {
    case "currency":
      return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "date":
      return value ? formatDate(value) : "—";
    case "duration":
      return `${Number(value).toFixed(1)}h`;
    default:
      return String(value);
  }
}

export default function ReportViewPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [dateRangeOverride, setDateRangeOverride] = useState("");
  const [result, setResult] = useState<any>(null);

  const { data: report, isLoading: loadingReport } = trpc.reports.getById.useQuery({ id });
  const { data: history } = trpc.reports.getHistory.useQuery({ reportId: id, limit: 5 });

  const runReport = trpc.reports.run.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Report executed successfully" });
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const exportCsv = trpc.reports.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported" });
    },
  });

  const handleRun = () => {
    runReport.mutate({
      reportId: id,
      dateRangeOverride: dateRangeOverride && dateRangeOverride !== "default"
        ? JSON.stringify({ type: dateRangeOverride })
        : undefined,
    });
  };

  if (loadingReport) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <FileBarChart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Report not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/reports">Back to Reports</Link>
        </Button>
      </div>
    );
  }

  const columns = result?.columns || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/reports"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{report.name}</h1>
            {report.description && <p className="text-sm text-gray-500 mt-0.5">{report.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRangeOverride} onValueChange={setDateRangeOverride}>
            <SelectTrigger className="w-[160px] bg-white border-gray-200">
              <SelectValue placeholder="Default range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default range</SelectItem>
              {DATE_RANGES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleRun} disabled={runReport.isPending}>
            {runReport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Report
          </Button>
          {result && (
            <Button variant="outline" onClick={() => exportCsv.mutate({ reportId: id })} disabled={exportCsv.isPending}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/reports/builder?reportId=${id}`}><Pencil className="mr-2 h-4 w-4" />Edit</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/reports/${id}/schedule`}><CalendarClock className="mr-2 h-4 w-4" />Schedule</Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {result && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50"><BarChart3 className="h-5 w-5 text-blue-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Total Rows</p>
                <p className="text-xl font-semibold text-gray-900">{result.totalRows.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50"><Clock className="h-5 w-5 text-green-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Execution Time</p>
                <p className="text-xl font-semibold text-gray-900">{result.executionTimeMs}ms</p>
              </div>
            </div>
          </div>
          {result.aggregations?.slice(0, 2).map((agg: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50"><TrendingUp className="h-5 w-5 text-purple-500" /></div>
                <div>
                  <p className="text-sm text-gray-500">{agg.label}</p>
                  <p className="text-xl font-semibold text-gray-900">{agg.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      {result && result.rows.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {columns.map((col: any) => (
                    <th key={col.field} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {result.rows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    {columns.map((col: any) => (
                      <td key={col.field} className="px-4 py-3 whitespace-nowrap">
                        {col.format === "badge" ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {String(row[col.field] ?? "—")}
                          </span>
                        ) : (
                          <span className="text-gray-700">{formatCellValue(row[col.field], col.format)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : result ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <FileBarChart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No data matches the current filters</p>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Play className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Click &quot;Run Report&quot; to execute</p>
          <p className="text-sm text-gray-400 mt-1">Results will appear here</p>
        </div>
      )}

      {/* Execution History */}
      {history && history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Runs</h2>
          <div className="space-y-2">
            {history.map((exec) => (
              <div key={exec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">{formatDate(exec.createdAt)}</span>
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <span>{exec.rowCount} rows</span>
                  {exec.executionTimeMs && <span>{exec.executionTimeMs}ms</span>}
                  {exec.exportFormat && (
                    <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{exec.exportFormat}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
