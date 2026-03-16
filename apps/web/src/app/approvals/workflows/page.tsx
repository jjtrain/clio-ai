"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Copy, Trash2 } from "lucide-react";

const TRIGGER_COLORS: Record<string, string> = {
  ALL_INVOICES: "bg-blue-100 text-blue-700",
  AMOUNT_THRESHOLD: "bg-purple-100 text-purple-700",
  PRACTICE_AREA: "bg-teal-100 text-teal-700",
  CLIENT: "bg-amber-100 text-amber-700",
  MATTER_TYPE: "bg-emerald-100 text-emerald-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function WorkflowsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: workflows } = trpc.approvals.listWorkflows.useQuery();

  const toggleMut = trpc.approvals.toggleActive.useMutation({
    onSuccess: () => { utils.approvals.listWorkflows.invalidate(); },
  });
  const deleteMut = trpc.approvals.deleteWorkflow.useMutation({
    onSuccess: () => { utils.approvals.listWorkflows.invalidate(); toast({ title: "Deleted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const dupMut = trpc.approvals.duplicateWorkflow.useMutation({
    onSuccess: () => { utils.approvals.listWorkflows.invalidate(); toast({ title: "Duplicated" }); },
  });
  const seedMut = trpc.approvals.seedWorkflows.useMutation({
    onSuccess: (d) => { utils.approvals.listWorkflows.invalidate(); toast({ title: d.seeded ? "Starter workflows created" : "Workflows already exist" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/approvals"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Approval Workflows</h1>
        </div>
        <div className="flex gap-2">
          {(!workflows || workflows.length === 0) && (
            <Button variant="outline" onClick={() => seedMut.mutate()}>Create Starter Workflows</Button>
          )}
          <Button onClick={() => router.push("/approvals/workflows/new")}><Plus className="h-4 w-4 mr-2" /> New Workflow</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(workflows || []).map((wf: any) => {
                const steps: any[] = wf.steps ? JSON.parse(wf.steps) : [];
                return (
                  <TableRow key={wf.id} className="cursor-pointer" onClick={() => router.push(`/approvals/workflows/${wf.id}`)}>
                    <TableCell className="font-medium">{wf.name}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TRIGGER_COLORS[wf.triggerType] || ""}`}>{fmt(wf.triggerType)}</span></TableCell>
                    <TableCell>{steps.length} step{steps.length !== 1 ? "s" : ""}</TableCell>
                    <TableCell>{wf._count?.requests ?? 0}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${wf.isActive ? "bg-green-500" : "bg-gray-200"}`}
                        onClick={() => toggleMut.mutate({ id: wf.id, isActive: !wf.isActive })}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${wf.isActive ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => dupMut.mutate({ id: wf.id })}><Copy className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) deleteMut.mutate({ id: wf.id }); }}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!workflows?.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No workflows yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
