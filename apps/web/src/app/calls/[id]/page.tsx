"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Phone, ArrowUpRight, ArrowDownLeft, Clock, FileText, CheckSquare, Trash2 } from "lucide-react";
import { useState } from "react";

function fmtDuration(s: number) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }
function fmtDate(d: string) { return new Date(d).toLocaleString(); }
function fmt(s: string) { return s.replace(/^(CLS_|CBS_|CCR_)/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

const STATUS_BADGE: Record<string, string> = { CLS_COMPLETED: "bg-green-100 text-green-700", CLS_NO_ANSWER: "bg-gray-100 text-gray-600", CLS_BUSY: "bg-amber-100 text-amber-700", CLS_IN_PROGRESS: "bg-blue-100 text-blue-700" };
const BILLING_BADGE: Record<string, string> = { CBS_DRAFT_CREATED: "bg-green-100 text-green-700", CBS_UNBILLED: "bg-amber-100 text-amber-700", CBS_NOT_BILLABLE: "bg-gray-100 text-gray-600" };

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: call, isLoading } = trpc.tapToCall["get"].useQuery({ callLogId: id });
  const [notes, setNotes] = useState<string | null>(null);

  const updateMut = trpc.tapToCall["update"].useMutation({ onSuccess: () => { toast({ title: "Saved" }); utils.tapToCall.invalidate(); } });
  const createEntryMut = trpc.tapToCall["createTimeEntry"].useMutation({ onSuccess: () => { toast({ title: "Time entry created" }); utils.tapToCall.invalidate(); } });
  const notBillableMut = trpc.tapToCall["markNotBillable"].useMutation({ onSuccess: () => { toast({ title: "Marked not billable" }); utils.tapToCall.invalidate(); } });
  const followUpMut = trpc.tapToCall["createFollowUp"].useMutation({ onSuccess: () => { toast({ title: "Follow-up task created" }); utils.tapToCall.invalidate(); } });
  const deleteMut = trpc.tapToCall["dismiss"].useMutation({ onSuccess: () => { toast({ title: "Call dismissed" }); utils.tapToCall.invalidate(); } });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!call) return <div className="p-8 text-center text-slate-400">Call not found</div>;
  const c = call as any;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.contactName ?? "Unknown"}</h1>
            {c.contactRole && <Badge variant="outline">{fmt(c.contactRole)}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
            {c.direction === "OUTBOUND" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
            <span>{fmtDate(c.callStarted)}</span>
            {c.callDuration != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(c.callDuration)}</span>}
          </div>
        </div>
        <a href={`tel:${c.contactPhone}`}><Button><Phone className="h-4 w-4 mr-2" />{c.contactPhone}</Button></a>
      </div>

      {/* Call Info */}
      <Card>
        <CardHeader><CardTitle>Call Info</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Status</span><div><Badge className={STATUS_BADGE[c.callStatus] ?? "bg-gray-100"}>{fmt(c.callStatus)}</Badge></div></div>
            <div><span className="text-slate-500">Subject</span><p className="font-medium">{c.subject ?? "—"}</p></div>
            <div><span className="text-slate-500">Matter</span>{c.matter ? <Link href={`/matters/${c.matterId}`} className="text-blue-600 hover:underline">{c.matter.name}</Link> : <span>—</span>}</div>
            <div><span className="text-slate-500">Client</span>{c.client ? <Link href={`/clients/${c.clientId}`} className="text-blue-600 hover:underline">{c.client.name}</Link> : <span>—</span>}</div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={notes ?? c.notes ?? ""} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Call notes..." />
          {notes !== null && notes !== (c.notes ?? "") && (
            <Button size="sm" onClick={() => updateMut.mutate({ callLogId: id, notes: notes! })}>Save Notes</Button>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {c.aiNarrative && (
        <Card>
          <CardHeader><CardTitle>AI Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{c.aiNarrative}</p>
            {c.suggestedActivity && <Badge variant="outline" className="mt-2">{c.suggestedActivity}</Badge>}
          </CardContent>
        </Card>
      )}

      {/* Billing */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Billing</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={BILLING_BADGE[c.billingStatus] ?? "bg-gray-100"}>{fmt(c.billingStatus)}</Badge>
            {c.suggestedBillableMinutes && <span className="text-sm text-slate-500">{c.suggestedBillableMinutes} min suggested</span>}
          </div>
          {c.billingStatus === "CBS_UNBILLED" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createEntryMut.mutate({ callLogId: id })} disabled={createEntryMut.isLoading}>Create Time Entry</Button>
              <Button size="sm" variant="outline" onClick={() => notBillableMut.mutate({ callLogId: id })}>Not Billable</Button>
            </div>
          )}
          {c.billingStatus === "CBS_DRAFT_CREATED" && c.timeEntryId && (
            <Link href={`/time-entries/${c.timeEntryId}`} className="text-sm text-blue-600 hover:underline">View Time Entry</Link>
          )}
        </CardContent>
      </Card>

      {/* Follow-Up */}
      {c.followUpRequired && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="h-4 w-4" />Follow-Up</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {c.followUpDate && <p className="text-sm">Due: {new Date(c.followUpDate).toLocaleDateString()}</p>}
            {!c.followUpTaskId ? (
              <Button size="sm" onClick={() => followUpMut.mutate({ callLogId: id })} disabled={followUpMut.isLoading}>Create Task</Button>
            ) : (
              <Link href={`/tasks/${c.followUpTaskId}`} className="text-sm text-blue-600 hover:underline">View Task</Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <a href={`tel:${c.contactPhone}`}><Button variant="outline"><Phone className="h-4 w-4 mr-2" />Call Again</Button></a>
        <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate({ callLogId: id })}><Trash2 className="h-4 w-4 mr-2" />Dismiss</Button>
      </div>
    </div>
  );
}
