"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import {
  ShieldCheck, Sparkles, Settings, Loader2, AlertTriangle, CheckCircle,
  Eye, XCircle, Search, ChevronDown, ChevronUp, Clock, BarChart3,
  Target, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const SEV_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  CRITICAL: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500", border: "border-l-red-500" },
  HIGH: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", border: "border-l-orange-500" },
  MEDIUM: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", border: "border-l-amber-500" },
  LOW: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", border: "border-l-blue-500" },
  INFO: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400", border: "border-l-gray-400" },
};
const CAT_COLORS: Record<string, string> = {
  BILLING: "bg-green-100 text-green-700", COMPLIANCE: "bg-purple-100 text-purple-700",
  DEADLINE: "bg-amber-100 text-amber-700", CLIENT: "bg-blue-100 text-blue-700",
  TRUST: "bg-red-100 text-red-700", PRODUCTIVITY: "bg-teal-100 text-teal-700",
  CONFLICT: "bg-orange-100 text-orange-700", FINANCIAL: "bg-indigo-100 text-indigo-700",
};
const PIE_COLORS = ["#10B981", "#8B5CF6", "#F59E0B", "#3B82F6", "#EF4444", "#06B6D4", "#F97316", "#6366F1"];

function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

export default function RiskPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [resolution, setResolution] = useState("");

  const { data: stats } = trpc.riskAlerts.getStats.useQuery();
  const statusMap: Record<string, string[]> = {
    active: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"],
    resolved: ["RESOLVED"],
    dismissed: ["DISMISSED"],
  };
  const queryStatus = statusFilter === "all" ? undefined : statusMap[statusFilter]?.[0];
  const { data: alertsData, isLoading } = trpc.riskAlerts.list.useQuery({
    status: queryStatus, limit: 100,
  });
  const { data: scanHistory } = trpc.riskAlerts.getScanHistory.useQuery();

  const runScan = trpc.riskAlerts.runFullScan.useMutation({
    onSuccess: (d) => { toast({ title: `Scan complete: ${d.alertsGenerated} alerts found` }); utils.riskAlerts.invalidate(); },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });
  const acknowledge = trpc.riskAlerts.acknowledge.useMutation({ onSuccess: () => utils.riskAlerts.invalidate() });
  const investigate = trpc.riskAlerts.investigate.useMutation({ onSuccess: () => utils.riskAlerts.invalidate() });
  const resolve = trpc.riskAlerts.resolve.useMutation({ onSuccess: () => { utils.riskAlerts.invalidate(); setResolveDialog({ open: false, id: "" }); setResolution(""); } });
  const dismiss = trpc.riskAlerts.dismiss.useMutation({ onSuccess: () => utils.riskAlerts.invalidate() });

  const alerts = alertsData?.alerts || [];
  const filteredAlerts = search ? alerts.filter((a: any) => a.title.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase())) : alerts;

  // Severity counts
  const sevCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  if (stats) for (const s of stats.bySeverity) if (s.severity in sevCounts) (sevCounts as any)[s.severity] = s.count;

  // Category donut data
  const catData = stats?.byCategory.map((c, i) => ({ name: c.category, value: c.count, color: PIE_COLORS[i % PIE_COLORS.length] })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-500" />Risk & Anomaly Detection
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Monitor risks, detect anomalies, and protect your practice
            {stats?.lastScan && <span className="ml-2 text-gray-400">Last scan: {formatDate(stats.lastScan)}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => runScan.mutate()} disabled={runScan.isPending}>
            {runScan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Run Full Scan
          </Button>
          <Button variant="outline" asChild><Link href="/risk/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link></Button>
        </div>
      </div>

      {/* Critical Banner */}
      {sevCounts.CRITICAL > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 font-medium">{sevCounts.CRITICAL} critical alert{sevCounts.CRITICAL > 1 ? "s" : ""} require immediate attention</p>
        </div>
      )}

      {/* Severity Summary Bar */}
      <div className="grid grid-cols-4 gap-3">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
          const s = SEV_COLORS[sev];
          return (
            <div key={sev} className={`rounded-xl border shadow-sm p-4 border-l-4 ${s.border} bg-white`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 font-medium">{sev}</span>
                <div className={`h-3 w-3 rounded-full ${s.dot} ${sev === "CRITICAL" && sevCounts.CRITICAL > 0 ? "animate-pulse" : ""}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{sevCounts[sev]}</p>
            </div>
          );
        })}
      </div>

      {/* KPI + Charts */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-blue-500 bg-white">
          <span className="text-sm text-gray-500 font-medium">Open Alerts</span>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalOpen || 0}</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-amber-500 bg-white">
          <span className="text-sm text-gray-500 font-medium">This Week</span>
          <p className="text-2xl font-bold text-gray-900">{stats?.thisWeek || 0}</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-emerald-500 bg-white">
          <span className="text-sm text-gray-500 font-medium">Resolution Rate</span>
          <p className="text-2xl font-bold text-gray-900">{fmtPct(stats?.resolutionRate || 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-purple-500 bg-white">
          <span className="text-sm text-gray-500 font-medium">Categories Active</span>
          <p className="text-2xl font-bold text-gray-900">{stats?.byCategory.length || 0}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Alerts by Category</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} label={(p: any) => `${p.name}: ${p.value}`}>
                  {catData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-10">No active alerts</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Alert Trend (Weekly)</h3>
          {stats?.weeklyTrend && stats.weeklyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stats.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="critical" name="Critical" stroke="#EF4444" strokeWidth={2} />
                <Line type="monotone" dataKey="high" name="High" stroke="#F97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-10">No trend data</p>}
        </div>
      </div>

      {/* Alert Feed */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="font-semibold text-gray-900">Alerts</h3>
            <div className="flex gap-2 flex-1">
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-shrink-0">
                <TabsList className="h-8 bg-gray-100 p-0.5">
                  <TabsTrigger value="active" className="text-xs h-7 data-[state=active]:bg-white">Active</TabsTrigger>
                  <TabsTrigger value="resolved" className="text-xs h-7 data-[state=active]:bg-white">Resolved</TabsTrigger>
                  <TabsTrigger value="dismissed" className="text-xs h-7 data-[state=active]:bg-white">Dismissed</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs h-7 data-[state=active]:bg-white">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No alerts found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredAlerts.map((alert: any) => {
              const sev = SEV_COLORS[alert.severity] || SEV_COLORS.INFO;
              const cat = CAT_COLORS[alert.category] || "bg-gray-100 text-gray-700";
              const expanded = expandedId === alert.id;
              return (
                <div key={alert.id} className={`border-l-4 ${sev.border}`}>
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-3 w-3 rounded-full ${sev.dot} mt-1.5 flex-shrink-0 ${alert.severity === "CRITICAL" ? "animate-pulse" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{alert.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat}`}>{alert.category}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.bg} ${sev.text}`}>{alert.severity}</span>
                          <span className="text-xs text-gray-400">{formatDate(alert.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{alert.description}</p>
                        {(alert.matter || alert.client) && (
                          <div className="flex gap-3 mt-1.5">
                            {alert.matter && <Link href={`/matters/${alert.matterId}`} className="text-xs text-blue-500 hover:underline">Matter: {alert.matter.name}</Link>}
                            {alert.client && <span className="text-xs text-gray-400">Client: {alert.client.name}</span>}
                          </div>
                        )}
                        {expanded && (
                          <div className="mt-3 space-y-2">
                            {alert.aiAnalysis && <div className="bg-purple-50 rounded-lg p-3"><p className="text-xs text-purple-600 font-medium mb-1">AI Analysis</p><p className="text-sm text-purple-700">{alert.aiAnalysis}</p></div>}
                            {alert.aiRecommendation && <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-600 font-medium mb-1">Recommendation</p><p className="text-sm text-blue-700">{alert.aiRecommendation}</p></div>}
                            {alert.resolution && <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-emerald-600 font-medium mb-1">Resolution</p><p className="text-sm text-emerald-700">{alert.resolution}</p></div>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(expanded ? null : alert.id)}>
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                        {alert.status === "NEW" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => acknowledge.mutate({ id: alert.id })}>
                            <Eye className="mr-1 h-3 w-3" />Ack
                          </Button>
                        )}
                        {(alert.status === "NEW" || alert.status === "ACKNOWLEDGED") && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => investigate.mutate({ id: alert.id })}>
                            <Search className="mr-1 h-3 w-3" />Investigate
                          </Button>
                        )}
                        {alert.status !== "RESOLVED" && alert.status !== "DISMISSED" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => setResolveDialog({ open: true, id: alert.id })}>
                              <CheckCircle className="mr-1 h-3 w-3" />Resolve
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400" onClick={() => dismiss.mutate({ id: alert.id })}>
                              <XCircle className="mr-1 h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scan History */}
      {scanHistory && scanHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Scan History</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Alerts</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Summary</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {scanHistory.map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 text-gray-900">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{s.scanType}</span></td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-700">{s.alertsGenerated}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{s.duration ? `${s.duration}ms` : "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs truncate max-w-[200px]">{s.summary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialog.open} onOpenChange={() => setResolveDialog({ open: false, id: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve Alert</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Describe how this was resolved..." value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={() => resolve.mutate({ id: resolveDialog.id, resolution })} disabled={resolve.isPending || !resolution}>
                {resolve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}Resolve
              </Button>
              <Button variant="outline" onClick={() => setResolveDialog({ open: false, id: "" })}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
