"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  ArrowUpDown,
  BarChart3,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Dimension = "ATTORNEY" | "PRACTICE_AREA" | "CLIENT" | "MATTER_TYPE";

const DIMENSION_LABELS: Record<Dimension, string> = {
  ATTORNEY: "Attorney",
  PRACTICE_AREA: "Practice Area",
  CLIENT: "Client",
  MATTER_TYPE: "Matter Type",
};

const PERIOD_OPTIONS = [
  { value: "current", label: "Current Month" },
  { value: "qtd", label: "Quarter to Date" },
  { value: "ytd", label: "Year to Date" },
  { value: "trailing12", label: "Trailing 12 Months" },
];

function rateColor(rate: number): string {
  if (rate >= 85) return "text-green-700 bg-green-50";
  if (rate >= 70) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

function rateBg(rate: number): string {
  if (rate >= 85) return "bg-green-500";
  if (rate >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === "improving") return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (trend === "declining") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function RateBar({ rate, label }: { rate: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={cn("font-semibold px-1.5 py-0.5 rounded", rateColor(rate))}>{rate}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", rateBg(rate))} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

export default function RealizationPage() {
  const [activeDimension, setActiveDimension] = useState<Dimension>("ATTORNEY");
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [drillDown, setDrillDown] = useState<{ dimension: Dimension; dimensionId: string; label: string } | null>(null);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const summaryQuery = trpc.realization.getSummary.useQuery({ period: currentPeriod });
  const dimensionQuery = trpc.realization.getByDimension.useQuery({
    dimension: activeDimension,
    period: currentPeriod,
  });
  const trendQuery = trpc.realization.getTrend.useQuery();
  const worstQuery = trpc.realization.getWorstPerformers.useQuery({ period: currentPeriod, limit: 5 });
  const drillDownQuery = trpc.realization.getDrillDown.useQuery(
    { dimension: drillDown?.dimension || "ATTORNEY", dimensionId: drillDown?.dimensionId || "" },
    { enabled: !!drillDown }
  );

  const summary = summaryQuery.data;
  const rows = dimensionQuery.data || [];
  const trend = trendQuery.data || [];
  const worst = worstQuery.data || [];
  const drillRows = drillDownQuery.data || [];

  function trendDelta(currentVal: number, priorVal: number | undefined): string {
    if (!priorVal) return "";
    const diff = currentVal - priorVal;
    if (diff > 0) return `+${diff.toFixed(1)}%`;
    if (diff < 0) return `${diff.toFixed(1)}%`;
    return "—";
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-violet-600" />
            Realization Rate
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track billing and collection efficiency across your firm
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hero Row */}
      {summary?.current && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Billing Realization", value: summary.current.billingRealization, prior: summary.prior?.billingRealization, desc: "Hours billed ÷ Hours worked" },
            { label: "Collection Realization", value: summary.current.collectionRealization, prior: summary.prior?.collectionRealization, desc: "Collected ÷ Billed" },
            { label: "Combined Realization", value: summary.current.combinedRealization, prior: summary.prior?.combinedRealization, desc: "Collected ÷ Potential revenue" },
          ].map((metric) => {
            const delta = metric.prior ? metric.value - metric.prior : 0;
            return (
              <Card key={metric.label} className="p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{metric.label}</p>
                <div className="flex items-end gap-3 mt-2">
                  <span className={cn("text-4xl font-bold", rateColor(metric.value).split(" ")[0])}>
                    {metric.value}%
                  </span>
                  {delta !== 0 && (
                    <span className={cn("text-sm font-medium flex items-center gap-0.5 mb-1", delta > 0 ? "text-green-600" : "text-red-600")}>
                      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {trendDelta(metric.value, metric.prior)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{metric.desc}</p>
                <div className="mt-3">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", rateBg(metric.value))} style={{ width: `${Math.min(metric.value, 100)}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!summary?.current && (
        <Card className="p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No realization data for this period</p>
          <p className="text-xs text-gray-400 mt-1">Run the monthly snapshot to populate data</p>
        </Card>
      )}

      {/* Worst Performers Callout */}
      {worst.length > 0 && (
        <Card className="p-4 border-l-4 border-l-red-500 bg-red-50/30">
          <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Low Realization Alert
          </h3>
          <div className="space-y-1">
            {worst.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  <Badge variant="outline" className="text-[10px] mr-2">{w.dimension.replace(/_/g, " ")}</Badge>
                  {w.dimensionLabel}
                </span>
                <span className={cn("font-semibold px-2 py-0.5 rounded text-xs", rateColor(w.combinedRealizationRate))}>
                  {w.combinedRealizationRate}%
                  {w.severity === "critical" && <AlertCircle className="h-3 w-3 inline ml-1" />}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trend Chart (simple sparkline) */}
      {trend.length > 0 && trend.some((t) => t.combined > 0) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Trailing 12 Months — Combined Realization</h3>
          <div className="flex items-end gap-1 h-24">
            {trend.map((t, i) => {
              const height = t.combined > 0 ? Math.max((t.combined / 100) * 100, 4) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn("w-full rounded-t", t.combined > 0 ? rateBg(t.combined) : "bg-gray-100")}
                    style={{ height: `${height}%` }}
                    title={`${t.period}: ${t.combined}%`}
                  />
                  <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">
                    {t.period.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Dimension Tabs + Table */}
      <div>
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {(Object.entries(DIMENSION_LABELS) as [Dimension, string][]).map(([dim, label]) => (
            <button
              key={dim}
              onClick={() => { setActiveDimension(dim); setDrillDown(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
                activeDimension === dim
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Drill-down view */}
        {drillDown && (
          <Card className="p-4 mb-4 bg-violet-50/50 border-violet-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-violet-800">
                Matter Breakdown: {drillDown.label}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setDrillDown(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {drillRows.length === 0 ? (
              <p className="text-xs text-gray-400">No matter-level data found</p>
            ) : (
              <div className="overflow-auto rounded border border-violet-200">
                <table className="w-full text-xs">
                  <thead className="bg-violet-100/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Matter</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Client</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Hrs Worked</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Hrs Billed</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Billed</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Collected</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Combined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-100">
                    {drillRows.map((r: any) => (
                      <tr key={r.matterId} className="hover:bg-violet-50/50">
                        <td className="px-3 py-2 font-medium text-gray-800">{r.matterName}</td>
                        <td className="px-3 py-2 text-gray-600">{r.clientName}</td>
                        <td className="px-3 py-2 text-right">{r.hoursWorked}</td>
                        <td className="px-3 py-2 text-right">{r.hoursBilled}</td>
                        <td className="px-3 py-2 text-right">${r.amountBilled.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">${r.amountCollected.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-semibold", rateColor(r.combinedRealization))}>
                            {r.combinedRealization}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Main Dimension Table */}
        {rows.length > 0 ? (
          <div className="overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{DIMENSION_LABELS[activeDimension]}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Hrs Worked</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Hrs Billed</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Billed</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Collected</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Billing %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Collection %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Combined %</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Trend</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.severity === "critical" && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                        {row.severity === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                        <span className="font-medium text-gray-900">{row.dimensionLabel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.hoursWorked}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.hoursBilled}</td>
                    <td className="px-4 py-3 text-right text-gray-700">${row.amountBilled.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">${row.amountCollected.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", rateColor(row.billingRealizationRate))}>
                        {row.billingRealizationRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", rateColor(row.collectionRealizationRate))}>
                        {row.collectionRealizationRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", rateColor(row.combinedRealizationRate))}>
                        {row.combinedRealizationRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TrendIcon trend={row.trend} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDrillDown({ dimension: activeDimension, dimensionId: row.dimensionId, label: row.dimensionLabel })}
                        className="text-violet-500 hover:text-violet-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <ArrowUpDown className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No realization data for {DIMENSION_LABELS[activeDimension]}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
