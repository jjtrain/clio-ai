"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DayData {
  date: string;
  eventCount: number;
  conflictCount: number;
  hasDeadlines: boolean;
}

interface WeekStripViewProps {
  currentDate: Date;
  onSelectDay: (date: Date) => void;
  weekData?: {
    days: DayData[];
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function WeekStripView({
  currentDate,
  onSelectDay,
  weekData,
}: WeekStripViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const baseWeekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekStart = useMemo(
    () => addDays(baseWeekStart, weekOffset * 7),
    [baseWeekStart, weekOffset]
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Build lookup map from weekData
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    if (weekData?.days) {
      weekData.days.forEach((d) => map.set(d.date, d));
    }
    return map;
  }, [weekData]);

  function getDayData(date: Date): DayData | undefined {
    return dayDataMap.get(formatDateKey(date));
  }

  // Summary for selected day
  const selectedDayData = getDayData(currentDate);

  return (
    <div className="space-y-2">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="text-sm font-medium text-gray-600">
          {days[0].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {days[6].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>

        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day buttons */}
      <div className="flex justify-between gap-1">
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, currentDate);
          const data = getDayData(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={`flex flex-1 flex-col items-center rounded-lg px-1 py-2 transition-colors ${
                isSelected
                  ? "bg-blue-500 text-white"
                  : isToday
                  ? "ring-2 ring-blue-400 ring-offset-1"
                  : "hover:bg-gray-100"
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isSelected ? "text-blue-100" : "text-gray-500"
                }`}
              >
                {DAY_NAMES[day.getDay()]}
              </span>
              <span
                className={`mt-0.5 text-lg font-semibold leading-tight ${
                  isSelected ? "text-white" : "text-gray-900"
                }`}
              >
                {day.getDate()}
              </span>

              {/* Indicator dots */}
              <div className="mt-1 flex gap-0.5">
                {data && data.eventCount > 0 && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-blue-200" : "bg-blue-500"
                    }`}
                  />
                )}
                {data && data.conflictCount > 0 && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-red-200" : "bg-red-500"
                    }`}
                  />
                )}
                {data?.hasDeadlines && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-purple-200" : "bg-purple-500"
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
        {selectedDayData ? (
          <>
            <span className="font-medium text-gray-700">
              {selectedDayData.eventCount}
            </span>{" "}
            event{selectedDayData.eventCount !== 1 ? "s" : ""}
            {" · "}
            <span className="font-medium text-gray-700">
              {selectedDayData.conflictCount}
            </span>{" "}
            conflict{selectedDayData.conflictCount !== 1 ? "s" : ""}
            {" · "}
            <span className="font-medium text-gray-700">
              {selectedDayData.hasDeadlines ? "Has" : "No"}
            </span>{" "}
            deadlines
          </>
        ) : (
          "No data for selected day"
        )}
      </div>
    </div>
  );
}

export default WeekStripView;
