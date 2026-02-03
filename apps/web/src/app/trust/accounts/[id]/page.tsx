"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  FileText,
  Scale,
  Building2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function TrustAccountDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<string>("DEPOSIT");
  const [clientId, setClientId] = useState("");
  const [matterId, setMatterId] = useState("none");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [payee, setPayee] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: account, isLoading } = trpc.trust.getAccount.useQuery(
    { id: params.id as string },
    { enabled: !!params.id }
  );

  const { data: clients } = trpc.clients.list.useQuery({});
  const { data: matters } = trpc.matters.list.useQuery({ clientId: clientId || undefined });

  const { data: transactions } = trpc.trust.listTransactions.useQuery(
    { trustAccountId: params.id as string, limit: 20 },
    { enabled: !!params.id }
  );

  const createTransaction = trpc.trust.createTransaction.useMutation({
    onSuccess: () => {
      toast({ title: "Transaction recorded" });
      utils.trust.getAccount.invalidate();
      utils.trust.listTransactions.invalidate();
      utils.trust.summary.invalidate();
      setTransactionDialogOpen(false);
      resetTransactionForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetTransactionForm = () => {
    setTransactionType("DEPOSIT");
    setClientId("");
    setMatterId("none");
    setAmount("");
    setDescription("");
    setReference("");
    setPayee("");
    setCheckNumber("");
    setTransactionDate(new Date().toISOString().split("T")[0]);
  };

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    createTransaction.mutate({
      trustAccountId: params.id as string,
      clientId,
      matterId: matterId !== "none" ? matterId : undefined,
      type: transactionType as any,
      amount: parseFloat(amount),
      description,
      reference: reference || undefined,
      payee: payee || undefined,
      checkNumber: checkNumber || undefined,
      transactionDate,
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "DEPOSIT":
      case "TRANSFER_IN":
      case "INTEREST":
        return <ArrowDownCircle className="h-4 w-4 text-emerald-500" />;
      case "WITHDRAWAL":
      case "TRANSFER_OUT":
      case "BANK_FEE":
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      default:
        return <ArrowRightLeft className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Account not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/trust">Back to Trust Accounts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/trust">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{account.name}</h1>
            <p className="text-gray-500 mt-1">
              {account.bankName} • ****{account.accountNumber.slice(-4)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={"/trust/reconciliation?accountId=" + account.id}>
              <Scale className="mr-2 h-4 w-4" />
              Reconcile
            </Link>
          </Button>
          <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600">
                <Plus className="mr-2 h-4 w-4" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Record Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label>Transaction Type</Label>
                  <Select value={transactionType} onValueChange={setTransactionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPOSIT">Deposit</SelectItem>
                      <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                      <SelectItem value="INTEREST">Interest</SelectItem>
                      <SelectItem value="BANK_FEE">Bank Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={clientId} onValueChange={(v) => { setClientId(v); setMatterId("none"); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {clientId && matters?.matters && matters.matters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Matter (optional)</Label>
                    <Select value={matterId} onValueChange={setMatterId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select matter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific matter</SelectItem>
                        {matters.matters.map((matter) => (
                          <SelectItem key={matter.id} value={matter.id}>
                            {matter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Trust deposit for retainer"
                    required
                  />
                </div>
                {transactionType === "WITHDRAWAL" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payee</Label>
                      <Input
                        value={payee}
                        onChange={(e) => setPayee(e.target.value)}
                        placeholder="Payee name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Check Number</Label>
                      <Input
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        placeholder="1001"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Reference (optional)</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Wire transfer #, check #, etc."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setTransactionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTransaction.isLoading || !clientId}>
                    {createTransaction.isLoading ? "Recording..." : "Record Transaction"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Book Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(Number(account.bookBalance))}</p>
          <p className="text-xs text-gray-500 mt-1">Sum of all client ledgers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Bank Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(Number(account.bankBalance))}</p>
          <p className="text-xs text-gray-500 mt-1">
            {account.lastReconciledAt ? `Last reconciled ${formatDate(account.lastReconciledAt)}` : "Not yet reconciled"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Client Ledgers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{account.ledgers.length}</p>
          <p className="text-xs text-gray-500 mt-1">Active ledgers</p>
        </div>
      </div>

      {/* Client Ledgers */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Client Ledgers</h2>
        </div>
        {account.ledgers.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No client ledgers yet</p>
            <p className="text-gray-400 text-sm mt-1">Record a transaction to create a ledger</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-semibold text-gray-600">Client</TableHead>
                <TableHead className="font-semibold text-gray-600">Matter</TableHead>
                <TableHead className="font-semibold text-gray-600 text-right">Balance</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.ledgers.map((ledger) => (
                <TableRow key={ledger.id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium">{ledger.client.name}</TableCell>
                  <TableCell className="text-gray-500">
                    {ledger.matter?.name || "General"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(ledger.balance))}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={"/trust/statement/" + ledger.id}>
                        Statement
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={"/trust/transactions?accountId=" + account.id}>
              View all
            </Link>
          </Button>
        </div>
        {transactions?.transactions.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No transactions yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-semibold text-gray-600">Date</TableHead>
                <TableHead className="font-semibold text-gray-600">Type</TableHead>
                <TableHead className="font-semibold text-gray-600">Client</TableHead>
                <TableHead className="font-semibold text-gray-600">Description</TableHead>
                <TableHead className="font-semibold text-gray-600 text-right">Amount</TableHead>
                <TableHead className="font-semibold text-gray-600 text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.transactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-gray-500">{formatDate(tx.transactionDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(tx.type)}
                      <span className="text-sm">{tx.type.replace("_", " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>{tx.trustLedger.client.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                  <TableCell className={`text-right font-medium ${
                    ["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type)
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}>
                    {["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type) ? "+" : "-"}
                    {formatCurrency(Number(tx.amount))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(tx.runningBalance))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
