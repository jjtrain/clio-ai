"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle, Download } from "lucide-react";

export default function ProofsPage() {
  const { data: certified, isLoading } = trpc.mail["reports.certifiedMailLog"].useQuery({ start: new Date(Date.now() - 365 * 86400000).toISOString(), end: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Proof of Service Archive</h1><p className="text-sm text-slate-500">Certified mail log with proofs of mailing and delivery</p></div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Certified #</th><th className="pb-2 font-medium text-gray-500">Mailed</th><th className="pb-2 font-medium text-gray-500">Recipient</th><th className="pb-2 font-medium text-gray-500">Matter</th><th className="pb-2 font-medium text-gray-500 text-center">Delivery</th><th className="pb-2 font-medium text-gray-500">Delivered To</th><th className="pb-2 font-medium text-gray-500 text-center">Green Card</th></tr></thead>
              <tbody>
                {(certified || []).map((j: any) => (
                  <tr key={j.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{j.certifiedNumber || j.trackingNumber || "—"}</td>
                    <td className="py-2 text-gray-500">{j.mailedDate ? new Date(j.mailedDate).toLocaleDateString() : "—"}</td>
                    <td className="py-2 font-medium">{j.recipientName}</td>
                    <td className="py-2 text-gray-600">{j.matter?.name || "—"}</td>
                    <td className="py-2 text-center">{j.deliveredDate ? <span className="text-xs text-emerald-600">{new Date(j.deliveredDate).toLocaleDateString()}</span> : j.status === "RETURNED" ? <span className="text-xs text-red-600">RETURNED</span> : <span className="text-xs text-amber-600">Pending</span>}</td>
                    <td className="py-2 text-gray-600">{j.deliveredTo || "—"}</td>
                    <td className="py-2 text-center">{j.returnReceiptDocId ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : "—"}</td>
                  </tr>
                ))}
                {(!certified || certified.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-gray-400">No certified mailings.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
