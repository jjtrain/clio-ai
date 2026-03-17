"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Share2, UserCheck, ArrowUpRight, ArrowDownLeft, DollarSign, Clock, Plus, CheckCircle, XCircle, Settings } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", SENT: "bg-blue-100 text-blue-700", RECEIVED: "bg-amber-100 text-amber-700", UNDER_REVIEW: "bg-amber-100 text-amber-700", ACCEPTED: "bg-green-100 text-green-700", DECLINED: "bg-red-100 text-red-700", IN_PROGRESS: "bg-purple-100 text-purple-700", COMPLETED: "bg-green-100 text-green-700", CANCELLED: "bg-gray-100 text-gray-700" };
const APPEARANCE_STATUS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", POSTED: "bg-blue-100 text-blue-700", MATCHING: "bg-amber-100 text-amber-700", ATTORNEY_FOUND: "bg-indigo-100 text-indigo-700", CONFIRMED: "bg-green-100 text-green-700", COMPLETED: "bg-green-100 text-green-700", CANCELLED: "bg-gray-100 text-gray-700" };
const URGENCY_COLORS: Record<string, string> = { NORMAL: "bg-blue-50 text-blue-600", URGENT: "bg-amber-50 text-amber-600", EMERGENCY: "bg-red-50 text-red-600" };

function fmt(s: string) { return s?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || ""; }
function cur(n: number | null | undefined) { return n != null ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"; }

export default function ReferralsDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("referrals");
  const [directionFilter, setDirectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [inboundOpen, setInboundOpen] = useState(false);

  const { data: stats } = trpc.referrals.getDashboardStats.useQuery();
  const { data: referrals } = trpc.referrals["referrals.list"].useQuery({ direction: directionFilter || undefined, status: statusFilter || undefined });
  const { data: appearances } = trpc.referrals["appearances.list"].useQuery();
  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const matters = mattersData?.matters || [];

  const acceptMut = trpc.referrals["referrals.accept"].useMutation({ onSuccess: () => { utils.referrals.invalidate(); toast({ title: "Referral accepted" }); } });
  const declineMut = trpc.referrals["referrals.decline"].useMutation({ onSuccess: () => { utils.referrals.invalidate(); toast({ title: "Referral declined" }); } });
  const sendMut = trpc.referrals["referrals.createOutbound"].useMutation({ onSuccess: () => { utils.referrals.invalidate(); setSendOpen(false); toast({ title: "Referral sent" }); } });
  const inboundMut = trpc.referrals["referrals.processInbound"].useMutation({ onSuccess: () => { utils.referrals.invalidate(); setInboundOpen(false); toast({ title: "Inbound referral recorded" }); } });
  const createAppMut = trpc.referrals["appearances.create"].useMutation({ onSuccess: () => { utils.referrals["appearances.list"].invalidate(); toast({ title: "Appearance request created" }); } });
  const cancelAppMut = trpc.referrals["appearances.cancel"].useMutation({ onSuccess: () => { utils.referrals["appearances.list"].invalidate(); toast({ title: "Cancelled" }); } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Referrals & Case Sharing</h1><p className="text-sm text-slate-500">Attorney Share referrals and AppearMe appearance attorneys</p></div>
        <div className="flex gap-2">
          <Button onClick={() => setSendOpen(true)}><ArrowUpRight className="h-4 w-4 mr-2" /> Send Referral</Button>
          <Button variant="outline" onClick={() => setInboundOpen(true)}><ArrowDownLeft className="h-4 w-4 mr-2" /> Record Inbound</Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><ArrowDownLeft className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Inbound</p></div><p className="text-xl font-bold">{stats?.inboundMonth ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Outbound</p></div><p className="text-xl font-bold">{stats?.outboundMonth ?? 0}</p></CardContent></Card>
        <Card className="border-amber-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Pending Review</p><p className="text-xl font-bold text-amber-700">{stats?.pendingReview ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Active Appearances</p></div><p className="text-xl font-bold">{stats?.activeAppearances ?? 0}</p></CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Fees Earned</p><p className="text-xl font-bold text-green-700">{cur(stats?.feesEarned)}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Fees Owed</p><p className="text-xl font-bold text-red-700">{cur(stats?.feesOwed)}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="referrals"><Share2 className="h-3 w-3 mr-1" /> Referrals</TabsTrigger>
          <TabsTrigger value="appearances"><UserCheck className="h-3 w-3 mr-1" /> Appearances</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-4">
          <div className="flex gap-2">
            <Select value={directionFilter || "__all__"} onValueChange={(v) => setDirectionFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">All</SelectItem><SelectItem value="INBOUND">Inbound</SelectItem><SelectItem value="OUTBOUND">Outbound</SelectItem></SelectContent>
            </Select>
            <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">All</SelectItem>{["RECEIVED","SENT","ACCEPTED","DECLINED","IN_PROGRESS","COMPLETED"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead></TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Case Type</TableHead><TableHead>Partner</TableHead><TableHead>Status</TableHead><TableHead>Fee</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(referrals || []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.direction === "INBOUND" ? <ArrowDownLeft className="h-4 w-4 text-green-500" /> : <ArrowUpRight className="h-4 w-4 text-blue-500" />}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{r.clientName}</TableCell>
                    <TableCell className="text-xs">{r.caseType || "—"}</TableCell>
                    <TableCell className="text-xs">{r.direction === "INBOUND" ? (r.referringAttorneyName || r.referringFirmName || "—") : (r.receivingAttorneyName || r.receivingFirmName || "—")}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || ""}`}>{fmt(r.status)}</span></TableCell>
                    <TableCell className="text-xs">{r.referralFeePercentage ? `${(Number(r.referralFeePercentage) * 100).toFixed(1)}%` : r.referralFeeFlat ? cur(Number(r.referralFeeFlat)) : "TBD"}</TableCell>
                    <TableCell>
                      {r.status === "RECEIVED" && r.direction === "INBOUND" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => acceptMut.mutate({ referralId: r.id })}><CheckCircle className="h-3 w-3 text-green-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => declineMut.mutate({ referralId: r.id, reason: "Not accepting at this time" })}><XCircle className="h-3 w-3 text-red-500" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!referrals?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No referrals yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="appearances" className="space-y-4">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Court</TableHead><TableHead>Practice Area</TableHead><TableHead>Attorney</TableHead><TableHead>Status</TableHead><TableHead>Cost</TableHead><TableHead>Rating</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(appearances || []).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{new Date(a.eventDate).toLocaleDateString()} {a.eventTime || ""}</TableCell>
                    <TableCell className="text-xs">{fmt(a.requestType)}</TableCell>
                    <TableCell className="text-xs">{a.courtName || "—"}</TableCell>
                    <TableCell className="text-xs">{a.practiceArea}</TableCell>
                    <TableCell>{a.assignedAttorneyName || "TBD"}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${APPEARANCE_STATUS[a.status] || ""}`}>{fmt(a.status)}</span></TableCell>
                    <TableCell>{cur(Number(a.totalCost))}</TableCell>
                    <TableCell>{a.rating ? `${a.rating}/5` : "—"}</TableCell>
                    <TableCell>
                      {!["COMPLETED", "CANCELLED"].includes(a.status) && <Button variant="ghost" size="sm" onClick={() => cancelAppMut.mutate({ id: a.id })}><XCircle className="h-3 w-3 text-red-500" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {!appearances?.length && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No appearance requests</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Send Referral Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Send Referral</DialogTitle></DialogHeader>
          <SendReferralForm onSubmit={(d: any) => sendMut.mutate(d)} isLoading={sendMut.isLoading} />
        </DialogContent>
      </Dialog>

      {/* Record Inbound Dialog */}
      <Dialog open={inboundOpen} onOpenChange={setInboundOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Inbound Referral</DialogTitle></DialogHeader>
          <InboundReferralForm onSubmit={(d: any) => inboundMut.mutate(d)} isLoading={inboundMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SendReferralForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ clientName: "", clientEmail: "", caseType: "", caseDescription: "", jurisdiction: "", receivingAttorneyName: "", receivingAttorneyEmail: "", referralFeeType: "PERCENTAGE", referralFeePercentage: 0.3333, urgency: "NORMAL" });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Client Name *</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Client Email</Label><Input value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Case Type</Label><Input value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })} placeholder="Personal Injury" /></div>
        <div className="space-y-2"><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Case Description</Label><Textarea rows={3} value={form.caseDescription} onChange={(e) => setForm({ ...form, caseDescription: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Receiving Attorney</Label><Input value={form.receivingAttorneyName} onChange={(e) => setForm({ ...form, receivingAttorneyName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Their Email</Label><Input value={form.receivingAttorneyEmail} onChange={(e) => setForm({ ...form, receivingAttorneyEmail: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Referral Fee (%)</Label><Input type="number" step="0.01" value={(form.referralFeePercentage * 100).toFixed(2)} onChange={(e) => setForm({ ...form, referralFeePercentage: Number(e.target.value) / 100 })} /></div>
      <Button className="w-full" disabled={!form.clientName || isLoading} onClick={() => onSubmit(form)}>
        {isLoading ? "Sending..." : "Send Referral"}
      </Button>
    </div>
  );
}

function InboundReferralForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ referringAttorneyName: "", referringAttorneyEmail: "", referringFirmName: "", clientName: "", clientEmail: "", caseType: "", caseDescription: "", jurisdiction: "", urgency: "NORMAL" });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Referring Attorney</Label><Input value={form.referringAttorneyName} onChange={(e) => setForm({ ...form, referringAttorneyName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Their Firm</Label><Input value={form.referringFirmName} onChange={(e) => setForm({ ...form, referringFirmName: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Client Name *</Label><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
        <div className="space-y-2"><Label>Client Email</Label><Input value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Case Type</Label><Input value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })} /></div>
        <div className="space-y-2"><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Case Description</Label><Textarea rows={3} value={form.caseDescription} onChange={(e) => setForm({ ...form, caseDescription: e.target.value })} /></div>
      <Button className="w-full" disabled={!form.clientName || isLoading} onClick={() => onSubmit(form)}>
        {isLoading ? "Recording..." : "Record Referral"}
      </Button>
    </div>
  );
}
