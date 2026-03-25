"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Shield, Gavel, AlertTriangle, Clock, Plus, ChevronDown, ChevronRight,
  Loader2, Calendar, User, Scale, FileText, X, Check, Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const CHARGE_LEVELS = ["FELONY", "MISDEMEANOR", "INFRACTION", "VIOLATION"];
const BAIL_STATUSES = ["DENIED", "ROR", "CASH", "BOND", "ELECTRONIC_MONITORING"];
const PHASES = ["ARREST", "ARRAIGNMENT", "PRELIMINARY", "GRAND_JURY", "PRETRIAL", "TRIAL", "SENTENCING", "APPEAL", "CLOSED"];
const APPEARANCE_TYPES = ["ARRAIGNMENT", "BAIL_HEARING", "PRELIMINARY", "GRAND_JURY", "STATUS", "MOTION", "PRETRIAL", "PLEA", "TRIAL", "SENTENCING", "APPEAL", "OTHER"];
const ATTENDANCE = ["APPEARED", "FAILED_TO_APPEAR", "EXCUSED", "BENCH_WARRANT"];
const BAIL_ACTIONS = ["NONE", "SET", "MODIFIED", "REVOKED", "RELEASED"];
const PLEA_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "COUNTERED", "EXPIRED"];

const LEVEL_COLORS: Record<string, string> = { FELONY: "bg-red-100 text-red-800", MISDEMEANOR: "bg-amber-100 text-amber-800", INFRACTION: "bg-blue-100 text-blue-800", VIOLATION: "bg-gray-100 text-gray-700" };
const DISPOSITION_COLORS: Record<string, string> = { PENDING: "bg-gray-100 text-gray-600", DISMISSED: "bg-green-100 text-green-700", ACQUITTED: "bg-green-100 text-green-700", CONVICTED: "bg-red-100 text-red-700", GUILTY_PLEA: "bg-red-100 text-red-700", REDUCED: "bg-amber-100 text-amber-700" };

function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }
function daysUntil(d: any) { if (!d) return null; return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

export default function CriminalPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [showEditCase, setShowEditCase] = useState(false);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddAppearance, setShowAddAppearance] = useState(false);
  const [showPleaPanel, setShowPleaPanel] = useState(false);
  const [showChronology, setShowChronology] = useState(false);
  const [showAddPlea, setShowAddPlea] = useState(false);

  const caseQuery = trpc.criminal.getCriminalCase.useQuery({ matterId });
  const upsertMut = trpc.criminal.upsertCriminalCase.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowEditCase(false); } });
  const addChargeMut = trpc.criminal.addCharge.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowAddCharge(false); } });
  const dismissChargeMut = trpc.criminal.dismissCharge.useMutation({ onSuccess: () => caseQuery.refetch() });
  const addAppearanceMut = trpc.criminal.addAppearance.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowAddAppearance(false); } });
  const chronologyQuery = trpc.criminal.generateCaseChronology.useQuery({ criminalCaseId: caseQuery.data?.id || "" }, { enabled: showChronology && !!caseQuery.data });
  const addPleaMut = trpc.criminal.addPleaNegotiation.useMutation({ onSuccess: () => { caseQuery.refetch(); setShowAddPlea(false); } });
  const updatePleaMut = trpc.criminal.updatePleaNegotiation.useMutation({ onSuccess: () => caseQuery.refetch() });

  const cc = caseQuery.data;

  // Form states
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  if (!cc) {
    return (
      <div className="p-6 space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-red-600" /> Criminal Defense</h2>
          <p className="text-sm text-muted-foreground mt-1">Set up a criminal case for this matter.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            <div><label className="text-xs text-muted-foreground">Charge Level</label><Select value={f.chargeLevel || "MISDEMEANOR"} onValueChange={(v) => set("chargeLevel", v)}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger><SelectContent>{CHARGE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Case Number</label><Input value={f.caseNumber || ""} onChange={(e) => set("caseNumber", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
            <div><label className="text-xs text-muted-foreground">Judge</label><Input value={f.judgeAssigned || ""} onChange={(e) => set("judgeAssigned", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
          </div>
          <Button className="mt-4" onClick={() => upsertMut.mutate({ matterId, ...f })} disabled={upsertMut.isLoading}>
            {upsertMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Create Criminal Case
          </Button>
        </Card>
      </div>
    );
  }

  const nextDays = daysUntil(cc.nextAppearanceDate);

  return (
    <div className="p-6 space-y-6">
      {/* ═══ SECTION 1 — Case Header ═══ */}
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-red-600" />
              <h2 className="text-lg font-bold">Criminal Case</h2>
              <Badge className={cn("text-xs", LEVEL_COLORS[cc.chargeLevel] || "")}>{cc.chargeLevel}</Badge>
              <Badge variant="outline" className="font-mono text-xs">{cc.caseNumber || "No case #"}</Badge>
              {cc.indictmentNumber && <Badge variant="outline" className="text-xs">Ind. {cc.indictmentNumber}</Badge>}
            </div>

            {/* Phase pills */}
            <div className="flex gap-1 mb-3">
              {PHASES.map((phase) => (
                <div key={phase} className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                  phase === cc.casePhase ? "bg-indigo-600 text-white" : PHASES.indexOf(phase) < PHASES.indexOf(cc.casePhase) ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400")}>
                  {phase.replace(/_/g, " ")}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-muted-foreground text-xs">Bail</span><p className="font-medium">{cc.bailStatus || "—"}{cc.bailAmount ? ` — $${cc.bailAmount.toLocaleString()}` : ""}</p></div>
              <div><span className="text-muted-foreground text-xs">Bond Agent</span><p className="font-medium">{cc.bondAgent || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs">Judge</span><p className="font-medium">{cc.judgeAssigned || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs">Prosecutor</span><p className="font-medium">{cc.prosecutorName || "—"}{cc.prosecutorOffice ? ` (${cc.prosecutorOffice})` : ""}</p></div>
              <div><span className="text-muted-foreground text-xs">Arrest Date</span><p className="font-medium">{fmtDate(cc.arrestDate)}</p></div>
              <div><span className="text-muted-foreground text-xs">Arraignment</span><p className="font-medium">{fmtDate(cc.arraignmentDate)}</p></div>
              <div><span className="text-muted-foreground text-xs">Disposition</span><p className="font-medium"><Badge className={cn("text-[10px]", DISPOSITION_COLORS[cc.dispositionType] || "")}>{cc.dispositionType}</Badge></p></div>
              <div>
                <span className="text-muted-foreground text-xs">Next Appearance</span>
                <p className={cn("font-semibold", nextDays !== null && nextDays <= 7 ? "text-red-600" : nextDays !== null && nextDays <= 14 ? "text-amber-600" : "")}>
                  {fmtDate(cc.nextAppearanceDate)}{cc.nextAppearanceType ? ` (${cc.nextAppearanceType})` : ""}
                  {nextDays !== null && <span className="text-xs font-normal ml-1">({nextDays}d)</span>}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowEditCase(!showEditCase)}>Edit</Button>
        </div>

        {showEditCase && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["caseNumber", "Case Number", cc.caseNumber], ["indictmentNumber", "Indictment #", cc.indictmentNumber],
                ["judgeAssigned", "Judge", cc.judgeAssigned], ["prosecutorName", "Prosecutor", cc.prosecutorName],
                ["prosecutorOffice", "Office", cc.prosecutorOffice], ["bondAgent", "Bond Agent", cc.bondAgent],
              ].map(([key, label, val]) => (
                <div key={key as string}><label className="text-xs text-muted-foreground">{label as string}</label>
                  <Input defaultValue={(val as string) || ""} onChange={(e) => set(key as string, e.target.value)} className="h-8 text-sm mt-0.5" /></div>
              ))}
              <div><label className="text-xs text-muted-foreground">Charge Level</label>
                <Select defaultValue={cc.chargeLevel} onValueChange={(v) => set("chargeLevel", v)}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger><SelectContent>{CHARGE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Bail Status</label>
                <Select defaultValue={cc.bailStatus || ""} onValueChange={(v) => set("bailStatus", v)}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{BAIL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Bail Amount</label><Input type="number" defaultValue={cc.bailAmount || ""} onChange={(e) => set("bailAmount", Number(e.target.value))} className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Arrest Date</label><Input type="date" defaultValue={cc.arrestDate ? new Date(cc.arrestDate).toISOString().split("T")[0] : ""} onChange={(e) => set("arrestDate", e.target.value)} className="h-8 text-sm mt-0.5" /></div>
            </div>
            <Button size="sm" onClick={() => upsertMut.mutate({ matterId, ...f })} disabled={upsertMut.isLoading}>Save</Button>
          </div>
        )}
      </Card>

      {/* ═══ SECTION 2 — Charges ═══ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Charges ({cc.charges.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddCharge(!showAddCharge)}><Plus className="h-3 w-3 mr-1" /> Add Charge</Button>
        </CardHeader>

        {showAddCharge && (
          <div className="px-4 pb-3">
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input placeholder="Charge code *" onChange={(e) => set("cc_code", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Description *" onChange={(e) => set("cc_desc", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Statute" onChange={(e) => set("cc_statute", e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Class (e.g. FELONY_B)" onChange={(e) => set("cc_class", e.target.value)} className="h-8 text-sm" />
                <Input type="number" placeholder="Counts" defaultValue="1" onChange={(e) => set("cc_counts", Number(e.target.value))} className="h-8 text-sm" />
                <Input type="number" placeholder="Mandatory min (months)" onChange={(e) => set("cc_mandmin", Number(e.target.value))} className="h-8 text-sm" />
                <Input type="number" placeholder="Maximum (months)" onChange={(e) => set("cc_max", Number(e.target.value))} className="h-8 text-sm" />
              </div>
              <Button size="sm" onClick={() => addChargeMut.mutate({ criminalCaseId: cc.id, chargeCode: f.cc_code || "", chargeDescription: f.cc_desc || "", statute: f.cc_statute, chargeClass: f.cc_class, countsCharged: f.cc_counts || 1, mandatoryMinimumMonths: f.cc_mandmin, maximumMonths: f.cc_max })} disabled={addChargeMut.isLoading}>Add</Button>
            </div>
          </div>
        )}

        <CardContent className="pt-0">
          {cc.charges.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No charges entered</p> : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Statute</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Class</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Counts</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Disposition</th>
                  <th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {cc.charges.map((ch: any) => (
                    <tr key={ch.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{ch.chargeCode}</td>
                      <td className="px-3 py-2">{ch.chargeDescription}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ch.statute || "—"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{ch.chargeClass || "—"}</Badge></td>
                      <td className="px-3 py-2 text-center">{ch.countsCharged}{ch.countsPleaded != null ? ` / ${ch.countsPleaded}` : ""}{ch.countsConvicted != null ? ` / ${ch.countsConvicted}` : ""}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px]", DISPOSITION_COLORS[ch.disposition] || "bg-gray-100")}>{ch.disposition}</Badge>
                        {ch.mandatoryMinimumMonths && <Badge className="text-[9px] bg-red-50 text-red-700 ml-1">Min: {ch.mandatoryMinimumMonths}mo</Badge>}
                      </td>
                      <td className="px-3 py-2">{ch.disposition === "PENDING" && (
                        <Button variant="ghost" size="sm" className="text-xs text-red-600" onClick={() => { if (confirm(`Dismiss charge: ${ch.chargeDescription}?`)) dismissChargeMut.mutate({ id: ch.id }); }}>Dismiss</Button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 3 — Appearance Timeline ═══ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm flex items-center gap-2"><Gavel className="h-4 w-4" /> Appearances ({cc.appearances.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowChronology(!showChronology)}><FileText className="h-3 w-3 mr-1" /> Chronology</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddAppearance(!showAddAppearance)}><Plus className="h-3 w-3 mr-1" /> Log Appearance</Button>
          </div>
        </CardHeader>

        {showAddAppearance && (
          <div className="px-4 pb-3">
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><label className="text-[10px] text-muted-foreground">Date *</label><Input type="date" onChange={(e) => set("ap_date", e.target.value)} className="h-8 text-sm" /></div>
                <div><label className="text-[10px] text-muted-foreground">Type *</label><Select onValueChange={(v) => set("ap_type", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{APPEARANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="text-[10px] text-muted-foreground">Judge</label><Input defaultValue={cc.judgeAssigned || ""} onChange={(e) => set("ap_judge", e.target.value)} className="h-8 text-sm" /></div>
                <div><label className="text-[10px] text-muted-foreground">ADA</label><Input onChange={(e) => set("ap_ada", e.target.value)} className="h-8 text-sm" /></div>
                <div><label className="text-[10px] text-muted-foreground">Courtroom</label><Input onChange={(e) => set("ap_courtroom", e.target.value)} className="h-8 text-sm" /></div>
                <div><label className="text-[10px] text-muted-foreground">Outcome</label><Input onChange={(e) => set("ap_outcome", e.target.value)} className="h-8 text-sm" /></div>
                <div><label className="text-[10px] text-muted-foreground font-semibold">Next Date</label><Input type="date" onChange={(e) => set("ap_next", e.target.value)} className="h-8 text-sm border-indigo-300" /></div>
                <div><label className="text-[10px] text-muted-foreground font-semibold">Next Type</label><Select onValueChange={(v) => set("ap_nexttype", v)}><SelectTrigger className="h-8 text-sm border-indigo-300"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{APPEARANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="text-[10px] text-muted-foreground">Bail Action</label><Select onValueChange={(v) => set("ap_bail", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{BAIL_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="text-[10px] text-muted-foreground">Attendance</label><Select defaultValue="APPEARED" onValueChange={(v) => set("ap_attend", v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{ATTENDANCE.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Input placeholder="Notes..." onChange={(e) => set("ap_notes", e.target.value)} className="h-8 text-sm" />
              <Button size="sm" onClick={() => addAppearanceMut.mutate({
                criminalCaseId: cc.id, matterId, appearanceDate: f.ap_date, appearanceType: f.ap_type || "STATUS",
                judgePresiding: f.ap_judge, adaAppearing: f.ap_ada, courtroom: f.ap_courtroom, outcome: f.ap_outcome,
                nextDate: f.ap_next, nextDateType: f.ap_nexttype, bailAction: f.ap_bail, attendanceStatus: f.ap_attend || "APPEARED",
                notes: f.ap_notes,
              })} disabled={!f.ap_date || addAppearanceMut.isLoading}>Log</Button>
            </div>
          </div>
        )}

        <CardContent className="pt-0 space-y-2">
          {cc.appearances.map((ap: any) => {
            const isFTA = ap.attendanceStatus === "FAILED_TO_APPEAR";
            const isWarrant = ap.benchWarrantIssued;
            return (
              <div key={ap.id} className={cn("p-3 rounded-lg border", isFTA || isWarrant ? "border-l-4 border-l-red-500 bg-red-50/30" : "")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground">{fmtDate(ap.appearanceDate)}</span>
                    <Badge variant="outline" className="text-[10px]">{ap.appearanceType.replace(/_/g, " ")}</Badge>
                    {isFTA && <Badge className="text-[10px] bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 inline mr-0.5" /> FTA</Badge>}
                    {isWarrant && <Badge className="text-[10px] bg-red-100 text-red-700">Bench Warrant</Badge>}
                    {ap.bailAction && ap.bailAction !== "NONE" && <Badge variant="outline" className="text-[10px]">Bail: {ap.bailAction}{ap.newBailAmount ? ` $${ap.newBailAmount.toLocaleString()}` : ""}</Badge>}
                  </div>
                  {ap.nextDate && <span className="text-xs text-muted-foreground">Next: {fmtDate(ap.nextDate)}{ap.nextDateType ? ` (${ap.nextDateType})` : ""}</span>}
                </div>
                <div className="mt-1 text-sm">
                  {ap.judgePresiding && <span className="text-muted-foreground mr-3">Judge: {ap.judgePresiding}</span>}
                  {ap.adaAppearing && <span className="text-muted-foreground mr-3">ADA: {ap.adaAppearing}</span>}
                  {ap.courtroom && <span className="text-muted-foreground">Rm: {ap.courtroom}</span>}
                </div>
                {ap.outcome && <p className="text-sm mt-1"><span className="font-medium">Outcome:</span> {ap.outcome}</p>}
                {ap.outcomeDetail && <p className="text-xs text-muted-foreground mt-0.5">{ap.outcomeDetail}</p>}
                {ap.motionsFiled && Array.isArray(ap.motionsFiled) && ap.motionsFiled.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">{(ap.motionsFiled as any[]).map((m: any, i: number) => <span key={i} className="mr-2">Motion: {m.title} → {m.result}</span>)}</div>
                )}
              </div>
            );
          })}
          {cc.appearances.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No appearances logged</p>}
        </CardContent>
      </Card>

      {/* Chronology printable view */}
      {showChronology && chronologyQuery.data && (
        <Card className="p-5" id="chronology">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Case Chronology — Plea Negotiations</h3>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3 w-3 mr-1" /> Print</Button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-gray-50 rounded">
              <p className="font-semibold">{chronologyQuery.data.header.defendant}</p>
              <p className="text-muted-foreground">Case: {chronologyQuery.data.header.caseNumber} · Judge: {chronologyQuery.data.header.judge} · Prosecutor: {chronologyQuery.data.header.prosecutor}</p>
              <p className="text-muted-foreground">Phase: {chronologyQuery.data.header.casePhase} · Disposition: {chronologyQuery.data.header.dispositionType}</p>
            </div>
            <h4 className="font-semibold text-xs text-muted-foreground uppercase">Charges</h4>
            {chronologyQuery.data.charges.map((ch: any) => <p key={ch.id} className="text-sm">• {ch.chargeCode} — {ch.chargeDescription} ({ch.disposition})</p>)}
            <h4 className="font-semibold text-xs text-muted-foreground uppercase mt-3">Appearances</h4>
            {chronologyQuery.data.appearances.map((ap: any, i: number) => (
              <div key={i} className="flex gap-3"><span className="text-muted-foreground font-mono w-[80px] flex-shrink-0">{fmtDate(ap.date)}</span><span>{ap.type} — {ap.outcome || "No outcome noted"}{ap.ada ? ` (ADA: ${ap.ada})` : ""}</span></div>
            ))}
            {chronologyQuery.data.pleaHistory.length > 0 && <>
              <h4 className="font-semibold text-xs text-muted-foreground uppercase mt-3">Plea History</h4>
              {chronologyQuery.data.pleaHistory.map((p: any) => <p key={p.id} className="text-sm">{fmtDate(p.offerDate)} — {p.offeredBy}: {p.sentenceOffered || "—"} ({p.status})</p>)}
            </>}
          </div>
        </Card>
      )}

      {/* ═══ Plea Negotiations ═══ */}
      <Card>
        <CardHeader className="py-3">
          <button onClick={() => setShowPleaPanel(!showPleaPanel)} className="flex items-center gap-2 text-sm font-semibold">
            {showPleaPanel ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Plea Negotiations ({cc.pleaNegotiations.length})
          </button>
        </CardHeader>
        {showPleaPanel && (
          <CardContent className="pt-0 space-y-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddPlea(!showAddPlea)}><Plus className="h-3 w-3 mr-1" /> Add Offer</Button>
            {showAddPlea && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Input type="date" onChange={(e) => set("pl_date", e.target.value)} className="h-8 text-sm" />
                  <Select onValueChange={(v) => set("pl_by", v)}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Offered by" /></SelectTrigger><SelectContent><SelectItem value="PROSECUTION">Prosecution</SelectItem><SelectItem value="DEFENSE">Defense</SelectItem></SelectContent></Select>
                  <Input placeholder="Sentence offered" onChange={(e) => set("pl_sentence", e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Conditions" onChange={(e) => set("pl_cond", e.target.value)} className="h-8 text-sm" />
                </div>
                <Button size="sm" onClick={() => addPleaMut.mutate({ criminalCaseId: cc.id, offerDate: f.pl_date, offeredBy: f.pl_by || "PROSECUTION", sentenceOffered: f.pl_sentence, conditions: f.pl_cond })}>Add</Button>
              </div>
            )}
            {cc.pleaNegotiations.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{fmtDate(p.offerDate)}</span>
                    <Badge variant="outline" className="text-[10px]">{p.offeredBy}</Badge>
                    <Badge className={cn("text-[10px]", p.status === "ACCEPTED" ? "bg-green-100 text-green-700" : p.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-gray-100")}>{p.status}</Badge>
                  </div>
                  <p className="text-sm mt-0.5">{p.sentenceOffered || "—"}{p.conditions ? ` · ${p.conditions}` : ""}</p>
                </div>
                {p.status === "PENDING" && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs text-green-600" onClick={() => updatePleaMut.mutate({ id: p.id, status: "ACCEPTED", responseDate: new Date().toISOString() })}><Check className="h-3 w-3 mr-0.5" /> Accept</Button>
                    <Button variant="ghost" size="sm" className="text-xs text-red-600" onClick={() => updatePleaMut.mutate({ id: p.id, status: "REJECTED", responseDate: new Date().toISOString() })}><X className="h-3 w-3 mr-0.5" /> Reject</Button>
                  </div>
                )}
              </div>
            ))}
            {cc.pleaNegotiations.length === 0 && !showAddPlea && <p className="text-sm text-muted-foreground text-center py-3">No plea offers recorded</p>}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
