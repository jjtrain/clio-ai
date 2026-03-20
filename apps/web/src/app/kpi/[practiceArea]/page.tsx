"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, Calculator, Sparkles } from "lucide-react";

type Period = "this_month" | "this_quarter" | "this_year";

const statusColors: Record<string, string> = {
  KS_ON_TRACK: "border-green-500",
  KS_EXCEEDING: "border-green-500",
  KS_AT_RISK: "border-amber-500",
  KS_BEHIND: "border-red-500",
  KS_NO_DATA: "border-gray-300",
};

function formatValue(value: number | null | undefined, fmt: string | undefined): string {
  if (value == null) return "--";
  if (!fmt) return String(value);
  if (fmt.includes("$")) return `$${value.toLocaleString()}`;
  if (fmt.includes("%")) return `${value.toFixed(1)}%`;
  if (fmt.includes("days")) return `${Math.round(value)} days`;
  if (fmt.includes("x")) return `${value.toFixed(1)}x`;
  return String(value);
}

function TrendArrow({ changePercent, changeDirection, targetDirection }: {
  changePercent?: number; changeDirection?: string; targetDirection?: string;
}) {
  if (changePercent == null) return <Minus className="h-4 w-4 text-gray-400" />;
  const isPositive = changeDirection === "up";
  const isGood = targetDirection === "up" ? isPositive : !isPositive;
  const color = isGood ? "text-green-600" : "text-red-600";
  const Icon = isPositive ? ArrowUp : ArrowDown;
  return (
    <span className={`flex items-center gap-1 text-sm ${color}`}>
      <Icon className="h-4 w-4" />
      {Math.abs(changePercent).toFixed(1)}%
    </span>
  );
}

function StatCard({ kpi }: { kpi: any }) {
  const border = statusColors[kpi.status] || statusColors.KS_NO_DATA;
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <span className="text-2xl font-bold">{formatValue(kpi.value, kpi.displayFormat)}</span>
        <TrendArrow changePercent={kpi.changePercent} changeDirection={kpi.changeDirection} targetDirection={kpi.targetDirection} />
      </CardContent>
    </Card>
  );
}

function GaugeCard({ kpi }: { kpi: any }) {
  const pct = Math.min(100, Math.max(0, kpi.value ?? 0));
  const r = 40; const c = 2 * Math.PI * r; const offset = c - (pct / 100) * c;
  const border = statusColors[kpi.status] || statusColors.KS_NO_DATA;
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
      <CardContent className="flex justify-center">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            className="text-primary -rotate-90 origin-center" />
          <text x="50" y="54" textAnchor="middle" className="text-sm font-bold fill-foreground">{pct.toFixed(0)}%</text>
        </svg>
      </CardContent>
    </Card>
  );
}

function BarChartCard({ kpi }: { kpi: any }) {
  const items: { label: string; value: number }[] = kpi.segments ?? [];
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <Card className="col-span-2">
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-24 text-xs truncate">{item.label}</span>
            <div className="flex-1 bg-muted rounded h-4">
              <div className="bg-primary rounded h-4" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <span className="text-xs w-12 text-right">{formatValue(item.value, kpi.displayFormat)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PieChartCard({ kpi }: { kpi: any }) {
  const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-red-500", "bg-purple-500"];
  const items: { label: string; value: number }[] = kpi.segments ?? [];
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className={`h-3 w-3 rounded-full ${colors[i % colors.length]}`} />
            <span className="flex-1">{item.label}</span>
            <span>{((item.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FunnelCard({ kpi }: { kpi: any }) {
  const items: { label: string; value: number }[] = kpi.segments ?? [];
  const max = items[0]?.value || 1;
  return (
    <Card className="col-span-2">
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="bg-primary/80 text-primary-foreground text-xs py-1 rounded text-center"
              style={{ width: `${(item.value / max) * 100}%` }}>{item.label}: {item.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TableCard({ kpi }: { kpi: any }) {
  const rows: Record<string, any>[] = kpi.rows ?? [];
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <Card className="col-span-2">
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
      <CardContent className="overflow-auto">
        <table className="w-full text-xs">
          <thead><tr>{cols.map((c) => <th key={c} className="text-left p-1 border-b font-medium">{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="p-1 border-b">{String(r[c] ?? "")}</td>)}</tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function KPIWidget({ kpi }: { kpi: any }) {
  switch (kpi.widgetType) {
    case "KW_GAUGE": return <GaugeCard kpi={kpi} />;
    case "KW_PIE_CHART": return <PieChartCard kpi={kpi} />;
    case "KW_BAR_CHART": return <BarChartCard kpi={kpi} />;
    case "KW_FUNNEL": return <FunnelCard kpi={kpi} />;
    case "KW_TABLE": return <TableCard kpi={kpi} />;
    default: return <StatCard kpi={kpi} />;
  }
}

export default function PracticeDashboardPage() {
  const { practiceArea } = useParams<{ practiceArea: string }>();
  const [period, setPeriod] = useState<Period>("this_month");
  const dashboardQuery = trpc.practiceKPIs["dashboards.getForPracticeArea"].useQuery({ practiceArea });
  const dashboardData = Array.isArray(dashboardQuery.data) ? dashboardQuery.data[0] : dashboardQuery.data;
  const dashboardId = (dashboardData as any)?.id;
  const snapshots = trpc.practiceKPIs["snapshots.getLatest"].useQuery(
    { dashboardId: dashboardId! }, { enabled: !!dashboardId }
  );
  const calcMutation = trpc.practiceKPIs["calculate.dashboard"].useMutation();
  const aiInsight = snapshots.data?.find((s: any) => s.aiInsight)?.aiInsight;
  const grouped = (snapshots.data ?? []).reduce<Record<string, any[]>>((acc, s: any) => {
    const cat = s.category || "General";
    (acc[cat] ??= []).push(s);
    return acc;
  }, {});
  const title = practiceArea?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title} KPIs</h1>
          <p className="text-muted-foreground">Performance metrics and insights</p>
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
          <Button onClick={() => dashboardId && calcMutation.mutate({ dashboardId, period })} disabled={!dashboardId || calcMutation.isPending}>
            <Calculator className="mr-2 h-4 w-4" />
            {calcMutation.isPending ? "Calculating..." : "Calculate KPIs"}
          </Button>
        </div>
      </div>

      {aiInsight && (
        <Card className="border-purple-500 border-l-4">
          <CardHeader className="pb-1 flex flex-row items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">AI Insights</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{aiInsight}</p></CardContent>
        </Card>
      )}

      {dashboardQuery.isLoading && <p className="text-muted-foreground">Loading dashboard...</p>}

      {Object.entries(grouped).map(([category, kpis]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-3">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpis.map((kpi: any, i: number) => <KPIWidget key={i} kpi={kpi} />)}
          </div>
        </div>
      ))}

      {!dashboardQuery.isLoading && !snapshots.data?.length && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No KPI data yet. Click &quot;Calculate KPIs&quot; to generate a snapshot.
        </CardContent></Card>
      )}
    </div>
  );
}
