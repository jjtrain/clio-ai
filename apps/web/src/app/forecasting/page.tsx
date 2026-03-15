"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Target, AlertTriangle,
  Loader2, Save, Sparkles, BarChart3, CheckCircle, XCircle, RefreshCw,
  Briefcase, Shield, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine,
} from "recharts";

const COLORS = { primary: "#3B82F6", success: "#10B981", warning: "#F59E0B", danger: "#EF4444", purple: "#8B5CF6", teal: "#06B6D4", palette: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#F97316"] };
const FEE_COLORS: Record<string, string> = { HOURLY: "bg-blue-100 text-blue-700", FLAT_FEE: "bg-emerald-100 text-emerald-700", CONTINGENCY: "bg-purple-100 text-purple-700", HYBRID: "bg-amber-100 text-amber-700", RETAINER: "bg-teal-100 text-teal-700" };
const CONF_COLORS: Record<string, string> = { HIGH: "bg-green-100 text-green-700", MEDIUM: "bg-amber-100 text-amber-700", LOW: "bg-red-100 text-red-700" };

function fmtCurrency(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`; return `$${v.toFixed(0)}`; }
function fmtFull(v: number) { return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

function KpiCard({ title, value, format, change, status = "neutral", icon: Icon }: { title: string; value: number; format?: "currency" | "percentage" | "number"; change?: number; status?: "good" | "warning" | "bad" | "neutral"; icon?: React.ElementType }) {
  const f = format === "currency" ? fmtCurrency(value) : format === "percentage" ? fmtPct(value) : value.toLocaleString();
  const border = status === "good" ? "border-l-emerald-500" : status === "warning" ? "border-l-amber-500" : status === "bad" ? "border-l-red-500" : "border-l-blue-500";
  return (
    <div className={`rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 ${border} bg-white`}>
      <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500 font-medium">{title}</span>{Icon && <Icon className="h-4 w-4 text-gray-400" />}</div>
      <p className="text-2xl font-bold text-gray-900">{f}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1.5">
          {change > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : change < 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" /> : null}
          <span className={`text-xs font-medium ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-gray-500"}`}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>
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
          <span className="font-medium text-gray-900">{currency ? fmtFull(p.value) : p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Loading() { return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>; }

// ── Valuation Dialog ────────────────────────────────────────────────────────────
function ValuationDialog({ open, onClose, matterId, existing }: { open: boolean; onClose: () => void; matterId: string; existing?: any }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [feeType, setFeeType] = useState(existing?.feeType || "HOURLY");
  const [hourlyRate, setHourlyRate] = useState(existing?.hourlyRate?.toString() || "250");
  const [estimatedHours, setEstimatedHours] = useState(existing?.estimatedHours?.toString() || "");
  const [flatFee, setFlatFee] = useState(existing?.estimatedFees?.toString() || "");
  const [contingencyPct, setContingencyPct] = useState(existing?.contingencyPercentage?.toString() || "33");
  const [caseValue, setCaseValue] = useState(existing?.estimatedValue?.toString() || "");
  const [retainerAmt, setRetainerAmt] = useState(existing?.retainerAmount?.toString() || "");
  const [costs, setCosts] = useState(existing?.estimatedCosts?.toString() || "0");
  const [duration, setDuration] = useState(existing?.estimatedDurationMonths?.toString() || "");
  const [confidence, setConfidence] = useState(existing?.confidenceLevel || "MEDIUM");
  const [notes, setNotes] = useState(existing?.notes || "");

  const save = trpc.forecasting.setValuation.useMutation({ onSuccess: () => { toast({ title: "Valuation saved" }); utils.forecasting.invalidate(); onClose(); } });
  const aiEst = trpc.forecasting.aiEstimate.useMutation({
    onSuccess: (data) => {
      toast({ title: "AI estimate complete" });
      utils.forecasting.invalidate();
      onClose();
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const calcValue = () => {
    const h = parseFloat(estimatedHours) || 0;
    const r = parseFloat(hourlyRate) || 0;
    const c = parseFloat(costs) || 0;
    if (feeType === "HOURLY") return h * r + c;
    if (feeType === "FLAT_FEE") return (parseFloat(flatFee) || 0) + c;
    if (feeType === "CONTINGENCY") return (parseFloat(caseValue) || 0) * ((parseFloat(contingencyPct) || 33) / 100) + c;
    if (feeType === "RETAINER") return (parseFloat(retainerAmt) || 0) + h * r + c;
    return h * r + (parseFloat(flatFee) || 0) + c;
  };

  const handleSave = () => {
    const val = calcValue();
    save.mutate({
      matterId, estimatedValue: val, feeType, confidenceLevel: confidence,
      estimatedHours: parseFloat(estimatedHours) || undefined,
      estimatedFees: feeType === "FLAT_FEE" ? parseFloat(flatFee) || undefined : feeType === "CONTINGENCY" ? val - (parseFloat(costs) || 0) : undefined,
      estimatedCosts: parseFloat(costs) || undefined,
      hourlyRate: parseFloat(hourlyRate) || undefined,
      contingencyPercentage: feeType === "CONTINGENCY" ? parseFloat(contingencyPct) || undefined : undefined,
      retainerAmount: feeType === "RETAINER" ? parseFloat(retainerAmt) || undefined : undefined,
      estimatedDurationMonths: parseInt(duration) || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Set Matter Valuation</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Fee Type</Label>
            <Select value={feeType} onValueChange={setFeeType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="HOURLY">Hourly</SelectItem><SelectItem value="FLAT_FEE">Flat Fee</SelectItem><SelectItem value="CONTINGENCY">Contingency</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem><SelectItem value="RETAINER">Retainer</SelectItem></SelectContent>
            </Select>
          </div>
          {(feeType === "HOURLY" || feeType === "HYBRID" || feeType === "RETAINER") && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Hourly Rate ($)</Label><Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="mt-1" /></div>
              <div><Label>Estimated Hours</Label><Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="mt-1" /></div>
            </div>
          )}
          {feeType === "FLAT_FEE" && <div><Label>Flat Fee ($)</Label><Input type="number" value={flatFee} onChange={(e) => setFlatFee(e.target.value)} className="mt-1" /></div>}
          {feeType === "CONTINGENCY" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contingency %</Label><Input type="number" value={contingencyPct} onChange={(e) => setContingencyPct(e.target.value)} className="mt-1" /></div>
              <div><Label>Est. Case Value ($)</Label><Input type="number" value={caseValue} onChange={(e) => setCaseValue(e.target.value)} className="mt-1" /></div>
            </div>
          )}
          {feeType === "RETAINER" && <div><Label>Retainer Amount ($)</Label><Input type="number" value={retainerAmt} onChange={(e) => setRetainerAmt(e.target.value)} className="mt-1" /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Estimated Costs ($)</Label><Input type="number" value={costs} onChange={(e) => setCosts(e.target.value)} className="mt-1" /></div>
            <div><Label>Duration (months)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" /></div>
          </div>
          <div>
            <Label>Confidence Level</Label>
            <Select value={confidence} onValueChange={setConfidence}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="HIGH">High — Strong historical data</SelectItem><SelectItem value="MEDIUM">Medium — Some comparable data</SelectItem><SelectItem value="LOW">Low — Limited data</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} /></div>
          <div className="bg-blue-50 rounded-lg p-4"><p className="text-sm text-blue-600 font-medium">Total Estimated Value</p><p className="text-2xl font-bold text-blue-700">{fmtFull(calcValue())}</p></div>
          <div className="flex gap-2">
            <Button className="flex-1 bg-blue-500 hover:bg-blue-600" onClick={handleSave} disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
            <Button variant="outline" onClick={() => aiEst.mutate({ matterId })} disabled={aiEst.isPending}>{aiEst.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}AI Estimate</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────────
export default function ForecastingPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [valuationDialog, setValuationDialog] = useState<{ open: boolean; matterId: string; existing?: any }>({ open: false, matterId: "" });

  const { data: summary } = trpc.forecasting.getValuationSummary.useQuery();
  const { data: valuations, isLoading: loadingValuations } = trpc.forecasting.listValuations.useQuery();
  const { data: forecasts } = trpc.forecasting.getFirmForecasts.useQuery();
  const { data: profitability } = trpc.forecasting.firmProfitability.useQuery();
  const { data: paProfit } = trpc.forecasting.practiceAreaProfitability.useQuery();
  const { data: accuracy } = trpc.forecasting.getAccuracy.useQuery();

  const genForecast = trpc.forecasting.generateFirmForecast.useMutation({
    onSuccess: () => { toast({ title: "Forecast generated" }); utils.forecasting.invalidate(); },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  const aiEstBulk = trpc.forecasting.aiEstimate.useMutation({
    onSuccess: () => utils.forecasting.invalidate(),
  });

  // Chart data for estimated vs actual
  const estVsActualData = useMemo(() => {
    if (!valuations) return [];
    return valuations.filter((v) => v.hasValuation).sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 15).map((v) => ({
      name: v.matterName.length > 20 ? v.matterName.slice(0, 20) + "..." : v.matterName,
      estimated: v.estimatedValue,
      actual: v.actualBilled,
    }));
  }, [valuations]);

  // Pipeline by fee type
  const feeTypeData = useMemo(() => {
    if (!valuations) return [];
    const map: Record<string, number> = {};
    for (const v of valuations.filter((v) => v.hasValuation)) {
      const ft = v.feeType || "HOURLY";
      map[ft] = (map[ft] || 0) + v.estimatedValue;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [valuations]);

  // Forecast chart data
  const forecastChartData = useMemo(() => {
    if (!forecasts) return [];
    return forecasts.map((f: any) => ({
      period: f.period,
      projected: Math.round(toNum(f.projectedRevenue)),
      actual: f.actualRevenue !== null ? Math.round(toNum(f.actualRevenue)) : undefined,
      low: Math.round(toNum(f.projectedRevenue) * 0.8),
      high: Math.round(toNum(f.projectedRevenue) * 1.2),
    }));
  }, [forecasts]);

  function toNum(v: any) { return typeof v === "number" ? v : parseFloat(v?.toString()) || 0; }

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Financial Forecasting</h1>
          <p className="text-gray-500 mt-1 text-sm">Matter valuations, revenue projections &amp; profitability analysis</p>
        </div>
        <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => genForecast.mutate()} disabled={genForecast.isPending}>
          {genForecast.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate Forecast
        </Button>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-white">Pipeline Value</TabsTrigger>
          <TabsTrigger value="forecasting" className="data-[state=active]:bg-white">Forecasting</TabsTrigger>
          <TabsTrigger value="profitability" className="data-[state=active]:bg-white">Profitability</TabsTrigger>
          <TabsTrigger value="accuracy" className="data-[state=active]:bg-white">Accuracy</TabsTrigger>
        </TabsList>

        {/* ════════════════ PIPELINE VALUE TAB ════════════════ */}
        <TabsContent value="pipeline">
          {!summary ? <Loading /> : (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiCard title="Total Pipeline" value={summary.totalPipeline} format="currency" icon={DollarSign} />
                <KpiCard title="Billed to Date" value={summary.totalBilled} format="currency" status="good" icon={BarChart3} />
                <KpiCard title="Remaining Value" value={summary.remaining} format="currency" icon={Target} />
                <KpiCard title="Over Budget" value={summary.overBudget} format="number" status={summary.overBudget > 0 ? "bad" : "good"} icon={AlertTriangle} />
                <KpiCard title="Est. Accuracy" value={summary.avgAccuracy} format="percentage" status={summary.avgAccuracy > 80 ? "good" : summary.avgAccuracy > 60 ? "warning" : "bad"} icon={CheckCircle} />
                <KpiCard title="Weighted Pipeline" value={summary.weightedPipeline} format="currency" icon={Shield} />
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Estimated vs Actual by Matter</h3>
                  {estVsActualData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={estVsActualData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" angle={-25} textAnchor="end" height={70} />
                        <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip content={<ChartTooltip currency />} />
                        <Legend />
                        <Bar dataKey="estimated" name="Estimated" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="actual" name="Actual Billed" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 py-10">No valued matters yet</p>}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Pipeline by Fee Type</h3>
                  {feeTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={feeTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} label={(props: any) => props.name}>
                          {feeTypeData.map((_, i) => <Cell key={i} fill={COLORS.palette[i % COLORS.palette.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmtFull(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 py-10">No data</p>}
                </div>
              </div>

              {/* Valuation Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Matter Valuations</h3>
                  <Button variant="outline" size="sm" onClick={() => {
                    const unvalued = valuations?.filter((v) => !v.hasValuation);
                    if (unvalued && unvalued.length > 0) {
                      for (const m of unvalued.slice(0, 5)) aiEstBulk.mutate({ matterId: m.matterId });
                      toast({ title: `Estimating ${Math.min(unvalued.length, 5)} matters...` });
                    }
                  }} disabled={aiEstBulk.isPending}>
                    <Sparkles className="mr-1.5 h-3 w-3" />AI Estimate All
                  </Button>
                </div>
                {loadingValuations ? <Loading /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Matter</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Client</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Fee Type</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Estimated</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Billed</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Variance</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Progress</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Conf.</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600"></th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {valuations?.map((v) => (
                          <tr key={v.matterId} className={v.isOverBudget ? "bg-red-50/30" : ""}>
                            <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[180px] truncate">{v.matterName}</td>
                            <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">{v.clientName}</td>
                            <td className="px-4 py-2.5">{v.feeType ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FEE_COLORS[v.feeType] || "bg-gray-100 text-gray-700"}`}>{v.feeType}</span> : <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{v.hasValuation ? fmtFull(v.estimatedValue) : "—"}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{fmtFull(v.actualBilled)}</td>
                            <td className="px-4 py-2.5 text-right">{v.hasValuation ? <span className={v.variance > 0 ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>{v.variance > 0 ? "+" : ""}{fmtFull(v.variance)}</span> : "—"}</td>
                            <td className="px-4 py-2.5">
                              {v.hasValuation ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                                    <div className={`h-full rounded-full ${v.percentConsumed > 100 ? "bg-red-500" : v.percentConsumed > 80 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${Math.min(v.percentConsumed, 100)}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500">{fmtPct(v.percentConsumed)}</span>
                                </div>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2.5">{v.confidence ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONF_COLORS[v.confidence]}`}>{v.confidence}</span> : "—"}</td>
                            <td className="px-4 py-2.5 text-right">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setValuationDialog({ open: true, matterId: v.matterId })}>
                                {v.hasValuation ? "Edit" : "Set Value"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {(!valuations || valuations.length === 0) && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No open matters</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════ FORECASTING TAB ════════════════ */}
        <TabsContent value="forecasting">
          <div className="space-y-6">
            {forecasts && forecasts.length > 0 ? (
              <>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {(() => {
                    const next = forecasts.find((f: any) => f.period > currentMonth);
                    const nextQ = forecasts.filter((f: any) => f.period > currentMonth).slice(0, 3);
                    const projected = next ? toNum((next as any).projectedRevenue) : 0;
                    const qTotal = nextQ.reduce((s: number, f: any) => s + toNum(f.projectedRevenue), 0);
                    return (
                      <>
                        <KpiCard title="Next Month Revenue" value={projected} format="currency" icon={TrendingUp} />
                        <KpiCard title="Next Quarter" value={qTotal} format="currency" icon={DollarSign} />
                        <KpiCard title="Active Matters" value={valuations?.length || 0} format="number" icon={Briefcase} />
                        <KpiCard title="Forecasts Generated" value={forecasts.length} format="number" icon={BarChart3} />
                      </>
                    );
                  })()}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Revenue Forecast</h3>
                    <Button variant="outline" size="sm" onClick={() => genForecast.mutate()} disabled={genForecast.isPending}><RefreshCw className="mr-1.5 h-3 w-3" />Refresh</Button>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={forecastChartData}>
                      <defs>
                        <linearGradient id="gradConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Legend />
                      <Area dataKey="high" name="High Estimate" fill="url(#gradConf)" stroke="none" />
                      <Area dataKey="low" name="Low Estimate" fill="url(#gradConf)" stroke="none" />
                      <Line type="monotone" dataKey="projected" name="Projected" stroke={COLORS.primary} strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke={COLORS.success} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.success }} />
                      <ReferenceLine x={currentMonth} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: "Today", fill: "#9ca3af", fontSize: 11 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Forecast Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Forecast Details</h3></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Period</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Projected</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Actual</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Variance</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Methodology</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {forecasts.map((f: any) => (
                          <tr key={f.period} className={f.period === currentMonth ? "bg-blue-50/50" : ""}>
                            <td className="px-4 py-2.5 font-medium text-gray-900">{f.period}{f.period === currentMonth && <span className="ml-2 text-xs text-blue-500">current</span>}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{fmtFull(toNum(f.projectedRevenue))}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{f.actualRevenue !== null ? fmtFull(toNum(f.actualRevenue)) : "—"}</td>
                            <td className="px-4 py-2.5 text-right">{f.variance !== null ? <span className={toNum(f.variance) >= 0 ? "text-emerald-600" : "text-red-600"}>{toNum(f.variance) >= 0 ? "+" : ""}{fmtFull(toNum(f.variance))}</span> : "—"}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[250px] truncate">{f.methodology || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No forecasts yet</p>
                <p className="text-gray-400 text-sm mt-1">Click "Generate Forecast" to create AI-powered revenue projections</p>
                <Button className="mt-4 bg-blue-500 hover:bg-blue-600" onClick={() => genForecast.mutate()} disabled={genForecast.isPending}>
                  {genForecast.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generate Forecast
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ════════════════ PROFITABILITY TAB ════════════════ */}
        <TabsContent value="profitability">
          {profitability ? (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Avg Profit Margin" value={profitability.totalEstimated > 0 ? ((profitability.totalEstimated - profitability.totalActual) / profitability.totalEstimated) * 100 : 0} format="percentage" icon={TrendingUp} />
                <KpiCard title="On Track" value={profitability.onTrack} format="number" status="good" icon={CheckCircle} />
                <KpiCard title="At Risk" value={profitability.offTrack} format="number" status={profitability.offTrack > 0 ? "bad" : "good"} icon={AlertTriangle} />
                <KpiCard title="Top Practice Area" value={paProfit && paProfit.length > 0 ? paProfit[0].avgMargin : 0} format="percentage" icon={Briefcase} />
              </div>

              {/* Profitability by Practice Area */}
              {profitability.byPracticeArea.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Profitability by Practice Area</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={profitability.byPracticeArea}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="practiceArea" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="margin" name="Margin %">
                        {profitability.byPracticeArea.map((d: any, i: number) => (
                          <Cell key={i} fill={d.margin >= 0 ? COLORS.success : COLORS.danger} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* At-Risk Matters */}
              {valuations && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold text-gray-900">At-Risk Matters</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Matter</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">Client</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Estimated</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">Billed</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600">% Over</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600"></th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {valuations.filter((v) => v.isOverBudget).sort((a, b) => b.variancePercentage - a.variancePercentage).map((v) => (
                          <tr key={v.matterId} className="bg-red-50/30">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{v.matterName}</td>
                            <td className="px-4 py-2.5 text-gray-500">{v.clientName}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{fmtFull(v.estimatedValue)}</td>
                            <td className="px-4 py-2.5 text-right text-red-600 font-medium">{fmtFull(v.actualBilled)}</td>
                            <td className="px-4 py-2.5 text-right"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">+{fmtPct(v.variancePercentage)}</span></td>
                            <td className="px-4 py-2.5 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setValuationDialog({ open: true, matterId: v.matterId })}>Adjust</Button></td>
                          </tr>
                        ))}
                        {valuations.filter((v) => v.isOverBudget).length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No at-risk matters</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : <Loading />}
        </TabsContent>

        {/* ════════════════ ACCURACY TAB ════════════════ */}
        <TabsContent value="accuracy">
          {accuracy ? (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Overall Accuracy" value={accuracy.overallAccuracy} format="percentage" status={accuracy.overallAccuracy > 80 ? "good" : accuracy.overallAccuracy > 60 ? "warning" : "bad"} icon={Target} />
                <KpiCard title="Forecast Data Points" value={accuracy.byPeriod.length} format="number" icon={BarChart3} />
                <KpiCard title="Avg Overestimation" value={accuracy.avgOverestimation} format="currency" icon={ArrowUpRight} />
                <KpiCard title="Avg Underestimation" value={accuracy.avgUnderestimation} format="currency" icon={ArrowDownRight} />
              </div>

              {accuracy.byPeriod.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Forecast vs Actual</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={accuracy.byPeriod}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Legend />
                      <Line type="monotone" dataKey="projected" name="Projected" stroke={COLORS.primary} strokeWidth={2} strokeDasharray="6 3" />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke={COLORS.success} strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Accuracy by practice area from profitability data */}
              {paProfit && paProfit.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Estimation Accuracy by Practice Area</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={paProfit.map((p: any) => ({ ...p, accuracy: Math.max(0, 100 - Math.abs(p.avgMargin)) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="practiceArea" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="#9ca3af" domain={[0, 100]} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="accuracy" name="Accuracy %" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {accuracy.byPeriod.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No accuracy data yet</p>
                  <p className="text-gray-400 text-sm mt-1">Generate forecasts and wait for periods to pass to measure accuracy</p>
                </div>
              )}
            </div>
          ) : <Loading />}
        </TabsContent>
      </Tabs>

      {/* Valuation Dialog */}
      {valuationDialog.open && (
        <ValuationDialog
          open={valuationDialog.open}
          onClose={() => setValuationDialog({ open: false, matterId: "" })}
          matterId={valuationDialog.matterId}
        />
      )}
    </div>
  );
}
