"use client";

import {
  Gavel, FileText, Mail, DollarSign, Calendar, CheckCircle, Clock, User,
  Shield, Star, Flag, AlertTriangle, ChevronDown, ExternalLink, Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortalTheme } from "@/components/portal/PortalThemeProvider";
import { cn } from "@/lib/utils";
import type { ClientTimeline as ClientTimelineType, TimelineEventData, PhaseGroup } from "@/lib/timeline-engine";

const iconMap: Record<string, any> = {
  gavel: Gavel, file: FileText, mail: Mail, dollar: DollarSign,
  calendar: Calendar, check: CheckCircle, clock: Clock, user: User,
  shield: Shield, star: Star, flag: Flag, alert: AlertTriangle,
};

const statusColors: Record<string, { dot: string; line: string; text: string }> = {
  completed: { dot: "bg-green-500", line: "bg-green-200", text: "text-green-700" },
  current: { dot: "bg-blue-500 ring-4 ring-blue-100", line: "bg-blue-200", text: "text-blue-700" },
  upcoming: { dot: "bg-orange-400", line: "bg-orange-200", text: "text-orange-600" },
  anticipated: { dot: "bg-gray-300 border-2 border-dashed border-gray-400", line: "bg-gray-200", text: "text-gray-500" },
  cancelled: { dot: "bg-gray-200", line: "bg-gray-100", text: "text-gray-400 line-through" },
};

interface ClientTimelineViewProps {
  timeline: ClientTimelineType;
  onActionComplete?: (eventId: string) => void;
}

export function ClientTimelineView({ timeline, onActionComplete }: ClientTimelineViewProps) {
  const theme = usePortalTheme();

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Welcome Note */}
      {timeline.welcomeNote && (
        <Card className="p-4" style={{ borderRadius: theme.borderRadius, backgroundColor: theme.colorPrimary + "08" }}>
          <p className="text-sm" style={{ color: theme.colorPrimary }}>{timeline.welcomeNote}</p>
        </Card>
      )}

      {/* Current Status Hero */}
      {timeline.currentPhase && (
        <Card className="p-5 text-center" style={{ borderRadius: theme.borderRadius }}>
          <Badge className="text-xs px-3 py-1 mb-2" style={{ backgroundColor: theme.colorPrimary + "15", color: theme.colorPrimary }}>
            {timeline.currentPhase.label}
          </Badge>
          <p className="text-sm mt-2" style={{ color: theme.colorMuted }}>
            {timeline.currentPhase.description}
          </p>
          {/* Progress bar */}
          <div className="mt-3 mx-auto max-w-xs">
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.colorPrimary + "15" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${timeline.currentPhase.progress}%`, backgroundColor: theme.colorPrimary }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: theme.colorMuted }}>
              {timeline.currentPhase.progress}% through this phase
            </p>
          </div>
        </Card>
      )}

      {/* Phase-Grouped Timeline */}
      {timeline.phaseGroups.length > 0 ? (
        timeline.phaseGroups.map((group) => (
          <PhaseGroupSection key={group.phase} group={group} theme={theme} onActionComplete={onActionComplete} />
        ))
      ) : (
        /* Flat Timeline */
        <div className="relative ml-4">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
          {timeline.events.map((event, i) => (
            <TimelineEventCard key={event.id} event={event} theme={theme} isLast={i === timeline.events.length - 1} onActionComplete={onActionComplete} />
          ))}
        </div>
      )}

      {/* End marker */}
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: theme.colorMuted }}>
          This timeline is updated as your case progresses.
        </p>
      </div>
    </div>
  );
}

function PhaseGroupSection({ group, theme, onActionComplete }: { group: PhaseGroup; theme: any; onActionComplete?: (id: string) => void }) {
  return (
    <div>
      {/* Phase Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
          group.isComplete ? "bg-green-500" : group.isCurrent ? "bg-blue-500" : "bg-gray-300"
        )}>
          {group.isComplete ? (
            <CheckCircle className="h-3.5 w-3.5 text-white" />
          ) : group.isCurrent ? (
            <div className="h-2 w-2 bg-white rounded-full" />
          ) : (
            <Clock className="h-3 w-3 text-white" />
          )}
        </div>
        <h2 className="text-sm font-semibold" style={{ color: group.isCurrent ? theme.colorPrimary : theme.colorText }}>
          {group.label}
        </h2>
        {group.isCurrent && (
          <Badge className="text-[10px]" style={{ backgroundColor: theme.colorPrimary + "15", color: theme.colorPrimary }}>
            Current
          </Badge>
        )}
      </div>

      {/* Events in this phase */}
      <div className="relative ml-3 pl-6 border-l-2" style={{ borderColor: group.isCurrent ? theme.colorPrimary + "30" : "#E5E7EB" }}>
        {group.events.map((event, i) => (
          <TimelineEventCard key={event.id} event={event} theme={theme} isLast={i === group.events.length - 1} onActionComplete={onActionComplete} />
        ))}
      </div>
    </div>
  );
}

function TimelineEventCard({ event, theme, isLast, onActionComplete }: {
  event: TimelineEventData;
  theme: any;
  isLast: boolean;
  onActionComplete?: (id: string) => void;
}) {
  const Icon = iconMap[event.iconType || "check"] || CheckCircle;
  const sc = statusColors[event.timelineStatus] || statusColors.completed;
  const isMajor = event.importance === "major";

  return (
    <div className={cn("relative pb-5", isLast && "pb-0")}>
      {/* Dot on timeline */}
      <div className={cn(
        "absolute -left-[25px] h-4 w-4 rounded-full flex items-center justify-center",
        sc.dot,
        event.timelineStatus === "anticipated" && "bg-white"
      )}>
        {event.timelineStatus === "completed" && (
          <CheckCircle className="h-2.5 w-2.5 text-white" />
        )}
      </div>

      {/* Event Card */}
      <div className={cn(
        "ml-2 transition-all",
        isMajor ? "p-3 rounded-lg border" : "py-1",
        isMajor && event.timelineStatus === "current" && "ring-1"
      )}
      style={isMajor ? {
        borderRadius: theme.borderRadius,
        borderColor: event.timelineStatus === "current" ? theme.colorPrimary + "40" : "#E5E7EB",
        ...(event.timelineStatus === "current" ? { ringColor: theme.colorPrimary + "20" } : {}),
      } : {}}>
        {/* Date */}
        <p className={cn("text-[10px] font-medium", sc.text)}>
          {event.dateLabel || new Date(event.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {event.isEstimatedDate && !event.dateLabel && " (estimated)"}
        </p>

        {/* Title */}
        <div className="flex items-start gap-2 mt-0.5">
          {isMajor && (
            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: event.accentColor || theme.colorPrimary }} />
          )}
          <div className="flex-1 min-w-0">
            <h3 className={cn("text-sm font-medium", sc.text)} style={{ color: event.timelineStatus !== "anticipated" ? theme.colorText : undefined }}>
              {event.title}
            </h3>
            {event.clientDescription && isMajor && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: theme.colorMuted }}>
                {event.clientDescription}
              </p>
            )}
          </div>
        </div>

        {/* Client Action Required */}
        {event.requiresClientAction && !event.clientActionCompleted && (
          <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: theme.colorAccent + "10" }}>
            <p className="text-xs font-medium" style={{ color: theme.colorAccent }}>
              Action needed: {event.clientActionText}
            </p>
            {event.clientActionLink && (
              <Button
                size="sm"
                className="mt-1.5 gap-1 text-xs h-7"
                style={{ backgroundColor: theme.colorPrimary }}
                onClick={() => onActionComplete?.(event.id)}
              >
                <ExternalLink className="h-3 w-3" /> Go
              </Button>
            )}
          </div>
        )}

        {event.requiresClientAction && event.clientActionCompleted && (
          <div className="mt-1 flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span className="text-[10px] font-medium">Completed</span>
          </div>
        )}

        {/* Attachment */}
        {event.attachmentUrl && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: theme.colorPrimary }}>
            <FileText className="h-3 w-3" />
            <span>{event.attachmentName || "View document"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
