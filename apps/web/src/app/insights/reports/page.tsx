"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, FileText, BarChart3, DollarSign, Users, Clock, Briefcase, Download,
  TrendingUp, ShieldCheck, Sparkles,
} from "lucide-react";

function fmtCurrency(v: number) { return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`; }

const REPORTS = [
  { id: "executive", name: "Executive Summary", desc: "AI-generated financial health summary", icon: Sparkles, needsPeriod: true },
  { id: "profitability", name: "Profitability Report", desc: "Comprehensive profitability analysis", icon: TrendingUp, needsPeriod: true },
  { id: "cashflow", name: "Cash Flow Report", desc: "Current cash, projected collections, expenses", icon: DollarSign },
  { id: "wip", name: "WIP Analysis", desc: "Unbilled time by matter and attorney", icon: Clock },
  { id: "revenue-source", name: "Revenue by Source", desc: "Marketing channel ROI analysis", icon: BarChart3 },
  { id: "benchmark", name: "Benchmark Report", desc: "Industry benchmark comparison", icon: ShieldCheck, needsPeriod: true },
  { id: "client-advisory", name: "Client Advisory", desc: "AI business development memo", icon: Users, needsClient: true },
  { id: "tax-prep", name: "Tax Preparation", desc: "Annual tax preparation data", icon: FileText, needsYear: true },
];

export default function ReportsPage() {
  const { toast } = useToast();
  const now = new Date();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [period, setPeriod] = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`);
  const [clientId, setClientId] = useState("");
  const [taxYear, setTaxYear] = useState(now.getFullYear().toString());
  const [reportContent, setReportContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: clients } = trpc.clients.list.useQuery({});
  const execSummary = trpc.finInsights["reports.executiveSummary"].useQuery({ period }, { enabled: selectedReport === "executive" && !!period });
  const benchmark = trpc.finInsights["reports.benchmark"].useQuery({ period }, { enabled: selectedReport === "benchmark" && !!period });
  const cashFlow = trpc.finInsights["reports.cashFlow"].useQuery(undefined, { enabled: selectedReport === "cashflow" });
  const wipAnalysis = trpc.finInsights["reports.wipAnalysis"].useQuery(undefined, { enabled: selectedReport === "wip" });
  const revBySource = trpc.finInsights["reports.revenueBySource"].useQuery(undefined, { enabled: selectedReport === "revenue-source" });
  const clientAdvisory = trpc.finInsights["reports.clientAdvisory"].useQuery({ clientId }, { enabled: selectedReport === "client-advisory" && !!clientId });

  const getReportData = () => {
    switch (selectedReport) {
      case "executive": return execSummary.data;
      case "benchmark": return benchmark.data;
      case "cashflow": return cashFlow.data;
      case "wip": return wipAnalysis.data;
      case "revenue-source": return revBySource.data;
      case "client-advisory": return clientAdvisory.data;
      default: return null;
    }
  };

  const isLoading = execSummary.isLoading || benchmark.isLoading || cashFlow.isLoading || wipAnalysis.isLoading || revBySource.isLoading || clientAdvisory.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <p className="text-sm text-slate-500">Generate and export financial reports</p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORTS.map((report) => (
          <Card key={report.id} className={`cursor-pointer transition-colors hover:border-blue-300 ${selectedReport === report.id ? "border-blue-400 bg-blue-50/50" : ""}`} onClick={() => setSelectedReport(report.id)}>
            <CardContent className="pt-6">
              <report.icon className="h-8 w-8 text-blue-500 mb-3" />
              <p className="text-sm font-medium">{report.name}</p>
              <p className="text-xs text-gray-500 mt-1">{report.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Config & Output */}
      {selectedReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{REPORTS.find((r) => r.id === selectedReport)?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Config inputs */}
            <div className="flex gap-4 items-end">
              {REPORTS.find((r) => r.id === selectedReport)?.needsPeriod && (
                <div><Label>Period</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" className="w-40" /></div>
              )}
              {REPORTS.find((r) => r.id === selectedReport)?.needsClient && (
                <div><Label>Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="w-60"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {((clients as any) || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {REPORTS.find((r) => r.id === selectedReport)?.needsYear && (
                <div><Label>Tax Year</Label><Input value={taxYear} onChange={(e) => setTaxYear(e.target.value)} className="w-32" /></div>
              )}
            </div>

            {/* Report Output */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-500">Generating report...</span>
              </div>
            ) : getReportData() ? (
              <div className="mt-4">
                {typeof getReportData() === "string" ? (
                  <div className="prose prose-sm max-w-none p-6 bg-white border rounded-lg">
                    <div dangerouslySetInnerHTML={{ __html: (getReportData() as string).replace(/\n/g, "<br/>") }} />
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    {/* Cash Flow */}
                    {selectedReport === "cashflow" && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{fmtCurrency((getReportData() as any).currentCash)}</p><p className="text-xs text-gray-500">Current Cash</p></div>
                        <div className="text-center"><p className="text-2xl font-bold text-amber-600">{fmtCurrency((getReportData() as any).arOutstanding)}</p><p className="text-xs text-gray-500">AR Outstanding</p></div>
                        <div className="text-center"><p className="text-2xl font-bold text-blue-600">{fmtCurrency((getReportData() as any).projectedCollections)}</p><p className="text-xs text-gray-500">Projected Collections</p></div>
                      </div>
                    )}
                    {/* WIP */}
                    {selectedReport === "wip" && (
                      <div>
                        <p className="text-lg font-bold mb-4">Total WIP: {fmtCurrency((getReportData() as any).totalWip)}</p>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b"><th className="pb-2 text-left">Matter</th><th className="pb-2 text-left">Client</th><th className="pb-2 text-right">Hours</th><th className="pb-2 text-right">Value</th></tr></thead>
                          <tbody>
                            {((getReportData() as any).byMatter || []).slice(0, 20).map((m: any, i: number) => (
                              <tr key={i} className="border-b last:border-0"><td className="py-2">{m.matter}</td><td className="py-2 text-gray-600">{m.client}</td><td className="py-2 text-right">{m.hours.toFixed(1)}</td><td className="py-2 text-right">{fmtCurrency(m.value)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* Revenue by Source */}
                    {selectedReport === "revenue-source" && Array.isArray(getReportData()) && (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="pb-2 text-left">Source</th><th className="pb-2 text-right">Clients</th><th className="pb-2 text-right">Revenue</th><th className="pb-2 text-right">Avg per Client</th></tr></thead>
                        <tbody>
                          {(getReportData() as any[]).map((s: any, i: number) => (
                            <tr key={i} className="border-b last:border-0"><td className="py-2">{s.source}</td><td className="py-2 text-right">{s.clients}</td><td className="py-2 text-right">{fmtCurrency(s.revenue)}</td><td className="py-2 text-right">{fmtCurrency(s.avgRevenuePerClient)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {/* Benchmark */}
                    {selectedReport === "benchmark" && Array.isArray(getReportData()) && (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="pb-2 text-left">Metric</th><th className="pb-2 text-right">Firm</th><th className="pb-2 text-right">Benchmark</th><th className="pb-2 text-center">Status</th></tr></thead>
                        <tbody>
                          {(getReportData() as any[]).map((b: any, i: number) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2">{b.metric}</td>
                              <td className="py-2 text-right">{b.firmValue?.toFixed(1)}{b.unit}</td>
                              <td className="py-2 text-right">{b.benchmarkValue?.toFixed(1)}{b.unit}</td>
                              <td className="py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "above" ? "bg-emerald-100 text-emerald-700" : b.status === "below" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{b.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">Select options above to generate the report.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
