"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
  Printer,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  FileText,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function TrustStatementPage() {
  const params = useParams();

  const { data: statement, isLoading } = trpc.trust.getClientStatement.useQuery(
    { trustLedgerId: params.id as string },
    { enabled: !!params.id }
  );

  const handlePrint = () => {
    window.print();
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

  if (!statement) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Ledger not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/trust">Back to Trust Accounts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header - Hidden on Print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={"/trust/accounts/" + statement.ledger.trustAccountId}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Client Trust Statement</h1>
            <p className="text-gray-500 mt-1">Transaction history for client trust funds</p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Statement
        </Button>
      </div>

      {/* Statement Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 print:shadow-none print:border-0">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Trust Account Statement</h2>
            <p className="text-gray-500 mt-1">{statement.trustAccount.name}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Statement Date: {formatDate(new Date())}</p>
            <p>Account: ****{statement.trustAccount.accountNumber.slice(-4)}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Client Information */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Client</p>
            <p className="text-lg font-semibold text-gray-900">{statement.client.name}</p>
            {statement.client.email && (
              <p className="text-gray-600">{statement.client.email}</p>
            )}
            {statement.matter && (
              <p className="text-gray-500 mt-2">
                Matter: {statement.matter.name}
              </p>
            )}
          </div>

          {/* Balance Summary */}
          <div className="bg-blue-50 rounded-lg p-6">
            <p className="text-sm font-medium text-blue-700 uppercase tracking-wide">Current Balance</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">
              {formatCurrency(statement.ledger.balance)}
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Held in trust as of {formatDate(new Date())}
            </p>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-emerald-700">Total Deposits</p>
            <p className="text-xl font-bold text-emerald-900">
              {formatCurrency(statement.totalDeposits)}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-red-700">Total Withdrawals</p>
            <p className="text-xl font-bold text-red-900">
              {formatCurrency(statement.totalWithdrawals)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-gray-700">Transactions</p>
            <p className="text-xl font-bold text-gray-900">
              {statement.transactions.length}
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h3>
          {statement.transactions.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-lg">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No transactions recorded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-600 w-16">TX #</TableHead>
                  <TableHead className="font-semibold text-gray-600">Date</TableHead>
                  <TableHead className="font-semibold text-gray-600">Type</TableHead>
                  <TableHead className="font-semibold text-gray-600">Description</TableHead>
                  <TableHead className="font-semibold text-gray-600">Reference</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Deposit</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Withdrawal</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.transactions.map((tx: any) => {
                  const isCredit = ["DEPOSIT", "TRANSFER_IN", "INTEREST", "VOID_REVERSAL"].includes(tx.type);
                  const isVoided = tx.isVoided;
                  return (
                    <TableRow key={tx.id} className={isVoided ? "opacity-50 line-through" : ""}>
                      <TableCell className="text-gray-400 text-xs font-mono">
                        {tx.transactionNumber}
                        {isVoided && <span className="text-red-500 ml-1">V</span>}
                      </TableCell>
                      <TableCell className="text-gray-500">{formatDate(tx.transactionDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx.type)}
                          <span className="text-sm">{tx.type.replace(/_/g, " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate">{tx.description}</p>
                        {tx.payee && (
                          <p className="text-xs text-gray-500">Payee: {tx.payee}</p>
                        )}
                        {tx.payor && (
                          <p className="text-xs text-gray-500">From: {tx.payor}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {tx.reference || tx.checkNumber || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {isCredit && !isVoided ? formatCurrency(tx.amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {!isCredit && !isVoided ? formatCurrency(tx.amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(tx.runningBalance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-sm text-gray-500 print:mt-12">
          <p className="font-medium text-gray-700">Important Notice:</p>
          <p className="mt-1">
            This statement reflects the balance of funds held in trust on behalf of the above-named client.
            These funds are maintained in an IOLTA account in accordance with applicable rules of professional conduct.
            This statement is provided for informational purposes only.
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
