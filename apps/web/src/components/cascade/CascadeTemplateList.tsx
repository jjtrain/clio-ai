"use client";

import { useState } from "react";
import { Workflow, Plus, Zap, Clock, CheckCircle, Settings, Copy, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const priorityColors: Record<string, string> = { low: "bg-gray-100 text-gray-600", normal: "bg-blue-100 text-blue-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" };
const practiceAreaColors: Record<string, string> = { family_law: "bg-purple-100 text-purple-700", personal_injury: "bg-teal-100 text-teal-700", immigration: "bg-indigo-100 text-indigo-700", corporate: "bg-slate-100 text-slate-700", real_estate: "bg-green-100 text-green-700", estate_planning: "bg-amber-100 text-amber-700" };

export function CascadeTemplateList() {
  const [filterPA, setFilterPA] = useState<string | null>(null);
  const { data: templates, refetch } = trpc.cascade.listTemplates.useQuery({ practiceArea: filterPA || undefined });
  const seedMutation = trpc.cascade.seedDefaults.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.cascade.deleteTemplate.useMutation({ onSuccess: () => refetch() });
  const cloneMutation = trpc.cascade.cloneTemplate.useMutation({ onSuccess: () => refetch() });

  const practiceAreas = Array.from(new Set(templates?.map((t) => t.practiceArea) || []));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="h-7 w-7 text-blue-600" />
            Task Cascade Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">Auto-create task sets when matter stages change</p>
        </div>
        <div className="flex gap-2">
          {(!templates || templates.length === 0) && (
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isLoading} className="gap-2">
              <Zap className="h-4 w-4" /> Seed Defaults
            </Button>
          )}
          <Button className="gap-2"><Plus className="h-4 w-4" /> New Template</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto">
        <button onClick={() => setFilterPA(null)} className={cn("px-3 py-1.5 text-xs font-medium rounded-full", !filterPA ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600")}>All</button>
        {practiceAreas.map((pa) => (
          <button key={pa} onClick={() => setFilterPA(pa)} className={cn("px-3 py-1.5 text-xs font-medium rounded-full capitalize whitespace-nowrap", filterPA === pa ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600")}>
            {pa.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((t) => (
          <Link key={t.id} href={`/settings/task-cascades/${t.id}`}>
            <Card className={cn("p-4 hover:shadow-md transition-all cursor-pointer", !t.isActive && "opacity-50")}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge className={cn("text-[10px] capitalize", practiceAreaColors[t.practiceArea] || "bg-gray-100 text-gray-600")}>{t.practiceArea.replace(/_/g, " ")}</Badge>
                    {t.triggerStage && <Badge variant="outline" className="text-[10px]">Stage: {t.triggerStage}</Badge>}
                    <Badge className={cn("text-[10px]", priorityColors[t.priority] || "")}>{t.priority}</Badge>
                  </div>
                </div>
                {t.isSystemTemplate && <Badge className="text-[10px] bg-blue-50 text-blue-600">System</Badge>}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">{t._count.tasks} tasks</span>
                <div className="flex items-center gap-1.5">
                  {t.isDefault ? (
                    <Badge className="text-[10px] bg-green-100 text-green-700"><Zap className="h-2.5 w-2.5 mr-0.5 inline" />Auto</Badge>
                  ) : (
                    <Badge className="text-[10px] bg-yellow-100 text-yellow-700">Suggested</Badge>
                  )}
                  <span className="text-[10px] text-gray-400">{t._count.executionLogs} runs</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {(!templates || templates.length === 0) && (
        <Card className="p-12 text-center">
          <Workflow className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No cascade templates yet</p>
          <p className="text-xs text-gray-400 mb-4">Seed defaults to get started with practice-area-specific task cascades</p>
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isLoading} className="gap-2">
            <Zap className="h-4 w-4" /> Seed Default Templates
          </Button>
        </Card>
      )}
    </div>
  );
}
