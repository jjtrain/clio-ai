"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  Filter,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function TransactionsList() {
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("accountId") || "";

  const [accountId, setAccountId] = useState(initialAccountId);
  const [clientId, setClientId] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: accounts } = trpc.trust.listAccounts.useQuery();
  const { data: clients } = trpc.clients.list.useQuery({});

  const { data, isLoading } = trpc.trust.listTransactions.useQuery({
    trustAccountId: accountId || undefined,
    clientId: clientId || undefined,
    type: transactionType as any || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 100,
  });

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/trust">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Trust Transactions</h1>
          <p className="text-gray-500 mt-1">View and filter all trust account transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Filters</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Accounts</SelectItem>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Clients</SelectItem>
                {clients?.clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={transactionType} onValueChange={setTransactionType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="DEPOSIT">Deposit</SelectItem>
                <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
                <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
                <SelectItem value="INTEREST">Interest</SelectItem>
                <SelectItem value="BANK_FEE">Bank Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
            />
          </div>
          <div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold text-gray-600 w-16">TX #</TableHead>
              <TableHead className="font-semibold text-gray-600">Date</TableHead>
              <TableHead className="font-semibold text-gray-600">Account</TableHead>
              <TableHead className="font-semibold text-gray-600">Type</TableHead>
              <TableHead className="font-semibold text-gray-600">Client</TableHead>
              <TableHead className="font-semibold text-gray-600">Description</TableHead>
              <TableHead className="font-semibold text-gray-600">Reference</TableHead>
              <TableHead className="font-semibold text-gray-600 text-right">Amount</TableHead>
              <TableHead className="font-semibold text-gray-600 text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-3">Loading transactions...</p>
                </TableCell>
              </TableRow>
            ) : data?.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <ArrowRightLeft className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No transactions found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                </TableCell>
              </TableRow>
            ) : (
              data?.transactions.map((tx: any) => (
                <TableRow
                  key={tx.id}
                  className={`hover:bg-gray-50/50 ${tx.isVoided ? "opacity-50 bg-red-50/30" : ""}`}
                >
                  <TableCell className="text-gray-400 text-xs font-mono">
                    {tx.transactionNumber}
                    {tx.isVoided && (
                      <span className="ml-1 text-red-500 text-[10px]">VOID</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500">{formatDate(tx.transactionDate)}</TableCell>
                  <TableCell className="text-gray-600">{tx.trustAccount.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(tx.type)}
                      <span className="text-sm">{tx.type.replace(/_/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{tx.trustLedger.client.name}</p>
                      {tx.trustLedger.matter && (
                        <p className="text-xs text-gray-500">{tx.trustLedger.matter.name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="truncate">{tx.description}</p>
                    {tx.enteredBy && (
                      <p className="text-[10px] text-gray-400">by {tx.enteredBy.name || tx.enteredBy.email}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {tx.reference || tx.checkNumber || "-"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${
                    ["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type)
                      ? "text-emerald-600"
                      : tx.type === "VOID_REVERSAL"
                      ? "text-orange-600"
                      : "text-red-600"
                  }`}>
                    {["DEPOSIT", "TRANSFER_IN", "INTEREST", "VOID_REVERSAL"].includes(tx.type) ? "+" : "-"}
                    {formatCurrency(Number(tx.amount))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(tx.runningBalance))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data && data.count > data.transactions.length && (
          <div className="p-4 border-t text-center text-gray-500 text-sm">
            Showing {data.transactions.length} of {data.count} transactions
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrustTransactionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <TransactionsList />
    </Suspense>
  );
}
