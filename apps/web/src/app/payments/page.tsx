"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  CreditCard, DollarSign, TrendingUp, Clock, CheckCircle, Settings,
  Plus, Copy, MoreHorizontal, Send, XCircle, RotateCcw, Link2,
} from "lucide-react";

const LINK_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAID: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const TX_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-purple-100 text-purple-700",
  VOIDED: "bg-gray-100 text-gray-700",
};

const METHOD_COLORS: Record<string, string> = {
  CREDIT_CARD: "bg-blue-100 text-blue-700",
  DEBIT_CARD: "bg-green-100 text-green-700",
  ECHECK: "bg-amber-100 text-amber-700",
  ACH: "bg-teal-100 text-teal-700",
  TAP_TO_PAY: "bg-purple-100 text-purple-700",
  APPLE_PAY: "bg-gray-900 text-white",
  GOOGLE_PAY: "bg-white text-gray-900 border",
  OTHER: "bg-gray-100 text-gray-700",
};

const METHOD_CHART_COLORS: Record<string, string> = {
  CREDIT_CARD: "#3b82f6",
  DEBIT_CARD: "#22c55e",
  ECHECK: "#f59e0b",
  ACH: "#14b8a6",
  APPLE_PAY: "#1f2937",
  GOOGLE_PAY: "#10b981",
  OTHER: "#6b7280",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaymentsDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("links");
  const [createOpen, setCreateOpen] = useState(false);
  const [linkStatusFilter, setLinkStatusFilter] = useState("");
  const [txMethodFilter, setTxMethodFilter] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState("");

  const { data: stats } = trpc.payments.getStats.useQuery();
  const { data: links } = trpc.payments.listLinks.useQuery(
    linkStatusFilter ? { status: linkStatusFilter as any } : undefined
  );
  const { data: transactions } = trpc.payments.listTransactions.useQuery(
    (txMethodFilter || txStatusFilter) ? {
      method: txMethodFilter ? txMethodFilter as any : undefined,
      status: txStatusFilter ? txStatusFilter as any : undefined,
    } : undefined
  );
  const { data: clientsData } = trpc.clients.list.useQuery();
  const { data: invoicesData } = trpc.invoices.list.useQuery({ status: "SENT" });

  const cancelLink = trpc.payments.cancelLink.useMutation({
    onSuccess: () => { utils.payments.listLinks.invalidate(); toast({ title: "Link cancelled" }); },
  });
  const resendLink = trpc.payments.resendLink.useMutation({
    onSuccess: () => toast({ title: "Link resent" }),
  });
  const createLink = trpc.payments.createLink.useMutation({
    onSuccess: (data: any) => {
      utils.payments.listLinks.invalidate();
      setCreateOpen(false);
      toast({ title: "Payment link created" });
      if (data.paymentUrl) {
        navigator.clipboard?.writeText(data.paymentUrl);
        toast({ title: "Link copied to clipboard" });
      }
    },
  });
  const sendLink = trpc.payments.sendLink.useMutation({
    onSuccess: () => { utils.payments.listLinks.invalidate(); toast({ title: "Link sent" }); },
  });
  const refundTx = trpc.payments.refund.useMutation({
    onSuccess: () => { utils.payments.listTransactions.invalidate(); utils.payments.getStats.invalidate(); toast({ title: "Refund processed" }); },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500">Manage payment links and transactions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Payment Link</Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/payments/settings")}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Total Collected</p></div>
            <p className="text-lg font-bold">{cur(stats?.totalProcessed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Transactions</p>
            <p className="text-lg font-bold">{stats?.transactionCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Avg Transaction</p>
            <p className="text-lg font-bold">{cur(stats?.avgTransaction)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Active Links</p></div>
            <p className="text-lg font-bold">{stats?.activeLinks ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Success Rate</p></div>
            <p className="text-lg font-bold">{(stats?.successRate ?? 0).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500">Pending</p></div>
            <p className="text-lg font-bold">{stats?.pendingPayments ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Method */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Payment Method</CardTitle></CardHeader>
          <CardContent>
            {stats?.byMethod && Object.keys(stats.byMethod).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stats.byMethod).sort(([, a], [, b]) => b - a).map(([method, amount]) => {
                  const total = Object.values(stats.byMethod).reduce((s, v) => s + v, 0);
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-28 justify-center ${METHOD_COLORS[method] || ""}`}>{fmt(method)}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(amount / total) * 100}%`, backgroundColor: METHOD_CHART_COLORS[method] || "#6b7280" }} />
                      </div>
                      <span className="text-sm font-medium w-24 text-right">{cur(amount)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No transactions yet</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Volume */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Daily Transaction Volume (30 days)</CardTitle></CardHeader>
          <CardContent>
            {stats?.dailyVolume && Object.keys(stats.dailyVolume).length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {(() => {
                  const entries = Object.entries(stats.dailyVolume).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
                  const max = Math.max(...entries.map(([, v]) => v));
                  return entries.map(([day, vol]) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${cur(vol)}`}>
                      <div className="w-full bg-blue-400 rounded-t" style={{ height: `${Math.max(4, (vol / max) * 100)}%` }} />
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No transactions yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="links">Payment Links</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Payment Links Tab */}
        <TabsContent value="links" className="space-y-4">
          <div className="flex gap-2">
            <Select value={linkStatusFilter || "__all__"} onValueChange={(v) => setLinkStatusFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {["ACTIVE", "PAID", "EXPIRED", "CANCELLED"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent Via</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(links || []).map((link: any) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">{link.title}</TableCell>
                        <TableCell>{link.client?.name || "—"}</TableCell>
                        <TableCell className="text-right">{cur(link.amount)}</TableCell>
                        <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LINK_STATUS_COLORS[link.status]}`}>{fmt(link.status)}</span></TableCell>
                        <TableCell>{link.sentVia ? <Badge variant="secondary">{link.sentVia}</Badge> : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(link.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{link.paidAt ? new Date(link.paidAt).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => {
                                const baseUrl = window.location.origin;
                                navigator.clipboard?.writeText(`${baseUrl}/pay/${link.token}`);
                                toast({ title: "Link copied" });
                              }}>
                                <Copy className="mr-2 h-4 w-4" /> Copy Link
                              </DropdownMenuItem>
                              {link.status === "ACTIVE" && (
                                <>
                                  <DropdownMenuItem onClick={() => sendLink.mutate({ paymentLinkId: link.id, via: "email" })}>
                                    <Send className="mr-2 h-4 w-4" /> Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => resendLink.mutate({ id: link.id })}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Resend
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => cancelLink.mutate({ id: link.id })}>
                                    <XCircle className="mr-2 h-4 w-4 text-red-500" /> Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!links?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No payment links yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex gap-2">
            <Select value={txMethodFilter || "__all__"} onValueChange={(v) => setTxMethodFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All methods" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {["CREDIT_CARD", "DEBIT_CARD", "ECHECK", "ACH", "APPLE_PAY", "GOOGLE_PAY"].map((m) => <SelectItem key={m} value={m}>{fmt(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={txStatusFilter || "__all__"} onValueChange={(v) => setTxStatusFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {["COMPLETED", "PENDING", "FAILED", "REFUNDED"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(transactions || []).map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{tx.client?.name || "—"}</TableCell>
                        <TableCell>{tx.invoice?.invoiceNumber || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{cur(tx.amount)}</TableCell>
                        <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_COLORS[tx.method] || ""}`}>{fmt(tx.method)}</span></TableCell>
                        <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TX_STATUS_COLORS[tx.status] || ""}`}>{fmt(tx.status)}</span></TableCell>
                        <TableCell>{tx.cardLast4 ? `${tx.cardBrand || ""} ****${tx.cardLast4}` : tx.bankName || "—"}</TableCell>
                        <TableCell>
                          {tx.status === "COMPLETED" && (
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Refund ${cur(tx.amount)}?`)) refundTx.mutate({ transactionId: tx.id }); }}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Refund
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!transactions?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No transactions yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Payment Link Dialog */}
      <CreatePaymentLinkDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={clientsData?.clients || []}
        invoices={invoicesData?.invoices || []}
        onSubmit={(data: any) => createLink.mutate(data)}
        isLoading={createLink.isLoading}
      />
    </div>
  );
}

function CreatePaymentLinkDialog({ open, onClose, clients, invoices, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({
    clientId: "", invoiceId: "", title: "", description: "", amount: "",
    allowPartialPayment: false, minimumPayment: "", recipientEmail: "", recipientPhone: "",
    sendVia: "email",
  });

  const selectedClient = form.clientId ? clients.find((c: any) => c.id === form.clientId) : null;
  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const clientList = Array.isArray(clients) ? clients : [];
  const clientInvoices = form.clientId
    ? invoiceList.filter((i: any) => i.matter?.clientId === form.clientId && i.status !== "PAID")
    : [];

  const handleInvoiceSelect = (invoiceId: string) => {
    const inv = invoiceList.find((i: any) => i.id === invoiceId);
    if (inv) {
      const outstanding = Number(inv.total) - Number(inv.amountPaid);
      setForm({
        ...form,
        invoiceId,
        title: `Invoice ${inv.invoiceNumber} Payment`,
        amount: outstanding,
        matterId: inv.matterId,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Payment Link</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={form.clientId} onValueChange={(v) => {
              const c = clientList.find((x: any) => x.id === v);
              setForm({ ...form, clientId: v, recipientEmail: c?.email || "", recipientPhone: c?.phone || "" });
            }}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>{clientList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {clientInvoices.length > 0 && (
            <div className="space-y-2">
              <Label>Invoice (optional)</Label>
              <Select value={form.invoiceId || ""} onValueChange={handleInvoiceSelect}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {clientInvoices.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoiceNumber} — ${(Number(i.total) - Number(i.amountPaid)).toFixed(2)} outstanding
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Payment for services" /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allowPartialPayment} onChange={(e) => setForm({ ...form, allowPartialPayment: e.target.checked })} className="rounded" />
            Allow partial payment
          </label>

          {form.allowPartialPayment && (
            <div className="space-y-2"><Label>Minimum Payment</Label><Input type="number" step="0.01" value={form.minimumPayment} onChange={(e) => setForm({ ...form, minimumPayment: e.target.value })} /></div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Recipient Email</Label><Input value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} /></div>
            <div className="space-y-2"><Label>Recipient Phone</Label><Input value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} /></div>
          </div>

          <div className="space-y-2">
            <Label>Send Via</Label>
            <Select value={form.sendVia} onValueChange={(v) => setForm({ ...form, sendVia: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="none">Don't Send (just create)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isLoading || !form.title || !form.amount} onClick={() => {
              onSubmit({
                clientId: form.clientId || undefined,
                invoiceId: form.invoiceId || undefined,
                matterId: form.matterId || undefined,
                title: form.title,
                description: form.description || undefined,
                amount: Number(form.amount),
                allowPartialPayment: form.allowPartialPayment,
                minimumPayment: form.minimumPayment ? Number(form.minimumPayment) : undefined,
                recipientEmail: form.recipientEmail || undefined,
                recipientPhone: form.recipientPhone || undefined,
              });
            }}>
              {isLoading ? "Creating..." : "Create & Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
