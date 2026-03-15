"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Plus, Sparkles, MoreHorizontal, Trash2, Edit, DollarSign,
  ChevronDown, FileText, CheckCircle, GripVertical,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────

const CASE_STATUS_COLORS: Record<string, string> = {
  PRE_SUIT: "bg-blue-100 text-blue-700",
  TREATMENT: "bg-purple-100 text-purple-700",
  MAX_MEDICAL_IMPROVEMENT: "bg-amber-100 text-amber-700",
  DEMAND_SENT: "bg-orange-100 text-orange-700",
  NEGOTIATION: "bg-teal-100 text-teal-700",
  LITIGATION: "bg-red-100 text-red-700",
  MEDIATION: "bg-indigo-100 text-indigo-700",
  TRIAL: "bg-red-100 text-red-700",
  SETTLED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-700",
};

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  AUTO_ACCIDENT: "bg-blue-100 text-blue-700",
  SLIP_FALL: "bg-amber-100 text-amber-700",
  MEDICAL_MALPRACTICE: "bg-red-100 text-red-700",
  PRODUCT_LIABILITY: "bg-purple-100 text-purple-700",
  WORK_INJURY: "bg-orange-100 text-orange-700",
  DOG_BITE: "bg-pink-100 text-pink-700",
  ASSAULT: "bg-red-100 text-red-700",
  PREMISES_LIABILITY: "bg-teal-100 text-teal-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const RECORD_TYPE_COLORS: Record<string, string> = {
  OFFICE_VISIT: "bg-blue-100 text-blue-700",
  ER_VISIT: "bg-red-100 text-red-700",
  HOSPITAL_ADMISSION: "bg-red-100 text-red-700",
  SURGERY: "bg-purple-100 text-purple-700",
  IMAGING: "bg-cyan-100 text-cyan-700",
  LAB_WORK: "bg-teal-100 text-teal-700",
  PHYSICAL_THERAPY: "bg-green-100 text-green-700",
  PRESCRIPTION: "bg-orange-100 text-orange-700",
  AMBULANCE: "bg-red-100 text-red-700",
  MENTAL_HEALTH: "bg-indigo-100 text-indigo-700",
  DENTAL: "bg-pink-100 text-pink-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const REQUEST_STATUS_COLORS: Record<string, string> = {
  NOT_REQUESTED: "bg-gray-100 text-gray-700",
  REQUESTED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-purple-100 text-purple-700",
  SUMMARIZED: "bg-green-100 text-green-700",
};

const LIEN_TYPE_COLORS: Record<string, string> = {
  HOSPITAL: "bg-red-100 text-red-700",
  MEDICAL_PROVIDER: "bg-orange-100 text-orange-700",
  HEALTH_INSURANCE: "bg-blue-100 text-blue-700",
  MEDICARE: "bg-purple-100 text-purple-700",
  MEDICAID: "bg-teal-100 text-teal-700",
  ERISA: "bg-indigo-100 text-indigo-700",
  WORKERS_COMP: "bg-amber-100 text-amber-700",
  CHILD_SUPPORT: "bg-pink-100 text-pink-700",
  GOVERNMENT: "bg-slate-100 text-slate-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const LIEN_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  VERIFIED: "bg-blue-100 text-blue-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  AGREED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
  WAIVED: "bg-slate-100 text-slate-700",
};

const CASE_STATUSES = [
  "PRE_SUIT", "TREATMENT", "MAX_MEDICAL_IMPROVEMENT", "DEMAND_SENT",
  "NEGOTIATION", "LITIGATION", "MEDIATION", "TRIAL", "SETTLED", "CLOSED",
];

const RECORD_TYPES = [
  "OFFICE_VISIT", "ER_VISIT", "HOSPITAL_ADMISSION", "SURGERY", "IMAGING",
  "LAB_WORK", "PHYSICAL_THERAPY", "PRESCRIPTION", "AMBULANCE", "MENTAL_HEALTH", "DENTAL", "OTHER",
];

const LIEN_TYPES = [
  "HOSPITAL", "MEDICAL_PROVIDER", "HEALTH_INSURANCE", "MEDICARE", "MEDICAID",
  "ERISA", "WORKERS_COMP", "CHILD_SUPPORT", "GOVERNMENT", "OTHER",
];

const LIEN_STATUSES = ["PENDING", "VERIFIED", "NEGOTIATING", "AGREED", "PAID", "DISPUTED", "WAIVED"];

const REQUEST_STATUSES = ["NOT_REQUESTED", "REQUESTED", "RECEIVED", "REVIEWED", "SUMMARIZED"];

const INCIDENT_TYPES = [
  "AUTO_ACCIDENT", "SLIP_FALL", "MEDICAL_MALPRACTICE", "PRODUCT_LIABILITY",
  "WORK_INJURY", "DOG_BITE", "ASSAULT", "PREMISES_LIABILITY", "OTHER",
];

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PIcaseManagementPage() {
  const { matterId } = useParams<{ matterId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("details");
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [addLienOpen, setAddLienOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editLienId, setEditLienId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiStrategy, setAiStrategy] = useState<any>(null);
  const [demandLetter, setDemandLetter] = useState<string | null>(null);
  const [settlementInput, setSettlementInput] = useState("");
  const [costsInput, setCostsInput] = useState("");

  // ─── Queries ─────────────────────────────────────────────────
  const { data: matter } = trpc.matters.getById.useQuery({ id: matterId });
  const { data: caseDetails, refetch: refetchCase } = trpc.medicalRecords.getCaseDetails.useQuery({ matterId });
  const { data: records } = trpc.medicalRecords.listRecords.useQuery({ matterId });
  const { data: recordsSummary } = trpc.medicalRecords.getRecordsSummary.useQuery({ matterId });
  const { data: liens } = trpc.medicalRecords.listLiens.useQuery({ matterId });
  const { data: lienSummary } = trpc.medicalRecords.getLienSummary.useQuery({ matterId });
  const { data: distribution } = trpc.medicalRecords.getDistribution.useQuery({ matterId });
  const { data: providers } = trpc.medicalRecords.listProviders.useQuery();

  // ─── Mutations ───────────────────────────────────────────────
  const updateCase = trpc.medicalRecords.updateCaseDetails.useMutation({
    onSuccess: () => { refetchCase(); toast({ title: "Case updated" }); },
  });

  const createRecord = trpc.medicalRecords.createRecord.useMutation({
    onSuccess: () => {
      utils.medicalRecords.listRecords.invalidate({ matterId });
      utils.medicalRecords.getRecordsSummary.invalidate({ matterId });
      setAddRecordOpen(false);
      toast({ title: "Record added" });
    },
  });

  const updateRecord = trpc.medicalRecords.updateRecord.useMutation({
    onSuccess: () => {
      utils.medicalRecords.listRecords.invalidate({ matterId });
      utils.medicalRecords.getRecordsSummary.invalidate({ matterId });
      setEditRecordId(null);
      toast({ title: "Record updated" });
    },
  });

  const deleteRecord = trpc.medicalRecords.deleteRecord.useMutation({
    onSuccess: () => {
      utils.medicalRecords.listRecords.invalidate({ matterId });
      utils.medicalRecords.getRecordsSummary.invalidate({ matterId });
      toast({ title: "Record deleted" });
    },
  });

  const updateRequestStatus = trpc.medicalRecords.updateRequestStatus.useMutation({
    onSuccess: () => utils.medicalRecords.listRecords.invalidate({ matterId }),
  });

  const createLien = trpc.medicalRecords.createLien.useMutation({
    onSuccess: () => {
      utils.medicalRecords.listLiens.invalidate({ matterId });
      utils.medicalRecords.getLienSummary.invalidate({ matterId });
      setAddLienOpen(false);
      toast({ title: "Lien added" });
    },
  });

  const updateLien = trpc.medicalRecords.updateLien.useMutation({
    onSuccess: () => {
      utils.medicalRecords.listLiens.invalidate({ matterId });
      utils.medicalRecords.getLienSummary.invalidate({ matterId });
      setEditLienId(null);
      toast({ title: "Lien updated" });
    },
  });

  const deleteLien = trpc.medicalRecords.deleteLien.useMutation({
    onSuccess: () => {
      utils.medicalRecords.listLiens.invalidate({ matterId });
      utils.medicalRecords.getLienSummary.invalidate({ matterId });
      toast({ title: "Lien deleted" });
    },
  });

  const aiSummarizeRecords = trpc.medicalRecords.aiSummarize.useMutation({
    onSuccess: (data) => { setAiSummary(data); toast({ title: "Summary generated" }); },
  });

  const aiNegotiation = trpc.medicalRecords.aiNegotiationStrategy.useMutation({
    onSuccess: (data) => { setAiStrategy(data); toast({ title: "Strategy generated" }); },
  });

  const calcTotals = trpc.medicalRecords.calculateTotals.useMutation({
    onSuccess: () => { refetchCase(); toast({ title: "Totals recalculated" }); },
  });

  const createDist = trpc.medicalRecords.createDistribution.useMutation({
    onSuccess: () => {
      utils.medicalRecords.getDistribution.invalidate({ matterId });
      toast({ title: "Distribution created" });
    },
  });

  const approveDist = trpc.medicalRecords.approveDistribution.useMutation({
    onSuccess: () => utils.medicalRecords.getDistribution.invalidate({ matterId }),
  });

  const markDist = trpc.medicalRecords.markDistributed.useMutation({
    onSuccess: () => utils.medicalRecords.getDistribution.invalidate({ matterId }),
  });

  const genDemand = trpc.medicalRecords.generateDemandLetter.useMutation({
    onSuccess: (data) => { setDemandLetter(data.letter); toast({ title: "Demand letter generated" }); },
  });

  const createProvider = trpc.medicalRecords.createProvider.useMutation({
    onSuccess: () => utils.medicalRecords.listProviders.invalidate(),
  });

  // ─── Computed ────────────────────────────────────────────────
  const distributionItems = useMemo(() => {
    if (!distribution?.lineItems) return [];
    try { return JSON.parse(distribution.lineItems as string); } catch { return []; }
  }, [distribution]);

  if (!matter) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/injury">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{matter.name}</h1>
            {caseDetails && (
              <>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INCIDENT_TYPE_COLORS[caseDetails.incidentType] || ""}`}>
                  {fmt(caseDetails.incidentType)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${CASE_STATUS_COLORS[caseDetails.caseStatus] || ""}`}>
                      {fmt(caseDetails.caseStatus)} <ChevronDown className="h-3 w-3 ml-1" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {CASE_STATUSES.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => updateCase.mutate({ matterId, caseStatus: s as any })}>
                        {fmt(s)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
          <p className="text-sm text-slate-500">{matter.client?.name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => calcTotals.mutate({ matterId })}>
          Recalculate Totals
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Case Details</TabsTrigger>
          <TabsTrigger value="records">Medical Records</TabsTrigger>
          <TabsTrigger value="liens">Liens</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="demand">Demand</TabsTrigger>
        </TabsList>

        {/* ═══ CASE DETAILS TAB ═══ */}
        <TabsContent value="details" className="space-y-6">
          {caseDetails ? (
            <>
              {/* Incident Section */}
              <Card>
                <CardHeader><CardTitle>Incident Information</CardTitle></CardHeader>
                <CardContent>
                  <CaseDetailsForm caseDetails={caseDetails} onSave={(data: any) => updateCase.mutate({ matterId, ...data })} />
                </CardContent>
              </Card>

              {/* Insurance Section */}
              <Card>
                <CardHeader><CardTitle>Insurance Information</CardTitle></CardHeader>
                <CardContent>
                  <InsuranceForm caseDetails={caseDetails} onSave={(data: any) => updateCase.mutate({ matterId, ...data })} />
                </CardContent>
              </Card>

              {/* Case Status Timeline */}
              <Card>
                <CardHeader><CardTitle>Case Progress</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center overflow-x-auto gap-1">
                    {CASE_STATUSES.map((s, i) => {
                      const idx = CASE_STATUSES.indexOf(caseDetails.caseStatus);
                      const isActive = i === idx;
                      const isPast = i < idx;
                      return (
                        <div key={s} className="flex items-center">
                          <div
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                              isActive ? CASE_STATUS_COLORS[s] : isPast ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                            }`}
                            onClick={() => updateCase.mutate({ matterId, caseStatus: s as any })}
                          >
                            {fmt(s)}
                          </div>
                          {i < CASE_STATUSES.length - 1 && <div className={`w-4 h-0.5 ${isPast ? "bg-green-300" : "bg-gray-200"}`} />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* AI Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>AI Summary</CardTitle>
                    <Button size="sm" onClick={() => aiSummarizeRecords.mutate({ matterId })} disabled={aiSummarizeRecords.isLoading}>
                      <Sparkles className="h-4 w-4 mr-1" /> {aiSummarizeRecords.isLoading ? "Generating..." : "Generate AI Summary"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(aiSummary || caseDetails.aiSummary) ? (
                    <AISummaryDisplay summary={aiSummary || (caseDetails.aiSummary ? JSON.parse(caseDetails.aiSummary) : null)} />
                  ) : (
                    <p className="text-slate-500">No AI summary yet. Generate one to get insights.</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-slate-500">Case details not found for this matter.</p>
          )}
        </TabsContent>

        {/* ═══ MEDICAL RECORDS TAB ═══ */}
        <TabsContent value="records" className="space-y-6">
          {/* Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total Records</p><p className="text-xl font-bold">{recordsSummary?.totalRecords ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total Charges</p><p className="text-xl font-bold">{cur(recordsSummary?.totalCharges)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total Paid</p><p className="text-xl font-bold">{cur(recordsSummary?.totalPaid)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Outstanding</p><p className="text-xl font-bold">{cur(recordsSummary?.totalOutstanding)}</p></CardContent></Card>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={() => setAddRecordOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Record</Button>
            <Button variant="outline" onClick={() => aiSummarizeRecords.mutate({ matterId })} disabled={aiSummarizeRecords.isLoading}>
              <Sparkles className="h-4 w-4 mr-1" /> AI Summarize
            </Button>
          </div>

          {/* Treatment Timeline */}
          {recordsSummary?.timeline && recordsSummary.timeline.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Treatment Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <div className="flex items-end gap-1 min-h-[100px]">
                    {recordsSummary.timeline.map((t: any) => {
                      const maxCharges = Math.max(...recordsSummary.timeline.map((x: any) => x.charges || 1));
                      const height = Math.max(20, (t.charges / maxCharges) * 80);
                      return (
                        <div key={t.id} className="flex flex-col items-center gap-1 min-w-[40px]" title={`${t.provider} - ${cur(t.charges)}`}>
                          <div
                            className={`w-6 rounded-t ${RECORD_TYPE_COLORS[t.type]?.replace("text-", "bg-").split(" ")[0] || "bg-blue-200"}`}
                            style={{ height: `${height}px` }}
                          />
                          <span className="text-[10px] text-slate-400 rotate-[-45deg] origin-top-left whitespace-nowrap">
                            {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Records Table */}
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Physician</TableHead>
                      <TableHead className="text-right">Charges</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Request Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(records || []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{new Date(r.dateOfService).toLocaleDateString()}</TableCell>
                        <TableCell>{r.providerName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RECORD_TYPE_COLORS[r.recordType] || ""}`}>
                            {fmt(r.recordType)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.description || "—"}</TableCell>
                        <TableCell>{r.treatingPhysician || "—"}</TableCell>
                        <TableCell className="text-right">{cur(r.totalCharges)}</TableCell>
                        <TableCell className="text-right">{cur(r.amountPaid)}</TableCell>
                        <TableCell className="text-right">{cur(r.outstandingBalance)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${REQUEST_STATUS_COLORS[r.requestStatus] || ""}`}>
                                {fmt(r.requestStatus)} <ChevronDown className="h-3 w-3 ml-1" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {REQUEST_STATUSES.map((s) => (
                                <DropdownMenuItem key={s} onClick={() => updateRequestStatus.mutate({ id: r.id, requestStatus: s as any })}>
                                  {fmt(s)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditRecordId(r.id)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this record?")) deleteRecord.mutate({ id: r.id }); }}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!records?.length && (
                      <TableRow><TableCell colSpan={10} className="text-center text-slate-500 py-8">No records yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Provider Summary */}
          {recordsSummary?.byProvider && recordsSummary.byProvider.length > 0 && (
            <Card>
              <CardHeader><CardTitle>By Provider</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recordsSummary.byProvider.map((p: any) => (
                    <div key={p.name} className="p-3 border rounded-lg">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-slate-500">{p.count} records &middot; {cur(p.charges)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add/Edit Record Dialog */}
          <RecordDialog
            open={addRecordOpen || !!editRecordId}
            onClose={() => { setAddRecordOpen(false); setEditRecordId(null); }}
            matterId={matterId}
            record={editRecordId ? (records || []).find((r: any) => r.id === editRecordId) : null}
            providers={providers || []}
            onSubmit={(data: any) => {
              if (editRecordId) {
                updateRecord.mutate({ id: editRecordId, ...data });
              } else {
                createRecord.mutate({ matterId, ...data });
              }
            }}
            onCreateProvider={(p: any) => createProvider.mutate(p)}
            isLoading={createRecord.isLoading || updateRecord.isLoading}
          />
        </TabsContent>

        {/* ═══ LIENS TAB ═══ */}
        <TabsContent value="liens" className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Original Amount</p><p className="text-xl font-bold">{cur(lienSummary?.totalOriginal)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Negotiated</p><p className="text-xl font-bold">{cur(lienSummary?.totalNegotiated)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Reductions</p><p className="text-xl font-bold text-green-600">{lienSummary?.reductionPercentage?.toFixed(1) ?? 0}%</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Paid</p><p className="text-xl font-bold">{cur(lienSummary?.totalPaid)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Outstanding</p><p className="text-xl font-bold">{cur(lienSummary?.totalOutstanding)}</p></CardContent></Card>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setAddLienOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Lien</Button>
            <Button variant="outline" onClick={() => aiNegotiation.mutate({ matterId })} disabled={aiNegotiation.isLoading}>
              <Sparkles className="h-4 w-4 mr-1" /> {aiNegotiation.isLoading ? "Analyzing..." : "AI Negotiation Strategy"}
            </Button>
          </div>

          {/* Liens Table */}
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Lien Holder</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Negotiated</TableHead>
                      <TableHead className="text-right">Reduction %</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(liens || []).map((l: any, i: number) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.priority || i + 1}</TableCell>
                        <TableCell className="font-medium">{l.lienHolderName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LIEN_TYPE_COLORS[l.lienType] || ""}`}>
                            {fmt(l.lienType)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{cur(l.originalAmount)}</TableCell>
                        <TableCell className="text-right">{cur(l.negotiatedAmount)}</TableCell>
                        <TableCell className="text-right">
                          {l.negotiatedAmount ? ((1 - Number(l.negotiatedAmount) / Number(l.originalAmount)) * 100).toFixed(1) + "%" : "—"}
                        </TableCell>
                        <TableCell className="text-right">{cur(l.paidAmount)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LIEN_STATUS_COLORS[l.status] || ""}`}>
                            {fmt(l.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditLienId(l.id)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this lien?")) deleteLien.mutate({ id: l.id }); }}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!liens?.length && (
                      <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No liens yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* AI Strategy Panel */}
          {aiStrategy && (
            <Card>
              <CardHeader><CardTitle>AI Negotiation Strategy</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p>{aiStrategy.analysis}</p>
                {aiStrategy.negotiationStrategy?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Strategy</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {aiStrategy.negotiationStrategy.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {aiStrategy.projectedReductions?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Projected Reductions</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Holder</TableHead>
                          <TableHead className="text-right">Original</TableHead>
                          <TableHead className="text-right">Suggested Reduction</TableHead>
                          <TableHead>Reasoning</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aiStrategy.projectedReductions.map((r: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{r.holder}</TableCell>
                            <TableCell className="text-right">{cur(r.originalAmount)}</TableCell>
                            <TableCell className="text-right">{cur(r.suggestedReduction)}</TableCell>
                            <TableCell>{r.reasoning}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="text-lg font-bold">Estimated Net to Client: {cur(aiStrategy.estimatedNetToClient)}</p>
              </CardContent>
            </Card>
          )}

          {/* Add/Edit Lien Dialog */}
          <LienDialog
            open={addLienOpen || !!editLienId}
            onClose={() => { setAddLienOpen(false); setEditLienId(null); }}
            lien={editLienId ? (liens || []).find((l: any) => l.id === editLienId) : null}
            providers={providers || []}
            onSubmit={(data: any) => {
              if (editLienId) {
                updateLien.mutate({ id: editLienId, ...data });
              } else {
                createLien.mutate({ matterId, ...data });
              }
            }}
            isLoading={createLien.isLoading || updateLien.isLoading}
          />
        </TabsContent>

        {/* ═══ SETTLEMENT TAB ═══ */}
        <TabsContent value="settlement" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Settlement Calculator</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-lg">Settlement Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter settlement amount"
                    className="text-2xl font-bold h-14"
                    value={settlementInput || (caseDetails?.settlementAmount ? Number(caseDetails.settlementAmount) : "")}
                    onChange={(e) => setSettlementInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Case Costs & Expenses</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={costsInput}
                    onChange={(e) => setCostsInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Breakdown */}
              {(settlementInput || caseDetails?.settlementAmount) && (
                <div className="border rounded-lg p-4 space-y-3">
                  {(() => {
                    const settlement = Number(settlementInput) || Number(caseDetails?.settlementAmount) || 0;
                    const feePercentage = Number(caseDetails?.attorneyFeePercentage) || 33.33;
                    const fee = settlement * (feePercentage / 100);
                    const costs = Number(costsInput) || 0;
                    const lienTotal = Number(lienSummary?.totalNegotiated) || Number(lienSummary?.totalOriginal) || 0;
                    const net = settlement - fee - costs - lienTotal;
                    return (
                      <>
                        <div className="flex justify-between text-lg"><span>Gross Settlement</span><span className="font-bold">{cur(settlement)}</span></div>
                        <div className="flex justify-between text-red-600"><span>Attorney Fee ({feePercentage}%)</span><span>-{cur(fee)}</span></div>
                        <div className="flex justify-between text-red-600"><span>Case Costs</span><span>-{cur(costs)}</span></div>
                        <div className="flex justify-between text-red-600"><span>Liens</span><span>-{cur(lienTotal)}</span></div>
                        <div className="border-t pt-2 flex justify-between text-xl font-bold text-green-600"><span>Net to Client</span><span>{cur(net)}</span></div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const amount = Number(settlementInput) || Number(caseDetails?.settlementAmount) || 0;
                    if (!amount) return toast({ title: "Enter a settlement amount", variant: "destructive" });
                    createDist.mutate({ matterId, settlementAmount: amount, costs: Number(costsInput) || 0 });
                  }}
                  disabled={createDist.isLoading}
                >
                  <Sparkles className="h-4 w-4 mr-1" /> {createDist.isLoading ? "Generating..." : "Generate Distribution"}
                </Button>
                {settlementInput && (
                  <Button variant="outline" onClick={() => {
                    updateCase.mutate({ matterId, settlementAmount: Number(settlementInput) });
                  }}>
                    Save Settlement Amount
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Distribution */}
          {distribution && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Settlement Distribution</CardTitle>
                  <Badge variant={distribution.status === "DISTRIBUTED" ? "success" : distribution.status === "APPROVED" ? "default" : "secondary"}>
                    {distribution.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributionItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell><Badge variant="secondary">{fmt(item.type || "")}</Badge></TableCell>
                        <TableCell>{item.payee || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{cur(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex gap-2">
                  {distribution.status === "DRAFT" && (
                    <Button onClick={() => approveDist.mutate({ id: distribution.id })}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve Distribution
                    </Button>
                  )}
                  {distribution.status === "APPROVED" && (
                    <Button onClick={() => markDist.mutate({ id: distribution.id })}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Mark as Distributed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ DEMAND TAB ═══ */}
        <TabsContent value="demand" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Demand Letter</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Demand Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter demand amount"
                    value={caseDetails?.demandAmount ? Number(caseDetails.demandAmount) : ""}
                    onChange={(e) => updateCase.mutate({ matterId, demandAmount: Number(e.target.value) || null })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => genDemand.mutate({ matterId })} disabled={genDemand.isLoading}>
                  <Sparkles className="h-4 w-4 mr-1" /> {genDemand.isLoading ? "Generating..." : "Generate Demand Letter"}
                </Button>
              </div>

              {demandLetter && (
                <div className="border rounded-lg p-6 bg-white">
                  <div dangerouslySetInnerHTML={{ __html: demandLetter }} />
                </div>
              )}

              {/* Specials Reference */}
              {recordsSummary && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Medical Specials Reference</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p>Total Records: {recordsSummary.totalRecords}</p>
                      <p>Total Charges: {cur(recordsSummary.totalCharges)}</p>
                      <p>Total Paid: {cur(recordsSummary.totalPaid)}</p>
                      <p>Outstanding: {cur(recordsSummary.totalOutstanding)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function CaseDetailsForm({ caseDetails, onSave }: { caseDetails: any; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    dateOfIncident: caseDetails.dateOfIncident ? new Date(caseDetails.dateOfIncident).toISOString().split("T")[0] : "",
    incidentType: caseDetails.incidentType || "AUTO_ACCIDENT",
    incidentDescription: caseDetails.incidentDescription || "",
    injuryDescription: caseDetails.injuryDescription || "",
    liabilityAssessment: caseDetails.liabilityAssessment || "",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date of Incident</Label>
          <Input type="date" value={form.dateOfIncident} onChange={(e) => setForm({ ...form, dateOfIncident: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Incident Type</Label>
          <Select value={form.incidentType} onValueChange={(v) => setForm({ ...form, incidentType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Incident Description</Label>
        <Textarea rows={3} value={form.incidentDescription} onChange={(e) => setForm({ ...form, incidentDescription: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Injury Description</Label>
        <Textarea rows={3} value={form.injuryDescription} onChange={(e) => setForm({ ...form, injuryDescription: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Liability Assessment</Label>
        <Textarea rows={3} value={form.liabilityAssessment} onChange={(e) => setForm({ ...form, liabilityAssessment: e.target.value })} />
      </div>
      <Button onClick={() => onSave({ ...form, dateOfIncident: form.dateOfIncident || undefined })}>Save Changes</Button>
    </div>
  );
}

function InsuranceForm({ caseDetails, onSave }: { caseDetails: any; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    insuranceCompany: caseDetails.insuranceCompany || "",
    claimNumber: caseDetails.claimNumber || "",
    adjusterName: caseDetails.adjusterName || "",
    adjusterPhone: caseDetails.adjusterPhone || "",
    adjusterEmail: caseDetails.adjusterEmail || "",
    policyLimits: caseDetails.policyLimits ? Number(caseDetails.policyLimits) : "",
    umUimLimits: caseDetails.umUimLimits ? Number(caseDetails.umUimLimits) : "",
    attorneyFeePercentage: caseDetails.attorneyFeePercentage ? Number(caseDetails.attorneyFeePercentage) : 33.33,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Insurance Company</Label><Input value={form.insuranceCompany} onChange={(e) => setForm({ ...form, insuranceCompany: e.target.value })} /></div>
        <div className="space-y-2"><Label>Claim Number</Label><Input value={form.claimNumber} onChange={(e) => setForm({ ...form, claimNumber: e.target.value })} /></div>
        <div className="space-y-2"><Label>Adjuster Name</Label><Input value={form.adjusterName} onChange={(e) => setForm({ ...form, adjusterName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Adjuster Phone</Label><Input value={form.adjusterPhone} onChange={(e) => setForm({ ...form, adjusterPhone: e.target.value })} /></div>
        <div className="space-y-2"><Label>Adjuster Email</Label><Input value={form.adjusterEmail} onChange={(e) => setForm({ ...form, adjusterEmail: e.target.value })} /></div>
        <div className="space-y-2"><Label>Policy Limits</Label><Input type="number" step="0.01" value={form.policyLimits} onChange={(e) => setForm({ ...form, policyLimits: e.target.value ? Number(e.target.value) : "" })} /></div>
        <div className="space-y-2"><Label>UM/UIM Limits</Label><Input type="number" step="0.01" value={form.umUimLimits} onChange={(e) => setForm({ ...form, umUimLimits: e.target.value ? Number(e.target.value) : "" })} /></div>
        <div className="space-y-2"><Label>Attorney Fee %</Label><Input type="number" step="0.01" value={form.attorneyFeePercentage} onChange={(e) => setForm({ ...form, attorneyFeePercentage: Number(e.target.value) })} /></div>
      </div>
      <Button onClick={() => onSave({
        insuranceCompany: form.insuranceCompany || null,
        claimNumber: form.claimNumber || null,
        adjusterName: form.adjusterName || null,
        adjusterPhone: form.adjusterPhone || null,
        adjusterEmail: form.adjusterEmail || null,
        policyLimits: form.policyLimits || null,
        umUimLimits: form.umUimLimits || null,
        attorneyFeePercentage: form.attorneyFeePercentage || null,
      })}>Save Changes</Button>
    </div>
  );
}

function AISummaryDisplay({ summary }: { summary: any }) {
  if (!summary) return null;
  return (
    <div className="space-y-4">
      {summary.chronology && (
        <div>
          <h4 className="font-medium mb-1">Treatment Chronology</h4>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: summary.chronology }} />
        </div>
      )}
      {summary.keyInjuries?.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">Key Injuries</h4>
          <ul className="list-disc pl-5 space-y-1">{summary.keyInjuries.map((inj: string, i: number) => <li key={i}>{inj}</li>)}</ul>
        </div>
      )}
      {summary.treatmentSummary && (
        <div>
          <h4 className="font-medium mb-1">Treatment Summary</h4>
          <p className="text-sm">{summary.treatmentSummary}</p>
        </div>
      )}
      {summary.gaps?.length > 0 && (
        <div>
          <h4 className="font-medium mb-1 text-amber-700">Treatment Gaps</h4>
          <ul className="list-disc pl-5 space-y-1 text-amber-700">{summary.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}
      <p className="text-sm font-medium">Total Medical Specials: {cur(summary.totalCharges)}</p>
    </div>
  );
}

function RecordDialog({ open, onClose, matterId, record, providers, onSubmit, onCreateProvider, isLoading }: any) {
  const [form, setForm] = useState<any>({});
  const [newProvider, setNewProvider] = useState(false);
  const [providerForm, setProviderForm] = useState<any>({});

  // Reset form when record changes
  useState(() => {
    if (record) {
      setForm({
        providerId: record.providerId || "",
        providerName: record.providerName || "",
        recordType: record.recordType || "OFFICE_VISIT",
        dateOfService: record.dateOfService ? new Date(record.dateOfService).toISOString().split("T")[0] : "",
        endDate: record.endDate ? new Date(record.endDate).toISOString().split("T")[0] : "",
        description: record.description || "",
        diagnosis: record.diagnosis || "",
        treatingPhysician: record.treatingPhysician || "",
        totalCharges: record.totalCharges ? Number(record.totalCharges) : "",
        amountPaid: record.amountPaid ? Number(record.amountPaid) : "",
        adjustments: record.adjustments ? Number(record.adjustments) : "",
        outstandingBalance: record.outstandingBalance ? Number(record.outstandingBalance) : "",
        requestStatus: record.requestStatus || "NOT_REQUESTED",
        notes: record.notes || "",
      });
    } else {
      setForm({
        providerId: "",
        providerName: "",
        recordType: "OFFICE_VISIT",
        dateOfService: "",
        endDate: "",
        description: "",
        diagnosis: "",
        treatingPhysician: "",
        totalCharges: "",
        amountPaid: "",
        adjustments: "",
        outstandingBalance: "",
        requestStatus: "NOT_REQUESTED",
        notes: "",
      });
    }
  });

  const handleProviderChange = (providerId: string) => {
    if (providerId === "__new__") {
      setNewProvider(true);
      return;
    }
    const p = providers.find((x: any) => x.id === providerId);
    setForm({ ...form, providerId, providerName: p?.name || "" });
  };

  const outstanding = (Number(form.totalCharges) || 0) - (Number(form.amountPaid) || 0) - (Number(form.adjustments) || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Record" : "Add Medical Record"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={form.providerId || ""} onValueChange={handleProviderChange}>
              <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                {providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({fmt(p.type)})</SelectItem>)}
                <SelectItem value="__new__">+ Add New Provider</SelectItem>
              </SelectContent>
            </Select>
            {!form.providerId && (
              <Input placeholder="Or enter provider name" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Record Type</Label>
              <Select value={form.recordType} onValueChange={(v) => setForm({ ...form, recordType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECORD_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Service</Label>
              <Input type="date" value={form.dateOfService} onChange={(e) => setForm({ ...form, dateOfService: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>End Date (optional)</Label>
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>

          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>Diagnosis</Label><Textarea rows={2} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
          <div className="space-y-2"><Label>Treating Physician</Label><Input value={form.treatingPhysician} onChange={(e) => setForm({ ...form, treatingPhysician: e.target.value })} /></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2"><Label>Total Charges</Label><Input type="number" step="0.01" value={form.totalCharges} onChange={(e) => setForm({ ...form, totalCharges: e.target.value })} /></div>
            <div className="space-y-2"><Label>Paid</Label><Input type="number" step="0.01" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} /></div>
            <div className="space-y-2"><Label>Adjustments</Label><Input type="number" step="0.01" value={form.adjustments} onChange={(e) => setForm({ ...form, adjustments: e.target.value })} /></div>
            <div className="space-y-2"><Label>Outstanding</Label><Input type="number" step="0.01" readOnly value={outstanding > 0 ? outstanding.toFixed(2) : ""} className="bg-slate-50" /></div>
          </div>

          <div className="space-y-2">
            <Label>Request Status</Label>
            <Select value={form.requestStatus} onValueChange={(v) => setForm({ ...form, requestStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REQUEST_STATUSES.map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={isLoading || !form.providerName || !form.dateOfService}
              onClick={() => {
                const data: any = {
                  providerName: form.providerName,
                  recordType: form.recordType,
                  dateOfService: form.dateOfService,
                  description: form.description || undefined,
                  diagnosis: form.diagnosis || undefined,
                  treatingPhysician: form.treatingPhysician || undefined,
                  totalCharges: form.totalCharges ? Number(form.totalCharges) : undefined,
                  amountPaid: form.amountPaid ? Number(form.amountPaid) : undefined,
                  adjustments: form.adjustments ? Number(form.adjustments) : undefined,
                  outstandingBalance: outstanding > 0 ? outstanding : undefined,
                  requestStatus: form.requestStatus,
                  notes: form.notes || undefined,
                };
                if (form.providerId && form.providerId !== "__new__") data.providerId = form.providerId;
                if (form.endDate) data.endDate = form.endDate;
                onSubmit(data);
              }}
            >
              {isLoading ? "Saving..." : record ? "Update" : "Add Record"}
            </Button>
          </div>
        </div>

        {/* New Provider Sub-Dialog */}
        <Dialog open={newProvider} onOpenChange={setNewProvider}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Provider</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={providerForm.name || ""} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={providerForm.type || "HOSPITAL"} onValueChange={(v) => setProviderForm({ ...providerForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["HOSPITAL", "ER", "PRIMARY_CARE", "SPECIALIST", "SURGEON", "CHIROPRACTOR", "PHYSICAL_THERAPY", "IMAGING", "PHARMACY", "AMBULANCE", "MENTAL_HEALTH", "OTHER"].map((t) => (
                      <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={providerForm.phone || ""} onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Fax</Label><Input value={providerForm.fax || ""} onChange={(e) => setProviderForm({ ...providerForm, fax: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setNewProvider(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (providerForm.name) {
                    onCreateProvider({ name: providerForm.name, type: providerForm.type || "HOSPITAL", phone: providerForm.phone, fax: providerForm.fax });
                    setForm({ ...form, providerName: providerForm.name });
                    setNewProvider(false);
                    setProviderForm({});
                  }
                }}>Add Provider</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function LienDialog({ open, onClose, lien, providers, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>(() => {
    if (lien) return {
      providerName: lien.providerName || "",
      providerId: lien.providerId || "",
      lienType: lien.lienType || "HOSPITAL",
      originalAmount: lien.originalAmount ? Number(lien.originalAmount) : "",
      negotiatedAmount: lien.negotiatedAmount ? Number(lien.negotiatedAmount) : "",
      paidAmount: lien.paidAmount ? Number(lien.paidAmount) : "",
      status: lien.status || "PENDING",
      priority: lien.priority ?? 0,
      lienHolderName: lien.lienHolderName || "",
      lienHolderContact: lien.lienHolderContact || "",
      assertedDate: lien.assertedDate ? new Date(lien.assertedDate).toISOString().split("T")[0] : "",
      dueDate: lien.dueDate ? new Date(lien.dueDate).toISOString().split("T")[0] : "",
      reductionNotes: lien.reductionNotes || "",
      notes: lien.notes || "",
    };
    return {
      providerName: "", providerId: "", lienType: "HOSPITAL", originalAmount: "", negotiatedAmount: "",
      paidAmount: "", status: "PENDING", priority: 0, lienHolderName: "", lienHolderContact: "",
      assertedDate: "", dueDate: "", reductionNotes: "", notes: "",
    };
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lien ? "Edit Lien" : "Add Lien"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Lien Holder Name</Label><Input value={form.lienHolderName} onChange={(e) => setForm({ ...form, lienHolderName: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Lien Type</Label>
              <Select value={form.lienType} onValueChange={(v) => setForm({ ...form, lienType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LIEN_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Provider (optional)</Label>
            <Select value={form.providerId || ""} onValueChange={(v) => {
              const p = providers.find((x: any) => x.id === v);
              setForm({ ...form, providerId: v, providerName: p?.name || form.providerName });
            }}>
              <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>{providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {!form.providerId && <Input placeholder="Or enter provider name" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Original Amount</Label><Input type="number" step="0.01" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Negotiated Amount</Label><Input type="number" step="0.01" value={form.negotiatedAmount} onChange={(e) => setForm({ ...form, negotiatedAmount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Paid Amount</Label><Input type="number" step="0.01" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LIEN_STATUSES.map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Asserted Date</Label><Input type="date" value={form.assertedDate} onChange={(e) => setForm({ ...form, assertedDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>

          <div className="space-y-2"><Label>Contact Info (JSON)</Label><Textarea rows={2} placeholder='{"name": "", "phone": "", "email": ""}' value={form.lienHolderContact} onChange={(e) => setForm({ ...form, lienHolderContact: e.target.value })} /></div>
          <div className="space-y-2"><Label>Reduction Notes</Label><Textarea rows={2} value={form.reductionNotes} onChange={(e) => setForm({ ...form, reductionNotes: e.target.value })} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={isLoading || !form.lienHolderName || !form.originalAmount}
              onClick={() => {
                onSubmit({
                  providerName: form.providerName || form.lienHolderName,
                  providerId: form.providerId || undefined,
                  lienType: form.lienType,
                  originalAmount: Number(form.originalAmount),
                  negotiatedAmount: form.negotiatedAmount ? Number(form.negotiatedAmount) : undefined,
                  paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
                  status: form.status,
                  priority: form.priority,
                  lienHolderName: form.lienHolderName,
                  lienHolderContact: form.lienHolderContact || undefined,
                  assertedDate: form.assertedDate || undefined,
                  dueDate: form.dueDate || undefined,
                  reductionNotes: form.reductionNotes || undefined,
                  notes: form.notes || undefined,
                });
              }}
            >
              {isLoading ? "Saving..." : lien ? "Update" : "Add Lien"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
