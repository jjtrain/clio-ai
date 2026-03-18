"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Send, Package, CheckCircle, AlertTriangle, Clock, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-blue-100 text-blue-700", PROCESSING: "bg-blue-100 text-blue-700", PRINTED: "bg-indigo-100 text-indigo-700", MAILED: "bg-blue-100 text-blue-700", IN_TRANSIT: "bg-amber-100 text-amber-700", DELIVERED: "bg-emerald-100 text-emerald-700", RETURNED: "bg-red-100 text-red-700", FAILED: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-500" };
const TYPE_COLORS: Record<string, string> = { FIRST_CLASS: "bg-gray-100 text-gray-700", CERTIFIED: "bg-blue-100 text-blue-700", CERTIFIED_RETURN_RECEIPT: "bg-indigo-100 text-indigo-700", PRIORITY: "bg-purple-100 text-purple-700", EXPRESS: "bg-red-100 text-red-700" };

export default function MailDashboard() {
  const { toast } = useToast();
  const { data: active } = trpc.mail["tracking.getActive"].useQuery();
  const { data: returned } = trpc.mail["tracking.getReturned"].useQuery();
  const { data: delivered } = trpc.mail["tracking.getDelivered"].useQuery({ start: new Date(Date.now() - 30 * 86400000).toISOString(), end: new Date().toISOString() });

  const inTransit = (active || []).length;
  const deliveredCount = (delivered || []).length;
  const returnedCount = (returned || []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mail</h1><p className="text-sm text-slate-500">Send legal documents via First Class, Certified, FedEx, and UPS</p></div>
        <div className="flex gap-2">
          <Link href="/mail/send"><Button><Send className="h-4 w-4 mr-2" /> Send Mail</Button></Link>
          <Link href="/mail/batch"><Button variant="outline"><Package className="h-4 w-4 mr-2" /> Bulk Mail</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6 text-center"><Mail className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{deliveredCount + inTransit}</p><p className="text-xs text-gray-500">This Month</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Clock className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{inTransit}</p><p className="text-xs text-gray-500">In Transit</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><CheckCircle className="h-6 w-6 mx-auto mb-1 text-emerald-500" /><p className="text-2xl font-bold">{deliveredCount}</p><p className="text-xs text-gray-500">Delivered</p></CardContent></Card>
        <Card className={returnedCount > 0 ? "border-red-300" : ""}><CardContent className="pt-6 text-center"><AlertTriangle className={`h-6 w-6 mx-auto mb-1 ${returnedCount > 0 ? "text-red-500" : "text-gray-400"}`} /><p className="text-2xl font-bold">{returnedCount}</p><p className="text-xs text-gray-500">Returned</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Mail className="h-6 w-6 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">—</p><p className="text-xs text-gray-500">Costs</p></CardContent></Card>
      </div>

      {/* Active Mailings */}
      <Card>
        <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Active Mailings</CardTitle><Link href="/mail/tracking" className="text-xs text-blue-600 hover:underline">View All</Link></div></CardHeader>
        <CardContent>
          {(active || []).length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Date</th><th className="pb-2 font-medium text-gray-500">Recipient</th><th className="pb-2 font-medium text-gray-500">Matter</th><th className="pb-2 font-medium text-gray-500">Type</th><th className="pb-2 font-medium text-gray-500 text-center">Status</th><th className="pb-2 font-medium text-gray-500">Tracking</th></tr></thead>
              <tbody>
                {(active || []).slice(0, 10).map((j: any) => (
                  <tr key={j.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-500">{j.mailedDate ? new Date(j.mailedDate).toLocaleDateString() : new Date(j.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 font-medium">{j.recipientName}</td>
                    <td className="py-2 text-gray-600">{j.matter?.name || "—"}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[j.jobType] || "bg-gray-100"}`}>{j.jobType.replace(/_/g, " ")}</span></td>
                    <td className="py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[j.status]}`}>{j.status.replace(/_/g, " ")}</span></td>
                    <td className="py-2">{j.trackingNumber ? <button className="text-xs text-blue-600 font-mono" onClick={() => { navigator.clipboard?.writeText(j.trackingNumber); toast({ title: "Copied" }); }}>{j.trackingNumber}</button> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-center text-gray-400 py-4">No active mailings.</p>}
        </CardContent>
      </Card>

      {/* Returned Mail */}
      {returnedCount > 0 && (
        <Card className="border-red-300">
          <CardHeader><CardTitle className="text-sm text-red-700">Returned Mail ({returnedCount})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(returned || []).slice(0, 5).map((j: any) => (
              <div key={j.id} className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded-lg">
                <div><p className="text-sm font-medium">{j.recipientName}</p><p className="text-xs text-gray-500">{j.returnReason?.replace(/_/g, " ") || "Unknown reason"} · {j.matter?.name}</p></div>
                <Link href={`/mail/tracking?job=${j.id}`}><Button size="sm" variant="outline">Review</Button></Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { name: "Send Mail", href: "/mail/send", icon: Send },
          { name: "Tracking", href: "/mail/tracking", icon: Package },
          { name: "Proof Archive", href: "/mail/proofs", icon: CheckCircle },
          { name: "Address Book", href: "/mail/address-book", icon: Mail },
        ].map(l => (
          <Link key={l.name} href={l.href}><Card className="hover:border-blue-300 transition-colors cursor-pointer"><CardContent className="pt-6 text-center"><l.icon className="h-6 w-6 mx-auto text-blue-500 mb-2" /><p className="text-xs font-medium">{l.name}</p></CardContent></Card></Link>
        ))}
      </div>
    </div>
  );
}
