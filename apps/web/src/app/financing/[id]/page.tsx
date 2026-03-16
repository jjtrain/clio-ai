"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, CheckCircle, Ban, RotateCcw, ExternalLink } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  DENIED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-700",
  EXPIRED: "bg-slate-100 text-slate-600",
};

const STAGES = ["PENDING", "APPROVED", "COMPLETED"];

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinancingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: app, isLoading } = trpc.financing.getById.useQuery({ id });

  const captureMut = trpc.financing.capture.useMutation({
    onSuccess: () => { utils.financing.getById.invalidate({ id }); toast({ title: "Payment captured" }); },
  });
  const voidMut = trpc.financing.void.useMutation({
    onSuccess: () => { utils.financing.getById.invalidate({ id }); toast({ title: "Authorization voided" }); },
  });
  const refundMut = trpc.financing.refund.useMutation({
    onSuccess: () => { utils.financing.getById.invalidate({ id }); toast({ title: "Refund processed" }); },
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!app) return <div className="p-6">Application not found</div>;

  const stageIdx = STAGES.indexOf(app.status);
  const isCancelled = app.status === "CANCELLED" || app.status === "DENIED" || app.status === "EXPIRED";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/financing"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{app.clientName}</h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] || ""}`}>{fmt(app.status)}</span>
          </div>
          <p className="text-sm text-slate-500">{cur(Number(app.amount))} — {app.provider}</p>
        </div>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {STAGES.map((stage, i) => {
              const isActive = i === stageIdx;
              const isPast = i < stageIdx;
              return (
                <div key={stage} className="flex items-center">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    isCancelled && i > 0 ? "bg-gray-50 text-gray-300" :
                    isActive ? STATUS_COLORS[stage] || "bg-blue-100 text-blue-700" :
                    isPast ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                  }`}>
                    {fmt(stage)}
                  </div>
                  {i < STAGES.length - 1 && <div className={`w-8 h-0.5 ${isPast ? "bg-green-300" : "bg-gray-200"}`} />}
                </div>
              );
            })}
            {isCancelled && (
              <>
                <div className="w-8 h-0.5 bg-red-200" />
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status]}`}>{fmt(app.status)}</div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Loan Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Amount</span><span className="font-medium">{cur(Number(app.amount))}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Term</span><span>{app.termMonths ? `${app.termMonths} months` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">APR</span><span>{app.apr ? `${Number(app.apr)}%` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Monthly Payment</span><span className="font-medium">{cur(Number(app.monthlyPayment))}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Total Financed</span><span>{cur(Number(app.totalFinanced))}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Charge ID</span><span className="font-mono text-xs">{app.affirmChargeId || "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Loan ID</span><span className="font-mono text-xs">{app.affirmLoanId || "—"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Client & Invoice</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-slate-500">Client</span><span>{app.clientName}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Email</span><span>{app.clientEmail}</span></div>
            {app.clientPhone && <div className="flex justify-between"><span className="text-sm text-slate-500">Phone</span><span>{app.clientPhone}</span></div>}
            <div className="flex justify-between"><span className="text-sm text-slate-500">Invoice</span><span>{app.invoice?.invoiceNumber || "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Applied</span><span>{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Approved</span><span>{app.approvedAt ? new Date(app.approvedAt).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500">Completed</span><span>{app.completedAt ? new Date(app.completedAt).toLocaleDateString() : "—"}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          {app.status === "PENDING" && app.applicationUrl && (
            <Button variant="outline" onClick={() => window.open(app.applicationUrl!, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Open Checkout
            </Button>
          )}
          {app.status === "PENDING" && (
            <Button variant="outline" onClick={() => voidMut.mutate({ applicationId: app.id })}>
              <Ban className="h-4 w-4 mr-2" /> Cancel Application
            </Button>
          )}
          {app.status === "APPROVED" && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => captureMut.mutate({ applicationId: app.id })} disabled={captureMut.isLoading}>
              <CheckCircle className="h-4 w-4 mr-2" /> {captureMut.isLoading ? "Capturing..." : "Capture Payment"}
            </Button>
          )}
          {app.status === "APPROVED" && (
            <Button variant="outline" onClick={() => voidMut.mutate({ applicationId: app.id })}>
              <Ban className="h-4 w-4 mr-2" /> Void Authorization
            </Button>
          )}
          {app.status === "COMPLETED" && (
            <Button variant="outline" onClick={() => {
              if (confirm(`Refund ${cur(Number(app.amount))}?`)) refundMut.mutate({ applicationId: app.id, amount: Number(app.amount) });
            }}>
              <RotateCcw className="h-4 w-4 mr-2" /> Refund
            </Button>
          )}
          {app.status === "DENIED" && (
            <Button onClick={() => router.push("/financing")}>
              <RotateCcw className="h-4 w-4 mr-2" /> Retry Application
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
