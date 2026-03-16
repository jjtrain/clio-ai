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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ClipboardCheck, Settings, CheckCircle, XCircle, Clock, Zap, TrendingUp, AlertTriangle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ESCALATED: "bg-orange-100 text-orange-700",
  AUTO_APPROVED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ApprovalsDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("pending");
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const { data: stats } = trpc.approvals.getApprovalStats.useQuery();
  const { data: pendingData } = trpc.approvals.listRequests.useQuery({ status: "PENDING" });
  const { data: historyData } = trpc.approvals.listRequests.useQuery();

  const approveMut = trpc.approvals.approve.useMutation({
    onSuccess: () => { invalidate(); toast({ title: "Approved" }); },
  });
  const rejectMut = trpc.approvals.reject.useMutation({
    onSuccess: () => { invalidate(); setRejectOpen(null); setRejectComment(""); toast({ title: "Rejected" }); },
  });
  const bulkApproveMut = trpc.approvals.bulkApprove.useMutation({
    onSuccess: (d) => { invalidate(); toast({ title: `${d.approved} invoices approved` }); },
  });
  const seedMut = trpc.approvals.seedWorkflows.useMutation({
    onSuccess: (d) => toast({ title: d.seeded ? "Starter workflows created" : "Workflows already exist" }),
  });

  function invalidate() {
    utils.approvals.listRequests.invalidate();
    utils.approvals.getApprovalStats.invalidate();
    utils.approvals.getMyPendingApprovals.invalidate();
  }

  const pendingRequests = pendingData || [];
  const historyRequests = (historyData || []).filter((r: any) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Invoice Approvals</h1>
          {(stats?.pending ?? 0) > 0 && <Badge variant="destructive">{stats?.pending} pending</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/approvals/workflows")}>
            <Settings className="h-4 w-4 mr-2" /> Workflows
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-amber-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Pending</p><p className="text-2xl font-bold text-amber-700">{stats?.pending ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Approved Today</p><p className="text-lg font-bold text-green-600">{stats?.approvedToday ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Rejected Today</p><p className="text-lg font-bold text-red-600">{stats?.rejectedToday ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Avg Approval Time</p><p className="text-lg font-bold">{stats?.avgApprovalTime ?? 0}h</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Approval Rate</p><p className="text-lg font-bold">{stats?.approvalRate ?? 0}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Auto-Approved</p><p className="text-lg font-bold text-blue-600">{stats?.autoApproved ?? 0}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingRequests.length > 0 && (
            <Button variant="outline" onClick={() => {
              if (confirm(`Approve all ${pendingRequests.length} pending requests?`)) {
                bulkApproveMut.mutate({ requestIds: pendingRequests.map((r: any) => r.id) });
              }
            }}>
              <CheckCircle className="h-4 w-4 mr-2" /> Approve All ({pendingRequests.length})
            </Button>
          )}

          <div className="space-y-3">
            {pendingRequests.map((req: any) => {
              const daysWaiting = Math.floor((Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
              const steps: any[] = req.workflow?.steps ? JSON.parse(req.workflow.steps) : [];
              const currentStepInfo = steps.find((s: any) => s.stepNumber === req.currentStep);

              return (
                <Card key={req.id} className={daysWaiting > 7 ? "border-red-200" : daysWaiting > 3 ? "border-amber-200" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <Link href={`/approvals/${req.id}`} className="text-lg font-bold text-blue-600 hover:underline">
                            {req.invoice?.invoiceNumber}
                          </Link>
                          <span className="text-2xl font-bold">{cur(Number(req.invoice?.total))}</span>
                          <Badge variant="secondary">{req.workflow?.name}</Badge>
                          {steps.length > 1 && <span className="text-xs text-slate-500">Step {req.currentStep} of {steps.length}</span>}
                        </div>
                        <p className="text-sm text-slate-600">{req.invoice?.matter?.client?.name} — {req.invoice?.matter?.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>Submitted by {req.submittedBy} on {new Date(req.submittedAt).toLocaleDateString()}</span>
                          {currentStepInfo && <span>Waiting for: {currentStepInfo.approverName}</span>}
                          {daysWaiting > 7 && <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Overdue ({daysWaiting} days)</span>}
                          {daysWaiting > 3 && daysWaiting <= 7 && <span className="text-amber-600 font-medium">Waiting {daysWaiting} days</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveMut.mutate({ requestId: req.id })} disabled={approveMut.isLoading}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => setRejectOpen(req.id)}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/approvals/${req.id}`)}>Details</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!pendingRequests.length && <p className="text-center text-slate-500 py-8">No pending approvals</p>}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approver</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRequests.map((req: any) => {
                      const lastAction = req.actions?.[0];
                      const hours = req.completedAt ? Math.round((new Date(req.completedAt).getTime() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60) * 10) / 10 : null;
                      return (
                        <TableRow key={req.id} className="cursor-pointer" onClick={() => router.push(`/approvals/${req.id}`)}>
                          <TableCell className="font-medium">{req.invoice?.invoiceNumber}</TableCell>
                          <TableCell className="text-right">{cur(Number(req.invoice?.total))}</TableCell>
                          <TableCell>{req.invoice?.matter?.client?.name}</TableCell>
                          <TableCell>{req.workflow?.name}</TableCell>
                          <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>{fmt(req.status)}</span></TableCell>
                          <TableCell>{lastAction?.approverName || "—"}</TableCell>
                          <TableCell>{hours != null ? `${hours}h` : "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{req.completedAt ? new Date(req.completedAt).toLocaleDateString() : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!historyRequests.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No approval history</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={() => { setRejectOpen(null); setRejectComment(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reason *</Label><Textarea rows={3} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Please provide a reason for rejection..." /></div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectOpen(null)}>Cancel</Button>
              <Button variant="destructive" disabled={!rejectComment || rejectMut.isLoading} onClick={() => rejectOpen && rejectMut.mutate({ requestId: rejectOpen, comment: rejectComment })}>
                {rejectMut.isLoading ? "Rejecting..." : "Reject Invoice"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
