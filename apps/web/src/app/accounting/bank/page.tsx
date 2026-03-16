"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Landmark } from "lucide-react";

const TYPES = ["CHECKING", "SAVINGS", "CREDIT_CARD", "MONEY_MARKET", "OTHER"] as const;
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function BankAccountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);

  const { data: accounts } = trpc.accounting.listBankAccounts.useQuery();
  const createMut = trpc.accounting.createBankAccount.useMutation({
    onSuccess: () => { utils.accounting.listBankAccounts.invalidate(); setAddOpen(false); toast({ title: "Account created" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bank Accounts</h1>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Account</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(accounts || []).map((acct: any) => (
          <Card key={acct.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/accounting/bank/${acct.id}`)}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Landmark className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">{acct.name}</p>
                  <p className="text-xs text-slate-500">{fmt(acct.accountType)} {acct.bankName ? `— ${acct.bankName}` : ""} {acct.lastFour ? `****${acct.lastFour}` : ""}</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{cur(Number(acct.currentBalance))}</p>
            </CardContent>
          </Card>
        ))}
        {!accounts?.length && <p className="text-slate-500 col-span-3 text-center py-8">No bank accounts yet</p>}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
          <BankAccountForm onSubmit={(d: any) => createMut.mutate(d)} isLoading={createMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BankAccountForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ name: "", accountType: "CHECKING", bankName: "", lastFour: "" });
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Operating Account" /></div>
      <div className="space-y-2"><Label>Type</Label>
        <Select value={form.accountType} onValueChange={(v) => setForm({ ...form, accountType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Last 4 Digits</Label><Input value={form.lastFour} onChange={(e) => setForm({ ...form, lastFour: e.target.value })} maxLength={4} /></div>
      </div>
      <Button className="w-full" disabled={!form.name || isLoading} onClick={() => onSubmit(form)}>
        {isLoading ? "Creating..." : "Create Account"}
      </Button>
    </div>
  );
}
