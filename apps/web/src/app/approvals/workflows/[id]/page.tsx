"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const TRIGGERS = [
  { value: "ALL_INVOICES", label: "All Invoices" },
  { value: "AMOUNT_THRESHOLD", label: "Amount Threshold" },
  { value: "PRACTICE_AREA", label: "Practice Area" },
  { value: "CLIENT", label: "Client" },
  { value: "MATTER_TYPE", label: "Matter Type" },
];

export default function EditWorkflowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const { data: wf } = trpc.approvals.getWorkflow.useQuery({ id });
  const updateMut = trpc.approvals.updateWorkflow.useMutation({
    onSuccess: () => { toast({ title: "Workflow updated" }); router.push("/approvals/workflows"); },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("ALL_INVOICES");
  const [minAmount, setMinAmount] = useState("");
  const [steps, setSteps] = useState<any[]>([]);
  const [requireAll, setRequireAll] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveDays, setAutoApproveDays] = useState("5");
  const [escalation, setEscalation] = useState(false);
  const [escalationDays, setEscalationDays] = useState("3");
  const [escalationEmail, setEscalationEmail] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (wf) {
      setName(wf.name);
      setDescription(wf.description || "");
      setTriggerType(wf.triggerType);
      const cond = wf.triggerCondition ? JSON.parse(wf.triggerCondition) : {};
      setMinAmount(cond.minAmount?.toString() || "");
      setSteps(JSON.parse(wf.steps));
      setRequireAll(wf.requireAllApprovers);
      setAutoApprove(wf.autoApproveEnabled);
      setAutoApproveDays(wf.autoApproveAfterDays?.toString() || "5");
      setEscalation(wf.escalationEnabled);
      setEscalationDays(wf.escalationAfterDays?.toString() || "3");
      setEscalationEmail(wf.escalationEmail || "");
      setIsActive(wf.isActive);
    }
  }, [wf]);

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  if (!wf) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/approvals/workflows"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Edit Workflow</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trigger: {TRIGGERS.find((t) => t.value === triggerType)?.label}</CardTitle></CardHeader>
          <CardContent>
            {triggerType === "AMOUNT_THRESHOLD" && (
              <div className="space-y-2"><Label>Min Amount ($)</Label><Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Steps</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { stepNumber: steps.length + 1, approverName: "", required: true }])}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</div>
                <Input className="flex-1" value={step.approverName} onChange={(e) => {
                  const ns = [...steps]; ns[i] = { ...ns[i], approverName: e.target.value }; setSteps(ns);
                }} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={step.required} onChange={(e) => {
                  const ns = [...steps]; ns[i] = { ...ns[i], required: e.target.checked }; setSteps(ns);
                }} className="rounded" /> Req</label>
                {steps.length > 1 && <Button variant="ghost" size="sm" onClick={() => setSteps(steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, stepNumber: j + 1 })))}><Trash2 className="h-3 w-3 text-red-500" /></Button>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="Require ALL approvers" checked={requireAll} onChange={setRequireAll} />
            <Toggle label="Auto-approve" checked={autoApprove} onChange={setAutoApprove} />
            {autoApprove && <div className="pl-4 space-y-2"><Label>Days</Label><Input type="number" value={autoApproveDays} onChange={(e) => setAutoApproveDays(e.target.value)} /></div>}
            <Toggle label="Escalation" checked={escalation} onChange={setEscalation} />
            {escalation && (
              <div className="pl-4 space-y-2">
                <div className="space-y-2"><Label>Days</Label><Input type="number" value={escalationDays} onChange={(e) => setEscalationDays(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={escalationEmail} onChange={(e) => setEscalationEmail(e.target.value)} /></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" disabled={!name || updateMut.isLoading} onClick={() => {
          updateMut.mutate({
            id,
            name,
            description: description || null,
            triggerType: triggerType as any,
            triggerCondition: triggerType === "AMOUNT_THRESHOLD" ? JSON.stringify({ minAmount: minAmount ? Number(minAmount) : undefined }) : null,
            steps: JSON.stringify(steps.map((s: any, i: number) => ({ ...s, stepNumber: i + 1 }))),
            isActive,
            requireAllApprovers: requireAll,
            autoApproveEnabled: autoApprove,
            autoApproveAfterDays: autoApprove ? Number(autoApproveDays) : null,
            escalationEnabled: escalation,
            escalationAfterDays: escalation ? Number(escalationDays) : null,
            escalationEmail: escalation ? escalationEmail : null,
          });
        }}>
          {updateMut.isLoading ? "Saving..." : "Save Workflow"}
        </Button>
      </div>
    </div>
  );
}
