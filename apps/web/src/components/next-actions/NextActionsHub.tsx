"use client";

import { useState } from "react";
import { Zap, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ActionCard } from "./ActionCard";

const urgencyGroups = [
  { key: "immediate", label: "DO NOW \u2014 Immediate", color: "text-red-700", bgColor: "bg-red-50", dotColor: "bg-red-500", defaultOpen: true },
  { key: "this_week", label: "THIS WEEK", color: "text-orange-700", bgColor: "bg-orange-50", dotColor: "bg-orange-500", defaultOpen: true },
  { key: "next_two_weeks", label: "NEXT TWO WEEKS", color: "text-yellow-700", bgColor: "bg-yellow-50", dotColor: "bg-yellow-500", defaultOpen: false },
  { key: "this_month", label: "THIS MONTH", color: "text-blue-700", bgColor: "bg-blue-50", dotColor: "bg-blue-500", defaultOpen: false },
  { key: "when_possible", label: "WHEN POSSIBLE", color: "text-gray-600", bgColor: "bg-gray-50", dotColor: "bg-gray-400", defaultOpen: false },
];

const filterChips = ["All", "Filing", "Discovery", "Client Communication", "Correspondence", "Billing", "Strategic"];

export function NextActionsHub() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(urgencyGroups.map((g) => [g.key, g.defaultOpen]))
  );
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: grouped, refetch, isLoading } = trpc.nextActions.getActionsByUrgency.useQuery();
  const { data: stats } = trpc.nextActions.getActionStats.useQuery();
  const { data: overdue } = trpc.nextActions.getOverdueFollowUps.useQuery();
  const refreshAll = trpc.nextActions.refreshAllActions.useMutation({ onSuccess: () => refetch() });

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filterType = activeFilter === "All" ? null : activeFilter.toLowerCase().replace(/ /g, "_");

  const totalActions = stats ? stats.totalPending : 0;
  const matterCount = grouped
    ? new Set(Object.values(grouped).flat().map((a) => a.matterId)).size
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-7 w-7 text-yellow-500" />
            Suggested Next Actions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalActions > 0
              ? `You have ${totalActions} suggested actions across ${matterCount} matters`
              : "No pending actions"}
            {overdue && overdue.length > 0 && (
              <span className="text-red-500 ml-2">{overdue.length} overdue follow-ups</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshAll.mutate()}
          disabled={refreshAll.isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", refreshAll.isLoading && "animate-spin")} />
          Refresh All
        </Button>
      </div>

      {/* Urgency Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {urgencyGroups.map((g) => {
            const count = grouped ? (grouped[g.key]?.length || 0) : 0;
            return (
              <Card
                key={g.key}
                className={cn("p-3 cursor-pointer transition-all hover:shadow-sm", g.bgColor)}
                onClick={() => {
                  setExpanded((prev) => ({ ...prev, [g.key]: true }));
                  document.getElementById(`group-${g.key}`)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("h-3 w-3 rounded-full", g.dotColor)} />
                  <span className={cn("text-2xl font-bold", g.color)}>{count}</span>
                </div>
                <p className="text-[10px] font-medium text-gray-500 mt-1">{g.label}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filterChips.map((chip) => (
          <button
            key={chip}
            onClick={() => setActiveFilter(chip)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
              activeFilter === chip
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Grouped Action Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
          <span className="ml-2 text-sm text-gray-500">Loading actions...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {urgencyGroups.map((group) => {
            const actions = grouped?.[group.key] || [];
            const filtered = filterType
              ? actions.filter((a) => a.actionType === filterType)
              : actions;

            if (filtered.length === 0 && !expanded[group.key]) return null;

            return (
              <div key={group.key} id={`group-${group.key}`}>
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="flex items-center gap-2 w-full py-2 mb-2"
                >
                  <div className={cn("h-2.5 w-2.5 rounded-full", group.dotColor)} />
                  <span className={cn("text-xs font-bold uppercase tracking-wider", group.color)}>
                    {group.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {filtered.length}
                  </Badge>
                  <div className="flex-1 h-px bg-gray-100 ml-2" />
                  {expanded[group.key]
                    ? <ChevronDown className="h-4 w-4 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 text-gray-400" />
                  }
                </button>

                {expanded[group.key] && (
                  <div className="space-y-2 ml-1">
                    {filtered.length > 0 ? (
                      filtered.map((action) => (
                        <ActionCard key={action.id} action={action} onUpdate={() => refetch()} />
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 py-2 ml-5">No actions in this category</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Overdue Follow-ups */}
      {overdue && overdue.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-red-600 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            Overdue Follow-ups ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((action) => (
              <ActionCard key={action.id} action={action} onUpdate={() => refetch()} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
