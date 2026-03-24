"use client";

import { useState } from "react";
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Wand2, Clock, DollarSign,
  ArrowRight, Ban, ThumbsUp, ThumbsDown, SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface FlagCardProps {
  flag: {
    id: string;
    flagType: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    recommendation?: string | null;
    suggestedDescription?: string | null;
    suggestedHours?: number | null;
    currentValue?: string | null;
    expectedValue?: string | null;
    ruleReference?: string | null;
    financialImpact?: number | null;
    status: string;
    resolution?: string | null;
    timeEntryId?: string | null;
  };
  onResolved: () => void;
}

const severityConfig: Record<string, { icon: any; color: string; bgColor: string; barColor: string }> = {
  critical: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50", barColor: "bg-red-500" },
  high: { icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-50", barColor: "bg-orange-500" },
  medium: { icon: AlertCircle, color: "text-yellow-600", bgColor: "bg-yellow-50", barColor: "bg-yellow-500" },
  low: { icon: Info, color: "text-blue-600", bgColor: "bg-blue-50", barColor: "bg-blue-400" },
  info: { icon: Info, color: "text-slate-500", bgColor: "bg-slate-50", barColor: "bg-slate-400" },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  block_billing: "Block Billing",
  vague_description: "Vague Description",
  excessive_time: "Excessive Time",
  duplicate_entry: "Duplicate Entry",
  rate_inconsistency: "Rate Inconsistency",
  no_value_description: "No-Value Description",
  missing_detail: "Missing Detail",
  unusual_hours: "Unusual Hours",
  weekend_billing: "Weekend Billing",
  rounded_time: "Rounded Time",
  guideline_violation: "Guideline Violation",
  minimum_billing_excessive: "Minimum Billing Padding",
  multiple_attorneys_same_task: "Multiple Attorneys Same Task",
  chronological_gap: "Chronological Gap",
  overhead_task: "Overhead Task",
};

export function FlagCard({ flag, onResolved }: FlagCardProps) {
  const [isExpanded, setIsExpanded] = useState(flag.status === "open");

  const resolveMutation = trpc.billingAudit.resolveFlag.useMutation({
    onSuccess: () => onResolved(),
  });

  const acceptFixMutation = trpc.billingAudit.acceptSuggestedFix.useMutation({
    onSuccess: () => onResolved(),
  });

  const sc = severityConfig[flag.severity] || severityConfig.medium;
  const Icon = sc.icon;
  const isResolved = flag.status !== "open";
  const hasSuggestion = !!(flag.suggestedDescription || flag.suggestedHours);

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      isResolved && "opacity-60",
      flag.severity === "critical" && flag.status === "open" && "ring-1 ring-red-200"
    )}>
      <div className="flex">
        {/* Severity Bar */}
        <div className={cn("w-1.5 flex-shrink-0", sc.barColor)} />

        <div className="flex-1 p-4">
          {/* Header */}
          <div
            className="flex items-start justify-between gap-3 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn("flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center mt-0.5", sc.bgColor)}>
                <Icon className={cn("h-4 w-4", sc.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">{flag.title}</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                    {FLAG_TYPE_LABELS[flag.flagType] || flag.flagType.replace(/_/g, " ")}
                  </Badge>
                  <Badge className={cn("text-[10px] px-1.5 py-0 capitalize", sc.bgColor, sc.color)}>
                    {flag.severity}
                  </Badge>
                  {isResolved && (
                    <Badge className={cn("text-[10px] px-1.5 py-0", {
                      "bg-green-100 text-green-700": flag.status === "accepted" || flag.status === "auto_fixed" || flag.status === "manually_fixed",
                      "bg-gray-100 text-gray-600": flag.status === "rejected" || flag.status === "deferred",
                    })}>
                      {flag.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{flag.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {flag.financialImpact != null && flag.financialImpact > 0 && (
                <span className="text-xs font-medium text-red-500 flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3" />
                  {flag.financialImpact.toFixed(2)}
                </span>
              )}
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 ml-11 space-y-3">
              {/* Current vs Expected */}
              {(flag.currentValue || flag.expectedValue) && (
                <div className="flex items-center gap-3 text-xs">
                  {flag.currentValue && (
                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-mono">{flag.currentValue}</span>
                  )}
                  {flag.currentValue && flag.expectedValue && (
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                  )}
                  {flag.expectedValue && (
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded font-mono">{flag.expectedValue}</span>
                  )}
                </div>
              )}

              {/* Recommendation */}
              {flag.recommendation && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Recommendation</p>
                  <p className="text-xs text-blue-600">{flag.recommendation}</p>
                </div>
              )}

              {/* AI Suggested Description */}
              {flag.suggestedDescription && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1">
                    <Wand2 className="h-3 w-3" />
                    AI-Suggested Description
                  </p>
                  <p className="text-xs text-purple-600 italic">&ldquo;{flag.suggestedDescription}&rdquo;</p>
                </div>
              )}

              {/* Suggested Hours */}
              {flag.suggestedHours != null && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Suggested Hours
                  </p>
                  <p className="text-xs text-purple-600">{flag.suggestedHours}h (currently {flag.currentValue})</p>
                </div>
              )}

              {/* Rule Reference */}
              {flag.ruleReference && (
                <p className="text-[10px] text-gray-400">
                  Reference: {flag.ruleReference}
                </p>
              )}

              {/* Resolution */}
              {flag.resolution && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-700">Resolution: {flag.resolution}</p>
                </div>
              )}

              {/* Action Buttons */}
              {!isResolved && (
                <div className="flex items-center gap-2 pt-1">
                  {hasSuggestion && (
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); acceptFixMutation.mutate({ flagId: flag.id }); }}
                      disabled={acceptFixMutation.isLoading}
                      className="gap-1.5 text-xs h-8 bg-purple-600 hover:bg-purple-700"
                    >
                      <Wand2 className="h-3 w-3" />
                      Apply AI Fix
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); resolveMutation.mutate({ flagId: flag.id, action: "accepted", resolution: "Manually addressed" }); }}
                    disabled={resolveMutation.isLoading}
                    className="gap-1.5 text-xs h-8"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Fixed
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); resolveMutation.mutate({ flagId: flag.id, action: "rejected", resolution: "Not applicable" }); }}
                    disabled={resolveMutation.isLoading}
                    className="gap-1.5 text-xs h-8 text-gray-500"
                  >
                    <ThumbsDown className="h-3 w-3" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); resolveMutation.mutate({ flagId: flag.id, action: "deferred", resolution: "Deferred to later" }); }}
                    disabled={resolveMutation.isLoading}
                    className="gap-1.5 text-xs h-8 text-gray-400"
                  >
                    <SkipForward className="h-3 w-3" />
                    Defer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
