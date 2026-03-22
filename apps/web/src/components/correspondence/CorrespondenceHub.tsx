"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Briefcase,
  Mail,
  Gavel,
  FileText,
  Sparkles,
  Plus,
  Send,
  Edit2,
  Archive,
  Clock,
  ChevronRight,
} from "lucide-react";

const QUICK_ACTIONS = [
  {
    label: "Letter to Opposing Counsel",
    type: "opposing_counsel_letter",
    icon: Briefcase,
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    label: "Client Update Email",
    type: "client_update_email",
    icon: Mail,
    bg: "bg-green-50",
    iconColor: "text-green-600",
  },
  {
    label: "Court Filing Cover",
    type: "court_filing_cover",
    icon: Gavel,
    bg: "bg-red-50",
    iconColor: "text-red-600",
  },
  {
    label: "Demand Letter",
    type: "demand_letter",
    icon: FileText,
    bg: "bg-orange-50",
    iconColor: "text-orange-600",
  },
  {
    label: "Quick Draft",
    type: "quick_draft",
    icon: Sparkles,
    bg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  reviewed: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

function CorrespondenceTypeBadge({ type }: { type: string }) {
  const dotColors: Record<string, string> = {
    opposing_counsel_letter: "bg-blue-500",
    client_update_email: "bg-green-500",
    court_filing_cover: "bg-red-500",
    demand_letter: "bg-orange-500",
    quick_draft: "bg-purple-500",
  };

  const labels: Record<string, string> = {
    opposing_counsel_letter: "Opposing Counsel",
    client_update_email: "Client Update",
    court_filing_cover: "Court Filing",
    demand_letter: "Demand Letter",
    quick_draft: "Quick Draft",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span
        className={`h-2 w-2 rounded-full ${dotColors[type] ?? "bg-slate-400"}`}
      />
      {labels[type] ?? type}
    </span>
  );
}

export default function CorrespondenceHub() {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState("");
  const [showQuickDraft, setShowQuickDraft] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"drafts" | "sent" | "all">(
    "drafts"
  );

  const { data: drafts, isLoading } =
    trpc.correspondence.getRecentDrafts.useQuery({
      limit: 20,
      status:
        activeTab === "all"
          ? undefined
          : activeTab === "drafts"
            ? "draft"
            : "sent",
    });

  function handleQuickAction(type: string) {
    if (type === "quick_draft") {
      setShowQuickDraft(true);
    } else {
      setWizardType(type);
      setShowWizard(true);
    }
  }

  // ---------- Overlay states ----------

  if (showWizard) {
    const DraftWizard =
      require("./DraftWizard").default as React.ComponentType<{
        type: string;
        onClose: () => void;
      }>;
    return (
      <DraftWizard type={wizardType} onClose={() => setShowWizard(false)} />
    );
  }

  if (showQuickDraft) {
    const QuickDraftInput =
      require("./QuickDraftInput").default as React.ComponentType<{
        onClose: () => void;
      }>;
    return <QuickDraftInput onClose={() => setShowQuickDraft(false)} />;
  }

  if (selectedDraftId) {
    const DraftEditor =
      require("./DraftEditor").default as React.ComponentType<{
        draftId: string;
        onClose: () => void;
      }>;
    return (
      <DraftEditor
        draftId={selectedDraftId}
        onClose={() => setSelectedDraftId(null)}
      />
    );
  }

  // ---------- Main hub ----------

  const tabs: { key: "drafts" | "sent" | "all"; label: string }[] = [
    { key: "drafts", label: "Drafts" },
    { key: "sent", label: "Sent" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.type}
              onClick={() => handleQuickAction(action.type)}
              className={`${action.bg} rounded-xl p-4 text-left transition hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-300`}
            >
              <Icon className={`h-5 w-5 ${action.iconColor} mb-2`} />
              <span className="text-sm font-medium text-slate-800">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "text-slate-900 border-b-2 border-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Draft List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">
          Loading correspondence...
        </div>
      ) : !drafts || drafts.length === 0 ? (
        <div className="py-16 text-center">
          <Mail className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            No correspondence yet. Start by drafting a letter above.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {drafts.map((draft: any) => (
            <button
              key={draft.id}
              onClick={() => setSelectedDraftId(draft.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition focus:outline-none"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <CorrespondenceTypeBadge type={draft.type} />
                <p className="text-sm font-medium text-slate-800 truncate">
                  {draft.matterName}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {draft.recipient}
                </p>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {new Date(draft.date).toLocaleDateString()}
                  </p>
                  <span
                    className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      STATUS_STYLES[draft.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {draft.status}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
