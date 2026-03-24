"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Video, Clock, Users, ExternalLink, Calendar, Plus, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

const PROVIDER_ICONS: Record<string, { label: string; color: string }> = {
  ZOOM: { label: "Zoom", color: "bg-blue-500" },
  TEAMS: { label: "Teams", color: "bg-violet-500" },
};

export default function MeetingsPage() {
  const [filter, setFilter] = useState("all");
  const [showSchedule, setShowSchedule] = useState(false);

  const upcomingQuery = trpc.meetingsUnified.getUpcomingMeetings.useQuery({ limit: 20 });
  const allQuery = trpc.meetingsUnified.listMeetings.useQuery({ limit: 30 });
  const connectionQuery = trpc.meetingsUnified.getConnectionStatus.useQuery();

  const upcoming = upcomingQuery.data || [];
  const all = allQuery.data || [];
  const conn = connectionQuery.data;

  // Schedule form state
  const [formTitle, setFormTitle] = useState("");
  const [formProvider, setFormProvider] = useState<"ZOOM" | "TEAMS">("ZOOM");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formDuration, setFormDuration] = useState("30");
  const [formAttendees, setFormAttendees] = useState("");
  const [formAgenda, setFormAgenda] = useState("");

  const scheduleMut = trpc.meetingsUnified.scheduleMeeting.useMutation({
    onSuccess: () => { upcomingQuery.refetch(); allQuery.refetch(); setShowSchedule(false); },
  });
  const cancelMut = trpc.meetingsUnified.cancelMeeting.useMutation({
    onSuccess: () => { upcomingQuery.refetch(); allQuery.refetch(); },
  });

  function handleSchedule() {
    if (!formTitle || !formDate) return;
    scheduleMut.mutate({
      provider: formProvider,
      title: formTitle,
      agenda: formAgenda || undefined,
      scheduledAt: new Date(`${formDate}T${formTime}`).toISOString(),
      durationMinutes: Number(formDuration),
      attendeeEmails: formAttendees.split(",").map((e) => e.trim()).filter(Boolean),
      sendInviteEmail: true,
      createCalendarEvent: true,
    });
  }

  const past = all.filter((m: any) => m.status === "COMPLETED" || m.status === "CANCELLED");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Video className="h-7 w-7 text-blue-600" /> Meetings
          </h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and manage Zoom & Teams meetings</p>
        </div>
        <Button onClick={() => setShowSchedule(!showSchedule)} className="gap-2">
          <Plus className="h-4 w-4" /> Schedule Meeting
        </Button>
      </div>

      {/* Connection Status */}
      {conn && !conn.zoom && !conn.teams && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-700">No video provider connected. <a href="/settings/meetings" className="underline font-medium">Connect Zoom or Teams</a> to schedule meetings.</p>
        </Card>
      )}

      {/* Schedule Form */}
      {showSchedule && (
        <Card className="p-5 border-blue-200 bg-blue-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-800">Schedule New Meeting</h3>
            <button onClick={() => setShowSchedule(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Meeting title *" className="h-9 text-sm" />
            <Select value={formProvider} onValueChange={(v: any) => setFormProvider(v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ZOOM" disabled={!conn?.zoom}>Zoom {!conn?.zoom && "(not connected)"}</SelectItem>
                <SelectItem value="TEAMS" disabled={!conn?.teams}>Teams {!conn?.teams && "(not connected)"}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-9 text-sm" />
            <div className="flex gap-2">
              <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="h-9 text-sm flex-1" />
              <Select value={formDuration} onValueChange={setFormDuration}>
                <SelectTrigger className="h-9 text-sm w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90].map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input value={formAttendees} onChange={(e) => setFormAttendees(e.target.value)} placeholder="Attendee emails (comma-separated)" className="h-9 text-sm" />
          <Input value={formAgenda} onChange={(e) => setFormAgenda(e.target.value)} placeholder="Agenda (optional)" className="h-9 text-sm" />
          <Button onClick={handleSchedule} disabled={!formTitle || !formDate || scheduleMut.isLoading}>
            {scheduleMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Video className="h-4 w-4 mr-1" />}
            Schedule
          </Button>
        </Card>
      )}

      {/* Upcoming */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 && (
          <Card className="p-8 text-center"><p className="text-sm text-gray-400">No upcoming meetings</p></Card>
        )}
        <div className="space-y-2">
          {upcoming.map((m: any) => {
            const pi = PROVIDER_ICONS[m.provider] || PROVIDER_ICONS.ZOOM;
            return (
              <Card key={m.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold", pi.color)}>
                    {m.provider === "ZOOM" ? "Z" : "T"}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{m.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(m.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span>{m.durationMinutes}min</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{m.attendees?.length || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px]", STATUS_COLORS[m.status])}>{m.status}</Badge>
                  <a href={m.joinUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1 text-xs"><ExternalLink className="h-3 w-3" /> Join</Button>
                  </a>
                  <Button size="sm" variant="ghost" className="text-xs text-red-500" onClick={() => cancelMut.mutate({ id: m.id })}>Cancel</Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Past Meetings</h2>
          <div className="space-y-2">
            {past.map((m: any) => (
              <Card key={m.id} className="p-3 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-3">
                  <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold", PROVIDER_ICONS[m.provider]?.color || "bg-gray-400")}>
                    {m.provider === "ZOOM" ? "Z" : "T"}
                  </div>
                  <div>
                    <span className="text-sm text-gray-700">{m.title}</span>
                    <span className="text-xs text-gray-400 ml-2">{new Date(m.scheduledAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.actualDurationMins && <span className="text-xs text-gray-400">{m.actualDurationMins}min</span>}
                  {m.recordingUrl && <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer"><Badge className="text-[10px] bg-purple-100 text-purple-700">Recording</Badge></a>}
                  <Badge className={cn("text-[10px]", STATUS_COLORS[m.status])}>{m.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
