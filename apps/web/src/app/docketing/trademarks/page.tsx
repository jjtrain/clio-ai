"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, RefreshCw, Trash2, Scale } from "lucide-react";

export default function TrademarksPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);

  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const { data: trademarks } = trpc.docketing.getMonitoredTrademarks.useQuery();

  const addMut = trpc.docketing.addTrademarkToMonitor.useMutation({
    onSuccess: () => { utils.docketing.getMonitoredTrademarks.invalidate(); setAddOpen(false); toast({ title: "Trademark added" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const refreshMut = trpc.docketing.refreshTrademarkStatus.useMutation({
    onSuccess: () => { utils.docketing.getMonitoredTrademarks.invalidate(); toast({ title: "Refreshed" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const removeMut = trpc.docketing.removeTrademarkMonitor.useMutation({
    onSuccess: () => { utils.docketing.getMonitoredTrademarks.invalidate(); toast({ title: "Removed" }); },
  });

  const matters = mattersData?.matters || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/docketing"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Trademark Docket</h1>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Trademark</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(trademarks || []).map((tm: any) => {
          const daysToDeadline = tm.nextDeadlineDate ? Math.ceil((new Date(tm.nextDeadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
          return (
            <Card key={tm.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-bold">{tm.markName}</p>
                      <p className="text-xs text-slate-500">SN: {tm.serialNumber} {tm.registrationNumber ? `| Reg: ${tm.registrationNumber}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => refreshMut.mutate({ trademarkDocketId: tm.id })}><RefreshCw className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remove?")) removeMut.mutate({ trademarkDocketId: tm.id }); }}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium">{tm.currentStatus || "Unknown"}</span></div>
                  {tm.ownerName && <div className="flex justify-between"><span className="text-slate-500">Owner</span><span>{tm.ownerName}</span></div>}
                  {tm.matter && <div className="flex justify-between"><span className="text-slate-500">Matter</span><span>{tm.matter.name}</span></div>}
                  {tm.nextDeadlineType && (
                    <div className={`mt-2 p-2 rounded ${daysToDeadline !== null && daysToDeadline <= 90 ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
                      <p className="text-xs font-medium">{tm.nextDeadlineType}</p>
                      <p className="text-xs">{new Date(tm.nextDeadlineDate).toLocaleDateString()} {daysToDeadline !== null ? `(${daysToDeadline} days)` : ""}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Last checked: {new Date(tm.lastChecked).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          );
        })}
        {!trademarks?.length && <p className="text-slate-500 text-center py-8 col-span-3">No monitored trademarks. Add one to start tracking.</p>}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Trademark to Monitor</DialogTitle></DialogHeader>
          <TrademarkForm matters={matters} onSubmit={(d: any) => addMut.mutate(d)} isLoading={addMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrademarkForm({ matters, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ matterId: "", serialNumber: "", markName: "" });
  const matterList = Array.isArray(matters) ? matters : [];
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Serial Number *</Label><Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="97123456" /></div>
      <div className="space-y-2"><Label>Mark Name *</Label><Input value={form.markName} onChange={(e) => setForm({ ...form, markName: e.target.value })} placeholder="FOOT RX" /></div>
      <div className="space-y-2"><Label>Matter (optional)</Label>
        <Select value={form.matterId || "__none__"} onValueChange={(v) => setForm({ ...form, matterId: v === "__none__" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent><SelectItem value="__none__">None</SelectItem>{matterList.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className="text-xs text-slate-500">The system will attempt to fetch the current status from USPTO automatically.</p>
      <Button className="w-full" disabled={!form.serialNumber || !form.markName || isLoading} onClick={() => onSubmit({ serialNumber: form.serialNumber, markName: form.markName, matterId: form.matterId || undefined })}>
        {isLoading ? "Adding..." : "Add & Fetch Status"}
      </Button>
    </div>
  );
}
