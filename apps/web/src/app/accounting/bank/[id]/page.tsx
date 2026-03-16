"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, CheckCircle } from "lucide-react";

const TX_TYPES = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "FEE", "INTEREST", "CHECK", "ACH", "CARD"] as const;
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function BankAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);

  const { data: account } = trpc.accounting.getBankAccount.useQuery({ id });
  const { data: transactions } = trpc.accounting.listBankTransactions.useQuery({ bankAccountId: id });

  const createTx = trpc.accounting.createBankTransaction.useMutation({
    onSuccess: () => { utils.accounting.listBankTransactions.invalidate(); utils.accounting.getBankAccount.invalidate({ id }); setAddOpen(false); toast({ title: "Transaction added" }); },
  });
  const toggleRecon = trpc.accounting.toggleReconciled.useMutation({
    onSuccess: () => utils.accounting.listBankTransactions.invalidate(),
  });

  if (!account) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting/bank"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-sm text-slate-500">{fmt(account.accountType)} {account.bankName ? `— ${account.bankName}` : ""}</p>
        </div>
        <p className="text-3xl font-bold">{cur(Number(account.currentBalance))}</p>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Transaction</Button>
        <Button variant="outline" onClick={() => router.push(`/accounting/bank/${id}/reconcile`)}>Start Reconciliation</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead>Payee</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Reconciled</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(transactions || []).map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell><span className="text-xs">{fmt(tx.type)}</span></TableCell>
                  <TableCell>{tx.payee || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{tx.reference || "—"}</TableCell>
                  <TableCell className={`text-right font-mono font-medium ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{cur(Number(tx.amount))}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleRecon.mutate({ transactionId: tx.id, isReconciled: !tx.isReconciled })}>
                      {tx.isReconciled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded border border-gray-300" />}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {!transactions?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No transactions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <TxForm onSubmit={(d: any) => createTx.mutate({ bankAccountId: id, ...d })} isLoading={createTx.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TxForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().split("T")[0], description: "", amount: "", type: "DEPOSIT", reference: "", payee: "" });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TX_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="space-y-2"><Label>Payee</Label><Input value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} /></div>
      </div>
      <Button className="w-full" disabled={!form.description || !form.amount || isLoading} onClick={() => onSubmit({ ...form, amount: Number(form.amount) })}>
        {isLoading ? "Adding..." : "Add Transaction"}
      </Button>
    </div>
  );
}
