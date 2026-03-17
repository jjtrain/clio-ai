"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Send, RefreshCw, Info } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-blue-100 text-blue-700", PROCESSING: "bg-amber-100 text-amber-700", ACCEPTED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700", SERVED: "bg-green-100 text-green-700", COMPLETED: "bg-green-100 text-green-700", CANCELLED: "bg-gray-100 text-gray-700" };
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null) { return n != null ? "$" + Number(n).toFixed(2) : "—"; }

export default function FilingPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("efiling");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);

  const { data: filings } = trpc.docTools["infotrack.list"].useQuery();
  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const matters = mattersData?.matters || [];

  const submitMut = trpc.docTools["infotrack.submitFiling"].useMutation({
    onSuccess: () => { utils.docTools["infotrack.list"].invalidate(); setSubmitOpen(false); toast({ title: "Filing submitted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const serviceMut = trpc.docTools["infotrack.requestService"].useMutation({
    onSuccess: () => { utils.docTools["infotrack.list"].invalidate(); setServiceOpen(false); toast({ title: "Service requested" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const statusMut = trpc.docTools["infotrack.getStatus"].useMutation({
    onSuccess: () => { utils.docTools["infotrack.list"].invalidate(); toast({ title: "Status updated" }); },
  });

  const efilings = (filings || []).filter((f: any) => f.filingType !== "SERVICE_OF_PROCESS");
  const services = (filings || []).filter((f: any) => f.filingType === "SERVICE_OF_PROCESS");
  const totalCost = (filings || []).reduce((s: number, f: any) => s + Number(f.cost || 0) + Number(f.courtFee || 0) + Number(f.serviceFee || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Filing & Service of Process</h1>
          <p className="text-sm text-slate-500">InfoTrack-powered court eFiling and service</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSubmitOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Filing</Button>
          <Button variant="outline" onClick={() => setServiceOpen(true)}><Send className="h-4 w-4 mr-2" /> Request Service</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Pending</p><p className="text-lg font-bold">{(filings || []).filter((f: any) => ["SUBMITTED", "PROCESSING"].includes(f.status)).length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Completed</p><p className="text-lg font-bold text-green-600">{(filings || []).filter((f: any) => ["ACCEPTED", "SERVED", "COMPLETED"].includes(f.status)).length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Rejected</p><p className="text-lg font-bold text-red-600">{(filings || []).filter((f: any) => f.status === "REJECTED").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Spent</p><p className="text-lg font-bold">{cur(totalCost)}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="efiling">E-Filing ({efilings.length})</TabsTrigger>
          <TabsTrigger value="service">Service of Process ({services.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="efiling">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Court</TableHead><TableHead>Case #</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Cost</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {efilings.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap">{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{f.court || "—"}</TableCell>
                    <TableCell>{f.caseNumber || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{f.description}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] || ""}`}>{fmt(f.status)}</span></TableCell>
                    <TableCell>{cur(Number(f.cost || 0))}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ filingId: f.id })}><RefreshCw className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!efilings.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No filings</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="service">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Recipient</TableHead><TableHead>Method</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Served</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {services.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap">{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{f.recipientName || "—"}</TableCell>
                    <TableCell>{f.serviceMethod || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{f.description}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] || ""}`}>{fmt(f.status)}</span></TableCell>
                    <TableCell>{f.servedDate ? new Date(f.servedDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ filingId: f.id })}><RefreshCw className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {!services.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No service orders</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Filing Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent><DialogHeader><DialogTitle>Submit E-Filing</DialogTitle></DialogHeader>
          <FilingForm matters={matters} onSubmit={(d: any) => submitMut.mutate(d)} isLoading={submitMut.isLoading} />
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent><DialogHeader><DialogTitle>Request Service of Process</DialogTitle></DialogHeader>
          <ServiceForm matters={matters} onSubmit={(d: any) => serviceMut.mutate(d)} isLoading={serviceMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilingForm({ matters, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ matterId: "", courtId: "", caseNumber: "", filingType: "EFILING", description: "" });
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Matter</Label><Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Court</Label><Input value={form.courtId} onChange={(e) => setForm({ ...form, courtId: e.target.value })} /></div>
        <div className="space-y-2"><Label>Case Number</Label><Input value={form.caseNumber} onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <Button className="w-full" disabled={!form.matterId || !form.description || isLoading} onClick={() => onSubmit(form)}>{isLoading ? "Submitting..." : "Submit Filing"}</Button>
    </div>
  );
}

function ServiceForm({ matters, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ matterId: "", recipientName: "", recipientAddress: "", serviceMethod: "Personal", description: "" });
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Matter</Label><Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Recipient Name</Label><Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} /></div>
      <div className="space-y-2"><Label>Recipient Address</Label><Textarea rows={2} value={form.recipientAddress} onChange={(e) => setForm({ ...form, recipientAddress: e.target.value })} /></div>
      <div className="space-y-2"><Label>Service Method</Label><Select value={form.serviceMethod} onValueChange={(v) => setForm({ ...form, serviceMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Personal","Substituted","Nail and Mail","Publication"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <Button className="w-full" disabled={!form.matterId || !form.recipientName || isLoading} onClick={() => onSubmit(form)}>{isLoading ? "Requesting..." : "Request Service"}</Button>
    </div>
  );
}
