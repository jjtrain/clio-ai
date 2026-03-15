"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Target,
  Percent,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Save,
  Trash2,
  BarChart3,
  Zap,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

// ── Colors ──────────────────────────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  "Google Ads": "#4285F4", "Facebook Ads": "#1877F2", "Bing Ads": "#00809D",
  Avvo: "#D4380D", "Lawyer.com": "#6B21A8", FindLaw: "#15803D", Justia: "#B45309",
  SEO: "#0891B2", "Direct Mail": "#9333EA", Referral: "#059669", Website: "#2563EB",
  INTAKE_FORM: "#8B5CF6", LIVE_CHAT: "#06B6D4", CONTACT_FORM: "#3B82F6",
  MANUAL: "#64748B", REFERRAL: "#10B981", WEBSITE: "#2563EB", PHONE: "#F59E0B", OTHER: "#94A3B8",
};
const PALETTE = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#F97316", "#64748B", "#4285F4", "#1877F2", "#D4380D"];

function getSourceColor(source: string, idx?: number) {
  return SOURCE_COLORS[source] || PALETTE[(idx || 0) % PALETTE.length];
}

// ── Formatters ──────────────────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtCurrencyFull(v: number) { return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }
function fmtNum(v: number) { return v.toLocaleString("en-US", { maximumFractionDigits: 1 }); }

function roiBadge(roi: number) {
  if (roi > 200) return "bg-green-100 text-green-700";
  if (roi > 100) return "bg-blue-100 text-blue-700";
  if (roi > 50) return "bg-amber-100 text-amber-700";
  if (roi > 0) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

// ── KPI Card (reused) ───────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string; value: string | number; format?: "currency" | "percentage" | "number";
  change?: number; changeLabel?: string; status?: "good" | "warning" | "bad" | "neutral";
  icon?: React.ElementType; invertChange?: boolean;
}
function KpiCard({ title, value, format, change, changeLabel, status = "neutral", icon: Icon, invertChange }: KpiCardProps) {
  const formatted = format === "currency" ? fmtCurrency(Number(value)) : format === "percentage" ? fmtPct(Number(value)) : fmtNum(Number(value));
  const border = status === "good" ? "border-l-emerald-500" : status === "warning" ? "border-l-amber-500" : status === "bad" ? "border-l-red-500" : "border-l-blue-500";
  const bg = status === "good" ? "bg-emerald-50/50" : status === "warning" ? "bg-amber-50/50" : status === "bad" ? "bg-red-50/50" : "bg-white";
  const isPos = change !== undefined && (invertChange ? change < 0 : change > 0);
  const isNeg = change !== undefined && (invertChange ? change > 0 : change < 0);
  return (
    <div className={`rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 ${border} ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </div>
      <p className="text-2xl font-bold text-gray-900">{formatted}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1.5">
          {isPos ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : isNeg ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" /> : null}
          <span className={`text-xs font-medium ${isPos ? "text-emerald-600" : isNeg ? "text-red-600" : "text-gray-500"}`}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>
          {changeLabel && <span className="text-xs text-gray-400">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium text-gray-900">{currency ? fmtCurrencyFull(p.value) : fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
}

// ── Date Presets ─────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "This Quarter", days: -1 },
  { label: "This Year", days: -2 },
] as const;

function getPresetRange(p: (typeof PRESETS)[number]) {
  const now = new Date();
  if (p.days === -1) { const qm = Math.floor(now.getMonth() / 3) * 3; return { start: new Date(now.getFullYear(), qm, 1), end: now }; }
  if (p.days === -2) return { start: new Date(now.getFullYear(), 0, 1), end: now };
  return { start: new Date(now.getTime() - p.days * 86400000), end: now };
}

// ── SPEND EDITOR SOURCES ────────────────────────────────────────────────────────
const SPEND_SOURCES = ["Google Ads", "Facebook Ads", "Bing Ads", "Avvo", "Lawyer.com", "FindLaw", "Justia", "SEO", "Direct Mail", "Referral Program", "Website Hosting", "Other"];

// ── MAIN PAGE ───────────────────────────────────────────────────────────────────
export default function MarketingRoiPage() {
  const [activePreset, setActivePreset] = useState(1);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { startDate, endDate } = useMemo(() => {
    const range = getPresetRange(PRESETS[activePreset]);
    return { startDate: range.start.toISOString(), endDate: range.end.toISOString() };
  }, [activePreset]);

  const dateInput = { startDate, endDate };

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: overview, isLoading: loadingOverview } = trpc.marketingRoi.overview.useQuery(dateInput);
  const { data: bySource } = trpc.marketingRoi.roiBySource.useQuery(dateInput);
  const { data: byChannel } = trpc.marketingRoi.roiByChannel.useQuery(dateInput);
  const { data: leadTrend } = trpc.marketingRoi.leadSourceTrend.useQuery({ months: 12 });
  const { data: convTrend } = trpc.marketingRoi.conversionTrend.useQuery({ months: 12 });
  const { data: ltv } = trpc.marketingRoi.clientLifetimeValue.useQuery(dateInput);
  const { data: projections } = trpc.marketingRoi.projections.useQuery();
  const { data: intakeForms } = trpc.marketingRoi.intakeFormRoi.useQuery();
  const { data: campaignData } = trpc.marketingRoi.campaignRoi.useQuery();
  const { data: spendList, isLoading: loadingSpend } = trpc.marketingRoi.listSpend.useQuery();

  // ── Spend editor state ──────────────────────────────────────────────────
  const now = new Date();
  const [spendMonth, setSpendMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [spendAmounts, setSpendAmounts] = useState<Record<string, string>>({});

  const bulkAdd = trpc.marketingRoi.bulkAddSpend.useMutation({
    onSuccess: () => { toast({ title: "Spend saved" }); utils.marketingRoi.invalidate(); },
  });
  const deleteSpend = trpc.marketingRoi.deleteSpend.useMutation({
    onSuccess: () => { toast({ title: "Deleted" }); utils.marketingRoi.invalidate(); },
  });

  const handleSaveSpend = () => {
    const items = Object.entries(spendAmounts)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([source, amount]) => ({ source, amount: parseFloat(amount), period: spendMonth }));
    if (items.length === 0) { toast({ title: "Enter at least one amount", variant: "destructive" }); return; }
    bulkAdd.mutate(items);
  };

  // ── Prepare trend chart data ────────────────────────────────────────────
  const allSources = useMemo(() => {
    if (!leadTrend) return [];
    const s = new Set<string>();
    for (const m of leadTrend) { for (const src of Object.keys(m.sources)) s.add(src); }
    return Array.from(s);
  }, [leadTrend]);

  const trendChartData = useMemo(() => {
    if (!leadTrend) return [];
    return leadTrend.map((m) => ({ month: m.month, ...m.sources }));
  }, [leadTrend]);

  // ── Lead source donut data ──────────────────────────────────────────────
  const sourceDonutData = useMemo(() => {
    if (!bySource) return [];
    return bySource.filter((s) => s.leads > 0).map((s) => ({ name: s.source, value: s.leads }));
  }, [bySource]);

  // ── Funnel data ─────────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    if (!overview) return [];
    // Use a simple estimate for contacted/qualified
    const total = overview.totalLeads;
    const contacted = Math.round(total * 0.7);
    const qualified = Math.round(total * 0.4);
    const converted = overview.totalConversions;
    return [
      { stage: "Total Leads", count: total, pct: 100 },
      { stage: "Contacted", count: contacted, pct: total > 0 ? Math.round((contacted / total) * 100) : 0 },
      { stage: "Qualified", count: qualified, pct: total > 0 ? Math.round((qualified / total) * 100) : 0 },
      { stage: "Converted", count: converted, pct: total > 0 ? Math.round((converted / total) * 100) : 0 },
    ];
  }, [overview]);

  const prev = overview?.previousPeriod;

  // ── Spend trend chart ───────────────────────────────────────────────────
  const spendTrendData = useMemo(() => {
    if (!spendList) return [];
    const byMonth: Record<string, Record<string, number>> = {};
    const sources = new Set<string>();
    for (const r of spendList) {
      if (!byMonth[r.period]) byMonth[r.period] = {};
      byMonth[r.period][r.source] = toNum(r.amount);
      sources.add(r.source);
    }
    return { data: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, s]) => ({ month, ...s })), sources: Array.from(sources) };
  }, [spendList]);

  function toNum(v: any) { return typeof v === "number" ? v : parseFloat(v?.toString()) || 0; }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Marketing ROI</h1>
          <p className="text-gray-500 mt-1 text-sm">Track spend, measure lead generation, and optimize marketing performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p, i) => (
            <Button key={p.label} size="sm" variant={activePreset === i ? "default" : "outline"} className={activePreset === i ? "bg-blue-500 hover:bg-blue-600" : ""} onClick={() => setActivePreset(i)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white">Overview</TabsTrigger>
          <TabsTrigger value="bySource" className="data-[state=active]:bg-white">By Source</TabsTrigger>
          <TabsTrigger value="spend" className="data-[state=active]:bg-white">Spend Tracking</TabsTrigger>
        </TabsList>

        {/* ════════════════ OVERVIEW TAB ════════════════ */}
        <TabsContent value="overview">
          {loadingOverview ? <Loading /> : overview && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiCard title="Marketing Spend" value={overview.totalSpend} format="currency" change={prev?.spendChange} changeLabel="vs prev" icon={DollarSign} />
                <KpiCard title="Total Leads" value={overview.totalLeads} format="number" change={prev?.leadsChange} changeLabel="vs prev" status="good" icon={Users} />
                <KpiCard title="Cost Per Lead" value={overview.costPerLead} format="currency" change={prev?.cplChange} invertChange icon={Target} status={overview.costPerLead < 100 ? "good" : overview.costPerLead < 300 ? "warning" : "bad"} />
                <KpiCard title="Conversion Rate" value={overview.conversionRate} format="percentage" change={prev?.conversionRateChange} status={overview.conversionRate > 20 ? "good" : overview.conversionRate > 10 ? "warning" : "bad"} icon={Percent} />
                <KpiCard title="Cost Per Acquisition" value={overview.costPerConversion} format="currency" change={prev?.cpaChange} invertChange icon={DollarSign} />
                <KpiCard title="Marketing ROI" value={overview.roi} format="percentage" change={prev?.roiChange} status={overview.roi > 100 ? "good" : overview.roi > 50 ? "warning" : "bad"} icon={TrendingUp} />
              </div>

              {/* Lead Generation Trend */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Lead Generation Trend</h3>
                {trendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={trendChartData}>
                      <defs>
                        {allSources.map((s, i) => (
                          <linearGradient key={s} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={getSourceColor(s, i)} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={getSourceColor(s, i)} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      {allSources.map((s, i) => (
                        <Area key={s} type="monotone" dataKey={s} stackId="1" stroke={getSourceColor(s, i)} fill={`url(#grad-${i})`} strokeWidth={1.5} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-gray-400 py-10">No lead data yet</p>}
              </div>

              {/* Two charts row */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Leads by Source Donut */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Leads by Source</h3>
                  {sourceDonutData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={sourceDonutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} label={(props: any) => `${props.name}: ${props.value}`}>
                          {sourceDonutData.map((d, i) => <Cell key={i} fill={getSourceColor(d.name, i)} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 py-10">No data</p>}
                </div>

                {/* Conversion Funnel */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
                  <div className="space-y-3 py-4">
                    {funnelData.map((step, i) => {
                      const maxWidth = 100;
                      const width = Math.max(step.pct, 8);
                      const colors = ["bg-blue-500", "bg-blue-400", "bg-emerald-400", "bg-emerald-500"];
                      return (
                        <div key={step.stage}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{step.stage}</span>
                            <span className="text-gray-500">{step.count} <span className="text-xs text-gray-400">({step.pct}%)</span></span>
                          </div>
                          <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                            <div className={`h-full rounded-lg ${colors[i]} transition-all flex items-center justify-center`} style={{ width: `${width}%` }}>
                              {width > 15 && <span className="text-xs font-medium text-white">{step.count}</span>}
                            </div>
                          </div>
                          {i < funnelData.length - 1 && funnelData[i + 1] && step.count > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5 text-right">
                              {Math.round(((step.count - funnelData[i + 1].count) / step.count) * 100)}% drop-off
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Conversion Rate Trend */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Conversion Rate Trend</h3>
                {convTrend && convTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={convTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={20} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: "Target 20%", fill: "#F59E0B", fontSize: 11 }} />
                      <Line type="monotone" dataKey="rate" name="Conversion Rate %" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4, fill: "#3B82F6" }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-gray-400 py-10">No data</p>}
              </div>

              {/* Revenue + LTV row */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Revenue from New Clients */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Revenue from New Clients</h3>
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-600 font-medium">Total Attributed Revenue</p>
                    <p className="text-2xl font-bold text-blue-700">{fmtCurrencyFull(overview.totalRevenueFromNewClients)}</p>
                  </div>
                  {convTrend && convTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={convTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="conversions" name="Conversions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 py-6">No data</p>}
                </div>

                {/* Client LTV by Source */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Client Lifetime Value by Source</h3>
                  {ltv && ltv.ltvBySource.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={ltv.ltvBySource} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} stroke="#9ca3af" width={80} />
                        <Tooltip content={<ChartTooltip currency />} />
                        <Bar dataKey="avgLtv" name="Avg LTV" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 py-10">No data</p>}
                </div>
              </div>

              {/* Projections */}
              {projections && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Zap className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold text-gray-900">Next Month Forecast</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Projected Leads</p>
                      <p className="text-2xl font-bold text-blue-700">{projections.projectedLeads}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <p className="text-sm text-emerald-600 font-medium">Projected Conversions</p>
                      <p className="text-2xl font-bold text-emerald-700">{projections.projectedConversions}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600 font-medium">Projected Revenue</p>
                      <p className="text-2xl font-bold text-purple-700">{fmtCurrencyFull(projections.projectedRevenue)}</p>
                    </div>
                  </div>
                  {projections.budgetRecommendations.length > 0 && (
                    <>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Recommended Budget Allocation</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Source</th>
                              <th className="text-right px-4 py-2.5 font-medium text-gray-600">Current Spend</th>
                              <th className="text-right px-4 py-2.5 font-medium text-gray-600">Recommended</th>
                              <th className="text-right px-4 py-2.5 font-medium text-gray-600">Expected ROI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {projections.budgetRecommendations.map((r) => (
                              <tr key={r.source} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 font-medium text-gray-900">{r.source}</td>
                                <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(r.currentSpend)}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <span className={r.recommendedSpend > r.currentSpend ? "text-emerald-600 font-medium" : r.recommendedSpend < r.currentSpend ? "text-red-600 font-medium" : "text-gray-700"}>
                                    {fmtCurrencyFull(r.recommendedSpend)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roiBadge(r.expectedRoi)}`}>{fmtPct(r.expectedRoi)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ════════════════ BY SOURCE TAB ════════════════ */}
        <TabsContent value="bySource">
          <div className="space-y-6">
            {/* Channel Summary Cards */}
            {byChannel && (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {byChannel.map((ch) => (
                  <div key={ch.channel} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">{ch.channel}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-gray-900">{fmtCurrency(ch.spend)}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roiBadge(ch.roi)}`}>{fmtPct(ch.roi)} ROI</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{ch.leads} leads / {ch.conversions} conversions</p>
                  </div>
                ))}
              </div>
            )}

            {/* Source ROI Table */}
            {bySource && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">ROI by Source</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Source</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Spend</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Leads</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Conversions</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Cost/Lead</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Cost/Acq</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bySource.map((s) => (
                        <tr key={s.source} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getSourceColor(s.source) }} />
                              <span className="font-medium text-gray-900">{s.source}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(s.spend)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{s.leads}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{s.conversions}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(s.costPerLead)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(s.costPerConversion)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(s.revenue)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roiBadge(s.roi)}`}>{fmtPct(s.roi)}</span>
                          </td>
                        </tr>
                      ))}
                      {bySource.length > 0 && (
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-2.5 text-gray-900">Total</td>
                          <td className="px-4 py-2.5 text-right text-gray-900">{fmtCurrencyFull(bySource.reduce((s, r) => s + r.spend, 0))}</td>
                          <td className="px-4 py-2.5 text-right text-gray-900">{bySource.reduce((s, r) => s + r.leads, 0)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-900">{bySource.reduce((s, r) => s + r.conversions, 0)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-900">{fmtCurrencyFull(bySource.reduce((s, r) => s + r.revenue, 0))}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ROI Comparison Chart */}
            {bySource && bySource.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">ROI Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={bySource.filter((s) => s.spend > 0).slice(0, 10)} layout="vertical" margin={{ left: 90 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} stroke="#9ca3af" width={90} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="roi" name="ROI %">
                        {bySource.filter((s) => s.spend > 0).slice(0, 10).map((s, i) => (
                          <Cell key={i} fill={s.roi >= 0 ? "#10B981" : "#EF4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Spend vs Revenue Scatter (approximated as bar) */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Spend vs Revenue by Source</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={bySource.filter((s) => s.spend > 0 || s.revenue > 0).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="source" tick={{ fontSize: 10 }} stroke="#9ca3af" angle={-30} textAnchor="end" height={60} />
                      <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Legend />
                      <Bar dataKey="spend" name="Spend" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Intake Form Performance */}
            {intakeForms && intakeForms.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Intake Form Performance</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Form</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Submissions</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Leads</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Conversions</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Conv. Rate</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {intakeForms.map((f) => (
                        <tr key={f.formName} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{f.formName}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{f.submissions}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{f.leads}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{f.conversions}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(f.conversionRate, 100)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{fmtPct(f.conversionRate)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(f.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Campaign Performance */}
            {campaignData && campaignData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Campaign Performance</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Campaign</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Recipients</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Leads</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Conversions</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {campaignData.map((c) => (
                        <tr key={c.name} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                          <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{c.type}</span></td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{c.recipients}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{c.leadsAttributed}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{c.conversions}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ════════════════ SPEND TRACKING TAB ════════════════ */}
        <TabsContent value="spend">
          <div className="space-y-6">
            {/* Spend Editor */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900">Log Marketing Spend</h3>
                <div className="flex items-center gap-3">
                  <Input type="month" value={spendMonth} onChange={(e) => setSpendMonth(e.target.value)} className="w-[160px] h-9" />
                  <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSaveSpend} disabled={bulkAdd.isPending}>
                    {bulkAdd.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save All
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SPEND_SOURCES.map((source) => (
                  <div key={source} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: getSourceColor(source) }} />
                    <span className="text-sm text-gray-700 min-w-[110px]">{source}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={spendAmounts[source] || ""}
                        onChange={(e) => setSpendAmounts({ ...spendAmounts, [source]: e.target.value })}
                        className="pl-7 h-9"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Spend */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Historical Spend</h3></div>
              {loadingSpend ? <Loading /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Period</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Source</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Amount</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Notes</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {spendList && spendList.length > 0 ? spendList.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-gray-900 font-medium">{r.period}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getSourceColor(r.source) }} />
                              <span className="text-gray-700">{r.source}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(toNum(r.amount))}</td>
                          <td className="px-4 py-2.5 text-gray-500 truncate max-w-[200px]">{r.notes || "—"}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Delete?")) deleteSpend.mutate({ id: r.id }); }}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No spend records yet. Use the form above to log your marketing spend.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Spend Trend Chart */}
            {spendTrendData && typeof spendTrendData === "object" && "data" in spendTrendData && spendTrendData.data.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Spend Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={spendTrendData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Legend />
                    {spendTrendData.sources.map((s: string, i: number) => (
                      <Bar key={s} dataKey={s} stackId="a" fill={getSourceColor(s, i)} barSize={24} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
