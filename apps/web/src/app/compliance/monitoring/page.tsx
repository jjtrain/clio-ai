"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, Bell, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";

const RISK_COLORS: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-700", MEDIUM: "bg-blue-100 text-blue-700", HIGH: "bg-amber-100 text-amber-700", VERY_HIGH: "bg-red-100 text-red-700" };

export default function MonitoringPage() {
  const { data: monitored, isLoading } = trpc.compliance["checks.list"].useQuery({ status: "PASSED" });
  const { data: alerts } = trpc.compliance["monitoring.getAlerts"].useQuery({});

  const activeMonitoring = (monitored || []).filter((c: any) => c.ongoingMonitoringId);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Ongoing Monitoring</h1><p className="text-sm text-slate-500">Continuous screening for sanctions, PEP, and adverse media changes</p></div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><Eye className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{activeMonitoring.length}</p><p className="text-xs text-gray-500">Active Subscriptions</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Bell className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{(alerts as any)?.length || 0}</p><p className="text-xs text-gray-500">Unresolved Alerts</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><CheckCircle className="h-6 w-6 mx-auto mb-1 text-emerald-500" /><p className="text-2xl font-bold">{monitored?.length || 0}</p><p className="text-xs text-gray-500">Passed Checks</p></CardContent></Card>
      </div>

      {(alerts as any)?.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader><CardTitle className="text-sm text-amber-700">Unresolved Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(alerts as any[]).slice(0, 10).map((alert: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><div><p className="text-sm font-medium">{alert.type || alert.description}</p><p className="text-xs text-gray-500">{alert.date || ""}</p></div></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Active Monitoring</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : activeMonitoring.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="pb-2 text-left font-medium text-gray-500">Client</th><th className="pb-2 text-left font-medium text-gray-500">Risk</th><th className="pb-2 text-left font-medium text-gray-500">Last Check</th><th className="pb-2 text-left font-medium text-gray-500">Next Check</th><th className="pb-2"></th></tr></thead>
              <tbody>
                {activeMonitoring.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{c.subjectName}</td>
                    <td className="py-3">{c.overallRiskLevel ? <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[c.overallRiskLevel]}`}>{c.overallRiskLevel}</span> : "—"}</td>
                    <td className="py-3 text-gray-500">{c.lastMonitoringCheck ? new Date(c.lastMonitoringCheck).toLocaleDateString() : "—"}</td>
                    <td className="py-3 text-gray-500">{c.nextMonitoringCheck ? new Date(c.nextMonitoringCheck).toLocaleDateString() : "—"}</td>
                    <td className="py-3"><Link href={`/compliance/checks/${c.id}`}><Button size="sm" variant="ghost">View</Button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-center text-gray-400 py-8">No active monitoring subscriptions.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
