"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, DollarSign, Mail, Send, Ban, Plus, CheckCircle } from "lucide-react";

function cur(n: number | null | undefined) { return n != null ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"; }
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

const ACTIVITY_ICONS: Record<string, string> = {
  REMINDER_EMAIL: "📧", PAYMENT_RECEIVED: "💰", SENT_TO_COLLECTION: "📤", LATE_FEE_APPLIED: "💸",
  NOTE_ADDED: "📝", STATUS_CHANGE: "🔄", WRITE_OFF: "❌", PHONE_CALL: "📞",
};

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");

  const { data: account } = trpc.collections["accounts.getById"].useQuery({ id });

  const addNote = trpc.collections["accounts.addNote"].useMutation({ onSuccess: () => { utils.collections["accounts.getById"].invalidate({ id }); setNote(""); toast({ title: "Note added" }); } });
  const recordPay = trpc.collections["payments.record"].useMutation({ onSuccess: () => { utils.collections["accounts.getById"].invalidate({ id }); setPayAmount(""); toast({ title: "Payment recorded" }); } });
  const sendReminder = trpc.collections["reminders.send"].useMutation({ onSuccess: () => { utils.collections["accounts.getById"].invalidate({ id }); toast({ title: "Reminder sent" }); } });
  const writeOff = trpc.collections.writeOff.useMutation({ onSuccess: () => { utils.collections["accounts.getById"].invalidate({ id }); toast({ title: "Written off" }); } });
  const collboxSubmit = trpc.collections["collbox.submit"].useMutation({ onSuccess: (d) => { utils.collections["accounts.getById"].invalidate({ id }); toast({ title: d.success ? "Sent to CollBox" : (d as any).error }); } });

  if (!account) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/collections"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Collection Account</h1>
            <Badge>{fmt(account.status)}</Badge>
            <Badge variant="secondary">{account.daysPastDue} days past due</Badge>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Original</p><p className="text-lg font-bold">{cur(Number(account.originalAmount))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Outstanding</p><p className="text-lg font-bold text-red-700">{cur(Number(account.outstandingBalance))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Late Fees</p><p className="text-lg font-bold">{cur(Number(account.lateFees))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Owed</p><p className="text-xl font-bold text-blue-700">{cur(Number(account.totalOwed))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Reminders Sent</p><p className="text-lg font-bold">{account.reminderCount}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="external">External Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          {/* Add Note */}
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={!note || addNote.isLoading} onClick={() => addNote.mutate({ accountId: id, note })}>
              <Plus className="h-3 w-3 mr-1" /> Note
            </Button>
          </div>

          {/* Timeline */}
          <Card><CardContent className="pt-4">
            <div className="space-y-3">
              {(account.activities || []).map((a: any) => (
                <div key={a.id} className="flex gap-3 py-2 border-b last:border-0">
                  <span className="text-lg">{ACTIVITY_ICONS[a.activityType] || "📋"}</span>
                  <div className="flex-1">
                    <p className="text-sm">{a.description}</p>
                    {a.amount && <p className="text-sm font-medium text-green-600">{cur(Number(a.amount))}</p>}
                    {a.notes && <p className="text-xs text-slate-500 mt-1">{a.notes}</p>}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
              {!account.activities?.length && <p className="text-slate-500 text-center py-4">No activity yet</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          {/* Record Payment */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Record Payment</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="space-y-1 flex-1"><Label className="text-xs">Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
                <div className="space-y-1 w-32"><Label className="text-xs">Method</Label><Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="Check, CC..." /></div>
                <Button disabled={!payAmount || recordPay.isLoading} onClick={() => recordPay.mutate({ accountId: id, amount: Number(payAmount), paymentMethod: payMethod || undefined })}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Record
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => sendReminder.mutate({ accountId: id })}><Mail className="h-4 w-4 mr-2" /> Send Reminder</Button>
            <Button variant="outline" onClick={() => collboxSubmit.mutate({ accountId: id })}><Send className="h-4 w-4 mr-2" /> Send to CollBox</Button>
            <Button variant="outline" className="text-red-600" onClick={() => { if (confirm("Write off this account?")) writeOff.mutate({ accountId: id, reason: "Manual write-off" }); }}><Ban className="h-4 w-4 mr-2" /> Write Off</Button>
          </div>
        </TabsContent>

        <TabsContent value="external" className="space-y-4">
          {account.collboxAccount ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">CollBox</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><Badge>{account.collboxAccount.collboxStatus || "—"}</Badge></div>
                <div className="flex justify-between"><span className="text-slate-500">Claim ID</span><span className="font-mono">{account.collboxAccount.collboxClaimId || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Recovered</span><span className="text-green-600 font-medium">{cur(Number(account.collboxAccount.amountRecovered))}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Commission</span><span>{cur(Number(account.collboxAccount.commissionCharged))}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-bold">{cur(Number(account.collboxAccount.netRecovered))}</span></div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="pt-6 text-center text-slate-500">
              <p>Not in external collections.</p>
              <Button variant="outline" className="mt-2" onClick={() => collboxSubmit.mutate({ accountId: id })}>Send to CollBox</Button>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
