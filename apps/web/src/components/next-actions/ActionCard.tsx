"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Search, Mail, Phone, Gavel, DollarSign, Brain,
  Target, FileSearch, AlertCircle, ClipboardList, ChevronDown, ChevronRight,
  ExternalLink, Clock, CheckCircle, XCircle, AlarmClock, MoreHorizontal, Zap, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ActionCardProps {
  action: {
    id: string;
    matterId: string;
    title: string;
    description: string;
    actionType: string;
    urgency: string;
    priority: number;
    status: string;
    source: string;
    reasoning?: string | null;
    practiceAreaContext?: string | null;
    ruleReference?: string | null;
    suggestedFeature?: string | null;
    suggestedAction?: any;
    estimatedTime?: string | null;
    relatedDeadlineDate?: Date | null;
    deferredUntil?: Date | null;
    snoozeCount: number;
    matter?: { name: string; practiceArea?: string | null } | null;
  };
  onUpdate?: () => void;
}

const actionTypeIcons: Record<string, any> = {
  filing: FileText,
  discovery: Search,
  correspondence: Mail,
  client_communication: Phone,
  court_preparation: Gavel,
  settlement: Users,
  billing: DollarSign,
  expert: Brain,
  strategic: Target,
  document_review: FileSearch,
  deadline_response: AlertCircle,
  administrative: ClipboardList,
};

const urgencyConfig: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  immediate: { color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-l-red-500", label: "IMMEDIATE" },
  this_week: { color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-l-orange-500", label: "This Week" },
  next_two_weeks: { color: "text-yellow-700", bgColor: "bg-yellow-50", borderColor: "border-l-yellow-500", label: "Next 2 Weeks" },
  this_month: { color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-l-blue-500", label: "This Month" },
  when_possible: { color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-l-gray-400", label: "When Possible" },
};

const featureLinks: Record<string, string> = {
  correspondence: "/correspondence",
  deadline_calculator: "/deadline-calculator",
  document_review: "/document-review-flags",
  calendar: "/calendar/new",
  billing: "/billing/new",
  prediction: "/predictions",
};

export function ActionCard({ action, onUpdate }: ActionCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const completeMutation = trpc.nextActions.completeAction.useMutation({ onSuccess: onUpdate });
  const dismissMutation = trpc.nextActions.dismissAction.useMutation({ onSuccess: onUpdate });
  const deferMutation = trpc.nextActions.deferAction.useMutation({ onSuccess: onUpdate });
  const startMutation = trpc.nextActions.startAction.useMutation({ onSuccess: onUpdate });

  const Icon = actionTypeIcons[action.actionType] || Target;
  const uc = urgencyConfig[action.urgency] || urgencyConfig.when_possible;
  const isResolved = ["completed", "dismissed", "expired"].includes(action.status);

  const handleDoThis = () => {
    if (action.suggestedFeature && featureLinks[action.suggestedFeature]) {
      startMutation.mutate({ actionId: action.id });
      router.push(featureLinks[action.suggestedFeature]);
    } else {
      startMutation.mutate({ actionId: action.id });
    }
  };

  const handleDefer = (days: number) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    deferMutation.mutate({ actionId: action.id, deferUntil: until });
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all border-l-4",
      uc.borderColor,
      isResolved && "opacity-50",
      action.status === "in_progress" && "border-l-blue-500 ring-1 ring-blue-200"
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn("flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center", uc.bgColor)}>
              <Icon className={cn("h-4.5 w-4.5", uc.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn("text-sm font-semibold text-gray-900", isResolved && "line-through")}>
                  {action.title}
                </h3>
                <Badge className={cn("text-[10px] px-1.5 py-0 font-semibold", uc.bgColor, uc.color)}>
                  {uc.label}
                </Badge>
                {action.status === "in_progress" && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">In Progress</Badge>
                )}
                {action.status === "deferred" && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600">
                    Snoozed {action.deferredUntil ? `until ${new Date(action.deferredUntil).toLocaleDateString()}` : ""}
                  </Badge>
                )}
              </div>

              {/* Matter context */}
              {action.matter && (
                <div className="flex items-center gap-2 mt-1">
                  <Link href={`/matters/${action.matterId}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {action.matter.name}
                  </Link>
                  {action.matter.practiceArea && (
                    <span className="text-[10px] text-gray-400">{action.matter.practiceArea}</span>
                  )}
                </div>
              )}

              {/* Description preview */}
              <p className={cn("text-xs text-gray-600 mt-1.5", !isExpanded && "line-clamp-2")}>
                {action.description}
              </p>

              {/* Expand/collapse */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[10px] text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-0.5"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {isExpanded ? "Show less" : "Show more"}
              </button>
            </div>
          </div>

          {/* Priority indicator */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="text-[10px] font-bold text-gray-400">{action.priority}</div>
            <div className="flex gap-px">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={cn("h-1 w-1 rounded-full", i < action.priority ? "bg-blue-400" : "bg-gray-200")} />
              ))}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 ml-12 space-y-3">
            {/* Practice area context */}
            {action.practiceAreaContext && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-xs text-amber-800">
                  <span className="font-medium">Practice Tip:</span> {action.practiceAreaContext}
                </p>
              </div>
            )}

            {/* Rule reference + estimated time */}
            <div className="flex items-center gap-3 flex-wrap">
              {action.ruleReference && (
                <Badge variant="outline" className="text-[10px]">{action.ruleReference}</Badge>
              )}
              {action.estimatedTime && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {action.estimatedTime}
                </span>
              )}
              {action.relatedDeadlineDate && (
                <span className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Deadline: {new Date(action.relatedDeadlineDate).toLocaleDateString()}
                </span>
              )}
              <Badge variant="secondary" className="text-[10px] capitalize">
                {action.source}
              </Badge>
            </div>

            {/* Reasoning */}
            {action.reasoning && (
              <div>
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <Brain className="h-3 w-3" />
                  {showReasoning ? "Hide reasoning" : "Why this suggestion?"}
                </button>
                {showReasoning && (
                  <div className="mt-1.5 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs text-gray-600 whitespace-pre-line">{action.reasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!isResolved && (
          <div className="flex items-center gap-2 mt-3 ml-12">
            <Button
              size="sm"
              onClick={handleDoThis}
              className="gap-1.5 text-xs h-8"
            >
              <Zap className="h-3 w-3" />
              {action.suggestedFeature ? "Do This" : "Start"}
              {action.suggestedFeature && <ExternalLink className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => completeMutation.mutate({ actionId: action.id })}
              disabled={completeMutation.isLoading}
              className="gap-1 text-xs h-8"
            >
              <CheckCircle className="h-3 w-3" /> Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismissMutation.mutate({ actionId: action.id, reason: "Not applicable" })}
              disabled={dismissMutation.isLoading}
              className="gap-1 text-xs h-8 text-gray-500"
            >
              <XCircle className="h-3 w-3" /> Dismiss
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDefer(7)}
              disabled={deferMutation.isLoading}
              className="gap-1 text-xs h-8 text-gray-400"
            >
              <AlarmClock className="h-3 w-3" /> Snooze
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
