"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
  Send,
  Star,
  Loader2,
  Info,
  Eye,
} from "lucide-react";

const DOCUMENT_TYPES = [
  "Petition", "Complaint", "Motion", "Affidavit", "Exhibit", "Proposed Order",
  "Cover Sheet", "Certificate of Service", "Memorandum of Law", "Answer",
  "Cross-Motion", "Reply", "Stipulation", "Notice", "Subpoena", "Other",
];

const STEPS = [
  { id: 1, label: "Court & Matter", icon: Building2 },
  { id: 2, label: "Documents", icon: FileText },
  { id: 3, label: "Service", icon: Users },
  { id: 4, label: "Review & File", icon: Send },
];

function NewFilingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const preselectedMatterId = searchParams.get("matterId") || "";

  // Step 1 state
  const [matterId, setMatterId] = useState(preselectedMatterId);
  const [courtId, setCourtId] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [filingType, setFilingType] = useState("INITIAL");
  const [requirements, setRequirements] = useState<any>(null);

  // Step 2 state
  const [documents, setDocuments] = useState<Array<{
    draftDocumentId?: string;
    filename: string;
    documentType: string;
    isLeadDocument: boolean;
  }>>([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [newDocType, setNewDocType] = useState("Petition");
  const [newDocFilename, setNewDocFilename] = useState("");

  // Step 3 state
  const [serviceList, setServiceList] = useState<Array<{
    name: string;
    email?: string;
    address?: string;
    type: "email" | "mail";
  }>>([]);
  const [feeWaived, setFeeWaived] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [newPartyType, setNewPartyType] = useState<"email" | "mail">("email");

  // Step 4 state
  const [certified, setCertified] = useState(false);
  const [filerName, setFilerName] = useState("");
  const [filerEmail, setFilerEmail] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);

  // Queries
  const { data: mattersData } = trpc.matters.list.useQuery();
  const matters = (mattersData as any)?.matters || mattersData || [];
  const { data: courts } = trpc.efiling.listCourts.useQuery({});
  const { data: drafts } = trpc.drafting.listDrafts.useQuery(
    { matterId: matterId || undefined } as any
  );

  // Mutations
  const checkReqs = trpc.efiling.getFilingRequirements.useMutation({
    onSuccess: (data) => setRequirements(data),
  });
  const suggestService = trpc.efiling.suggestServiceList.useMutation({
    onSuccess: (data: any) => {
      if (Array.isArray(data) && data.length > 0) {
        setServiceList(data);
        toast({ title: `Suggested ${data.length} service parties` });
      }
    },
  });
  const createFiling = trpc.efiling.create.useMutation();
  const validateMut = trpc.efiling.validate.useMutation({
    onSuccess: (data) => setValidationResult(data),
  });
  const submitMut = trpc.efiling.submit.useMutation({
    onSuccess: (data) => {
      setConfirmationNumber(data.confirmationNumber);
      toast({ title: "Filing submitted!", description: `Confirmation: ${data.confirmationNumber}` });
    },
  });
  const coverSheetMut = trpc.efiling.generateCoverSheet.useMutation();

  const selectedMatter = (matters as any[])?.find?.((m: any) => m.id === matterId);
  const selectedCourt = courts?.find((c) => c.id === courtId);

  // Group courts by state
  const courtsByState: Record<string, typeof courts> = {};
  courts?.forEach((c) => {
    if (!courtsByState[c.state]) courtsByState[c.state] = [];
    courtsByState[c.state]!.push(c);
  });

  const addDocument = () => {
    if (selectedDraftId && selectedDraftId !== "none") {
      const draft = drafts?.find((d) => d.id === selectedDraftId);
      if (draft) {
        setDocuments([...documents, {
          draftDocumentId: draft.id,
          filename: draft.title + ".pdf",
          documentType: newDocType,
          isLeadDocument: documents.length === 0,
        }]);
      }
    } else if (newDocFilename) {
      setDocuments([...documents, {
        filename: newDocFilename,
        documentType: newDocType,
        isLeadDocument: documents.length === 0,
      }]);
    }
    setSelectedDraftId("");
    setNewDocFilename("");
    setNewDocType("Petition");
  };

  const addServiceParty = () => {
    if (!newPartyName) return;
    setServiceList([...serviceList, {
      name: newPartyName,
      email: newPartyEmail || undefined,
      type: newPartyType,
    }]);
    setNewPartyName("");
    setNewPartyEmail("");
  };

  const handleCreateAndValidate = async () => {
    if (!submissionId) {
      const sub = await createFiling.mutateAsync({
        matterId,
        courtId,
        filingType,
        title: documents[0]?.filename || "Filing",
        caseNumber: caseNumber || undefined,
        filerName,
        filerEmail,
        documents: JSON.stringify(documents),
        serviceList: serviceList.length > 0 ? JSON.stringify(serviceList) : undefined,
        feeWaived,
      });
      setSubmissionId(sub.id);
      validateMut.mutate({ submissionId: sub.id });
    } else {
      validateMut.mutate({ submissionId });
    }
  };

  const handleSubmit = async () => {
    if (!submissionId) return;
    submitMut.mutate({ submissionId });
  };

  const canProceed = () => {
    switch (step) {
      case 1: return matterId && courtId && filingType;
      case 2: return documents.length > 0;
      case 3: return true;
      case 4: return certified && filerName && filerEmail;
      default: return false;
    }
  };

  if (confirmationNumber) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Filing Submitted Successfully</h1>
        <p className="text-gray-500 mb-6">Your filing has been submitted to the court for processing.</p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 inline-block">
          <p className="text-sm text-green-600 mb-1">Confirmation Number</p>
          <p className="text-2xl font-mono font-bold text-green-800">{confirmationNumber}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/efiling">Back to E-Filing</Link>
          </Button>
          {submissionId && (
            <Button className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href={`/efiling/${submissionId}`}>View Filing Details</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/efiling"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">New E-Filing</h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => s.id < step && setStep(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                step === s.id ? "bg-blue-50 text-blue-700 border border-blue-200" :
                step > s.id ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"
              }`}
            >
              {step > s.id ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <s.icon className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step 1: Court & Matter */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="space-y-1">
            <Label>Matter *</Label>
            <Select value={matterId} onValueChange={setMatterId}>
              <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
              <SelectContent>
                {(matters as any[])?.map?.((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.matterNumber} - {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Court *</Label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger><SelectValue placeholder="Select court..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(courtsByState).map(([state, stateCourts]) => (
                  <div key={state}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">{state}</div>
                    {stateCourts?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.efilingProvider ? `(${c.efilingProvider})` : ""}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Case Number</Label>
              <Input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="Leave blank for initial filings" />
            </div>
            <div className="space-y-1">
              <Label>Filing Type *</Label>
              <Select value={filingType} onValueChange={setFilingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INITIAL">Initial Filing</SelectItem>
                  <SelectItem value="SUBSEQUENT">Subsequent Filing</SelectItem>
                  <SelectItem value="SERVICE">Service Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {courtId && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkReqs.mutate({ courtId, filingType })}
                disabled={checkReqs.isPending}
              >
                <Info className="h-3 w-3 mr-1" /> {checkReqs.isPending ? "Checking..." : "Check Requirements"}
              </Button>
              {requirements && (
                <div className="mt-3 border border-blue-200 rounded-lg bg-blue-50 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">Requirements</p>
                    <ul className="text-xs text-blue-600 space-y-0.5">
                      {requirements.requirements?.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-1"><CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" /> {r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">Common Errors to Avoid</p>
                    <ul className="text-xs text-amber-600 space-y-0.5">
                      {requirements.commonErrors?.map((e: string, i: number) => (
                        <li key={i} className="flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {e}</li>
                      ))}
                    </ul>
                  </div>
                  {requirements.estimatedFee && (
                    <p className="text-xs text-gray-600">Estimated Fee: <span className="font-semibold">{requirements.estimatedFee}</span></p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Documents */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold">Filing Documents</h2>

          {/* Document list */}
          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{doc.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{doc.documentType}</span>
                      {doc.isLeadDocument && (
                        <span className="flex items-center gap-0.5 text-amber-600"><Star className="h-2.5 w-2.5" /> Lead</span>
                      )}
                      {doc.draftDocumentId && <span className="text-blue-500">From Drafts</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newDocs = [...documents];
                      newDocs.forEach((d, i) => { d.isLeadDocument = i === idx; });
                      setDocuments(newDocs);
                    }}
                    title="Set as lead document"
                  >
                    <Star className={`h-3 w-3 ${doc.isLeadDocument ? "text-amber-500 fill-amber-500" : "text-gray-300"}`} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add document form */}
          <div className="border border-dashed border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">Add Document</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From Drafts</Label>
                <Select value={selectedDraftId} onValueChange={(v) => { setSelectedDraftId(v); if (v !== "none") setNewDocFilename(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select draft..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Manual entry —</SelectItem>
                    {drafts?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Or Enter Filename</Label>
                <Input
                  value={newDocFilename}
                  onChange={(e) => { setNewDocFilename(e.target.value); if (e.target.value) setSelectedDraftId(""); }}
                  placeholder="filename.pdf"
                  disabled={!!selectedDraftId && selectedDraftId !== "none"}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Document Type</Label>
                <Select value={newDocType} onValueChange={setNewDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" onClick={addDocument} disabled={!selectedDraftId && !newDocFilename}>
              <Plus className="h-3 w-3 mr-1" /> Add Document
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Service */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Service List</h2>
            {matterId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => suggestService.mutate({ matterId })}
                disabled={suggestService.isPending}
              >
                <Sparkles className="h-3 w-3 mr-1" /> {suggestService.isPending ? "Loading..." : "Auto-populate from Matter"}
              </Button>
            )}
          </div>

          {serviceList.length > 0 && (
            <div className="space-y-2">
              {serviceList.map((party, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Users className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{party.name}</p>
                    <p className="text-xs text-gray-400">
                      {party.type === "email" ? `Electronic: ${party.email || "No email"}` : `Mail: ${party.address || "No address"}`}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${party.type === "email" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {party.type === "email" ? "Electronic" : "Mail"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setServiceList(serviceList.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border border-dashed border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">Add Party</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Party name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={newPartyEmail} onChange={(e) => setNewPartyEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Service Type</Label>
                <Select value={newPartyType} onValueChange={(v) => setNewPartyType(v as "email" | "mail")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Electronic</SelectItem>
                    <SelectItem value="mail">Mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={addServiceParty} disabled={!newPartyName}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={feeWaived} onChange={(e) => setFeeWaived(e.target.checked)} className="rounded border-gray-300" />
              Fee waiver applies to this filing
            </label>
          </div>
        </div>
      )}

      {/* Step 4: Review & File */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold">Filing Summary</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Court:</span> <span className="font-medium">{selectedCourt?.name}</span></div>
              <div><span className="text-gray-400">Matter:</span> <span className="font-medium">{selectedMatter?.name}</span></div>
              <div><span className="text-gray-400">Filing Type:</span> <span className="font-medium">{filingType}</span></div>
              <div><span className="text-gray-400">Case Number:</span> <span className="font-medium">{caseNumber || "New Case"}</span></div>
              <div><span className="text-gray-400">Documents:</span> <span className="font-medium">{documents.length}</span></div>
              <div><span className="text-gray-400">Service Parties:</span> <span className="font-medium">{serviceList.length}</span></div>
              <div><span className="text-gray-400">Fee Waived:</span> <span className="font-medium">{feeWaived ? "Yes" : "No"}</span></div>
            </div>

            {/* Documents list */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Documents</p>
              <div className="space-y-1">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                    <FileText className="h-3 w-3 text-gray-400" />
                    <span className="font-medium">{doc.filename}</span>
                    <span className="text-gray-400">({doc.documentType})</span>
                    {doc.isLeadDocument && <span className="text-amber-600 font-medium">Lead</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Service list */}
            {serviceList.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Service List</p>
                <div className="space-y-1">
                  {serviceList.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-400">({p.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filer Info & Certification */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold">Filer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Filer Name *</Label>
                <Input value={filerName} onChange={(e) => setFilerName(e.target.value)} placeholder="Attorney name" />
              </div>
              <div className="space-y-1">
                <Label>Filer Email *</Label>
                <Input value={filerEmail} onChange={(e) => setFilerEmail(e.target.value)} placeholder="attorney@firm.com" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
              <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} className="rounded border-gray-300 mt-0.5" />
              <span>I certify that the foregoing documents are true and correct to the best of my knowledge, information, and belief, formed after an inquiry reasonable under the circumstances.</span>
            </label>
          </div>

          {/* Validation */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Validation</h2>
              <Button
                variant="outline"
                onClick={handleCreateAndValidate}
                disabled={validateMut.isPending || createFiling.isPending}
              >
                {validateMut.isPending || createFiling.isPending ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Validating...</>
                ) : (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Validate Filing</>
                )}
              </Button>
            </div>

            {validationResult && (
              <div className="space-y-3">
                {validationResult.isValid && validationResult.errors?.length === 0 ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Filing is ready to submit
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> Validation Errors
                    </p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {validationResult.errors?.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
                {validationResult.warnings?.length > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-700 mb-2">Warnings</p>
                    <ul className="text-xs text-amber-600 space-y-1">
                      {validationResult.warnings.map((w: string, i: number) => <li key={i}>• {w}</li>)}
                    </ul>
                  </div>
                )}
                {validationResult.suggestions?.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-700 mb-2">Suggestions</p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      {validationResult.suggestions.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          {step < 4 ? (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={!certified || !filerName || !filerEmail || !submissionId || submitMut.isPending ||
                !(validationResult?.isValid && validationResult?.errors?.length === 0)}
            >
              {submitMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Submit Filing</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewFilingPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading...</div>}>
      <NewFilingContent />
    </Suspense>
  );
}
