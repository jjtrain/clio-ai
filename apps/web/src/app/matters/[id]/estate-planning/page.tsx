"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Home, Landmark, DollarSign, Users, FileText, Plus, Trash2, Check,
  AlertTriangle, ChevronDown, ChevronRight, Shield, Heart, Building2,
  Car, Gem, Loader2, Scale, Pencil, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "REAL_ESTATE", label: "Real Estate", icon: Home },
  { value: "BANK_ACCOUNT", label: "Bank Accounts", icon: Landmark },
  { value: "INVESTMENT_ACCOUNT", label: "Investments", icon: DollarSign },
  { value: "RETIREMENT_ACCOUNT", label: "Retirement", icon: Shield },
  { value: "LIFE_INSURANCE", label: "Life Insurance", icon: Heart },
  { value: "BUSINESS_INTEREST", label: "Business Interests", icon: Building2 },
  { value: "VEHICLE", label: "Vehicles", icon: Car },
  { value: "PERSONAL_PROPERTY", label: "Personal Property", icon: Gem },
  { value: "CRYPTOCURRENCY", label: "Cryptocurrency", icon: DollarSign },
  { value: "OTHER", label: "Other", icon: FileText },
];

const PLAN_TYPES = [
  { value: "WILL_ONLY", label: "Simple Will" },
  { value: "REVOCABLE_TRUST", label: "Revocable Living Trust" },
  { value: "IRREVOCABLE_TRUST", label: "Irrevocable Trust" },
  { value: "POUR_OVER_WILL", label: "Pour-Over Will + Trust" },
  { value: "SPECIAL_NEEDS_TRUST", label: "Special Needs Trust" },
  { value: "COMBINATION", label: "Combination Plan" },
];

const TITLE_HOLDERS = ["CLIENT", "SPOUSE", "JOINT_TENANCY", "TENANCY_IN_COMMON", "TRUST", "LLC", "OTHER"];
const MARITAL_STATUSES = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED", "DOMESTIC_PARTNER"];
const RELATIONSHIPS = ["SPOUSE", "CHILD", "GRANDCHILD", "SIBLING", "PARENT", "FRIEND", "CHARITY", "TRUST", "OTHER"];
const DISPOSITIONS = ["SPECIFIC_BEQUEST", "RESIDUARY", "TRUST_FUNDING", "BENEFICIARY_DESIGNATION", "JOINT_TENANCY_SURVIVORSHIP", "POD", "TOD", "OTHER"];
const GAP_COLORS: Record<string, string> = { HIGH: "bg-red-50 border-red-200 text-red-800", MEDIUM: "bg-amber-50 border-amber-200 text-amber-800", LOW: "bg-gray-50 border-gray-200 text-gray-600" };

function fmt(n: any) { if (n == null) return "—"; return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }

export default function EstatePlanningPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddBenef, setShowAddBenef] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [addCat, setAddCat] = useState("REAL_ESTATE");
  const [selectedBenef, setSelectedBenef] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const profileQuery = trpc.estatePlanning.getOrCreateProfile.useQuery({ matterId });
  const updateProfileMut = trpc.estatePlanning.updateProfile.useMutation({ onSuccess: () => { profileQuery.refetch(); setShowEditProfile(false); } });
  const addAssetMut = trpc.estatePlanning.addAsset.useMutation({ onSuccess: () => { profileQuery.refetch(); setShowAddAsset(false); setF({}); } });
  const deleteAssetMut = trpc.estatePlanning.deleteAsset.useMutation({ onSuccess: () => profileQuery.refetch() });
  const addBenefMut = trpc.estatePlanning.addBeneficiary.useMutation({ onSuccess: () => { profileQuery.refetch(); setShowAddBenef(false); setF({}); } });
  const removeBenefMut = trpc.estatePlanning.removeBeneficiary.useMutation({ onSuccess: () => profileQuery.refetch() });
  const addAllocMut = trpc.estatePlanning.addAllocation.useMutation({ onSuccess: () => profileQuery.refetch() });
  const removeAllocMut = trpc.estatePlanning.removeAllocation.useMutation({ onSuccess: () => profileQuery.refetch() });
  const gapsQuery = trpc.estatePlanning.detectGaps.useQuery({ profileId: profileQuery.data?.id || "", matterId }, { enabled: !!profileQuery.data?.id });
  const memoMut = trpc.estatePlanning.generateSummaryMemo.useMutation({ onSuccess: () => profileQuery.refetch() });
  const assembleDocMut = trpc.estatePlanning.assembleDocument.useMutation({ onSuccess: () => profileQuery.refetch() });

  const p = profileQuery.data;
  const summary = p?.summary;
  const gaps = gapsQuery.data || [];

  // Group assets by category
  const assetsByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const cat of CATEGORIES) groups[cat.value] = [];
    for (const a of (p?.assets || [])) {
      if (!groups[a.assetCategory]) groups[a.assetCategory] = [];
      groups[a.assetCategory].push(a);
    }
    return groups;
  }, [p?.assets]);

  if (!p) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin mx-auto mt-12" /></div>;

  function toggleCat(cat: string) { setExpandedCats((prev) => ({ ...prev, [cat]: prev[cat] === false ? true : false })); }

  return (
    <div className="p-6 space-y-6">
      {/* ═══ SECTION 1 — Profile ═══ */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Scale className="h-5 w-5 text-indigo-600" /> Estate Planning Profile</h2>
          <div className="flex gap-2">
            <Badge variant="outline">{PLAN_TYPES.find((pt) => pt.value === p.planType)?.label || p.planType}</Badge>
            <Button variant="outline" size="sm" onClick={() => setShowEditProfile(!showEditProfile)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Client</h3>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{p.clientFullName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">DOB</span><span>{fmtDate(p.clientDOB)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Domicile</span><span>{p.domicileState || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Marital Status</span><span>{p.maritalStatus}</span></div>
            </div>
          </div>
          <div className={p.spouseName ? "" : "opacity-40"}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Spouse</h3>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{p.spouseName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">DOB</span><span>{fmtDate(p.spouseDOB)}</span></div>
            </div>
          </div>
        </div>

        {/* Fiduciaries */}
        <div className="mt-4 flex flex-wrap gap-2">
          {p.healthcareProxyName && <Badge variant="outline" className="text-xs">Healthcare: {p.healthcareProxyName}</Badge>}
          {p.poaAgentName && <Badge variant="outline" className="text-xs">POA: {p.poaAgentName}</Badge>}
          {p.successorTrusteeName && <Badge variant="outline" className="text-xs">Trustee: {p.successorTrusteeName}</Badge>}
          {p.beneficiaries?.find((b: any) => b.isExecutor) && <Badge variant="outline" className="text-xs">Executor: {p.beneficiaries.find((b: any) => b.isExecutor)?.name}</Badge>}
        </div>

        {/* Goals */}
        {Array.isArray(p.primaryGoals) && (p.primaryGoals as string[]).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">{(p.primaryGoals as string[]).map((g, i) => <Badge key={i} className="text-[10px] bg-indigo-50 text-indigo-700">{g}</Badge>)}</div>
        )}

        {/* Edit form */}
        {showEditProfile && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><label className="text-xs text-muted-foreground">Client Name</label><Input defaultValue={p.clientFullName} onChange={(e) => set("clientFullName", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Domicile State</label><Input defaultValue={p.domicileState || ""} onChange={(e) => set("domicileState", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Marital Status</label><Select defaultValue={p.maritalStatus} onValueChange={(v) => set("maritalStatus", v)}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger><SelectContent>{MARITAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Plan Type</label><Select defaultValue={p.planType} onValueChange={(v) => set("planType", v)}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger><SelectContent>{PLAN_TYPES.map((pt) => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Spouse Name</label><Input defaultValue={p.spouseName || ""} onChange={(e) => set("spouseName", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Healthcare Proxy</label><Input defaultValue={p.healthcareProxyName || ""} onChange={(e) => set("healthcareProxyName", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">POA Agent</label><Input defaultValue={p.poaAgentName || ""} onChange={(e) => set("poaAgentName", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Successor Trustee</label><Input defaultValue={p.successorTrusteeName || ""} onChange={(e) => set("successorTrusteeName", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
            </div>
            <Button size="sm" onClick={() => updateProfileMut.mutate({ id: p.id, data: f })}>Save</Button>
          </div>
        )}
      </Card>

      {/* ═══ SECTION 2 — Assets ═══ */}
      <div>
        {/* Summary bar */}
        {summary && (
          <div className="flex gap-3 mb-4 overflow-x-auto">
            <Card className="p-3 min-w-[120px]"><p className="text-[10px] text-muted-foreground">Gross Estate</p><p className="text-lg font-bold">{fmt(summary.grossEstateValue)}</p></Card>
            <Card className="p-3 min-w-[120px]"><p className="text-[10px] text-muted-foreground">Liabilities</p><p className="text-lg font-bold text-red-600">({fmt(summary.totalLiabilities)})</p></Card>
            <Card className="p-3 min-w-[120px]"><p className="text-[10px] text-muted-foreground">Net Estate</p><p className="text-lg font-bold text-green-700">{fmt(summary.netEstateValue)}</p></Card>
            <Card className="p-3 min-w-[120px]"><p className="text-[10px] text-muted-foreground">Assets</p><p className="text-lg font-bold">{summary.totalAssets}</p></Card>
            {summary.federalEstateTaxExposure && <Card className="p-3 min-w-[120px] border-red-200 bg-red-50"><p className="text-[10px] text-red-600">Tax Exposure</p><p className="text-sm font-bold text-red-700">Above exemption</p></Card>}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" /> Asset Inventory</h2>
          <Button size="sm" onClick={() => setShowAddAsset(!showAddAsset)}><Plus className="h-3 w-3 mr-1" /> Add Asset</Button>
        </div>

        {showAddAsset && (
          <Card className="p-4 mb-4 border-green-200 bg-green-50/30 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><label className="text-xs text-muted-foreground">Category *</label><Select value={addCat} onValueChange={setAddCat}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Description *</label><Input onChange={(e) => set("a_desc", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Estimated Value *</label><Input type="number" onChange={(e) => set("a_value", Number(e.target.value))} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Title Holder</label><Select onValueChange={(v) => set("a_title", v)}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="CLIENT" /></SelectTrigger><SelectContent>{TITLE_HOLDERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Institution</label><Input onChange={(e) => set("a_inst", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Account Last 4</label><Input maxLength={4} onChange={(e) => set("a_acct", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              {addCat === "REAL_ESTATE" && <div><label className="text-xs text-muted-foreground">Property Address</label><Input onChange={(e) => set("a_addr", e.target.value)} className="h-8 text-sm mt-0.5" /></div>}
              <div><label className="text-xs text-muted-foreground">Mortgage/Liability</label><Input type="number" onChange={(e) => set("a_mort", Number(e.target.value))} className="h-8 text-sm mt-0.5" /></div>
            </div>
            <Button size="sm" onClick={() => addAssetMut.mutate({ profileId: p.id, matterId, assetCategory: addCat, description: f.a_desc || "", estimatedValue: f.a_value || 0, titleHolder: f.a_title, institutionName: f.a_inst, accountNumberLast4: f.a_acct, propertyAddress: f.a_addr, mortgageBalance: f.a_mort })} disabled={!f.a_desc || addAssetMut.isLoading}>Add</Button>
          </Card>
        )}

        {/* Asset groups */}
        <div className="space-y-2">
          {CATEGORIES.filter((cat) => assetsByCategory[cat.value]?.length > 0).map((cat) => {
            const catAssets = assetsByCategory[cat.value];
            const catTotal = catAssets.reduce((s: number, a: any) => s + Number(a.estimatedValue), 0);
            const expanded = expandedCats[cat.value] !== false;
            const Icon = cat.icon;
            return (
              <Card key={cat.value}>
                <button onClick={() => toggleCat(cat.value)} className="w-full text-left p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{cat.label}</span>
                    <Badge variant="outline" className="text-[10px]">{catAssets.length}</Badge>
                  </div>
                  <span className="text-sm font-mono font-semibold">{fmt(catTotal)}</span>
                </button>
                {expanded && (
                  <CardContent className="pt-0 space-y-1">
                    {catAssets.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50 text-sm">
                        <div className="flex-1">
                          <span className="font-medium">{a.description}</span>
                          {a.institutionName && <span className="text-muted-foreground ml-2 text-xs">{a.institutionName}{a.accountNumberLast4 ? ` ···${a.accountNumberLast4}` : ""}</span>}
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[9px]">{a.titleHolder}</Badge>
                            {a.hasDesignatedBeneficiary ? <Badge className="text-[9px] bg-green-100 text-green-700"><Check className="h-2 w-2 inline mr-0.5" />Benef.</Badge> : a.isRetirement && <Badge className="text-[9px] bg-red-100 text-red-700"><AlertTriangle className="h-2 w-2 inline mr-0.5" />No Benef.</Badge>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-semibold">{fmt(a.estimatedValue)}</span>
                          {(Number(a.mortgageBalance) > 0 || Number(a.liabilityAmount) > 0) && <p className="text-[10px] text-red-600">Liab: {fmt(Number(a.mortgageBalance || 0) + Number(a.liabilityAmount || 0))}</p>}
                        </div>
                        <Button variant="ghost" size="sm" className="ml-2 text-muted-foreground" onClick={() => { if (confirm(`Delete "${a.description}"?`)) deleteAssetMut.mutate({ id: a.id }); }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
          {(p.assets?.length || 0) === 0 && <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">No assets added yet</p></Card>}
        </div>
      </div>

      {/* ═══ SECTION 3 — Beneficiaries ═══ */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Beneficiaries ({p.beneficiaries?.length || 0})</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddBenef(!showAddBenef)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </div>

        {showAddBenef && (
          <div className="p-3 bg-blue-50/30 rounded-lg mb-3 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input placeholder="Name *" onChange={(e) => set("b_name", e.target.value)} className="h-8 text-sm" />
              <Select onValueChange={(v) => set("b_rel", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Relationship" /></SelectTrigger><SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Share %" type="number" onChange={(e) => set("b_pct", Number(e.target.value))} className="h-8 text-sm" />
              <Input placeholder="Email" onChange={(e) => set("b_email", e.target.value)} className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={() => addBenefMut.mutate({ profileId: p.id, name: f.b_name || "", relationship: f.b_rel || "OTHER", sharePercentage: f.b_pct, email: f.b_email })} disabled={!f.b_name}>Add</Button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          {(p.beneficiaries || []).map((b: any) => (
            <div key={b.id} className={cn("p-3 rounded-lg border cursor-pointer", selectedBenef === b.id ? "border-blue-400 bg-blue-50/30" : "")} onClick={() => setSelectedBenef(selectedBenef === b.id ? null : b.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold">{b.name}</span>
                  <Badge variant="outline" className="text-[9px] ml-2">{b.relationship}</Badge>
                  {b.isMinor && <Badge className="text-[9px] bg-amber-100 text-amber-700 ml-1">Minor</Badge>}
                  {b.hasSpecialNeeds && <Badge className="text-[9px] bg-purple-100 text-purple-700 ml-1">Special Needs</Badge>}
                </div>
                <div className="flex gap-1">
                  {b.isExecutor && <Badge className="text-[9px] bg-indigo-100 text-indigo-700">Executor</Badge>}
                  {b.isTrustee && <Badge className="text-[9px] bg-indigo-100 text-indigo-700">Trustee</Badge>}
                  {b.isPOAAgent && <Badge className="text-[9px] bg-indigo-100 text-indigo-700">POA</Badge>}
                  {b.isHealthcareProxy && <Badge className="text-[9px] bg-indigo-100 text-indigo-700">HC Proxy</Badge>}
                </div>
              </div>
              {b.sharePercentage && <p className="text-xs text-muted-foreground mt-1">{Number(b.sharePercentage)}% share</p>}
              <Button variant="ghost" size="sm" className="mt-1 text-xs text-red-500" onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${b.name}?`)) removeBenefMut.mutate({ id: b.id }); }}><Trash2 className="h-3 w-3 mr-0.5" /> Remove</Button>
            </div>
          ))}
        </div>
      </Card>

      {/* ═══ SECTION 4 — Documents & Gaps ═══ */}
      <Card className="p-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3"><FileText className="h-5 w-5 text-amber-600" /> Documents & Gap Analysis</h2>

        {/* Gaps */}
        {gaps.length > 0 && (
          <div className="mb-4 space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Gap Analysis ({gaps.length})</h3>
            {gaps.map((gap, i) => (
              <div key={i} className={cn("p-2 rounded border text-xs", GAP_COLORS[gap.severity] || "")}>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[9px]", gap.severity === "HIGH" ? "bg-red-200 text-red-800" : gap.severity === "MEDIUM" ? "bg-amber-200 text-amber-800" : "bg-gray-200")}>{gap.severity}</Badge>
                  <span className="font-medium">{gap.description}</span>
                </div>
                <p className="text-[11px] mt-0.5 opacity-80">{gap.recommendation}</p>
              </div>
            ))}
          </div>
        )}

        {/* Generate buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={() => memoMut.mutate({ profileId: p.id })} disabled={memoMut.isLoading}>
            {memoMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />} Summary Memo
          </Button>
          {["WILL", "REVOCABLE_TRUST", "HEALTHCARE_PROXY", "DURABLE_POA", "ASSET_SCHEDULE"].map((dt) => (
            <Button key={dt} size="sm" variant="outline" onClick={() => assembleDocMut.mutate({ profileId: p.id, documentType: dt })} className="text-xs">
              {dt.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        {/* Document list */}
        <div className="space-y-2">
          {(p.documents || []).map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-2 rounded border">
              <div>
                <span className="text-sm font-medium">{doc.title}</span>
                <div className="flex gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">{doc.documentType.replace(/_/g, " ")}</Badge>
                  <Badge className={cn("text-[9px]", doc.status === "DRAFT" ? "bg-gray-100" : doc.status === "EXECUTED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{doc.status}</Badge>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{fmtDate(doc.createdAt)}</span>
            </div>
          ))}
          {(p.documents?.length || 0) === 0 && <p className="text-xs text-muted-foreground text-center py-3">No documents generated yet</p>}
        </div>
      </Card>
    </div>
  );
}
