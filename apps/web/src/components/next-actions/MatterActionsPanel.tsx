"use client";

import { Zap, RefreshCw, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ActionCard } from "./ActionCard";
import { PhaseProgressBar } from "./PhaseProgressBar";

interface MatterActionsPanelProps {
  matterId: string;
}

const activityIcons: Record<string, string> = {
  correspondence_sent: "\uD83D\uDCE7",
  correspondence_received: "\uD83D\uDCE8",
  document_reviewed: "\uD83D\uDCCB",
  deadline_completed: "\u2705",
  deadline_missed: "\u274C",
  calendar_event: "\uD83D\uDCC5",
  time_entry: "\u23F0",
  invoice_sent: "\uD83D\uDCB0",
  court_appearance: "\u2696\uFE0F",
  client_call: "\uD83D\uDCDE",
  client_meeting: "\uD83E\uDD1D",
  filing_submitted: "\uD83D\uDCC4",
  discovery_served: "\uD83D\uDD0D",
  note_added: "\uD83D\uDCDD",
  action_completed: "\u2714\uFE0F",
};

export function MatterActionsPanel({ matterId }: MatterActionsPanelProps) {
  const { data: actions, refetch, isLoading } = trpc.nextActions.getActionsForMatter.useQuery({ matterId });
  const { data: state } = trpc.nextActions.getMatterState.useQuery({ matterId });
  const { data: activityLog } = trpc.nextActions.getMatterActivityLog.useQuery({ matterId, limit: 15 });
  const { data: phaseHistory } = trpc.nextActions.getMatterPhaseHistory.useQuery({ matterId });
  const refreshMutation = trpc.nextActions.refreshActions.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-6">
      {/* Matter Status Bar */}
      {state && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className="text-xs capitalize bg-blue-100 text-blue-700">
                {state.currentPhase.replace(/_/g, " ")} Phase
              </Badge>
              {state.predictionScore && (
                <div className="flex items-center gap-1.5">
                  <div className="h-6 w-6 rounded-full border-2 border-indigo-300 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-indigo-600">{Math.round(state.predictionScore)}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">Score</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span>Last activity: {state.daysSinceLastActivity} days ago</span>
              {state.daysSinceClientContact < 999 && (
                <span className={cn(state.daysSinceClientContact > 30 && "text-orange-500 font-medium")}>
                  Client contact: {state.daysSinceClientContact}d ago
                </span>
              )}
            </div>
          </div>
          <PhaseProgressBar currentPhase={state.currentPhase} phases={phaseHistory || []} />
        </Card>
      )}

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Suggested Next Actions
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshMutation.mutate({ matterId })}
            disabled={refreshMutation.isLoading}
            className="gap-1.5 text-xs h-7"
          >
            <RefreshCw className={cn("h-3 w-3", refreshMutation.isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
            <span className="ml-2 text-xs text-gray-500">Analyzing matter...</span>
          </div>
        ) : actions && actions.length > 0 ? (
          <div className="space-y-2">
            {actions.slice(0, 8).map((action) => (
              <ActionCard key={action.id} action={action} onUpdate={() => refetch()} />
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <Zap className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No suggested actions right now</p>
            <p className="text-xs text-gray-400 mt-1">Actions will appear when deadlines approach or activity is needed</p>
          </Card>
        )}
      </div>

      {/* Recent Activity Timeline */}
      {activityLog && activityLog.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-gray-400" />
            Recent Activity
          </h2>
          <div className="relative ml-3">
            <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-3">
              {activityLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 relative">
                  <div className="h-3.5 w-3.5 rounded-full bg-white border-2 border-gray-300 flex-shrink-0 mt-0.5 z-10" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700">
                      <span className="mr-1">{activityIcons[entry.activityType] || "\uD83D\uDD39"}</span>
                      {entry.description}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(entry.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
