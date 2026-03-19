"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Zap, Clock, BarChart3, TrendingUp, AlertTriangle, Brain, Sparkles } from "lucide-react";

export default function AIUsagePage() {
  const [period, setPeriod] = useState("month");
  const now = new Date();
  const from = period === "week" ? new Date(now.getTime() - 7 * 86400000).toISOString()
    : period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    : new Date(now.getFullYear(), 0, 1).toISOString();
  const to = now.toISOString();

  const { data: summary } = trpc.ai["usage.getSummary"].useQuery({ from, to });
  const { data: costs } = trpc.ai["usage.getCosts"].useQuery({ from, to });
  const { data: byProvider } = trpc.ai["usage.getByProvider"].useQuery({ from, to });
  const { data: byFeature } = trpc.ai["usage.getByFeature"].useQuery({ from, to });
  const { data: budget } = trpc.ai["settings.getBudget"].useQuery();
  const { data: performance } = trpc.ai["usage.getPerformance"].useQuery({ from, to });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">AI Usage & Costs</h1>
          <p className="text-gray-500 mt-1 text-sm">Track AI spending, usage, and performance across providers</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">Total Spend</span><DollarSign className="h-4 w-4 text-gray-400" /></div>
          <p className="text-2xl font-bold text-gray-900">${costs?.total?.toFixed(2) ?? "0.00"}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">Total Requests</span><Zap className="h-4 w-4 text-gray-400" /></div>
          <p className="text-2xl font-bold text-gray-900">{summary?.totalRequests?.toLocaleString() ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">Avg Latency</span><Clock className="h-4 w-4 text-gray-400" /></div>
          <p className="text-2xl font-bold text-gray-900">{performance?.avgLatency ?? 0}ms</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">Success Rate</span><BarChart3 className="h-4 w-4 text-gray-400" /></div>
          <p className="text-2xl font-bold text-gray-900">{((performance?.successRate ?? 1) * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">By Provider</h2>
          <div className="space-y-3">
            {Object.entries(byProvider || {}).map(([provider, data]: [string, any]) => (
              <div key={provider} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {provider === "ANTHROPIC" ? <Brain className="h-5 w-5 text-purple-600" /> : <Sparkles className="h-5 w-5 text-green-600" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{provider}</p>
                    <p className="text-xs text-gray-500">{data.requests} requests • avg {data.avgLatency}ms</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${data.cost?.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{data.tokens?.toLocaleString()} tokens</p>
                </div>
              </div>
            ))}
            {Object.keys(byProvider || {}).length === 0 && <p className="text-sm text-gray-400 text-center py-4">No usage data</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">By Feature</h2>
          <div className="space-y-2">
            {Object.entries(byFeature || {}).sort(([, a]: any, [, b]: any) => b.cost - a.cost).slice(0, 10).map(([feature, data]: [string, any]) => (
              <div key={feature} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{feature}</p>
                  <p className="text-xs text-gray-500">{data.requests} requests</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${data.cost?.toFixed(4)}</p>
                  <p className="text-xs text-gray-500">{data.tokens?.toLocaleString()} tokens</p>
                </div>
              </div>
            ))}
            {Object.keys(byFeature || {}).length === 0 && <p className="text-sm text-gray-400 text-center py-4">No usage data</p>}
          </div>
        </div>
      </div>

      {/* Budget Tracking */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Budget Tracking</h2>
        <div className="space-y-3">
          {(budget || []).map((b: any) => (
            <div key={b.provider} className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-24">{b.provider}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div className={`h-3 rounded-full ${b.percentUsed > 80 ? "bg-red-500" : b.percentUsed > 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, b.percentUsed)}%` }} />
              </div>
              <span className="text-sm text-gray-600 w-40 text-right">${b.currentSpend.toFixed(2)} / ${b.budgetCap > 0 ? `$${b.budgetCap.toFixed(2)}` : "No limit"}</span>
              {b.percentUsed > 80 && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
          ))}
        </div>
      </div>

      {/* Cost by Model */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Cost by Model</h2>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(costs?.byModel || {}).sort(([, a]: any, [, b]: any) => b - a).map(([model, cost]: [string, any]) => (
              <TableRow key={model}>
                <TableCell className="font-medium text-gray-900">{model}</TableCell>
                <TableCell className="text-right">${cost.toFixed(4)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
