"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";

export default function MailReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);

  const { data: costs, isLoading } = trpc.mail["reports.costs"].useQuery({ start: from, end: to });
  const { data: delivery } = trpc.mail["reports.delivery"].useQuery({ start: from, end: to });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mail Reports</h1><p className="text-sm text-slate-500">Mailing costs and delivery performance</p></div>
        <div className="flex gap-2 items-end"><div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div><div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div></div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <>
          {costs && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6 text-center"><DollarSign className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">${costs.totalCost?.toFixed(2) || "0.00"}</p><p className="text-xs text-gray-500">Total Cost</p></CardContent></Card>
              <Card><CardContent className="pt-6 text-center"><Mail className="h-6 w-6 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">{costs.totalJobs || 0}</p><p className="text-xs text-gray-500">Total Mailings</p></CardContent></Card>
              <Card><CardContent className="pt-6 text-center"><DollarSign className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">${costs.totalJobs ? (costs.totalCost / costs.totalJobs).toFixed(2) : "0.00"}</p><p className="text-xs text-gray-500">Avg Cost</p></CardContent></Card>
              <Card><CardContent className="pt-6 text-center"><Mail className="h-6 w-6 mx-auto mb-1 text-green-500" /><p className="text-2xl font-bold">{costs.byType ? Object.keys(costs.byType).length : 0}</p><p className="text-xs text-gray-500">Mail Classes Used</p></CardContent></Card>
            </div>
          )}
          {delivery && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Delivery Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div><p className="text-lg font-bold">{delivery.totalJobs || 0}</p><p className="text-xs text-gray-500">Total Sent</p></div>
                  <div><p className="text-lg font-bold text-emerald-600">{delivery.deliveredCount || 0}</p><p className="text-xs text-gray-500">Delivered</p></div>
                  <div><p className="text-lg font-bold text-red-600">{delivery.returnedCount || 0}</p><p className="text-xs text-gray-500">Returned</p></div>
                  <div><p className="text-lg font-bold">{delivery.totalJobs ? `${Math.round((delivery.deliveredCount / delivery.totalJobs) * 100)}%` : "—"}</p><p className="text-xs text-gray-500">Delivery Rate</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
