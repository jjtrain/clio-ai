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
import { useToast } from "@/components/ui/use-toast";
import { Truck, Mic, MapPin, Clock, FileText, AlertTriangle, Plus, RefreshCw, Settings, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

const JOB_STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-blue-100 text-blue-700", ASSIGNED: "bg-indigo-100 text-indigo-700", IN_PROGRESS: "bg-amber-100 text-amber-700", FIRST_ATTEMPT: "bg-amber-100 text-amber-700", SERVED: "bg-green-100 text-green-700", UNABLE_TO_SERVE: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-700" };
const PRIORITY_COLORS: Record<string, string> = { STANDARD: "bg-blue-100 text-blue-700", RUSH: "bg-amber-100 text-amber-700", SAME_DAY: "bg-orange-100 text-orange-700", EMERGENCY: "bg-red-100 text-red-700" };
const REPORTER_STATUS_COLORS: Record<string, string> = { REQUESTED: "bg-amber-100 text-amber-700", CONFIRMED: "bg-green-100 text-green-700", SCHEDULED: "bg-blue-100 text-blue-700", COMPLETED: "bg-green-100 text-green-700", TRANSCRIPT_READY: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-gray-100 text-gray-700" };

function fmt(s: string) { return s?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || ""; }
function cur(n: number | null | undefined) { return n != null ? "$" + Number(n).toFixed(2) : "—"; }

export default function ProcessServingDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("service");
  const [jobStatusFilter, setJobStatusFilter] = useState("");

  const { data: stats } = trpc.processServing.getDashboardStats.useQuery();
  const { data: jobs } = trpc.processServing["jobs.list"].useQuery({ status: jobStatusFilter || undefined });
  const { data: depositions } = trpc.processServing["reporter.list"].useQuery();

  const trackMut = trpc.processServing["jobs.track"].useMutation({
    onSuccess: () => { utils.processServing["jobs.list"].invalidate(); toast({ title: "Status updated" }); },
  });
  const cancelJobMut = trpc.processServing["jobs.cancel"].useMutation({
    onSuccess: () => { utils.processServing["jobs.list"].invalidate(); toast({ title: "Cancelled" }); },
  });
  const cancelDepoMut = trpc.processServing["reporter.cancel"].useMutation({
    onSuccess: () => { utils.processServing["reporter.list"].invalidate(); toast({ title: "Cancelled" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Service & Court Reporting</h1><p className="text-sm text-slate-500">Process serving via Proof, court reporters via Steno</p></div>
        <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Active Jobs</p></div><p className="text-xl font-bold">{stats?.activeJobs ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Served This Month</p><p className="text-xl font-bold text-green-600">{stats?.servedMonth ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Avg Days to Serve</p><p className="text-xl font-bold">{stats?.avgDaysToServe ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Mic className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Upcoming Depos</p></div><p className="text-xl font-bold">{stats?.upcomingDepos ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Transcripts Pending</p><p className="text-xl font-bold text-amber-600">{stats?.pendingTranscripts ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Costs This Month</p><p className="text-xl font-bold">{cur(stats?.totalCosts)}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="service"><Truck className="h-3 w-3 mr-1" /> Service Jobs</TabsTrigger>
          <TabsTrigger value="reporter"><Mic className="h-3 w-3 mr-1" /> Court Reporter</TabsTrigger>
        </TabsList>

        <TabsContent value="service" className="space-y-4">
          <div className="flex gap-2">
            <Select value={jobStatusFilter || "__all__"} onValueChange={(v) => setJobStatusFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">All</SelectItem>{["DRAFT","SUBMITTED","ASSIGNED","IN_PROGRESS","SERVED","UNABLE_TO_SERVE","CANCELLED"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <Card><CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Recipient</TableHead><TableHead>Address</TableHead><TableHead>Type</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Server</TableHead><TableHead>Due</TableHead><TableHead>Cost</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(jobs || []).map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.recipientName}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">{j.serviceAddress}</TableCell>
                      <TableCell className="text-xs">{fmt(j.jobType)}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[j.priority] || ""}`}>{j.priority}</span></TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${JOB_STATUS_COLORS[j.status] || ""}`}>{fmt(j.status)}</span></TableCell>
                      <TableCell>{j.totalAttempts}</TableCell>
                      <TableCell className="text-xs">{j.assignedServerName || j.serverName || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{j.dueDate ? new Date(j.dueDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{cur(Number(j.totalCost))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {j.trackingUrl && <a href={j.trackingUrl} target="_blank"><Button variant="ghost" size="sm"><MapPin className="h-3 w-3" /></Button></a>}
                          <Button variant="ghost" size="sm" onClick={() => trackMut.mutate({ id: j.id })}><RefreshCw className="h-3 w-3" /></Button>
                          {!["SERVED", "CANCELLED"].includes(j.status) && <Button variant="ghost" size="sm" onClick={() => cancelJobMut.mutate({ id: j.id })}><XCircle className="h-3 w-3 text-red-500" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!jobs?.length && <TableRow><TableCell colSpan={10} className="text-center text-slate-500 py-8">No service jobs</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reporter" className="space-y-4">
          <Card><CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Deponent</TableHead><TableHead>Location</TableHead><TableHead>Reporter</TableHead><TableHead>Status</TableHead><TableHead>Transcript</TableHead><TableHead>Cost</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(depositions || []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">{new Date(d.eventDate).toLocaleDateString()} {d.eventTime || ""}</TableCell>
                      <TableCell className="text-xs">{fmt(d.jobType)}</TableCell>
                      <TableCell className="font-medium">{d.deponentName || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{d.location || fmt(d.locationType)}</TableCell>
                      <TableCell className="text-xs">{d.courtReporterName || "TBD"}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${REPORTER_STATUS_COLORS[d.status] || ""}`}>{fmt(d.status)}</span></TableCell>
                      <TableCell>{d.transcriptStatus ? <span className={`text-xs ${d.transcriptStatus === "FINAL_READY" ? "text-green-600" : "text-amber-600"}`}>{fmt(d.transcriptStatus)}</span> : "—"}</TableCell>
                      <TableCell>{cur(Number(d.totalCost))}</TableCell>
                      <TableCell>
                        {d.transcriptUrl && <a href={d.transcriptUrl} target="_blank"><Button variant="ghost" size="sm"><FileText className="h-3 w-3" /></Button></a>}
                        {!["CANCELLED", "COMPLETED", "TRANSCRIPT_READY"].includes(d.status) && <Button variant="ghost" size="sm" onClick={() => cancelDepoMut.mutate({ id: d.id })}><XCircle className="h-3 w-3 text-red-500" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!depositions?.length && <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No court reporter bookings</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
