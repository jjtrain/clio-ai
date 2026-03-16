"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Settings, Play, DollarSign, Clock, TrendingDown, Users, AlertTriangle } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  LATE_FEE: "bg-amber-100 text-amber-700",
  INTEREST: "bg-red-100 text-red-700",
  EARLY_PAYMENT_DISCOUNT: "bg-green-100 text-green-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InterestDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("interest");
  const [typeFilter, setTypeFilter] = useState("");
  const [waiveOpen, setWaiveOpen] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  const { data: stats } = trpc.interest.getStats.useQuery();
  const { data: charges } = trpc.interest.listCharges.useQuery(
    typeFilter ? { type: typeFilter as any } : undefined
  );

  const processAll = trpc.interest.processAllOverdue.useMutation({
    onSuccess: (data) => {
      utils.interest.listCharges.invalidate();
      utils.interest.getStats.invalidate();
      toast({ title: `Processed ${data.processed} invoices`, description: `${data.interestApplied} charges applied (${cur(data.totalInterestAmount)})` });
    },
  });

  const waiveCharge = trpc.interest.waiveCharge.useMutation({
    onSuccess: () => {
      utils.interest.listCharges.invalidate();
      utils.interest.getStats.invalidate();
      setWaiveOpen(null);
      setWaiveReason("");
      toast({ title: "Charge waived" });
    },
  });

  const interestCharges = (charges || []).filter((c: any) => c.type !== "EARLY_PAYMENT_DISCOUNT");
  const discountCharges = (charges || []).filter((c: any) => c.type === "EARLY_PAYMENT_DISCOUNT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Interest & Early Payment Discounts</h1>
          <p className="text-sm text-slate-500">Manage late fees, interest charges, and early payment incentives</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => processAll.mutate()} disabled={processAll.isLoading}>
            <Play className="h-4 w-4 mr-2" /> {processAll.isLoading ? "Processing..." : "Process All Overdue"}
          </Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/billing/interest/settings")}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Interest Charged</p><p className="text-lg font-bold text-red-600">{cur(stats?.totalInterest)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Interest Waived</p><p className="text-lg font-bold">{cur(stats?.totalWaived)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Discounts Given</p><p className="text-lg font-bold text-green-600">{cur(stats?.totalDiscounts)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Avg Days Late</p><p className="text-lg font-bold">{stats?.avgDaysLate ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Overdue Invoices</p><p className="text-lg font-bold">{stats?.overdueCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Clients w/ Interest</p><p className="text-lg font-bold">{stats?.clientsWithInterest ?? 0}</p></CardContent></Card>
      </div>

      {/* Charts */}
      {stats?.byMonth && Object.keys(stats.byMonth).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Interest by Month</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {Object.entries(stats.byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, data]: [string, any]) => {
                  const maxVal = Math.max(...Object.values(stats.byMonth).map((d: any) => d.interest || 1));
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1" title={`${month}: ${cur(data.interest)}`}>
                      <div className="w-full bg-red-400 rounded-t" style={{ height: `${Math.max(4, (data.interest / maxVal) * 100)}%` }} />
                      <span className="text-[8px] text-slate-400">{month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Discounts by Month</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {Object.entries(stats.byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, data]: [string, any]) => {
                  const maxVal = Math.max(...Object.values(stats.byMonth).map((d: any) => d.discounts || 1));
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1" title={`${month}: ${cur(data.discounts)}`}>
                      <div className="w-full bg-green-400 rounded-t" style={{ height: `${Math.max(4, ((data.discounts || 0) / maxVal) * 100)}%` }} />
                      <span className="text-[8px] text-slate-400">{month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="interest">Interest Charges</TabsTrigger>
          <TabsTrigger value="discounts">Early Payment Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="interest" className="space-y-4">
          <div className="flex gap-2">
            <Select value={typeFilter || "__all__"} onValueChange={(v) => setTypeFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Types</SelectItem>
                <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                <SelectItem value="INTEREST">Interest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Days Late</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interestCharges.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell><Link href={`/billing/${c.invoiceId}`} className="text-blue-600 hover:underline">{c.invoice?.invoiceNumber}</Link></TableCell>
                        <TableCell>{c.invoice?.matter?.client?.name || "—"}</TableCell>
                        <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.type] || ""}`}>{fmt(c.type)}</span></TableCell>
                        <TableCell className="text-right font-medium">{cur(Number(c.amount))}</TableCell>
                        <TableCell>{c.rate ? `${(Number(c.rate) * 100).toFixed(2)}%` : "—"}</TableCell>
                        <TableCell>{c.daysLate ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(c.appliedDate).toLocaleDateString()}</TableCell>
                        <TableCell>{c.isWaived ? <span className="text-xs text-slate-500">Waived</span> : <span className="text-xs text-green-600">Active</span>}</TableCell>
                        <TableCell>
                          {!c.isWaived && (
                            <Button variant="ghost" size="sm" onClick={() => setWaiveOpen(c.id)}>Waive</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!interestCharges.length && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No interest charges</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Invoice Amount</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Days Early</TableHead>
                      <TableHead>Applied</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountCharges.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell><Link href={`/billing/${c.invoiceId}`} className="text-blue-600 hover:underline">{c.invoice?.invoiceNumber}</Link></TableCell>
                        <TableCell>{c.invoice?.matter?.client?.name || "—"}</TableCell>
                        <TableCell className="text-right">{cur(Number(c.invoice?.total))}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{cur(Math.abs(Number(c.amount)))}</TableCell>
                        <TableCell>{c.rate ? `${(Number(c.rate) * 100).toFixed(1)}%` : "—"}</TableCell>
                        <TableCell>{c.daysEarly ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(c.appliedDate).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {!discountCharges.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No early payment discounts</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Waive Dialog */}
      <Dialog open={!!waiveOpen} onOpenChange={() => { setWaiveOpen(null); setWaiveReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Waive Interest Charge</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reason *</Label><Input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="Client goodwill, billing error, etc." /></div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setWaiveOpen(null)}>Cancel</Button>
              <Button disabled={!waiveReason || waiveCharge.isLoading} onClick={() => waiveOpen && waiveCharge.mutate({ id: waiveOpen, reason: waiveReason })}>
                {waiveCharge.isLoading ? "Waiving..." : "Waive Charge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
