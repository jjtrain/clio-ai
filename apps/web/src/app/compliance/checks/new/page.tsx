"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, CheckCircle, Copy, ArrowLeft, ArrowRight } from "lucide-react";

const CHECK_TYPES = ["KYC", "AML", "SANCTIONS", "PEP", "ADVERSE_MEDIA", "DOCUMENT_VERIFICATION", "SOURCE_OF_FUNDS", "SOURCE_OF_WEALTH", "FULL_CDD"];

export default function NewCheckPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    clientId: "", matterId: "", subjectType: "INDIVIDUAL",
    name: "", email: "", phone: "", dob: "", nationality: "", address: "",
    companyName: "", companyRegNumber: "", companyJurisdiction: "",
    policyId: "", checkTypes: ["KYC", "SANCTIONS", "PEP", "DOCUMENT_VERIFICATION"],
  });

  const { data: clients } = trpc.clients.list.useQuery({});
  const { data: matters } = trpc.matters.list.useQuery({});
  const { data: policies } = trpc.compliance["policies.list"].useQuery();

  const initiateMut = trpc.compliance["checks.initiate"].useMutation({
    onSuccess: (data) => { setResult(data); setStep(4); toast({ title: "Check initiated!" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const selectedClient = (clients as any)?.find((c: any) => c.id === form.clientId);

  // Auto-fill from client
  const handleClientSelect = (id: string) => {
    const client = (clients as any)?.find((c: any) => c.id === id);
    if (client) {
      setForm({ ...form, clientId: id, name: client.name, email: client.email || "", phone: client.phone || "", address: client.address || "" });
    }
  };

  const toggleCheckType = (ct: string) => {
    setForm({ ...form, checkTypes: form.checkTypes.includes(ct) ? form.checkTypes.filter(t => t !== ct) : [...form.checkTypes, ct] });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">Initiate Compliance Check</h1><p className="text-sm text-slate-500">Step {step} of 3</p></div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-2 rounded-full ${step >= s ? "bg-blue-500" : "bg-gray-200"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Subject Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Client</Label>
              <Select value={form.clientId} onValueChange={handleClientSelect}>
                <SelectTrigger><SelectValue placeholder="Choose a client..." /></SelectTrigger>
                <SelectContent>{((clients as any) || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Link to Matter (optional)</Label>
              <Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}>
                <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
                <SelectContent><SelectItem value="">None</SelectItem>{((matters as any) || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject Type</Label>
              <Select value={form.subjectType} onValueChange={(v) => setForm({ ...form, subjectType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
              <div><Label>Nationality</Label><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            {(form.subjectType === "COMPANY" || form.subjectType === "TRUST") && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div><Label>Company/Trust Name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
                <div><Label>Registration Number</Label><Input value={form.companyRegNumber} onChange={(e) => setForm({ ...form, companyRegNumber: e.target.value })} /></div>
                <div><Label>Jurisdiction</Label><Input value={form.companyJurisdiction} onChange={(e) => setForm({ ...form, companyJurisdiction: e.target.value })} /></div>
              </div>
            )}
            <Button className="w-full" onClick={() => setStep(2)} disabled={!form.clientId || !form.name}>Next: Checks & Policy <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Policy & Check Types</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Compliance Policy</Label>
              <Select value={form.policyId} onValueChange={(v) => setForm({ ...form, policyId: v })}>
                <SelectTrigger><SelectValue placeholder="Auto-detect or select..." /></SelectTrigger>
                <SelectContent><SelectItem value="">Auto-detect</SelectItem>{(policies || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Required Checks</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CHECK_TYPES.map(ct => (
                  <label key={ct} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.checkTypes.includes(ct)} onChange={() => toggleCheckType(ct)} className="rounded" />
                    <span className="text-sm">{ct.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Next: Review <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Review & Submit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <p className="text-sm"><strong>Subject:</strong> {form.name} ({form.subjectType})</p>
              <p className="text-sm"><strong>Email:</strong> {form.email}</p>
              {form.nationality && <p className="text-sm"><strong>Nationality:</strong> {form.nationality}</p>}
              <p className="text-sm"><strong>Client:</strong> {selectedClient?.name}</p>
              <p className="text-sm"><strong>Checks:</strong> {form.checkTypes.join(", ")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button className="flex-1" onClick={() => initiateMut.mutate({ clientId: form.clientId, matterId: form.matterId || undefined, checkType: (form.checkTypes[0] || "KYC") as any, subjectType: form.subjectType as any, subjectName: form.name, subjectEmail: form.email || undefined, subjectPhone: form.phone || undefined, subjectDOB: form.dob || undefined, subjectNationality: form.nationality || undefined, subjectAddress: form.address || undefined, companyName: form.companyName || undefined, companyRegistrationNumber: form.companyRegNumber || undefined, companyJurisdiction: form.companyJurisdiction || undefined })} disabled={initiateMut.isLoading}>
                {initiateMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Submit Check
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && result && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold">Check Initiated</h2>
            <p className="text-gray-500">Status: {result.status}</p>
            {result.clientPortalUrl && (
              <div className="max-w-md mx-auto">
                <Label className="text-xs text-gray-500">Client Portal Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={result.clientPortalUrl} className="text-xs font-mono" />
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(result.clientPortalUrl); toast({ title: "Copied" }); }}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Send this link to the client to complete their verification.</p>
              </div>
            )}
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="outline" onClick={() => router.push("/compliance")}>Back to Dashboard</Button>
              <Button onClick={() => router.push(`/compliance/checks/${result.id}`)}>View Check</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
