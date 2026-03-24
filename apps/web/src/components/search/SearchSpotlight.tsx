"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X, Briefcase, User, FileText, Mail, Calendar, AlertCircle, Inbox, Target, StickyNote, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const entityTypeIcons: Record<string, any> = {
  matter: Briefcase,
  contact: User,
  document: FileText,
  correspondence: Mail,
  calendarEvent: Calendar,
  deadline: AlertCircle,
  intakeSession: Inbox,
  prediction: Target,
  note: StickyNote,
  billing: DollarSign,
};

const entityTypeColors: Record<string, string> = {
  matter: "text-blue-500 bg-blue-50",
  contact: "text-green-500 bg-green-50",
  document: "text-purple-500 bg-purple-50",
  correspondence: "text-orange-500 bg-orange-50",
  calendarEvent: "text-cyan-500 bg-cyan-50",
  deadline: "text-red-500 bg-red-50",
  intakeSession: "text-yellow-600 bg-yellow-50",
  prediction: "text-indigo-500 bg-indigo-50",
  note: "text-slate-500 bg-slate-50",
  billing: "text-emerald-500 bg-emerald-50",
};

export function SearchSpotlight() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const { data: quickResults, isLoading } = trpc.search.quickSearch.useQuery(
    { query, limit: 8 },
    { enabled: query.length >= 2 && isOpen }
  );

  const results = quickResults?.results || [];

  const handleSelect = useCallback((result?: { entityType: string; title: string }) => {
    if (result) {
      // Navigate to the entity
      router.push(`/search?q=${encodeURIComponent(result.title)}`);
    } else if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    setIsOpen(false);
  }, [query, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex > 0 && results[selectedIndex - 1]) {
        handleSelect(results[selectedIndex - 1]);
      } else {
        handleSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-100">
            <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search anything... matters, contacts, documents, deadlines"
              className="flex-1 py-4 text-base outline-none placeholder:text-gray-400"
            />
            {isLoading && (
              <Sparkles className="h-4 w-4 text-blue-400 animate-pulse flex-shrink-0" />
            )}
            {query && (
              <button onClick={() => setQuery("")} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          {query.length >= 2 && (
            <div className="max-h-[400px] overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-2">
                  {results.map((r, i) => {
                    const Icon = entityTypeIcons[r.entityType] || Search;
                    const colorClass = entityTypeColors[r.entityType] || "text-gray-500 bg-gray-50";
                    const isSelected = selectedIndex === i + 1;

                    return (
                      <button
                        key={`${r.entityType}-${r.id}`}
                        onClick={() => handleSelect(r)}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors",
                          isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                        )}
                      >
                        <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0", colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                          {r.subtitle && (
                            <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 capitalize flex-shrink-0">
                          {r.entityType.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : !isLoading ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  No results found for &ldquo;{query}&rdquo;
                </div>
              ) : null}

              {/* See all results */}
              <div className="border-t border-gray-100 p-2">
                <button
                  onClick={() => handleSelect()}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-blue-600 rounded-lg transition-colors",
                    selectedIndex === 0 ? "bg-blue-50" : "hover:bg-blue-50"
                  )}
                >
                  <Search className="h-4 w-4" />
                  See all results for &ldquo;{query}&rdquo;
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions when empty */}
          {query.length < 2 && (
            <div className="p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Quick searches</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Overdue deadlines",
                  "Active matters",
                  "Recent documents",
                  "Unbilled time",
                  "Upcoming hearings",
                  "Hot leads",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      handleSelect({ entityType: "", title: suggestion });
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[10px] text-gray-400">
            <div className="flex items-center gap-3">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> select</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span>AI-powered search</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
