"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Users, FileText, RefreshCw, AlertTriangle, CheckCircle, Settings, Link2, Unlink } from "lucide-react";

const PROVIDER_COLORS: Record<string, string> = { LAWMATICS: "bg-blue-100 text-blue-700", LEAD_DOCKET: "bg-green-100 text-green-700", HUBSPOT: "bg-orange-100 text-orange-700", COGNITO_FORMS: "bg-purple-100 text-purple-700", WUFOO: "bg-teal-100 text-teal-700" };
const SYNC_COLORS: Record<string, string> = { SYNCED: "bg-green-100 text-green-700", PENDING: "bg-amber-100 text-amber-700", CONFLICT: "bg-orange-100 text-orange-700", ERROR: "bg-red-100 text-red-700" };
const FORM_STATUS_COLORS: Record<string, string> = { RECEIVED: "bg-blue-100 text-blue-700", PROCESSED: "bg-green-100 text-green-700", MAPPED: "bg-emerald-100 text-emerald-700", ERROR: "bg-red-100 text-red-700", IGNORED: "bg-gray-100 text-gray-700" };

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function CrmPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("overview");
  const [providerFilter, setProviderFilter] = useState("");

  const { data: stats } = trpc.crmIntake.getDashboardStats.useQuery();
  const { data: contacts } = trpc.crmIntake["contacts.list"].useQuery(providerFilter ? { provider: providerFilter as any } : undefined);
  const { data: submissions } = trpc.crmIntake["forms.submissions"].useQuery(providerFilter ? { provider: providerFilter as any } : undefined);
  const { data: syncReport } = trpc.crmIntake["sync.status"].useQuery();

  const syncMut = trpc.crmIntake["sync.run"].useMutation({
    onSuccess: (d) => { utils.crmIntake.invalidate(); toast({ title: `Synced: ${d.created} created, ${d.updated} updated, ${d.errors} errors` }); },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });
  const processForm = trpc.crmIntake["forms.process"].useMutation({
    onSuccess: (d) => { utils.crmIntake["forms.submissions"].invalidate(); toast({ title: d.action === "lead_created" ? "Lead created from submission" : "Submission processed" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">CRM & Intake</h1><p className="text-sm text-slate-500">Manage leads from Lawmatics, Lead Docket, HubSpot, Cognito Forms, and Wufoo</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Contacts Synced</p><p className="text-lg font-bold">{stats?.totalContacts ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Form Submissions</p><p className="text-lg font-bold">{stats?.totalForms ?? 0}</p></CardContent></Card>
        <Card className="border-amber-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Pending Forms</p><p className="text-lg font-bold text-amber-700">{stats?.pendingForms ?? 0}</p></CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Leads Created</p><p className="text-lg font-bold text-green-700">{stats?.leadsCreated ?? 0}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">Sync Errors</p><p className="text-lg font-bold text-red-700">{stats?.syncErrors ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Providers</p><p className="text-lg font-bold">{stats?.enabledProviders ?? 0}</p></CardContent></Card>
      </div>

      {/* Provider Filter + Sync */}
      <div className="flex gap-2">
        <Select value={providerFilter || "__all__"} onValueChange={(v) => setProviderFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All providers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Providers</SelectItem>
            {["LAWMATICS", "LEAD_DOCKET", "HUBSPOT", "COGNITO_FORMS", "WUFOO"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        {providerFilter && (
          <Button variant="outline" onClick={() => syncMut.mutate({ provider: providerFilter as any })} disabled={syncMut.isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" /> {syncMut.isLoading ? "Syncing..." : "Sync Now"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts?.length || 0})</TabsTrigger>
          <TabsTrigger value="forms">Form Submissions ({submissions?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Sync Health</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Contacts</span><strong>{syncReport?.totalContacts ?? 0}</strong></div>
                <div className="flex justify-between"><span>Synced</span><strong className="text-green-600">{syncReport?.synced ?? 0}</strong></div>
                <div className="flex justify-between"><span>Errors</span><strong className="text-red-600">{syncReport?.errors ?? 0}</strong></div>
                <div className="flex justify-between"><span>Forms Received</span><strong>{syncReport?.totalForms ?? 0}</strong></div>
                <div className="flex justify-between"><span>Forms Mapped</span><strong className="text-green-600">{syncReport?.formsMapped ?? 0}</strong></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {["LAWMATICS", "LEAD_DOCKET", "HUBSPOT"].map((p) => (
                  <Button key={p} variant="outline" size="sm" className="w-full justify-start" onClick={() => syncMut.mutate({ provider: p as any })} disabled={syncMut.isLoading}>
                    <RefreshCw className="h-3 w-3 mr-2" /> Sync {fmt(p)}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Provider</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Source</TableHead><TableHead>Sync Status</TableHead><TableHead>Linked To</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(contacts || []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PROVIDER_COLORS[c.provider] || ""}`}>{fmt(c.provider)}</span></TableCell>
                    <TableCell className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell className="text-sm">{c.email || "—"}</TableCell>
                    <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{c.source || "—"}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${SYNC_COLORS[c.syncStatus] || ""}`}>{c.syncStatus}</span></TableCell>
                    <TableCell>
                      {c.clientId ? <Badge variant="default" className="text-[10px]">Client</Badge> : c.leadId ? <Badge variant="secondary" className="text-[10px]">Lead</Badge> : <span className="text-xs text-slate-400">Unlinked</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {!contacts?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No synced contacts. Run a sync to import from your CRM.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Provider</TableHead><TableHead>Form</TableHead><TableHead>Respondent</TableHead><TableHead>Email</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(submissions || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PROVIDER_COLORS[s.provider] || ""}`}>{fmt(s.provider)}</span></TableCell>
                    <TableCell className="font-medium">{s.formName}</TableCell>
                    <TableCell>{s.respondentName || "—"}</TableCell>
                    <TableCell className="text-sm">{s.respondentEmail || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(s.submittedAt).toLocaleString()}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${FORM_STATUS_COLORS[s.processingStatus] || ""}`}>{fmt(s.processingStatus)}</span></TableCell>
                    <TableCell>
                      {s.processingStatus === "RECEIVED" && (
                        <Button variant="ghost" size="sm" onClick={() => processForm.mutate({ submissionId: s.id })} disabled={processForm.isLoading}>Process</Button>
                      )}
                      {s.mappedToLeadId && <Badge variant="success" className="text-[10px]">Lead Created</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {!submissions?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No form submissions yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
