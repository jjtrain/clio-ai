"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Bell, Eye, Radar, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = { INFO: "text-blue-500", WARNING: "text-amber-500", CRITICAL: "text-red-500" };
const PROVIDER_COLORS: Record<string, string> = { TRACERS: "bg-blue-100 text-blue-700", SONAR: "bg-purple-100 text-purple-700", MEDIASCOPE: "bg-emerald-100 text-emerald-700" };

export default function MonitoringPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: subscriptions, isLoading } = trpc.investigations.monitoring.subscriptions.list.useQuery({ isActive: true });
  const { data: alerts } = trpc.investigations.monitoring.alerts.list.useQuery({ isRead: false });

  const ackMut = trpc.investigations.monitoring.alerts.acknowledge.useMutation({ onSuccess: () => { utils.investigations.monitoring.alerts.list.invalidate(); toast({ title: "Alert acknowledged" }); } });
  const dismissMut = trpc.investigations.monitoring.alerts.dismiss.useMutation({ onSuccess: () => { utils.investigations.monitoring.alerts.list.invalidate(); } });
  const stopMut = trpc.investigations.monitoring.subscriptions.stop.useMutation({ onSuccess: () => { utils.investigations.monitoring.subscriptions.list.invalidate(); toast({ title: "Monitoring stopped" }); } });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Monitoring Center</h1><p className="text-sm text-slate-500">Active monitoring subscriptions and alerts</p></div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><Radar className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{(subscriptions || []).length}</p><p className="text-xs text-gray-500">Active Subscriptions</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Bell className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{(alerts || []).length}</p><p className="text-xs text-gray-500">Unresolved Alerts</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Eye className="h-6 w-6 mx-auto mb-1 text-emerald-500" /><p className="text-2xl font-bold">{(subscriptions || []).reduce((s: number, sub: any) => s + sub.alertCount, 0)}</p><p className="text-xs text-gray-500">Total Alerts Generated</p></CardContent></Card>
      </div>

      {(alerts || []).length > 0 && (
        <Card className="border-amber-300">
          <CardHeader><CardTitle className="text-sm text-amber-700">Unresolved Alerts ({(alerts || []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(alerts || []).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <AlertTriangle className={`h-4 w-4 mt-0.5 ${SEVERITY_COLORS[a.severity]}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.subject} · {a.monitoringType.replace(/_/g, " ")} · {new Date(a.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-600 mt-1">{a.description?.slice(0, 200)}</p>
                </div>
                <div className="flex gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_COLORS[a.provider]}`}>{a.provider}</span>
                  <Button size="sm" variant="ghost" onClick={() => ackMut.mutate({ id: a.id, actionTaken: "noted" })}><CheckCircle className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => dismissMut.mutate({ id: a.id })}><XCircle className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Active Subscriptions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (subscriptions || []).length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Subject</th><th className="pb-2 font-medium text-gray-500">Type</th><th className="pb-2 font-medium text-gray-500">Provider</th><th className="pb-2 font-medium text-gray-500">Frequency</th><th className="pb-2 font-medium text-gray-500 text-right">Alerts</th><th className="pb-2 font-medium text-gray-500">Last Alert</th><th className="pb-2"></th></tr></thead>
              <tbody>
                {(subscriptions || []).map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{s.subject}</td>
                    <td className="py-3">{s.monitoringType}</td>
                    <td className="py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_COLORS[s.provider]}`}>{s.provider}</span></td>
                    <td className="py-3">{s.frequency}</td>
                    <td className="py-3 text-right">{s.alertCount}</td>
                    <td className="py-3 text-gray-500">{s.lastAlertAt ? new Date(s.lastAlertAt).toLocaleDateString() : "—"}</td>
                    <td className="py-3"><Button size="sm" variant="ghost" className="text-red-500" onClick={() => stopMut.mutate({ id: s.id })}>Stop</Button></td>
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
