"use client";

import React from "react";
import {
  X,
  MapPin,
  Briefcase,
  Clock,
  Gavel,
  ExternalLink,
  Trash2,
  Edit2,
  Navigation,
  CheckCircle,
  AlertCircle,
  Radio,
} from "lucide-react";

interface EventDetailSheetProps {
  event: any;
  travelTo?: any;
  travelFrom?: any;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSourceLabel(sourceType: string | null | undefined): string {
  switch (sourceType) {
    case "matter_deadlines":
      return "Synced from Matter Deadlines";
    case "court_filing_rules":
      return "Synced from Court Filing Rules";
    case "sol_tracker":
      return "Synced from SOL Tracker";
    case "manual":
      return "Manual";
    default:
      return "Manual";
  }
}

function isSyncedEvent(sourceType: string | null | undefined): boolean {
  return !!sourceType && sourceType !== "manual";
}

export default function EventDetailSheet({
  event,
  travelTo,
  travelFrom,
  onClose,
  onDelete,
}: EventDetailSheetProps) {
  const synced = isSyncedEvent(event.sourceType);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-lg animate-slide-up rounded-t-2xl bg-slate-800 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="max-h-[85vh] overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 pr-8">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: event.color || "#6366f1" }}
              />
              <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-300">
                {event.eventType?.replace(/_/g, " ") || "Event"}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white">{event.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(event.startTime)} &ndash;{" "}
                {formatTime(event.endTime)}
              </span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <p className="mb-5 text-sm leading-relaxed text-slate-400">
              {event.description}
            </p>
          )}

          {/* Location */}
          {event.location && (
            <div className="mb-5 rounded-lg bg-slate-900 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-sm text-slate-300">
                    {event.location}
                  </span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  Open in Maps
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Matter section */}
          {event.matterId && (
            <div className="mb-5 rounded-lg bg-slate-900 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Briefcase className="h-3.5 w-3.5" />
                Matter
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    {event.matterName}
                  </p>
                  {event.matterNumber && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      #{event.matterNumber}
                    </p>
                  )}
                </div>
                <a
                  href={`/matters/${event.matterId}`}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                >
                  Open Matter
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Court section */}
          {(event.courtId || event.eventType === "court_hearing") && (
            <div className="mb-5 rounded-lg bg-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Gavel className="h-3.5 w-3.5" />
                Court
              </div>
              {event.location && (
                <p className="mb-3 text-sm text-slate-300">{event.location}</p>
              )}

              {/* Geofence check-in status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {event.checkinStatus === "pending" && (
                    <>
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-500" />
                      </span>
                      <span className="text-sm text-yellow-400">
                        Check-in Pending
                      </span>
                    </>
                  )}
                  {event.checkinStatus === "checked_in" && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400">
                        Checked In
                      </span>
                    </>
                  )}
                  {event.checkinStatus === "missed" && (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-red-400">
                        Check-in Missed
                      </span>
                    </>
                  )}
                </div>

                {event.checkinStatus === "pending" && (
                  <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500">
                    Check In
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Travel sections */}
          {travelTo && (
            <div className="mb-4 rounded-lg bg-slate-900 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Navigation className="h-3.5 w-3.5" />
                Travel to this event
              </div>
              <p className="text-sm text-slate-300">
                {travelTo.duration && (
                  <span className="font-medium">{travelTo.duration}</span>
                )}
                {travelTo.distance && (
                  <span className="text-slate-400">
                    {" "}
                    &middot; {travelTo.distance}
                  </span>
                )}
                {travelTo.mode && (
                  <span className="text-slate-400">
                    {" "}
                    &middot; {travelTo.mode}
                  </span>
                )}
              </p>
              {travelTo.departBy && (
                <p className="mt-1 text-xs text-slate-500">
                  Depart by {formatTime(travelTo.departBy)}
                </p>
              )}
            </div>
          )}

          {travelFrom && (
            <div className="mb-5 rounded-lg bg-slate-900 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Navigation className="h-3.5 w-3.5 rotate-180" />
                Travel from this event
              </div>
              <p className="text-sm text-slate-300">
                {travelFrom.duration && (
                  <span className="font-medium">{travelFrom.duration}</span>
                )}
                {travelFrom.distance && (
                  <span className="text-slate-400">
                    {" "}
                    &middot; {travelFrom.distance}
                  </span>
                )}
                {travelFrom.mode && (
                  <span className="text-slate-400">
                    {" "}
                    &middot; {travelFrom.mode}
                  </span>
                )}
              </p>
              {travelFrom.arriveBy && (
                <p className="mt-1 text-xs text-slate-500">
                  Arrive by {formatTime(travelFrom.arriveBy)}
                </p>
              )}
            </div>
          )}

          {/* Source tag */}
          <div className="mb-5 flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs text-slate-500">
              {getSourceLabel(event.sourceType)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 border-t border-slate-700 pt-4">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600">
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
            {synced ? (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-slate-500">
                <Trash2 className="h-4 w-4" />
                <span className="truncate">
                  Managed by{" "}
                  {event.sourceType?.replace(/_/g, " ")}
                </span>
              </div>
            ) : (
              <button
                onClick={() => onDelete?.(event.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-900/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
