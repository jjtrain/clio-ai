"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Search, Sparkles, TrendingUp, Clock, Star } from "lucide-react";
import { SearchResultsPage } from "@/components/search/SearchResultsPage";
import { SavedSearchPanel } from "@/components/search/SavedSearchPanel";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  if (query) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-400" />
            Search results for &ldquo;{query}&rdquo;
          </h1>
        </div>
        <SearchResultsPage query={query} />
      </div>
    );
  }

  return <SearchLandingPage />;
}

function SearchLandingPage() {
  const { data: popularQueries } = trpc.search.getPopularQueries.useQuery();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI-Powered Search</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Search across your entire practice in plain English. Find matters, documents, contacts, deadlines, and more.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-10">
        <form action="/search" method="get">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Sparkles className="absolute left-10 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400 opacity-60" />
            <input
              name="q"
              type="text"
              placeholder="Try: 'show me overdue deadlines' or 'find the Smith retainer'"
              className="w-full pl-16 pr-4 py-4 text-base border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none transition-all"
            />
          </div>
        </form>
      </div>

      {/* Quick Search Chips */}
      <div className="mb-10">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Popular searches</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Overdue deadlines",
            "Active PI matters",
            "Matters in discovery",
            "Recent documents",
            "Unbilled time",
            "Upcoming hearings this week",
            "Hot leads grade A",
            "Outstanding invoices",
          ].map((q) => (
            <Link
              key={q}
              href={`/search?q=${encodeURIComponent(q)}`}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-full hover:bg-gray-100 hover:border-gray-200 transition-colors"
            >
              {q}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Popular Queries */}
        {popularQueries && popularQueries.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              Trending Searches
            </h2>
            <div className="space-y-1">
              {popularQueries.slice(0, 8).map((q, i) => (
                <Link
                  key={i}
                  href={`/search?q=${encodeURIComponent(q.query)}`}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="truncate">{q.query}</span>
                  <span className="text-xs text-gray-400">{q.count}x</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Saved Searches */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-gray-400" />
            Saved Searches
          </h2>
          <SavedSearchPanel />
        </div>
      </div>

      {/* Tips */}
      <div className="mt-10 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Search Tips</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-px">1.</span>
            <span>Use natural language: &ldquo;show me all PI matters in discovery&rdquo;</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-px">2.</span>
            <span>Use abbreviations: &ldquo;MSJ&rdquo;, &ldquo;OC&rdquo;, &ldquo;SOL&rdquo;, &ldquo;PI&rdquo;</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-px">3.</span>
            <span>Search by status: &ldquo;overdue deadlines&rdquo;, &ldquo;active matters&rdquo;</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold mt-px">4.</span>
            <span>Press <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">Cmd+K</kbd> from anywhere to search</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="p-6">
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
        </div>
      }>
        <SearchPageContent />
      </Suspense>
    </div>
  );
}
