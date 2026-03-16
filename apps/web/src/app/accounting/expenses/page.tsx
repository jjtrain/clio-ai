"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Plus, CheckCircle } from "lucide-react";

const CATEGORIES = ["FILING_FEE","COURT_COST","EXPERT_WITNESS","DEPOSITION","TRAVEL","POSTAGE","COPYING","RESEARCH","SERVICE_OF_PROCESS","MEDIATION","OFFICE_SUPPLY","SOFTWARE","INSURANCE","RENT","UTILITIES","MARKETING","OTHER"] as const;
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function ExpensesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("");

  const { data: expenses } = trpc.accounting.listExpenses.useQuery(catFilter ? { category: catFilter as any } : undefined);
  const { data: summary } = trpc.accounting.getExpenseSummary.useQuery();

  const createMut = trpc.accounting.createExpense.useMutation({
    onSuccess: () => { utils.accounting.listExpenses.invalidate(); utils.accounting.getExpenseSummary.invalidate(); setAddOpen(false); toast({ title: "Expense added" }); },
  });
  const markPaid = trpc.accounting.markExpensePaid.useMutation({
    onSuccess: () => { utils.accounting.listExpenses.invalidate(); toast({ title: "Marked paid" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expense Tracking</h1>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold">{cur(summary?.total || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Billable</p><p className="text-lg font-bold text-green-600">{cur(summary?.billable || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Non-Billable</p><p className="text-lg font-bold">{cur(summary?.nonBillable || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Unpaid</p><p className="text-lg font-bold text-red-600">{cur(summary?.unpaid || 0)}</p></CardContent></Card>
      </div>

      <Select value={catFilter || "__all__"} onValueChange={(v) => setCatFilter(v === "__all__" ? "" : v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
        <SelectContent><SelectItem value="__all__">All</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{fmt(c)}</SelectItem>)}</SelectContent>
      </Select>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Matter</TableHead><TableHead>Billable</TableHead><TableHead>Paid</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(expenses || []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</TableCell>
                  <TableCell>{e.vendorName}</TableCell>
                  <TableCell><span className="text-xs">{fmt(e.category)}</span></TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.description}</TableCell>
                  <TableCell className="text-right font-mono">{cur(Number(e.amount))}</TableCell>
                  <TableCell>{e.matter?.name || "—"}</TableCell>
                  <TableCell>{e.isBillable ? <span className="text-green-600 text-xs">Yes</span> : "—"}</TableCell>
                  <TableCell>{e.isPaid ? <CheckCircle className="h-4 w-4 text-green-500" /> : <span className="text-xs text-red-500">Unpaid</span>}</TableCell>
                  <TableCell>{!e.isPaid && <Button variant="ghost" size="sm" onClick={() => markPaid.mutate({ id: e.id })}>Pay</Button>}</TableCell>
                </TableRow>
              ))}
              {!expenses?.length && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No expenses</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <ExpenseForm onSubmit={(data: any) => createMut.mutate(data)} isLoading={createMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ vendorName: "", category: "OTHER", description: "", amount: "", date: new Date().toISOString().split("T")[0], isBillable: false });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Vendor *</Label><Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{fmt(c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label>Description *</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isBillable} onChange={(e) => setForm({ ...form, isBillable: e.target.checked })} className="rounded" /> Billable to client</label>
      <Button className="w-full" disabled={!form.vendorName || !form.amount || !form.description || isLoading} onClick={() => onSubmit({ ...form, amount: Number(form.amount) })}>
        {isLoading ? "Adding..." : "Add Expense"}
      </Button>
    </div>
  );
}
