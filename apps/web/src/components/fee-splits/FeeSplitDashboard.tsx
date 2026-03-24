"use client";

import { GitBranch, DollarSign, FileText, AlertTriangle, CheckCircle, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const typeLabels: Record<string, string> = { referral_fee: "Referral Fee", co_counsel: "Co-Counsel", of_counsel: "Of Counsel", forwarding_fee: "Forwarding Fee" };
const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-600", active: "bg-green-100 text-green-700", disbursing: "bg-blue-100 text-blue-700", completed: "bg-emerald-100 text-emerald-700", pending_consent: "bg-yellow-100 text-yellow-700" };

export function FeeSplitDashboard() {
  const { data: stats } = trpc.feeSplits.getDashboardStats.useQuery();
  const { data: agreements } = trpc.feeSplits.getAgreements.useQuery({});
  const { data: pendingDisb } = trpc.feeSplits.getPendingDisbursements.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-blue-600" />
            Fee Splits
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage referral fees, co-counsel arrangements, and disbursements</p>
        </div>
        <Button className="gap-2">New Agreement</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.activeAgreements}</p><p className="text-xs text-gray-500">Active Agreements</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">{stats.pendingDisbursements}</p><p className="text-xs text-gray-500">Pending Disbursements</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">${stats.totalDisbursed.toLocaleString()}</p><p className="text-xs text-gray-500">Total Disbursed</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-orange-600">{stats.form1099Due}</p><p className="text-xs text-gray-500">1099s Due</p></Card>
        </div>
      )}

      {/* Pending Disbursements */}
      {pendingDisb && pendingDisb.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /> Pending Disbursements</h2>
          <div className="space-y-2">
            {pendingDisb.map((d) => (
              <Card key={d.id} className="p-3 flex items-center justify-between border-l-4 border-l-orange-500">
                <div>
                  <p className="text-sm font-medium text-gray-900">${d.amount.toLocaleString()} — {d.description}</p>
                  <p className="text-xs text-gray-500">{d.agreement?.matterName}</p>
                </div>
                <Badge className={cn("text-[10px]", d.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700")}>{d.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Agreements */}
      {agreements && agreements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Fee Split Agreements</h2>
          <div className="space-y-2">
            {agreements.map((a) => (
              <Card key={a.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{a.matterName || "Matter"}</p>
                      <Badge className={cn("text-[10px]", statusColors[a.status] || "")}>{a.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{typeLabels[a.agreementType] || a.agreementType}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {a.participants.map((p) => (
                        <span key={p.id} className="text-xs text-gray-500">
                          {p.isOurFirm ? "Our Firm" : p.attorneyName || p.firmName}: {p.splitPercentage}%
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    {a.totalFeeAmount && <p className="text-sm font-semibold">${a.totalFeeAmount.toLocaleString()}</p>}
                    {a.recoveryAmount && <p className="text-xs text-gray-400">Recovery: ${a.recoveryAmount.toLocaleString()}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
