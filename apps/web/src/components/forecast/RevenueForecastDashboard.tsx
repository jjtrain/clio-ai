"use client";

import { TrendingUp, DollarSign, Target, Sparkles, RefreshCw, BarChart3, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const confidenceColors: Record<string, string> = { confirmed: "bg-green-500", probable: "bg-blue-400", possible: "bg-gray-300" };

export function RevenueForecastDashboard() {
  const { data: dashData } = trpc.revenueForecast.getDashboardStats.useQuery();
  const { data: assumptions } = trpc.revenueForecast.getAssumptions.useQuery();
  const generateMutation = trpc.revenueForecast.generateForecast.useMutation();

  const forecast = dashData?.forecast;
  const goals = dashData?.goals || [];
  const history = dashData?.recentRevenue || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-blue-600" />
            Revenue Forecast
          </h1>
          <p className="text-sm text-gray-500 mt-1">Projected revenue with confidence bands, goal tracking, and AI insights</p>
        </div>
        <Button onClick={() => generateMutation.mutate({})} disabled={generateMutation.isLoading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", generateMutation.isLoading && "animate-spin")} />
          Generate Forecast
        </Button>
      </div>

      {/* Headline Numbers */}
      {forecast && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50">
            <p className="text-3xl font-bold text-gray-900">${Math.round(forecast.totalProjectedRevenue).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Projected Revenue</p>
            <p className="text-[10px] text-gray-400">${Math.round(forecast.totalProjectedLow).toLocaleString()} — ${Math.round(forecast.totalProjectedHigh).toLocaleString()}</p>
          </Card>
          <Card className="p-5">
            <p className="text-2xl font-bold text-green-600">${Math.round(forecast.totalConfirmed).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Confirmed</p>
          </Card>
          <Card className="p-5">
            <p className="text-2xl font-bold text-blue-600">${Math.round(forecast.totalProbable).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Probable</p>
          </Card>
          <Card className="p-5">
            <p className="text-2xl font-bold text-gray-400">${Math.round(forecast.totalPossible).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Possible</p>
          </Card>
        </div>
      )}

      {/* Confidence Bar */}
      {forecast && forecast.totalProjectedRevenue > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Confidence Breakdown</h2>
          <div className="h-6 rounded-full overflow-hidden flex">
            <div className="bg-green-500 transition-all" style={{ width: `${(forecast.totalConfirmed / forecast.totalProjectedRevenue) * 100}%` }} />
            <div className="bg-blue-400 transition-all" style={{ width: `${(forecast.totalProbable / forecast.totalProjectedRevenue) * 100}%` }} />
            <div className="bg-gray-300 transition-all" style={{ width: `${(forecast.totalPossible / forecast.totalProjectedRevenue) * 100}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> Confirmed ({Math.round((forecast.totalConfirmed / forecast.totalProjectedRevenue) * 100)}%)</span>
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Probable ({Math.round((forecast.totalProbable / forecast.totalProjectedRevenue) * 100)}%)</span>
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-gray-300" /> Possible ({Math.round((forecast.totalPossible / forecast.totalProjectedRevenue) * 100)}%)</span>
          </div>
        </Card>
      )}

      {/* AI Insights */}
      {forecast?.aiInsights && (
        <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-100">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-purple-700 mb-1">AI Insights</p>
              <p className="text-sm text-gray-700 leading-relaxed">{forecast.aiInsights}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-gray-400" /> Goals</h2>
          <div className="space-y-2">
            {goals.map((goal) => {
              const pct = goal.goalAmount > 0 ? (goal.actualAmount / goal.goalAmount) * 100 : 0;
              const color = pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
              return (
                <Card key={goal.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{goal.period} — {goal.practiceArea?.replace(/_/g, " ") || "Firm-Wide"}</span>
                    <span className="text-xs text-gray-500">${goal.actualAmount.toLocaleString()} / ${goal.goalAmount.toLocaleString()} ({Math.round(pct)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Historical Revenue */}
      {history.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-gray-400" /> Recent Revenue</h2>
          <div className="flex items-end gap-2 h-32">
            {history.reverse().map((h) => {
              const maxAmount = Math.max(...history.map((r) => r.amount));
              const height = maxAmount > 0 ? (h.amount / maxAmount) * 100 : 10;
              return (
                <div key={h.id} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-gray-600">${(h.amount / 1000).toFixed(0)}k</span>
                  <div className="w-full bg-blue-500 rounded-t-md" style={{ height: `${height}%` }} />
                  <span className="text-[9px] text-gray-400">{h.period.split("-")[1]}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Data Points Preview */}
      {forecast?.dataPoints && forecast.dataPoints.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Revenue Drivers</h2>
          <div className="space-y-1.5">
            {forecast.dataPoints.slice(0, 8).map((dp) => (
              <Card key={dp.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("h-2.5 w-2.5 rounded-full", confidenceColors[dp.confidence])} />
                  <div>
                    <p className="text-sm text-gray-900">{dp.description}</p>
                    <p className="text-xs text-gray-400">{dp.source.replace(/_/g, " ")} · {dp.projectedMonth}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${dp.amount.toLocaleString()}</p>
                  <Badge className={cn("text-[10px]", dp.confidence === "confirmed" ? "bg-green-100 text-green-700" : dp.confidence === "probable" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600")}>{dp.confidence}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
