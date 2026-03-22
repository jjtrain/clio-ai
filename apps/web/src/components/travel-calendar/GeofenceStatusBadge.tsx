"use client";

import React from "react";

type GeofenceStatus = "pending" | "approaching" | "checked_in" | "missed" | null;

interface GeofenceStatusBadgeProps {
  status: GeofenceStatus;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pending: {
    dotClass: "bg-yellow-400",
    pulse: true,
    label: "Pending",
    icon: null,
  },
  approaching: {
    dotClass: "bg-blue-400",
    pulse: false,
    label: "En Route",
    icon: null,
  },
  checked_in: {
    dotClass: "bg-green-400",
    pulse: false,
    label: "Checked In",
    icon: (
      <svg
        className="w-3 h-3 text-green-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  missed: {
    dotClass: "bg-red-400",
    pulse: false,
    label: "Missed",
    icon: (
      <svg
        className="w-3 h-3 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
  },
} as const;

export default function GeofenceStatusBadge({
  status,
  compact = false,
}: GeofenceStatusBadgeProps) {
  if (status === null) return null;

  const config = STATUS_CONFIG[status];

  return (
    <>
      <style jsx>{`
        @keyframes geofence-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.4);
          }
        }
        .geofence-pulse {
          animation: geofence-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex items-center justify-center">
          <span
            className={`w-2.5 h-2.5 rounded-full ${config.dotClass} ${
              config.pulse ? "geofence-pulse" : ""
            }`}
          />
        </span>

        {config.icon}

        {!compact && (
          <span className="text-xs font-medium text-slate-300">
            {config.label}
          </span>
        )}
      </span>
    </>
  );
}
