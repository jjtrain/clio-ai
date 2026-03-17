"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Loader2, RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle,
  BarChart3, Clock, Target, Wallet, Users, Briefcase, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#F97316"];

function fmtCurrency(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`; return `$${v.toFixed(0)}`; }
function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }

function KpiCard({ title, value, format, benchmark, icon: Icon }: { title: string; value: number; format: "currency" | "percent"; benchmark?: { value: number; status: string }; icon: any }) {
  const display = format === "currency" ? fmtCurrency(value) : fmtPct(value);
  const bColor = benchmark?.status === "above" ? "text-emerald-600" : benchmark?.status === "below" ? "text-red-600" : "text-amber-600";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500 font-medium">{title}</span>
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-2xl font-bold text-gray-900">{display}</p>
        {benchmark && (
          <p className={`text-xs mt-1 ${bColor}`}>
            {benchmark.status === "above" ? "Above" : benchmark.status === "below" ? "Below" : "At"} benchmark
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "CRITICAL") return <AlertCircle className="h-5 w-5 text-red-500" />;
  if (severity === "WARNING") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <Info className="h-5 w-5 text-blue-500" />;
}

export default function InsightsDashboard() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: snapshot, isLoading } = trpc.finInsights["snapshots.getCurrent"].useQuery();
  const { data: alerts } = trpc.finInsights["alerts.list"].useQuery({ isDismissed: false });
  const { data: budgets } = trpc.finInsights["budgets.list"].useQuery();
  const { data: revenueTrend } = trpc.finInsights["snapshots.trend"].useQuery({ metric: "revenue", periods: 12 });
  const { data: expenseTrend } = trpc.finInsights["snapshots.trend"].useQuery({ metric: "expenses", periods: 12 });

  const refreshMut = trpc.finInsights["snapshots.generate"].useMutation({
    onSuccess: () => { utils.finInsights["snapshots.getCurrent"].invalidate(); toast({ title: "Snapshot refreshed" }); },
  });
  const dismissMut = trpc.finInsights["alerts.dismiss"].useMutation({
    onSuccess: () => utils.finInsights["alerts.list"].invalidate(),
  });
  const markReadMut = trpc.finInsights["alerts.markRead"].useMutation({
    onSuccess: () => utils.finInsights["alerts.list"].invalidate(),
  });

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  const benchmarks = snapshot?.benchmarkComparison ? JSON.parse(snapshot.benchmarkComparison as string) : [];
  const getBenchmark = (metric: string) => benchmarks.find((b: any) => b.metric === metric);

  // Revenue chart data
  const revenueChartData = (revenueTrend || []).map((r: any, i: number) => ({
    period: r.period?.slice(5) || "",
    revenue: r.value,
    expenses: expenseTrend?.[i]?.value || 0,
    netIncome: r.value - (expenseTrend?.[i]?.value || 0),
  }));

  // AR aging
  const arAging = snapshot?.accountsReceivableAging ? JSON.parse(snapshot.accountsReceivableAging as string) : [];

  // Revenue by practice area
  const revByPA = snapshot?.revenueByPracticeArea ? JSON.parse(snapshot.revenueByPracticeArea as string) : [];

  const unreadAlerts = (alerts || []).filter((a: any) => !a.isRead);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Insights</h1>
          <p className="text-sm text-slate-500">AI-powered financial analytics for your practice</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshMut.mutate({ period: currentPeriod, periodType: "MONTHLY" })} disabled={refreshMut.isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMut.isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Revenue" value={Number(snapshot?.revenue || 0)} format="currency" icon={DollarSign} />
        <KpiCard title="Net Income" value={Number(snapshot?.netIncome || 0)} format="currency" icon={TrendingUp} />
        <KpiCard title="AR Outstanding" value={Number(snapshot?.accountsReceivable || 0)} format="currency" icon={Wallet} />
        <KpiCard title="Work in Progress" value={Number(snapshot?.workInProgress || 0)} format="currency" icon={Clock} />
        <KpiCard title="Collection Rate" value={Number(snapshot?.collectionRate || 0)} format="percent" benchmark={getBenchmark("Collection Rate")} icon={Target} />
        <KpiCard title="Realization Rate" value={Number(snapshot?.realizationRate || 0)} format="percent" benchmark={getBenchmark("Realization Rate")} icon={BarChart3} />
        <KpiCard title="Utilization Rate" value={Number(snapshot?.utilizationRate || 0)} format="percent" benchmark={getBenchmark("Utilization Rate")} icon={Users} />
        <KpiCard title="Profit Margin" value={Number(snapshot?.profitMargin || 0)} format="percent" benchmark={getBenchmark("Profit Margin")} icon={TrendingUp} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip formatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="netIncome" stroke="#10B981" strokeWidth={2} name="Net Income" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip formatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">AR Aging</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={arAging}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip formatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} />
                <Bar dataKey="amount" fill="#F59E0B" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Practice Area</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={revByPA} dataKey="amount" nameKey="practiceArea" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                  {revByPA.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {unreadAlerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Active Alerts ({unreadAlerts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {unreadAlerts.slice(0, 5).map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <SeverityIcon severity={alert.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.description}</p>
                  {alert.recommendation && <p className="text-xs text-blue-600 mt-1">{alert.recommendation}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => markReadMut.mutate({ id: alert.id })}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissMut.mutate({ id: alert.id })}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Budget Tracker */}
      {(budgets || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Budget Tracker</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(budgets || []).map((budget: any) => {
              const pct = Number(budget.targetAmount) > 0 ? (Number(budget.actualAmount) / Number(budget.targetAmount)) * 100 : 0;
              const statusColor = budget.status === "ON_TRACK" ? "bg-emerald-500" : budget.status === "AT_RISK" ? "bg-amber-500" : budget.status === "BEHIND" ? "bg-red-500" : budget.status === "EXCEEDED" ? "bg-blue-500" : "bg-gray-500";
              const badgeColor = budget.status === "ON_TRACK" ? "bg-emerald-100 text-emerald-700" : budget.status === "AT_RISK" ? "bg-amber-100 text-amber-700" : budget.status === "BEHIND" ? "bg-red-100 text-red-700" : budget.status === "EXCEEDED" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700";
              return (
                <div key={budget.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{budget.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{fmtCurrency(Number(budget.actualAmount))} / {fmtCurrency(Number(budget.targetAmount))}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{budget.status?.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${statusColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { name: "Profitability", href: "/insights/profitability", icon: BarChart3, desc: "Client & matter P&L" },
          { name: "Forecasting", href: "/insights/forecasting", icon: TrendingUp, desc: "AI revenue predictions" },
          { name: "Budgets", href: "/insights/budgets", icon: Target, desc: "Track targets" },
          { name: "Reports", href: "/insights/reports", icon: Briefcase, desc: "Executive summaries" },
        ].map((link) => (
          <a key={link.name} href={link.href} className="block">
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="pt-6 text-center">
                <link.icon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="text-sm font-medium">{link.name}</p>
                <p className="text-xs text-gray-500">{link.desc}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
