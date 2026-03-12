"use client";

import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { ShieldAlert, Users, Briefcase, UserPlus, Inbox, ClipboardList, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ConflictCheckPanelProps {
  query: string;
  searchType?: "MANUAL" | "AUTO_CLIENT" | "AUTO_MATTER";
  entityType?: string;
  entityId?: string;
  debounceMs?: number;
  className?: string;
}

const roleLabels: Record<string, string> = {
  OPPOSING_PARTY: "Opposing Party",
  OPPOSING_COUNSEL: "Opposing Counsel",
  CO_COUNSEL: "Co-Counsel",
  WITNESS: "Witness",
  EXPERT_WITNESS: "Expert Witness",
  JUDGE: "Judge",
  MEDIATOR: "Mediator",
  GUARDIAN: "Guardian",
  INTERESTED_PARTY: "Interested Party",
  OTHER: "Other",
};

export function ConflictCheckPanel({
  query,
  searchType = "MANUAL",
  entityType,
  entityId,
  debounceMs = 500,
  className,
}: ConflictCheckPanelProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const searchMutation = trpc.conflicts.search.useMutation({
    onSuccess: (data) => setResults(data),
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.trim().length < 2) {
      setResults(null);
      setDebouncedQuery("");
      return;
    }

    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchMutation.mutate({
        query: debouncedQuery,
        searchType: searchType as any,
        entityType,
        entityId,
      });
    }
  }, [debouncedQuery]);

  if (!query || query.trim().length < 2) return null;

  if (searchMutation.isLoading) {
    return (
      <div className={cn("border border-blue-200 bg-blue-50 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-700", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for conflicts...
      </div>
    );
  }

  if (!results) return null;

  if (results.total === 0) {
    return (
      <div className={cn("border border-emerald-200 bg-emerald-50 rounded-lg p-3 flex items-center gap-2 text-sm text-emerald-700", className)}>
        <CheckCircle className="h-4 w-4" />
        No conflicts found for &quot;{debouncedQuery}&quot;
      </div>
    );
  }

  const categories = [
    { key: "clients", label: "Clients", icon: Users, items: results.clients, color: "text-blue-600", linkFn: (item: any) => `/clients/${item.id}` },
    { key: "matters", label: "Matters", icon: Briefcase, items: results.matters, color: "text-purple-600", linkFn: (item: any) => `/matters/${item.id}` },
    { key: "relatedParties", label: "Related Parties", icon: UserPlus, items: results.relatedParties, color: "text-orange-600", linkFn: (item: any) => `/matters/${item.matter?.id}` },
    { key: "leads", label: "Leads", icon: Inbox, items: results.leads, color: "text-teal-600", linkFn: () => "/leads" },
    { key: "intakeSubmissions", label: "Intake Submissions", icon: ClipboardList, items: results.intakeSubmissions, color: "text-amber-600", linkFn: () => "/intake-forms" },
  ].filter((c) => c.items.length > 0);

  return (
    <div className={cn("border border-amber-300 bg-amber-50 rounded-lg overflow-hidden", className)}>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-100 border-b border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">
          {results.total} potential conflict{results.total !== 1 ? "s" : ""} found
        </span>
      </div>
      <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat.key}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <cat.icon className={cn("h-3.5 w-3.5", cat.color)} />
              <span className="text-xs font-semibold text-gray-700">{cat.label} ({cat.items.length})</span>
            </div>
            <div className="space-y-1">
              {cat.items.slice(0, 5).map((item: any) => (
                <Link
                  key={item.id}
                  href={cat.linkFn(item)}
                  className="block px-2 py-1.5 rounded bg-white border border-amber-200 hover:bg-amber-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {item.name || item.submitterName || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.email || item.submitterEmail || ""}
                    {item.phone || item.submitterPhone ? ` · ${item.phone || item.submitterPhone}` : ""}
                    {item.role ? ` · ${roleLabels[item.role] || item.role}` : ""}
                    {item.matterNumber ? ` · ${item.matterNumber}` : ""}
                    {item.client?.name ? ` · ${item.client.name}` : ""}
                    {item.matter?.name ? ` · ${item.matter.name}` : ""}
                    {item.template?.name ? ` · Form: ${item.template.name}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
