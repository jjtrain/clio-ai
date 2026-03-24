"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X, Clock, Star, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PLACEHOLDER_EXAMPLES = [
  "Search anything...",
  "show me overdue deadlines",
  "find the Smith retainer",
  "matters waiting on discovery responses",
  "who is opposing counsel on Johnson?",
];

export function GlobalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cycle placeholders
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && isFocused) {
        inputRef.current?.blur();
        setIsFocused(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFocused]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: suggestions } = trpc.search.getSuggestions.useQuery(
    { partialQuery: query },
    { enabled: query.length >= 2 && isFocused }
  );

  const { data: quickResults } = trpc.search.quickSearch.useQuery(
    { query, limit: 5 },
    { enabled: query.length >= 2 && isFocused }
  );

  const handleSubmit = useCallback((searchQuery?: string) => {
    const q = searchQuery || query;
    if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }, [query, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const typeIcons: Record<string, string> = {
    recent: "clock",
    saved: "star",
    template: "hash",
    matter: "briefcase",
    contact: "user",
    document: "file",
    correspondence: "mail",
    calendarEvent: "calendar",
    deadline: "alert-circle",
    intakeSession: "inbox",
  };

  const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "recent": return <Clock className="h-3.5 w-3.5 text-slate-400" />;
      case "saved": return <Star className="h-3.5 w-3.5 text-yellow-400" />;
      case "template": return <Hash className="h-3.5 w-3.5 text-slate-400" />;
      default: return <Search className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Sparkles className="absolute left-8 top-1/2 -translate-y-1/2 h-3 w-3 text-blue-400 opacity-60" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
          className={cn(
            "pl-14 pr-20 bg-gray-50 border-gray-200 focus:bg-white w-full transition-all",
            isFocused && "ring-2 ring-blue-500/20 border-blue-300"
          )}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          {navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl"}K
        </kbd>
      </div>

      {/* Typeahead Dropdown */}
      {isFocused && (query.length >= 2 || query.length === 0) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 overflow-hidden"
        >
          {/* Suggestions */}
          {suggestions?.suggestions && suggestions.suggestions.length > 0 && (
            <div className="p-1">
              {suggestions.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(s.text);
                    handleSubmit(s.text);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-gray-50 transition-colors"
                >
                  <TypeIcon type={s.type} />
                  <span className="flex-1 truncate">{s.text}</span>
                  {s.subtitle && (
                    <span className="text-xs text-gray-400 truncate max-w-[150px]">{s.subtitle}</span>
                  )}
                  <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded capitalize">
                    {s.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Results */}
          {quickResults?.results && quickResults.results.length > 0 && (
            <>
              <div className="border-t border-gray-100 px-3 py-1.5">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Results</span>
              </div>
              <div className="p-1">
                {quickResults.results.map((r) => (
                  <button
                    key={`${r.entityType}-${r.id}`}
                    onClick={() => handleSubmit(r.title)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate font-medium">{r.title}</span>
                    {r.subtitle && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">{r.subtitle}</span>
                    )}
                    <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded capitalize">
                      {r.entityType}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* See all results */}
          {query.length >= 2 && (
            <div className="border-t border-gray-100 p-1">
              <button
                onClick={() => handleSubmit()}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 font-medium rounded-md hover:bg-blue-50 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                See all results for &ldquo;{query}&rdquo;
              </button>
            </div>
          )}

          {/* Empty state with tips */}
          {query.length === 0 && (!suggestions?.suggestions || suggestions.suggestions.length === 0) && (
            <div className="p-4 text-center text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-1">Search in plain English</p>
              <p className="text-xs">Try &ldquo;show me all PI matters&rdquo; or &ldquo;find overdue deadlines&rdquo;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
