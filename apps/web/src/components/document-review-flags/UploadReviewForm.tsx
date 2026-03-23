"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  ClipboardPaste,
} from "lucide-react";

interface UploadReviewFormProps {
  onBack: () => void;
  onComplete: (reviewId: string) => void;
}

const DOCUMENT_TYPES = [
  { value: "", label: "Auto-detect" },
  { value: "discovery_response", label: "Discovery Response" },
  { value: "interrogatory_answers", label: "Interrogatory Answers" },
  { value: "document_demand_response", label: "Document Demand Response" },
  { value: "contract", label: "Contract" },
  { value: "lease", label: "Lease Agreement" },
  { value: "settlement_agreement", label: "Settlement Agreement" },
  { value: "court_order", label: "Court Order" },
  { value: "pleading", label: "Pleading" },
  { value: "deposition_transcript", label: "Deposition Transcript" },
  { value: "expert_report", label: "Expert Report" },
  { value: "insurance_policy", label: "Insurance Policy" },
  { value: "medical_records", label: "Medical Records" },
  { value: "corporate_filing", label: "Corporate Filing" },
  { value: "will_trust", label: "Will / Trust" },
  { value: "immigration_form", label: "Immigration Form" },
  { value: "custom", label: "Other" },
];

const PRACTICE_AREAS = [
  { value: "", label: "Auto-detect" },
  { value: "personal_injury", label: "Personal Injury" },
  { value: "family_law", label: "Family Law" },
  { value: "immigration", label: "Immigration" },
  { value: "corporate", label: "Corporate" },
  { value: "litigation", label: "Litigation" },
  { value: "criminal", label: "Criminal" },
  { value: "real_estate", label: "Real Estate" },
  { value: "estate_planning", label: "Estate Planning" },
  { value: "general", label: "General" },
];

const JURISDICTIONS = [
  { value: "", label: "Not specified" },
  { value: "ny_supreme", label: "NY Supreme Court" },
  { value: "ny_federal_edny", label: "EDNY (Eastern District)" },
  { value: "ny_federal_sdny", label: "SDNY (Southern District)" },
  { value: "ny_family", label: "NY Family Court" },
  { value: "ny_surrogate", label: "NY Surrogate's Court" },
  { value: "ca_superior", label: "CA Superior Court" },
  { value: "federal_general", label: "Federal (General)" },
];

const LOADING_PHASES = [
  "Analyzing document structure...",
  "Identifying document type...",
  "Scanning for missing items...",
  "Checking for inconsistencies...",
  "Evaluating legal risks...",
  "Generating recommendations...",
];

export function UploadReviewForm({ onBack, onComplete }: UploadReviewFormProps) {
  const [documentName, setDocumentName] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [comparisonText, setComparisonText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

  const submitMutation = trpc.documentReviewFlags.submitForReview.useMutation({
    onSuccess: (data) => {
      onComplete(data.review.id);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentText.trim() || !documentName.trim()) return;

    // Start cycling through loading messages
    let phase = 0;
    const interval = setInterval(() => {
      phase = Math.min(phase + 1, LOADING_PHASES.length - 1);
      setLoadingPhase(phase);
    }, 3000);

    submitMutation.mutate(
      {
        documentName,
        documentText,
        documentType: documentType || undefined,
        practiceArea: practiceArea || undefined,
        jurisdiction: jurisdiction || undefined,
        comparisonText: comparisonText || undefined,
        customInstructions: customInstructions || undefined,
      },
      {
        onSettled: () => clearInterval(interval),
      }
    );
  }

  const inputClasses =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
  const labelClasses = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Submit Document for Review
          </h2>
          <p className="text-sm text-slate-500">
            Paste or upload a document text for AI-powered analysis
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content - left 2 cols */}
          <div className="space-y-5 lg:col-span-2">
            {/* Document Name */}
            <div>
              <label className={labelClasses}>Document Name</label>
              <input
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g., Defendant's Response to Interrogatories — Smith v. Jones"
                className={inputClasses}
                required
              />
            </div>

            {/* Document Text */}
            <div>
              <label className={labelClasses}>
                Document Text
                <span className="ml-2 text-xs font-normal text-slate-400">
                  Paste the full document text below
                </span>
              </label>
              <textarea
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                rows={16}
                placeholder="Paste the full document text here...

Example: Discovery responses, contract text, pleadings, deposition transcript excerpts, expert reports, etc."
                className={`${inputClasses} resize-y font-mono text-xs`}
                required
              />
              {documentText && (
                <p className="mt-1 text-xs text-slate-400">
                  {documentText.length.toLocaleString()} characters
                  {documentText.length > 80000 && " (will be truncated to 80,000 for analysis)"}
                </p>
              )}
            </div>

            {/* Comparison Document */}
            <div>
              <button
                type="button"
                onClick={() => setShowComparison(!showComparison)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <ClipboardPaste className="h-4 w-4" />
                {showComparison ? "Hide" : "Add"} Comparison Document
                <span className="text-xs font-normal text-slate-400">
                  (original demand/request to compare against)
                </span>
              </button>
              {showComparison && (
                <textarea
                  value={comparisonText}
                  onChange={(e) => setComparisonText(e.target.value)}
                  rows={8}
                  placeholder="Paste the original demand, request, or template to compare against..."
                  className={`${inputClasses} mt-2 resize-y font-mono text-xs`}
                />
              )}
            </div>

            {/* Custom Instructions */}
            <div>
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                {showInstructions ? "Hide" : "Add"} Custom Review Instructions
              </button>
              {showInstructions && (
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g., 'Pay special attention to insurance coverage gaps' or 'Focus on non-compete clause enforceability'"
                  className={`${inputClasses} mt-2 resize-y`}
                />
              )}
            </div>
          </div>

          {/* Settings - right col */}
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Review Settings
              </h3>

              <div>
                <label className={labelClasses}>Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className={inputClasses}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>Practice Area</label>
                <select
                  value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value)}
                  className={inputClasses}
                >
                  {PRACTICE_AREAS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>Jurisdiction</label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className={inputClasses}
                >
                  {JURISDICTIONS.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* What to expect */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <h4 className="text-xs font-semibold text-blue-800 mb-2">
                AI Review Will Check For:
              </h4>
              <ul className="space-y-1 text-xs text-blue-700">
                <li>Missing items and incomplete responses</li>
                <li>Inconsistencies and date discrepancies</li>
                <li>Unusual or unfavorable clauses</li>
                <li>Privilege issues without privilege logs</li>
                <li>Boilerplate objections lacking specificity</li>
                <li>Evasive or non-responsive answers</li>
                <li>Compliance issues and deadlines triggered</li>
                <li>Practice-area-specific red flags</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitMutation.isPending || !documentText.trim() || !documentName.trim()}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LOADING_PHASES[loadingPhase]}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run AI Review
              </>
            )}
          </button>
        </div>

        {submitMutation.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error: {submitMutation.error?.message || "Review failed. Please try again."}
          </div>
        )}
      </form>
    </div>
  );
}
