"use client";

import { Layers, Plus, CheckCircle, XCircle, Clock, RotateCcw, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; label: string }> = {
  PENDING: { color: "bg-gray-100 text-gray-600", label: "Pending" },
  PREVIEWING: { color: "bg-blue-100 text-blue-700", label: "Previewing" },
  PREVIEW_READY: { color: "bg-blue-100 text-blue-700", label: "Review" },
  RUNNING: { color: "bg-yellow-100 text-yellow-700", label: "Running" },
  COMPLETED: { color: "bg-green-100 text-green-700", label: "Complete" },
  COMPLETED_WITH_ERRORS: { color: "bg-yellow-100 text-yellow-700", label: "Partial" },
  FAILED: { color: "bg-red-100 text-red-700", label: "Failed" },
  CANCELLED: { color: "bg-gray-100 text-gray-400", label: "Cancelled" },
  UNDONE: { color: "bg-purple-100 text-purple-600", label: "Undone" },
};

const typeLabels: Record<string, string> = {
  CLOSE_MATTERS: "Close Matters", ARCHIVE_MATTERS: "Archive", REASSIGN_ATTORNEY: "Reassign Attorney",
  REASSIGN_ALL_STAFF: "Associate Departure", CHANGE_STAGE: "Change Stage", ADD_TAGS: "Add Tags",
  UPDATE_BILLING_TYPE: "Update Billing", SEND_CLIENT_EMAIL: "Send Email", ADD_TASK: "Add Task",
  ADD_NOTE: "Add Note", EXPORT_MATTERS: "Export", GENERATE_DOCUMENT: "Generate Docs",
};

export function BulkOperationsHub() {
  const { data: history, refetch } = trpc.bulkOperations.getHistory.useQuery({});
  const { data: presets } = trpc.bulkOperations.getPresets.useQuery();
  const undoMutation = trpc.bulkOperations.undo.useMutation({ onSuccess: () => refetch() });

  const recentCompleted = history?.filter((h) => h.status === "COMPLETED" && h.completedAt && Date.now() - new Date(h.completedAt).getTime() < 24 * 3600000 && h.isReversible) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-blue-600" />
            Bulk Operations
          </h1>
          <p className="text-sm text-gray-500 mt-1">Select matters and apply batch operations with preview and undo</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Operation</Button>
      </div>

      {/* Undo-able Operations */}
      {recentCompleted.length > 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm font-medium text-yellow-800 mb-2">Operations that can be undone (within 24 hours)</p>
          {recentCompleted.map((op) => (
            <div key={op.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-700">
                {typeLabels[op.operationType] || op.operationType} — {op.totalSucceeded} matters
              </span>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => undoMutation.mutate({ operationId: op.id })}>
                <RotateCcw className="h-3 w-3" /> Undo
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Operation History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Operation History</h2>
        {history && history.length > 0 ? (
          <div className="space-y-2">
            {history.map((op) => {
              const sc = statusConfig[op.status] || statusConfig.PENDING;
              return (
                <Card key={op.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{typeLabels[op.operationType] || op.operationType}</p>
                        <Badge className={cn("text-[10px]", sc.color)}>{sc.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {op.totalSelected} matters · {new Date(op.createdAt).toLocaleDateString()}
                        {op.totalSucceeded > 0 && ` · ${op.totalSucceeded} succeeded`}
                        {op.totalFailed > 0 && ` · ${op.totalFailed} failed`}
                        {op.totalSkipped > 0 && ` · ${op.totalSkipped} skipped`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {op.status === "RUNNING" && (
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${op.totalSelected > 0 ? (op.totalProcessed / op.totalSelected) * 100 : 0}%` }} /></div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Layers className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No bulk operations yet</p>
            <p className="text-xs text-gray-400 mt-1">Select matters from the matter list and apply batch operations</p>
          </Card>
        )}
      </div>

      {/* Presets */}
      {presets && presets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Saved Presets</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((p) => (
              <Card key={p.id} className="p-3">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{typeLabels[p.operationType] || p.operationType}</Badge>
                  <span className="text-[10px] text-gray-400">{p.runCount} runs</span>
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full text-xs">Run Preset</Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
