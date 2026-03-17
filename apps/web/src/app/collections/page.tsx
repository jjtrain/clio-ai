"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { DollarSign, AlertTriangle, TrendingUp, RefreshCw, MoreHorizontal, Mail, Phone, FileText, Send, Ban, Settings } from "lucide-react";

const AGING_COLORS: Record<string, string> = { CURRENT: "bg-green-100 text-green-700", DAYS_1_30: "bg-lime-100 text-lime-700", DAYS_31_60: "bg-amber-100 text-amber-700", DAYS_61_90: "bg-orange-100 text-orange-700", DAYS_91_120: "bg-red-100 text-red-700", DAYS_OVER_120: "bg-red-200 text-red-800" };
const PRIORITY_COLORS: Record<string, string> = { LOW: "bg-green-100 text-green-700", MEDIUM: "bg-amber-100 text-amber-700", HIGH: "bg-orange-100 text-orange-700", CRITICAL: "bg-red-100 text-red-700" };
const STATUS_COLORS: Record<string, string> = { OPEN: "bg-blue-100 text-blue-700", REMINDER_SENT: "bg-amber-100 text-amber-700", PAYMENT_PLAN: "bg-purple-100 text-purple-700", IN_COLLECTION: "bg-red-100 text-red-700", SETTLED: "bg-green-100 text-green-700", WRITTEN_OFF: "bg-gray-100 text-gray-700", PAID: "bg-green-100 text-green-700" };

function cur(n: number | null | undefined) { return n != null ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"; }
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function CollectionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: dashboard } = trpc.collections.dashboard.useQuery();
  const { data: accounts } = trpc.collections["accounts.list"].useQuery({
    status: statusFilter || undefined, priority: priorityFilter || undefined,
  });

  const syncMut = trpc.collections.sync.useMutation({ onSuccess: (d) => { utils.collections.invalidate(); toast({ title: `Synced: ${d.created} new, ${d.updated} updated` }); } });
  const sendReminderMut = trpc.collections["reminders.send"].useMutation({ onSuccess: () => { utils.collections.invalidate(); toast({ title: "Reminder sent" }); } });
  const writeOffMut = trpc.collections.writeOff.useMutation({ onSuccess: () => { utils.collections.invalidate(); toast({ title: "Account written off" }); } });
  const collboxMut = trpc.collections["collbox.submit"].useMutation({ onSuccess: (d) => { utils.collections.invalidate(); toast({ title: d.success ? "Sent to CollBox" : (d as any).error }); } });

  const collectionRate = dashboard ? (dashboard.collectedThisMonth / Math.max(1, dashboard.totalOutstanding + dashboard.collectedThisMonth)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Collections</h1><p className="text-sm text-slate-500">Manage accounts receivable and collections</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isLoading}><RefreshCw className="h-4 w-4 mr-2" /> {syncMut.isLoading ? "Syncing..." : "Sync from Billing"}</Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/settings/collections")}><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200"><CardContent className="pt-4"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Total Outstanding</p></div><p className="text-xl font-bold text-blue-700">{cur(dashboard?.totalOutstanding)}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><p className="text-xs text-slate-500">Overdue ({dashboard?.overdueCount ?? 0})</p></div><p className="text-xl font-bold text-red-700">{cur(dashboard?.overdueAmount)}</p></CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Collected This Month</p></div><p className="text-xl font-bold text-green-700">{cur(dashboard?.collectedThisMonth)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Collection Rate</p></div><p className="text-xl font-bold">{collectionRate.toFixed(1)}%</p></CardContent></Card>
      </div>

      {/* Aging Bar */}
      {dashboard?.aging && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Aging Summary — {cur(dashboard.aging.totalAR)} Total</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-8 rounded-full overflow-hidden">
              {Object.entries(dashboard.aging.buckets).map(([bucket, data]: [string, any]) => {
                const pct = dashboard.aging.totalAR > 0 ? (data.amount / dashboard.aging.totalAR) * 100 : 0;
                if (pct <= 0) return null;
                const colors: Record<string, string> = { CURRENT: "bg-green-400", DAYS_1_30: "bg-lime-400", DAYS_31_60: "bg-amber-400", DAYS_61_90: "bg-orange-400", DAYS_91_120: "bg-red-400", DAYS_OVER_120: "bg-red-600" };
                return <div key={bucket} className={colors[bucket] || "bg-gray-400"} style={{ width: `${pct}%` }} title={`${fmt(bucket)}: ${cur(data.amount)} (${data.count})`} />;
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              {Object.entries(dashboard.aging.buckets).map(([bucket, data]: [string, any]) => (
                <span key={bucket} className="flex items-center gap-1">{fmt(bucket)}: <strong>{cur(data.amount)}</strong> ({data.count})</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{["OPEN","REMINDER_SENT","PAYMENT_PLAN","IN_COLLECTION","SETTLED","WRITTEN_OFF","PAID"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={priorityFilter || "__all__"} onValueChange={(v) => setPriorityFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}</SelectContent>
        </Select>
        <Link href="/collections/reports"><Button variant="outline">Reports</Button></Link>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Late Fees</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Days</TableHead><TableHead>Aging</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(accounts || []).map((a: any) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/collections/${a.id}`)}>
                    <TableCell className="font-medium">{a.invoiceId?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-right font-mono">{cur(Number(a.outstandingBalance))}</TableCell>
                    <TableCell className="text-right font-mono">{Number(a.lateFees) > 0 ? cur(Number(a.lateFees)) : "—"}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{cur(Number(a.totalOwed))}</TableCell>
                    <TableCell><span className={a.daysPastDue > 60 ? "text-red-600 font-bold" : a.daysPastDue > 30 ? "text-amber-600" : ""}>{a.daysPastDue}d</span></TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${AGING_COLORS[a.agingBucket] || ""}`}>{fmt(a.agingBucket)}</span></TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[a.priority] || ""}`}>{a.priority}</span></TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[a.status] || ""}`}>{fmt(a.status)}</span></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => sendReminderMut.mutate({ accountId: a.id })}><Mail className="mr-2 h-3 w-3" /> Send Reminder</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => collboxMut.mutate({ accountId: a.id })}><Send className="mr-2 h-3 w-3" /> Send to CollBox</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (confirm("Write off?")) writeOffMut.mutate({ accountId: a.id, reason: "Manual write-off" }); }}><Ban className="mr-2 h-3 w-3" /> Write Off</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!accounts?.length && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No collection accounts. Click "Sync from Billing" to import overdue invoices.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
