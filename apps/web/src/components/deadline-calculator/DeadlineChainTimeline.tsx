"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Check,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Pause,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  Ban,
} from "lucide-react";
import { RuleReferencePopover } from "./RuleReferencePopover";

interface Chain {
  id: string;
  name: string;
  triggerEvent: string;
  triggerDate: string;
  jurisdiction: string;
  practiceArea: string;
  serviceMethod: string;
  status: string;
  stayStartDate?: string;
  stayEndDate?: string;
  matterId?: string;
}

interface Deadline {
  id: string;
  name: string;
  description: string;
  ruleReference: string;
  category: string;
  baseCalcDays: number;
  adjustmentDays: number;
  totalDays: number;
  deadlineDate: string;
  originalDate: string;
  adjustedForWeekend: boolean;
  adjustedForHoliday: boolean;
  holidayName: string;
  isBusinessDays: boolean;
  priority: string;
  status: string;
  completedAt: string | null;
  extendedTo: string | null;
  extensionReason: string | null;
  dependsOnRule: string | null;
  sortOrder: number;
}

interface DeadlineChainTimelineProps {
  chain: Chain;
  deadlines: Deadline[];
  isPreview?: boolean;
  onBack?: () => void;
  onSave?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Responsive Pleading": { bg: "bg-red-100", text: "text-red-700" },
  Discovery: { bg: "bg-blue-100", text: "text-blue-700" },
  Motion: { bg: "bg-purple-100", text: "text-purple-700" },
  "Trial Prep": { bg: "bg-orange-100", text: "text-orange-700" },
  Administrative: { bg: "bg-gray-100", text: "text-gray-600" },
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  Active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
  Stayed: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Stayed" },
  Completed: { bg: "bg-gray-100", text: "text-gray-600", label: "Completed" },
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

export function DeadlineChainTimeline({
  chain,
  deadlines,
  isPreview = false,
  onBack,
  onSave,
}: DeadlineChainTimelineProps) {
  const [showStayModal, setShowStayModal] = useState(false);
  const [stayStart, setStayStart] = useState("");
  const [stayEnd, setStayEnd] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [extendReason, setExtendReason] = useState("");

  const syncMutation = trpc.deadlineCalculator.syncChainToCalendar.useMutation();
  const completeMutation = trpc.deadlineCalculator.markDeadlineCompleted.useMutation();
  const extendMutation = trpc.deadlineCalculator.extendDeadline.useMutation();
  const waiveMutation = trpc.deadlineCalculator.waiveDeadline.useMutation();

  const sorted = [...deadlines].sort((a, b) => a.sortOrder - b.sortOrder);

  const statusBadge = STATUS_BADGE[chain.status] || STATUS_BADGE.Active;

  // Find position of today marker among deadlines
  const todayIndex = sorted.findIndex((d) => getDaysUntil(d.deadlineDate) >= 0);

  function handleComplete(id: string) {
    completeMutation.mutate({ deadlineId: id });
  }

  function handleExtendSubmit(id: string) {
    if (!extendDate) return;
    extendMutation.mutate({
      deadlineId: id,
      newDate: extendDate,
      reason: extendReason,
    });
    setExtendingId(null);
    setExtendDate("");
    setExtendReason("");
  }

  function handleWaive(id: string) {
    waiveMutation.mutate({ deadlineId: id });
  }

  function renderStatusIcon(deadline: Deadline) {
    const days = getDaysUntil(deadline.deadlineDate);
    const isCritical = deadline.priority === "critical";
    const sizeClass = isCritical ? "w-5 h-5" : "w-4 h-4";
    const pulseClass =
      isCritical && deadline.status === "pending" && days <= 0
        ? "animate-pulse"
        : "";

    switch (deadline.status) {
      case "completed":
        return (
          <div
            className={`flex items-center justify-center rounded-full bg-green-500 text-white ${sizeClass} ${pulseClass}`}
          >
            <Check className="w-3 h-3" />
          </div>
        );
      case "extended":
        return (
          <div
            className={`flex items-center justify-center rounded-full bg-blue-500 text-white ${sizeClass} ${pulseClass}`}
          >
            <ArrowUpRight className="w-3 h-3" />
          </div>
        );
      case "waived":
        return (
          <div
            className={`flex items-center justify-center rounded-full bg-gray-400 text-white ${sizeClass} ${pulseClass}`}
          >
            <Ban className="w-3 h-3" />
          </div>
        );
      case "missed":
        return (
          <div
            className={`flex items-center justify-center rounded-full bg-red-500 text-white ${sizeClass} ${pulseClass}`}
          >
            <span className="text-xs font-bold leading-none">&times;</span>
          </div>
        );
      default: {
        // pending
        const dotColor =
          days < 0 ? "bg-red-500" : "bg-blue-500";
        return (
          <div
            className={`rounded-full ${dotColor} ${sizeClass} ${pulseClass}`}
          />
        );
      }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-xl font-semibold text-slate-900">{chain.name}</h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-10">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {chain.triggerEvent}
          </span>
          <span className="text-sm text-slate-500">{formatDate(chain.triggerDate)}</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {chain.jurisdiction}
          </span>
          <span className="text-xs text-slate-400">{chain.serviceMethod}</span>
          {chain.matterId && (
            <a
              href={`/matters/${chain.matterId}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <FileText className="w-3 h-3" />
              Linked to matter
            </a>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {!isPreview && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <button
            onClick={() => syncMutation.mutate({ chainId: chain.id })}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Calendar className="w-4 h-4" />
            {syncMutation.isPending ? "Syncing..." : "Sync to Calendar"}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Recalculate
          </button>
          <button
            onClick={() => setShowStayModal(!showStayModal)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pause className="w-4 h-4" />
            Apply Stay
          </button>

          {showStayModal && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={stayStart}
                onChange={(e) => setStayStart(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
              <span className="text-sm text-slate-400">to</span>
              <input
                type="date"
                value={stayEnd}
                onChange={(e) => setStayEnd(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
              <button
                onClick={() => setShowStayModal(false)}
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          )}

          <div className="ml-auto">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Delete this chain?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button className="rounded-lg bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 transition-colors">
                  Confirm
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[200px] top-0 bottom-0 w-px bg-slate-200" />

          {sorted.map((deadline, idx) => {
            const days = getDaysUntil(deadline.deadlineDate);
            const isPast = days < 0;
            const isOverduePending = isPast && deadline.status === "pending";
            const showTodayMarker = todayIndex === idx;

            const catColors = CATEGORY_COLORS[deadline.category] || CATEGORY_COLORS.Administrative;

            return (
              <React.Fragment key={deadline.id}>
                {/* Today marker */}
                {showTodayMarker && (
                  <div className="relative flex items-center mb-6">
                    <div className="absolute left-0 right-0 h-px bg-red-400" />
                    <span className="relative z-10 ml-[170px] bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                      TODAY
                    </span>
                  </div>
                )}

                <div
                  className={`relative flex items-start gap-4 mb-8 ${
                    isPast ? "opacity-60" : ""
                  } ${
                    isOverduePending
                      ? "ring-1 ring-red-300 rounded-xl p-3 -mx-3 animate-pulse"
                      : ""
                  }`}
                >
                  {/* LEFT: date + countdown */}
                  <div className="w-[180px] flex-shrink-0 text-right pr-4">
                    <p className="text-sm font-medium text-slate-700">
                      {formatDate(deadline.deadlineDate)}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        days < 0
                          ? "text-red-500 font-medium"
                          : days === 0
                          ? "text-red-600 font-bold"
                          : days <= 3
                          ? "text-orange-500"
                          : "text-slate-400"
                      }`}
                    >
                      {countdownLabel(days)}
                    </p>
                  </div>

                  {/* CENTER: dot on timeline */}
                  <div className="flex-shrink-0 relative z-10 mt-1">
                    {renderStatusIcon(deadline)}
                  </div>

                  {/* RIGHT: details */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {deadline.name}
                        </p>
                        {deadline.ruleReference && (
                          <RuleReferencePopover
                            ruleReference={deadline.ruleReference}
                            description={deadline.description}
                            category={deadline.category}
                          />
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catColors.bg} ${catColors.text}`}
                      >
                        {deadline.category}
                      </span>
                    </div>

                    {deadline.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {deadline.description}
                      </p>
                    )}

                    {(deadline.adjustedForWeekend || deadline.adjustedForHoliday) && (
                      <p className="text-xs text-amber-600 mt-1">
                        Adjusted from {formatDate(deadline.originalDate)}
                        {deadline.adjustedForHoliday && deadline.holidayName
                          ? ` (${deadline.holidayName})`
                          : " (weekend)"}
                      </p>
                    )}

                    {deadline.adjustmentDays > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        +{deadline.adjustmentDays} days for {chain.serviceMethod}
                      </p>
                    )}

                    {/* Action buttons */}
                    {!isPreview && deadline.status === "pending" && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleComplete(deadline.id)}
                          disabled={completeMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Complete
                        </button>
                        <button
                          onClick={() => {
                            setExtendingId(deadline.id);
                            setExtendDate("");
                            setExtendReason("");
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          Extend
                        </button>
                        <button
                          onClick={() => handleWaive(deadline.id)}
                          disabled={waiveMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <Ban className="w-3 h-3" />
                          Waive
                        </button>
                      </div>
                    )}

                    {/* Inline extend form */}
                    {extendingId === deadline.id && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                        <input
                          type="date"
                          value={extendDate}
                          onChange={(e) => setExtendDate(e.target.value)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                        />
                        <select
                          value={extendReason}
                          onChange={(e) => setExtendReason(e.target.value)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                        >
                          <option value="">Select reason...</option>
                          <option value="Stipulation with opposing counsel">
                            Stipulation with opposing counsel
                          </option>
                          <option value="Court order">Court order</option>
                          <option value="Good cause">Good cause</option>
                          <option value="Consent of all parties">
                            Consent of all parties
                          </option>
                        </select>
                        <button
                          onClick={() => handleExtendSubmit(deadline.id)}
                          disabled={extendMutation.isPending}
                          className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setExtendingId(null)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* If all deadlines are in the past, show TODAY marker at the end */}
          {todayIndex === -1 && sorted.length > 0 && (
            <div className="relative flex items-center mt-2">
              <div className="absolute left-0 right-0 h-px bg-red-400" />
              <span className="relative z-10 ml-[170px] bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                TODAY
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar (preview mode) */}
      {isPreview && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Save &amp; Sync to Calendar
          </button>
        </div>
      )}
    </div>
  );
}
