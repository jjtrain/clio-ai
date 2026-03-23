"use client";

import React, { useState } from "react";
import { Check, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";

interface DeadlineData {
  id: string;
  name: string;
  description: string;
  ruleReference: string;
  category: string;
  deadlineDate: string;
  originalDate: string;
  adjustedForWeekend: boolean;
  adjustedForHoliday: boolean;
  holidayName: string;
  adjustmentDays: number;
  priority: string;
  status: string;
  chainName?: string;
}

interface DeadlineCardProps {
  deadline: DeadlineData;
  compact?: boolean;
  onComplete?: (id: string) => void;
  onExtend?: (id: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  normal: "#3B82F6",
  low: "#9CA3AF",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Responsive Pleading": { bg: "bg-red-100", text: "text-red-700" },
  Discovery: { bg: "bg-blue-100", text: "text-blue-700" },
  Motion: { bg: "bg-purple-100", text: "text-purple-700" },
  "Trial Prep": { bg: "bg-orange-100", text: "text-orange-700" },
  Administrative: { bg: "bg-gray-100", text: "text-gray-600" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
  });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownLabel(days: number): string {
  if (days === 0) return "TODAY";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  const abs = Math.abs(days);
  return `${abs} day${abs === 1 ? "" : "s"} ago`;
}

function countdownColor(days: number): string {
  if (days < 0) return "text-red-500";
  if (days <= 3) return "text-orange-500";
  if (days <= 7) return "text-yellow-500";
  return "text-green-500";
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return (
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600">
          <Check className="w-3 h-3" />
        </div>
      );
    case "extended":
      return (
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600">
          <ArrowUpRight className="w-3 h-3" />
        </div>
      );
    case "waived":
      return (
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-400">
          <span className="text-xs leading-none">&oslash;</span>
        </div>
      );
    default:
      return null;
  }
}

export function DeadlineCard({
  deadline,
  compact = true,
  onComplete,
  onExtend,
}: DeadlineCardProps) {
  const [expanded, setExpanded] = useState(!compact);

  const days = getDaysUntil(deadline.deadlineDate);
  const priorityColor = PRIORITY_COLORS[deadline.priority] || PRIORITY_COLORS.normal;
  const catColors =
    CATEGORY_COLORS[deadline.category] || CATEGORY_COLORS.Administrative;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white hover:shadow-sm transition-shadow"
    >
      {/* Compact row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Priority dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityColor }}
        />

        {/* Name */}
        <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">
          {deadline.name}
        </span>

        {/* Chain name */}
        {deadline.chainName && (
          <span className="hidden sm:inline text-xs text-slate-400 flex-shrink-0">
            {deadline.chainName}
          </span>
        )}

        {/* Date */}
        <span className="text-xs text-slate-500 flex-shrink-0">
          {formatDate(deadline.deadlineDate)}
        </span>

        {/* Countdown */}
        <span
          className={`text-xs font-medium flex-shrink-0 w-20 text-right ${countdownColor(days)}`}
        >
          {countdownLabel(days)}
        </span>

        {/* Status icon */}
        <div className="flex-shrink-0">{statusIcon(deadline.status)}</div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 text-slate-400">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          {deadline.description && (
            <p className="text-xs text-slate-500 mb-2">{deadline.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-2">
            {deadline.ruleReference && (
              <span className="text-xs text-slate-400 font-mono">
                {deadline.ruleReference}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catColors.bg} ${catColors.text}`}
            >
              {deadline.category}
            </span>
          </div>

          {(deadline.adjustedForWeekend || deadline.adjustedForHoliday) && (
            <p className="text-xs text-amber-600 mb-1">
              Adjusted from {formatDate(deadline.originalDate)}
              {deadline.adjustedForHoliday && deadline.holidayName
                ? ` (${deadline.holidayName})`
                : " (weekend)"}
            </p>
          )}

          {deadline.adjustmentDays > 0 && (
            <p className="text-xs text-slate-400 mb-2">
              +{deadline.adjustmentDays} adjustment days
            </p>
          )}

          {/* Action buttons */}
          {deadline.status === "pending" && (onComplete || onExtend) && (
            <div className="flex items-center gap-2 mt-2">
              {onComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete(deadline.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Complete
                </button>
              )}
              {onExtend && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExtend(deadline.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  Extend
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
