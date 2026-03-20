"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Sparkles } from "lucide-react";

type Period = "this_month" | "this_quarter" | "this_year";

const metricFmt: Record<string, (v: number) => string> = {
  revenue: (v) => `$${(v / 1000).toFixed(0)}K`,
  cases: (v) => String(v),
  avgDuration: (v) => `${Math.round(v)} days`,
  collectionRate: (v) => `${v.toFixed(1)}%`,
};

function colorFor(value: number, metric: string): string {
  if (metric === "collectionRate") return value >= 90 ? "text-green-600" : value >= 75 ? "text-amber-600" : "text-red-600";
  if (metric === "avgDuration") return value <= 90 ? "text-green-600" : value <= 180 ? "text-amber-600" : "text-red-600";
  return "text-foreground";
}

export default function ComparePage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const comparison = trpc.practiceKPIs["ai.comparePracticeAreas"].useQuery({ period });
  const areas: any[] = comparison.data?.areas ?? [];
  const aiAnalysis = comparison.data?.analysis;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Practice Areas</h1>
          <p className="text-muted-foreground">Side-by-side performance comparison across the firm</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={comparison.isLoading} onClick={() => comparison.refetch()}>
            <BarChart3 className="mr-2 h-4 w-4" />Generate AI Analysis
          </Button>
        </div>
      </div>

      {aiAnalysis && (
        <Card className="border-purple-500 border-l-4">
          <CardHeader className="pb-1 flex flex-row items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">AI Comparative Analysis</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{aiAnalysis}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Practice Area Performance</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium">Practice Area</th>
                <th className="text-right py-3 px-4 font-medium">Revenue</th>
                <th className="text-right py-3 px-4 font-medium">Cases</th>
                <th className="text-right py-3 px-4 font-medium">Avg Duration</th>
                <th className="text-right py-3 px-4 font-medium">Collection Rate</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area: any) => (
                <tr key={area.name} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">{area.name}</td>
                  {(["revenue", "cases", "avgDuration", "collectionRate"] as const).map((m) => (
                    <td key={m} className={`py-3 px-4 text-right font-mono ${colorFor(area[m], m)}`}>
                      {metricFmt[m](area[m])}
                    </td>
                  ))}
                </tr>
              ))}
              {!areas.length && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">
                  {comparison.isLoading ? "Loading comparison data..." : "No comparison data available."}
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
