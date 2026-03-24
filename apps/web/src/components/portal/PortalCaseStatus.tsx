"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalTheme } from "./PortalThemeProvider";
import { Calendar, MapPin, User, Clock } from "lucide-react";

interface StatusUpdate {
  id: string;
  title: string;
  body: string;
  milestone?: string | null;
  phase?: string | null;
  phasePercentage?: number | null;
  publishedAt: Date | null;
}

interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  eventType: string;
}

interface PortalCaseStatusProps {
  matterName: string;
  practiceArea?: string | null;
  statusUpdates: StatusUpdate[];
  upcomingEvents: Event[];
}

export function PortalCaseStatus({ matterName, practiceArea, statusUpdates, upcomingEvents }: PortalCaseStatusProps) {
  const theme = usePortalTheme();
  const latestUpdate = statusUpdates[0];

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Phase Progress */}
      {latestUpdate?.phase && (
        <Card className="p-5" style={{ borderRadius: theme.borderRadius }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: theme.colorText }}>Case Progress</h2>
            {latestUpdate.phasePercentage != null && (
              <span className="text-xs font-medium" style={{ color: theme.colorPrimary }}>
                {latestUpdate.phasePercentage}%
              </span>
            )}
          </div>
          <Badge className="text-xs px-2 py-1 mb-2" style={{ backgroundColor: theme.colorPrimary + "15", color: theme.colorPrimary }}>
            {latestUpdate.phase}
          </Badge>
          {latestUpdate.phasePercentage != null && (
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${latestUpdate.phasePercentage}%`, backgroundColor: theme.colorPrimary }}
              />
            </div>
          )}
        </Card>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: theme.colorText }}>
            Upcoming Events
          </h2>
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="p-3 flex items-start gap-3" style={{ borderRadius: theme.borderRadius }}>
                <div className="h-10 w-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: theme.colorPrimary + "15" }}>
                  <span className="text-[10px] font-bold" style={{ color: theme.colorPrimary }}>
                    {new Date(event.startTime).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-sm font-bold leading-none" style={{ color: theme.colorPrimary }}>
                    {new Date(event.startTime).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: theme.colorText }}>{event.title}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs flex items-center gap-1" style={{ color: theme.colorMuted }}>
                      <Clock className="h-3 w-3" />
                      {new Date(event.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    {event.location && (
                      <span className="text-xs flex items-center gap-1" style={{ color: theme.colorMuted }}>
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Status Update History */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: theme.colorText }}>
          Status Updates
        </h2>
        {statusUpdates.length > 0 ? (
          <div className="space-y-4">
            {statusUpdates.map((update, i) => (
              <Card key={update.id} className="p-4" style={{ borderRadius: theme.borderRadius }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: theme.colorText }}>{update.title}</h3>
                  {update.milestone && (
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                      {update.milestone.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: theme.colorMuted }}>
                  {update.body}
                </p>
                {update.publishedAt && (
                  <p className="text-[10px] mt-3" style={{ color: theme.colorMuted + "80" }}>
                    {new Date(update.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center" style={{ borderRadius: theme.borderRadius }}>
            <p className="text-sm" style={{ color: theme.colorMuted }}>
              No updates yet. Your attorney will post updates as your case progresses.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
