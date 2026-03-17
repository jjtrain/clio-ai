"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, RefreshCw, Loader2, Target, Trash2 } from "lucide-react";

function fmtCurrency(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`; return `$${v.toFixed(0)}`; }

const STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "bg-emerald-100 text-emerald-700", AT_RISK: "bg-amber-100 text-amber-700",
  BEHIND: "bg-red-100 text-red-700", EXCEEDED: "bg-blue-100 text-blue-700", COMPLETED: "bg-gray-100 text-gray-700",
};
const BAR_COLORS: Record<string, string> = {
  ON_TRACK: "bg-emerald-500", AT_RISK: "bg-amber-500", BEHIND: "bg-red-500", EXCEEDED: "bg-blue-500", COMPLETED: "bg-gray-500",
};

export default function BudgetsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", targetType: "REVENUE", period: `${new Date().getFullYear()}`, periodType: "ANNUAL", targetAmount: "" });

  const { data: budgets, isLoading } = trpc.finInsights["budgets.list"].useQuery();
  const { data: variance } = trpc.finInsights["budgets.getVariance"].useQuery();

  const createMut = trpc.finInsights["budgets.create"].useMutation({
    onSuccess: () => { utils.finInsights["budgets.list"].invalidate(); setShowCreate(false); toast({ title: "Budget created" }); },
  });
  const deleteMut = trpc.finInsights["budgets.delete"].useMutation({
    onSuccess: () => { utils.finInsights["budgets.list"].invalidate(); toast({ title: "Budget deleted" }); },
  });
  const evaluateMut = trpc.finInsights["budgets.evaluate"].useMutation({
    onSuccess: () => { utils.finInsights["budgets.list"].invalidate(); utils.finInsights["budgets.getVariance"].invalidate(); toast({ title: "Budgets evaluated" }); },
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets & Targets</h1>
          <p className="text-sm text-slate-500">Track financial targets and performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => evaluateMut.mutate()} disabled={evaluateMut.isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${evaluateMut.isLoading ? "animate-spin" : ""}`} />Evaluate
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New Budget</Button>
        </div>
      </div>

      {/* Summary Cards */}
      {variance && (
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-600">{variance.onTrack}</p><p className="text-xs text-gray-500">On Track</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-amber-600">{variance.atRisk}</p><p className="text-xs text-gray-500">At Risk</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-red-600">{variance.behind}</p><p className="text-xs text-gray-500">Behind</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-blue-600">{variance.exceeded}</p><p className="text-xs text-gray-500">Exceeded</p></CardContent></Card>
        </div>
      )}

      {/* Budget List */}
      <div className="space-y-4">
        {(budgets || []).map((budget: any) => {
          const pct = Number(budget.targetAmount) > 0 ? (Number(budget.actualAmount) / Number(budget.targetAmount)) * 100 : 0;
          return (
            <Card key={budget.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{budget.name}</p>
                    <p className="text-xs text-gray-500">{budget.targetType} · {budget.period} · {budget.periodType}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[budget.status] || ""}`}>{budget.status?.replace("_", " ")}</span>
                    <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate({ id: budget.id })}><Trash2 className="h-4 w-4 text-gray-400" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-sm text-gray-600">Actual: <strong>{fmtCurrency(Number(budget.actualAmount))}</strong></span>
                  <span className="text-sm text-gray-600">Target: <strong>{fmtCurrency(Number(budget.targetAmount))}</strong></span>
                  {budget.variance && <span className={`text-sm ${Number(budget.variance) >= 0 ? "text-emerald-600" : "text-red-600"}`}>Variance: {fmtCurrency(Number(budget.variance))}</span>}
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${BAR_COLORS[budget.status] || "bg-gray-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">{pct.toFixed(0)}%</p>
              </CardContent>
            </Card>
          );
        })}
        {(!budgets || budgets.length === 0) && (
          <Card><CardContent className="py-12 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No budgets created yet. Click "New Budget" to start.</p></CardContent></Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2026 Revenue Target" /></div>
            <div><Label>Type</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["REVENUE", "EXPENSE", "PROFIT", "HOURS", "MATTERS", "COLLECTIONS"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Period</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. 2026, 2026-Q1, 2026-03" /></div>
            <div><Label>Period Type</Label>
              <Select value={form.periodType} onValueChange={(v) => setForm({ ...form, periodType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["MONTHLY", "QUARTERLY", "ANNUAL"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Target Amount</Label><Input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} placeholder="e.g. 500000" /></div>
            <Button className="w-full" disabled={!form.name || !form.targetAmount || createMut.isLoading} onClick={() => createMut.mutate({ name: form.name, targetType: form.targetType as any, period: form.period, periodType: form.periodType as any, targetAmount: parseFloat(form.targetAmount) })}>
              {createMut.isLoading ? "Creating..." : "Create Budget"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
