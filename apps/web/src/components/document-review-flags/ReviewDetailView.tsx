"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Shield,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  CheckCircle,
  XCircle,
  Minus,
  BarChart3,
} from "lucide-react";
import { FlagCard } from "./FlagCard";

interface ReviewDetailViewProps {
  reviewId: string;
  onBack: () => void;
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-200" },
  high: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-200" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-200" },
  low: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400", border: "border-blue-200" },
  info: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", border: "border-slate-200" },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-red-100", text: "text-red-700" },
  high: { bg: "bg-orange-100", text: "text-orange-700" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700" },
  low: { bg: "bg-green-100", text: "text-green-700" },
};

const CATEGORY_LABELS: Record<string, string> = {
  completeness: "Completeness",
  accuracy: "Accuracy",
  legal_risk: "Legal Risk",
  compliance: "Compliance",
  negotiation_point: "Negotiation Point",
  privilege: "Privilege",
  procedural: "Procedural",
  substantive: "Substantive",
};

export function ReviewDetailView({ reviewId, onBack }: ReviewDetailViewProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showSummary, setShowSummary] = useState(true);
  const [showComparison, setShowComparison] = useState(false);

  const reviewQuery = trpc.documentReviewFlags.getReview.useQuery(
    { reviewId },
  );
  const markReviewed = trpc.documentReviewFlags.markReviewed.useMutation({
    onSuccess: () => reviewQuery.refetch(),
  });

  const data = reviewQuery.data;
  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Clock className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Loading review...</p>
        </div>
      </div>
    );
  }

  const { review, flags, comparison } = data as any;
  const riskStyle = RISK_COLORS[review.overallRiskLevel] || RISK_COLORS.medium;

  // Apply filters
  let filteredFlags = flags || [];
  if (filterSeverity) {
    filteredFlags = filteredFlags.filter((f: any) => f.severity === filterSeverity);
  }
  if (filterCategory) {
    filteredFlags = filteredFlags.filter((f: any) => f.category === filterCategory);
  }
  if (filterStatus) {
    filteredFlags = filteredFlags.filter((f: any) => f.status === filterStatus);
  }

  // Sort by severity order
  filteredFlags.sort((a: any, b: any) => {
    const aIdx = SEVERITY_ORDER.indexOf(a.severity);
    const bIdx = SEVERITY_ORDER.indexOf(b.severity);
    return aIdx - bIdx;
  });

  // Group by severity
  const grouped: Record<string, any[]> = {};
  for (const flag of filteredFlags) {
    if (!grouped[flag.severity]) grouped[flag.severity] = [];
    grouped[flag.severity].push(flag);
  }

  // Category counts
  const categoryMap: Record<string, number> = {};
  for (const f of flags || []) {
    categoryMap[f.category] = (categoryMap[f.category] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {review.documentName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {review.documentType}
              </span>
              {review.practiceArea && (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
                  {review.practiceArea}
                </span>
              )}
              {review.jurisdiction && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">
                  {review.jurisdiction}
                </span>
              )}
              {review.aiModelUsed && (
                <span className="text-slate-400">
                  AI: {review.aiModelUsed}
                </span>
              )}
              {review.processingTime && (
                <span className="text-slate-400">
                  {review.processingTime}s
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${riskStyle.bg} ${riskStyle.text}`}>
            {(review.overallRiskLevel || "").toUpperCase()} RISK
          </span>
          {review.reviewStatus !== "attorney_reviewed" && (
            <button
              onClick={() => markReviewed.mutate({ reviewId })}
              disabled={markReviewed.isPending}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Check className="inline h-3.5 w-3.5 mr-1" />
              Mark Reviewed
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-slate-700">Executive Summary</h3>
          </div>
          {showSummary ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {showSummary && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-3">
            <p className="text-sm text-slate-700 leading-relaxed">
              {review.summaryText}
            </p>

            {/* Flag counts bar */}
            <div className="mt-4 flex items-center gap-4 text-xs">
              <span className="font-medium text-slate-500">
                {review.totalFlags} flags:
              </span>
              {review.criticalFlags > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {review.criticalFlags} critical
                </span>
              )}
              {review.highFlags > 0 && (
                <span className="flex items-center gap-1 text-orange-600">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  {review.highFlags} high
                </span>
              )}
              {review.mediumFlags > 0 && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  {review.mediumFlags} medium
                </span>
              )}
              {review.lowFlags > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {review.lowFlags} low
                </span>
              )}
              {review.resolvedFlags > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  {review.resolvedFlags} resolved
                </span>
              )}
            </div>

            {/* Category breakdown */}
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(categoryMap).map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    filterCategory === cat
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat} ({count})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comparison Results (if available) */}
      {comparison && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700">
                Comparison Results
              </h3>
              {comparison.matchPercentage != null && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  comparison.matchPercentage >= 80 ? "bg-green-100 text-green-700" :
                  comparison.matchPercentage >= 50 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {Math.round(comparison.matchPercentage)}% match
                </span>
              )}
            </div>
            {showComparison ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {showComparison && (
            <div className="border-t border-slate-100 px-5 pb-5 pt-3 space-y-4">
              {comparison.missingItems && comparison.missingItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Missing / Not Addressed ({comparison.missingItems.length})
                  </h4>
                  <ul className="space-y-1">
                    {comparison.missingItems.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-red-600 pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-400">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {comparison.matchedItems && comparison.matchedItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Addressed ({comparison.matchedItems.length})
                  </h4>
                  <ul className="space-y-1">
                    {comparison.matchedItems.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-green-600 pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-green-400">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {comparison.extraItems && comparison.extraItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                    <Minus className="h-3.5 w-3.5" />
                    Extra Items ({comparison.extraItems.length})
                  </h4>
                  <ul className="space-y-1">
                    {comparison.extraItems.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-blue-600 pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-blue-400">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Filter flags:</span>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="disputed">Disputed</option>
          <option value="deferred">Deferred</option>
          <option value="not_applicable">N/A</option>
        </select>
        {(filterSeverity || filterCategory || filterStatus) && (
          <button
            onClick={() => {
              setFilterSeverity("");
              setFilterCategory("");
              setFilterStatus("");
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          Showing {filteredFlags.length} of {(flags || []).length} flags
        </span>
      </div>

      {/* Flags grouped by severity */}
      <div className="space-y-6">
        {SEVERITY_ORDER.filter((sev) => grouped[sev]?.length > 0).map((severity) => {
          const sevStyle = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
          return (
            <div key={severity}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2.5 w-2.5 rounded-full ${sevStyle.dot}`} />
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${sevStyle.text}`}>
                  {severity} ({grouped[severity].length})
                </h3>
              </div>
              <div className="space-y-3">
                {grouped[severity].map((flag: any) => (
                  <FlagCard
                    key={flag.id}
                    flag={flag}
                    onStatusChange={() => reviewQuery.refetch()}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {filteredFlags.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
            <p className="mt-2 text-sm text-slate-500">
              {(flags || []).length === 0
                ? "No flags found — document appears clean."
                : "No flags match the current filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}
