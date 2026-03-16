"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Users, RefreshCw, Star, StarOff, Info, Calendar, DollarSign, MessageSquare, BookOpen, FileText, Unplug } from "lucide-react";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

const PARTY_COLORS = { PARENT1: "bg-blue-100 text-blue-700", PARENT2: "bg-orange-100 text-orange-700" };
const REIMB_COLORS: Record<string, string> = { PENDING: "bg-amber-100 text-amber-700", APPROVED: "bg-green-100 text-green-700", DENIED: "bg-red-100 text-red-700", PAID: "bg-blue-100 text-blue-700", DISPUTED: "bg-red-100 text-red-700" };

export default function FamilyCaseDetailPage() {
  const { matterId } = useParams<{ matterId: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("overview");
  const [connectOpen, setConnectOpen] = useState(false);
  const [ofwFamilyId, setOfwFamilyId] = useState("");

  const { data: fc } = trpc.familyLaw.getCase.useQuery({ matterId });
  const { data: conn } = trpc.familyLaw["ofw.getConnection"].useQuery({ familyCaseId: fc?.id || "" }, { enabled: !!fc?.id });
  const { data: ofwSettings } = trpc.familyLaw["ofw.getSettings"].useQuery();

  // OFW data queries (only when connected)
  const isConnected = conn?.connectionStatus === "ACTIVE";
  const { data: expenses } = trpc.familyLaw["ofw.expenses.list"].useQuery({ familyCaseId: fc?.id || "" }, { enabled: isConnected && !!fc?.id });
  const { data: expSummary } = trpc.familyLaw["ofw.expenses.summary"].useQuery({ familyCaseId: fc?.id || "" }, { enabled: isConnected && !!fc?.id });
  const { data: messages } = trpc.familyLaw["ofw.messages.list"].useQuery({ familyCaseId: fc?.id || "" }, { enabled: isConnected && !!fc?.id });
  const { data: schedule } = trpc.familyLaw["ofw.schedule.list"].useQuery({ familyCaseId: fc?.id || "" }, { enabled: isConnected && !!fc?.id });
  const { data: journal } = trpc.familyLaw["ofw.journal.list"].useQuery({ familyCaseId: fc?.id || "" }, { enabled: isConnected && !!fc?.id });
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;
  const { data: overnights } = trpc.familyLaw["ofw.schedule.overnights"].useQuery({ familyCaseId: fc?.id || "", from: yearStart, to: yearEnd }, { enabled: isConnected && !!fc?.id });

  const connectMut = trpc.familyLaw["ofw.connect"].useMutation({
    onSuccess: () => { utils.familyLaw["ofw.getConnection"].invalidate(); setConnectOpen(false); toast({ title: "Connected to OFW" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const syncMut = trpc.familyLaw["ofw.sync"].useMutation({
    onSuccess: (d) => {
      utils.familyLaw.invalidate();
      toast({ title: `Synced: ${d.expensesImported} expenses, ${d.messagesImported} messages, ${d.eventsImported} events, ${d.journalEntriesImported} journal` });
    },
  });
  const disconnectMut = trpc.familyLaw["ofw.disconnect"].useMutation({
    onSuccess: () => { utils.familyLaw["ofw.getConnection"].invalidate(); toast({ title: "Disconnected" }); },
  });
  const flagMsgMut = trpc.familyLaw["ofw.messages.flag"].useMutation({
    onSuccess: () => utils.familyLaw["ofw.messages.list"].invalidate(),
  });
  const flagJrnMut = trpc.familyLaw["ofw.journal.flag"].useMutation({
    onSuccess: () => utils.familyLaw["ofw.journal.list"].invalidate(),
  });

  if (!fc) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/family"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{fc.matter?.name}</h1>
          <p className="text-sm text-slate-500">{fc.matter?.client?.name} {fc.opposingPartyName ? `vs. ${fc.opposingPartyName}` : ""}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ofw">OurFamilyWizard</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Case Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {fc.caseType && <div className="flex justify-between"><span className="text-slate-500">Type</span><span>{fc.caseType}</span></div>}
              {fc.opposingPartyName && <div className="flex justify-between"><span className="text-slate-500">Opposing Party</span><span>{fc.opposingPartyName}</span></div>}
              {fc.childrenNames && <div className="flex justify-between"><span className="text-slate-500">Children</span><span>{fc.childrenNames}</span></div>}
              {fc.supportAmount && <div className="flex justify-between"><span className="text-slate-500">Support</span><span>{cur(Number(fc.supportAmount))} {fc.supportType || ""}</span></div>}
              {fc.custodySplitClient != null && <div className="flex justify-between"><span className="text-slate-500">Custody Split</span><span>{fc.custodySplitClient}/{fc.custodySplitOpposing}</span></div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OFW Tab */}
        <TabsContent value="ofw" className="space-y-6">
          {!ofwSettings?.isEnabled ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <Info className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-blue-800">OurFamilyWizard integration is not set up.</p>
              <Link href="/settings/integrations" className="text-sm text-blue-600 underline">Configure in Settings</Link>
            </div>
          ) : !isConnected ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-3">
                <Users className="h-10 w-10 text-blue-500 mx-auto" />
                <p className="font-medium">Connect OurFamilyWizard</p>
                <p className="text-sm text-slate-500">Import custody schedules, co-parent communications, shared expenses, and journal entries.</p>
                <Button onClick={() => setConnectOpen(true)}>Connect OFW</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Connected Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="success">OFW Connected</Badge>
                  {conn?.lastDataPull && <span className="text-xs text-slate-500">Last sync: {new Date(conn.lastDataPull).toLocaleString()}</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => syncMut.mutate({ connectionId: conn!.id })} disabled={syncMut.isLoading}>
                    <RefreshCw className="h-3 w-3 mr-1" /> {syncMut.isLoading ? "Syncing..." : "Sync Now"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("Disconnect?")) disconnectMut.mutate({ connectionId: conn!.id }); }}>
                    <Unplug className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                </div>
              </div>

              {/* OFW Sub-tabs */}
              <Tabs defaultValue="schedule">
                <TabsList>
                  <TabsTrigger value="schedule"><Calendar className="h-3 w-3 mr-1" /> Schedule</TabsTrigger>
                  <TabsTrigger value="expenses"><DollarSign className="h-3 w-3 mr-1" /> Expenses</TabsTrigger>
                  <TabsTrigger value="messages"><MessageSquare className="h-3 w-3 mr-1" /> Messages</TabsTrigger>
                  <TabsTrigger value="journal"><BookOpen className="h-3 w-3 mr-1" /> Journal</TabsTrigger>
                </TabsList>

                {/* Schedule */}
                <TabsContent value="schedule" className="space-y-4">
                  {overnights && (
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="border-blue-200"><CardContent className="pt-4 text-center"><p className="text-xs text-slate-500">Client Overnights</p><p className="text-2xl font-bold text-blue-700">{overnights.parent1Overnights}</p><p className="text-xs text-slate-400">{overnights.parent1Percentage}%</p></CardContent></Card>
                      <Card className="border-orange-200"><CardContent className="pt-4 text-center"><p className="text-xs text-slate-500">Opposing Overnights</p><p className="text-2xl font-bold text-orange-700">{overnights.parent2Overnights}</p><p className="text-xs text-slate-400">{overnights.parent2Percentage}%</p></CardContent></Card>
                      <Card><CardContent className="pt-4 text-center"><p className="text-xs text-slate-500">Total Nights</p><p className="text-2xl font-bold">{overnights.totalNights}</p>
                        <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${overnights.parent1Percentage}%` }} /></div>
                      </CardContent></Card>
                    </div>
                  )}
                  <Card><CardContent className="pt-4">
                    <div className="space-y-2">
                      {(schedule || []).slice(0, 20).map((e: any) => (
                        <div key={e.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                          <div className={`w-3 h-3 rounded-full ${e.assignedParent === "PARENT1" ? "bg-blue-500" : "bg-orange-500"}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{e.title}</p>
                            <p className="text-xs text-slate-500">{new Date(e.startDate).toLocaleDateString()} — {new Date(e.endDate).toLocaleDateString()}</p>
                          </div>
                          <span className="text-xs">{e.eventType}</span>
                          {e.isOvernight && <span className="text-xs bg-slate-100 px-1 rounded">Overnight</span>}
                        </div>
                      ))}
                      {!schedule?.length && <p className="text-slate-500 text-center py-4">No schedule events imported yet</p>}
                    </div>
                  </CardContent></Card>
                </TabsContent>

                {/* Expenses */}
                <TabsContent value="expenses" className="space-y-4">
                  {expSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Card><CardContent className="pt-3"><p className="text-xs text-slate-500">Total</p><p className="font-bold">{cur(expSummary.total)}</p></CardContent></Card>
                      <Card className="border-blue-200"><CardContent className="pt-3"><p className="text-xs text-slate-500">Client Paid</p><p className="font-bold text-blue-700">{cur(expSummary.parent1Total)}</p></CardContent></Card>
                      <Card className="border-orange-200"><CardContent className="pt-3"><p className="text-xs text-slate-500">Opposing Paid</p><p className="font-bold text-orange-700">{cur(expSummary.parent2Total)}</p></CardContent></Card>
                      <Card><CardContent className="pt-3"><p className="text-xs text-slate-500">Pending Reimb.</p><p className="font-bold text-amber-700">{cur(expSummary.pending)}</p></CardContent></Card>
                      <Card><CardContent className="pt-3"><p className="text-xs text-slate-500">Disputed</p><p className="font-bold text-red-700">{cur(expSummary.disputed)}</p></CardContent></Card>
                    </div>
                  )}
                  <Card><CardContent className="pt-4">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Paid By</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(expenses || []).slice(0, 30).map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell className="whitespace-nowrap">{new Date(e.dateIncurred).toLocaleDateString()}</TableCell>
                            <TableCell>{e.category}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{e.description}</TableCell>
                            <TableCell className="text-right font-mono">{cur(Number(e.amount))}</TableCell>
                            <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PARTY_COLORS[e.paidBy as keyof typeof PARTY_COLORS] || ""}`}>{e.paidBy === "PARENT1" ? "Client" : "Opposing"}</span></TableCell>
                            <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${REIMB_COLORS[e.reimbursementStatus] || ""}`}>{fmt(e.reimbursementStatus)}</span></TableCell>
                          </TableRow>
                        ))}
                        {!expenses?.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-4">No expenses imported</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent></Card>
                </TabsContent>

                {/* Messages */}
                <TabsContent value="messages" className="space-y-4">
                  <Card><CardContent className="pt-4">
                    <div className="space-y-3">
                      {(messages || []).slice(0, 30).map((m: any) => (
                        <div key={m.id} className={`p-3 rounded-lg border ${m.flagged ? "border-amber-300 bg-amber-50" : ""}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PARTY_COLORS[m.fromParent as keyof typeof PARTY_COLORS]}`}>{m.fromParent === "PARENT1" ? "Client" : "Opposing"}</span>
                              {m.subject && <span className="text-sm font-medium">{m.subject}</span>}
                              <span className="text-xs text-slate-400">{new Date(m.sentAt).toLocaleString()}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => flagMsgMut.mutate({ messageId: m.id, flagged: !m.flagged, flagReason: m.flagged ? undefined : "Flagged for review" })}>
                              {m.flagged ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <StarOff className="h-4 w-4 text-slate-300" />}
                            </Button>
                          </div>
                          <p className="text-sm">{m.body}</p>
                          {m.flagReason && <p className="text-xs text-amber-600 mt-1">Flag: {m.flagReason}</p>}
                        </div>
                      ))}
                      {!messages?.length && <p className="text-slate-500 text-center py-4">No messages imported</p>}
                    </div>
                  </CardContent></Card>
                </TabsContent>

                {/* Journal */}
                <TabsContent value="journal" className="space-y-4">
                  <Card><CardContent className="pt-4">
                    <div className="space-y-3">
                      {(journal || []).slice(0, 30).map((j: any) => (
                        <div key={j.id} className={`p-3 rounded-lg border ${j.flagged ? "border-amber-300 bg-amber-50" : ""}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PARTY_COLORS[j.author as keyof typeof PARTY_COLORS]}`}>{j.author === "PARENT1" ? "Client" : "Opposing"}</span>
                              <span className="text-xs text-slate-400">{new Date(j.entryDate).toLocaleDateString()}</span>
                              {j.category && <Badge variant="secondary" className="text-xs">{j.category}</Badge>}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => flagJrnMut.mutate({ entryId: j.id, flagged: !j.flagged })}>
                              {j.flagged ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <StarOff className="h-4 w-4 text-slate-300" />}
                            </Button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{j.content}</p>
                        </div>
                      ))}
                      {!journal?.length && <p className="text-slate-500 text-center py-4">No journal entries imported</p>}
                    </div>
                  </CardContent></Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Connect Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connect OurFamilyWizard</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>OFW Family ID</Label><Input value={ofwFamilyId} onChange={(e) => setOfwFamilyId(e.target.value)} placeholder="Enter the Family ID from OFW" /></div>
            <p className="text-xs text-slate-500">Find this in your OFW Professional Account under the family's profile.</p>
            <Button className="w-full" disabled={!ofwFamilyId || !fc?.id || connectMut.isLoading} onClick={() => connectMut.mutate({ familyCaseId: fc!.id, ofwFamilyId })}>
              {connectMut.isLoading ? "Connecting..." : "Link Family & Sync"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
