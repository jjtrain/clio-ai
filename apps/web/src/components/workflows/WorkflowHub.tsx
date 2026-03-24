"use client";

import { GitBranch, Plus, Star, Copy, Globe, Zap, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function WorkflowHub() {
  const { data: stats } = trpc.workflows.getStats.useQuery();
  const { data: templates } = trpc.workflows.getTemplates.useQuery({});
  const cloneMutation = trpc.workflows.cloneTemplate.useMutation();

  const systemTemplates = templates?.filter((t) => t.isSystemTemplate) || [];
  const firmTemplates = templates?.filter((t) => !t.isSystemTemplate) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-blue-600" />
            Workflow Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">Practice-area blueprints that orchestrate stages, tasks, documents, deadlines, and automations</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Workflow</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.templates}</p><p className="text-xs text-gray-500">Templates</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">{stats.activeWorkflows}</p><p className="text-xs text-gray-500">Active Workflows</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">{stats.totalEvents}</p><p className="text-xs text-gray-500">Events Executed</p></Card>
        </div>
      )}

      {/* Firm Templates */}
      {firmTemplates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">My Templates</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {firmTemplates.map((t) => <WorkflowCard key={t.id} template={t} />)}
          </div>
        </div>
      )}

      {/* System Templates */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">System Templates</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {systemTemplates.map((t) => <WorkflowCard key={t.id} template={t} isSystem />)}
        </div>
      </div>

      {(!templates || templates.length === 0) && (
        <Card className="p-12 text-center">
          <GitBranch className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No workflow templates yet</p>
        </Card>
      )}
    </div>
  );
}

function WorkflowCard({ template, isSystem }: { template: any; isSystem?: boolean }) {
  const stages = (template.stagesConfig as any[]) || [];
  const cloneMutation = trpc.workflows.cloneTemplate.useMutation();

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{template.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className="text-[10px] capitalize">{template.practiceArea.replace(/_/g, " ")}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{template.caseType.replace(/_/g, " ")}</Badge>
            {template.jurisdiction && <Badge variant="outline" className="text-[10px] uppercase">{template.jurisdiction}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isSystem && <Badge className="text-[10px] bg-blue-100 text-blue-700">System</Badge>}
          {template.isDefault && <Badge className="text-[10px] bg-green-100 text-green-700">Default</Badge>}
        </div>
      </div>

      {template.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{template.description}</p>}

      <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-3">
        <span>{stages.length} stages</span>
        <span>v{template.version}</span>
        <span>{template.usageCount} uses</span>
        {template.rating > 0 && (
          <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-yellow-400 fill-yellow-400" /> {template.rating.toFixed(1)}</span>
        )}
      </div>

      {/* Stage pipeline preview */}
      <div className="flex items-center gap-0.5 overflow-hidden">
        {stages.slice(0, 8).map((s: any, i: number) => (
          <div key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: s.color || "#E5E7EB" }} title={s.name} />
        ))}
        {stages.length > 8 && <span className="text-[9px] text-gray-400">+{stages.length - 8}</span>}
      </div>

      {isSystem && (
        <Button variant="outline" size="sm" className="mt-3 w-full gap-1 text-xs"
          onClick={() => cloneMutation.mutate({ templateId: template.id, name: `${template.name} (Custom)` })}>
          <Copy className="h-3 w-3" /> Clone to Customize
        </Button>
      )}
    </Card>
  );
}
