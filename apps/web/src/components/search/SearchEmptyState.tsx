"use client";

import { Search, Briefcase, FileText, Calendar, AlertCircle, Lightbulb } from "lucide-react";
import Link from "next/link";

interface SearchEmptyStateProps {
  query: string;
  parsedIntent?: any;
}

export function SearchEmptyState({ query, parsedIntent }: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-gray-300" />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-1">No results found</h2>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
        No results matching &ldquo;{query}&rdquo;
      </p>

      {/* What we tried */}
      {parsedIntent && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 w-full max-w-md">
          <p className="text-xs font-medium text-gray-500 mb-2">Here&apos;s what I tried:</p>
          <div className="space-y-1 text-xs text-gray-500">
            {parsedIntent.primaryTarget && (
              <p>Searched in: <span className="font-medium text-gray-700 capitalize">{parsedIntent.primaryTarget}s</span></p>
            )}
            {parsedIntent.keywords?.length > 0 && (
              <p>Keywords: <span className="font-medium text-gray-700">{parsedIntent.keywords.join(", ")}</span></p>
            )}
            {parsedIntent.filters?.length > 0 && (
              <p>Filters: <span className="font-medium text-gray-700">{parsedIntent.filters.map((f: any) => `${f.field}=${f.value}`).join(", ")}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Alternative suggestions */}
      <div className="w-full max-w-md mb-6">
        <p className="text-xs font-medium text-gray-500 mb-3">Try these instead:</p>
        <div className="flex flex-wrap gap-2">
          {[
            "show me all active matters",
            "find overdue deadlines",
            "recent documents",
            "upcoming calendar events",
            "unbilled time entries",
          ].map((suggestion) => (
            <Link
              key={suggestion}
              href={`/search?q=${encodeURIComponent(suggestion)}`}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            >
              {suggestion}
            </Link>
          ))}
        </div>
      </div>

      {/* Browse sections */}
      <div className="w-full max-w-md">
        <p className="text-xs font-medium text-gray-500 mb-3">Or browse:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Matters", href: "/matters", icon: Briefcase },
            { label: "Documents", href: "/documents", icon: FileText },
            { label: "Calendar", href: "/calendar", icon: Calendar },
            { label: "Deadlines", href: "/deadline-calculator", icon: AlertCircle },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <item.icon className="h-4 w-4 text-gray-400" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 mt-8 p-3 bg-blue-50 rounded-lg max-w-md">
        <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          You can search in plain English &mdash; try &ldquo;show me all PI matters&rdquo; or &ldquo;find the Smith retainer&rdquo;
        </p>
      </div>
    </div>
  );
}
