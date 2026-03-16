"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertTriangle, Clock, FileText, Scale, Plus, CheckCircle, Info, Settings, RefreshCw,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500", UPCOMING: "bg-amber-500", SCHEDULED: "bg-green-500",
};
const PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700", UPCOMING: "bg-amber-100 text-amber-700", SCHEDULED: "bg-green-100 text-green-700",
};
const SOURCE_ICONS: Record<string, string> = {
  LAWTOOLBOX: "LTB", COURTDRIVE: "CD", USPTO: "TM", MANUAL: "M", DOCUMENT_PARSED: "DOC",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function daysOut(date: Date | string) {
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

export default function DocketingDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [addOpen, setAddOpen] = useState(false);

  const { data: stats } = trpc.docketing.getDashboardStats.useQuery();
  const { data: integrations } = trpc.docketing.getIntegrationStatus.useQuery();
  const { data: deadlines } = trpc.docketing.getUpcomingDeadlines.useQuery({ days: 60 });
  const { data: trademarks } = trpc.docketing.getMonitoredTrademarks.useQuery();
  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const matters = mattersData?.matters || [];

  const completeMut = trpc.docketing.completeDeadline.useMutation({
    onSuccess: () => { invalidate(); toast({ title: "Deadline completed" }); },
  });
  const addMut = trpc.docketing.addManualDeadline.useMutation({
    onSuccess: () => { invalidate(); setAddOpen(false); toast({ title: "Deadline added" }); },
  });
  const refreshTm = trpc.docketing.refreshTrademarkStatus.useMutation({
    onSuccess: () => { utils.docketing.getMonitoredTrademarks.invalidate(); toast({ title: "Status refreshed" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function invalidate() {
    utils.docketing.getDashboardStats.invalidate();
    utils.docketing.getUpcomingDeadlines.invalidate();
  }

  const anyNotConfigured = integrations && (!integrations.lawToolBox.configured || !integrations.courtDrive.configured || !integrations.uspto.configured);

  return (
    <div className="space-y-6">
      {/* Integration banner */}
      {anyNotConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>Some docketing integrations are not configured.</span>
          <Link href="/docketing/settings" className="underline font-medium">Go to Settings</Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Docketing</h1>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Deadline</Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/docketing/settings")}><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200"><CardContent className="pt-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><p className="text-xs text-slate-500">Critical</p></div><p className="text-2xl font-bold text-red-700">{stats?.critical ?? 0}</p></CardContent></Card>
        <Card className="border-amber-200"><CardContent className="pt-4"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500">Upcoming</p></div><p className="text-2xl font-bold text-amber-700">{stats?.upcoming ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Unreviewed Filings</p></div><p className="text-2xl font-bold">{stats?.unreviewedFilings ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Monitored Marks</p></div><p className="text-2xl font-bold">{stats?.monitoredTrademarks ?? 0}</p></CardContent></Card>
      </div>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upcoming Deadlines</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild><Link href="/docketing/deadlines">View All</Link></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Matter</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(deadlines || []).slice(0, 15).map((d: any) => {
                  const days = daysOut(d.dueDate);
                  return (
                    <TableRow key={d.id}>
                      <TableCell><div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[d.priority]}`} /></TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(d.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${days <= 0 ? "bg-red-100 text-red-700" : days <= 14 ? "bg-red-50 text-red-600" : days <= 30 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>{days <= 0 ? "PAST DUE" : `${days}d`}</span></TableCell>
                      <TableCell className="font-medium max-w-[250px]">{d.title}</TableCell>
                      <TableCell>{d.matter?.name || "—"}</TableCell>
                      <TableCell><span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">{SOURCE_ICONS[d.source] || d.source}</span></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => completeMut.mutate({ deadlineId: d.id })}><CheckCircle className="h-3 w-3 text-green-500" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!deadlines?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No upcoming deadlines</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom: Trademarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Trademark Status</CardTitle>
              <Button variant="outline" size="sm" asChild><Link href="/docketing/trademarks">View All</Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {(trademarks || []).slice(0, 5).map((tm: any) => (
              <div key={tm.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{tm.markName}</p>
                  <p className="text-xs text-slate-500">SN: {tm.serialNumber} — {tm.currentStatus || "Unknown"}</p>
                </div>
                <div className="text-right">
                  {tm.nextDeadlineDate && <p className="text-xs text-amber-600">{tm.nextDeadlineType}: {new Date(tm.nextDeadlineDate).toLocaleDateString()}</p>}
                  <Button variant="ghost" size="sm" onClick={() => refreshTm.mutate({ trademarkDocketId: tm.id })}><RefreshCw className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {!trademarks?.length && <p className="text-sm text-slate-500 text-center py-4">No monitored trademarks</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Quick Links</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link href="/docketing/deadlines" className="flex items-center gap-2 p-2 rounded hover:bg-slate-50"><Clock className="h-4 w-4 text-slate-400" /><span className="text-sm">All Deadlines</span></Link>
            <Link href="/docketing/court-cases" className="flex items-center gap-2 p-2 rounded hover:bg-slate-50"><FileText className="h-4 w-4 text-slate-400" /><span className="text-sm">Court Cases & Filings</span></Link>
            <Link href="/docketing/trademarks" className="flex items-center gap-2 p-2 rounded hover:bg-slate-50"><Scale className="h-4 w-4 text-slate-400" /><span className="text-sm">Trademark Docket</span></Link>
            <Link href="/docketing/settings" className="flex items-center gap-2 p-2 rounded hover:bg-slate-50"><Settings className="h-4 w-4 text-slate-400" /><span className="text-sm">Integration Settings</span></Link>
          </CardContent>
        </Card>
      </div>

      {/* Add Deadline Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Deadline</DialogTitle></DialogHeader>
          <AddDeadlineForm matters={matters} onSubmit={(data: any) => addMut.mutate(data)} isLoading={addMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddDeadlineForm({ matters, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ matterId: "", title: "", dueDate: "", description: "", ruleAuthority: "", jurisdiction: "", consequenceOfMissing: "" });
  const matterList = Array.isArray(matters) ? matters : [];
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Matter *</Label>
        <Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}>
          <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
          <SelectContent>{matterList.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Opposition to Motion for Summary Judgment" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Due Date *</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        <div className="space-y-2"><Label>Rule Authority</Label><Input value={form.ruleAuthority} onChange={(e) => setForm({ ...form, ruleAuthority: e.target.value })} placeholder="FRCP 56(a)" /></div>
      </div>
      <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="space-y-2"><Label>Consequence of Missing</Label><Input value={form.consequenceOfMissing} onChange={(e) => setForm({ ...form, consequenceOfMissing: e.target.value })} /></div>
      <Button className="w-full" disabled={!form.matterId || !form.title || !form.dueDate || isLoading} onClick={() => onSubmit({ ...form, description: form.description || undefined, ruleAuthority: form.ruleAuthority || undefined, consequenceOfMissing: form.consequenceOfMissing || undefined })}>
        {isLoading ? "Adding..." : "Add Deadline"}
      </Button>
    </div>
  );
}
