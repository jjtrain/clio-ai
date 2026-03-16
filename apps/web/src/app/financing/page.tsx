"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Wallet, Plus, Settings, DollarSign, TrendingUp, Clock, CheckCircle,
  MoreHorizontal, ExternalLink, Ban, RotateCcw,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  DENIED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-700",
  EXPIRED: "bg-slate-100 text-slate-600",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinancingDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const { data: stats } = trpc.financing.getStats.useQuery();
  const { data: applications } = trpc.financing.list.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined
  );
  const { data: clientsData } = trpc.clients.list.useQuery();
  const clients = clientsData?.clients || [];

  const captureMut = trpc.financing.capture.useMutation({
    onSuccess: () => { utils.financing.list.invalidate(); utils.financing.getStats.invalidate(); toast({ title: "Payment captured" }); },
  });
  const voidMut = trpc.financing.void.useMutation({
    onSuccess: () => { utils.financing.list.invalidate(); toast({ title: "Authorization voided" }); },
  });
  const createApp = trpc.financing.create.useMutation({
    onSuccess: (data: any) => {
      utils.financing.list.invalidate();
      setCreateOpen(false);
      toast({ title: "Application created" });
      if (data.applicationUrl) window.open(data.applicationUrl, "_blank");
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Financing</h1>
          <p className="text-sm text-slate-500">Affirm pay-over-time for legal services</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Application</Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/financing/settings")}><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Financed</p><p className="text-lg font-bold">{cur(stats?.totalFinanced)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Active Loans</p><p className="text-lg font-bold">{stats?.activeLoans ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Avg Loan</p><p className="text-lg font-bold">{cur(stats?.avgLoanAmount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Approval Rate</p><p className="text-lg font-bold">{(stats?.approvalRate ?? 0).toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Pending</p><p className="text-lg font-bold">{stats?.pendingCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">This Month</p><p className="text-lg font-bold">{cur(stats?.monthVolume)}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {["PENDING", "APPROVED", "COMPLETED", "DENIED", "CANCELLED", "EXPIRED"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Applications Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead>APR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(applications || []).map((app: any) => (
                  <TableRow key={app.id} className="cursor-pointer" onClick={() => router.push(`/financing/${app.id}`)}>
                    <TableCell className="font-medium">{app.clientName}</TableCell>
                    <TableCell className="text-right">{cur(app.amount)}</TableCell>
                    <TableCell>{app.termMonths ? `${app.termMonths} mo` : "—"}</TableCell>
                    <TableCell className="text-right">{cur(app.monthlyPayment)}</TableCell>
                    <TableCell>{app.apr ? `${Number(app.apr)}%` : "—"}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] || ""}`}>{fmt(app.status)}</span></TableCell>
                    <TableCell>{app.invoice?.invoiceNumber || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => router.push(`/financing/${app.id}`)}>View Details</DropdownMenuItem>
                          {app.status === "APPROVED" && (
                            <DropdownMenuItem onClick={() => captureMut.mutate({ applicationId: app.id })}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Capture Payment
                            </DropdownMenuItem>
                          )}
                          {app.status === "APPROVED" && (
                            <DropdownMenuItem onClick={() => voidMut.mutate({ applicationId: app.id })}>
                              <Ban className="mr-2 h-4 w-4" /> Void
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!applications?.length && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No financing applications yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <NewApplicationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={clients}
        onSubmit={(data: any) => createApp.mutate(data)}
        isLoading={createApp.isLoading}
      />
    </div>
  );
}

function NewApplicationDialog({ open, onClose, clients, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ clientId: "", amount: "", clientName: "", clientEmail: "", clientPhone: "" });
  const { data: estimate } = trpc.financing.getEstimate.useQuery(
    { amount: Number(form.amount) || 100 },
    { enabled: Number(form.amount) > 0 }
  );

  const clientList = Array.isArray(clients) ? clients : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Financing Application</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={form.clientId} onValueChange={(v) => {
              const c = clientList.find((x: any) => x.id === v);
              setForm({ ...form, clientId: v, clientName: c?.name || "", clientEmail: c?.email || "", clientPhone: c?.phone || "" });
            }}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clientList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" step="0.01" placeholder="1000.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>

          {estimate && Number(form.amount) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-blue-800">Estimated Monthly Payments:</p>
              <p>{cur(estimate.threeMonth)}/mo for 3 months</p>
              <p>{cur(estimate.sixMonth)}/mo for 6 months</p>
              <p>{cur(estimate.twelveMonth)}/mo for 12 months</p>
              <p className="text-xs text-blue-600 mt-1">Actual terms determined by Affirm during checkout</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Client Name</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Client Email</Label><Input value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} /></div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isLoading || !form.clientId || !form.amount || !form.clientName || !form.clientEmail} onClick={() => {
              onSubmit({
                clientId: form.clientId,
                amount: Number(form.amount),
                clientName: form.clientName,
                clientEmail: form.clientEmail,
                clientPhone: form.clientPhone || undefined,
              });
            }}>
              {isLoading ? "Creating..." : "Start Application"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
