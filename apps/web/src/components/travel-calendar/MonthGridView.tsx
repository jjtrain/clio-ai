"use client";

import React, { useMemo } from "react";

interface DayData {
  count: number;
  hasConflict: boolean;
  hasDeadline: boolean;
  types: string[];
}

interface MonthGridViewProps {
  currentDate: Date;
  onSelectDay: (date: Date) => void;
  monthData?: {
    days: Record<string, DayData>;
  };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  appointment: "bg-blue-400",
  court_hearing: "bg-red-400",
  deposition: "bg-amber-400",
  meeting: "bg-green-400",
  personal: "bg-purple-400",
};

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function MonthGridView({
  currentDate,
  onSelectDay,
  monthData,
}: MonthGridViewProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthTitle = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: (number | null)[] = [];

    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push(d);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [year, month]);

  const getDayKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className="w-full">
      <h2 className="text-center text-lg font-semibold text-white mb-3">
        {monthTitle}
      </h2>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-slate-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dayKey = getDayKey(day);
          const data = monthData?.days?.[dayKey];
          const isToday = dayKey === todayStr;
          const dots = data?.types?.slice(0, 3) ?? [];
          const extraCount = data ? data.count - 3 : 0;

          return (
            <button
              key={dayKey}
              onClick={() => onSelectDay(new Date(year, month, day))}
              className={`
                relative aspect-square rounded-md flex flex-col items-center justify-center gap-0.5
                transition-colors
                ${isToday ? "bg-blue-600" : "bg-slate-800"}
                hover:bg-slate-700
              `}
            >
              {data?.hasConflict && (
                <div
                  className="absolute top-0 right-0 w-0 h-0"
                  style={{
                    borderLeft: "8px solid transparent",
                    borderTop: "8px solid #ef4444",
                  }}
                />
              )}

              {data?.hasDeadline && (
                <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-purple-500 rotate-45" />
              )}

              <span
                className={`text-xs font-medium ${isToday ? "text-white" : "text-slate-200"}`}
              >
                {day}
              </span>

              {dots.length > 0 && (
                <div className="flex gap-0.5">
                  {dots.map((type, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_COLORS[type] ?? "bg-slate-400"}`}
                    />
                  ))}
                </div>
              )}

              {extraCount > 0 && (
                <span className="text-[8px] text-slate-400">
                  +{extraCount} more
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
