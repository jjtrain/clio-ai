"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface QuickDraftInputProps {
  onComplete: (draftId: string) => void;
  onCancel: () => void;
}

const LOADING_STAGES = [
  "Understanding your request...",
  "Gathering case context...",
  "Drafting...",
] as const;

export default function QuickDraftInput({
  onComplete,
  onCancel,
}: QuickDraftInputProps) {
  const [prompt, setPrompt] = useState("");
  const [matterId, setMatterId] = useState("");
  const [loadingStage, setLoadingStage] = useState(0);

  const quickDraft = trpc.correspondence.quickDraft.useMutation({
    onSuccess: (draft) => {
      onComplete(draft.id);
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return;

    setLoadingStage(0);
    const stageTimer1 = setTimeout(() => setLoadingStage(1), 1500);
    const stageTimer2 = setTimeout(() => setLoadingStage(2), 3500);

    try {
      await quickDraft.mutateAsync({
        freeformInstruction: prompt.trim(),
        matterId: matterId.trim() || undefined,
      });
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
    }
  }, [prompt, matterId, quickDraft]);

  const isLoading = quickDraft.isPending;

  return (
    <div className="relative rounded-xl border border-purple-100 bg-white p-1 shadow-sm">
      <div className="rounded-lg bg-gradient-to-br from-purple-50/50 to-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
            <Sparkles className="h-4 w-4" />
            Quick Draft
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you need... e.g., 'Write a letter to opposing counsel on the Smith case requesting a 30-day extension for discovery responses because our expert needs more time to review medical records'"
          className="mb-3 h-32 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
          disabled={isLoading}
        />

        <div className="mb-3">
          <input
            type="text"
            value={matterId}
            onChange={(e) => setMatterId(e.target.value)}
            placeholder="Matter ID (optional)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-purple-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {LOADING_STAGES[loadingStage]}
            </div>
          ) : (
            <div />
          )}

          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Draft It
          </button>
        </div>

        {quickDraft.isError && (
          <p className="mt-2 text-sm text-red-600">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
