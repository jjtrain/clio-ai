"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

const installmentStatusStyles: Record<string, { className: string; label: string }> = {
  UPCOMING: { className: "bg-gray-100 text-gray-600", label: "Upcoming" },
  DUE: { className: "bg-amber-100 text-amber-700", label: "Due" },
  PAID: { className: "bg-emerald-100 text-emerald-700", label: "Paid" },
  LATE: { className: "bg-red-100 text-red-700", label: "Late" },
  MISSED: { className: "bg-slate-200 text-slate-600", label: "Missed" },
};

const planStatusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  DEFAULTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function PaymentPlanDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const planId = params.id as string;

  const { data: plan, isLoading } = trpc.billingReminders.getPaymentPlan.useQuery({ id: planId });

  const [payDialog, setPayDialog] = useState<{ open: boolean; installmentId: string; amount: string }>({
    open: false,
    installmentId: "",
    amount: "",
  });

  const recordPayment = trpc.billingReminders.recordInstallmentPayment.useMutation({
    onSuccess: (data) => {
      toast({ title: data.isComplete ? "Payment plan completed!" : "Payment recorded" });
      utils.billingReminders.getPaymentPlan.invalidate({ id: planId });
      setPayDialog({ open: false, installmentId: "", amount: "" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markMissed = trpc.billingReminders.markInstallmentMissed.useMutation({
    onSuccess: (data) => {
      toast({
        title: data.defaulted ? "Plan defaulted" : "Installment marked as missed",
        description: data.defaulted ? "3+ missed payments — plan has been defaulted" : undefined,
        variant: data.defaulted ? "destructive" : undefined,
      });
      utils.billingReminders.getPaymentPlan.invalidate({ id: planId });
    },
  });

  const cancelPlan = trpc.billingReminders.cancelPaymentPlan.useMutation({
    onSuccess: () => {
      toast({ title: "Payment plan cancelled" });
      utils.billingReminders.getPaymentPlan.invalidate({ id: planId });
    },
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  if (!plan) {
    return <div className="py-12 text-center text-muted-foreground">Payment plan not found</div>;
  }

  const progress = plan.installmentCount > 0
    ? Math.round((plan.installmentsPaid / plan.installmentCount) * 100)
    : 0;
  const totalPaid = plan.payments
    .filter((p: any) => p.status === "PAID")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
  const remaining = parseFloat(plan.totalAmount.toString()) - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing/reminders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900">Payment Plan</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${planStatusStyles[plan.status]}`}>
                {plan.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm">
              {plan.client.name} · Invoice{" "}
              <Link href={`/billing/${plan.invoice.id}`} className="hover:underline font-mono">
                #{plan.invoice.invoiceNumber}
              </Link>
            </p>
          </div>
        </div>
        {plan.status === "ACTIVE" && (
          <Button
            variant="outline"
            className="text-red-600"
            onClick={() => {
              if (confirm("Cancel this payment plan? Remaining installments will be marked as missed.")) {
                cancelPlan.mutate({ id: planId });
              }
            }}
          >
            Cancel Plan
          </Button>
        )}
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Progress: {plan.installmentsPaid} of {plan.installmentCount} installments</p>
            <p className="text-sm font-bold">{progress}%</p>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold">{formatCurrency(Number(plan.totalAmount))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Installment</p>
            <p className="text-lg font-bold">{formatCurrency(Number(plan.installmentAmount))}</p>
            <p className="text-xs text-muted-foreground capitalize">{plan.frequency.toLowerCase()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(remaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Installment Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Installment Schedule</CardTitle>
          <CardDescription>
            Started {formatDate(plan.startDate)} · Next due: {plan.nextDueDate ? formatDate(plan.nextDueDate) : "N/A"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.payments.map((inst: any, index: number) => {
                const s = installmentStatusStyles[inst.status] || installmentStatusStyles.UPCOMING;
                return (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{formatDate(inst.dueDate)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(Number(inst.amount))}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.className}`}>
                        {s.label}
                      </span>
                    </TableCell>
                    <TableCell>{inst.paidDate ? formatDate(inst.paidDate) : "-"}</TableCell>
                    <TableCell>
                      {(inst.status === "DUE" || inst.status === "LATE") && plan.status === "ACTIVE" && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setPayDialog({
                                open: true,
                                installmentId: inst.id,
                                amount: inst.amount.toString(),
                              })
                            }
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Pay
                          </Button>
                          {inst.status === "LATE" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-600"
                              onClick={() => markMissed.mutate({ installmentId: inst.id })}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Miss
                            </Button>
                          )}
                        </div>
                      )}
                      {inst.status === "UPCOMING" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Upcoming
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {plan.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{plan.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={payDialog.open} onOpenChange={(open) => !open && setPayDialog({ open: false, installmentId: "", amount: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Installment Payment</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              recordPayment.mutate({
                installmentId: payDialog.installmentId,
                amount: parseFloat(payDialog.amount),
              });
            }}
          >
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={payDialog.amount}
                onChange={(e) => setPayDialog({ ...payDialog, amount: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPayDialog({ open: false, installmentId: "", amount: "" })}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordPayment.isLoading}>
                {recordPayment.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
