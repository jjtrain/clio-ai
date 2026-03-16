"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, MessageSquare, ArrowUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ESCALATED: "bg-orange-100 text-orange-700",
  AUTO_APPROVED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const ACTION_COLORS: Record<string, string> = {
  APPROVED: "text-green-600",
  REJECTED: "text-red-600",
  ESCALATED: "text-orange-600",
  COMMENTED: "text-blue-600",
  AUTO_APPROVED: "text-blue-600",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: req, isLoading } = trpc.approvals.getRequest.useQuery({ id });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [commentText, setCommentText] = useState("");

  const approveMut = trpc.approvals.approve.useMutation({ onSuccess: () => { utils.approvals.getRequest.invalidate({ id }); toast({ title: "Approved" }); } });
  const rejectMut = trpc.approvals.reject.useMutation({ onSuccess: () => { utils.approvals.getRequest.invalidate({ id }); setRejectOpen(false); toast({ title: "Rejected" }); } });
  const escalateMut = trpc.approvals.escalate.useMutation({ onSuccess: () => { utils.approvals.getRequest.invalidate({ id }); toast({ title: "Escalated" }); } });
  const resubmitMut = trpc.approvals.resubmit.useMutation({ onSuccess: () => { utils.approvals.getRequest.invalidate({ id }); toast({ title: "Resubmitted" }); } });
  const commentMut = trpc.approvals.addComment.useMutation({ onSuccess: () => { utils.approvals.getRequest.invalidate({ id }); setCommentText(""); toast({ title: "Comment added" }); } });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!req) return <div className="p-6">Not found</div>;

  const steps: any[] = req.workflow?.steps ? JSON.parse(req.workflow.steps) : [];
  const invoice = req.invoice;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/approvals"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Invoice {invoice?.invoiceNumber} Approval</h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>{fmt(req.status)}</span>
          </div>
          <p className="text-sm text-slate-500">{cur(Number(invoice?.total || 0))} — {invoice?.matter?.client?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invoice Summary */}
        <Card>
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Invoice #</span><span className="font-medium">{invoice?.invoiceNumber}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-lg">{cur(Number(invoice?.total || 0))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Client</span><span>{invoice?.matter?.client?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Matter</span><span>{invoice?.matter?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Practice Area</span><span>{invoice?.matter?.practiceArea || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Due Date</span><span>{invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}</span></div>
            {invoice?.lineItems && invoice.lineItems.length > 0 && (
              <div className="pt-2 border-t mt-2">
                <p className="text-slate-500 mb-1">Line Items:</p>
                {invoice.lineItems.map((li: any) => (
                  <div key={li.id} className="flex justify-between text-xs">
                    <span className="truncate max-w-[200px]">{li.description}</span>
                    <span>{cur(Number(li.amount))}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href={`/billing/${invoice?.id}`} className="text-blue-600 hover:underline text-xs">View Full Invoice</Link>
          </CardContent>
        </Card>

        {/* Workflow Progress */}
        <Card>
          <CardHeader><CardTitle>Approval Steps</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {steps.map((step: any) => {
                const action = (req.actions || []).find((a: any) => a.stepNumber === step.stepNumber && (a.action === "APPROVED" || a.action === "AUTO_APPROVED"));
                const rejected = (req.actions || []).find((a: any) => a.stepNumber === step.stepNumber && a.action === "REJECTED");
                const isCurrent = step.stepNumber === req.currentStep && req.status === "PENDING";
                const isComplete = !!action;
                const isRejected = !!rejected;

                return (
                  <div key={step.stepNumber} className={`flex items-center gap-3 p-3 rounded-lg ${isCurrent ? "bg-amber-50 border border-amber-200" : isComplete ? "bg-green-50" : isRejected ? "bg-red-50" : "bg-gray-50"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isComplete ? "bg-green-500 text-white" : isRejected ? "bg-red-500 text-white" : isCurrent ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-500"
                    }`}>
                      {isComplete ? "✓" : isRejected ? "✗" : step.stepNumber}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{step.approverName}</p>
                      {isComplete && <p className="text-xs text-green-600">Approved {action.actedAt ? new Date(action.actedAt).toLocaleDateString() : ""}</p>}
                      {isRejected && <p className="text-xs text-red-600">Rejected</p>}
                      {isCurrent && <p className="text-xs text-amber-600">Awaiting approval</p>}
                    </div>
                    {step.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Timeline */}
      <Card>
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(req.actions || []).map((action: any) => (
              <div key={action.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`font-medium text-sm ${ACTION_COLORS[action.action] || ""}`}>{fmt(action.action)}</div>
                <div className="flex-1">
                  <p className="text-sm"><strong>{action.approverName}</strong> — Step {action.stepNumber}</p>
                  {action.comment && <p className="text-sm text-slate-600 mt-1">{action.comment}</p>}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(action.actedAt).toLocaleString()}</span>
              </div>
            ))}
            {!req.actions?.length && <p className="text-slate-500 text-center py-4">No activity yet</p>}
          </div>

          {/* Add Comment */}
          <div className="mt-4 flex gap-2">
            <Textarea rows={2} placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1" />
            <Button size="sm" disabled={!commentText || commentMut.isLoading} onClick={() => commentMut.mutate({ requestId: id, comment: commentText })}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-4 flex gap-3">
          {req.status === "PENDING" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => approveMut.mutate({ requestId: id })} disabled={approveMut.isLoading}>
                <CheckCircle className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button variant="outline" onClick={() => escalateMut.mutate({ requestId: id })}>
                <ArrowUp className="h-4 w-4 mr-2" /> Escalate
              </Button>
            </>
          )}
          {req.status === "REJECTED" && (
            <Button onClick={() => resubmitMut.mutate({ requestId: id })}>Resubmit for Approval</Button>
          )}
          {(req.status === "APPROVED" || req.status === "AUTO_APPROVED") && (
            <Button variant="outline" asChild><Link href={`/billing/${invoice?.id}`}>View Invoice</Link></Button>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reason *</Label><Textarea rows={3} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Reason for rejection..." /></div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" disabled={!rejectComment || rejectMut.isLoading} onClick={() => rejectMut.mutate({ requestId: id, comment: rejectComment })}>
                Reject Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
