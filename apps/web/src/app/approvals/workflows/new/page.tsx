"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";

const TRIGGERS = [
  { value: "ALL_INVOICES", label: "All Invoices", desc: "Every invoice goes through this workflow" },
  { value: "AMOUNT_THRESHOLD", label: "Amount Threshold", desc: "Invoices above/below a certain amount" },
  { value: "PRACTICE_AREA", label: "Practice Area", desc: "Specific practice areas only" },
  { value: "CLIENT", label: "Client", desc: "Specific clients only" },
  { value: "MATTER_TYPE", label: "Matter Type", desc: "Specific matter types" },
];

export default function NewWorkflowPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("ALL_INVOICES");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [practiceAreas, setPracticeAreas] = useState("");
  const [steps, setSteps] = useState([{ stepNumber: 1, approverName: "", approverEmail: "", required: true }]);
  const [requireAll, setRequireAll] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveDays, setAutoApproveDays] = useState("5");
  const [escalation, setEscalation] = useState(false);
  const [escalationDays, setEscalationDays] = useState("3");
  const [escalationEmail, setEscalationEmail] = useState("");
  const [isActive, setIsActive] = useState(true);

  const createMut = trpc.approvals.createWorkflow.useMutation({
    onSuccess: () => { toast({ title: "Workflow created" }); router.push("/approvals/workflows"); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addStep = () => setSteps([...steps, { stepNumber: steps.length + 1, approverName: "", approverEmail: "", required: true }]);
  const removeStep = (idx: number) => {
    const newSteps = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    setSteps(newSteps);
  };

  const buildCondition = () => {
    if (triggerType === "AMOUNT_THRESHOLD") return JSON.stringify({ minAmount: minAmount ? Number(minAmount) : undefined, maxAmount: maxAmount ? Number(maxAmount) : undefined });
    if (triggerType === "PRACTICE_AREA") return JSON.stringify({ practiceAreas: practiceAreas.split(",").map((s) => s.trim()).filter(Boolean) });
    return undefined;
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/approvals/workflows"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Approval Workflow</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="High Value Invoice Review" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trigger</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TRIGGERS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTriggerType(t.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${triggerType === t.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </button>
              ))}
            </div>

            {triggerType === "AMOUNT_THRESHOLD" && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2"><Label>Min Amount ($)</Label><Input type="number" step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
                <div className="space-y-2"><Label>Max Amount ($)</Label><Input type="number" step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></div>
              </div>
            )}
            {triggerType === "PRACTICE_AREA" && (
              <div className="mt-4 space-y-2"><Label>Practice Areas (comma-separated)</Label><Input value={practiceAreas} onChange={(e) => setPracticeAreas(e.target.value)} placeholder="Personal Injury, Family Law" /></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Approval Steps</CardTitle>
              <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-4 w-4 mr-1" /> Add Step</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{step.stepNumber}</div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input placeholder="Approver name" value={step.approverName} onChange={(e) => {
                    const newSteps = [...steps];
                    newSteps[i] = { ...newSteps[i], approverName: e.target.value };
                    setSteps(newSteps);
                  }} />
                  <Input type="email" placeholder="Email" value={step.approverEmail} onChange={(e) => {
                    const newSteps = [...steps];
                    newSteps[i] = { ...newSteps[i], approverEmail: e.target.value };
                    setSteps(newSteps);
                  }} />
                </div>
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input type="checkbox" checked={step.required} onChange={(e) => {
                    const newSteps = [...steps];
                    newSteps[i] = { ...newSteps[i], required: e.target.checked };
                    setSteps(newSteps);
                  }} className="rounded" /> Required
                </label>
                {steps.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeStep(i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
              <span>Preview: Invoice →</span>
              {steps.map((s, i) => (
                <span key={i}>{i > 0 ? " → " : ""}{s.approverName || `Step ${s.stepNumber}`}</span>
              ))}
              <span>→ Approved</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="Require ALL approvers (vs any one)" checked={requireAll} onChange={setRequireAll} />
            <Toggle label="Auto-approve if no response" checked={autoApprove} onChange={setAutoApprove} />
            {autoApprove && (
              <div className="pl-4 space-y-2"><Label>Auto-approve after (days)</Label><Input type="number" value={autoApproveDays} onChange={(e) => setAutoApproveDays(e.target.value)} /></div>
            )}
            <Toggle label="Enable escalation" checked={escalation} onChange={setEscalation} />
            {escalation && (
              <div className="pl-4 space-y-3">
                <div className="space-y-2"><Label>Escalate after (days)</Label><Input type="number" value={escalationDays} onChange={(e) => setEscalationDays(e.target.value)} /></div>
                <div className="space-y-2"><Label>Escalation Email</Label><Input type="email" value={escalationEmail} onChange={(e) => setEscalationEmail(e.target.value)} /></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" disabled={!name || !steps[0]?.approverName || createMut.isLoading} onClick={() => {
          createMut.mutate({
            name,
            description: description || undefined,
            triggerType: triggerType as any,
            triggerCondition: buildCondition(),
            steps: JSON.stringify(steps.map((s) => ({ stepNumber: s.stepNumber, approverType: "specific_user", approverName: s.approverName, required: s.required }))),
            isActive,
            requireAllApprovers: requireAll,
            autoApproveEnabled: autoApprove,
            autoApproveAfterDays: autoApprove ? Number(autoApproveDays) : undefined,
            escalationEnabled: escalation,
            escalationAfterDays: escalation ? Number(escalationDays) : undefined,
            escalationEmail: escalation ? escalationEmail : undefined,
          });
        }}>
          {createMut.isLoading ? "Creating..." : "Save Workflow"}
        </Button>
      </div>
    </div>
  );
}
