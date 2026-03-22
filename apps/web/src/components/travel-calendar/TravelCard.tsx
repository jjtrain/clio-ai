"use client";

import React, { useState } from "react";
import {
  Car,
  Train,
  Footprints,
  ChevronDown,
  ChevronUp,
  Navigation,
  MapPin,
} from "lucide-react";

interface GeofenceInfo {
  geofenceId: string;
  radius: number;
  courtName: string;
  lat: number;
  lng: number;
}

interface TravelSegment {
  travelMinutes: number;
  distanceMeters: number;
  gapMinutes: number;
  bufferMinutes: number;
  status: "ok" | "tight" | "conflict";
  departBy: Date | string;
  travelMode: string;
  summary: string;
  hasGeofence: boolean;
  geofenceInfo: GeofenceInfo | null;
  geofenceArrivalTime: Date | string | null;
  fromEvent: any;
  toEvent: any;
}

interface TravelCardProps {
  travelSegment: TravelSegment;
  onModeChange?: (mode: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "#22C55E",
  tight: "#EAB308",
  conflict: "#EF4444",
};

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${hours}:${mm} ${ampm}`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

function ModeIcon({ mode, size = 16 }: { mode: string; size?: number }) {
  switch (mode) {
    case "transit":
      return <Train size={size} />;
    case "walk":
      return <Footprints size={size} />;
    case "drive":
    default:
      return <Car size={size} />;
  }
}

export default function TravelCard({
  travelSegment,
  onModeChange,
}: TravelCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    travelMinutes,
    distanceMeters,
    bufferMinutes,
    status,
    departBy,
    travelMode,
    summary,
    hasGeofence,
    geofenceArrivalTime,
  } = travelSegment;

  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.ok;
  const isConflict = status === "conflict";

  const modes = [
    { key: "drive", label: "Drive", Icon: Car },
    { key: "transit", label: "Transit", Icon: Train },
    { key: "walk", label: "Walk", Icon: Footprints },
  ];

  return (
    <div
      onClick={() => setExpanded((prev) => !prev)}
      className="cursor-pointer select-none"
      style={{
        border: `1px dashed ${statusColor}`,
        borderRadius: 8,
        backgroundColor: "rgb(15 23 42)", // slate-900
        padding: "8px 12px",
        color: "#e2e8f0",
        fontSize: 13,
        animation: isConflict ? "travelCardPulse 2s ease-in-out infinite" : undefined,
      }}
    >
      {/* Pulse animation for conflict status */}
      {isConflict && (
        <style>{`
          @keyframes travelCardPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      )}

      {/* Compact row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Navigation size={14} style={{ color: statusColor, flexShrink: 0 }} />
          <ModeIcon mode={travelMode} size={16} />
          <span style={{ fontWeight: 600 }}>
            {travelMinutes} min
          </span>
          <span style={{ color: "#94a3b8" }}>
            {formatDistance(distanceMeters)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            Depart by {formatTime(departBy)}
          </span>
          {expanded ? (
            <ChevronUp size={14} style={{ color: "#94a3b8" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "#94a3b8" }} />
          )}
        </div>
      </div>

      {/* Geofence line */}
      {hasGeofence && geofenceArrivalTime && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#EAB308",
          }}
        >
          <MapPin size={12} />
          <span>
            {"\uD83D\uDCCD"} Arrive by {formatTime(geofenceArrivalTime)} for court check-in
          </span>
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div
          style={{ marginTop: 10, borderTop: "1px solid #334155", paddingTop: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mode switcher */}
          {onModeChange && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {modes.map(({ key, label, Icon }) => {
                const active = travelMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => onModeChange(key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: active
                        ? `1px solid ${statusColor}`
                        : "1px solid #475569",
                      backgroundColor: active ? "rgba(51,65,85,0.8)" : "transparent",
                      color: active ? "#f1f5f9" : "#94a3b8",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Buffer info */}
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
            Buffer: {bufferMinutes} min
            {bufferMinutes < 0 && (
              <span style={{ color: "#EF4444", marginLeft: 6 }}>
                ({Math.abs(bufferMinutes)} min short)
              </span>
            )}
          </div>

          {/* Route summary */}
          {summary && (
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
