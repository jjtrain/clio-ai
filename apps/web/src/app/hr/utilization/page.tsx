"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  DollarSign,
  Users,
} from "lucide-react";

function MetricCard({
  label,
  value,
  icon: Icon,
  prefix,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {prefix}
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix}
      </div>
    </div>
  );
}

export default function UtilizationPage() {
  const [period, setPeriod] = useState("month");

  const { data: summary, isLoading } = trpc.hr["utilization.getForFirm"].useQuery({ period });
  const { data: employees } = trpc.hr["utilization.getLeaderboard"].useQuery({ period });

  const firmUtilization = summary?.firmUtilizationPercent ?? 0;
  const totalBillableHours = summary?.totalBillableHours ?? 0;
  const totalRevenue = summary?.totalRevenue ?? 0;
  const avgHoursPerAttorney = summary?.avgHoursPerAttorney ?? 0;

  const list = employees ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Utilization Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Track attorney billable hours and performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Firm Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Firm Utilization"
          value={firmUtilization}
          icon={Target}
          suffix="%"
        />
        <MetricCard
          label="Total Billable Hours"
          value={totalBillableHours}
          icon={Clock}
        />
        <MetricCard
          label="Avg Hours / Attorney"
          value={avgHoursPerAttorney.toFixed(1)}
          icon={Users}
        />
        <MetricCard
          label="Total Revenue"
          value={totalRevenue.toLocaleString()}
          icon={DollarSign}
          prefix="$"
        />
      </div>

      {/* Attorney Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Attorney</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Billable Hrs</TableHead>
              <TableHead className="text-right">Utilization %</TableHead>
              <TableHead className="text-right">Target Hrs</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                  No utilization data for this period
                </TableCell>
              </TableRow>
            ) : (
              list.map((emp: any) => {
                const utilPct = emp.utilizationPercent ?? 0;
                const target = emp.targetBillableHours ?? 0;
                const billable = emp.billableHours ?? 0;
                const periodTarget =
                  period === "month"
                    ? target / 12
                    : period === "quarter"
                      ? target / 4
                      : target;
                const variance = billable - periodTarget;
                const variancePct = periodTarget > 0 ? ((variance / periodTarget) * 100).toFixed(1) : "0";

                return (
                  <TableRow key={emp.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">
                      {emp.fullName ?? `${emp.firstName} ${emp.lastName}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{emp.department ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium text-gray-900">
                      {billable.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-semibold ${
                          utilPct >= 90
                            ? "text-green-600"
                            : utilPct >= 70
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {utilPct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-gray-600">
                      {periodTarget.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`flex items-center justify-end gap-1 font-medium ${
                          variance >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {variance >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {variance >= 0 ? "+" : ""}
                        {variance.toFixed(1)} ({variancePct}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-900">
                      ${(emp.revenue ?? 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
