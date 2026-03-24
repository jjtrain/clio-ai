"use client";

import { DollarSign, CreditCard, AlertTriangle, TrendingUp, Shield, Clock, Plus, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const planTypeLabels: Record<string, string> = {
  flat_fee_installment: "Flat Fee",
  retainer_replenishment: "Retainer",
  expense_advance: "Expense",
  payment_arrangement: "Arrangement",
  custom: "Custom",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  defaulted: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function PaymentsDashboard() {
  const { data: stats } = trpc.paymentPlans.getDashboardStats.useQuery();
  const { data: plans } = trpc.paymentPlans.getPlans.useQuery({ status: "active" });
  const { data: compliance } = trpc.paymentPlans.checkCompliance.useQuery();
  const { data: aging } = trpc.paymentPlans.getAgingReport.useQuery();
  const processMutation = trpc.paymentPlans.processScheduled.useMutation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-blue-600" />
            Payments & Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage payment plans, auto-pay, and trust accounting</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => processMutation.mutate()} disabled={processMutation.isLoading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", processMutation.isLoading && "animate-spin")} />
            Process Due
          </Button>
          <Link href="/payment-plans/plan/new">
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Plan</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">${stats.monthlyRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">This Month</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">${stats.totalOutstanding.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Outstanding</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.autoPayRate}%</p>
                <p className="text-xs text-gray-500">Auto-Pay Rate</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", stats.failedThisWeek > 0 ? "bg-red-50" : "bg-green-50")}>
                <AlertTriangle className={cn("h-5 w-5", stats.failedThisWeek > 0 ? "text-red-600" : "text-green-600")} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.failedThisWeek}</p>
                <p className="text-xs text-gray-500">Failed This Week</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Compliance Alert */}
      {compliance && !compliance.compliant && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-semibold">Trust Compliance Issues</span>
          </div>
          <div className="mt-2 space-y-1">
            {compliance.issues.map((issue, i) => (
              <p key={i} className="text-xs text-red-600">{issue.description}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Aging Summary */}
      {aging && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Aging Report</h2>
          <div className="flex items-end gap-2 h-20">
            {[
              { label: "Current", amount: aging.current, color: "bg-green-500" },
              { label: "31-60", amount: aging.days30, color: "bg-yellow-500" },
              { label: "61-90", amount: aging.days60, color: "bg-orange-500" },
              { label: "90+", amount: aging.days90plus, color: "bg-red-500" },
            ].map((bucket) => {
              const total = aging.current + aging.days30 + aging.days60 + aging.days90plus;
              const height = total > 0 ? Math.max((bucket.amount / total) * 100, 5) : 5;
              return (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-gray-600">
                    ${bucket.amount > 1000 ? `${(bucket.amount / 1000).toFixed(0)}k` : bucket.amount.toFixed(0)}
                  </span>
                  <div className={cn("w-full rounded-t-md", bucket.color)} style={{ height: `${height}%` }} />
                  <span className="text-[10px] text-gray-400">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Active Plans */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Payment Plans</h2>
        {plans && plans.length > 0 ? (
          <div className="space-y-2">
            {plans.map((plan) => (
              <Link key={plan.id} href={`/payment-plans/plan/${plan.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{plan.clientName}</p>
                          <Badge className={cn("text-[10px]", statusColors[plan.status] || statusColors.active)}>
                            {plan.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {planTypeLabels[plan.planType] || plan.planType}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{plan.planName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        ${plan.totalPaid.toLocaleString()}{plan.totalAmount ? ` / $${plan.totalAmount.toLocaleString()}` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-gray-500">
                          {plan.completedInstallments}{plan.installmentCount ? ` of ${plan.installmentCount}` : ""} payments
                        </p>
                        {plan.autoPayEnabled && <Zap className="h-3 w-3 text-yellow-500" />}
                      </div>
                      {plan.totalAmount && (
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${(plan.totalPaid / plan.totalAmount) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <CreditCard className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-1">No active payment plans</p>
            <Link href="/payment-plans/plan/new">
              <Button size="sm" className="gap-2 mt-2"><Plus className="h-3.5 w-3.5" /> Create Plan</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
