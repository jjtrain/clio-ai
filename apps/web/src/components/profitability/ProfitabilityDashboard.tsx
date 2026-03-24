"use client";

import { TrendingUp, DollarSign, BarChart3, Sparkles, RefreshCw, Settings, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function ProfitabilityDashboard() {
  const { data: stats } = trpc.profitability.getDashboardStats.useQuery();
  const { data: latest } = trpc.profitability.getLatest.useQuery();
  const computeMutation = trpc.profitability.computePeriod.useMutation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-blue-600" />
            Practice Area Profitability
          </h1>
          <p className="text-sm text-gray-500 mt-1">Revenue, costs, margins, and trends by practice area</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const now = new Date();
            computeMutation.mutate({ period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0) });
          }} disabled={computeMutation.isLoading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", computeMutation.isLoading && "animate-spin")} /> Compute
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Revenue</p>
          </Card>
          <Card className="p-4">
            <p className={cn("text-2xl font-bold", stats.totalProfit >= 0 ? "text-green-600" : "text-red-600")}>${stats.totalProfit.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Net Profit</p>
          </Card>
          <Card className="p-4">
            <p className={cn("text-2xl font-bold", stats.firmMargin >= 30 ? "text-green-600" : stats.firmMargin >= 15 ? "text-yellow-600" : "text-red-600")}>{stats.firmMargin}%</p>
            <p className="text-xs text-gray-500">Firm Margin</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">{stats.paCount}</p>
            <p className="text-xs text-gray-500">Practice Areas</p>
          </Card>
        </div>
      )}

      {/* AI Summary */}
      {stats?.aiSummary && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">{stats.aiSummary}</p>
          </div>
        </Card>
      )}

      {/* Top & Bottom */}
      {stats?.topPA && stats?.bottomPA && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4 border-l-4 border-l-green-500">
            <p className="text-xs text-gray-500 mb-1">Most Profitable</p>
            <p className="text-lg font-bold text-gray-900 capitalize">{stats.topPA.name.replace(/_/g, " ")}</p>
            <p className="text-sm text-green-600">{stats.topPA.margin}% net margin</p>
          </Card>
          <Card className={cn("p-4 border-l-4", (stats.bottomPA.margin || 0) < 0 ? "border-l-red-500" : "border-l-yellow-500")}>
            <p className="text-xs text-gray-500 mb-1">{(stats.bottomPA.margin || 0) < 0 ? "Operating at a Loss" : "Lowest Margin"}</p>
            <p className="text-lg font-bold text-gray-900 capitalize">{stats.bottomPA.name.replace(/_/g, " ")}</p>
            <p className={cn("text-sm", (stats.bottomPA.margin || 0) < 0 ? "text-red-600" : "text-yellow-600")}>{stats.bottomPA.margin}% net margin</p>
          </Card>
        </div>
      )}

      {/* PA Breakdown */}
      {latest?.practiceAreas && latest.practiceAreas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Practice Area Breakdown</h2>
          <div className="space-y-2">
            {latest.practiceAreas.map((pa) => (
              <Card key={pa.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">{pa.practiceArea.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>{pa.matterCount} matters</span>
                      <span>{pa.totalHours.toFixed(0)}h billed</span>
                      <span>${pa.collected.toLocaleString()} collected</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold", (pa.netMargin || 0) >= 30 ? "text-green-600" : (pa.netMargin || 0) >= 0 ? "text-yellow-600" : "text-red-600")}>
                        {pa.netMargin?.toFixed(1)}%
                      </span>
                      {pa.netMarginDelta && pa.netMarginDelta !== 0 && (
                        <span className={cn("text-xs flex items-center", pa.netMarginDelta > 0 ? "text-green-500" : "text-red-500")}>
                          {pa.netMarginDelta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(pa.netMarginDelta).toFixed(1)}pp
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">Net Margin</p>
                  </div>
                </div>
                {/* Margin bar */}
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", (pa.netMargin || 0) >= 30 ? "bg-green-500" : (pa.netMargin || 0) >= 0 ? "bg-yellow-500" : "bg-red-500")}
                    style={{ width: `${Math.max(0, Math.min(100, (pa.netMargin || 0) + 10))}%` }} />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-[10px] text-gray-400">
                  <span>Billed: ${pa.grossBilled.toLocaleString()}</span>
                  <span>Realization: {pa.realizationRate ? `${(pa.realizationRate * 100).toFixed(0)}%` : "—"}</span>
                  <span>Collection: {pa.collectionRate ? `${(pa.collectionRate * 100).toFixed(0)}%` : "—"}</span>
                  <span>Overhead: ${pa.overheadAllocated.toLocaleString()}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!latest && (
        <Card className="p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No profitability data yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Compute" to analyze your practice areas</p>
        </Card>
      )}
    </div>
  );
}
