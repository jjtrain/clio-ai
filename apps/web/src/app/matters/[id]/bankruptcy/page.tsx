"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Scale, DollarSign, Plus, Trash2, AlertTriangle, CheckCircle, RefreshCw, Loader2, Users, FileText, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MEDIAN_INCOME_EFFECTIVE_DATE } from "@/lib/bankruptcy/median-income";
import { IRS_EFFECTIVE_DATE } from "@/lib/bankruptcy/irs-standards";

const CHAPTERS = ["CHAPTER_7", "CHAPTER_13", "CHAPTER_11", "CHAPTER_12", "UNDETERMINED"];
const INCOME_TYPES = ["WAGES", "SELF_EMPLOYMENT", "RENTAL", "INTEREST_DIVIDENDS", "PENSION_RETIREMENT", "SOCIAL_SECURITY", "UNEMPLOYMENT", "ALIMONY", "CHILD_SUPPORT", "BUSINESS", "OTHER"];
const ASSET_TYPES = ["REAL_PROPERTY", "VEHICLE", "BANK_ACCOUNT", "HOUSEHOLD_GOODS", "RETIREMENT_ACCOUNT", "LIFE_INSURANCE_CSV", "BUSINESS_INTEREST", "OTHER"];
const CREDITOR_TYPES = ["SECURED", "PRIORITY_UNSECURED", "GENERAL_UNSECURED"];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","MA","MD","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function fmt(n: any) { if (n == null) return "—"; return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }

export default function BankruptcyPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddCreditor, setShowAddCreditor] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const caseQuery = trpc.bankruptcy.getOrCreateCase.useQuery({ matterId });
  const updateCaseMut = trpc.bankruptcy.updateCase.useMutation({ onSuccess: () => caseQuery.refetch() });
  const addIncomeMut = trpc.bankruptcy.addIncomeSource.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowAddIncome(false); setF({}); } });
  const deleteIncomeMut = trpc.bankruptcy.deleteIncomeSource.useMutation({ onSuccess: () => caseQuery.refetch() });
  const addAssetMut = trpc.bankruptcy.addAsset.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowAddAsset(false); setF({}); } });
  const deleteAssetMut = trpc.bankruptcy.deleteAsset.useMutation({ onSuccess: () => caseQuery.refetch() });
  const addCreditorMut = trpc.bankruptcy.addCreditor.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowAddCreditor(false); setF({}); } });
  const deleteCreditorMut = trpc.bankruptcy.deleteCreditor.useMutation({ onSuccess: () => caseQuery.refetch() });
  const recalcMut = trpc.bankruptcy.recalculate.useMutation({ onSuccess: () => caseQuery.refetch() });
  const issuesQuery = trpc.bankruptcy.detectIssues.useQuery({ caseId: caseQuery.data?.id || "" }, { enabled: showIssues && !!caseQuery.data?.id });
  const tasksMut = trpc.bankruptcy.autoCreateTasks.useMutation();

  const bc = caseQuery.data;
  if (!bc) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin mx-auto mt-12" /></div>;

  return (
    <div className="p-6 space-y-6">
      {/* Results bar */}
      <Card className="p-4 bg-gradient-to-r from-indigo-50 to-white border-indigo-200 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div><p className="text-[10px] text-muted-foreground">CMI</p><p className="text-lg font-bold font-mono">{fmt(bc.currentMonthlyIncome)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Annualized</p><p className="text-lg font-bold font-mono">{fmt(bc.annualizedIncome)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Median (HH {bc.householdSize})</p><p className="text-lg font-bold font-mono">{fmt(bc.stateMedianIncome)}</p></div>
            <div>{bc.isAboveMedian != null && (bc.isAboveMedian
              ? <Badge className="bg-red-100 text-red-800 text-sm">ABOVE MEDIAN</Badge>
              : <Badge className="bg-green-100 text-green-800 text-sm">BELOW MEDIAN</Badge>)}</div>
            {bc.isAboveMedian && bc.presumptionArises != null && (bc.presumptionArises
              ? <Badge className="bg-red-200 text-red-900 text-sm">PRESUMPTION ARISES</Badge>
              : <Badge className="bg-green-200 text-green-900 text-sm">NO PRESUMPTION</Badge>)}
          </div>
          <div className="flex items-center gap-2">
            {bc.lastCalculatedAt && <span className="text-[10px] text-muted-foreground">Last: {fmtDate(bc.lastCalculatedAt)}</span>}
            <Button size="sm" onClick={() => recalcMut.mutate({ caseId: bc.id })} disabled={recalcMut.isLoading || !bc.filingState}>
              {recalcMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Recalculate
            </Button>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-2">
          <span>Median data: {MEDIAN_INCOME_EFFECTIVE_DATE}</span><span>IRS standards: {IRS_EFFECTIVE_DATE}</span>
          <a href="https://www.justice.gov/ust/means-testing" target="_blank" rel="noopener noreferrer" className="text-blue-500 flex items-center gap-0.5"><ExternalLink className="h-3 w-3" /> Verify current figures</a>
        </div>
      </Card>

      {/* Section 1 — Setup */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Scale className="h-4 w-4" /> Case Setup</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs text-muted-foreground">Chapter</label>
            <div className="flex gap-1 mt-1">{["7", "13", "11"].map((ch) => (
              <button key={ch} onClick={() => updateCaseMut.mutate({ id: bc.id, data: { chapterFiled: `CHAPTER_${ch}` } })}
                className={cn("px-3 py-1.5 rounded text-sm font-medium", bc.chapterFiled === `CHAPTER_${ch}` ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600")}>{ch}</button>
            ))}</div></div>
          <div><label className="text-xs text-muted-foreground">Filing State *</label>
            <Select defaultValue={bc.filingState || ""} onValueChange={(v) => updateCaseMut.mutate({ id: bc.id, data: { filingState: v } })}><SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Filing Date</label>
            <Input type="date" defaultValue={bc.filingDate ? new Date(bc.filingDate).toISOString().split("T")[0] : ""} onBlur={(e) => e.target.value && updateCaseMut.mutate({ id: bc.id, data: { filingDate: e.target.value } })} className="h-8 text-sm mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">Household Size</label>
            <div className="flex items-center gap-1 mt-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCaseMut.mutate({ id: bc.id, data: { householdSize: Math.max(1, bc.householdSize - 1) } })}>-</Button>
              <span className="text-lg font-bold w-8 text-center">{bc.householdSize}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCaseMut.mutate({ id: bc.id, data: { householdSize: bc.householdSize + 1 } })}>+</Button>
            </div></div>
        </div>
        {bc.lookbackStartDate && bc.lookbackEndDate && (
          <p className="text-xs text-muted-foreground mt-2">Lookback: {fmtDate(bc.lookbackStartDate)} through {fmtDate(bc.lookbackEndDate)}</p>
        )}
      </Card>

      {/* Section 2 — Income */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Income Sources ({bc.incomeSources.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddIncome(!showAddIncome)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </CardHeader>
        {showAddIncome && (
          <div className="px-4 pb-3"><div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select onValueChange={(v) => set("i_type", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{INCOME_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Description" onChange={(e) => set("i_desc", e.target.value)} className="h-8 text-sm" />
              {[1,2,3,4,5,6].map((m) => <Input key={m} type="number" placeholder={`Month ${m}`} onChange={(e) => set(`i_m${m}`, Number(e.target.value))} className="h-8 text-sm" />)}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" onChange={(e) => set("i_ss", e.target.checked)} /> Social Security (excluded from CMI)</label>
              <Button size="sm" onClick={() => addIncomeMut.mutate({ caseId: bc.id, sourceType: f.i_type || "WAGES", description: f.i_desc, isSocialSecurity: f.i_ss, month1: f.i_m1, month2: f.i_m2, month3: f.i_m3, month4: f.i_m4, month5: f.i_m5, month6: f.i_m6 })}>Add</Button>
            </div>
          </div></div>
        )}
        <CardContent className="pt-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-2 py-1.5 text-xs font-medium">Source</th>
                {[1,2,3,4,5,6].map((m) => <th key={m} className="text-right px-2 py-1.5 text-xs font-medium">Mo {m}</th>)}
                <th className="text-right px-2 py-1.5 text-xs font-medium">Avg/Mo</th>
                <th className="text-right px-2 py-1.5 text-xs font-medium">Annual</th>
                <th className="px-2"></th>
              </tr></thead>
              <tbody>{bc.incomeSources.map((s: any) => (
                <tr key={s.id} className={cn("border-t", s.isSocialSecurity ? "bg-blue-50/50 line-through opacity-60" : "")}>
                  <td className="px-2 py-1.5"><Badge variant="outline" className="text-[9px]">{s.sourceType.replace(/_/g, " ")}</Badge>{s.isSocialSecurity && <Badge className="text-[9px] bg-blue-100 text-blue-700 ml-1">SS</Badge>}</td>
                  {[s.month1, s.month2, s.month3, s.month4, s.month5, s.month6].map((v: any, i: number) => <td key={i} className="text-right px-2 py-1.5 font-mono text-xs">{fmt(v)}</td>)}
                  <td className="text-right px-2 py-1.5 font-mono font-semibold text-xs">{fmt(s.averageMonthly)}</td>
                  <td className="text-right px-2 py-1.5 font-mono text-xs">{fmt(s.annualAmount)}</td>
                  <td className="px-2"><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => deleteIncomeMut.mutate({ id: s.id })}><Trash2 className="h-3 w-3" /></Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — Assets & Creditors */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">Assets ({bc.assets.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddAsset(!showAddAsset)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </CardHeader>
          {showAddAsset && (
            <div className="px-4 pb-3"><div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 gap-2">
              <Select onValueChange={(v) => set("a_type", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Description" onChange={(e) => set("a_desc", e.target.value)} className="h-8 text-sm" />
              <Input type="number" placeholder="Value" onChange={(e) => set("a_val", Number(e.target.value))} className="h-8 text-sm" />
              <Input type="number" placeholder="Exemption" onChange={(e) => set("a_ex", Number(e.target.value))} className="h-8 text-sm" />
              <Button size="sm" className="col-span-2 w-fit" onClick={() => addAssetMut.mutate({ caseId: bc.id, assetType: f.a_type || "OTHER", description: f.a_desc || "", currentValue: f.a_val || 0, exemptionClaimed: f.a_ex })}>Add</Button>
            </div></div>
          )}
          <CardContent className="pt-0 space-y-1">{bc.assets.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
              <div><Badge variant="outline" className="text-[9px]">{a.assetType.replace(/_/g, " ")}</Badge><span className="ml-1">{a.description}</span></div>
              <div className="flex items-center gap-2"><span className="font-mono">{fmt(a.currentValue)}</span>
                {Number(a.netEquity) > 0 && <Badge className="text-[9px] bg-amber-100 text-amber-700">Equity: {fmt(a.netEquity)}</Badge>}
                <Button variant="ghost" size="sm" onClick={() => deleteAssetMut.mutate({ id: a.id })}><Trash2 className="h-3 w-3" /></Button></div>
            </div>
          ))}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">Creditors ({bc.creditors.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddCreditor(!showAddCreditor)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </CardHeader>
          {showAddCreditor && (
            <div className="px-4 pb-3"><div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 gap-2">
              <Input placeholder="Creditor name" onChange={(e) => set("c_name", e.target.value)} className="h-8 text-sm" />
              <Select onValueChange={(v) => set("c_type", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{CREDITOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
              <Input type="number" placeholder="Claim amount" onChange={(e) => set("c_amt", Number(e.target.value))} className="h-8 text-sm" />
              <Button size="sm" className="w-fit" onClick={() => addCreditorMut.mutate({ caseId: bc.id, creditorName: f.c_name || "", creditorType: f.c_type || "GENERAL_UNSECURED", claimAmount: f.c_amt || 0 })}>Add</Button>
            </div></div>
          )}
          <CardContent className="pt-0 space-y-1">{bc.creditors.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
              <div><Badge variant="outline" className={cn("text-[9px]", c.creditorType === "SECURED" ? "border-blue-300" : c.creditorType === "PRIORITY_UNSECURED" ? "border-amber-300" : "")}>{c.creditorType.replace(/_/g, " ")}</Badge><span className="ml-1">{c.creditorName}</span></div>
              <div className="flex items-center gap-2"><span className="font-mono">{fmt(c.claimAmount)}</span>
                <Button variant="ghost" size="sm" onClick={() => deleteCreditorMut.mutate({ id: c.id })}><Trash2 className="h-3 w-3" /></Button></div>
            </div>
          ))}</CardContent>
        </Card>
      </div>

      {/* Section 5 — Results & Issues */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Results & Issues</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowIssues(!showIssues)}><AlertTriangle className="h-3 w-3 mr-1" /> Detect Issues</Button>
            <Button variant="outline" size="sm" onClick={() => tasksMut.mutate({ caseId: bc.id })} disabled={tasksMut.isLoading}><Plus className="h-3 w-3 mr-1" /> Create Tasks</Button>
          </div>
        </div>

        {/* Presumption banner */}
        {bc.meansTestComplete && (
          <div className={cn("p-4 rounded-lg border mb-4", bc.presumptionArises ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300")}>
            {bc.presumptionArises
              ? <><AlertTriangle className="h-5 w-5 text-red-600 inline mr-2" /><span className="text-red-800 font-semibold">Presumption of abuse arises — rebuttal required</span></>
              : <><CheckCircle className="h-5 w-5 text-green-600 inline mr-2" /><span className="text-green-800 font-semibold">Presumption of abuse does not arise</span></>}
          </div>
        )}

        {showIssues && issuesQuery.data && (
          <div className="space-y-1 mb-4">{issuesQuery.data.map((issue: any, i: number) => (
            <div key={i} className={cn("p-2 rounded border text-xs", issue.severity === "HIGH" ? "bg-red-50 border-red-200 text-red-800" : issue.severity === "MEDIUM" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-gray-50 border-gray-200")}>
              <Badge className={cn("text-[9px]", issue.severity === "HIGH" ? "bg-red-200" : issue.severity === "MEDIUM" ? "bg-amber-200" : "bg-gray-200")}>{issue.severity}</Badge>
              <span className="ml-2 font-medium">{issue.description}</span>
              <p className="text-[11px] mt-0.5 opacity-80">{issue.recommendation}</p>
            </div>
          ))}</div>
        )}

        {bc.snapshots?.length > 0 && (
          <div className="text-xs text-muted-foreground">Last snapshot: {fmtDate(bc.snapshots[0].snapshotDate)} — CMI {fmt(bc.snapshots[0].currentMonthlyIncome)}, {bc.snapshots[0].isAboveMedian ? "above" : "below"} median</div>
        )}
      </Card>
    </div>
  );
}
