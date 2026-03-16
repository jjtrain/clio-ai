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
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const MATCH_TYPES = ["EXACT_AMOUNT", "AMOUNT_RANGE", "DESCRIPTION_CONTAINS", "VENDOR_MATCH", "REGEX"] as const;
const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT_AMOUNT: "bg-green-100 text-green-700", AMOUNT_RANGE: "bg-blue-100 text-blue-700",
  DESCRIPTION_CONTAINS: "bg-purple-100 text-purple-700", VENDOR_MATCH: "bg-amber-100 text-amber-700", REGEX: "bg-slate-100 text-slate-700",
};
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function RulesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);

  const { data: rules } = trpc.reconciliation.listRules.useQuery();
  const createMut = trpc.reconciliation.createRule.useMutation({
    onSuccess: () => { utils.reconciliation.listRules.invalidate(); setAddOpen(false); toast({ title: "Rule created" }); },
  });
  const deleteMut = trpc.reconciliation.deleteRule.useMutation({
    onSuccess: () => { utils.reconciliation.listRules.invalidate(); toast({ title: "Rule deleted" }); },
  });
  const updateMut = trpc.reconciliation.updateRule.useMutation({
    onSuccess: () => utils.reconciliation.listRules.invalidate(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accounting/reconcile"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Reconciliation Rules</h1>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Rule</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Match Type</TableHead><TableHead>Match Value</TableHead><TableHead>Target Category</TableHead><TableHead>Times Matched</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(rules || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MATCH_TYPE_COLORS[r.matchType] || ""}`}>{fmt(r.matchType)}</span></TableCell>
                  <TableCell className="font-mono text-sm">{r.matchValue}</TableCell>
                  <TableCell>{r.targetCategory || "—"}</TableCell>
                  <TableCell>{r.timesMatched}</TableCell>
                  <TableCell>
                    <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${r.isActive ? "bg-green-500" : "bg-gray-200"}`}
                      onClick={() => updateMut.mutate({ id: r.id, isActive: !r.isActive })}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${r.isActive ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) deleteMut.mutate({ id: r.id }); }}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rules?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No rules yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Reconciliation Rule</DialogTitle></DialogHeader>
          <RuleForm onSubmit={(d: any) => createMut.mutate(d)} isLoading={createMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ name: "", matchType: "DESCRIPTION_CONTAINS", matchValue: "", tolerance: "", targetCategory: "" });
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Match Type</Label>
        <Select value={form.matchType} onValueChange={(v) => setForm({ ...form, matchType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MATCH_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Match Value *</Label><Input value={form.matchValue} onChange={(e) => setForm({ ...form, matchValue: e.target.value })} placeholder={form.matchType === "EXACT_AMOUNT" ? "100.00" : "keyword or pattern"} /></div>
      {form.matchType === "AMOUNT_RANGE" && (
        <div className="space-y-2"><Label>Tolerance (+/-)</Label><Input type="number" step="0.01" value={form.tolerance} onChange={(e) => setForm({ ...form, tolerance: e.target.value })} /></div>
      )}
      <div className="space-y-2"><Label>Target Category</Label><Input value={form.targetCategory} onChange={(e) => setForm({ ...form, targetCategory: e.target.value })} placeholder="e.g. Bank Fees" /></div>
      <Button className="w-full" disabled={!form.name || !form.matchValue || isLoading} onClick={() => onSubmit({
        name: form.name, matchType: form.matchType, matchValue: form.matchValue,
        tolerance: form.tolerance ? Number(form.tolerance) : undefined,
        targetCategory: form.targetCategory || undefined,
      })}>
        {isLoading ? "Creating..." : "Create Rule"}
      </Button>
    </div>
  );
}
