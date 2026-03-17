"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { HeartPulse, FileText, DollarSign, Clock, Scale, Plus, Settings, RefreshCw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-blue-100 text-blue-700", ACKNOWLEDGED: "bg-indigo-100 text-indigo-700", IN_PROGRESS: "bg-amber-100 text-amber-700", RECEIVED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-700" };
const DEMAND_STATUS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-blue-100 text-blue-700", REVIEW: "bg-amber-100 text-amber-700", SENT: "bg-purple-100 text-purple-700", COUNTER_RECEIVED: "bg-orange-100 text-orange-700", SETTLED: "bg-green-100 text-green-700" };

function fmt(s: string) { return s?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || ""; }
function cur(n: number | null | undefined) { return n != null ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"; }

export default function PIMedicalDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("requests");

  const { data: stats } = trpc.piMedical.getDashboardStats.useQuery();
  const { data: requests } = trpc.piMedical["requests.list"].useQuery();
  const { data: bills } = trpc.piMedical["bills.list"].useQuery();
  const { data: demands } = trpc.piMedical["demands.list"].useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">PI Medical</h1><p className="text-sm text-slate-500">Medical records, bills, chronologies, and demand packages</p></div>
        <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Active Requests</p></div><p className="text-xl font-bold">{stats?.activeRequests ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Received (Month)</p><p className="text-xl font-bold text-green-600">{stats?.receivedMonth ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500">Medical Specials</p></div><p className="text-xl font-bold">{cur(stats?.totalSpecials)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Liens</p><p className="text-xl font-bold text-red-600">{cur(stats?.totalLiens)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Active Demands</p></div><p className="text-xl font-bold">{stats?.activeDemands ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-teal-500" /><p className="text-xs text-slate-500">Avg Days</p></div><p className="text-xl font-bold">{stats?.avgDaysToReceive ?? 0}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests">Record Requests ({(requests || []).length})</TabsTrigger>
          <TabsTrigger value="bills">Bills & Liens ({(bills || []).length})</TabsTrigger>
          <TabsTrigger value="demands">Demands ({(demands || []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead>Record Type</TableHead><TableHead>Status</TableHead><TableHead>Est. Completion</TableHead><TableHead>Pages</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
              <TableBody>
                {(requests || []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{r.providerName}</TableCell>
                    <TableCell className="text-xs">{fmt(r.providerType)}</TableCell>
                    <TableCell className="text-xs">{fmt(r.recordType)}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || ""}`}>{fmt(r.status)}</span></TableCell>
                    <TableCell className="text-xs">{r.estimatedCompletionDate ? new Date(r.estimatedCompletionDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{r.pageCount || "—"}</TableCell>
                    <TableCell>{cur(Number(r.cost))}</TableCell>
                  </TableRow>
                ))}
                {!requests?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No record requests</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bills">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Provider</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Charged</TableHead><TableHead className="text-right">Adjustments</TableHead><TableHead className="text-right">Insurance</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Lien</TableHead></TableRow></TableHeader>
              <TableBody>
                {(bills || []).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">{b.serviceDate ? new Date(b.serviceDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="font-medium">{b.providerName}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{b.description}</TableCell>
                    <TableCell className="text-right font-mono">{cur(Number(b.chargedAmount))}</TableCell>
                    <TableCell className="text-right font-mono">{cur(Number(b.adjustments))}</TableCell>
                    <TableCell className="text-right font-mono">{cur(Number(b.insurancePaid))}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{cur(Number(b.outstandingBalance))}</TableCell>
                    <TableCell>{b.lienType ? <Badge variant="secondary" className="text-[10px]">{fmt(b.lienType)}</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
                {!bills?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No medical bills</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="demands">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Insurer</TableHead><TableHead>Adjustor</TableHead><TableHead className="text-right">Demand</TableHead><TableHead className="text-right">Counter</TableHead><TableHead className="text-right">Settlement</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(demands || []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{d.insurerName}</TableCell>
                    <TableCell className="text-xs">{d.adjustorName || "—"}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{cur(Number(d.demandAmount))}</TableCell>
                    <TableCell className="text-right font-mono">{d.counterOfferAmount ? cur(Number(d.counterOfferAmount)) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{d.settlementAmount ? cur(Number(d.settlementAmount)) : "—"}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${DEMAND_STATUS[d.status] || ""}`}>{fmt(d.status)}</span></TableCell>
                  </TableRow>
                ))}
                {!demands?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No demand packages</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
