"use client";

import { Calendar } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function DeadlineDashboardWidget() {
  const { data, isLoading } = trpc.deadlineCalculator.getUpcomingDeadlines.useQuery({
    days: 7,
  });

  if (isLoading) {
    return (
      <div className="max-w-sm border rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-500">Deadlines This Week</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const deadlines = (data?.deadlines ?? []) as any[];
  const overdueCount = deadlines.filter((d: any) => d.isOverdue).length;
  const upcoming = deadlines.slice(0, 3);
  const critical = deadlines.find((d: any) => d.priority === "critical");

  if (deadlines.length === 0) {
    return (
      <div className="max-w-sm border rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold">Deadlines This Week</h3>
        </div>
        <p className="text-sm text-gray-500">No deadlines this week.</p>
        <Link
          href="/deadline-calculator"
          className="text-xs text-blue-600 hover:underline mt-2 inline-block"
        >
          View All &rarr;
        </Link>
      </div>
    );
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="max-w-sm border rounded-lg shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold">Deadlines This Week</h3>
      </div>

      {/* Count */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-700">
          {deadlines.length} deadline{deadlines.length !== 1 ? "s" : ""} this week
        </span>
        {overdueCount > 0 && (
          <span className="text-xs font-medium text-red-600">
            {overdueCount} overdue
          </span>
        )}
      </div>

      {/* Mini list */}
      <ul className="space-y-2 mb-3">
        {upcoming.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ${getPriorityColor(d.priority)}`}
            />
            <span className="truncate text-gray-800">{d.name}</span>
            <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">
              {d.daysUntil <= 0
                ? "Today"
                : `${d.daysUntil}d`}
            </span>
          </li>
        ))}
      </ul>

      {/* Next critical */}
      {critical && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
          <p className="text-xs font-medium text-red-800">
            Next critical: {critical.name} &mdash;{" "}
            {critical.daysUntil <= 0
              ? "Today"
              : `${critical.daysUntil} day${critical.daysUntil !== 1 ? "s" : ""}`}
          </p>
        </div>
      )}

      {/* View All link */}
      <Link
        href="/deadline-calculator"
        className="text-xs text-blue-600 hover:underline"
      >
        View All &rarr;
      </Link>
    </div>
  );
}
