"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Image, FileText, Upload, Plus, Check, X as XIcon, AlertTriangle,
  Filter, ChevronDown, ChevronRight, Star, Clock, Tag, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const SPECIMEN_TYPES = [
  { value: "WEBSITE", label: "Website Screenshot" }, { value: "PRODUCT_LABEL", label: "Product Label" },
  { value: "PACKAGING", label: "Packaging" }, { value: "HANG_TAG", label: "Hang Tag" },
  { value: "ADVERTISEMENT", label: "Advertisement" }, { value: "STORE_DISPLAY", label: "Store Display" },
  { value: "OTHER", label: "Other" },
];

const FILING_TYPES = [
  { value: "INITIAL_APP", label: "Initial Application" }, { value: "SOU", label: "Statement of Use" },
  { value: "SEC8", label: "Section 8 Renewal" }, { value: "SEC8_15", label: "Section 8 & 15 Combined" },
  { value: "SEC8_RENEWAL", label: "Section 8 (Year 10)" }, { value: "OTHER", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", ACCEPTED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700",
};

function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }

export default function SpecimensPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [showUpload, setShowUpload] = useState(false);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"byClass" | "flat">("byClass");
  const [expandedClasses, setExpandedClasses] = useState<Record<number, boolean>>({});

  // Upload form state
  const [uploadClass, setUploadClass] = useState("1");
  const [uploadType, setUploadType] = useState("WEBSITE");
  const [uploadFiling, setUploadFiling] = useState("");
  const [uploadGoods, setUploadGoods] = useState("");
  const [uploadUseCommerce, setUploadUseCommerce] = useState("");
  const [uploadUseAnywhere, setUploadUseAnywhere] = useState("");
  const [uploadCollected, setUploadCollected] = useState(new Date().toISOString().split("T")[0]);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");

  const tmQuery = trpc.docketing.getTrademarkForMatter.useQuery({ matterId });
  const tm = tmQuery.data;

  const specimensQuery = trpc.specimens.list.useQuery(
    { matterId, trademarkDocketId: tm?.id, niceClass: filterClass !== "all" ? Number(filterClass) : undefined, status: filterStatus !== "all" ? filterStatus : undefined },
    { enabled: !!tm }
  );
  const summaryQuery = trpc.specimens.getSummary.useQuery({ matterId, trademarkDocketId: tm?.id || "" }, { enabled: !!tm });
  const createMut = trpc.specimens.create.useMutation({ onSuccess: () => { specimensQuery.refetch(); summaryQuery.refetch(); setShowUpload(false); } });
  const markCurrentMut = trpc.specimens.markCurrent.useMutation({ onSuccess: () => specimensQuery.refetch() });
  const updateMut = trpc.specimens.update.useMutation({ onSuccess: () => specimensQuery.refetch() });
  const renewalMut = trpc.specimens.checkRenewalDeadlines.useMutation();

  const specimens = specimensQuery.data || [];
  const summary = summaryQuery.data;

  // Group by class
  const byClass: Record<number, typeof specimens> = {};
  for (const s of specimens) {
    if (!byClass[s.niceClass]) byClass[s.niceClass] = [];
    byClass[s.niceClass].push(s);
  }

  function toggleClass(cls: number) {
    setExpandedClasses((prev) => ({ ...prev, [cls]: !prev[cls] }));
  }

  function handleUpload() {
    if (!tm || !uploadUseCommerce) return;
    createMut.mutate({
      trademarkDocketId: tm.id, matterId, niceClass: Number(uploadClass), goodsServices: uploadGoods || undefined,
      specimenType: uploadType, fileUrl: `/specimens/${Date.now()}-${uploadFileName || "specimen"}`, fileName: uploadFileName || "specimen.pdf",
      fileType: uploadFileName.endsWith(".pdf") ? "application/pdf" : "image/jpeg", fileSize: 0,
      dateFirstUseCommerce: uploadUseCommerce, dateFirstUseAnywhere: uploadUseAnywhere || undefined,
      dateCollected: uploadCollected || undefined, filingAssociation: uploadFiling || undefined, notes: uploadNotes || undefined,
    });
  }

  if (!tm) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Image className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Specimen Management</h2>
          <p className="text-sm text-muted-foreground mt-2">Add a trademark to this matter first via the <a href={`/matters/${matterId}/trademark`} className="text-blue-600 underline">Trademark Monitor</a> tab.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Image className="h-6 w-6 text-indigo-600" /> Specimens — {tm.markName}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">SN {tm.serialNumber} · {tm.internationalClasses ? `Classes ${tm.internationalClasses}` : "No classes"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => renewalMut.mutate({ trademarkDocketId: tm.id })} disabled={renewalMut.isLoading}>
            {renewalMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />} Check Renewals
          </Button>
          <Button size="sm" onClick={() => setShowUpload(!showUpload)}><Plus className="h-4 w-4 mr-1" /> Upload Specimen</Button>
        </div>
      </div>

      {renewalMut.isSuccess && (renewalMut.data as any)?.tasks > 0 && (
        <Card className="p-3 bg-amber-50 border-amber-200"><p className="text-sm text-amber-700"><AlertTriangle className="h-4 w-4 inline mr-1" /> Created {(renewalMut.data as any).tasks} renewal task(s): {(renewalMut.data as any).created?.join(", ")}</p></Card>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{summary.total}</p></Card>
          <Card className="p-3"><p className="text-xs text-muted-foreground">Classes Covered</p><p className="text-lg font-bold">{summary.classesCovered.length}</p><p className="text-[10px] text-muted-foreground">{summary.classesCovered.join(", ") || "—"}</p></Card>
          <Card className="p-3"><p className="text-xs text-muted-foreground">Last Collected</p><p className="text-sm font-bold mt-0.5">{fmtDate(summary.lastSpecimenDate)}</p></Card>
          <Card className="p-3"><p className="text-xs text-amber-600">Pending</p><p className="text-lg font-bold text-amber-600">{summary.pendingCount}</p></Card>
          <Card className="p-3"><p className="text-xs text-red-600">Rejected</p><p className="text-lg font-bold text-red-600">{summary.rejectedCount}</p></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Classes</SelectItem>
            {Array.from(new Set(specimens.map((s) => s.niceClass))).sort((a, b) => a - b).map((c) => (
              <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
            ))}</SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="ACCEPTED">Accepted</SelectItem><SelectItem value="REJECTED">Rejected</SelectItem></SelectContent>
        </Select>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setViewMode("byClass")} className={cn("px-2 py-1 text-xs rounded", viewMode === "byClass" ? "bg-indigo-100 text-indigo-700" : "text-muted-foreground")}>By Class</button>
          <button onClick={() => setViewMode("flat")} className={cn("px-2 py-1 text-xs rounded", viewMode === "flat" ? "bg-indigo-100 text-indigo-700" : "text-muted-foreground")}>Flat List</button>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <Card className="p-4 border-indigo-200 bg-indigo-50/30 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-800">Upload Specimen</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="text-xs text-muted-foreground">Nice Class *</label>
              <Select value={uploadClass} onValueChange={setUploadClass}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 45 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Class {i + 1}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Specimen Type *</label>
              <Select value={uploadType} onValueChange={setUploadType}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>{SPECIMEN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Date First Use in Commerce *</label>
              <Input type="date" value={uploadUseCommerce} onChange={(e) => setUploadUseCommerce(e.target.value)} className="h-8 text-sm mt-0.5" /></div>
            <div><label className="text-xs text-muted-foreground">Date First Use Anywhere</label>
              <Input type="date" value={uploadUseAnywhere} onChange={(e) => setUploadUseAnywhere(e.target.value)} className="h-8 text-sm mt-0.5" /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="text-xs text-muted-foreground">Date Collected</label>
              <Input type="date" value={uploadCollected} onChange={(e) => setUploadCollected(e.target.value)} className="h-8 text-sm mt-0.5" /></div>
            <div><label className="text-xs text-muted-foreground">Filing Association</label>
              <Select value={uploadFiling} onValueChange={setUploadFiling}><SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{FILING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground">Goods/Services Description</label>
              <Input value={uploadGoods} onChange={(e) => setUploadGoods(e.target.value)} placeholder="Describe goods/services for this class" className="h-8 text-sm mt-0.5" /></div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1"><label className="text-xs text-muted-foreground">File</label>
              <div className="flex items-center gap-2 mt-0.5">
                <label className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-white border rounded text-sm hover:bg-gray-50">
                  <Upload className="h-4 w-4" /> Choose File
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setUploadFileName(e.target.files?.[0]?.name || "")} />
                </label>
                {uploadFileName && <span className="text-xs text-muted-foreground">{uploadFileName}</span>}
              </div>
            </div>
            <Input value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Notes..." className="h-8 text-sm flex-1" />
            <Button size="sm" onClick={handleUpload} disabled={!uploadUseCommerce || createMut.isLoading}>
              {createMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />} Upload
            </Button>
          </div>
        </Card>
      )}

      {/* Specimens List */}
      {viewMode === "byClass" ? (
        <div className="space-y-3">
          {Object.entries(byClass).sort(([a], [b]) => Number(a) - Number(b)).map(([cls, classSpecimens]) => {
            const classNum = Number(cls);
            const expanded = expandedClasses[classNum] !== false;
            const currentSpecimen = classSpecimens.find((s) => s.isCurrent);
            return (
              <Card key={cls}>
                <button onClick={() => toggleClass(classNum)} className="w-full text-left p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div>
                      <span className="text-sm font-semibold">Class {cls}</span>
                      <span className="text-xs text-muted-foreground ml-2">({classSpecimens.length} specimen{classSpecimens.length !== 1 ? "s" : ""})</span>
                      {classSpecimens[0]?.goodsServices && <p className="text-xs text-muted-foreground mt-0.5">{classSpecimens[0].goodsServices}</p>}
                    </div>
                  </div>
                  {currentSpecimen && <Badge className="text-[10px] bg-indigo-100 text-indigo-700"><Star className="h-3 w-3 mr-0.5 inline" /> Current: {currentSpecimen.specimenType.replace("_", " ")}</Badge>}
                </button>
                {expanded && (
                  <CardContent className="pt-0 space-y-2">
                    {classSpecimens.map((s) => (
                      <SpecimenCard key={s.id} specimen={s} onMarkCurrent={() => markCurrentMut.mutate({ id: s.id })} onUpdateStatus={(status, reason) => updateMut.mutate({ id: s.id, status, rejectionReason: reason })} />
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
          {Object.keys(byClass).length === 0 && <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">No specimens uploaded yet</p></Card>}
        </div>
      ) : (
        <div className="space-y-2">
          {specimens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((s) => (
            <SpecimenCard key={s.id} specimen={s} showClass onMarkCurrent={() => markCurrentMut.mutate({ id: s.id })} onUpdateStatus={(status, reason) => updateMut.mutate({ id: s.id, status, rejectionReason: reason })} />
          ))}
          {specimens.length === 0 && <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">No specimens match filters</p></Card>}
        </div>
      )}
    </div>
  );
}

function SpecimenCard({ specimen: s, showClass, onMarkCurrent, onUpdateStatus }: { specimen: any; showClass?: boolean; onMarkCurrent: () => void; onUpdateStatus: (status: string, reason?: string) => void }) {
  const isImage = s.fileType?.startsWith("image");
  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", s.isCurrent ? "border-indigo-300 bg-indigo-50/30" : s.isSuperseded ? "opacity-50" : "")}>
      {/* Thumbnail */}
      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
        {isImage ? <Image className="h-8 w-8 text-gray-300" /> : <FileText className="h-8 w-8 text-gray-300" />}
      </div>
      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showClass && <Badge variant="outline" className="text-[10px]">Class {s.niceClass}</Badge>}
          <Badge variant="outline" className="text-[10px]">{(s.specimenType || "").replace(/_/g, " ")}</Badge>
          <Badge className={cn("text-[10px]", STATUS_COLORS[s.status] || "")}>{s.status}</Badge>
          {s.isCurrent && <Badge className="text-[10px] bg-indigo-100 text-indigo-700"><Star className="h-3 w-3 inline mr-0.5" /> Current</Badge>}
          {s.filingAssociation && <Badge variant="outline" className="text-[9px]">{FILING_TYPES.find((f) => f.value === s.filingAssociation)?.label || s.filingAssociation}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{s.fileName}</p>
        <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
          <span><Clock className="h-3 w-3 inline mr-0.5" /> Use: {fmtDate(s.dateFirstUseCommerce)}</span>
          <span>Collected: {fmtDate(s.dateCollected)}</span>
          <span>Uploaded: {fmtDate(s.createdAt)}</span>
        </div>
        {s.rejectionReason && <p className="text-xs text-red-600 mt-1">Rejection: {s.rejectionReason}</p>}
        {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
      </div>
      {/* Actions */}
      <div className="flex flex-col gap-1">
        {!s.isCurrent && !s.isSuperseded && <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={onMarkCurrent}>Set Current</Button>}
        {s.status === "PENDING" && (
          <>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 text-green-600" onClick={() => onUpdateStatus("ACCEPTED")}><Check className="h-3 w-3 mr-0.5" /> Accept</Button>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 text-red-600" onClick={() => { const r = prompt("Rejection reason?"); if (r) onUpdateStatus("REJECTED", r); }}><XIcon className="h-3 w-3 mr-0.5" /> Reject</Button>
          </>
        )}
      </div>
    </div>
  );
}
