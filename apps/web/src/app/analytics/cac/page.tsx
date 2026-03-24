"use client";

import { useState } from "react";
import { DollarSign, TrendingDown, Users, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function CACDashboardPage() {
  const now = new Date();
  const [period] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const { data: firmWide } = trpc.cac.getFirmWide.useQuery({ period });
  const { data: byPA } = trpc.cac.getByPracticeArea.useQuery({ period });
  const { data: trend } = trpc.cac.getTrend.useQuery({ months: 6 });
  const { data: sources } = trpc.cac.getSourceBreakdown.useQuery({ period });
  const computeMutation = trpc.cac.compute.useMutation();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-blue-600" />
            Client Acquisition Cost
          </h1>
          <p className="text-sm text-gray-500 mt-1">How much does it cost to acquire a new client, by practice area and source</p>
        </div>
        <Button variant="outline" onClick={() => computeMutation.mutate({ period })} disabled={computeMutation.isLoading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", computeMutation.isLoading && "animate-spin")} /> Compute {period}
        </Button>
      </div>

      {/* Firm-Wide Summary */}
      {firmWide && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50">
            <p className="text-3xl font-bold text-gray-900">${firmWide.cac?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "—"}</p>
            <p className="text-xs text-gray-500 mt-1">Firm-Wide CAC</p>
          </Card>
          <Card className="p-5">
            <p className="text-2xl font-bold text-gray-900">${firmWide.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-gray-500">Total Spend</p>
          </Card>
          <Card className="p-5">
            <p className="text-2xl font-bold text-green-600">{firmWide.newClients}</p>
            <p className="text-xs text-gray-500">New Clients</p>
          </Card>
          <Card className="p-5">
            <p className="text-2xl font-bold text-purple-600">{firmWide.ltvToCacRatio?.toFixed(1) || "—"}x</p>
            <p className="text-xs text-gray-500">LTV:CAC Ratio</p>
          </Card>
        </div>
      )}

      {/* CAC by Practice Area — Bar Chart */}
      {byPA && byPA.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gray-400" /> CAC by Practice Area
          </h2>
          <div className="space-y-3">
            {byPA.map((pa) => {
              const maxCAC = Math.max(...byPA.map((p) => p.cac || 0));
              const barWidth = pa.cac && maxCAC > 0 ? (pa.cac / maxCAC) * 100 : 0;
              const isGood = pa.ltvToCacRatio && pa.ltvToCacRatio >= 3;
              return (
                <div key={pa.id} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 w-40 truncate capitalize">{(pa.practiceArea || "").replace(/_/g, " ")}</span>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isGood ? "bg-green-500" : "bg-orange-500")}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-32">
                    <span className="text-sm font-bold text-gray-900">${pa.cac?.toFixed(0) || "—"}</span>
                    <span className="text-[10px] text-gray-400 ml-1">/ client</span>
                  </div>
                  <div className="w-16 text-right">
                    <Badge className={cn("text-[10px]", (pa.ltvToCacRatio || 0) >= 3 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                      {pa.ltvToCacRatio?.toFixed(1) || "—"}x
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* CAC Trend Over Time */}
      {trend && trend.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-gray-400" /> CAC Trend (Monthly)
          </h2>
          <div className="flex items-end gap-3 h-32">
            {trend.reverse().map((t) => {
              const maxCAC = Math.max(...trend.map((x) => x.cac || 0));
              const height = t.cac && maxCAC > 0 ? (t.cac / maxCAC) * 100 : 5;
              return (
                <div key={t.id} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-gray-600">${t.cac?.toFixed(0) || "—"}</span>
                  <div className="w-full bg-blue-500 rounded-t-md" style={{ height: `${height}%` }} />
                  <span className="text-[9px] text-gray-400">{t.period.split("-")[1]}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Source Breakdown Table */}
      {sources && sources.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" /> Source Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium text-right">Spend</th>
                  <th className="pb-2 font-medium text-right">Clients</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">CAC</th>
                  <th className="pb-2 font-medium text-right">Rev/Client</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2.5 font-medium text-gray-900 capitalize">{s.source.replace(/_/g, " ")}</td>
                    <td className="py-2.5 text-right text-gray-600">${s.spend.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-gray-600">{s.clients}</td>
                    <td className="py-2.5 text-right text-gray-600">${s.revenue.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-semibold">
                      {s.cac ? `$${s.cac.toFixed(0)}` : "—"}
                    </td>
                    <td className="py-2.5 text-right text-gray-600">${s.revenuePerClient.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!firmWide && !byPA?.length && (
        <Card className="p-12 text-center">
          <DollarSign className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No CAC data yet</p>
          <p className="text-xs text-gray-400 mt-1">Add marketing spend entries and click Compute</p>
        </Card>
      )}
    </div>
  );
}
