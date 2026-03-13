"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  DollarSign,
  Clock,
  Target,
  CalendarDays,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  prefix,
  suffix,
}: {
  label: string;
  value: number | string;
  change: number | null;
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {prefix}
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix}
      </div>
      {change !== null && change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {change >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-sm font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
          <span className="text-sm text-gray-400">vs prior period</span>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dateInput = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const overview = trpc.analytics.overview.useQuery(dateInput);
  const leadsBySource = trpc.analytics.leadsBySource.useQuery(dateInput);
  const leadsByStatus = trpc.analytics.leadsByStatus.useQuery(dateInput);
  const conversionFunnel = trpc.analytics.conversionFunnel.useQuery(dateInput);
  const pipelineByStage = trpc.analytics.pipelineByStage.useQuery();
  const revenueOverTime = trpc.analytics.revenueOverTime.useQuery();
  const leadsOverTime = trpc.analytics.leadsOverTime.useQuery();
  const topPracticeAreas = trpc.analytics.topPracticeAreas.useQuery(dateInput);
  const appointmentStats = trpc.analytics.appointmentStats.useQuery(dateInput);
  const intakeFormStats = trpc.analytics.intakeFormStats.useQuery();

  const o = overview.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-gray-500">Track your firm's performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-500 whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-500 whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      {o && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard
            label="Total Leads"
            value={o.totalLeads}
            change={o.changes.totalLeads}
            icon={Users}
          />
          <MetricCard
            label="Conversion Rate"
            value={o.conversionRate}
            change={o.changes.conversionRate}
            icon={Target}
            suffix="%"
          />
          <MetricCard
            label="New Clients"
            value={o.newClients}
            change={o.changes.newClients}
            icon={Users}
          />
          <MetricCard
            label="New Matters"
            value={o.newMatters}
            change={o.changes.newMatters}
            icon={Briefcase}
          />
          <MetricCard
            label="Revenue"
            value={o.revenue.toLocaleString()}
            change={o.changes.revenue}
            icon={DollarSign}
            prefix="$"
          />
          <MetricCard
            label="Hours Logged"
            value={o.hoursLogged}
            change={o.changes.hoursLogged}
            icon={Clock}
            suffix="h"
          />
        </div>
      )}

      {/* Row: Leads by Source + Lead Status */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Leads by Source - Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Leads by Source</h2>
          {leadsBySource.data && leadsBySource.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leadsBySource.data}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, payload }: any) => `${name} (${payload?.percentage ?? 0}%)`}
                >
                  {leadsBySource.data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No lead data for this period
            </div>
          )}
        </div>

        {/* Lead Status - Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Leads by Status</h2>
          {leadsByStatus.data && leadsByStatus.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsByStatus.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No lead data for this period
            </div>
          )}
        </div>
      </div>

      {/* Row: Revenue Over Time + Leads Over Time */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Over Time - Area Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue (Last 12 Months)</h2>
          {revenueOverTime.data ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueOverTime.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Revenue"]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}
        </div>

        {/* Leads Over Time - Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Leads (Last 12 Weeks)</h2>
          {leadsOverTime.data ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsOverTime.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Row: Conversion Funnel + Pipeline by Stage */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Conversion Funnel</h2>
          {conversionFunnel.data && conversionFunnel.data.length > 0 ? (
            <div className="space-y-2">
              {conversionFunnel.data.map((stage, i) => {
                const maxCount = conversionFunnel.data![0].count || 1;
                const pct = Math.round((stage.count / maxCount) * 100);
                return (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{stage.stage.replace(/_/g, " ")}</span>
                      <span className="font-medium">{stage.count}</span>
                    </div>
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No funnel data for this period
            </div>
          )}
        </div>

        {/* Pipeline by Stage */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Pipeline by Stage</h2>
          {pipelineByStage.data ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineByStage.data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="stage"
                  type="category"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  formatter={(v: any, name: any) =>
                    name === "value" ? [`$${Number(v).toLocaleString()}`, "Value"] : [v, "Count"]
                  }
                />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Row: Top Practice Areas + Appointment Stats */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Top Practice Areas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Top Practice Areas</h2>
          {topPracticeAreas.data && topPracticeAreas.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">Area</th>
                    <th className="text-right py-2 font-medium text-gray-500">Matters</th>
                    <th className="text-right py-2 font-medium text-gray-500">Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {topPracticeAreas.data.map((area) => (
                    <tr key={area.area} className="border-b border-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{area.area}</td>
                      <td className="py-2.5 text-right text-gray-600">{area.count}</td>
                      <td className="py-2.5 text-right text-gray-600">
                        ${area.billed.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              No practice area data
            </div>
          )}
        </div>

        {/* Appointment Stats */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Appointments</h2>
          {appointmentStats.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {appointmentStats.data.total}
                  </div>
                  <div className="text-sm text-blue-500">Total</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {appointmentStats.data.completed}
                  </div>
                  <div className="text-sm text-green-500">Completed</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {appointmentStats.data.confirmed}
                  </div>
                  <div className="text-sm text-yellow-500">Confirmed</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {appointmentStats.data.noShow + appointmentStats.data.cancelled}
                  </div>
                  <div className="text-sm text-red-500">No-Show / Cancelled</div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  ${appointmentStats.data.feesCollected.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Consultation Fees Collected</div>
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Intake Form Performance */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Intake Form Performance</h2>
        {intakeFormStats.data && intakeFormStats.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Template</th>
                  <th className="text-right py-2 font-medium text-gray-500">Submissions</th>
                  <th className="text-right py-2 font-medium text-gray-500">Conversions</th>
                  <th className="text-right py-2 font-medium text-gray-500">Rate</th>
                </tr>
              </thead>
              <tbody>
                {intakeFormStats.data.map((t) => (
                  <tr key={t.templateId} className="border-b border-gray-50">
                    <td className="py-2.5 font-medium text-gray-900">{t.templateName}</td>
                    <td className="py-2.5 text-right text-gray-600">{t.submissions}</td>
                    <td className="py-2.5 text-right text-gray-600">{t.conversions}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.conversionRate >= 50
                            ? "bg-green-100 text-green-700"
                            : t.conversionRate >= 25
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {t.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[100px] flex items-center justify-center text-gray-400">
            No intake form data
          </div>
        )}
      </div>
    </div>
  );
}
