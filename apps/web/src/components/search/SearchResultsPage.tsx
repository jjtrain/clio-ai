"use client";

import { useState } from "react";
import { Sparkles, Save, Bell, Download, ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchResultCard } from "./SearchResultCard";
import { SearchEmptyState } from "./SearchEmptyState";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface SearchResultsPageProps {
  query: string;
}

const TYPE_LABELS: Record<string, string> = {
  matter: "Matters",
  contact: "Contacts",
  document: "Documents",
  correspondence: "Correspondence",
  calendarEvent: "Calendar",
  deadline: "Deadlines",
  intakeSession: "Intake",
  prediction: "Predictions",
  note: "Notes",
  billing: "Billing",
};

export function SearchResultsPage({ query }: SearchResultsPageProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState<"relevance" | "newest" | "oldest" | "alphabetical">("relevance");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");

  const { data, isLoading, error } = trpc.search.search.useQuery(
    { query },
    { enabled: !!query }
  );

  const saveSearchMutation = trpc.search.saveSearch.useMutation();

  const handleSave = () => {
    if (saveName.trim()) {
      saveSearchMutation.mutate({ name: saveName.trim(), queryText: query });
      setShowSaveDialog(false);
      setSaveName("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
          <span className="text-sm font-medium">Searching across all sources...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        <p className="text-sm">Search failed. Please try again.</p>
      </div>
    );
  }

  if (!data || data.results.length === 0) {
    return <SearchEmptyState query={query} parsedIntent={data?.parsedIntent} />;
  }

  const filteredResults = activeTab === "all"
    ? data.results
    : data.results.filter((r) => r.entityType === activeTab);

  // Sort results
  const sortedResults = [...filteredResults].sort((a, b) => {
    switch (sortBy) {
      case "newest": return new Date(b.data.createdAt || 0).getTime() - new Date(a.data.createdAt || 0).getTime();
      case "oldest": return new Date(a.data.createdAt || 0).getTime() - new Date(b.data.createdAt || 0).getTime();
      case "alphabetical": return a.title.localeCompare(b.title);
      default: return b.relevanceScore - a.relevanceScore;
    }
  });

  const typeTabs = Object.entries(data.byType)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      {/* AI Summary Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 leading-relaxed">{data.summary}</p>
            {/* Parsed Intent Tags */}
            {data.parsedIntent && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[10px] font-medium text-gray-400 uppercase">Interpreted as:</span>
                {data.parsedIntent.primaryTarget && (
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {data.parsedIntent.primaryTarget}
                  </Badge>
                )}
                {data.parsedIntent.filters?.map((f: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {f.field}: {String(f.value)}
                  </Badge>
                ))}
                {data.parsedIntent.keywords?.map((k: string, i: number) => (
                  <Badge key={`kw-${i}`} variant="outline" className="text-[10px] bg-yellow-50 border-yellow-200">
                    &ldquo;{k}&rdquo;
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{data.executionTimeMs}ms</span>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {showSaveDialog ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Name this search..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-8 w-48 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <Button size="sm" onClick={handleSave} className="h-8 text-xs">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSaveDialog(false)} className="h-8 text-xs">
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                className="h-8 text-xs gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save Search
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
            {(["relevance", "newest", "oldest", "alphabetical"] as const).map((sort) => (
              <button
                key={sort}
                onClick={() => setSortBy(sort)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors capitalize",
                  sortBy === sort
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {sort}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result Type Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-gray-100">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2",
            activeTab === "all"
              ? "text-blue-600 border-blue-500 bg-blue-50/50"
              : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
          )}
        >
          All Results
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {data.totalCount}
          </Badge>
        </button>
        {typeTabs.map(([type, count]) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2",
              activeTab === type
                ? "text-blue-600 border-blue-500 bg-blue-50/50"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            {TYPE_LABELS[type] || type}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="space-y-2">
        {sortedResults.map((result) => (
          <SearchResultCard key={`${result.entityType}-${result.id}`} result={result} />
        ))}
      </div>

      {/* Suggested Follow-up Queries */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Related searches</p>
          <div className="flex flex-wrap gap-2">
            {data.suggestions.map((s, i) => (
              <a
                key={i}
                href={`/search?q=${encodeURIComponent(s)}`}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-100 rounded-full hover:bg-blue-50 hover:border-blue-200 transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
