"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const steps = ["Matter & Client", "Case Type", "Beneficiary", "Review & Create"];
const caseTypes = ["H-1B", "L-1", "O-1", "EB-1", "EB-2", "EB-3", "PERM", "I-485", "I-130", "N-400"];

export default function NewCasePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ matterId: "", clientId: "", caseType: "", beneficiaryName: "", beneficiaryDOB: "", beneficiaryNationality: "" });

  const { data: matters } = trpc.matters.list.useQuery({});
  const { data: clients } = trpc.clients.list.useQuery({});
  const createCase = trpc.immigration["cases.create"].useMutation({
    onSuccess: (data) => router.push(`/immigration/cases/${data.id}`),
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-bold">New Immigration Case</h1>

      <div className="flex gap-2">
        {steps.map((s, i) => (
          <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"}>{s}</Badge>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{steps[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div><Label>Matter</Label>
                <Select value={form.matterId} onValueChange={(v) => set("matterId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
                  <SelectContent>{((matters as any)?.matters || matters || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Client</Label>
                <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{((clients as any)?.clients || clients || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {caseTypes.map((t) => (
                <Button key={t} variant={form.caseType === t ? "default" : "outline"} className="h-16" onClick={() => set("caseType", t)}>
                  {t}
                </Button>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <div><Label>Full Name</Label><Input value={form.beneficiaryName} onChange={(e) => set("beneficiaryName", e.target.value)} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.beneficiaryDOB} onChange={(e) => set("beneficiaryDOB", e.target.value)} /></div>
              <div><Label>Nationality</Label><Input value={form.beneficiaryNationality} onChange={(e) => set("beneficiaryNationality", e.target.value)} /></div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Case Type</span><span>{form.caseType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Beneficiary</span><span>{form.beneficiaryName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">DOB</span><span>{form.beneficiaryDOB}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nationality</span><span>{form.beneficiaryNationality}</span></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
        ) : (
          <Button onClick={() => createCase.mutate(form)} disabled={createCase.isPending}>
            <Check className="mr-2 h-4 w-4" /> Create Case
          </Button>
        )}
      </div>
    </div>
  );
}
