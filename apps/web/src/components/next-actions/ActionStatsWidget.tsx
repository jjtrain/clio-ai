"use client";

import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export function ActionStatsWidget() {
  const { data: stats } = trpc.nextActions.getActionStats.useQuery();

  if (!stats || stats.totalPending === 0) return null;

  return (
    <Link href="/next-actions">
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
            <Zap className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{stats.totalPending} pending actions</p>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
              {stats.immediate > 0 && (
                <span className="text-red-500 font-medium">{stats.immediate} immediate</span>
              )}
              {stats.thisWeek > 0 && (
                <span>{stats.thisWeek} this week</span>
              )}
              <span>{stats.completionRate}% completion rate</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
