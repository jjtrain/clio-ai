"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, TrendingUp, DollarSign, Wallet, BarChart3, ArrowUpRight, Sparkles } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

function fmtCurrency(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`; return `$${v.toFixed(0)}`; }

const TYPES = [
  { value: "REVENUE", label: "Revenue", icon: DollarSign, color: "#3B82F6" },
  { value: "EXPENSE", label: "Expense", icon: Wallet, color: "#EF4444" },
  { value: "CASH_FLOW", label: "Cash Flow", icon: BarChart3, color: "#10B981" },
  { value: "PROFITABILITY", label: "Profitability", icon: TrendingUp, color: "#8B5CF6" },
  { value: "GROWTH", label: "Growth", icon: ArrowUpRight, color: "#F59E0B" },
];

export default function ForecastingPage() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState("REVENUE");
  const [periods, setPeriods] = useState(6);
  const [granularity, setGranularity] = useState("MONTHLY");

  const { data: forecasts, isLoading } = trpc.finInsights["forecasts.getAll"].useQuery();
  const { data: latest } = trpc.finInsights["forecasts.getLatest"].useQuery({ forecastType: selectedType as any });
  const { data: historicalTrend } = trpc.finInsights["snapshots.trend"].useQuery({ metric: "revenue", periods: 12 });

  const generateMut = trpc.finInsights["forecasts.generate"].useMutation({
    onSuccess: () => { toast({ title: "Forecast generated" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const predictions = latest?.predictions ? JSON.parse(latest.predictions as string) : [];
  const typeConfig = TYPES.find((t) => t.value === selectedType) || TYPES[0];

  // Combine historical + forecast for chart
  const chartData = [
    ...(historicalTrend || []).map((h: any) => ({ period: h.period?.slice(5) || "", actual: h.value, type: "historical" })),
    ...predictions.map((p: any) => ({ period: p.period?.slice(5) || p.period, predicted: p.predicted, lowerBound: p.lowerBound, upperBound: p.upperBound, type: "forecast" })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forecasting</h1>
          <p className="text-sm text-slate-500">AI-powered financial predictions</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periods.toString()} onValueChange={(v) => setPeriods(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => generateMut.mutate({ forecastType: selectedType as any, periods, granularity: granularity as any })} disabled={generateMut.isLoading}>
            {generateMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </div>
      </div>

      {/* Forecast Type Cards */}
      <div className="grid grid-cols-5 gap-4">
        {TYPES.map((t) => {
          const fc = (forecasts || []).find((f: any) => f.forecastType === t.value);
          return (
            <Card key={t.value} className={`cursor-pointer transition-colors ${selectedType === t.value ? "border-blue-400 bg-blue-50/50" : "hover:border-gray-300"}`} onClick={() => setSelectedType(t.value)}>
              <CardContent className="pt-6 text-center">
                <t.icon className="h-6 w-6 mx-auto mb-2" style={{ color: t.color }} />
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-gray-400 mt-1">{fc ? "Available" : "Not generated"}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{typeConfig.label} Forecast</CardTitle>
          <CardDescription>Historical data (solid) + AI forecast (dashed) with confidence bands</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip formatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="upperBound" stroke="none" fill={typeConfig.color} fillOpacity={0.1} name="Upper Bound" />
                <Area type="monotone" dataKey="lowerBound" stroke="none" fill={typeConfig.color} fillOpacity={0.1} name="Lower Bound" />
                <Line type="monotone" dataKey="actual" stroke={typeConfig.color} strokeWidth={2} name="Actual" dot />
                <Line type="monotone" dataKey="predicted" stroke={typeConfig.color} strokeWidth={2} strokeDasharray="5 5" name="Predicted" dot />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-gray-400">
              <div className="text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No forecast data. Click "Generate" to create an AI forecast.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      {latest?.aiInsights && (
        <Card>
          <CardHeader><CardTitle className="text-sm">AI Insights</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{latest.aiInsights}</p>
            </div>
            {latest.assumptions && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">Key Assumptions</p>
                <p className="text-sm text-gray-600">{latest.assumptions}</p>
              </div>
            )}
            {latest.methodology && (
              <p className="text-xs text-gray-400 mt-2">Methodology: {latest.methodology}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Forecast Accuracy */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Forecast History</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-gray-500">Type</th>
                <th className="pb-2 font-medium text-gray-500">Methodology</th>
                <th className="pb-2 font-medium text-gray-500">Accuracy</th>
                <th className="pb-2 font-medium text-gray-500">Generated</th>
              </tr>
            </thead>
            <tbody>
              {(forecasts || []).map((f: any) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-3">{f.forecastType}</td>
                  <td className="py-3 text-gray-600">{f.methodology || "-"}</td>
                  <td className="py-3">{f.accuracy ? `${(Number(f.accuracy) * 100).toFixed(0)}%` : "-"}</td>
                  <td className="py-3 text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!forecasts || forecasts.length === 0) && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No forecasts generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
