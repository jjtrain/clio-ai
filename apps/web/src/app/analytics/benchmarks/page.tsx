"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight, Users, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const metricLabels: Record<string, { label: string; unit: string; lowerIsBetter: boolean }> = {
  avg_case_duration_days: { label: "Avg Case Duration", unit: " days", lowerIsBetter: true },
  avg_matter_revenue: { label: "Avg Matter Revenue", unit: "", lowerIsBetter: false },
  collection_rate: { label: "Collection Rate", unit: "%", lowerIsBetter: false },
  avg_days_to_first_invoice: { label: "Days to First Invoice", unit: " days", lowerIsBetter: true },
  cac: { label: "Client Acquisition Cost", unit: "", lowerIsBetter: true },
};

function formatValue(metric: string, value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  if (metric === "avg_matter_revenue" || metric === "cac") return `$${Math.round(value).toLocaleString()}`;
  if (metric === "collection_rate") return `${value.toFixed(1)}%`;
  return `${Math.round(value)}`;
}

export default function BenchmarksPage() {
  const now = new Date();
  const [period] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const comparisonQuery = trpc.benchmarks.getComparison.useQuery({ period });
  const snapshotMut = trpc.benchmarks.snapshotFirm.useMutation();
  const rebuildMut = trpc.benchmarks.rebuildPlatform.useMutation();

  const comparison = comparisonQuery.data || [];

  // Group by practice area
  const practiceAreas = Array.from(new Set(comparison.map((c) => c.practiceArea)));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Firm Benchmarks
          </h1>
          <p className="text-sm text-gray-500 mt-1">See how your firm compares to anonymous platform averages</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => snapshotMut.mutate({ period })} disabled={snapshotMut.isLoading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", snapshotMut.isLoading && "animate-spin")} /> Snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={() => rebuildMut.mutate({ period })} disabled={rebuildMut.isLoading}>
            Rebuild Benchmarks
          </Button>
        </div>
      </div>

      {/* Headline Insights */}
      {comparison.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {comparison.slice(0, 3).map((c) => {
            const meta = metricLabels[c.metric] || { label: c.metric, unit: "", lowerIsBetter: false };
            const isBetter = meta.lowerIsBetter ? (c.firmValue || 0) < c.median : (c.firmValue || 0) > c.median;
            return (
              <Card key={`${c.metric}-${c.practiceArea}`} className="p-4">
                <p className="text-xs text-gray-500 mb-1 capitalize">{c.practiceArea.replace(/_/g, " ")} — {meta.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{formatValue(c.metric, c.firmValue)}</span>
                  {isBetter ? <ArrowUpRight className="h-4 w-4 text-green-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                </div>
                <p className="text-xs text-gray-400 mt-1">Platform median: {formatValue(c.metric, c.median)}</p>
                {c.percentileRank && (
                  <Badge className={cn("text-[10px] mt-1", c.percentileRank >= 70 ? "bg-green-100 text-green-700" : c.percentileRank >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                    Top {100 - c.percentileRank}%
                  </Badge>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detailed Benchmarks by PA */}
      {practiceAreas.map((pa) => {
        const paMetrics = comparison.filter((c) => c.practiceArea === pa);
        return (
          <Card key={pa} className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 capitalize">{pa.replace(/_/g, " ")}</h2>
            <div className="space-y-4">
              {paMetrics.map((c) => {
                const meta = metricLabels[c.metric] || { label: c.metric, unit: "", lowerIsBetter: false };
                const firmVal = c.firmValue || 0;
                const maxVal = Math.max(firmVal, c.p75) * 1.2 || 100;
                const firmPct = (firmVal / maxVal) * 100;
                const p25Pct = (c.p25 / maxVal) * 100;
                const medianPct = (c.median / maxVal) * 100;
                const p75Pct = (c.p75 / maxVal) * 100;

                return (
                  <div key={c.metric}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{meta.label}</span>
                      <span className="text-xs text-gray-400">
                        You: <span className="font-semibold text-gray-700">{formatValue(c.metric, c.firmValue)}</span>
                        {" · "}Median: {formatValue(c.metric, c.median)}
                      </span>
                    </div>
                    {/* Distribution gauge */}
                    <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                      {/* P25-P75 range band */}
                      <div className="absolute top-0 bottom-0 bg-blue-100 rounded-full" style={{ left: `${p25Pct}%`, width: `${p75Pct - p25Pct}%` }} />
                      {/* Median line */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${medianPct}%` }} />
                      {/* Firm marker */}
                      <div className="absolute top-0.5 bottom-0.5 w-3 rounded-full bg-gray-900 border-2 border-white" style={{ left: `${Math.min(firmPct, 97)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-0.5 text-[9px] text-gray-400">
                      <span>P25: {formatValue(c.metric, c.p25)}</span>
                      <span>P75: {formatValue(c.metric, c.p75)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-300 mt-3 flex items-center gap-1">
              <Users className="h-3 w-3" /> Based on anonymous data from {paMetrics[0]?.sampleSize || 0} firms
            </p>
          </Card>
        );
      })}

      {comparison.length === 0 && (
        <Card className="p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No benchmark data yet</p>
          <p className="text-xs text-gray-400 mt-1">Click Snapshot then Rebuild to generate benchmarks</p>
        </Card>
      )}
    </div>
  );
}
