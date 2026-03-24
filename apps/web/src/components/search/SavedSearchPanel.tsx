"use client";

import { useState } from "react";
import { Star, Play, Bell, BellOff, Pin, PinOff, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function SavedSearchPanel() {
  const { data: savedSearches, refetch } = trpc.search.getSavedSearches.useQuery();
  const updateMutation = trpc.search.updateSavedSearch.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.search.deleteSavedSearch.useMutation({ onSuccess: () => refetch() });

  if (!savedSearches || savedSearches.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        <Star className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="font-medium text-gray-600 mb-1">No saved searches</p>
        <p className="text-xs">Save a search to quickly re-run it later</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {savedSearches.map((search) => (
        <div
          key={search.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {search.isPinned && <Pin className="h-3 w-3 text-blue-500 flex-shrink-0" />}
              <Link
                href={`/search?q=${encodeURIComponent(search.queryText)}`}
                className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors"
              >
                {search.name}
              </Link>
              {search.alertEnabled && (
                <Bell className="h-3 w-3 text-yellow-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">{search.queryText}</p>
            <div className="flex items-center gap-2 mt-1">
              {search.lastRunAt && (
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last: {new Date(search.lastRunAt).toLocaleDateString()}
                </span>
              )}
              {search.lastResultCount !== null && search.lastResultCount !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  {search.lastResultCount} results
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => updateMutation.mutate({ savedSearchId: search.id, isPinned: !search.isPinned })}
              title={search.isPinned ? "Unpin" : "Pin"}
            >
              {search.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => updateMutation.mutate({
                savedSearchId: search.id,
                alertEnabled: !search.alertEnabled,
                alertFrequency: !search.alertEnabled ? "daily" : null,
              })}
              title={search.alertEnabled ? "Disable alerts" : "Enable alerts"}
            >
              {search.alertEnabled ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-600"
              onClick={() => deleteMutation.mutate({ savedSearchId: search.id })}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
