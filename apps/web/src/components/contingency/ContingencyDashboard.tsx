"use client";

import { Scale, DollarSign, TrendingUp, AlertTriangle, Clock, FileText, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function ContingencyDashboard() {
  const { data: stats } = trpc.contingency.getPortfolioStats.useQuery();
  const { data: cases } = trpc.contingency.getCases.useQuery({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Scale className="h-7 w-7 text-blue-600" />
          Contingency Cases
        </h1>
        <p className="text-sm text-gray-500 mt-1">Portfolio management with settlement analysis, expense tracking, and lien negotiation</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.activeCases}</p><p className="text-xs text-gray-500">Active Cases</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">${stats.totalRecovered.toLocaleString()}</p><p className="text-xs text-gray-500">Total Recovered</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-blue-600">${stats.totalFees.toLocaleString()}</p><p className="text-xs text-gray-500">Total Fees</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">{stats.avgROI}%</p><p className="text-xs text-gray-500">Avg ROI</p></Card>
        </div>
      )}

      {/* Expense Exposure */}
      {stats && stats.totalExpensesAdvanced > 0 && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium text-orange-700">Expense Exposure: ${stats.totalExpensesAdvanced.toLocaleString()} advanced across {stats.activeCases} active cases</p>
          </div>
        </Card>
      )}

      {/* Cases */}
      {cases && cases.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Cases</h2>
          <div className="space-y-2">
            {cases.map((c) => (
              <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.matterName || c.clientName || "Case"}</p>
                      <Badge variant="secondary" className="text-[10px] capitalize">{c.caseType?.replace(/_/g, " ") || "PI"}</Badge>
                      <Badge className={cn("text-[10px]", c.status === "active" ? "bg-green-100 text-green-700" : c.status === "settled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600")}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>Fee: {c.effectiveFeePercentage}%</span>
                      <span>Expenses: ${c.totalExpensesAdvanced.toLocaleString()}</span>
                      {c.insurancePolicyLimits && <span>Policy: ${c.insurancePolicyLimits.toLocaleString()}</span>}
                      {c.demandAmount && <span>Demand: ${c.demandAmount.toLocaleString()}</span>}
                      {c.lastOfferAmount && <span>Last Offer: ${c.lastOfferAmount.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {c.settlementTarget && (
                      <p className="text-xs text-gray-400">Target: ${(c.settlementTarget as any).low?.toLocaleString()}-${(c.settlementTarget as any).high?.toLocaleString()}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-400">{c._count.expenses} expenses</span>
                      <span className="text-[10px] text-gray-400">{c._count.liens} liens</span>
                    </div>
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
