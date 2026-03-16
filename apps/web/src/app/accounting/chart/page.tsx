"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Wand2 } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700", LIABILITY: "bg-red-100 text-red-700",
  EQUITY: "bg-purple-100 text-purple-700", REVENUE: "bg-green-100 text-green-700", EXPENSE: "bg-amber-100 text-amber-700",
};
const TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ChartOfAccountsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<string>("ASSET");

  const { data: accounts } = trpc.accounting.listAccounts.useQuery(search ? { search } : undefined);
  const initMut = trpc.accounting.initializeDefaultAccounts.useMutation({
    onSuccess: (d) => { utils.accounting.listAccounts.invalidate(); toast({ title: d.initialized ? `Created ${d.count} accounts` : d.message }); },
  });
  const createMut = trpc.accounting.createAccount.useMutation({
    onSuccess: () => { utils.accounting.listAccounts.invalidate(); setAddOpen(false); toast({ title: "Account created" }); },
  });

  const grouped: Record<string, any[]> = { ASSET: [], LIABILITY: [], EQUITY: [], REVENUE: [], EXPENSE: [] };
  for (const a of accounts || []) { if (!a.parentId && grouped[a.type]) grouped[a.type].push(a); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <div className="flex gap-2">
          {(!accounts || accounts.length === 0) && (
            <Button variant="outline" onClick={() => initMut.mutate()} disabled={initMut.isLoading}>
              <Wand2 className="h-4 w-4 mr-2" /> Initialize Default Accounts
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Account</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search accounts..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {TYPES.map((type) => (
        <Card key={type}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type]}`}>{fmt(type)}</span>
              <CardTitle className="text-sm">{grouped[type]?.length || 0} accounts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {grouped[type]?.length > 0 ? (
              <div className="space-y-1">
                {grouped[type].map((a: any) => (
                  <div key={a.id}>
                    <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 rounded">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-slate-500 w-12">{a.accountNumber}</span>
                        <span className="font-medium">{a.name}</span>
                        {a.subType && <span className="text-xs text-slate-400">{a.subType}</span>}
                        {a.isSystem && <span className="text-xs bg-slate-100 px-1 rounded">System</span>}
                      </div>
                      <span className="font-mono font-medium">{cur(Number(a.currentBalance))}</span>
                    </div>
                    {a.children?.map((child: any) => (
                      <div key={child.id} className="flex items-center justify-between py-1.5 px-3 pl-12 hover:bg-slate-50 rounded text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-400 w-12">{child.accountNumber}</span>
                          <span>{child.name}</span>
                        </div>
                        <span className="font-mono">{cur(Number(child.currentBalance))}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No {fmt(type).toLowerCase()} accounts</p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add Account Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
          <AddAccountForm type={addType} setType={setAddType} onSubmit={(data: any) => createMut.mutate(data)} isLoading={createMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddAccountForm({ type, setType, onSubmit, isLoading }: any) {
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [subType, setSubType] = useState("");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Account Number *</Label><Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="1000" /></div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" /></div>
      <div className="space-y-2"><Label>Sub-Type</Label><Input value={subType} onChange={(e) => setSubType(e.target.value)} placeholder="Current Asset, Operating Expense, etc." /></div>
      <Button className="w-full" disabled={!num || !name || isLoading} onClick={() => onSubmit({ accountNumber: num, name, type, subType: subType || undefined })}>
        {isLoading ? "Creating..." : "Create Account"}
      </Button>
    </div>
  );
}
