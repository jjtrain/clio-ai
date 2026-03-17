"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { CalendarDays, Clock, RefreshCw, Settings, CheckCircle, XCircle, AlertTriangle, Users } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { SCHEDULED: "bg-blue-100 text-blue-700", CONFIRMED: "bg-green-100 text-green-700", RESCHEDULED: "bg-amber-100 text-amber-700", CANCELLED: "bg-gray-100 text-gray-700", NO_SHOW: "bg-red-100 text-red-700", COMPLETED: "bg-green-100 text-green-700" };
const PROVIDER_COLORS: Record<string, string> = { APPTOTO: "bg-blue-100 text-blue-700", ATTORNIFY: "bg-purple-100 text-purple-700", LAWTAP: "bg-teal-100 text-teal-700", CALENDLY: "bg-indigo-100 text-indigo-700" };

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function SchedulingDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("bookings");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: stats } = trpc.schedulingExt.getDashboardStats.useQuery();
  const { data: bookings } = trpc.schedulingExt["bookings.list"].useQuery({
    provider: providerFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: eventTypes } = trpc.schedulingExt["eventTypes.list"].useQuery();
  const { data: widgets } = trpc.schedulingExt["widgets.list"].useQuery();

  const syncMut = trpc.schedulingExt["bookings.sync"].useMutation({
    onSuccess: (d) => { utils.schedulingExt["bookings.list"].invalidate(); toast({ title: `Synced ${d.synced} bookings` }); },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });
  const cancelMut = trpc.schedulingExt["bookings.cancel"].useMutation({
    onSuccess: () => { utils.schedulingExt["bookings.list"].invalidate(); toast({ title: "Cancelled" }); },
  });
  const completeMut = trpc.schedulingExt["bookings.markCompleted"].useMutation({
    onSuccess: () => { utils.schedulingExt["bookings.list"].invalidate(); toast({ title: "Completed" }); },
  });
  const noShowMut = trpc.schedulingExt["bookings.markNoShow"].useMutation({
    onSuccess: () => { utils.schedulingExt["bookings.list"].invalidate(); toast({ title: "Marked no-show" }); },
  });
  const syncTypesMut = trpc.schedulingExt["eventTypes.sync"].useMutation({
    onSuccess: (d) => { utils.schedulingExt["eventTypes.list"].invalidate(); toast({ title: `Synced ${d.synced} event types` }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Scheduling</h1><p className="text-sm text-slate-500">Unified booking management across Apptoto, Attornify, LawTap, and Calendly</p></div>
        <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-blue-200"><CardContent className="pt-4"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Today</p></div><p className="text-xl font-bold">{stats?.todayBookings ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">This Week</p><p className="text-xl font-bold">{stats?.weekBookings ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500">Pending Reminders</p></div><p className="text-xl font-bold">{stats?.pendingReminders ?? 0}</p></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4"><p className="text-xs text-slate-500">No-Shows</p><p className="text-xl font-bold text-red-600">{stats?.noShows ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Event Types</p><p className="text-xl font-bold">{stats?.eventTypes ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Providers</p><p className="text-xl font-bold">{stats?.providers ?? 0}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="eventTypes">Event Types</TabsTrigger>
          <TabsTrigger value="widgets">Booking Links</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4">
          <div className="flex gap-2">
            <Select value={providerFilter || "__all__"} onValueChange={(v) => setProviderFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All providers" /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">All</SelectItem>{["APPTOTO","ATTORNIFY","LAWTAP","CALENDLY"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">All</SelectItem>{["SCHEDULED","CONFIRMED","CANCELLED","NO_SHOW","COMPLETED"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
            </Select>
            {providerFilter && (
              <Button variant="outline" onClick={() => syncMut.mutate({ provider: providerFilter as any })} disabled={syncMut.isLoading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Sync
              </Button>
            )}
          </div>

          <Card><CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date/Time</TableHead><TableHead>Provider</TableHead><TableHead>Event</TableHead><TableHead>Booker</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(bookings || []).map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{new Date(b.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PROVIDER_COLORS[b.provider] || "bg-gray-100"}`}>{fmt(b.provider)}</span></TableCell>
                      <TableCell className="font-medium">{b.eventName}</TableCell>
                      <TableCell>
                        <div><p className="text-sm">{b.bookerName}</p><p className="text-xs text-slate-500">{b.bookerEmail}</p></div>
                      </TableCell>
                      <TableCell>{b.duration}m</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[b.status] || ""}`}>{fmt(b.status)}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.status === "SCHEDULED" && <Button variant="ghost" size="sm" onClick={() => completeMut.mutate({ id: b.id })}><CheckCircle className="h-3 w-3 text-green-500" /></Button>}
                          {b.status === "SCHEDULED" && <Button variant="ghost" size="sm" onClick={() => noShowMut.mutate({ id: b.id })}><AlertTriangle className="h-3 w-3 text-amber-500" /></Button>}
                          {b.status !== "CANCELLED" && <Button variant="ghost" size="sm" onClick={() => cancelMut.mutate({ id: b.id })}><XCircle className="h-3 w-3 text-red-500" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!bookings?.length && <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No bookings. Sync from a provider or wait for incoming bookings.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="eventTypes" className="space-y-4">
          <div className="flex gap-2">
            {["ATTORNIFY", "LAWTAP", "CALENDLY"].map((p) => (
              <Button key={p} variant="outline" size="sm" onClick={() => syncTypesMut.mutate({ provider: p as any })} disabled={syncTypesMut.isLoading}>
                <RefreshCw className="h-3 w-3 mr-1" /> Sync {fmt(p)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(eventTypes || []).map((et: any) => (
              <Card key={et.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PROVIDER_COLORS[et.provider] || ""}`}>{fmt(et.provider)}</span>
                    <p className="font-medium">{et.name}</p>
                  </div>
                  <div className="text-sm text-slate-500 space-y-0.5">
                    <p>{et.duration} minutes — {fmt(et.locationType)}</p>
                    {et.price && <p>${Number(et.price).toFixed(2)}</p>}
                    {et.bookingUrl && <a href={et.bookingUrl} target="_blank" className="text-blue-600 text-xs hover:underline">Booking Link</a>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!eventTypes?.length && <p className="text-slate-500 col-span-3 text-center py-8">No event types synced. Click a sync button above.</p>}
          </div>
        </TabsContent>

        <TabsContent value="widgets">
          <div className="space-y-3">
            {(widgets || []).map((w: any) => (
              <Card key={w.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="text-xs text-slate-500">{w.widgetType} — {w.bookingUrl}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>Views: {w.viewCount} | Bookings: {w.bookingCount}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!widgets?.length && <p className="text-slate-500 text-center py-8">No booking widgets configured</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
