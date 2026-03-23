"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  FileCheck,
  AlertTriangle,
  Shield,
  Upload,
  ChevronRight,
  Clock,
  Sparkles,
  FileText,
  Filter,
} from "lucide-react";
import { ReviewDetailView } from "./ReviewDetailView";
import { UploadReviewForm } from "./UploadReviewForm";

type View = "dashboard" | "upload" | "detail";

const RISK_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  high: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  low: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
};

const STATUS_STYLES: Record<string, string> = {
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  attorney_reviewed: "bg-purple-100 text-purple-700",
  archived: "bg-slate-100 text-slate-500",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  discovery_response: "Discovery Response",
  interrogatory_answers: "Interrogatory Answers",
  document_demand_response: "Document Demand Response",
  contract: "Contract",
  lease: "Lease",
  settlement_agreement: "Settlement Agreement",
  court_order: "Court Order",
  pleading: "Pleading",
  deposition_transcript: "Deposition Transcript",
  expert_report: "Expert Report",
  insurance_policy: "Insurance Policy",
  medical_records: "Medical Records",
  corporate_filing: "Corporate Filing",
  will_trust: "Will/Trust",
  immigration_form: "Immigration Form",
  custom: "Other",
};

export default function DocumentReviewDashboard() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const reviewsQuery = trpc.documentReviewFlags.getAllReviews.useQuery({
    status: filterStatus || undefined,
    documentType: filterType || undefined,
  });
  const statsQuery = trpc.documentReviewFlags.getReviewStats.useQuery();

  const reviews = reviewsQuery.data ?? [];
  const stats = statsQuery.data;

  if (view === "detail" && selectedReviewId) {
    return (
      <ReviewDetailView
        reviewId={selectedReviewId}
        onBack={() => {
          setSelectedReviewId(null);
          setView("dashboard");
          reviewsQuery.refetch();
        }}
      />
    );
  }

  if (view === "upload") {
    return (
      <UploadReviewForm
        onBack={() => setView("dashboard")}
        onComplete={(reviewId) => {
          setSelectedReviewId(reviewId);
          setView("detail");
          reviewsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FileCheck className="h-4 w-4" />
            Total Reviews
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {stats?.totalReviews ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <AlertTriangle className="h-4 w-4" />
            Open Flags
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {stats?.openFlags ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <Shield className="h-4 w-4" />
            Critical Flags
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {stats?.criticalFlags ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Sparkles className="h-4 w-4" />
            Total Flags Found
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {stats?.totalFlags ?? 0}
          </p>
        </div>
      </div>

      {/* Upload Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Document Reviews</h2>
          {/* Filters */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="attorney_reviewed">Reviewed</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All Types</option>
            {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setView("upload")}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          <Upload className="h-4 w-4" />
          New Review
        </button>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">
              No document reviews yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload a document to get AI-powered review flags and recommendations.
            </p>
            <button
              onClick={() => setView("upload")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </button>
          </div>
        ) : (
          reviews.map((review: any) => {
            const risk = RISK_COLORS[review.overallRiskLevel] || RISK_COLORS.medium;
            const statusStyle = STATUS_STYLES[review.reviewStatus] || STATUS_STYLES.completed;
            return (
              <button
                key={review.id}
                onClick={() => {
                  setSelectedReviewId(review.id);
                  setView("detail");
                }}
                className="w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {review.documentName}
                      </h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
                        {review.reviewStatus === "attorney_reviewed" ? "Reviewed" : review.reviewStatus}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {DOC_TYPE_LABELS[review.documentType] || review.documentType}
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
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.summaryText && (
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {review.summaryText}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {review.overallRiskLevel && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${risk.bg} ${risk.text}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${risk.dot}`} />
                        {review.overallRiskLevel.toUpperCase()} RISK
                      </span>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {review.criticalFlags > 0 && (
                        <span className="font-semibold text-red-600">
                          {review.criticalFlags} critical
                        </span>
                      )}
                      {review.highFlags > 0 && (
                        <span className="text-orange-600">
                          {review.highFlags} high
                        </span>
                      )}
                      <span>
                        {review.totalFlags} total flags
                      </span>
                      {review.resolvedFlags > 0 && (
                        <span className="text-green-600">
                          {review.resolvedFlags} resolved
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
