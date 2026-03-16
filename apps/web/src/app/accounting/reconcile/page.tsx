"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Upload, Clock, CheckCircle, AlertTriangle, Settings } from "lucide-react";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function ReconciliationHubPage() {
  const router = useRouter();
  const { data: stats } = trpc.reconciliation.getHubStats.useQuery();
  const { data: bankAccounts } = trpc.accounting.listBankAccounts.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-sm text-slate-500">AI-powered matching and automated reconciliation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/accounting/reconcile/import")}>
            <Upload className="h-4 w-4 mr-2" /> Import Transactions
          </Button>
          <Button variant="outline" onClick={() => router.push("/accounting/reconcile/rules")}>
            <Settings className="h-4 w-4 mr-2" /> Rules
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Accounts to Reconcile</p><p className="text-lg font-bold">{stats?.accountsToReconcile ?? 0}</p></CardContent></Card>
        <Card className="border-amber-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Unreconciled Transactions</p><p className="text-lg font-bold text-amber-700">{stats?.unreconciledCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Last Reconciliation</p><p className="text-lg font-bold">{stats?.lastReconciliation ? new Date(stats.lastReconciliation).toLocaleDateString() : "Never"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Auto-Match Rate</p><p className="text-lg font-bold text-green-600">{stats?.autoMatchRate ?? 0}%</p></CardContent></Card>
      </div>

      {/* Bank Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(bankAccounts || []).map((acct: any) => (
          <Card key={acct.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Landmark className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="font-medium">{acct.name}</p>
                    <p className="text-xs text-slate-500">{acct.bankName} {acct.lastFour ? `****${acct.lastFour}` : ""}</p>
                  </div>
                </div>
                <p className="text-xl font-bold">{cur(Number(acct.currentBalance))}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => router.push(`/accounting/reconcile/${acct.id}`)}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Reconcile
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push(`/accounting/reconcile/import?bankAccountId=${acct.id}`)}>
                  <Upload className="h-4 w-4 mr-1" /> Import CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!bankAccounts?.length && (
          <Card className="col-span-2"><CardContent className="pt-6 text-center text-slate-500">
            No bank accounts. <Link href="/accounting/bank" className="text-blue-600 hover:underline">Add one first</Link>.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
