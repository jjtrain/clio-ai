"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle, Pause, Play, Ban, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const paymentStatusConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  completed: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-50" },
  scheduled: { icon: Clock, color: "text-gray-500", bgColor: "bg-gray-50" },
  processing: { icon: Clock, color: "text-blue-500", bgColor: "bg-blue-50" },
  failed: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-50" },
  retrying: { icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-50" },
  skipped: { icon: Ban, color: "text-gray-400", bgColor: "bg-gray-50" },
  waived: { icon: Ban, color: "text-purple-500", bgColor: "bg-purple-50" },
};

export default function PaymentPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, refetch } = trpc.paymentPlans.getPlan.useQuery({ planId: id });
  const pauseMutation = trpc.paymentPlans.pausePlan.useMutation({ onSuccess: () => refetch() });
  const resumeMutation = trpc.paymentPlans.resumePlan.useMutation({ onSuccess: () => refetch() });

  if (!plan) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  const progress = plan.totalAmount ? (plan.totalPaid / plan.totalAmount) * 100 : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/payment-plans">
          <Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{plan.planName}</h1>
          <p className="text-xs text-gray-500">{plan.clientName} · {plan.planType.replace(/_/g, " ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => pauseMutation.mutate({ planId: id, reason: "Attorney paused" })} className="gap-1.5 text-xs">
              <Pause className="h-3 w-3" /> Pause
            </Button>
          )}
          {plan.status === "paused" && (
            <Button size="sm" onClick={() => resumeMutation.mutate({ planId: id })} className="gap-1.5 text-xs">
              <Play className="h-3 w-3" /> Resume
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Payment Progress</p>
            <p className="text-2xl font-bold text-gray-900">
              ${plan.totalPaid.toLocaleString()}
              {plan.totalAmount && <span className="text-gray-400"> / ${plan.totalAmount.toLocaleString()}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{plan.completedInstallments} of {plan.installmentCount || "?"} payments</p>
            {plan.autoPayEnabled && (
              <Badge className="text-[10px] bg-yellow-100 text-yellow-700 mt-1"><Zap className="h-3 w-3 mr-0.5 inline" />Auto-Pay</Badge>
            )}
          </div>
        </div>
        {plan.totalAmount && (
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {plan.nextPaymentDate && (
          <p className="text-xs text-gray-500 mt-2">Next payment: ${plan.installmentAmount} on {new Date(plan.nextPaymentDate).toLocaleDateString()}</p>
        )}
      </Card>

      {/* Payment Schedule */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment Schedule</h2>
        <div className="space-y-1.5">
          {plan.scheduledPayments.map((sp) => {
            const config = paymentStatusConfig[sp.status] || paymentStatusConfig.scheduled;
            const Icon = config.icon;
            return (
              <Card key={sp.id} className={cn("p-3 flex items-center gap-3", sp.status === "failed" && "border-red-200")}>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">#{sp.sequenceNumber}</span>
                    <span className="text-sm font-medium text-gray-900">${sp.amount.toFixed(2)}</span>
                    {sp.lateFeeAmount > 0 && (
                      <span className="text-[10px] text-red-500">+${sp.lateFeeAmount.toFixed(2)} late fee</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{new Date(sp.scheduledDate).toLocaleDateString()}</p>
                </div>
                <Badge className={cn("text-[10px] capitalize", config.bgColor, config.color)}>
                  {sp.status}
                </Badge>
                {sp.failureReason && (
                  <span className="text-[10px] text-red-500">{sp.failureReason}</span>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
