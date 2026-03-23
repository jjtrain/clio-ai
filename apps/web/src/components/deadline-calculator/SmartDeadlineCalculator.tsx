"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Calculator,
  Sparkles,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import TriggerEventForm from "./TriggerEventForm";
import NaturalLanguageInput from "./NaturalLanguageInput";
import { DeadlineChainTimeline } from "./DeadlineChainTimeline";

type ActiveView = "entry" | "preview" | "chain";

interface PreviewResult {
  parsed: any;
  deadlines: any[];
  chainPreview: any;
}

export default function SmartDeadlineCalculator() {
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(
    null,
  );
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("entry");

  const saveChain = trpc.deadlineCalculator.saveChain.useMutation({
    onSuccess: () => {
      chainsQuery.refetch();
      upcomingQuery.refetch();
      setPreviewResult(null);
      setActiveView("entry");
    },
  });

  const chainsQuery = trpc.deadlineCalculator.getAllChains.useQuery({});
  const selectedChainQuery = trpc.deadlineCalculator.getChain.useQuery(
    { chainId: selectedChainId! },
    { enabled: !!selectedChainId }
  );
  const upcomingQuery = trpc.deadlineCalculator.getUpcomingDeadlines.useQuery({
    days: 30,
  });

  const chains = chainsQuery.data ?? [];
  const upcomingDeadlines = upcomingQuery.data ?? [];

  function handleCalculated(result: PreviewResult) {
    setPreviewResult(result);
    setActiveView("preview");
  }

  function handleBack() {
    if (activeView === "preview") {
      setPreviewResult(null);
      setActiveView("entry");
    } else if (activeView === "chain") {
      setSelectedChainId(null);
      setActiveView("entry");
    }
  }

  function handleSelectChain(chainId: string) {
    setSelectedChainId(chainId);
    setActiveView("chain");
  }

  // --- Helpers ---

  function formatCountdown(dateStr: string) {
    const now = new Date();
    const target = new Date(dateStr);
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return `in ${diffDays} days`;
  }

  function statusPill(status: string) {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      upcoming: "bg-yellow-100 text-yellow-700",
      completed: "bg-slate-100 text-slate-500",
    };
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.upcoming}`}
      >
        {status}
      </span>
    );
  }

  function priorityDot(priority: string) {
    const colors: Record<string, string> = {
      high: "bg-red-500",
      medium: "bg-yellow-500",
      low: "bg-blue-400",
    };
    return (
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${colors[priority] ?? "bg-slate-400"}`}
      />
    );
  }

  function groupByWeek(deadlines: any[]) {
    const groups: Record<string, any[]> = {};
    for (const d of deadlines) {
      const date = new Date(d.dueDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }

  // Sample chain for empty state
  const sampleChain = {
    id: "sample",
    name: "Smith v. Jones -- Complaint Served Deadlines",
    triggerEvent: "complaint_served",
    triggerDate: "2026-03-01",
    jurisdiction: "ny_supreme",
    status: "active",
    nextDeadline: { name: "Answer Due", dueDate: "2026-03-27" },
    completedCount: 1,
    totalCount: 8,
  };

  // --- Full-width chain view ---
  if (activeView === "chain" && selectedChainId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to Dashboard
        </button>
        {selectedChainQuery.data && (
          <DeadlineChainTimeline
            chain={selectedChainQuery.data.chain as any}
            deadlines={(selectedChainQuery.data.deadlines || []) as any[]}
            onBack={handleBack}
          />
        )}
      </div>
    );
  }

  // --- Preview view ---
  if (activeView === "preview" && previewResult) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {previewResult.deadlines.length} deadlines calculated
                {previewResult.parsed?.triggerEvent &&
                  ` for ${previewResult.parsed.triggerEvent}`}
                {previewResult.parsed?.jurisdiction &&
                  ` in ${previewResult.parsed.jurisdiction}`}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review the timeline below, then save to track these deadlines.
              </p>
            </div>
            <button
              onClick={() => {
                const cp = previewResult.chainPreview || previewResult.parsed || {};
                saveChain.mutate({
                  name: (cp as any).name || `${(cp as any).triggerEvent || "Chain"} Deadlines`,
                  triggerEvent: (cp as any).triggerEvent || "",
                  triggerDate: (cp as any).triggerDate || new Date().toISOString(),
                  practiceArea: (cp as any).practiceArea || "general",
                  jurisdiction: (cp as any).jurisdiction || "ny_supreme",
                  serviceMethod: (cp as any).serviceMethod,
                  matterId: (cp as any).matterId,
                });
              }}
              disabled={saveChain.isPending}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saveChain.isPending
                ? "Saving..."
                : "Save & Sync to Calendar"}
            </button>
          </div>
        </div>

        <DeadlineChainTimeline
          chain={(previewResult.chainPreview || { id: "preview", name: "Preview", triggerEvent: previewResult.parsed?.triggerEvent || "", triggerDate: previewResult.parsed?.triggerDate || new Date().toISOString(), jurisdiction: previewResult.parsed?.jurisdiction || "", practiceArea: previewResult.parsed?.practiceArea || "", status: "active" }) as any}
          deadlines={(previewResult.deadlines || []) as any[]}
          isPreview={true}
          onBack={handleBack}
          onSave={() => {
            if (previewResult.chainPreview) {
              saveChain.mutate(previewResult.chainPreview as any);
            }
          }}
        />
      </div>
    );
  }

  // --- Entry view (default) ---
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Smart Deadline Calculator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Calculate litigation deadlines from trigger events using AI or
          structured input.
        </p>
      </div>

      {/* Two entry modes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Natural Language */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Natural Language
            </h2>
          </div>
          <NaturalLanguageInput onCalculated={handleCalculated} />
        </div>

        {/* Structured Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Structured Form
            </h2>
          </div>
          <TriggerEventForm onCalculated={handleCalculated} />
        </div>
      </div>

      {/* Active Chains */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Active Chains
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chains.length > 0
            ? chains.map((chain: any) => (
                <button
                  key={chain.id}
                  onClick={() => handleSelectChain(chain.id)}
                  className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-slate-900 line-clamp-2">
                      {chain.name}
                    </h3>
                    {statusPill(chain.status)}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {chain.triggerEvent}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {chain.triggerDate}
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                      {chain.jurisdiction}
                    </span>
                  </div>
                  {chain.nextDeadline && (
                    <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-600">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Next: {chain.nextDeadline.name}{" "}
                        {formatCountdown(chain.nextDeadline.dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-slate-900"
                        style={{
                          width: `${chain.totalCount > 0 ? (chain.completedCount / chain.totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {chain.completedCount}/{chain.totalCount}
                    </span>
                  </div>
                </button>
              ))
            : (
                <button
                  onClick={() => handleSelectChain(sampleChain.id)}
                  className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-left shadow-sm transition hover:border-slate-400 hover:shadow"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-slate-900 line-clamp-2">
                      {sampleChain.name}
                    </h3>
                    {statusPill(sampleChain.status)}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {sampleChain.triggerEvent}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {sampleChain.triggerDate}
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                      {sampleChain.jurisdiction}
                    </span>
                  </div>
                  {sampleChain.nextDeadline && (
                    <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-600">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Next: {sampleChain.nextDeadline.name}{" "}
                        {formatCountdown(sampleChain.nextDeadline.dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-slate-900"
                        style={{
                          width: `${(sampleChain.completedCount / sampleChain.totalCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {sampleChain.completedCount}/{sampleChain.totalCount}
                    </span>
                  </div>
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Sample chain -- calculate deadlines above to create your own
                  </p>
                </button>
              )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-900">
            Upcoming Deadlines (30 days)
          </h2>
        </div>

        {upcomingDeadlines.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Clock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              No upcoming deadlines. Calculate and save a deadline chain to get
              started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overdue at top */}
            {upcomingDeadlines.filter(
              (d: any) => new Date(d.dueDate) < new Date(),
            ).length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue
                </h3>
                <div className="space-y-2">
                  {upcomingDeadlines
                    .filter((d: any) => new Date(d.dueDate) < new Date())
                    .map((d: any) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-lg bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          {priorityDot(d.priority)}
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {d.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {d.chainName ?? d.matterName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {new Date(d.dueDate).toLocaleDateString()}
                          </span>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            OVERDUE
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Grouped by week */}
            {groupByWeek(
              upcomingDeadlines.filter(
                (d: any) => new Date(d.dueDate) >= new Date(),
              ),
            ).map(([weekKey, deadlines]) => (
              <div key={weekKey}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Week of{" "}
                  {new Date(weekKey).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                <div className="space-y-2">
                  {deadlines.map((d: any) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {priorityDot(d.priority)}
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {d.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {d.chainName ?? d.matterName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>
                          {new Date(d.dueDate).toLocaleDateString()}
                        </span>
                        <span className="text-slate-400">
                          {formatCountdown(d.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
