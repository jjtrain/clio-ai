"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  AlertTriangle,
  Shield,
  FileText,
  ArrowUpRight,
  X,
  Clock,
  Minus,
} from "lucide-react";

interface FlagCardProps {
  flag: {
    id: string;
    flagType: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    recommendation?: string;
    documentSection?: string;
    pageNumber?: number;
    relevantText?: string;
    ruleReference?: string;
    status: string;
    attorneyNotes?: string;
    resolvedAction?: string;
  };
  onStatusChange: () => void;
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: "border-l-red-500", bg: "bg-red-50/50", icon: "text-red-500" },
  high: { border: "border-l-orange-500", bg: "bg-orange-50/30", icon: "text-orange-500" },
  medium: { border: "border-l-yellow-500", bg: "bg-yellow-50/30", icon: "text-yellow-500" },
  low: { border: "border-l-blue-400", bg: "bg-blue-50/30", icon: "text-blue-400" },
  info: { border: "border-l-slate-400", bg: "bg-slate-50/50", icon: "text-slate-400" },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  missing_item: "Missing Item",
  inconsistency: "Inconsistency",
  unusual_clause: "Unusual Clause",
  boilerplate_deviation: "Boilerplate Issue",
  privilege_issue: "Privilege Issue",
  incomplete_response: "Incomplete Response",
  evasive_response: "Evasive Response",
  missing_document: "Missing Document",
  date_discrepancy: "Date Discrepancy",
  amount_discrepancy: "Amount Discrepancy",
  undefined_term: "Undefined Term",
  ambiguous_language: "Ambiguous Language",
  unfavorable_term: "Unfavorable Term",
  missing_protection: "Missing Protection",
  compliance_issue: "Compliance Issue",
  deadline_triggered: "Deadline Triggered",
  custom: "Flag",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open", icon: AlertTriangle },
  { value: "acknowledged", label: "Acknowledged", icon: Check },
  { value: "resolved", label: "Resolved", icon: Check },
  { value: "disputed", label: "Disputed", icon: X },
  { value: "deferred", label: "Deferred", icon: Clock },
  { value: "not_applicable", label: "N/A", icon: Minus },
];

const RESOLVED_ACTIONS = [
  "follow_up_sent",
  "motion_filed",
  "accepted_as_is",
  "negotiated",
  "na",
];

export function FlagCard({ flag, onStatusChange }: FlagCardProps) {
  const [expanded, setExpanded] = useState(flag.severity === "critical");
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(flag.attorneyNotes || "");
  const [resolvedAction, setResolvedAction] = useState("");

  const updateStatus = trpc.documentReviewFlags.updateFlagStatus.useMutation({
    onSuccess: () => onStatusChange(),
  });
  const addNote = trpc.documentReviewFlags.addFlagNote.useMutation({
    onSuccess: () => {
      setShowNotes(false);
      onStatusChange();
    },
  });

  const style = SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.info;
  const isResolved = flag.status === "resolved" || flag.status === "not_applicable";

  return (
    <div
      className={`rounded-lg border border-l-4 ${style.border} ${
        isResolved ? "opacity-60" : ""
      } ${style.bg} transition-all`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="mt-0.5 flex-shrink-0">
          {flag.severity === "critical" ? (
            <Shield className={`h-4 w-4 ${style.icon}`} />
          ) : (
            <AlertTriangle className={`h-4 w-4 ${style.icon}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900">
              {flag.title}
            </h4>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 uppercase">
              {FLAG_TYPE_LABELS[flag.flagType] || flag.flagType}
            </span>
            {flag.status !== "open" && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                flag.status === "resolved" ? "bg-green-100 text-green-700" :
                flag.status === "acknowledged" ? "bg-blue-100 text-blue-700" :
                flag.status === "disputed" ? "bg-red-100 text-red-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {flag.status}
              </span>
            )}
          </div>
          {!expanded && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
              {flag.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {flag.ruleReference && (
            <span className="hidden sm:inline text-xs text-blue-600 font-mono">
              {flag.ruleReference}
            </span>
          )}
          {flag.documentSection && (
            <span className="hidden sm:inline text-xs text-slate-400">
              {flag.documentSection}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-200/50 px-4 pb-4 pt-3 ml-7">
          {/* Description */}
          <p className="text-sm text-slate-700 leading-relaxed">
            {flag.description}
          </p>

          {/* Relevant text */}
          {flag.relevantText && (
            <div className="mt-3 rounded-lg bg-white/80 border border-slate-200 px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Relevant Text
              </p>
              <p className="text-xs text-slate-600 italic leading-relaxed">
                &ldquo;{flag.relevantText}&rdquo;
              </p>
            </div>
          )}

          {/* Recommendation */}
          {flag.recommendation && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">
                Recommended Action
              </p>
              <p className="text-xs text-blue-800 leading-relaxed">
                {flag.recommendation}
              </p>
            </div>
          )}

          {/* Metadata row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {flag.ruleReference && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {flag.ruleReference}
              </span>
            )}
            {flag.documentSection && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {flag.documentSection}
              </span>
            )}
            {flag.pageNumber && (
              <span>Page {flag.pageNumber}</span>
            )}
          </div>

          {/* Attorney notes */}
          {flag.attorneyNotes && !showNotes && (
            <div className="mt-3 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
              <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider mb-1">
                Attorney Notes
              </p>
              <p className="text-xs text-purple-800">{flag.attorneyNotes}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isResolved && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ flagId: flag.id, status: "acknowledged" });
                }}
                disabled={updateStatus.isPending || flag.status === "acknowledged"}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                <Check className="h-3 w-3" />
                Acknowledge
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({
                    flagId: flag.id,
                    status: "resolved",
                    resolvedAction: resolvedAction || "accepted_as_is",
                  });
                }}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                <Check className="h-3 w-3" />
                Resolve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ flagId: flag.id, status: "deferred" });
                }}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <Clock className="h-3 w-3" />
                Defer
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus.mutate({ flagId: flag.id, status: "not_applicable" });
                }}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <Minus className="h-3 w-3" />
                N/A
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotes(!showNotes);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                Note
              </button>
            </div>
          )}

          {/* Notes input */}
          {showNotes && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addNote.mutate({ flagId: flag.id, note: noteText });
                }}
                disabled={addNote.isPending || !noteText.trim()}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
