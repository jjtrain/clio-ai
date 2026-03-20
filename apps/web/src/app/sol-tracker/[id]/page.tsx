"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Calendar, Clock, Shield, AlertTriangle, CheckCircle2,
  Trash2, Edit, Pause, Bell,
} from "lucide-react";

const urgencyColor = (days: number) => {
  if (days <= 0) return { bg: "bg-red-600", text: "text-white" };
  if (days <= 90) return { bg: "bg-red-100", text: "text-red-700" };
  if (days <= 180) return { bg: "bg-amber-100", text: "text-amber-700" };
  if (days <= 365) return { bg: "bg-blue-100", text: "text-blue-700" };
  return { bg: "bg-green-100", text: "text-green-700" };
};

export default function SolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: sol, isLoading } = trpc.sol["get"].useQuery({ id });
  const { data: alerts } = trpc.sol["alerts.list"].useQuery({ solId: id });
  const [tolling, setTolling] = useState({ reason: "", startDate: "", endDate: "" });
  const [filedDate, setFiledDate] = useState(new Date().toISOString().split("T")[0]);

  const markFiled = trpc.sol["markFiled"].useMutation({
    onSuccess: () => utils.sol["get"].invalidate(),
  });
  const applyTolling = trpc.sol["applyTolling"].useMutation({
    onSuccess: () => utils.sol["get"].invalidate(),
  });
  const deleteSol = trpc.sol["delete"].useMutation({
    onSuccess: () => router.push("/sol-tracker"),
  });
  const ackAlert = trpc.sol["alerts.acknowledge"].useMutation({
    onSuccess: () => utils.sol["alerts.list"].invalidate(),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!sol) return <div className="p-8 text-center text-gray-400">SOL not found</div>;

  const days = Math.ceil((new Date(sol.expirationDate).getTime() - Date.now()) / 86400000);
  const uc = urgencyColor(days);
  const expired = days <= 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sol-tracker"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{sol.causeOfAction}</h1>
          <p className="text-gray-500">
            <Link href={`/matters/${sol.matterId}`} className="hover:text-blue-600">{sol.matter?.name ?? "Matter"}</Link>
          </p>
        </div>
        <Badge className={`${uc.bg} ${uc.text} border-0 text-xs`}>
          {expired ? "EXPIRED" : days <= 90 ? "CRITICAL" : days <= 180 ? "WARNING" : days <= 365 ? "MONITOR" : "SAFE"}
        </Badge>
        <Badge variant="outline" className="text-xs">{sol.status}</Badge>
      </div>

      {/* Countdown */}
      <div className={`${uc.bg} rounded-xl p-8 text-center`}>
        <p className={`text-6xl font-bold ${uc.text}`}>{Math.abs(days)}</p>
        <p className={`text-lg ${uc.text} mt-1`}>
          {expired ? `EXPIRED ${Math.abs(days)} days ago` : "days remaining"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Key Dates */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Key Dates</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Accrual Date</span><span className="font-medium">{new Date(sol.accrualDate).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Expiration Date</span><span className="font-medium">{new Date(sol.expirationDate).toLocaleDateString()}</span></div>
            {sol.noticeOfClaimDeadline && <div className="flex justify-between"><span className="text-gray-500">Notice of Claim</span><span className="font-medium">{new Date(sol.noticeOfClaimDeadline).toLocaleDateString()}</span></div>}
          </div>
        </div>

        {/* Statute Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" />Statute Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Citation</span><span className="font-medium">{sol.statute ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Jurisdiction</span><Badge variant="outline" className="text-[10px]">{sol.jurisdiction}</Badge></div>
            <div className="flex justify-between"><span className="text-gray-500">Period</span><span className="font-medium">{sol.limitationPeriod}</span></div>
            {sol.statuteDescription && <p className="text-gray-500 text-xs mt-2">{sol.statuteDescription}</p>}
          </div>
        </div>
      </div>

      {/* Tolling */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Pause className="h-4 w-4" />Tolling</h3>
        {sol.tollingReason ? (
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">Reason:</span> {sol.tollingReason}</p>
            <p><span className="text-gray-500">Period:</span> {sol.tollingStartDate && new Date(sol.tollingStartDate).toLocaleDateString()} &ndash; {sol.tollingEndDate && new Date(sol.tollingEndDate).toLocaleDateString()}</p>
            <p><span className="text-gray-500">Days tolled:</span> {sol.tollingDays ?? "—"}</p>
          </div>
        ) : <p className="text-sm text-gray-400">No tolling applied</p>}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Pause className="h-4 w-4 mr-2" />Apply Tolling</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Apply Tolling</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Reason</Label><Textarea value={tolling.reason} onChange={(e) => setTolling({ ...tolling, reason: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={tolling.startDate} onChange={(e) => setTolling({ ...tolling, startDate: e.target.value })} /></div>
                <div><Label>End Date</Label><Input type="date" value={tolling.endDate} onChange={(e) => setTolling({ ...tolling, endDate: e.target.value })} /></div>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={applyTolling.isPending}
                onClick={() => applyTolling.mutate({ id, ...tolling })}>Apply Tolling</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4" />Alert History</h3>
        </div>
        {!alerts?.length ? (
          <div className="p-6 text-center text-gray-400 text-sm">No alerts yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-2 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-2 px-4 font-medium text-gray-500">Severity</th>
                <th className="text-left py-2 px-4 font-medium text-gray-500">Status</th>
                <th className="text-right py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-gray-50">
                  <td className="py-2 px-4 text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-4">{a.alertType}</td>
                  <td className="py-2 px-4">
                    <Badge className={`text-[10px] border-0 ${a.severity === "SAS_CRITICAL" ? "bg-red-100 text-red-700" : a.severity === "SAS_WARNING" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{a.severity}</Badge>
                  </td>
                  <td className="py-2 px-4">
                    <Badge variant="outline" className="text-[10px]">{a.deliveryStatus}</Badge>
                  </td>
                  <td className="py-2 px-4 text-right">
                    {a.deliveryStatus !== "SDS_ACKNOWLEDGED" && (
                      <Button variant="ghost" size="sm" onClick={() => ackAlert.mutate({ id: a.id, acknowledgedBy: "current-user" })}>Acknowledge</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Filed Date</Label>
            <Input type="date" value={filedDate} onChange={(e) => setFiledDate(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => markFiled.mutate({ id, filedDate })} disabled={markFiled.isPending} className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />Mark Filed
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/sol-tracker/${id}/edit`}><Edit className="h-4 w-4 mr-2" />Edit</Link>
          </Button>
          <Button variant="outline" className="text-red-600 hover:bg-red-50"
            onClick={() => { if (confirm("Delete this SOL?")) deleteSol.mutate({ id }); }}>
            <Trash2 className="h-4 w-4 mr-2" />Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
