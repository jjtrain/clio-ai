"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  User, FileText, FolderOpen, CalendarDays, AlertTriangle, Clock,
  CheckCircle, Circle, Users, Loader2, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROCESSING_TIMES: Record<string, number> = {
  "I-130": 12, "I-485": 14, "I-765": 6, "I-131": 8, "I-90": 12,
  "N-400": 10, "I-140": 8, "I-539": 10, "I-751": 18, "I-526": 36,
  I140_EB1A: 6, I140_EB1B: 8, I140_EB2_NIW: 10, I140_EB2_PERM: 8, I140_EB3: 8,
};

const MILESTONES = [
  { key: "receiptDate", label: "Receipt Notice", field: "receiptDate", icon: "📩" },
  { key: "biometricsDate", label: "Biometrics Appointment", field: "biometricsDate", icon: "🔍" },
  { key: "rfeDate", label: "RFE Issued", field: "rfeDate", icon: "⚠️" },
  { key: "rfeResponseDate", label: "RFE Response Filed", field: "rfeResponseDate", icon: "📤" },
  { key: "interviewDate", label: "Interview Scheduled", field: "interviewDate", icon: "🗓️" },
  { key: "interviewCompleted", label: "Interview Completed", field: "interviewResult", icon: "✅" },
  { key: "approvalDate", label: "Approved / Card Ordered", field: "approvalDate", icon: "🎉" },
  { key: "denialDate", label: "Denial / NOID", field: "denialDate", icon: "❌" },
] as const;

function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [milestoneNotes, setMilestoneNotes] = useState<Record<string, string>>({});

  const { data: caseData, refetch } = trpc.immigration["cases.get"].useQuery({ id });
  const { data: forms } = trpc.immigration["forms.list"].useQuery({ caseId: id });
  const { data: documents } = trpc.immigration["documents.list"].useQuery({ caseId: id });
  const { data: deadlines } = trpc.immigration["deadlines.list"].useQuery({ caseId: id });
  const { data: timeline } = trpc.immigration["cases.getTimeline"].useQuery({ caseId: id });

  const milestoneMut = trpc.immigration["milestones.update"].useMutation({ onSuccess: () => refetch() });
  const procTimeMut = trpc.immigration["milestones.updateProcessingTime"].useMutation({ onSuccess: () => refetch() });
  const receiptNumMut = trpc.immigration["milestones.updateReceiptNumber"].useMutation({ onSuccess: () => refetch() });
  const officeMut = trpc.immigration["milestones.updateServiceCenter"].useMutation({ onSuccess: () => refetch() });

  const rfe = caseData?.rfeDate ? { rfeDate: caseData.rfeDate, rfeDeadline: caseData.rfeDeadline, rfeDescription: caseData.rfeDescription } : null;

  const stats = useMemo(() => {
    if (!caseData) return null;
    const receiptDate = caseData.receiptDate ? new Date(caseData.receiptDate) : null;
    const now = new Date();
    const daysSinceReceipt = receiptDate ? daysBetween(receiptDate, now) : null;
    const defaultProcMonths = PROCESSING_TIMES[caseData.caseType] || 12;
    const procMonths = caseData.processingTimeEstimate ? parseFloat(caseData.processingTimeEstimate) : defaultProcMonths;
    const procDays = procMonths * 30;
    const elapsedPct = daysSinceReceipt ? Math.min(Math.round((daysSinceReceipt / procDays) * 100), 150) : 0;
    const rfeOpen = !!(caseData.rfeDate && !caseData.rfeResponseDate);
    const rfeDaysLeft = rfeOpen && caseData.rfeDeadline ? daysBetween(now, new Date(caseData.rfeDeadline)) : null;
    const currentStatus = (caseData.status || "NOT_FILED").replace(/_/g, " ");
    return { daysSinceReceipt, procMonths, procDays, elapsedPct, rfeOpen, rfeDaysLeft, currentStatus };
  }, [caseData]);

  if (!caseData) return <div className="p-6">Loading...</div>;

  function handleMilestoneDate(milestone: string, date: string) {
    milestoneMut.mutate({ caseId: id, milestone: milestone as any, date: date || null, notes: milestoneNotes[milestone] });
  }

  function getMilestoneDate(field: string): string {
    const val = (caseData as any)?.[field];
    if (!val || typeof val !== "string" && typeof val !== "object") return "";
    try { return new Date(val).toISOString().split("T")[0]; } catch { return ""; }
  }

  function getMilestoneDaysFromReceipt(field: string): string | null {
    const val = (caseData as any)?.[field];
    if (!val || !caseData?.receiptDate) return null;
    try { return `Day ${daysBetween(new Date(caseData.receiptDate), new Date(val))}`; } catch { return null; }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><User className="h-8 w-8" /> {caseData.beneficiaryName}</h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant="outline">{caseData.caseType}</Badge>
            <Badge variant={caseData.status === "APPROVED" ? "default" : caseData.status === "RFE_ISSUED" ? "destructive" : "secondary"}>{caseData.status}</Badge>
            {caseData.receiptNumber && <span className="text-sm font-mono text-muted-foreground">{caseData.receiptNumber}</span>}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="case-timeline">Case Timeline</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="rfe">RFE</TabsTrigger>
          <TabsTrigger value="timeline">Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Case Info</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Case Type</span><span>{caseData.caseType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Priority Date</span><span>{caseData.priorityDate ? new Date(caseData.priorityDate).toLocaleDateString() : "N/A"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Filed</span><span>{caseData.filingDate ? new Date(caseData.filingDate).toLocaleDateString() : "Not filed"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Matter</span><span>{caseData.matter?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Petitioner</span><span>{caseData.petitionerName || "—"}</span></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Dependents</CardTitle></CardHeader><CardContent className="space-y-2">
              {caseData.dependents ? (JSON.parse(caseData.dependents) as any[]).map((d: any, i: number) => (
                <div key={i} className="flex justify-between text-sm border-b pb-1 last:border-0"><span>{d.name}</span><Badge variant="outline">{d.relationship}</Badge></div>
              )) : <p className="text-sm text-muted-foreground">No dependents</p>}
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ═══ CASE TIMELINE ═══ */}
        <TabsContent value="case-timeline" className="space-y-6">
          {/* RFE Banner */}
          {stats?.rfeOpen && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">RFE Open — Response Required</p>
                <p className="text-sm text-red-700 mt-1">
                  RFE issued {new Date(caseData.rfeDate!).toLocaleDateString()}.
                  {stats.rfeDaysLeft != null && stats.rfeDaysLeft > 0
                    ? <> Due in <strong>{stats.rfeDaysLeft} days</strong> ({new Date(caseData.rfeDeadline!).toLocaleDateString()}).</>
                    : <> <strong>OVERDUE!</strong> Deadline was {new Date(caseData.rfeDeadline!).toLocaleDateString()}.</>}
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">Current Status</p><p className="text-lg font-bold mt-1">{stats?.currentStatus}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">Days Since Receipt</p><p className="text-lg font-bold mt-1">{stats?.daysSinceReceipt ?? "—"}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">RFE Status</p>
              <p className={cn("text-lg font-bold mt-1", stats?.rfeOpen ? "text-red-600" : "text-green-600")}>{stats?.rfeOpen ? `Open (${stats.rfeDaysLeft}d)` : caseData.rfeDate ? "Responded" : "None"}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground uppercase">Processing Est.</p><p className="text-lg font-bold mt-1">{stats?.procMonths || "—"} mo</p></Card>
          </div>

          {/* Progress Bar */}
          {stats?.daysSinceReceipt != null && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-1"><Timer className="h-4 w-4" /> Processing Progress</p>
                <span className="text-xs text-muted-foreground">{stats.daysSinceReceipt}d / ~{stats.procDays}d ({stats.elapsedPct}%)</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", stats.elapsedPct < 75 ? "bg-green-500" : stats.elapsedPct < 100 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${Math.min(stats.elapsedPct, 100)}%` }} />
              </div>
              {stats.elapsedPct > 100 && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Exceeded estimate by {stats.daysSinceReceipt - stats.procDays} days</p>}
            </Card>
          )}

          {/* Case Settings */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Case Settings</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="text-xs text-muted-foreground">Form Type</label><p className="text-sm font-medium mt-0.5">{caseData.caseType}</p></div>
              <div><label className="text-xs text-muted-foreground">Receipt Number</label>
                <Input defaultValue={caseData.receiptNumber || ""} onBlur={(e) => { if (e.target.value !== (caseData.receiptNumber || "")) receiptNumMut.mutate({ caseId: id, receiptNumber: e.target.value }); }}
                  placeholder="WAC-XX-XXX-XXXXX" className="h-8 text-sm mt-0.5 font-mono" /></div>
              <div><label className="text-xs text-muted-foreground">Service Center</label>
                <Input defaultValue={caseData.uscisOffice || ""} onBlur={(e) => officeMut.mutate({ caseId: id, uscisOffice: e.target.value })} placeholder="Nebraska SC" className="h-8 text-sm mt-0.5" /></div>
              <div><label className="text-xs text-muted-foreground">Processing Time (months)</label>
                <Input type="number" defaultValue={caseData.processingTimeEstimate || stats?.procMonths || ""} onBlur={(e) => procTimeMut.mutate({ caseId: id, processingTimeEstimate: e.target.value })} className="h-8 text-sm mt-0.5" /></div>
            </div>
          </Card>

          {/* Milestone Grid */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Milestones</p>
            <div className="space-y-2">
              {MILESTONES.map((m) => {
                const dateVal = getMilestoneDate(m.field);
                const daysLabel = getMilestoneDaysFromReceipt(m.field);
                const isSet = !!dateVal;
                return (
                  <div key={m.key} className={cn("flex items-center gap-3 p-3 rounded-lg border", isSet ? "bg-green-50/50 border-green-200" : "border-gray-100")}>
                    <span className="text-lg w-6 text-center">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.label}</span>
                        {isSet && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {daysLabel && <Badge variant="outline" className="text-[10px]">{daysLabel}</Badge>}
                      </div>
                    </div>
                    <Input type="date" defaultValue={dateVal} className="h-8 text-sm w-[150px]"
                      onBlur={(e) => { if (e.target.value !== dateVal) handleMilestoneDate(m.key, e.target.value); }} />
                    <Input placeholder="Notes..." defaultValue={milestoneNotes[m.key] || ""} className="h-8 text-sm w-[200px]"
                      onChange={(e) => setMilestoneNotes((prev) => ({ ...prev, [m.key]: e.target.value }))} />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Chronological View */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Chronological Timeline</p>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
              {MILESTONES.filter((m) => { const v = (caseData as any)?.[m.field]; return v && v !== "Completed" && typeof v === "string"; })
                .sort((a, b) => new Date((caseData as any)[a.field]).getTime() - new Date((caseData as any)[b.field]).getTime())
                .map((m) => {
                  const date = new Date((caseData as any)[m.field]);
                  const daysLabel = caseData.receiptDate ? `Day ${daysBetween(new Date(caseData.receiptDate), date)}` : "";
                  return (
                    <div key={m.key} className="relative flex items-center gap-3">
                      <div className="absolute -left-6 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white" />
                      <div className="flex-1 flex items-center justify-between">
                        <div><span className="text-sm font-medium">{m.icon} {m.label}</span>{daysLabel && <span className="text-xs text-muted-foreground ml-2">({daysLabel})</span>}</div>
                        <span className="text-sm text-muted-foreground">{date.toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              {!caseData.receiptDate && <p className="text-sm text-muted-foreground text-center py-4">Enter a receipt date to start tracking milestones.</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Forms */}
        <TabsContent value="forms">
          <Card><Table><TableHeader><TableRow><TableHead>Form</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>{forms?.map((f: any) => (<TableRow key={f.id}><TableCell className="font-mono">{f.formNumber}</TableCell><TableCell>{f.description}</TableCell>
            <TableCell><Badge variant={f.status === "COMPLETED" ? "default" : "secondary"}>{f.status}</Badge></TableCell>
            <TableCell><Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card><CardContent className="pt-6 space-y-3">{documents?.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div className="flex items-center gap-2">{d.collected ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}<span className="text-sm">{d.name}</span></div>
              <Badge variant={d.collected ? "default" : "outline"}>{d.collected ? "Collected" : "Pending"}</Badge>
            </div>))}</CardContent></Card>
        </TabsContent>

        {/* Deadlines */}
        <TabsContent value="deadlines">
          <Card><CardContent className="pt-6 space-y-3">{deadlines?.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.dueDate}</p></div></div>
              <Badge variant={d.status === "OVERDUE" ? "destructive" : d.status === "URGENT" ? "destructive" : "secondary"}>{d.status}</Badge>
            </div>))}</CardContent></Card>
        </TabsContent>

        {/* RFE */}
        <TabsContent value="rfe" className="space-y-4">
          {rfe ? (<>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> RFE Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span>{rfe.rfeDate ? new Date(rfe.rfeDate).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span className="font-bold text-destructive">{rfe.rfeDeadline ? new Date(rfe.rfeDeadline).toLocaleDateString() : "—"}</span></div>
              {rfe.rfeDescription && <p className="mt-2 border-t pt-2 whitespace-pre-wrap">{rfe.rfeDescription}</p>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Response</CardTitle></CardHeader><CardContent>
              <Badge variant={caseData?.rfeResponseDate ? "default" : "secondary"}>{caseData?.rfeResponseDate ? "Filed" : "Pending"}</Badge>
              {caseData?.rfeResponseDate && <p className="mt-2 text-sm">Responded: {new Date(caseData.rfeResponseDate).toLocaleDateString()}</p>}
            </CardContent></Card>
          </>) : <p className="text-muted-foreground">No RFE for this case.</p>}
        </TabsContent>

        {/* Activity */}
        <TabsContent value="timeline">
          <Card><CardContent className="pt-6 space-y-4">
            {timeline?.map((t: any) => (
              <div key={t.id} className="flex gap-4 border-b pb-3 last:border-0">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div><p className="text-sm font-medium">{t.description}</p><p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</p></div>
              </div>
            ))}
            {(!timeline || timeline.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No activity logged yet.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
