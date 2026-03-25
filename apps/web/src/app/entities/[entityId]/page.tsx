"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Building2, Users, Shield, FileText, Plus, Trash2, Check, AlertTriangle, ChevronDown, ChevronRight, Loader2, Calendar, Pencil, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const ROLES = ["PRESIDENT", "CEO", "CFO", "COO", "SECRETARY", "TREASURER", "DIRECTOR", "MANAGING_MEMBER", "MEMBER", "GENERAL_PARTNER", "LIMITED_PARTNER", "MANAGER", "REGISTERED_AGENT", "OTHER"];
const FILING_TYPES = ["ANNUAL_REPORT", "FRANCHISE_TAX", "STATEMENT_OF_INFORMATION", "BIENNIAL_REPORT", "REINSTATEMENT", "AMENDMENT", "DISSOLUTION", "FOREIGN_QUALIFICATION", "OTHER"];
const STATUS_COLORS: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", SUSPENDED: "bg-red-100 text-red-700", DISSOLVED: "bg-gray-100 text-gray-500" };
const FILING_STATUS_COLORS: Record<string, string> = { UPCOMING: "bg-gray-100 text-gray-600", DUE_SOON: "bg-amber-100 text-amber-700", OVERDUE: "bg-red-100 text-red-700", FILED: "bg-green-100 text-green-700", WAIVED: "bg-gray-100 text-gray-500" };
function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }
function fmt(n: any) { if (n == null) return "—"; return Number(n).toLocaleString(); }

export default function EntityDetailPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [showAddFiling, setShowAddFiling] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showFormer, setShowFormer] = useState(false);
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const entityQuery = trpc.corporateEntities.getEntity.useQuery({ entityId });
  const addOfficerMut = trpc.corporateEntities.addOfficer.useMutation({ onSuccess: () => { entityQuery.refetch(); setShowAddOfficer(false); setF({}); } });
  const deactivateOfficerMut = trpc.corporateEntities.deactivateOfficer.useMutation({ onSuccess: () => entityQuery.refetch() });
  const addFilingMut = trpc.corporateEntities.addFiling.useMutation({ onSuccess: () => { entityQuery.refetch(); setShowAddFiling(false); setF({}); } });
  const markFiledMut = trpc.corporateEntities.markFilingFiled.useMutation({ onSuccess: () => entityQuery.refetch() });
  const addDocMut = trpc.corporateEntities.addDocument.useMutation({ onSuccess: () => { entityQuery.refetch(); setShowAddDoc(false); setF({}); } });
  const gapsQuery = trpc.corporateEntities.getDocumentGaps.useQuery({ entityId });
  const minutesMut = trpc.corporateEntities.generateMinutesShell.useMutation({ onSuccess: () => entityQuery.refetch() });

  const e = entityQuery.data;
  if (!e) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin mx-auto mt-12" /></div>;

  const activeOfficers = e.officers.filter((o: any) => o.isActive);
  const formerOfficers = e.officers.filter((o: any) => !o.isActive);
  const gaps = gapsQuery.data || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Section 1 — Profile */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold">{e.entityName}</h1>
            <div className="flex gap-2 mt-1"><Badge variant="outline">{e.entityType.replace(/_/g, " ")}</Badge><Badge className={cn("text-[10px]", STATUS_COLORS[e.status] || "")}>{e.status}</Badge>{e.ein && <Badge variant="outline" className="font-mono text-[10px]">EIN ···{e.ein}</Badge>}</div>
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-xs text-muted-foreground">State</span><p className="font-medium">{e.stateOfFormation}</p></div>
          <div><span className="text-xs text-muted-foreground">Formed</span><p className="font-medium">{fmtDate(e.formationDate)}</p></div>
          <div><span className="text-xs text-muted-foreground">Fiscal Year End</span><p className="font-medium">{e.fiscalYearEnd}</p></div>
          <div><span className="text-xs text-muted-foreground">Tax Class</span><p className="font-medium">{e.taxClassification}</p></div>
          {e.authorizedShares && <div><span className="text-xs text-muted-foreground">Auth. Shares</span><p className="font-medium">{fmt(e.authorizedShares)}</p></div>}
          {e.issuedShares && <div><span className="text-xs text-muted-foreground">Issued</span><p className="font-medium">{fmt(e.issuedShares)}</p></div>}
          {e.memberCount && <div><span className="text-xs text-muted-foreground">Members</span><p className="font-medium">{e.memberCount}</p></div>}
        </div>
      </Card>

      {/* Section 2 — Officers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Officers & Members ({activeOfficers.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddOfficer(!showAddOfficer)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </CardHeader>
        {showAddOfficer && (
          <div className="px-4 pb-3"><div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input placeholder="Name *" onChange={(ev) => set("o_name", ev.target.value)} className="h-8 text-sm" />
            <Select onValueChange={(v) => set("o_role", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Ownership %" type="number" onChange={(ev) => set("o_pct", Number(ev.target.value))} className="h-8 text-sm" />
            <Input placeholder="Email" onChange={(ev) => set("o_email", ev.target.value)} className="h-8 text-sm" />
            <Button size="sm" className="col-span-4 w-fit" onClick={() => addOfficerMut.mutate({ entityId, contactName: f.o_name || "", role: f.o_role || "MEMBER", ownershipPercentage: f.o_pct, contactEmail: f.o_email })}>Add</Button>
          </div></div>
        )}
        <CardContent className="pt-0">
          {/* Ownership bar */}
          {activeOfficers.some((o: any) => o.ownershipPercentage) && (
            <div className="mb-3"><div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Ownership:</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", e.summary.totalOwnership === 100 ? "bg-green-500" : e.summary.totalOwnership > 100 ? "bg-red-500" : "bg-amber-500")} style={{ width: `${Math.min(e.summary.totalOwnership, 100)}%` }} /></div>
              <span className={cn("font-mono", e.summary.totalOwnership === 100 ? "text-green-600" : e.summary.totalOwnership > 100 ? "text-red-600" : "text-amber-600")}>{e.summary.totalOwnership}%</span>
            </div></div>
          )}
          <div className="space-y-1">
            {activeOfficers.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div><span className="text-sm font-medium">{o.contactName}</span><Badge variant="outline" className="text-[9px] ml-2">{o.role.replace(/_/g, " ")}</Badge>
                  {o.ownershipPercentage && <span className="text-xs text-muted-foreground ml-2">{Number(o.ownershipPercentage)}%</span>}
                  {o.sharesHeld && <span className="text-xs text-muted-foreground ml-2">{fmt(o.sharesHeld)} shares</span>}</div>
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{fmtDate(o.appointmentDate)}</span>
                  <Button variant="ghost" size="sm" className="text-xs text-red-500" onClick={() => { if (confirm(`Deactivate ${o.contactName}?`)) deactivateOfficerMut.mutate({ id: o.id }); }}>Remove</Button></div>
              </div>
            ))}
          </div>
          {formerOfficers.length > 0 && (
            <button onClick={() => setShowFormer(!showFormer)} className="text-xs text-muted-foreground mt-2 flex items-center gap-1">{showFormer ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Former ({formerOfficers.length})</button>
          )}
          {showFormer && formerOfficers.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between py-1 text-sm opacity-50"><span>{o.contactName} — {o.role.replace(/_/g, " ")}</span><span className="text-xs">Resigned {fmtDate(o.resignationDate)}</span></div>
          ))}
        </CardContent>
      </Card>

      {/* Section 3 — Filings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Filings ({e.filings.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddFiling(!showAddFiling)}><Plus className="h-3 w-3 mr-1" /> Add Filing</Button>
        </CardHeader>
        {showAddFiling && (
          <div className="px-4 pb-3"><div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select onValueChange={(v) => set("f_type", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{FILING_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Jurisdiction" onChange={(ev) => set("f_jur", ev.target.value)} className="h-8 text-sm" />
            <Input placeholder="Period (e.g. 2025)" onChange={(ev) => set("f_per", ev.target.value)} className="h-8 text-sm" />
            <Input type="date" onChange={(ev) => set("f_due", ev.target.value)} className="h-8 text-sm" />
            <Button size="sm" className="col-span-4 w-fit" onClick={() => addFilingMut.mutate({ entityId, filingType: f.f_type || "ANNUAL_REPORT", filingJurisdiction: f.f_jur || e.stateOfFormation, filingPeriod: f.f_per, dueDate: f.f_due })}>Add</Button>
          </div></div>
        )}
        <CardContent className="pt-0 space-y-1">
          {e.filings.map((fi: any) => (
            <div key={fi.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><Badge variant="outline" className="text-[10px]">{fi.filingType.replace(/_/g, " ")}</Badge><span className="text-sm ml-2">{fi.filingJurisdiction}</span>{fi.filingPeriod && <span className="text-xs text-muted-foreground ml-1">({fi.filingPeriod})</span>}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs">{fmtDate(fi.dueDate)}</span>
                <Badge className={cn("text-[10px]", FILING_STATUS_COLORS[fi.status] || "")}>{fi.status}</Badge>
                {fi.status !== "FILED" && <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => { const conf = prompt("Confirmation number?"); markFiledMut.mutate({ id: fi.id, confirmationNumber: conf || undefined }); }}><Check className="h-3 w-3 mr-0.5" /> Filed</Button>}
                {fi.confirmationNumber && <span className="text-[10px] text-muted-foreground font-mono">#{fi.confirmationNumber}</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 4 — Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => minutesMut.mutate({ entityId, meetingType: "ANNUAL", meetingDate: new Date().toISOString() })} disabled={minutesMut.isLoading}><FileText className="h-3 w-3 mr-1" /> Minutes</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddDoc(!showAddDoc)}><Plus className="h-3 w-3 mr-1" /> Upload</Button>
          </div>
        </CardHeader>
        {gaps.length > 0 && (
          <div className="px-4 pb-2 space-y-1">{gaps.map((g: any, i: number) => (
            <div key={i} className={cn("text-xs p-2 rounded border", g.required ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700")}><AlertTriangle className="h-3 w-3 inline mr-1" />{g.required ? "Required" : "Recommended"}: {g.label}</div>
          ))}</div>
        )}
        {showAddDoc && (
          <div className="px-4 pb-3"><div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-2">
            <Input placeholder="Title *" onChange={(ev) => set("d_title", ev.target.value)} className="h-8 text-sm" />
            <Input placeholder="Document type" onChange={(ev) => set("d_type", ev.target.value)} className="h-8 text-sm" />
            <Input type="date" onChange={(ev) => set("d_date", ev.target.value)} className="h-8 text-sm" />
            <Button size="sm" className="col-span-3 w-fit" onClick={() => addDocMut.mutate({ entityId, title: f.d_title || "", documentType: f.d_type || "OTHER", effectiveDate: f.d_date })}>Upload</Button>
          </div></div>
        )}
        <CardContent className="pt-0 space-y-1">
          {e.documents.map((d: any) => (
            <div key={d.id} className={cn("flex items-center justify-between py-2 border-b last:border-0", d.supersededById ? "opacity-40" : "")}>
              <div><span className="text-sm font-medium">{d.title}</span><Badge variant="outline" className="text-[9px] ml-2">{d.documentType.replace(/_/g, " ")}</Badge>{d.version && <span className="text-[10px] text-muted-foreground ml-1">{d.version}</span>}{d.supersededById && <Badge className="text-[9px] bg-gray-100 ml-1">Superseded</Badge>}</div>
              <span className="text-xs text-muted-foreground">{fmtDate(d.effectiveDate)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
