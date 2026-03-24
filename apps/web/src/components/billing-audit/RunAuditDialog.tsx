"use client";

import { useState } from "react";
import { X, Play, Sparkles, Briefcase, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

interface RunAuditDialogProps {
  onClose: () => void;
  onComplete: (auditId: string) => void;
}

export function RunAuditDialog({ onClose, onComplete }: RunAuditDialogProps) {
  const [auditType, setAuditType] = useState<"manual" | "pre_invoice" | "matter_close" | "periodic">("manual");
  const [matterId, setMatterId] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = trpc.billingAudit.runAudit.useMutation({
    onSuccess: (data) => {
      onComplete(data.id);
    },
    onError: () => {
      setIsRunning(false);
    },
  });

  const handleRun = () => {
    setIsRunning(true);
    runAudit.mutate({
      auditType,
      matterId: matterId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border w-full max-w-md p-6 z-10">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Run Billing Audit</h2>
            <p className="text-xs text-gray-500">AI will review entries for common billing issues</p>
          </div>
        </div>

        {/* Audit Type Selection */}
        <div className="space-y-3 mb-5">
          <Label className="text-sm font-medium text-gray-700">Audit Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "manual", label: "Manual Review", icon: Play, desc: "Audit all recent entries" },
              { value: "pre_invoice", label: "Pre-Invoice", icon: Briefcase, desc: "Before sending to client" },
              { value: "matter_close", label: "Matter Close", icon: Briefcase, desc: "Final billing review" },
              { value: "periodic", label: "Periodic", icon: Calendar, desc: "Routine compliance check" },
            ] as const).map((type) => (
              <button
                key={type.value}
                onClick={() => setAuditType(type.value)}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                  auditType === type.value
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <type.icon className={`h-4 w-4 mb-1 ${auditType === type.value ? "text-blue-600" : "text-gray-400"}`} />
                <span className={`text-xs font-medium ${auditType === type.value ? "text-blue-700" : "text-gray-700"}`}>
                  {type.label}
                </span>
                <span className="text-[10px] text-gray-400">{type.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Matter Filter */}
        <div className="space-y-2 mb-6">
          <Label className="text-sm font-medium text-gray-700">Matter ID (optional)</Label>
          <Input
            placeholder="Leave empty to audit all recent entries..."
            value={matterId}
            onChange={(e) => setMatterId(e.target.value)}
            className="text-sm"
          />
          <p className="text-[10px] text-gray-400">Optionally scope the audit to a specific matter</p>
        </div>

        {/* Run Button */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isRunning}>
            Cancel
          </Button>
          <Button onClick={handleRun} disabled={isRunning} className="gap-2">
            {isRunning ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Auditing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Audit
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
