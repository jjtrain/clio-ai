"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  AlertTriangle,
  Banknote,
  Receipt,
  Percent,
  CalendarDays,
  Activity,
  BarChart3,
  Loader2,
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
} from "recharts";

// ── Chart colors ────────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  teal: "#06B6D4",
  pink: "#EC4899",
  orange: "#F97316",
  palette: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#F97316"],
};

// ── Date range presets ──────────────────────────────────────────────────────────
const PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "This Quarter", days: -1 },
  { label: "This Year", days: -2 },
] as const;

function getPresetRange(preset: (typeof PRESETS)[number]) {
  const now = new Date();
  if (preset.days === -1) {
    const qm = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), qm, 1), end: now };
  }
  if (preset.days === -2) {
    return { start: new Date(now.getFullYear(), 0, 1), end: now };
  }
  return { start: new Date(now.getTime() - preset.days * 86400000), end: now };
}

// ── Formatters ──────────────────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtCurrencyFull(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function fmtNum(v: number) {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ── KPI Card ────────────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string | number;
  format?: "currency" | "percentage" | "number" | "hours";
  change?: number;
  changeLabel?: string;
  status?: "good" | "warning" | "bad" | "neutral";
  icon?: React.ElementType;
  invertChange?: boolean;
}

function KpiCard({ title, value, format, change, changeLabel, status = "neutral", icon: Icon, invertChange }: KpiCardProps) {
  const formatted =
    format === "currency" ? fmtCurrency(Number(value))
    : format === "percentage" ? fmtPct(Number(value))
    : format === "hours" ? `${fmtNum(Number(value))}h`
    : fmtNum(Number(value));

  const borderColor =
    status === "good" ? "border-l-emerald-500"
    : status === "warning" ? "border-l-amber-500"
    : status === "bad" ? "border-l-red-500"
    : "border-l-blue-500";

  const bgColor =
    status === "good" ? "bg-emerald-50/50"
    : status === "warning" ? "bg-amber-50/50"
    : status === "bad" ? "bg-red-50/50"
    : "bg-white";

  const isPositive = change !== undefined && change !== null && (invertChange ? change < 0 : change > 0);
  const isNegative = change !== undefined && change !== null && (invertChange ? change > 0 : change < 0);

  return (
    <div className={`rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </div>
      <p className="text-2xl font-bold text-gray-900">{formatted}</p>
      {change !== undefined && change !== null && (
        <div className="flex items-center gap-1 mt-1.5">
          {isPositive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
          ) : isNegative ? (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
          ) : null}
          <span className={`text-xs font-medium ${isPositive ? "text-emerald-600" : isNegative ? "text-red-600" : "text-gray-500"}`}>
            {change > 0 ? "+" : ""}{change.toFixed(1)}%
          </span>
          {changeLabel && <span className="text-xs text-gray-400">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}

// ── Date Range Picker ───────────────────────────────────────────────────────────
function DateRangePicker({
  activePreset,
  onSelect,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  activePreset: number;
  onSelect: (index: number) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p, i) => (
        <Button
          key={p.label}
          size="sm"
          variant={activePreset === i ? "default" : "outline"}
          className={activePreset === i ? "bg-blue-500 hover:bg-blue-600" : ""}
          onClick={() => onSelect(i)}
        >
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-1.5 ml-2">
        <Input type="date" value={customStart} onChange={(e) => onCustomStartChange(e.target.value)} className="h-8 w-[130px] text-xs bg-white" />
        <span className="text-gray-400 text-xs">to</span>
        <Input type="date" value={customEnd} onChange={(e) => onCustomEndChange(e.target.value)} className="h-8 w-[130px] text-xs bg-white" />
      </div>
    </div>
  );
}

// ── Progress Bar for Goals ──────────────────────────────────────────────────────
function GoalBar({ metric, target, actual, percentage }: { metric: string; target: number; actual: number; percentage: number }) {
  const capped = Math.min(percentage, 100);
  const barColor =
    percentage >= 100 ? "bg-emerald-500"
    : percentage >= 70 ? "bg-blue-500"
    : percentage >= 50 ? "bg-amber-500"
    : "bg-red-500";
  const isCurrency = metric === "Revenue";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{metric}</span>
        <span className="text-gray-500">
          {isCurrency ? fmtCurrency(actual) : actual} / {isCurrency ? fmtCurrency(target) : target}
          <span className="ml-2 font-semibold text-gray-700">{percentage.toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${capped}%` }} />
      </div>
    </div>
  );
}

// ── Custom Tooltip ──────────────────────────────────────────────────────────────
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

// ── Spinner ─────────────────────────────────────────────────────────────────────
function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────────
export default function DashboardsPage() {
  const [activePreset, setActivePreset] = useState(1); // Last 30 Days
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");

  const { startDate, endDate } = useMemo(() => {
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    const range = getPresetRange(PRESETS[activePreset]);
    return { startDate: range.start.toISOString(), endDate: range.end.toISOString() };
  }, [activePreset, customStart, customEnd]);

  const handlePresetSelect = (i: number) => {
    setActivePreset(i);
    setCustomStart("");
    setCustomEnd("");
  };

  const handleCustomStart = (v: string) => { setCustomStart(v); setActivePreset(-1); };
  const handleCustomEnd = (v: string) => { setCustomEnd(v); setActivePreset(-1); };

  const dateInput = { startDate, endDate };

  // Queries
  const { data: revenue, isLoading: loadingRevenue } = trpc.dashboards.revenueOverview.useQuery({ ...dateInput, compareWithPrevious: true });
  const { data: productivity, isLoading: loadingProductivity } = trpc.dashboards.productivityOverview.useQuery(dateInput);
  const { data: matterData } = trpc.dashboards.matterProductivity.useQuery(dateInput);
  const { data: cashFlow, isLoading: loadingCashFlow } = trpc.dashboards.cashFlowSummary.useQuery({ months: 12 });
  const { data: clients, isLoading: loadingClients } = trpc.dashboards.clientMetrics.useQuery(dateInput);
  const { data: goals } = trpc.dashboards.goalTracking.useQuery({ period: goalPeriod });

  const prev = revenue?.previousPeriod;
  const pprod = productivity?.previousPeriod;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboards</h1>
          <p className="text-gray-500 mt-1 text-sm">Revenue, productivity, cash flow &amp; client analytics</p>
        </div>
        <DateRangePicker
          activePreset={activePreset}
          onSelect={handlePresetSelect}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={handleCustomStart}
          onCustomEndChange={handleCustomEnd}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="revenue" className="data-[state=active]:bg-white">Revenue</TabsTrigger>
          <TabsTrigger value="productivity" className="data-[state=active]:bg-white">Productivity</TabsTrigger>
          <TabsTrigger value="cashflow" className="data-[state=active]:bg-white">Cash Flow</TabsTrigger>
          <TabsTrigger value="clients" className="data-[state=active]:bg-white">Clients</TabsTrigger>
        </TabsList>

        {/* ════════════════ REVENUE TAB ════════════════ */}
        <TabsContent value="revenue">
          {loadingRevenue ? <Loading /> : revenue && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiCard title="Total Revenue" value={revenue.totalRevenue} format="currency" change={prev?.revenueChange} changeLabel="vs prev" status="good" icon={DollarSign} />
                <KpiCard title="Total Billed" value={revenue.totalBilled} format="currency" change={prev?.billedChange} changeLabel="vs prev" icon={Receipt} />
                <KpiCard title="Total Collected" value={revenue.totalCollected} format="currency" change={prev?.collectedChange} changeLabel="vs prev" status="good" icon={Banknote} />
                <KpiCard title="Outstanding" value={revenue.totalOutstanding} format="currency" change={prev?.outstandingChange} changeLabel="vs prev" status={revenue.totalOutstanding > revenue.totalBilled * 0.3 ? "warning" : "neutral"} icon={AlertTriangle} />
                <KpiCard title="Collection Rate" value={revenue.collectionRate} format="percentage" change={prev?.collectionRateChange} status={revenue.collectionRate > 90 ? "good" : revenue.collectionRate > 70 ? "warning" : "bad"} icon={Percent} />
                <KpiCard title="Avg Days to Payment" value={revenue.averageDaysToPayment} format="number" change={prev?.daysToPaymentChange} status={revenue.averageDaysToPayment < 30 ? "good" : revenue.averageDaysToPayment < 60 ? "warning" : "bad"} icon={CalendarDays} invertChange />
              </div>

              {/* Revenue Trend Chart */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={revenue.revenueByMonth}>
                    <defs>
                      <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOutstanding" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Legend />
                    <Area type="monotone" dataKey="billed" name="Billed" stroke={COLORS.primary} fill="url(#gradBilled)" strokeWidth={2} />
                    <Area type="monotone" dataKey="collected" name="Collected" stroke={COLORS.success} fill="url(#gradCollected)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke={COLORS.warning} fill="url(#gradOutstanding)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Two charts row */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Revenue by Practice Area — Donut */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Revenue by Practice Area</h3>
                  {revenue.revenueByPracticeArea.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={revenue.revenueByPracticeArea}
                          dataKey="total"
                          nameKey="practiceArea"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={100}
                          paddingAngle={2}
                          label={(props: any) => `${props.practiceArea} ${props.percentage}%`}
                        >
                          {revenue.revenueByPracticeArea.map((_, i) => (
                            <Cell key={i} fill={COLORS.palette[i % COLORS.palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtCurrencyFull(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-10">No data</p>
                  )}
                </div>

                {/* Top Clients — Horizontal Bar */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Clients by Revenue</h3>
                  {revenue.revenueByClient.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={revenue.revenueByClient} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis type="category" dataKey="clientName" tick={{ fontSize: 11 }} stroke="#9ca3af" width={80} />
                        <Tooltip content={<ChartTooltip currency />} />
                        <Bar dataKey="total" name="Revenue" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-10">No data</p>
                  )}
                </div>
              </div>

              {/* Goal Tracking */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold text-gray-900">Goal Tracking</h3>
                    {goals && <span className="text-sm text-gray-400 ml-2">{goals.period}</span>}
                  </div>
                  <div className="flex gap-1">
                    {(["monthly", "quarterly", "yearly"] as const).map((p) => (
                      <Button key={p} size="sm" variant={goalPeriod === p ? "default" : "outline"} className={goalPeriod === p ? "bg-blue-500 hover:bg-blue-600 h-7 text-xs" : "h-7 text-xs"} onClick={() => setGoalPeriod(p)}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
                {goals && (
                  <div className="space-y-4">
                    {goals.goals.map((g) => (
                      <GoalBar key={g.metric} {...g} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════ PRODUCTIVITY TAB ════════════════ */}
        <TabsContent value="productivity">
          {loadingProductivity ? <Loading /> : productivity && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiCard title="Total Hours" value={productivity.totalHours} format="hours" change={pprod?.hoursChange} changeLabel="vs prev" icon={Clock} />
                <KpiCard title="Billable Hours" value={productivity.billableHours} format="hours" change={pprod?.billableHoursChange} changeLabel="vs prev" status="good" icon={Clock} />
                <KpiCard title="Utilization Rate" value={productivity.utilizationRate} format="percentage" change={pprod?.utilizationChange} status={productivity.utilizationRate > 80 ? "good" : productivity.utilizationRate > 60 ? "warning" : "bad"} icon={Activity} />
                <KpiCard title="Billable Value" value={productivity.billableValue} format="currency" change={pprod?.valueChange} icon={DollarSign} />
                <KpiCard title="Realization Rate" value={productivity.realizationRate} format="percentage" change={pprod?.realizationChange} icon={Percent} />
                <KpiCard title="Avg Hourly Rate" value={productivity.averageHourlyRate} format="currency" change={pprod?.rateChange} icon={TrendingUp} />
              </div>

              {/* Daily Hours Chart */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Daily Hours (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productivity.hoursByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="billable" name="Billable" stackId="a" fill={COLORS.primary} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="nonBillable" name="Non-Billable" stackId="a" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Two charts row */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Hours by Practice Area */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Hours by Practice Area</h3>
                  {productivity.hoursByPracticeArea.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={productivity.hoursByPracticeArea} dataKey="hours" nameKey="practiceArea" cx="50%" cy="50%" outerRadius={100} label={(props: any) => `${props.practiceArea}: ${props.hours}h`}>
                          {productivity.hoursByPracticeArea.map((_, i) => (
                            <Cell key={i} fill={COLORS.palette[i % COLORS.palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-10">No data</p>
                  )}
                </div>

                {/* Hours by Timekeeper */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Hours by Timekeeper</h3>
                  {productivity.hoursByTimekeeper.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={productivity.hoursByTimekeeper} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis type="category" dataKey="userName" tick={{ fontSize: 11 }} stroke="#9ca3af" width={80} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar dataKey="billableHours" name="Billable" stackId="a" fill={COLORS.primary} barSize={16} />
                        <Bar dataKey="nonBillableHours" name="Non-Billable" stackId="a" fill="#D1D5DB" barSize={16} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-10">No data</p>
                  )}
                </div>
              </div>

              {/* Tables */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Top Matters */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Top Matters by Hours</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Matter</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Client</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Hours</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {productivity.hoursByMatter.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{m.matterName}</td>
                            <td className="px-4 py-2.5 text-gray-500">{m.clientName}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{m.hours}h</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(m.value)}</td>
                          </tr>
                        ))}
                        {productivity.hoursByMatter.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Stale Matters */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Stale Matters</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Matter</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Client</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Last Activity</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {matterData?.staleMatters.map((m, i) => (
                          <tr key={i} className={m.daysSinceActivity > 60 ? "bg-red-50/50" : ""}>
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{m.name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{m.client}</td>
                            <td className="px-4 py-2.5 text-gray-500">{formatDate(m.lastActivity)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.daysSinceActivity > 60 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {m.daysSinceActivity}d
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!matterData?.staleMatters || matterData.staleMatters.length === 0) && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No stale matters</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════ CASH FLOW TAB ════════════════ */}
        <TabsContent value="cashflow">
          {loadingCashFlow ? <Loading /> : cashFlow && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {(() => {
                  const thisMonth = cashFlow.monthlyData[cashFlow.monthlyData.length - 1];
                  const outstanding = revenue?.totalOutstanding || 0;
                  return (
                    <>
                      <KpiCard title="Net Cash Flow (This Month)" value={thisMonth?.netCashFlow || 0} format="currency" status={thisMonth?.netCashFlow >= 0 ? "good" : "bad"} icon={TrendingUp} />
                      <KpiCard title="Total Inflow" value={cashFlow.totalInflow} format="currency" status="good" icon={Banknote} />
                      <KpiCard title="Projected Next Month" value={cashFlow.projectedNextMonth} format="currency" icon={CalendarDays} />
                      <KpiCard title="Outstanding Receivables" value={outstanding} format="currency" status={outstanding > 10000 ? "warning" : "neutral"} icon={Receipt} />
                    </>
                  );
                })()}
              </div>

              {/* Cash Flow Combo Chart */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Monthly Cash Flow</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={cashFlow.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Legend />
                    <Bar dataKey="invoicesSent" name="Invoiced" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="paymentsReceived" name="Payments" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={24} />
                    <Line type="monotone" dataKey="netCashFlow" name="Net Cash Flow" stroke="#1F2937" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Trust Account Summary */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Trust Account Activity</h3>
                  {(() => {
                    const last = cashFlow.monthlyData[cashFlow.monthlyData.length - 1];
                    return (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-emerald-50 rounded-lg p-4">
                          <p className="text-sm text-emerald-600 font-medium">Deposits This Month</p>
                          <p className="text-xl font-bold text-emerald-700">{fmtCurrency(last?.trustDeposits || 0)}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-4">
                          <p className="text-sm text-red-600 font-medium">Withdrawals This Month</p>
                          <p className="text-xl font-bold text-red-700">{fmtCurrency(last?.trustWithdrawals || 0)}</p>
                        </div>
                      </div>
                    );
                  })()}
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={cashFlow.monthlyData.slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Legend />
                      <Bar dataKey="trustDeposits" name="Deposits" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="trustWithdrawals" name="Withdrawals" fill={COLORS.danger} radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Inflow/Outflow Summary */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Cash Flow Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100"><ArrowUpRight className="h-5 w-5 text-emerald-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Total Inflow</p>
                          <p className="text-xs text-gray-500">Payments + Trust Deposits</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-emerald-700">{fmtCurrency(cashFlow.totalInflow)}</p>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-100"><ArrowDownRight className="h-5 w-5 text-red-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Total Outflow</p>
                          <p className="text-xs text-gray-500">Trust Withdrawals</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-red-700">{fmtCurrency(cashFlow.totalOutflow)}</p>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100"><CalendarDays className="h-5 w-5 text-blue-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Projected Next Month</p>
                          <p className="text-xs text-gray-500">Based on 3-month average</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-blue-700">{fmtCurrency(cashFlow.projectedNextMonth)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════ CLIENTS TAB ════════════════ */}
        <TabsContent value="clients">
          {loadingClients ? <Loading /> : clients && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Active Clients" value={clients.totalActiveClients} format="number" icon={Users} />
                <KpiCard title="New This Period" value={clients.newClients} format="number" status="good" icon={Users} />
                <KpiCard title="Retention Rate" value={clients.clientRetentionRate} format="percentage" status={clients.clientRetentionRate > 80 ? "good" : clients.clientRetentionRate > 60 ? "warning" : "bad"} icon={Activity} />
                <KpiCard title="Avg Revenue / Client" value={clients.avgRevenuePerClient} format="currency" icon={DollarSign} />
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Clients by Practice Area */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Clients by Practice Area</h3>
                  {clients.clientsByPracticeArea.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={clients.clientsByPracticeArea} dataKey="count" nameKey="practiceArea" cx="50%" cy="50%" outerRadius={100} label={(props: any) => `${props.practiceArea}: ${props.count}`}>
                          {clients.clientsByPracticeArea.map((_, i) => (
                            <Cell key={i} fill={COLORS.palette[i % COLORS.palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-10">No data</p>
                  )}
                </div>

                {/* Client Growth - just show top clients as bar for now since we have the data */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Clients by Revenue</h3>
                  {clients.topClients.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={clients.topClients} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={80} />
                        <Tooltip content={<ChartTooltip currency />} />
                        <Bar dataKey="revenue" name="Revenue" fill={COLORS.purple} radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-400 py-10">No data</p>
                  )}
                </div>
              </div>

              {/* Tables */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Top Clients Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Top Clients</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Hours</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Matters</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {clients.topClients.map((c, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{c.name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrencyFull(c.revenue)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{c.hours}h</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{c.matters}</td>
                            <td className="px-4 py-2.5 text-gray-500">{formatDate(c.lastActivity)}</td>
                          </tr>
                        ))}
                        {clients.topClients.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* At Risk Clients */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <h3 className="font-semibold text-gray-900">At Risk Clients</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Issue</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-600">Last Activity</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-600">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {clients.atRiskClients.map((c: any, i: number) => (
                          <tr key={i} className={c.issue === "Overdue invoice" ? "bg-red-50/50" : "bg-amber-50/30"}>
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{c.name}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.issue === "Overdue invoice" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {c.issue}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">{formatDate(c.lastActivity)}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-700">{c.outstandingAmount > 0 ? fmtCurrencyFull(c.outstandingAmount) : "—"}</td>
                          </tr>
                        ))}
                        {clients.atRiskClients.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No at-risk clients</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
