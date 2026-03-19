"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Phone,
  MessageSquare,
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowLeft,
  Calendar,
  BarChart3,
} from "lucide-react";

function KPICard({
  label,
  value,
  icon: Icon,
  trend,
  prefix,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number | null;
  prefix?: string;
  suffix?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">{label}</span>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color ?? "bg-blue-50"}`}>
            <Icon className={`h-4 w-4 ${color ? "text-white" : "text-blue-600"}`} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {prefix}
          {typeof value === "number" ? value.toLocaleString() : value}
          {suffix}
        </div>
        {trend !== null && trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}% vs prior period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LSAPerformancePage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const performanceQuery = trpc.lsa["performance.getCurrent"].useQuery(undefined, {
  });
  const roiQuery = trpc.lsa["performance.getROI"].useQuery({
    dateFrom: startDate,
    dateTo: endDate,
  });

  const perf = performanceQuery.data;
  const roi = roiQuery.data;
  const isLoading = performanceQuery.isLoading || roiQuery.isLoading;

  const categoryBreakdown = perf?.byCategory ? JSON.parse(perf.byCategory as string) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/lsa">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
            <p className="text-gray-500 text-sm mt-1">LSA performance metrics and analytics</p>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-sm text-gray-500">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-500">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setStartDate(d.toISOString().split("T")[0]);
                  setEndDate(new Date().toISOString().split("T")[0]);
                }}
              >
                7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 1);
                  setStartDate(d.toISOString().split("T")[0]);
                  setEndDate(new Date().toISOString().split("T")[0]);
                }}
              >
                30 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 3);
                  setStartDate(d.toISOString().split("T")[0]);
                  setEndDate(new Date().toISOString().split("T")[0]);
                }}
              >
                90 Days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-8 bg-gray-200 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Leads"
            value={perf?.totalLeads ?? 0}
            icon={Users}
            trend={null}
            color="bg-blue-50"
          />
          <KPICard
            label="Phone Leads"
            value={perf?.phoneLeads ?? 0}
            icon={Phone}
            color="bg-indigo-50"
          />
          <KPICard
            label="Message Leads"
            value={perf?.messageLeads ?? 0}
            icon={MessageSquare}
            color="bg-green-50"
          />
          <KPICard
            label="Total Spend"
            value={Number(perf?.totalSpend || 0).toFixed(2) ?? "0.00"}
            icon={DollarSign}
            prefix="$"
            color="bg-yellow-50"
          />
          <KPICard
            label="Cost Per Lead"
            value={Number(perf?.averageCostPerLead || 0).toFixed(2) ?? "0.00"}
            icon={DollarSign}
            prefix="$"
            trend={null}
            color="bg-orange-50"
          />
          <KPICard
            label="Conversions"
            value={perf?.conversionCount ?? 0}
            icon={Target}
            trend={null}
            color="bg-emerald-50"
          />
          <KPICard
            label="ROI"
            value={`${((roi?.roi ?? 0) * 100).toFixed(0)}%`}
            icon={TrendingUp}
            color="bg-purple-50"
          />
          <KPICard
            label="Avg Response Time"
            value={perf?.averageResponseTime ? `${Math.round(perf.averageResponseTime / 60)}m` : "N/A"}
            icon={Clock}
            color="bg-pink-50"
          />
        </div>
      )}

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Leads by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No category data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((cat: any) => {
                const maxLeads = Math.max(...categoryBreakdown.map((c: any) => c.leads ?? 0));
                const pct = maxLeads > 0 ? ((cat.leads ?? 0) / maxLeads) * 100 : 0;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-40 truncate">{cat.category}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      >
                        <span className="text-xs text-white font-medium">{cat.leads}</span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 w-20 text-right">
                      ${cat.spend?.toFixed(0) ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
