"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Save,
  Plus,
  Trash2,
  Mail,
  ListChecks,
  ArrowUpDown,
  Bell,
  Sparkles,
  Clock,
} from "lucide-react";

const TRIGGER_OPTIONS = [
  { value: "NEW_LEAD", label: "New Lead" },
  { value: "LEAD_QUALIFIED", label: "Lead Qualified" },
  { value: "CONSULTATION_COMPLETED", label: "Consultation Completed" },
  { value: "NO_RESPONSE", label: "No Response" },
  { value: "INTAKE_SUBMITTED", label: "Intake Submitted" },
  { value: "CUSTOM", label: "Custom" },
];

const ACTION_TYPES = [
  { value: "EMAIL", label: "Send Email", icon: Mail },
  { value: "TASK", label: "Create Task", icon: ListChecks },
  { value: "STATUS_CHANGE", label: "Change Status", icon: ArrowUpDown },
  { value: "NOTIFICATION", label: "Notification", icon: Bell },
];

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFYING", "QUALIFIED", "PROPOSAL_SENT", "CONVERTED", "DECLINED", "ARCHIVED"];

export default function EditSequencePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const seqId = params.id as string;
  const utils = trpc.useUtils();

  const { data: sequence, isLoading } = trpc.screening.getSequence.useQuery({ id: seqId });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("NEW_LEAD");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (sequence) {
      setName(sequence.name);
      setDescription(sequence.description || "");
      setTriggerEvent(sequence.triggerEvent);
      setTriggerCondition(sequence.triggerCondition || "");
      setIsActive(sequence.isActive);
    }
  }, [sequence]);

  const updateSequence = trpc.screening.updateSequence.useMutation({
    onSuccess: () => { toast({ title: "Sequence updated" }); utils.screening.getSequence.invalidate({ id: seqId }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSequence = trpc.screening.deleteSequence.useMutation({
    onSuccess: () => { toast({ title: "Sequence deleted" }); router.push("/screening"); },
  });

  const addStep = trpc.screening.addStep.useMutation({
    onSuccess: () => { toast({ title: "Step added" }); utils.screening.getSequence.invalidate({ id: seqId }); },
  });

  const updateStep = trpc.screening.updateStep.useMutation({
    onSuccess: () => utils.screening.getSequence.invalidate({ id: seqId }),
  });

  const removeStep = trpc.screening.removeStep.useMutation({
    onSuccess: () => { toast({ title: "Step removed" }); utils.screening.getSequence.invalidate({ id: seqId }); },
  });

  const aiGenerate = trpc.screening.aiGenerateEmail.useMutation();

  const handleSave = () => {
    updateSequence.mutate({
      id: seqId,
      name,
      description: description || undefined,
      triggerEvent: triggerEvent as any,
      triggerCondition: triggerCondition || undefined,
      isActive,
    });
  };

  const handleAddStep = () => {
    const nextNum = (sequence?.steps?.length || 0) + 1;
    addStep.mutate({
      sequenceId: seqId,
      stepNumber: nextNum,
      delayDays: nextNum === 1 ? 0 : 1,
      delayHours: 0,
      actionType: "EMAIL",
    });
  };

  const handleAiGenerate = async (stepId: string, stepNumber: number) => {
    try {
      const result = await aiGenerate.mutateAsync({
        leadName: "{NAME}",
        leadEmail: "lead@example.com",
        stepPurpose: `Step ${stepNumber} of "${name}" sequence (trigger: ${triggerEvent})`,
      });
      updateStep.mutate({ id: stepId, emailSubject: result.subject, emailContent: result.body });
      toast({ title: "Email content generated" });
    } catch {
      toast({ title: "Failed to generate", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!sequence) return <div className="py-20 text-center text-gray-500">Sequence not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/screening"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold">Edit Sequence</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { updateSequence.mutate({ id: seqId, isActive: !isActive }); setIsActive(!isActive); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
          >
            {isActive ? "Active" : "Inactive"}
          </button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this sequence?")) deleteSequence.mutate({ id: seqId }); }}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Basics */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trigger Event</Label>
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        {triggerCondition !== undefined && (
          <div className="space-y-2">
            <Label>Trigger Condition (JSON)</Label>
            <Input value={triggerCondition} onChange={(e) => setTriggerCondition(e.target.value)} className="font-mono text-xs" />
          </div>
        )}
        <Button onClick={handleSave} disabled={updateSequence.isPending} className="bg-rose-600 hover:bg-rose-700">
          <Save className="h-4 w-4 mr-2" /> Save Changes
        </Button>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Steps ({sequence.steps.length})</h2>
          <Button variant="outline" size="sm" onClick={handleAddStep}>
            <Plus className="h-4 w-4 mr-1" /> Add Step
          </Button>
        </div>

        <div className="space-y-3">
          {sequence.steps.map((step: any) => (
            <div key={step.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {step.stepNumber}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {step.delayDays === 0 && step.delayHours === 0 ? "Immediately" : `After ${step.delayDays}d ${step.delayHours}h`}
                </div>

                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100">
                  {ACTION_TYPES.find((a) => a.value === step.actionType)?.label || step.actionType}
                </span>

                <div className="flex-1" />

                <Button variant="ghost" size="sm" onClick={() => removeStep.mutate({ id: step.id })}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>

              {/* Inline edit fields */}
              <div className="pl-11 space-y-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs w-12">Days:</Label>
                    <Input type="number" min={0} value={step.delayDays} onChange={(e) => updateStep.mutate({ id: step.id, delayDays: parseInt(e.target.value) || 0 })} className="h-7 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs w-14">Hours:</Label>
                    <Input type="number" min={0} max={23} value={step.delayHours} onChange={(e) => updateStep.mutate({ id: step.id, delayHours: parseInt(e.target.value) || 0 })} className="h-7 text-xs" />
                  </div>
                  <Select value={step.actionType} onValueChange={(v) => updateStep.mutate({ id: step.id, actionType: v as any })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {step.actionType === "EMAIL" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={step.emailSubject || ""}
                        onChange={(e) => updateStep.mutate({ id: step.id, emailSubject: e.target.value })}
                        placeholder="Subject"
                        className="text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={() => handleAiGenerate(step.id, step.stepNumber)} disabled={aiGenerate.isPending}>
                        <Sparkles className="h-3 w-3" />
                      </Button>
                    </div>
                    <Textarea
                      value={step.emailContent || ""}
                      onChange={(e) => updateStep.mutate({ id: step.id, emailContent: e.target.value })}
                      rows={3}
                      placeholder="Email content (HTML)"
                      className="text-xs"
                    />
                  </div>
                )}

                {step.actionType === "TASK" && (
                  <div className="space-y-2">
                    <Input value={step.taskTitle || ""} onChange={(e) => updateStep.mutate({ id: step.id, taskTitle: e.target.value })} placeholder="Task title" className="text-xs" />
                    <Textarea value={step.taskDescription || ""} onChange={(e) => updateStep.mutate({ id: step.id, taskDescription: e.target.value })} rows={2} placeholder="Description" className="text-xs" />
                  </div>
                )}

                {step.actionType === "STATUS_CHANGE" && (
                  <Select value={step.newStatus || ""} onValueChange={(v) => updateStep.mutate({ id: step.id, newStatus: v })}>
                    <SelectTrigger className="w-48 h-7 text-xs"><SelectValue placeholder="New status..." /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                {step.actionType === "NOTIFICATION" && (
                  <Input value={step.notificationMessage || ""} onChange={(e) => updateStep.mutate({ id: step.id, notificationMessage: e.target.value })} placeholder="Message" className="text-xs" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
