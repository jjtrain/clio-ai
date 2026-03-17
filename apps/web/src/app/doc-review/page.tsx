"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Sparkles, Shield, FileCheck, Stethoscope, Info, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";

const BRIEF_TYPES = ["MOTION", "BRIEF", "MEMO", "OPPOSITION", "REPLY", "DISCOVERY_RESPONSE", "OTHER"];
const STATUS_COLORS: Record<string, string> = {
  valid: "bg-green-100 text-green-700", overruled: "bg-red-100 text-red-700",
  distinguished: "bg-amber-100 text-amber-700", questioned: "bg-orange-100 text-orange-700",
  not_found: "bg-gray-100 text-gray-700", supported: "bg-green-100 text-green-700",
  unsupported: "bg-red-100 text-red-700", needs_review: "bg-amber-100 text-amber-700",
  defined: "bg-green-100 text-green-700", undefined: "bg-red-100 text-red-700",
  inconsistent: "bg-amber-100 text-amber-700", REQUESTED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-amber-100 text-amber-700", SUMMARIZED: "bg-green-100 text-green-700",
  REVIEWED: "bg-green-100 text-green-700", FLAGGED: "bg-red-100 text-red-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function DocReviewPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("ai-review");

  // Brief Analysis state
  const [briefText, setBriefText] = useState("");
  const [briefType, setBriefType] = useState("MOTION");
  const [briefMatterId, setBriefMatterId] = useState("");
  const [briefResults, setBriefResults] = useState<any>(null);

  // Contract Proofing state
  const [contractText, setContractText] = useState("");
  const [contractMatterId, setContractMatterId] = useState("");
  const [contractResults, setContractResults] = useState<any>(null);

  // Medical Records state
  const [mrPatient, setMrPatient] = useState("");
  const [mrProvider, setMrProvider] = useState("");
  const [mrType, setMrType] = useState("OFFICE_VISIT");
  const [mrMatterId, setMrMatterId] = useState("");

  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const matters = mattersData?.matters || [];

  const { data: medRecords } = trpc.docTools["medilenz.list"].useQuery(
    { matterId: mrMatterId },
    { enabled: !!mrMatterId }
  );

  // Mutations
  const analyzeBrief = trpc.docTools["clearbrief.analyze"].useMutation({
    onSuccess: (d) => {
      if (d.success) { setBriefResults((d as any).data); toast({ title: "Brief analyzed" }); }
      else toast({ title: (d as any).error, variant: "destructive" });
    },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const analyzeContract = trpc.docTools["definely.analyze"].useMutation({
    onSuccess: (d) => {
      if (d.success) { setContractResults((d as any).data); toast({ title: "Document analyzed" }); }
      else toast({ title: (d as any).error, variant: "destructive" });
    },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const submitMedRecords = trpc.docTools["medilenz.submit"].useMutation({
    onSuccess: () => { toast({ title: "Records submitted for processing" }); setMrPatient(""); setMrProvider(""); },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const getMedSummary = trpc.docTools["medilenz.getSummary"].useMutation({
    onSuccess: (d) => {
      if (d.success) toast({ title: "Summary retrieved" });
      else toast({ title: (d as any).error, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review & Analysis</h1>
        <p className="text-sm text-slate-500">AI-powered document review, citation checking, contract proofing, and medical record summarization</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ai-review"><Sparkles className="h-3 w-3 mr-1" /> AI Review</TabsTrigger>
          <TabsTrigger value="brief-analysis"><Shield className="h-3 w-3 mr-1" /> Brief Analysis</TabsTrigger>
          <TabsTrigger value="contract-proofing"><FileCheck className="h-3 w-3 mr-1" /> Contract Proofing</TabsTrigger>
          <TabsTrigger value="medical-records"><Stethoscope className="h-3 w-3 mr-1" /> Medical Records</TabsTrigger>
        </TabsList>

        {/* ═══ AI REVIEW TAB ═══ */}
        <TabsContent value="ai-review" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>AI Document Review</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Upload or paste a legal document for AI-powered review. The system will analyze structure, arguments, citations, and suggest improvements.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Document Text</Label>
                  <Textarea rows={8} placeholder="Paste your document text here for AI review..." />
                </div>
                <Button><Sparkles className="h-4 w-4 mr-2" /> Analyze Document</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ BRIEF ANALYSIS TAB (Clearbrief) ═══ */}
        <TabsContent value="brief-analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Brief Analysis</CardTitle>
                <Badge variant="secondary">Clearbrief</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matter</Label>
                  <Select value={briefMatterId || "__none__"} onValueChange={(v) => setBriefMatterId(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brief Type</Label>
                  <Select value={briefType} onValueChange={setBriefType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BRIEF_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Brief Text</Label>
                <Textarea rows={8} placeholder="Paste your brief or motion text here..." value={briefText} onChange={(e) => setBriefText(e.target.value)} />
              </div>
              <Button
                disabled={!briefText || !briefMatterId || analyzeBrief.isLoading}
                onClick={() => analyzeBrief.mutate({ text: briefText, briefType, matterId: briefMatterId })}
              >
                <Shield className="h-4 w-4 mr-2" /> {analyzeBrief.isLoading ? "Analyzing..." : "Analyze Brief"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {briefResults && (
            <>
              {briefResults.citations && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Citation Report</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Citation</TableHead><TableHead>Status</TableHead><TableHead>Treatment</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(Array.isArray(briefResults.citations) ? briefResults.citations : []).map((c: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{c.citation || c.name}</TableCell>
                            <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || "bg-gray-100"}`}>{c.status}</span></TableCell>
                            <TableCell className="text-sm">{c.treatment || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {briefResults.facts && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Fact-Check Results</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(Array.isArray(briefResults.facts) ? briefResults.facts : []).map((f: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded border">
                          {f.status === "supported" ? <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" /> :
                           f.status === "unsupported" ? <XCircle className="h-4 w-4 text-red-500 mt-0.5" /> :
                           <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />}
                          <div>
                            <p className="text-sm">{f.claim}</p>
                            {f.supportingDoc && <p className="text-xs text-slate-500">Source: {f.supportingDoc} {f.pageRef ? `(p. ${f.pageRef})` : ""}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ CONTRACT PROOFING TAB (Definely) ═══ */}
        <TabsContent value="contract-proofing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Contract Proofing</CardTitle>
                <Badge variant="secondary">Definely</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Matter</Label>
                <Select value={contractMatterId || "__none__"} onValueChange={(v) => setContractMatterId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Document Text</Label>
                <Textarea rows={8} placeholder="Paste your contract or agreement text here..." value={contractText} onChange={(e) => setContractText(e.target.value)} />
              </div>
              <Button
                disabled={!contractText || !contractMatterId || analyzeContract.isLoading}
                onClick={() => analyzeContract.mutate({ text: contractText, matterId: contractMatterId })}
              >
                <FileCheck className="h-4 w-4 mr-2" /> {analyzeContract.isLoading ? "Analyzing..." : "Analyze Document"}
              </Button>
            </CardContent>
          </Card>

          {contractResults && (
            <>
              {contractResults.terms && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Defined Terms</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Term</TableHead><TableHead>Definition</TableHead><TableHead>Status</TableHead><TableHead>Usage</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(Array.isArray(contractResults.terms) ? contractResults.terms : []).map((t: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{t.term}</TableCell>
                            <TableCell className="text-sm max-w-[300px] truncate">{t.definition || "—"}</TableCell>
                            <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || "bg-gray-100"}`}>{t.status}</span></TableCell>
                            <TableCell>{t.usageCount || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {contractResults.readability && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Readability Score</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold">{contractResults.readability.overallScore || "—"}</p>
                        <p className="text-xs text-slate-500">Overall Score</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold">{contractResults.readability.avgSentenceLength || "—"}</p>
                        <p className="text-xs text-slate-500">Avg Sentence Length</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold">{contractResults.readability.complexTermsCount || "—"}</p>
                        <p className="text-xs text-slate-500">Complex Terms</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ MEDICAL RECORDS TAB (Medilenz) ═══ */}
        <TabsContent value="medical-records" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Medical Record Summarization</CardTitle>
                <Badge variant="secondary">Medilenz</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matter *</Label>
                  <Select value={mrMatterId || "__none__"} onValueChange={(v) => setMrMatterId(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Record Type</Label>
                  <Select value={mrType} onValueChange={setMrType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["OFFICE_VISIT", "HOSPITAL", "SURGERY", "IMAGING", "LAB", "PHARMACY", "MENTAL_HEALTH", "DENTAL", "PHYSICAL_THERAPY", "CHIROPRACTIC", "IME", "OTHER"].map((t) => (
                        <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Patient Name *</Label><Input value={mrPatient} onChange={(e) => setMrPatient(e.target.value)} /></div>
                <div className="space-y-2"><Label>Medical Provider *</Label><Input value={mrProvider} onChange={(e) => setMrProvider(e.target.value)} /></div>
              </div>
              <Button
                disabled={!mrMatterId || !mrPatient || !mrProvider || submitMedRecords.isLoading}
                onClick={() => submitMedRecords.mutate({ matterId: mrMatterId, patientName: mrPatient, recordType: mrType, provider: mrProvider })}
              >
                <Stethoscope className="h-4 w-4 mr-2" /> {submitMedRecords.isLoading ? "Submitting..." : "Submit Records"}
              </Button>
            </CardContent>
          </Card>

          {/* Records List */}
          {mrMatterId && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Submitted Records</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Patient</TableHead><TableHead>Provider</TableHead><TableHead>Type</TableHead>
                    <TableHead>Status</TableHead><TableHead>Pages</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(medRecords || []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.patientName}</TableCell>
                        <TableCell>{r.provider}</TableCell>
                        <TableCell className="text-xs">{fmt(r.recordType)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>
                            {fmt(r.status)}
                          </span>
                        </TableCell>
                        <TableCell>{r.pageCount || "—"}</TableCell>
                        <TableCell>
                          {r.status === "PROCESSING" || r.status === "SUMMARIZED" ? (
                            <Button variant="ghost" size="sm" onClick={() => getMedSummary.mutate({ recordId: r.id })} disabled={getMedSummary.isLoading}>
                              Get Summary
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!medRecords?.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-4">No records submitted for this matter</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Summary Display (if a record has been summarized) */}
          {medRecords?.some((r: any) => r.aiSummary) && (
            <Card>
              <CardHeader><CardTitle className="text-sm">AI Medical Summary</CardTitle></CardHeader>
              <CardContent>
                {medRecords?.filter((r: any) => r.aiSummary).map((r: any) => (
                  <div key={r.id} className="space-y-3">
                    <p className="font-medium">{r.patientName} — {r.provider}</p>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: r.aiSummary.replace(/\n/g, "<br/>") }} />
                    {r.keyFindings && (
                      <div>
                        <h4 className="text-sm font-medium mt-3">Key Findings</h4>
                        {JSON.parse(r.keyFindings).map((f: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm py-1">
                            <span className={`w-2 h-2 rounded-full ${f.severity === "critical" ? "bg-red-500" : f.severity === "abnormal" ? "bg-amber-500" : "bg-green-500"}`} />
                            {f.finding}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
