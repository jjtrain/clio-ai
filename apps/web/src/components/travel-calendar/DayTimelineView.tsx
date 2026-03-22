"use client";

import React from "react";
import {
  MapPin,
  Clock,
  Briefcase,
  Gavel,
  Mic,
  Users,
  AlertTriangle,
  FileText,
  Radio,
  CalendarClock,
} from "lucide-react";
import TravelCard from "./TravelCard";

const EVENT_COLORS: Record<string, string> = {
  court_hearing: "#EF4444",
  deposition: "#F97316",
  meeting: "#3B82F6",
  matter_deadline: "#8B5CF6",
  court_filing: "#8B5CF6",
  statute_tracker: "#991B1B",
  personal: "#10B981",
  default: "#6B7280",
};

function getEventColor(type?: string): string {
  if (!type) return EVENT_COLORS.default;
  return EVENT_COLORS[type] ?? EVENT_COLORS.default;
}

function getEventIcon(type?: string) {
  switch (type) {
    case "court_hearing":
      return <Gavel className="h-4 w-4" />;
    case "deposition":
      return <Mic className="h-4 w-4" />;
    case "meeting":
      return <Users className="h-4 w-4" />;
    case "court_filing":
      return <FileText className="h-4 w-4" />;
    case "statute_tracker":
      return <AlertTriangle className="h-4 w-4" />;
    case "matter_deadline":
      return <CalendarClock className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface SourceBadgeProps {
  event: any;
}

function SourceBadge({ event }: SourceBadgeProps) {
  if (event.sourceType === "manual" || !event.sourceType) return null;

  let label = "";
  if (event.sourceType === "matter" && event.matterName) {
    label = `Matter: ${event.matterName}`;
  } else if (event.sourceType === "court_filing") {
    label = "Court Filing";
  } else if (event.sourceType === "statute_tracker") {
    label = "SOL Tracker";
  } else {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {label}
    </span>
  );
}

interface GeofenceIndicatorProps {
  checkinStatus?: string;
}

function GeofenceIndicator({ checkinStatus }: GeofenceIndicatorProps) {
  if (!checkinStatus) return null;

  const isCheckedIn = checkinStatus === "checked_in";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        isCheckedIn ? "text-green-600" : "text-amber-500"
      }`}
    >
      <Radio
        className={`h-3.5 w-3.5 ${
          isCheckedIn ? "text-green-500" : "animate-pulse text-amber-500"
        }`}
      />
      {isCheckedIn ? "Checked in" : "Pending"}
    </span>
  );
}

interface MatterDeadlineBannerProps {
  deadlineEvents: any[];
}

function MatterDeadlineBanner({ deadlineEvents }: MatterDeadlineBannerProps) {
  if (!deadlineEvents.length) return null;

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-700">
        <CalendarClock className="h-4 w-4" />
        Deadlines
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {deadlineEvents.map((d, i) => (
          <div
            key={d.id ?? i}
            className="flex-shrink-0 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-800"
          >
            {d.title}
            {d.matterName && (
              <span className="ml-1 text-purple-500">· {d.matterName}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SOLWarningBannerProps {
  events: any[];
}

function SOLWarningBanner({ events }: SOLWarningBannerProps) {
  const solEvents = events.filter((e) => e.type === "statute_tracker");
  if (!solEvents.length) return null;

  return (
    <div className="mb-4 rounded-lg bg-red-900 p-3 text-white">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 text-red-300" />
        Statute of Limitations Warning
      </div>
      {solEvents.map((e, i) => (
        <div key={e.id ?? i} className="text-sm text-red-100">
          {e.title}
          {e.matterName && ` — ${e.matterName}`}
        </div>
      ))}
    </div>
  );
}

interface EventCardProps {
  event: any;
  onEventTap: (event: any) => void;
}

function EventCard({ event, onEventTap }: EventCardProps) {
  const color = getEventColor(event.type);
  const isCourtEvent =
    event.type === "court_hearing" || event.type === "court_filing";

  return (
    <button
      onClick={() => onEventTap(event)}
      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
    >
      <div
        className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
        style={{ borderLeftWidth: 4, borderLeftColor: color }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            {getEventIcon(event.type)}
            <span>{event.title}</span>
          </div>
          {isCourtEvent && (
            <GeofenceIndicator checkinStatus={event.checkinStatus} />
          )}
        </div>

        <div className="mt-1 text-xs text-gray-500">
          {formatTime(event.startTime)} – {formatTime(event.endTime)}
        </div>

        {event.location && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {event.matterName && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{event.matterName}</span>
          </div>
        )}

        <div className="mt-2">
          <SourceBadge event={event} />
        </div>
      </div>
    </button>
  );
}

interface DayTimelineViewProps {
  events: any[];
  travelSegments: any[];
  allDayEvents: any[];
  deadlineEvents: any[];
  onEventTap: (event: any) => void;
  isLoading: boolean;
}

export function DayTimelineView({
  events,
  travelSegments,
  allDayEvents,
  deadlineEvents,
  onEventTap,
  isLoading,
}: DayTimelineViewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Clock className="mb-3 h-8 w-8 animate-pulse" />
        <p className="text-sm">Loading schedule...</p>
      </div>
    );
  }

  const hasNoEvents =
    events.length === 0 &&
    allDayEvents.length === 0 &&
    deadlineEvents.length === 0;

  if (hasNoEvents) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Clock className="mb-3 h-8 w-8" />
        <p className="text-sm">No events today</p>
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Build interleaved list: event, travel, event, travel, ...
  const timelineItems: React.ReactNode[] = [];

  sorted.forEach((event, idx) => {
    timelineItems.push(
      <EventCard key={`event-${event.id ?? idx}`} event={event} onEventTap={onEventTap} />
    );

    // Insert travel card between events if a matching segment exists
    if (idx < sorted.length - 1 && travelSegments[idx]) {
      timelineItems.push(
        <TravelCard
          key={`travel-${idx}`}
          travelSegment={travelSegments[idx]}
        />
      );
    }
  });

  return (
    <div className="space-y-2">
      <SOLWarningBanner events={[...allDayEvents, ...events]} />
      <MatterDeadlineBanner deadlineEvents={deadlineEvents} />

      <div className="relative space-y-3">
        {/* Vertical timeline line */}
        <div className="absolute bottom-0 left-5 top-0 w-px bg-gray-200" />

        <div className="relative space-y-3 pl-10">
          {timelineItems}
        </div>
      </div>
    </div>
  );
}

export default DayTimelineView;
