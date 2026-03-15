"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  Star,
  MoreHorizontal,
  Play,
  Pencil,
  Copy,
  Trash2,
  FileBarChart,
  Clock,
  Receipt,
  Briefcase,
  Users,
  Inbox,
  Calendar,
  CalendarClock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const TYPE_STYLES: Record<string, string> = {
  FINANCIAL: "bg-green-100 text-green-700",
  MATTERS: "bg-purple-100 text-purple-700",
  CLIENTS: "bg-blue-100 text-blue-700",
  TIME: "bg-amber-100 text-amber-700",
  LEADS: "bg-teal-100 text-teal-700",
  APPOINTMENTS: "bg-pink-100 text-pink-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};

const SOURCE_ICONS: Record<string, any> = {
  invoices: Receipt,
  timeEntries: Clock,
  matters: Briefcase,
  clients: Users,
  leads: Inbox,
  appointments: CalendarClock,
};

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: reports, isLoading } = trpc.reports.list.useQuery(
    showFavoritesOnly ? { isFavorite: true } : undefined
  );

  const runReport = trpc.reports.run.useMutation({
    onSuccess: () => toast({ title: "Report executed" }),
  });

  const toggleFav = trpc.reports.toggleFavorite.useMutation({
    onSuccess: () => utils.reports.list.invalidate(),
  });

  const duplicateReport = trpc.reports.duplicate.useMutation({
    onSuccess: () => {
      toast({ title: "Report duplicated" });
      utils.reports.list.invalidate();
    },
  });

  const deleteReport = trpc.reports.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Report deleted" });
      utils.reports.list.invalidate();
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const filtered = reports?.filter((r) => {
    if (typeFilter !== "all" && r.reportType !== typeFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const systemReports = filtered?.filter((r) => r.isSystem);
  const customReports = filtered?.filter((r) => !r.isSystem);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Build and run custom reports</p>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
          <Link href="/reports/builder">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-white border-gray-200">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="FINANCIAL">Financial</SelectItem>
            <SelectItem value="MATTERS">Matters</SelectItem>
            <SelectItem value="CLIENTS">Clients</SelectItem>
            <SelectItem value="TIME">Time</SelectItem>
            <SelectItem value="LEADS">Leads</SelectItem>
            <SelectItem value="APPOINTMENTS">Appointments</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={showFavoritesOnly ? "bg-amber-500 hover:bg-amber-600" : ""}
        >
          <Star className={`mr-1.5 h-3.5 w-3.5 ${showFavoritesOnly ? "fill-white" : ""}`} />
          Favorites
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* System Reports */}
          {systemReports && systemReports.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">System Reports</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {systemReports.map((report) => {
                  const SourceIcon = SOURCE_ICONS[report.dataSource] || FileBarChart;
                  return (
                    <div key={report.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-100">
                            <SourceIcon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{report.name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{report.description}</p>
                          </div>
                        </div>
                        <button onClick={() => toggleFav.mutate({ id: report.id })}>
                          <Star className={`h-4 w-4 ${report.isFavorite ? "text-amber-500 fill-amber-500" : "text-gray-300"}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[report.reportType] || TYPE_STYLES.CUSTOM}`}>
                          {report.reportType}
                        </span>
                        {report.lastRunAt && (
                          <span className="text-xs text-gray-400">Last run {formatDate(report.lastRunAt)}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" asChild className="flex-1 bg-blue-500 hover:bg-blue-600">
                          <Link href={`/reports/${report.id}`}>
                            <Play className="mr-1.5 h-3 w-3" />
                            Run
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/reports/builder?reportId=${report.id}`}>
                            <Pencil className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Reports */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {systemReports && systemReports.length > 0 ? "My Reports" : "Reports"}
            </h2>
            {!customReports || customReports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
                <FileBarChart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No custom reports yet</p>
                <p className="text-gray-400 text-sm mt-1">Build your first report to get started</p>
                <Button asChild className="mt-4" variant="outline" size="sm">
                  <Link href="/reports/builder">
                    <Plus className="mr-2 h-4 w-4" />
                    New Report
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {customReports.map((report) => {
                  const SourceIcon = SOURCE_ICONS[report.dataSource] || FileBarChart;
                  return (
                    <div key={report.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-gray-100 flex-shrink-0">
                            <SourceIcon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{report.name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{report.description || "No description"}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/reports/${report.id}`}>
                                <Play className="mr-2 h-4 w-4" />Run
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/reports/builder?reportId=${report.id}`}>
                                <Pencil className="mr-2 h-4 w-4" />Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateReport.mutate({ id: report.id })}>
                              <Copy className="mr-2 h-4 w-4" />Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFav.mutate({ id: report.id })}>
                              <Star className="mr-2 h-4 w-4" />{report.isFavorite ? "Unfavorite" : "Favorite"}
                            </DropdownMenuItem>
                            {!report.isSystem && (
                              <DropdownMenuItem className="text-red-600" onClick={() => {
                                if (confirm("Delete this report?")) deleteReport.mutate({ id: report.id });
                              }}>
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[report.reportType] || TYPE_STYLES.CUSTOM}`}>
                          {report.reportType}
                        </span>
                        {report.isScheduled && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            <Calendar className="inline h-3 w-3 mr-0.5" />Scheduled
                          </span>
                        )}
                        <button onClick={() => toggleFav.mutate({ id: report.id })}>
                          <Star className={`h-4 w-4 ${report.isFavorite ? "text-amber-500 fill-amber-500" : "text-gray-300"}`} />
                        </button>
                      </div>
                      {report.lastRunAt && (
                        <p className="text-xs text-gray-400 mb-3">Last run {formatDate(report.lastRunAt)}</p>
                      )}
                      <Button size="sm" asChild className="w-full bg-blue-500 hover:bg-blue-600">
                        <Link href={`/reports/${report.id}`}>
                          <Play className="mr-1.5 h-3 w-3" />
                          Run Report
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
