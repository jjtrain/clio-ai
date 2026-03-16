"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, CheckCircle } from "lucide-react";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function ReconcilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [statementDate, setStatementDate] = useState(new Date().toISOString().split("T")[0]);
  const [statementBalance, setStatementBalance] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: transactions } = trpc.accounting.listBankTransactions.useQuery({ bankAccountId: id, limit: 200 });
  const startMut = trpc.accounting.startReconciliation.useMutation({
    onSuccess: (d) => { setSessionId(d.id); toast({ title: "Reconciliation started" }); },
  });
  const toggleMut = trpc.accounting.toggleReconciled.useMutation({
    onSuccess: () => utils.accounting.listBankTransactions.invalidate(),
  });
  const completeMut = trpc.accounting.completeReconciliation.useMutation({
    onSuccess: () => { toast({ title: "Reconciliation complete" }); router.push(`/accounting/bank/${id}`); },
  });

  const reconciledTotal = (transactions || []).filter((t: any) => t.isReconciled).reduce((s: number, t: any) => s + Number(t.amount), 0);
  const stmtBal = Number(statementBalance) || 0;
  const difference = Math.round((reconciledTotal - stmtBal) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/accounting/bank/${id}`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="space-y-2"><Label>Statement Date</Label><Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Statement Ending Balance</Label><Input type="number" step="0.01" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} /></div>
            {!sessionId && <Button onClick={() => startMut.mutate({ bankAccountId: id, statementDate, statementBalance: stmtBal })}>Start</Button>}
          </div>
        </CardContent>
      </Card>

      {(sessionId || stmtBal > 0) && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Cleared Balance</p><p className="text-lg font-bold">{cur(reconciledTotal)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Statement Balance</p><p className="text-lg font-bold">{cur(stmtBal)}</p></CardContent></Card>
            <Card className={Math.abs(difference) < 0.01 ? "border-green-300" : "border-red-300"}>
              <CardContent className="pt-4"><p className="text-xs text-slate-500">Difference</p><p className={`text-lg font-bold ${Math.abs(difference) < 0.01 ? "text-green-600" : "text-red-600"}`}>{cur(difference)}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-1">
              {(transactions || []).map((tx: any) => (
                <div key={tx.id} className="flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded">
                  <button onClick={() => toggleMut.mutate({ transactionId: tx.id, isReconciled: !tx.isReconciled })}>
                    {tx.isReconciled ? <CheckCircle className="h-5 w-5 text-green-500" /> : <div className="h-5 w-5 rounded border-2 border-gray-300" />}
                  </button>
                  <span className="text-sm text-slate-500 w-24">{new Date(tx.date).toLocaleDateString()}</span>
                  <span className="flex-1 text-sm">{tx.description}</span>
                  <span className={`font-mono font-medium ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{cur(Number(tx.amount))}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {sessionId && (
            <Button disabled={Math.abs(difference) > 0.01 || completeMut.isLoading} onClick={() => completeMut.mutate({ sessionId })}>
              {completeMut.isLoading ? "Completing..." : Math.abs(difference) < 0.01 ? "Complete Reconciliation" : `Difference: ${cur(difference)} — Must be $0.00`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
