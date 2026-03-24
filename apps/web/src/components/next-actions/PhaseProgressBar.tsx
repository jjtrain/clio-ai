"use client";

import { cn } from "@/lib/utils";

interface PhaseProgressBarProps {
  currentPhase: string;
  phases: Array<{ phase: string; startedAt: Date; endedAt?: Date | null }>;
}

const PHASE_ORDER = [
  "pre_litigation",
  "pleadings",
  "discovery",
  "motion_practice",
  "trial_prep",
  "trial",
  "post_trial",
  "appeal",
  "closed",
];

const PHASE_LABELS: Record<string, string> = {
  pre_litigation: "Pre-Lit",
  pleadings: "Pleadings",
  discovery: "Discovery",
  motion_practice: "Motions",
  trial_prep: "Trial Prep",
  trial: "Trial",
  post_trial: "Post-Trial",
  appeal: "Appeal",
  settlement: "Settlement",
  closed: "Closed",
};

export function PhaseProgressBar({ currentPhase, phases }: PhaseProgressBarProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const completedPhases = new Set(phases.filter((p) => p.endedAt).map((p) => p.phase));

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {PHASE_ORDER.filter((p) => p !== "closed").map((phase, i) => {
        const isCompleted = completedPhases.has(phase) || i < currentIndex;
        const isCurrent = phase === currentPhase;
        const isFuture = i > currentIndex;

        return (
          <div key={phase} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && (
              <div className={cn("h-px w-3 flex-shrink-0", isCompleted ? "bg-green-400" : isCurrent ? "bg-blue-400" : "bg-gray-200")} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full flex-shrink-0 transition-all",
                isCompleted && "bg-green-500",
                isCurrent && "bg-blue-500 ring-2 ring-blue-200",
                isFuture && "bg-gray-200 border border-gray-300"
              )} />
              <span className={cn(
                "text-[9px] font-medium whitespace-nowrap",
                isCompleted && "text-green-600",
                isCurrent && "text-blue-600",
                isFuture && "text-gray-400"
              )}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
