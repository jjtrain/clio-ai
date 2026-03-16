"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Sparkles, CheckCircle, XCircle, Search } from "lucide-react";

const MATCH_COLORS: Record<string, string> = {
  AUTO_EXACT: "bg-green-100 text-green-700",
  AUTO_FUZZY: "bg-blue-100 text-blue-700",
  AUTO_RULE: "bg-purple-100 text-purple-700",
  MANUAL: "bg-amber-100 text-amber-700",
  UNMATCHED: "bg-red-100 text-red-700",
};

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ReconciliationWorkspacePage() {
  const { bankAccountId } = useParams<{ bankAccountId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [statementDate, setStatementDate] = useState(new Date().toISOString().split("T")[0]);
  const [statementBalance, setStatementBalance] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const { data: account } = trpc.accounting.getBankAccount.useQuery({ id: bankAccountId });
  const { data: transactions, refetch: refetchTx } = trpc.accounting.listBankTransactions.useQuery({ bankAccountId, limit: 200 });
  const { data: matches } = trpc.reconciliation.getMatches.useQuery({ sessionId: sessionId || "" }, { enabled: !!sessionId });
  const { data: summary } = trpc.reconciliation.getReconciliationSummary.useQuery({ sessionId: sessionId || "" }, { enabled: !!sessionId });

  const startMut = trpc.accounting.startReconciliation.useMutation({
    onSuccess: (d) => { setSessionId(d.id); toast({ title: "Reconciliation started" }); },
  });
  const smartMut = trpc.reconciliation.smartReconcile.useMutation({
    onSuccess: (d) => {
      utils.reconciliation.getMatches.invalidate();
      utils.reconciliation.getReconciliationSummary.invalidate();
      toast({ title: `Smart reconcile: ${d.autoMatched} AI matched, ${d.ruleMatched} rule matched, ${d.unmatched} unmatched` });
    },
  });
  const confirmMut = trpc.reconciliation.confirmMatch.useMutation({
    onSuccess: () => { utils.reconciliation.getMatches.invalidate(); refetchTx(); toast({ title: "Match confirmed" }); },
  });
  const rejectMut = trpc.reconciliation.rejectMatch.useMutation({
    onSuccess: () => { utils.reconciliation.getMatches.invalidate(); },
  });
  const bulkConfirmMut = trpc.reconciliation.bulkConfirm.useMutation({
    onSuccess: (d) => { utils.reconciliation.getMatches.invalidate(); refetchTx(); toast({ title: `${d.confirmed} matches confirmed` }); },
  });
  const completeMut = trpc.accounting.completeReconciliation.useMutation({
    onSuccess: () => { toast({ title: "Reconciliation complete!" }); router.push("/accounting/reconcile"); },
  });

  const matchMap: Record<string, any> = {};
  for (const m of matches || []) matchMap[m.bankTransactionId] = m;

  const reconciledTotal = (transactions || []).filter((t: any) => t.isReconciled).reduce((s: number, t: any) => s + Number(t.amount), 0);
  const stmtBal = Number(statementBalance) || 0;
  const difference = Math.round((reconciledTotal - stmtBal) * 100) / 100;

  const filteredTx = (transactions || []).filter((t: any) => {
    if (filter === "unmatched") return !t.isReconciled && !matchMap[t.id];
    if (filter === "matched") return t.isReconciled || matchMap[t.id];
    return true;
  });

  const highConfMatches = (matches || []).filter((m: any) => Number(m.confidence) >= 90 && !m.isConfirmed);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/accounting/reconcile"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{account?.name || "Bank Reconciliation"}</h1>
        </div>
        {!sessionId && (
          <div className="flex items-center gap-2">
            <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} className="w-40" />
            <Input type="number" step="0.01" placeholder="Statement balance" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} className="w-40" />
            <Button onClick={() => startMut.mutate({ bankAccountId, statementDate, statementBalance: stmtBal })}>Start</Button>
          </div>
        )}
        {sessionId && (
          <Button onClick={() => smartMut.mutate({ sessionId })} disabled={smartMut.isLoading} className="bg-purple-600 hover:bg-purple-700">
            <Sparkles className="h-4 w-4 mr-2" /> {smartMut.isLoading ? "Reconciling..." : "Smart Reconcile"}
          </Button>
        )}
      </div>

      {/* Summary Bar */}
      {sessionId && (
        <div className="grid grid-cols-5 gap-3">
          <Card><CardContent className="pt-3 text-center"><p className="text-xs text-slate-500">Statement</p><p className="font-bold">{cur(stmtBal)}</p></CardContent></Card>
          <Card><CardContent className="pt-3 text-center"><p className="text-xs text-slate-500">Cleared</p><p className="font-bold">{cur(reconciledTotal)}</p></CardContent></Card>
          <Card className={Math.abs(difference) < 0.01 ? "border-green-300" : "border-red-300"}>
            <CardContent className="pt-3 text-center"><p className="text-xs text-slate-500">Difference</p><p className={`font-bold ${Math.abs(difference) < 0.01 ? "text-green-600" : "text-red-600"}`}>{cur(difference)}</p></CardContent>
          </Card>
          <Card><CardContent className="pt-3 text-center"><p className="text-xs text-slate-500">Matched</p><p className="font-bold">{summary?.totalMatches ?? 0} / {transactions?.length ?? 0}</p></CardContent></Card>
          <Card><CardContent className="pt-3 text-center">
            <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${transactions?.length ? ((summary?.confirmed ?? 0) / transactions.length) * 100 : 0}%` }} /></div>
            <p className="text-xs text-slate-500 mt-1">{Math.round(transactions?.length ? ((summary?.confirmed ?? 0) / transactions.length) * 100 : 0)}% complete</p>
          </CardContent></Card>
        </div>
      )}

      {sessionId && (
        <div className="grid grid-cols-3 gap-4" style={{ height: "calc(100vh - 320px)" }}>
          {/* LEFT: Bank Transactions */}
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-2 bg-slate-50 border-b flex gap-1">
              {["all", "unmatched", "matched"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded text-xs font-medium ${filter === f ? "bg-blue-500 text-white" : "text-slate-600 hover:bg-slate-200"}`}>
                  {f === "all" ? "All" : f === "unmatched" ? "Unmatched" : "Matched"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredTx.map((tx: any) => {
                const match = matchMap[tx.id];
                const isSelected = tx.id === selectedTxId;
                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTxId(tx.id)}
                    className={`px-3 py-2 border-b cursor-pointer text-sm ${isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""} ${!tx.isReconciled && !match ? "bg-amber-50" : ""} ${tx.isReconciled ? "opacity-60" : ""}`}
                  >
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</span>
                      <span className={`font-mono font-medium ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{cur(Number(tx.amount))}</span>
                    </div>
                    <p className="truncate">{tx.description}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {tx.isReconciled && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {match && !match.isConfirmed && <span className={`inline-flex px-1 py-0 rounded text-[10px] font-medium ${MATCH_COLORS[match.matchType]}`}>{Number(match.confidence).toFixed(0)}%</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER: Match Panel */}
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-2 bg-slate-50 border-b"><p className="text-xs font-medium text-slate-600">Match Suggestions</p></div>
            <div className="flex-1 overflow-y-auto p-3">
              {selectedTxId ? (
                matchMap[selectedTxId] ? (
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg bg-blue-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MATCH_COLORS[matchMap[selectedTxId].matchType]}`}>
                          {fmt(matchMap[selectedTxId].matchType)}
                        </span>
                        <span className="text-sm font-bold">{Number(matchMap[selectedTxId].confidence).toFixed(0)}% confidence</span>
                      </div>
                      <p className="text-sm">{matchMap[selectedTxId].matchedEntityType ? `${fmt(matchMap[selectedTxId].matchedEntityType)}` : "Categorized"}</p>
                      {!matchMap[selectedTxId].isConfirmed && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="bg-green-600" onClick={() => confirmMut.mutate({ matchId: matchMap[selectedTxId].id })}>Confirm</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectMut.mutate({ matchId: matchMap[selectedTxId].id })}>Reject</Button>
                        </div>
                      )}
                      {matchMap[selectedTxId].isConfirmed && <p className="text-xs text-green-600 mt-1">Confirmed</p>}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    <p>No match found for this transaction.</p>
                    <p className="text-xs mt-1">Run Smart Reconcile or match manually.</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">Select a transaction to see matches</div>
              )}
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="border rounded-lg overflow-hidden flex flex-col">
            <div className="p-2 bg-slate-50 border-b"><p className="text-xs font-medium text-slate-600">Actions</p></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {highConfMatches.length > 0 && (
                <Button className="w-full" variant="outline" onClick={() => bulkConfirmMut.mutate({ matchIds: highConfMatches.map((m: any) => m.id) })}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Confirm All High-Confidence ({highConfMatches.length})
                </Button>
              )}

              {summary && (
                <div className="text-sm space-y-1 p-3 bg-slate-50 rounded">
                  <p>Auto-Exact: <strong>{summary.byType.autoExact}</strong></p>
                  <p>AI Fuzzy: <strong>{summary.byType.autoFuzzy}</strong></p>
                  <p>Rule: <strong>{summary.byType.autoRule}</strong></p>
                  <p>Manual: <strong>{summary.byType.manual}</strong></p>
                  <p className="pt-1 border-t">Confirmed: <strong>{summary.confirmed}</strong></p>
                  <p>Pending: <strong>{summary.pending}</strong></p>
                </div>
              )}

              {sessionId && Math.abs(difference) < 0.01 && (
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => completeMut.mutate({ sessionId })}>
                  Complete Reconciliation
                </Button>
              )}
              {sessionId && Math.abs(difference) >= 0.01 && (
                <p className="text-xs text-red-600 text-center">Difference must be $0.00 to complete</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
