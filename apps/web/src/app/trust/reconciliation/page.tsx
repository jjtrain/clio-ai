"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Scale,
  Printer,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function ReconciliationContent() {
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("accountId") || "";
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [accountId, setAccountId] = useState(initialAccountId);
  const [bankBalance, setBankBalance] = useState("");

  const { data: accounts } = trpc.trust.listAccounts.useQuery();
  const { data: reconciliation, isLoading } = trpc.trust.getReconciliation.useQuery(
    { trustAccountId: accountId },
    { enabled: !!accountId }
  );

  const updateAccount = trpc.trust.updateAccount.useMutation({
    onSuccess: () => {
      toast({ title: "Bank balance updated" });
      utils.trust.getReconciliation.invalidate();
      utils.trust.listAccounts.invalidate();
    },
  });

  const markCleared = trpc.trust.markTransactionCleared.useMutation({
    onSuccess: () => {
      utils.trust.getReconciliation.invalidate();
    },
  });

  const handleUpdateBankBalance = () => {
    if (!bankBalance || !accountId) return;
    updateAccount.mutate({
      id: accountId,
      bankBalance: parseFloat(bankBalance),
    });
    setBankBalance("");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/trust">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Three-Way Reconciliation</h1>
            <p className="text-gray-500 mt-1">Reconcile bank balance, book balance, and client ledgers</p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Account Selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 print:hidden">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Trust Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {accountId && (
            <>
              <div className="space-y-2">
                <Label>Update Bank Statement Balance</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={bankBalance}
                    onChange={(e) => setBankBalance(e.target.value)}
                    placeholder={reconciliation ? formatCurrency(reconciliation.bankBalance) : "0.00"}
                    step="0.01"
                  />
                  <Button onClick={handleUpdateBankBalance} disabled={!bankBalance}>
                    Update
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Last Reconciled</Label>
                <p className="text-gray-600 pt-2">
                  {reconciliation?.account.lastReconciledAt
                    ? formatDate(reconciliation.account.lastReconciledAt)
                    : "Never"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {accountId && reconciliation && (
        <>
          {/* Reconciliation Status */}
          <div className={`rounded-xl border p-6 ${
            reconciliation.isReconciled
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex items-center gap-4">
              {reconciliation.isReconciled ? (
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              ) : (
                <AlertCircle className="h-8 w-8 text-amber-600" />
              )}
              <div>
                <h2 className={`text-lg font-semibold ${
                  reconciliation.isReconciled ? "text-emerald-800" : "text-amber-800"
                }`}>
                  {reconciliation.isReconciled ? "Account Reconciled" : "Account Out of Balance"}
                </h2>
                <p className={reconciliation.isReconciled ? "text-emerald-600" : "text-amber-600"}>
                  {reconciliation.isReconciled
                    ? "Bank balance, book balance, and client ledger totals match."
                    : `Difference of ${formatCurrency(Math.abs(reconciliation.difference))} needs to be resolved.`}
                </p>
              </div>
            </div>
          </div>

          {/* Three-Way Reconciliation Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:shadow-none">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Reconciliation Summary</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">{reconciliation.account.name}</p>
            </div>
            <div className="p-6">
              <div className="grid gap-6 md:grid-cols-3">
                {/* Bank Balance */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-4">1. Bank Balance</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Statement Balance</span>
                      <span className="font-medium text-blue-900">{formatCurrency(reconciliation.bankBalance)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Less: Uncleared Deposits</span>
                      <span>-{formatCurrency(reconciliation.unclearedDeposits)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Plus: Uncleared Withdrawals</span>
                      <span>+{formatCurrency(reconciliation.unclearedWithdrawals)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200 font-semibold">
                      <span className="text-blue-900">Adjusted Bank Balance</span>
                      <span className="text-blue-900">{formatCurrency(reconciliation.adjustedBankBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Book Balance */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-4">2. Book Balance</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Sum of All Ledger Balances</span>
                      <span className="font-medium text-purple-900">{formatCurrency(reconciliation.bookBalance)}</span>
                    </div>
                    <div className="pt-8">
                      <div className="flex justify-between pt-2 border-t border-purple-200 font-semibold">
                        <span className="text-purple-900">Book Balance</span>
                        <span className="text-purple-900">{formatCurrency(reconciliation.bookBalance)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Client Ledger Total */}
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <h3 className="font-semibold text-emerald-900 mb-4">3. Client Ledger Total</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Total Client Balances</span>
                      <span className="font-medium text-emerald-900">{formatCurrency(reconciliation.clientLedgerTotal)}</span>
                    </div>
                    <div className="pt-8">
                      <div className="flex justify-between pt-2 border-t border-emerald-200 font-semibold">
                        <span className="text-emerald-900">Ledger Total</span>
                        <span className="text-emerald-900">{formatCurrency(reconciliation.clientLedgerTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Difference */}
              {!reconciliation.isReconciled && (
                <div className="mt-6 p-4 bg-red-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-900">Difference (Out of Balance)</span>
                    <span className="text-xl font-bold text-red-600">{formatCurrency(reconciliation.difference)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client Ledger Breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:shadow-none">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Client Ledger Breakdown</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-600">Client</TableHead>
                  <TableHead className="font-semibold text-gray-600">Matter</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliation.ledgers.map((ledger) => (
                  <TableRow key={ledger.id}>
                    <TableCell className="font-medium">{ledger.client.name}</TableCell>
                    <TableCell className="text-gray-500">{ledger.matter?.name || "General"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(ledger.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(reconciliation.clientLedgerTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Uncleared Transactions */}
          {reconciliation.unclearedTransactions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Uncleared Transactions</h2>
                <p className="text-sm text-gray-500 mt-1">Check transactions that have cleared the bank</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-12">Cleared</TableHead>
                    <TableHead className="font-semibold text-gray-600">Date</TableHead>
                    <TableHead className="font-semibold text-gray-600">Type</TableHead>
                    <TableHead className="font-semibold text-gray-600">Client</TableHead>
                    <TableHead className="font-semibold text-gray-600">Description</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliation.unclearedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Checkbox
                          checked={tx.isCleared}
                          onCheckedChange={(checked) => {
                            markCleared.mutate({
                              id: tx.id,
                              isCleared: checked as boolean,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-gray-500">{formatDate(tx.transactionDate)}</TableCell>
                      <TableCell>{tx.type.replace("_", " ")}</TableCell>
                      <TableCell>{tx.trustLedger.client.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        ["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type)
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}>
                        {["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type) ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!accountId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Scale className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select a trust account to reconcile</p>
        </div>
      )}
    </div>
  );
}

export default function TrustReconciliationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <ReconciliationContent />
    </Suspense>
  );
}
