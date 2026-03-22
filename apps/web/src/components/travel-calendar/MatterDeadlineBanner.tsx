"use client";

import React from "react";

interface MatterDeadlineBannerProps {
  deadlines: any[];
  onTap: (event: any) => void;
}

export default function MatterDeadlineBanner({
  deadlines,
  onTap,
}: MatterDeadlineBannerProps) {
  if (!deadlines || deadlines.length === 0) return null;

  const isSOL = (deadline: any) =>
    deadline.deadlineType === "sol" ||
    deadline.type === "sol" ||
    deadline.title?.toLowerCase().includes("statute of limitation");

  return (
    <div className="w-full py-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-sm text-slate-300">
          📋 {deadlines.length} deadline{deadlines.length !== 1 ? "s" : ""}{" "}
          today
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {deadlines.map((deadline, idx) => {
          const sol = isSOL(deadline);
          return (
            <button
              key={deadline.id ?? idx}
              onClick={() => onTap(deadline)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium text-white transition-colors ${
                sol
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-purple-600 hover:bg-purple-500"
              }`}
            >
              <span className="truncate max-w-[140px] inline-block align-middle">
                {deadline.title ?? "Deadline"}
              </span>
              {deadline.time && (
                <span className="ml-1.5 opacity-75">{deadline.time}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
