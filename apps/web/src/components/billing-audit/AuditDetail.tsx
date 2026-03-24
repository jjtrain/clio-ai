"use client";

import { useState } from "react";
import { ArrowLeft, Shield, Sparkles, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronRight, Wand2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { FlagCard } from "./FlagCard";

interface AuditDetailProps {
  auditId: string;
  onBack: () => void;
}

const gradeConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  A: { label: "Clean — Ready to send", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-200" },
  B: { label: "Minor issues — Quick fixes", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  C: { label: "Significant issues — Needs review", color: "text-yellow-700", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  D: { label: "Major problems — Do not send yet", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  F: { label: "Critical issues — Requires immediate attention", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
};

export function AuditDetail({ auditId, onBack }: AuditDetailProps) {
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data: audit, refetch } = trpc.billingAudit.getAudit.useQuery({ auditId });
  const utils = trpc.useUtils();

  if (!audit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
        <span className="ml-2 text-sm text-gray-500">Loading audit...</span>
      </div>
    );
  }

  const gc = gradeConfig[audit.overallGrade || "?"] || gradeConfig.C;
  const recommendations = (audit.recommendations as any[]) || [];

  const filteredFlags = audit.flags.filter((f) => {
    if (filterSeverity && f.severity !== filterSeverity) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    return true;
  });

  const openFlags = audit.flags.filter((f) => f.status === "open").length;
  const resolvedFlags = audit.flags.filter((f) => f.status !== "open").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Results</h1>
            <p className="text-xs text-gray-500">
              {audit.auditType.replace(/_/g, " ")} · {new Date(audit.createdAt).toLocaleDateString()}
              {audit.processingTime && ` · ${audit.processingTime}s`}
            </p>
          </div>
        </div>
      </div>

      {/* Grade + Summary Banner */}
      <div className={cn("rounded-xl border-2 p-5", gc.bgColor, gc.borderColor)}>
        <div className="flex items-start gap-4">
          <div className={cn("h-16 w-16 rounded-xl border-2 flex items-center justify-center font-bold text-3xl flex-shrink-0", gc.color, gc.borderColor)}>
            {audit.overallGrade}
          </div>
          <div className="flex-1">
            <p className={cn("text-sm font-semibold", gc.color)}>{gc.label}</p>
            <p className="text-sm text-gray-700 mt-1">{audit.summaryText}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
              <span>{audit.totalEntriesReviewed} entries</span>
              <span>{audit.totalHoursReviewed.toFixed(1)}h reviewed</span>
              <span>${audit.totalAmountReviewed.toFixed(2)}</span>
              {audit.estimatedSavings && audit.estimatedSavings > 0 && (
                <span className="text-green-600 font-medium">
                  ~${audit.estimatedSavings.toFixed(0)} potential savings
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Critical", count: audit.criticalFlags, color: "text-red-600 bg-red-50" },
          { label: "High", count: audit.highFlags, color: "text-orange-600 bg-orange-50" },
          { label: "Medium", count: audit.mediumFlags, color: "text-yellow-600 bg-yellow-50" },
          { label: "Low", count: audit.lowFlags, color: "text-blue-600 bg-blue-50" },
          { label: "Resolved", count: resolvedFlags, color: "text-green-600 bg-green-50" },
        ].map((item) => (
          <Card
            key={item.label}
            className={cn("p-3 text-center cursor-pointer transition-all hover:shadow-sm", filterSeverity === item.label.toLowerCase() && "ring-2 ring-blue-500")}
            onClick={() => setFilterSeverity(filterSeverity === item.label.toLowerCase() ? null : item.label.toLowerCase())}
          >
            <p className={cn("text-2xl font-bold", item.color.split(" ")[0])}>{item.count}</p>
            <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-blue-500" />
            Recommendations
          </h2>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                <Badge
                  className={cn("text-[10px] mt-0.5 flex-shrink-0", {
                    "bg-red-100 text-red-700": rec.priority === "critical",
                    "bg-orange-100 text-orange-700": rec.priority === "high",
                    "bg-yellow-100 text-yellow-700": rec.priority === "medium",
                    "bg-blue-100 text-blue-700": rec.priority === "low",
                  })}
                >
                  {rec.priority}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{rec.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rec.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {filteredFlags.length} {filteredFlags.length === 1 ? "flag" : "flags"}
          </span>
          <div className="flex items-center gap-1">
            {["open", "accepted", "rejected", "deferred"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded-md transition-colors capitalize",
                  filterStatus === s ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {filterSeverity && (
          <button onClick={() => setFilterSeverity(null)} className="text-xs text-blue-600 hover:text-blue-800">
            Clear filter
          </button>
        )}
      </div>

      {/* Flags List */}
      <div className="space-y-3">
        {filteredFlags.map((flag) => (
          <FlagCard
            key={flag.id}
            flag={flag}
            onResolved={() => refetch()}
          />
        ))}
        {filteredFlags.length === 0 && (
          <Card className="p-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">
              {audit.flags.length === 0 ? "No issues found" : "All matching flags resolved"}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
