"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Building2,
  Wallet,
  Users,
  ArrowRight,
  MoreHorizontal,
  FileText,
  Scale,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function TrustAccountingPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [description, setDescription] = useState("");

  const { data: accounts, isLoading } = trpc.trust.listAccounts.useQuery();
  const { data: summary } = trpc.trust.summary.useQuery();

  const createAccount = trpc.trust.createAccount.useMutation({
    onSuccess: () => {
      toast({ title: "Trust account created" });
      utils.trust.listAccounts.invalidate();
      utils.trust.summary.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setAccountName("");
    setAccountNumber("");
    setBankName("");
    setRoutingNumber("");
    setDescription("");
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount.mutate({
      name: accountName,
      accountNumber,
      bankName,
      routingNumber: routingNumber || undefined,
      description: description || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Trust Accounting</h1>
          <p className="text-gray-500 mt-1">Manage IOLTA accounts and client trust funds</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/trust/transactions">
              <FileText className="mr-2 h-4 w-4" />
              Transactions
            </Link>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600 shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Trust Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Main IOLTA Account"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="****1234"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value)}
                      placeholder="021000021"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="First National Bank"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Primary client trust account"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAccount.isLoading}>
                    {createAccount.isLoading ? "Creating..." : "Create Account"}
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
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Trust Funds</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(summary?.totalTrustFunds || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Held for clients</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Trust Accounts</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{summary?.accountCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Active accounts</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Client Ledgers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{summary?.clientLedgerCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Active ledgers</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Trust Accounts List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Trust Accounts</h2>
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-3">Loading accounts...</p>
          </div>
        ) : accounts?.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No trust accounts</p>
            <p className="text-gray-400 text-sm mt-1">Create your first IOLTA account to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {accounts?.map((account) => (
              <div key={account.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <Link
                        href={"/trust/accounts/" + account.id}
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {account.name}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {account.bankName} • ****{account.accountNumber.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Book Balance</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(Number(account.bookBalance))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Bank Balance</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(Number(account.bankBalance))}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Ledgers</p>
                      <p className="text-lg font-semibold text-gray-900">{account._count.ledgers}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={"/trust/accounts/" + account.id}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={"/trust/reconciliation?accountId=" + account.id}>
                            <Scale className="mr-2 h-4 w-4" />
                            Reconcile
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
