"use client";

import { ArrowLeft, Plus, Trash2, GripVertical, Zap, Clock, User, CheckCircle, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CascadeTemplateDetailProps {
  templateId: string;
}

const priorityDots: Record<string, string> = { low: "bg-gray-400", normal: "bg-blue-500", high: "bg-orange-500", critical: "bg-red-500" };
const assigneeLabels: Record<string, string> = { matter_attorney: "Lead Attorney", matter_paralegal: "Paralegal", specific_user: "Specific User", role: "By Role", unassigned: "Unassigned" };

export function CascadeTemplateDetail({ templateId }: CascadeTemplateDetailProps) {
  const { data: template, refetch } = trpc.cascade.getTemplate.useQuery({ templateId });
  const { data: history } = trpc.cascade.getExecutionHistory.useQuery({ templateId });
  const removeItem = trpc.cascade.removeItem.useMutation({ onSuccess: () => refetch() });
  const toggleDefault = trpc.cascade.updateTemplate.useMutation({ onSuccess: () => refetch() });

  if (!template) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings/task-cascades"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{template.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-[10px] capitalize">{template.practiceArea.replace(/_/g, " ")}</Badge>
              {template.triggerStage && <Badge variant="outline" className="text-[10px]">Stage: {template.triggerStage}</Badge>}
              <Badge className={cn("text-[10px]", template.isDefault ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                {template.isDefault ? "Auto-execute" : "Suggested"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleDefault.mutate({ templateId, isDefault: !template.isDefault })}>
            {template.isDefault ? "Switch to Suggested" : "Switch to Auto"}
          </Button>
        </div>
      </div>

      {template.description && <p className="text-sm text-gray-500">{template.description}</p>}

      {/* Task List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">{template.tasks.length} Tasks</h2>
        </div>
        <div className="space-y-2">
          {template.tasks.map((item, i) => (
            <Card key={item.id} className="p-3 flex items-center gap-3 group">
              <GripVertical className="h-4 w-4 text-gray-300 cursor-grab flex-shrink-0" />
              <span className="text-xs font-mono text-gray-400 w-6 flex-shrink-0">#{i + 1}</span>

              <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", priorityDots[item.priority] || "bg-blue-500")} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {item.relativeDueDays >= 0 ? `+${item.relativeDueDays}` : item.relativeDueDays} {item.isBusinessDays ? "biz" : "cal"} days
                  </span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                    <User className="h-3 w-3" />
                    {assigneeLabels[item.assigneeType] || item.assigneeType}
                  </span>
                  {item.category && <Badge variant="outline" className="text-[10px] capitalize">{item.category.replace(/_/g, " ")}</Badge>}
                  {item.isOptional && <Badge className="text-[10px] bg-gray-100 text-gray-500">Optional</Badge>}
                  {item.dependsOnItemId && (
                    <span className="text-[10px] text-purple-500">Depends on: #{template.tasks.findIndex((t) => t.id === item.dependsOnItemId) + 1}</span>
                  )}
                </div>
              </div>

              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400" onClick={() => removeItem.mutate({ itemId: item.id })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Execution History */}
      {history && history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Execution History</h2>
          <div className="space-y-1.5">
            {history.map((exec) => (
              <Card key={exec.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900">{exec.template?.name}</p>
                  <p className="text-xs text-gray-500">{new Date(exec.executedAt).toLocaleDateString()} · {exec.executionType} · {exec.tasksCreated} tasks</p>
                </div>
                <Badge className={cn("text-[10px]", exec.status === "completed" ? "bg-green-100 text-green-700" : exec.status === "rolled_back" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600")}>{exec.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
