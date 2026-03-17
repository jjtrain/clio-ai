"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, FileText, ShieldCheck, AlertTriangle, Clock, Users, Download } from "lucide-react";

export default function ComplianceReportsPage() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [checkId, setCheckId] = useState("");

  const { data: dashboard } = trpc.compliance["reports.dashboard"].useQuery();
  const { data: overview } = trpc.compliance["reports.firmOverview"].useQuery({}, { enabled: selectedReport === "overview" });
  const { data: expiring } = trpc.compliance["reports.expiring"].useQuery({ days: 30 }, { enabled: selectedReport === "expiring" });
  const { data: auditLog } = trpc.compliance["reports.auditLog"].useQuery({ from: dateFrom, to: dateTo }, { enabled: selectedReport === "audit" });

  const REPORTS = [
    { id: "overview", name: "Firm Overview", desc: "Total clients, compliance rate, risk distribution", icon: ShieldCheck },
    { id: "risk-register", name: "Client Risk Register", desc: "All clients with compliance status", icon: Users },
    { id: "expiring", name: "Expiring Checks", desc: "Checks needing renewal", icon: Clock },
    { id: "audit", name: "Audit Log", desc: "Full compliance audit trail", icon: FileText },
    { id: "sar", name: "SAR Template", desc: "Generate suspicious activity report", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Compliance Reports</h1><p className="text-sm text-slate-500">Generate and export compliance reports</p></div>

      {/* Summary */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-600">{Math.round(((dashboard.byStatus?.find((s: any) => s.status === "PASSED")?._count || 0) / Math.max(dashboard.total, 1)) * 100)}%</p><p className="text-xs text-gray-500">Compliance Rate</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{dashboard.total}</p><p className="text-xs text-gray-500">Total Checks</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-red-600">{dashboard.byRisk?.filter((r: any) => r.overallRiskLevel === "HIGH" || r.overallRiskLevel === "VERY_HIGH").reduce((s: number, r: any) => s + r._count, 0) || 0}</p><p className="text-xs text-gray-500">High Risk</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-amber-600">{dashboard.expiringSoon}</p><p className="text-xs text-gray-500">Expiring (30d)</p></CardContent></Card>
        </div>
      )}

      {/* Report Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {REPORTS.map((r) => (
          <Card key={r.id} className={`cursor-pointer hover:border-blue-300 transition-colors ${selectedReport === r.id ? "border-blue-400 bg-blue-50/50" : ""}`} onClick={() => setSelectedReport(r.id)}>
            <CardContent className="pt-6 text-center">
              <r.icon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-gray-500">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Output */}
      {selectedReport && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{REPORTS.find(r => r.id === selectedReport)?.name}</CardTitle></CardHeader>
          <CardContent>
            {selectedReport === "overview" && overview && (
              <div className="prose prose-sm max-w-none"><pre className="text-sm bg-gray-50 p-4 rounded overflow-auto">{JSON.stringify(overview, null, 2)}</pre></div>
            )}
            {selectedReport === "expiring" && (
              <div>
                {(expiring || []).length > 0 ? (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="pb-2 text-left">Client</th><th className="pb-2 text-left">Expires</th><th className="pb-2 text-left">Risk</th><th className="pb-2 text-left">Matter</th></tr></thead>
                    <tbody>{(expiring || []).map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0"><td className="py-2">{c.subjectName || c.client?.name}</td><td className="py-2 text-amber-600">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</td><td className="py-2">{c.overallRiskLevel || "—"}</td><td className="py-2">{c.matter?.name || "—"}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p className="text-gray-400 text-center py-4">No checks expiring in 30 days.</p>}
              </div>
            )}
            {selectedReport === "audit" && (
              <div>
                <div className="flex gap-2 mb-4">
                  <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" /></div>
                  <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" /></div>
                </div>
                {(auditLog || []).length > 0 ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {(auditLog as any[]).map((a: any) => (
                      <div key={a.id} className="flex gap-3 text-sm p-2 rounded hover:bg-gray-50">
                        <span className="text-xs text-gray-400 w-32 flex-shrink-0">{new Date(a.createdAt).toLocaleString()}</span>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded w-32 text-center flex-shrink-0">{a.activityType}</span>
                        <span className="text-gray-700 flex-1">{a.description}</span>
                        <span className="text-xs text-gray-400">{a.performedBy}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-400 text-center py-4">No audit records for this period.</p>}
              </div>
            )}
            {selectedReport === "risk-register" && <p className="text-center py-4"><a href="/compliance/risk-register" className="text-blue-600 hover:underline">View full Risk Register</a></p>}
            {selectedReport === "sar" && <p className="text-center py-4 text-gray-500">Select a specific check from the checks list to generate a SAR template.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
