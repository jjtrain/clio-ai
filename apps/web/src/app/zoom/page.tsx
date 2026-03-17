"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Video, Calendar, Loader2, Play, Users, Clock, Mic, FileText,
  ExternalLink, Plus, Radio, AlertTriangle, CheckCircle, Copy,
} from "lucide-react";

function fmtDuration(min: number) { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

export default function ZoomDashboard() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: config } = trpc.zoom["settings.get"].useQuery();
  const { data: upcoming, isLoading: loadingUpcoming } = trpc.zoom["meetings.getUpcoming"].useQuery(undefined, { enabled: !!config?.isEnabled });
  const { data: live } = trpc.zoom["meetings.getLive"].useQuery(undefined, { enabled: !!config?.isEnabled });
  const { data: recent } = trpc.zoom["meetings.list"].useQuery({ status: "ENDED", limit: 5 }, { enabled: !!config?.isEnabled });

  const instantMut = trpc.zoom["meetings.createInstant"].useMutation({
    onSuccess: (data) => { toast({ title: "Meeting created" }); if (data.startUrl) window.open(data.startUrl, "_blank"); utils.zoom["meetings.getLive"].invalidate(); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!config?.isEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Zoom</h1>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto mb-3 text-blue-400" />
            <p className="text-blue-700 font-medium">Zoom is not connected.</p>
            <p className="text-sm text-blue-600 mt-1">Configure Zoom in <Link href="/settings/integrations" className="underline">Settings → Integrations</Link> to enable video conferencing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const todayMeetings = (upcoming || []).filter((m: any) => {
    const d = new Date(m.startTime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const thisWeekMeetings = upcoming || [];
  const recordingsNeeded = (recent || []).filter((m: any) => m.hasRecording && !m.aiSummary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Zoom</h1>
          <p className="text-sm text-slate-500">Video conferencing, recordings, and AI meeting intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => instantMut.mutate({ topic: "Quick Meeting" })} disabled={instantMut.isLoading}>
            <Play className="h-4 w-4 mr-2" /> Start Instant Meeting
          </Button>
          <Link href="/zoom/schedule"><Button><Plus className="h-4 w-4 mr-2" /> Schedule Meeting</Button></Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{todayMeetings.length}</p>
            <p className="text-xs text-gray-500">Today</p>
          </CardContent>
        </Card>
        <Card className={live && live.length > 0 ? "border-green-400 bg-green-50" : ""}>
          <CardContent className="pt-6 text-center">
            <Radio className={`h-6 w-6 mx-auto mb-1 ${live && live.length > 0 ? "text-green-500 animate-pulse" : "text-gray-400"}`} />
            <p className="text-2xl font-bold">{live?.length || 0}</p>
            <p className="text-xs text-gray-500">Live Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Video className="h-6 w-6 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{thisWeekMeetings.length}</p>
            <p className="text-xs text-gray-500">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-6 w-6 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{((recent || []).reduce((s: number, m: any) => s + (m.actualDuration || m.scheduledDuration || 0), 0) / 60).toFixed(1)}</p>
            <p className="text-xs text-gray-500">Hours (Recent)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Mic className="h-6 w-6 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold">{recordingsNeeded.length}</p>
            <p className="text-xs text-gray-500">Needs Review</p>
          </CardContent>
        </Card>
      </div>

      {/* Live Meetings */}
      {live && live.length > 0 && (
        <Card className="border-green-300">
          <CardHeader><CardTitle className="text-sm text-green-700">Live Meetings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {live.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Radio className="h-4 w-4 text-green-500 animate-pulse" />
                  <div>
                    <p className="font-medium text-sm">{m.topic}</p>
                    <p className="text-xs text-gray-500">{m.matter?.name || ""} · {m.participantCount} participants</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.open(m.joinUrl, "_blank")}><ExternalLink className="h-3 w-3 mr-1" /> Join</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Today's Schedule</CardTitle></CardHeader>
        <CardContent>
          {loadingUpcoming ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-4" /> : todayMeetings.length > 0 ? (
            <div className="space-y-2">
              {todayMeetings.map((m: any) => {
                const time = new Date(m.startTime);
                const isNow = new Date() >= time && m.status === "WAITING";
                return (
                  <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border ${isNow ? "border-blue-300 bg-blue-50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className="text-center w-14">
                        <p className="text-sm font-bold">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        <p className="text-xs text-gray-400">{fmtDuration(m.scheduledDuration)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.topic}</p>
                        <p className="text-xs text-gray-500">{m.matter?.name || ""} {m.client?.name ? `· ${m.client.name}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "STARTED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{m.status === "STARTED" ? "Live" : "Upcoming"}</span>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(m.joinUrl); toast({ title: "Join link copied" }); }}><Copy className="h-3 w-3" /></Button>
                      <Button size="sm" onClick={() => window.open(m.joinUrl, "_blank")}><ExternalLink className="h-3 w-3 mr-1" /> Join</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4">No meetings scheduled for today.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Meetings with Summaries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Recent Meetings</CardTitle>
            <Link href="/zoom/meetings" className="text-xs text-blue-600 hover:underline">View All</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(recent || []).map((m: any) => (
            <Link key={m.id} href={`/zoom/meetings/${m.id}`} className="block">
              <div className="p-3 rounded-lg border hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{m.topic}</p>
                  <div className="flex items-center gap-1">
                    {m.hasRecording && <Mic className="h-3.5 w-3.5 text-red-400" />}
                    {m.hasTranscript && <FileText className="h-3.5 w-3.5 text-blue-400" />}
                    {m.aiSummary && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{new Date(m.startTime).toLocaleDateString()}</span>
                  <span>{fmtDuration(m.actualDuration || m.scheduledDuration)}</span>
                  {m.matter && <span>{m.matter.name}</span>}
                  <span>{m.participantCount} participants</span>
                </div>
                {m.aiSummary && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{m.aiSummary.slice(0, 200)}</p>}
              </div>
            </Link>
          ))}
          {(!recent || recent.length === 0) && <p className="text-center text-gray-400 py-4">No recent meetings.</p>}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { name: "All Meetings", href: "/zoom/meetings", icon: Video },
          { name: "Recordings", href: "/zoom/recordings", icon: Mic },
          { name: "Templates", href: "/zoom/templates", icon: FileText },
          { name: "Reports", href: "/zoom/reports", icon: Clock },
        ].map((link) => (
          <Link key={link.name} href={link.href}>
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="pt-6 text-center">
                <link.icon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="text-sm font-medium">{link.name}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
