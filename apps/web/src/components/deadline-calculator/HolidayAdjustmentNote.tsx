"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

interface HolidayAdjustmentNoteProps {
  originalDate: string;
  adjustedDate: string;
  adjustedForWeekend: boolean;
  adjustedForHoliday: boolean;
  holidayName?: string;
  jurisdiction?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
  });
}

export function HolidayAdjustmentNote({
  originalDate,
  adjustedDate,
  adjustedForWeekend,
  adjustedForHoliday,
  holidayName,
}: HolidayAdjustmentNoteProps) {
  const [showSchedule, setShowSchedule] = useState(false);

  if (!adjustedForWeekend && !adjustedForHoliday) return null;

  const reason = adjustedForHoliday && holidayName
    ? holidayName
    : "weekend";

  return (
    <div className="inline-flex items-start gap-1">
      <button
        onClick={() => setShowSchedule(!showSchedule)}
        className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors"
      >
        <CalendarDays className="w-3 h-3 flex-shrink-0" />
        <span>
          Originally {formatDate(originalDate)} ({reason}) &rarr; Moved to{" "}
          {formatDate(adjustedDate)}
        </span>
      </button>

      {showSchedule && (
        <div className="absolute z-20 mt-6 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs">
          <p className="font-medium text-slate-700 mb-1">Adjustment Details</p>
          <p className="text-slate-500">
            Original date: {formatDate(originalDate)}
          </p>
          <p className="text-slate-500">
            Adjusted to: {formatDate(adjustedDate)}
          </p>
          <p className="text-slate-500">
            Reason: {adjustedForHoliday ? `Court holiday (${holidayName})` : "Weekend (Saturday/Sunday)"}
          </p>
        </div>
      )}
    </div>
  );
}
