"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from "recharts";

function fmtVal(v: number, unit: string) { return unit === "%" ? `${v.toFixed(1)}%` : unit === "days" ? `${v} days` : `$${v.toLocaleString()}`; }

export default function BenchmarksPage() {
  const { toast } = useToast();
  const now = new Date();
  const [period] = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`);

  const { data: benchmarks, isLoading, refetch } = trpc.finInsights["reports.benchmark"].useQuery({ period }, { retry: false });
  const { data: pwcConfig } = trpc.finInsights["settings.get"].useQuery({ provider: "PWC_INSIGHTS" });

  const radarData = (benchmarks || []).map((b: any) => ({
    metric: b.metric,
    firm: Math.min(b.firmValue, 100),
    benchmark: Math.min(b.benchmarkValue, 100),
  }));

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "above") return <ArrowUp className="h-4 w-4 text-emerald-500" />;
    if (status === "below") return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-amber-500" />;
  };

  const statusColor = (status: string) => status === "above" ? "text-emerald-600" : status === "below" ? "text-red-600" : "text-amber-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Benchmark Comparison</h1>
          <p className="text-sm text-slate-500">Compare your firm against industry benchmarks</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {!pwcConfig?.isEnabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700">Connect PwC InsightsOfficer for more detailed, industry-specific benchmarks. Currently using built-in benchmark data.</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
        <>
          {/* Radar Chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Performance Radar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis />
                  <Radar name="Your Firm" dataKey="firm" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                  <Radar name="Benchmark" dataKey="benchmark" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Benchmark Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Detailed Comparison</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-gray-500">Metric</th>
                    <th className="pb-2 font-medium text-gray-500 text-right">Your Firm</th>
                    <th className="pb-2 font-medium text-gray-500 text-right">Benchmark</th>
                    <th className="pb-2 font-medium text-gray-500 text-right">Percentile</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(benchmarks || []).map((b: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 font-medium">{b.metric}</td>
                      <td className="py-3 text-right">{fmtVal(b.firmValue, b.unit)}</td>
                      <td className="py-3 text-right text-gray-500">{fmtVal(b.benchmarkValue, b.unit)}</td>
                      <td className="py-3 text-right">{b.percentile}th</td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <StatusIcon status={b.status} />
                          <span className={`text-xs font-medium ${statusColor(b.status)}`}>{b.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
