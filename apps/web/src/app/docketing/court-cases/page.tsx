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
import { ArrowLeft, Plus, RefreshCw, Trash2, FileText, Eye, EyeOff } from "lucide-react";

export default function CourtCasesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const { data: cases } = trpc.docketing.getCourtCases.useQuery();
  const { data: filings } = trpc.docketing.getCourtFilings.useQuery({ courtCaseId: selectedCase || "" }, { enabled: !!selectedCase });

  const addMut = trpc.docketing.addCourtCase.useMutation({
    onSuccess: () => { utils.docketing.getCourtCases.invalidate(); setAddOpen(false); toast({ title: "Court case added" }); },
  });
  const checkMut = trpc.docketing.checkForNewFilings.useMutation({
    onSuccess: (d) => { utils.docketing.getCourtFilings.invalidate(); toast({ title: d.error ? `Error: ${d.error}` : `${d.newFilings.length} new filings` }); },
  });
  const reviewMut = trpc.docketing.markFilingReviewed.useMutation({ onSuccess: () => utils.docketing.getCourtFilings.invalidate() });
  const removeMut = trpc.docketing.removeCourtCase.useMutation({
    onSuccess: () => { utils.docketing.getCourtCases.invalidate(); setSelectedCase(null); toast({ title: "Case removed" }); },
  });

  const matters = mattersData?.matters || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/docketing"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Court Cases & Filings</h1>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Case</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Case List */}
        <div className="space-y-2">
          {(cases || []).map((cc: any) => (
            <Card key={cc.id} className={`cursor-pointer transition-colors ${selectedCase === cc.id ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"}`} onClick={() => setSelectedCase(cc.id)}>
              <CardContent className="pt-4">
                <p className="font-medium text-sm">{cc.caseName || cc.caseNumber}</p>
                <p className="text-xs text-slate-500">{cc.courtName}</p>
                <p className="text-xs text-slate-400">{cc.caseNumber} {cc.judge ? `— ${cc.judge}` : ""}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs">{cc._count?.filings || 0} filings</span>
                  {cc.lastChecked && <span className="text-xs text-slate-400">Checked: {new Date(cc.lastChecked).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
          {!cases?.length && <p className="text-slate-500 text-center py-8">No court cases monitored</p>}
        </div>

        {/* Filings Panel */}
        <div className="md:col-span-2">
          {selectedCase ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Docket Entries</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => checkMut.mutate({ courtCaseId: selectedCase })} disabled={checkMut.isLoading}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Check Now
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("Remove?")) removeMut.mutate({ courtCaseId: selectedCase }); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(filings || []).map((f: any) => (
                    <div key={f.id} className={`p-3 rounded-lg border ${f.isNew ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {f.docketEntryNum && <span className="text-xs font-mono text-slate-500">#{f.docketEntryNum}</span>}
                            <span className="text-xs text-slate-400">{new Date(f.filedDate).toLocaleDateString()}</span>
                            {f.isNew && <span className="text-xs bg-amber-200 text-amber-800 px-1 rounded">New</span>}
                          </div>
                          <p className="text-sm mt-1">{f.description}</p>
                        </div>
                        <div className="flex gap-1">
                          {f.isNew && <Button variant="ghost" size="sm" onClick={() => reviewMut.mutate({ filingId: f.id })}><Eye className="h-3 w-3" /></Button>}
                          {f.documentUrl && <Button variant="ghost" size="sm" asChild><a href={f.documentUrl} target="_blank"><FileText className="h-3 w-3" /></a></Button>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!filings?.length && <p className="text-slate-500 text-center py-4">No filings</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Select a case to view filings</div>
          )}
        </div>
      </div>

      {/* Add Case Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Court Case</DialogTitle></DialogHeader>
          <CourtCaseForm matters={matters} onSubmit={(d: any) => addMut.mutate(d)} isLoading={addMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourtCaseForm({ matters, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ matterId: "", courtName: "", caseNumber: "", caseName: "", judge: "" });
  const matterList = Array.isArray(matters) ? matters : [];
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Matter *</Label>
        <Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{matterList.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Court Name *</Label><Input value={form.courtName} onChange={(e) => setForm({ ...form, courtName: e.target.value })} placeholder="U.S. District Court, Eastern District of New York" /></div>
      <div className="space-y-2"><Label>Case Number *</Label><Input value={form.caseNumber} onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} placeholder="1:24-cv-01234" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Case Name</Label><Input value={form.caseName} onChange={(e) => setForm({ ...form, caseName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Judge</Label><Input value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} /></div>
      </div>
      <Button className="w-full" disabled={!form.matterId || !form.courtName || !form.caseNumber || isLoading} onClick={() => onSubmit({ ...form, caseName: form.caseName || undefined, judge: form.judge || undefined })}>
        {isLoading ? "Adding..." : "Add Case"}
      </Button>
    </div>
  );
}
