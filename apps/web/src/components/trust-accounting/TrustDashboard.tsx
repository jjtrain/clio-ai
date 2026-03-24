"use client";

import { Landmark, Shield, AlertTriangle, CheckCircle, Clock, DollarSign, Users, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function TrustDashboard() {
  const { data: stats } = trpc.trustAccounting.getDashboardStats.useQuery();
  const { data: accounts } = trpc.trustAccounting.getAccounts.useQuery();
  const { data: alerts } = trpc.trustAccounting.getComplianceAlerts.useQuery({ status: "open" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="h-7 w-7 text-blue-600" />
          Trust Accounting
        </h1>
        <p className="text-sm text-gray-500 mt-1">IOLA/escrow management with 3-way reconciliation and compliance tracking</p>
      </div>

      {/* Compliance Banner */}
      {stats && (
        <Card className={cn("p-4 flex items-center gap-3", stats.compliant ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
          {stats.compliant ? (
            <><CheckCircle className="h-6 w-6 text-green-600" /><div><p className="text-sm font-semibold text-green-700">Trust Accounts Compliant</p><p className="text-xs text-green-600">All compliance checks passed</p></div></>
          ) : (
            <><AlertTriangle className="h-6 w-6 text-red-600" /><div><p className="text-sm font-semibold text-red-700">{stats.criticalIssues} Critical Compliance {stats.criticalIssues === 1 ? "Issue" : "Issues"}</p><p className="text-xs text-red-600">Immediate attention required</p></div></>
          )}
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-2xl font-bold text-gray-900">${stats.trustBalance.toLocaleString()}</p><p className="text-xs text-gray-500">Trust Balance</p></div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center"><Users className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-2xl font-bold text-gray-900">{stats.activeLedgers}</p><p className="text-xs text-gray-500">Active Ledgers</p></div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", stats.reconOverdue > 0 ? "bg-red-50" : "bg-green-50")}>
                <Clock className={cn("h-5 w-5", stats.reconOverdue > 0 ? "text-red-600" : "text-green-600")} />
              </div>
              <div><p className="text-2xl font-bold text-gray-900">{stats.reconOverdue}</p><p className="text-xs text-gray-500">Recon Overdue</p></div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center"><Shield className="h-5 w-5 text-purple-600" /></div>
              <div><p className="text-2xl font-bold text-gray-900">{stats.issueCount}</p><p className="text-xs text-gray-500">Open Issues</p></div>
            </div>
          </Card>
        </div>
      )}

      {/* Compliance Alerts */}
      {alerts && alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" /> Open Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <Card key={alert.id} className={cn("p-3 border-l-4", alert.severity === "critical" ? "border-l-red-500 bg-red-50/50" : alert.severity === "high" ? "border-l-orange-500" : "border-l-yellow-500")}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>
                  </div>
                  <Badge className={cn("text-[10px]", alert.severity === "critical" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")}>{alert.severity}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Accounts */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Trust Accounts</h2>
        <div className="space-y-2">
          {accounts?.map((account) => (
            <Card key={account.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Landmark className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{account.accountName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] capitalize">{account.accountType}</Badge>
                      <span className="text-xs text-gray-400">{account.bankName}</span>
                      <span className="text-xs text-gray-400">{account._count.clientLedgers} ledgers</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">${account.currentBalance.toLocaleString()}</p>
                  {account.lastReconciledAt && (
                    <p className="text-[10px] text-gray-400">Reconciled: {new Date(account.lastReconciledAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
