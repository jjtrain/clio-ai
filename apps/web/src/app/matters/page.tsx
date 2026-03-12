"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Search, MoreHorizontal, Briefcase, Scale, LayoutList, Kanban } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const stageConfig: Record<string, { label: string; color: string; border: string; bg: string; text: string; badge: string }> = {
  NEW:            { label: "New",            color: "blue",    border: "border-t-blue-400",    bg: "bg-blue-50",    text: "text-blue-700",    badge: "bg-blue-100 text-blue-700" },
  CONSULTATION:   { label: "Consultation",   color: "purple",  border: "border-t-purple-400",  bg: "bg-purple-50",  text: "text-purple-700",  badge: "bg-purple-100 text-purple-700" },
  CONFLICT_CHECK: { label: "Conflict Check", color: "amber",   border: "border-t-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",   badge: "bg-amber-100 text-amber-700" },
  RETAINER_SENT:  { label: "Retainer Sent",  color: "orange",  border: "border-t-orange-400",  bg: "bg-orange-50",  text: "text-orange-700",  badge: "bg-orange-100 text-orange-700" },
  RETAINED:       { label: "Retained",       color: "emerald", border: "border-t-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  ACTIVE:         { label: "Active",         color: "green",   border: "border-t-green-400",   bg: "bg-green-50",   text: "text-green-700",   badge: "bg-green-100 text-green-700" },
};

const STAGES = ["NEW", "CONSULTATION", "CONFLICT_CHECK", "RETAINER_SENT", "RETAINED", "ACTIVE"] as const;

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MattersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Load view preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("matters-view");
    if (saved === "table" || saved === "kanban") setView(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("matters-view", view);
  }, [view]);

  // Table view query
  const { data: tableData, isLoading: tableLoading } = trpc.matters.list.useQuery({
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    pipelineStage: stageFilter !== "all" ? (stageFilter as any) : undefined,
  });

  // Kanban view query
  const { data: kanbanData, isLoading: kanbanLoading } = trpc.matters.getByPipelineStage.useQuery(
    { search: search || undefined },
    { enabled: view === "kanban" }
  );

  const utils = trpc.useUtils();

  const updateStage = trpc.matters.updatePipelineStage.useMutation({
    onSuccess: () => {
      utils.matters.getByPipelineStage.invalidate();
      utils.matters.list.invalidate();
    },
  });

  const closeMatter = trpc.matters.close.useMutation({
    onSuccess: () => {
      utils.matters.getByPipelineStage.invalidate();
      utils.matters.list.invalidate();
    },
  });

  const handleStageDrop = (matterId: string, newStage: string) => {
    // Optimistic: already handled visually by re-render after mutation
    updateStage.mutate({ id: matterId, stage: newStage as any });
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "OPEN": return "bg-emerald-100 text-emerald-700";
      case "CLOSED": return "bg-gray-100 text-gray-600";
      case "PENDING": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const isLoading = view === "table" ? tableLoading : kanbanLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Matters</h1>
          <p className="text-gray-500 mt-1">Manage your legal matters and cases</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setView("table")}
              className={cn(
                "p-2 rounded-md transition-colors",
                view === "table" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
              title="Table view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "p-2 rounded-md transition-colors",
                view === "kanban" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
              title="Board view"
            >
              <Kanban className="h-4 w-4" />
            </button>
          </div>
          <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
            <Link href="/matters/new">
              <Plus className="mr-2 h-4 w-4" />
              New Matter
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by matter name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-white border-gray-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        {view === "table" && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[170px] bg-white border-gray-200">
              <SelectValue placeholder="Pipeline Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{stageConfig[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="text-gray-500 mt-3">Loading matters...</p>
          </div>
        </div>
      )}

      {/* Table View */}
      {!isLoading && view === "table" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-semibold text-gray-600">Matter</TableHead>
                <TableHead className="font-semibold text-gray-600">Client</TableHead>
                <TableHead className="font-semibold text-gray-600">Practice Area</TableHead>
                <TableHead className="font-semibold text-gray-600">Status</TableHead>
                <TableHead className="font-semibold text-gray-600">Pipeline Stage</TableHead>
                <TableHead className="font-semibold text-gray-600">Opened</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData?.matters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No matters found</p>
                    <p className="text-gray-400 text-sm mt-1">Create your first matter to get started</p>
                    <Button asChild className="mt-4" variant="outline">
                      <Link href="/matters/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Matter
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                tableData?.matters.map((matter) => (
                  <TableRow key={matter.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <Link href={"/matters/" + matter.id} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Scale className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 hover:text-blue-600">{matter.name}</p>
                          <p className="text-sm text-gray-500 font-mono">{matter.matterNumber}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={"/clients/" + matter.client.id} className="text-gray-600 hover:text-blue-600">
                        {matter.client.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {matter.practiceArea ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-sm">
                          {matter.practiceArea}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(matter.status)}`}>
                        {matter.status === "OPEN" && (
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                        )}
                        {matter.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageConfig[matter.pipelineStage]?.badge || "bg-gray-100 text-gray-600"}`}>
                        {stageConfig[matter.pipelineStage]?.label || matter.pipelineStage}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(matter.openDate)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={"/matters/" + matter.id}>View Details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={"/matters/" + matter.id + "/edit"}>Edit Matter</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={"/time/new?matterId=" + matter.id}>Log Time</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Kanban View */}
      {!isLoading && view === "kanban" && kanbanData && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="flex gap-4 min-w-max">
            {STAGES.map((stage) => {
              const config = stageConfig[stage];
              const matters = kanbanData[stage] || [];
              return (
                <div
                  key={stage}
                  className={cn(
                    "w-[300px] flex-shrink-0 rounded-xl border-t-4 bg-gray-50/80 border border-gray-200 transition-all",
                    config.border,
                    dragOverColumn === stage && "ring-2 ring-blue-400 bg-blue-50/50"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverColumn(stage);
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const matterId = e.dataTransfer.getData("matterId");
                    if (matterId) handleStageDrop(matterId, stage);
                    setDragOverColumn(null);
                  }}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-gray-700">{config.label}</h3>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.badge)}>
                        {matters.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {matters.map((matter: any) => (
                      <div
                        key={matter.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("matterId", matter.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(matter.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={cn(
                          "bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
                          draggingId === matter.id && "opacity-50 scale-95"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-gray-900 truncate">{matter.name}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{matter.matterNumber}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-gray-100 text-gray-400 flex-shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={"/matters/" + matter.id}>View Details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/calendar/new?matterId=${matter.id}&title=Consultation: ${matter.client.name}`}>
                                  Schedule Consultation
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  // TODO: integrate with document generation
                                  updateStage.mutate({ id: matter.id, stage: "RETAINER_SENT" });
                                }}
                              >
                                Send Retainer
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={"/time/new?matterId=" + matter.id}>Log Time</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => closeMatter.mutate({ id: matter.id })}
                              >
                                Close Matter
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5 truncate">{matter.client.name}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {matter.practiceArea && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {matter.practiceArea}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(matter.updatedAt)}</span>
                        </div>
                      </div>
                    ))}
                    {matters.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs">
                        No matters
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
