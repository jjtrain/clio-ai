"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, Package, CheckCircle, AlertTriangle, Clock, Copy } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { MAILED: "bg-blue-100 text-blue-700", IN_TRANSIT: "bg-amber-100 text-amber-700", DELIVERED: "bg-emerald-100 text-emerald-700", RETURNED: "bg-red-100 text-red-700" };

export default function TrackingPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: active, isLoading } = trpc.mail["tracking.getActive"].useQuery();
  const { data: returned } = trpc.mail["tracking.getReturned"].useQuery();
  const trackMut = trpc.mail["jobs.trackAll"].useMutation({ onSuccess: () => { utils.mail["tracking.getActive"].invalidate(); toast({ title: "Tracking synced" }); } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mail Tracking</h1><p className="text-sm text-slate-500">Track active mailings and delivery status</p></div>
        <Button variant="outline" size="sm" onClick={() => trackMut.mutate()} disabled={trackMut.isLoading}><RefreshCw className={`h-4 w-4 mr-2 ${trackMut.isLoading ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Mailed</th><th className="pb-2 font-medium text-gray-500">Recipient</th><th className="pb-2 font-medium text-gray-500">Matter</th><th className="pb-2 font-medium text-gray-500">Type</th><th className="pb-2 font-medium text-gray-500 text-center">Status</th><th className="pb-2 font-medium text-gray-500">Tracking #</th><th className="pb-2 font-medium text-gray-500">Est. Delivery</th></tr></thead>
              <tbody>
                {(active || []).map((j: any) => (
                  <tr key={j.id} className="border-b last:border-0">
                    <td className="py-2 text-gray-500">{j.mailedDate ? new Date(j.mailedDate).toLocaleDateString() : "—"}</td>
                    <td className="py-2 font-medium">{j.recipientName}</td>
                    <td className="py-2 text-gray-600">{j.matter?.name || "—"}</td>
                    <td className="py-2 text-xs">{j.jobType?.replace(/_/g, " ")}</td>
                    <td className="py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[j.status] || ""}`}>{j.status?.replace(/_/g, " ")}</span></td>
                    <td className="py-2">{j.trackingNumber ? <button className="text-xs font-mono text-blue-600" onClick={() => { navigator.clipboard?.writeText(j.trackingNumber); toast({ title: "Copied" }); }}>{j.trackingNumber}</button> : "—"}</td>
                    <td className="py-2 text-gray-500">{j.estimatedDeliveryDate ? new Date(j.estimatedDeliveryDate).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {(!active || active.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-gray-400">No active mailings.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {(returned || []).length > 0 && (
        <Card className="border-red-300">
          <CardHeader><CardTitle className="text-sm text-red-700">Returned Mail</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(returned || []).map((j: any) => (
              <div key={j.id} className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded-lg">
                <div><p className="text-sm font-medium">{j.recipientName}</p><p className="text-xs text-red-600">{j.returnReason?.replace(/_/g, " ") || "Unknown"}</p><p className="text-xs text-gray-500">{j.matter?.name}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
