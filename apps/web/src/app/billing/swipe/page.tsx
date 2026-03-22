"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Video, Mail, Mic, Calendar, MessageSquare, Clock, Zap, DollarSign, TrendingUp, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  PHONE_CALL: <Phone className="h-4 w-4" />, VIDEO_CALL: <Video className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />, VOICE_NOTE: <Mic className="h-4 w-4" />,
  CALENDAR: <Calendar className="h-4 w-4" />, SMS: <MessageSquare className="h-4 w-4" />,
};
const EVENT_COLORS: Record<string, string> = {
  PHONE_CALL: "border-l-green-500", VIDEO_CALL: "border-l-blue-500", EMAIL: "border-l-gray-400",
  VOICE_NOTE: "border-l-purple-500", CALENDAR: "border-l-amber-500", SMS: "border-l-teal-500",
};
const CONFIDENCE_COLORS: Record<string, string> = { HIGH: "bg-green-100 text-green-800", MEDIUM: "bg-amber-100 text-amber-800", LOW: "bg-red-100 text-red-800" };
const STATUS_COLORS: Record<string, string> = { BILLED: "bg-green-100 text-green-800", DISMISSED: "bg-red-100 text-red-800", EXPIRED: "bg-gray-100 text-gray-800", SNOOZED: "bg-amber-100 text-amber-800" };

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? "s" : ""} ago`;
}

function formatDuration(seconds: number, type: string) {
  const mins = Math.round(seconds / 60);
  const label = type === "PHONE_CALL" ? "call" : type === "VIDEO_CALL" ? "meeting" : "event";
  return `${mins} min ${label}`;
}

export default function SwipeToBillPage() {
  const stats = trpc.swipeToBill["stats"].useQuery({ userId: "current-user" });
  const pending = trpc.swipeToBill["pending"].useQuery({ userId: "current-user" });
  const [historyPage] = useState(1);
  const history = trpc.swipeToBill["history"].useQuery({ page: historyPage });

  const billQuick = trpc.swipeToBill["billQuick"].useMutation({
    onSuccess: () => { pending.refetch(); stats.refetch(); },
  });
  const dismiss = trpc.swipeToBill["dismiss"].useMutation({
    onSuccess: () => { pending.refetch(); stats.refetch(); },
  });
  const snooze = trpc.swipeToBill["snooze"].useMutation({
    onSuccess: () => { pending.refetch(); stats.refetch(); },
  });
  const billAll = trpc.swipeToBill["billAll"].useMutation({
    onSuccess: () => { pending.refetch(); stats.refetch(); },
  });

  const s: any = stats.data || {};
  const statCards = [
    { label: "Pending Events", value: s.pending ?? 0, icon: <AlertCircle className="h-5 w-5 text-amber-500" />, warn: (s.pending ?? 0) > 5 },
    { label: "Billed Today", value: `${s.billed ?? 0} billed`, icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
    { label: "Capture Rate", value: `${Math.round((s.captureRate ?? 0) * 100)}%`, icon: <TrendingUp className="h-5 w-5 text-blue-500" /> },
    { label: "Total Events", value: s.total ?? 0, icon: <DollarSign className="h-5 w-5 text-emerald-500" /> },
  ];

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">Swipe to Bill</h1>
        <p className="text-muted-foreground">Capture every billable moment — auto-detected events ready to log</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              {c.icon}
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className={`text-xl font-semibold ${c.warn ? "text-amber-600" : ""}`}>{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pending Events</h2>
        <Button size="sm" onClick={() => billAll.mutate({})} disabled={billAll.isPending || !pending.data?.length}>
          <Zap className="mr-1 h-4 w-4" /> Bill All
        </Button>
      </div>

      <div className="space-y-3">
        {pending.data?.map((evt: any) => (
          <Card key={evt.id} className={`border-l-4 ${EVENT_COLORS[evt.eventType] ?? "border-l-gray-300"}`}>
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {EVENT_ICONS[evt.eventType]}
                  <Badge variant="outline" className="text-xs">{evt.source}</Badge>
                  <span className="font-semibold">{evt.contactName}</span>
                  {evt.contactRole && <Badge variant="secondary" className="text-xs">{evt.contactRole}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{evt.matterName ?? <span className="text-muted-foreground">Unknown Matter <a className="text-blue-600 underline" href="#">Assign</a></span>}</span>
                  <span className="text-muted-foreground">{formatDuration(evt.durationSeconds, evt.eventType)}</span>
                </div>
                <p className="text-sm text-blue-700">&rarr; {evt.suggestedHours} hrs &mdash; {evt.suggestedActivityCode}</p>
                {evt.narrative && <p className="truncate text-sm text-muted-foreground">{evt.narrative}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {timeAgo(evt.detectedAt)}
                  {evt.matchConfidence && <Badge className={`text-xs ${CONFIDENCE_COLORS[evt.matchConfidence]}`}>{evt.matchConfidence}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => billQuick.mutate({ eventId: evt.id })} disabled={billQuick.isPending}>Bill</Button>
                <Button size="sm" variant="outline" onClick={() => window.location.assign(`/billing/swipe/${evt.id}/edit`)}>Edit &amp; Bill</Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => { const r = window.prompt("Dismiss reason?"); if (r) dismiss.mutate({ eventId: evt.id, reason: r }); }}>Dismiss</Button>
                <Button size="sm" variant="ghost" onClick={() => snooze.mutate({ eventId: evt.id })}>Snooze</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {pending.data?.length === 0 && <p className="py-8 text-center text-muted-foreground">No pending events. You&apos;re all caught up!</p>}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {(history.data as any[] ?? []).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-32 shrink-0 text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
                <Badge variant="outline" className="text-xs">{item.eventType}</Badge>
                <span className="truncate">{item.contactName}</span>
                <span className="truncate text-muted-foreground">{item.matterName}</span>
                <Badge className={`ml-auto text-xs ${STATUS_COLORS[item.status] ?? ""}`}>{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
