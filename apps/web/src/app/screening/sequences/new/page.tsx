"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Zap,
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

interface StepData {
  key: string;
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  actionType: string;
  emailSubject: string;
  emailContent: string;
  taskTitle: string;
  taskDescription: string;
  newStatus: string;
  notificationMessage: string;
}

function newStep(stepNumber: number): StepData {
  return {
    key: Math.random().toString(36).slice(2),
    stepNumber,
    delayDays: stepNumber === 1 ? 0 : 1,
    delayHours: 0,
    actionType: "EMAIL",
    emailSubject: "",
    emailContent: "",
    taskTitle: "",
    taskDescription: "",
    newStatus: "",
    notificationMessage: "",
  };
}

export default function NewSequencePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("NEW_LEAD");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [steps, setSteps] = useState<StepData[]>([newStep(1)]);

  const createSequence = trpc.screening.createSequence.useMutation({
    onSuccess: (s) => { toast({ title: "Sequence created" }); router.push(`/screening/sequences/${s.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const aiGenerate = trpc.screening.aiGenerateEmail.useMutation();

  const addStep = () => {
    setSteps([...steps, newStep(steps.length + 1)]);
  };

  const removeStep = (key: string) => {
    const filtered = steps.filter((s) => s.key !== key);
    setSteps(filtered.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const updateStep = (key: string, field: string, value: any) => {
    setSteps(steps.map((s) => s.key === key ? { ...s, [field]: value } : s));
  };

  const handleAiGenerate = async (step: StepData) => {
    try {
      const result = await aiGenerate.mutateAsync({
        leadName: "{NAME}",
        leadEmail: "lead@example.com",
        practiceArea: undefined,
        stepPurpose: `Step ${step.stepNumber} of "${name}" sequence (trigger: ${triggerEvent})`,
      });
      updateStep(step.key, "emailSubject", result.subject);
      updateStep(step.key, "emailContent", result.body);
      toast({ title: "Email content generated" });
    } catch {
      toast({ title: "Failed to generate", variant: "destructive" });
    }
  };

  const handleSave = (activate: boolean = false) => {
    if (!name.trim()) return;
    createSequence.mutate({
      name,
      description: description || undefined,
      triggerEvent: triggerEvent as any,
      triggerCondition: triggerCondition || undefined,
      steps: steps.map((s) => ({
        stepNumber: s.stepNumber,
        delayDays: s.delayDays,
        delayHours: s.delayHours,
        actionType: s.actionType as any,
        emailSubject: s.actionType === "EMAIL" ? s.emailSubject || undefined : undefined,
        emailContent: s.actionType === "EMAIL" ? s.emailContent || undefined : undefined,
        taskTitle: s.actionType === "TASK" ? s.taskTitle || undefined : undefined,
        taskDescription: s.actionType === "TASK" ? s.taskDescription || undefined : undefined,
        newStatus: s.actionType === "STATUS_CHANGE" ? s.newStatus || undefined : undefined,
        notificationMessage: s.actionType === "NOTIFICATION" ? s.notificationMessage || undefined : undefined,
      })),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/screening"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">New Follow-Up Sequence</h1>
      </div>

      {/* Basics */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Sequence Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Lead Welcome" />
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
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description of this sequence" />
        </div>

        {/* Trigger Conditions */}
        {(triggerEvent === "LEAD_QUALIFIED" || triggerEvent === "NEW_LEAD") && (
          <div className="space-y-2">
            <Label>Trigger Condition (JSON, optional)</Label>
            <Input
              value={triggerCondition}
              onChange={(e) => setTriggerCondition(e.target.value)}
              placeholder={triggerEvent === "LEAD_QUALIFIED" ? '{"leadGrade":"A"}' : '{"source":"INTAKE_FORM"}'}
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>

      {/* Steps Builder */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Steps</h2>
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" /> Add Step
          </Button>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const ActionIcon = ACTION_TYPES.find((a) => a.value === step.actionType)?.icon || Bell;
            return (
              <div key={step.key} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {step.stepNumber}
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <Input
                      type="number"
                      min={0}
                      value={step.delayDays}
                      onChange={(e) => updateStep(step.key, "delayDays", parseInt(e.target.value) || 0)}
                      className="w-16 h-8 text-xs"
                    />
                    <span className="text-xs text-gray-500">days</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={step.delayHours}
                      onChange={(e) => updateStep(step.key, "delayHours", parseInt(e.target.value) || 0)}
                      className="w-16 h-8 text-xs"
                    />
                    <span className="text-xs text-gray-500">hours</span>
                  </div>

                  <Select value={step.actionType} onValueChange={(v) => updateStep(step.key, "actionType", v)}>
                    <SelectTrigger className="w-44 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          <span className="flex items-center gap-2"><a.icon className="h-3 w-3" /> {a.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  {steps.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeStep(step.key)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>

                {/* Action-specific fields */}
                {step.actionType === "EMAIL" && (
                  <div className="pl-11 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={step.emailSubject}
                        onChange={(e) => updateStep(step.key, "emailSubject", e.target.value)}
                        placeholder="Email subject (use {NAME}, {FIRM_NAME}, {PRACTICE_AREA})"
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAiGenerate(step)}
                        disabled={aiGenerate.isPending}
                      >
                        <Sparkles className="h-3 w-3 mr-1" /> AI
                      </Button>
                    </div>
                    <Textarea
                      value={step.emailContent}
                      onChange={(e) => updateStep(step.key, "emailContent", e.target.value)}
                      rows={4}
                      placeholder="Email content (HTML with {NAME}, {FIRM_NAME}, {PRACTICE_AREA} placeholders)"
                      className="text-sm"
                    />
                    <div className="flex gap-1">
                      {["{NAME}", "{FIRM_NAME}", "{PRACTICE_AREA}"].map((p) => (
                        <button
                          key={p}
                          onClick={() => updateStep(step.key, "emailContent", step.emailContent + p)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step.actionType === "TASK" && (
                  <div className="pl-11 space-y-2">
                    <Input
                      value={step.taskTitle}
                      onChange={(e) => updateStep(step.key, "taskTitle", e.target.value)}
                      placeholder="Task title"
                      className="text-sm"
                    />
                    <Textarea
                      value={step.taskDescription}
                      onChange={(e) => updateStep(step.key, "taskDescription", e.target.value)}
                      rows={2}
                      placeholder="Task description"
                      className="text-sm"
                    />
                  </div>
                )}

                {step.actionType === "STATUS_CHANGE" && (
                  <div className="pl-11">
                    <Select value={step.newStatus} onValueChange={(v) => updateStep(step.key, "newStatus", v)}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="New status..." /></SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {step.actionType === "NOTIFICATION" && (
                  <div className="pl-11">
                    <Input
                      value={step.notificationMessage}
                      onChange={(e) => updateStep(step.key, "notificationMessage", e.target.value)}
                      placeholder="Notification message"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Buttons */}
      <div className="flex gap-2">
        <Button onClick={() => handleSave(false)} disabled={!name.trim() || createSequence.isPending} className="bg-rose-600 hover:bg-rose-700">
          <Save className="h-4 w-4 mr-2" /> {createSequence.isPending ? "Saving..." : "Save Sequence"}
        </Button>
      </div>
    </div>
  );
}
