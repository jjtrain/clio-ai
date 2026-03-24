"use client";

import { useState } from "react";
import { CheckCircle, XCircle, PenLine, Sparkles, Clock, ChevronDown, ChevronRight, Send, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface UpdateQueueCardProps {
  item: {
    id: string;
    matterId: string;
    triggerSource: string;
    triggerData?: any;
    title: string;
    body: string;
    milestone?: string | null;
    phase?: string | null;
    phasePercentage?: number | null;
    clientActionRequired: boolean;
    clientActionText?: string | null;
    practiceArea?: string | null;
    tone: string;
    priority: number;
    status: string;
    createdAt: Date;
  };
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdate: () => void;
}

const triggerLabels: Record<string, string> = {
  phase_change: "Phase Change",
  deadline_completed: "Deadline Completed",
  deadline_missed: "Deadline Missed",
  court_event_completed: "Court Event",
  correspondence_sent: "Correspondence Sent",
  document_reviewed: "Document Reviewed",
  intake_converted: "New Client",
  billing_event: "Billing Event",
  checklist_milestone: "Checklist Milestone",
  inactivity: "Periodic Check-In",
  settlement_event: "Settlement",
  manual: "Manual",
};

export function UpdateQueueCard({ item, isSelected, onToggleSelect, onUpdate }: UpdateQueueCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editBody, setEditBody] = useState(item.body);

  const approveMutation = trpc.statusUpdates.approveUpdate.useMutation({ onSuccess: onUpdate });
  const rejectMutation = trpc.statusUpdates.rejectUpdate.useMutation({ onSuccess: onUpdate });

  const hoursWaiting = Math.round((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60));
  const waitingColor = hoursWaiting > 72 ? "text-red-500" : hoursWaiting > 48 ? "text-orange-500" : hoursWaiting > 24 ? "text-yellow-600" : "text-gray-400";

  return (
    <Card className={cn("overflow-hidden transition-all", isSelected && "ring-2 ring-blue-500")}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1.5 h-4 w-4 rounded border-gray-300"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-[10px] capitalize">
                {triggerLabels[item.triggerSource] || item.triggerSource.replace(/_/g, " ")}
              </Badge>
              {item.practiceArea && (
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {item.practiceArea.replace(/_/g, " ")}
                </Badge>
              )}
              <span className={cn("text-[10px] flex items-center gap-1", waitingColor)}>
                <Clock className="h-3 w-3" /> {hoursWaiting}h ago
              </span>
            </div>

            {/* Toggle expand */}
            <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-left w-full">
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="mt-3 ml-5">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-medium"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm min-h-[120px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          approveMutation.mutate({ queueItemId: item.id, editedTitle: editTitle, editedBody: editBody });
                          setIsEditing(false);
                        }}
                        className="gap-1 text-xs"
                      >
                        <Send className="h-3 w-3" /> Approve & Send
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-xs">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Preview */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {item.body}
                      </p>
                      {item.clientActionRequired && item.clientActionText && (
                        <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <p className="text-xs font-medium text-blue-700">Action needed from client:</p>
                          <p className="text-xs text-blue-600">{item.clientActionText}</p>
                        </div>
                      )}
                      {item.phase && (
                        <div className="mt-3 flex items-center gap-2">
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-700">{item.phase}</Badge>
                          {item.phasePercentage != null && (
                            <div className="flex items-center gap-1">
                              <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${item.phasePercentage}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-500">{item.phasePercentage}%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ queueItemId: item.id })}
                        disabled={approveMutation.isLoading}
                        className="gap-1.5 text-xs h-8 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3 w-3" /> Approve & Send
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        className="gap-1 text-xs h-8"
                      >
                        <PenLine className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectMutation.mutate({ queueItemId: item.id, reason: "Not appropriate timing" })}
                        disabled={rejectMutation.isLoading}
                        className="gap-1 text-xs h-8 text-red-500"
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
