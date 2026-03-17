"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Video, Mic, FileText, CheckCircle, ExternalLink, Search, Plus } from "lucide-react";

function fmtDuration(min: number) { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

const STATUS_COLORS: Record<string, string> = { WAITING: "bg-blue-100 text-blue-700", STARTED: "bg-green-100 text-green-700", ENDED: "bg-gray-100 text-gray-700", CANCELLED: "bg-red-100 text-red-700" };

export default function MeetingsPage() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: meetings, isLoading } = trpc.zoom["meetings.list"].useQuery({
    status: status !== "all" ? status as any : undefined,
    search: search || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">All Meetings</h1><p className="text-sm text-slate-500">Manage and review Zoom meetings</p></div>
        <Link href="/zoom/schedule"><Button><Plus className="h-4 w-4 mr-2" /> Schedule Meeting</Button></Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search meetings..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="WAITING">Upcoming</SelectItem>
            <SelectItem value="STARTED">Live</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-gray-500">Date/Time</th>
                  <th className="pb-2 font-medium text-gray-500">Topic</th>
                  <th className="pb-2 font-medium text-gray-500">Matter</th>
                  <th className="pb-2 font-medium text-gray-500">Duration</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Participants</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Status</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Media</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {(meetings || []).map((m: any) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 text-gray-600">{new Date(m.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-3"><Link href={`/zoom/meetings/${m.id}`} className="font-medium text-blue-600 hover:underline">{m.topic}</Link></td>
                    <td className="py-3 text-gray-600">{m.matter?.name || "-"}</td>
                    <td className="py-3">{fmtDuration(m.actualDuration || m.scheduledDuration)}</td>
                    <td className="py-3 text-center">{m.participantCount}</td>
                    <td className="py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>{m.status}</span></td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {m.hasRecording && <Mic className="h-3.5 w-3.5 text-red-400" />}
                        {m.hasTranscript && <FileText className="h-3.5 w-3.5 text-blue-400" />}
                        {m.aiSummary && <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                      </div>
                    </td>
                    <td className="py-3">
                      {m.status === "WAITING" && <Button size="sm" variant="ghost" onClick={() => window.open(m.joinUrl, "_blank")}><ExternalLink className="h-3 w-3" /></Button>}
                    </td>
                  </tr>
                ))}
                {(!meetings || meetings.length === 0) && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">No meetings found.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
