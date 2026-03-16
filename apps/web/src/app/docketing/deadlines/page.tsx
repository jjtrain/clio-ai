"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", COMPLETED: "bg-blue-100 text-blue-700", DISMISSED: "bg-gray-100 text-gray-700", MISSED: "bg-red-100 text-red-700", OVERRIDDEN: "bg-purple-100 text-purple-700" };
const PRIORITY_COLORS: Record<string, string> = { CRITICAL: "bg-red-500", UPCOMING: "bg-amber-500", SCHEDULED: "bg-green-500" };
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function DeadlinesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: deadlines } = trpc.docketing.getDeadlines.useQuery({
    status: statusFilter ? statusFilter as any : undefined,
    priority: priorityFilter ? priorityFilter as any : undefined,
    limit: 100,
  });

  const completeMut = trpc.docketing.completeDeadline.useMutation({ onSuccess: () => { utils.docketing.getDeadlines.invalidate(); toast({ title: "Completed" }); } });
  const dismissMut = trpc.docketing.dismissDeadline.useMutation({ onSuccess: () => { utils.docketing.getDeadlines.invalidate(); toast({ title: "Dismissed" }); } });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/docketing"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">All Deadlines</h1>
      </div>

      <div className="flex gap-2">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{["ACTIVE","COMPLETED","DISMISSED","MISSED","OVERRIDDEN"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={priorityFilter || "__all__"} onValueChange={(v) => setPriorityFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{["CRITICAL","UPCOMING","SCHEDULED"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card><CardContent className="pt-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead><TableHead>Due Date</TableHead><TableHead>Title</TableHead><TableHead>Matter</TableHead><TableHead>Authority</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(deadlines || []).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell><div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[d.priority] || ""}`} /></TableCell>
                <TableCell className="whitespace-nowrap">{new Date(d.dueDate).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium max-w-[250px]">{d.title}</TableCell>
                <TableCell>{d.matter?.name || "—"}</TableCell>
                <TableCell className="text-xs">{d.ruleAuthority || "—"}</TableCell>
                <TableCell className="text-xs">{d.source}</TableCell>
                <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || ""}`}>{fmt(d.status)}</span></TableCell>
                <TableCell>
                  {d.status === "ACTIVE" && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => completeMut.mutate({ deadlineId: d.id })}><CheckCircle className="h-3 w-3 text-green-500" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => dismissMut.mutate({ deadlineId: d.id, reason: "Dismissed from list" })}><XCircle className="h-3 w-3 text-slate-400" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!deadlines?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No deadlines found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
