"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Clock, Users, Mic, FileText, CheckCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"];
function fmtHours(h: number) { return `${h.toFixed(1)}h`; }

export default function ZoomReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);

  const { data: stats, isLoading } = trpc.zoom["reports.stats"].useQuery({ from, to });
  const { data: byMatter } = trpc.zoom["reports.byMatter"].useQuery({ from, to });
  const { data: byParticipant } = trpc.zoom["reports.byParticipant"].useQuery({ from, to });
  const { data: timeData } = trpc.zoom["reports.timeLogged"].useQuery({ from, to });
  const { data: storage } = trpc.zoom["reports.recordingStorage"].useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Meeting Reports</h1><p className="text-sm text-slate-500">Analytics and insights from your Zoom meetings</p></div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center"><Video className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{stats.totalMeetings}</p><p className="text-xs text-gray-500">Total Meetings</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><Clock className="h-6 w-6 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">{fmtHours(stats.totalHours)}</p><p className="text-xs text-gray-500">Total Hours</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><Users className="h-6 w-6 mx-auto mb-1 text-green-500" /><p className="text-2xl font-bold">{stats.avgParticipants}</p><p className="text-xs text-gray-500">Avg Participants</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><Clock className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{stats.avgDuration}m</p><p className="text-xs text-gray-500">Avg Duration</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 text-center"><Mic className="h-5 w-5 mx-auto mb-1 text-red-500" /><p className="text-xl font-bold">{stats.recordingRate}%</p><p className="text-xs text-gray-500">Recording Rate</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><FileText className="h-5 w-5 mx-auto mb-1 text-blue-500" /><p className="text-xl font-bold">{stats.transcriptRate}%</p><p className="text-xs text-gray-500">Transcript Rate</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" /><p className="text-xl font-bold">{stats.summaryRate}%</p><p className="text-xs text-gray-500">Summary Rate</p></CardContent></Card>
          </div>

          {/* By Matter Chart */}
          {byMatter && byMatter.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Meetings by Matter</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byMatter.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis />
                    <Tooltip /><Legend />
                    <Bar dataKey="count" fill="#3B82F6" name="Meetings" />
                    <Bar dataKey="hours" fill="#10B981" name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Time Analysis */}
          {timeData && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Time Analysis</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center"><p className="text-lg font-bold">{fmtHours(timeData.totalMeetingMinutes / 60)}</p><p className="text-xs text-gray-500">Total Meeting Time</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-green-600">{fmtHours(timeData.loggedMinutes / 60)}</p><p className="text-xs text-gray-500">Time Logged</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-red-600">{fmtHours(timeData.unloggedMinutes / 60)}</p><p className="text-xs text-gray-500">Unlogged Time</p></div>
                  <div className="text-center"><p className="text-lg font-bold">{timeData.meetingsWithoutTimeEntry}</p><p className="text-xs text-gray-500">Meetings Without Time</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Participants */}
          {byParticipant && byParticipant.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Top Participants</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="pb-2 text-left font-medium text-gray-500">Name</th><th className="pb-2 text-left font-medium text-gray-500">Email</th><th className="pb-2 text-right font-medium text-gray-500">Meetings</th><th className="pb-2 text-right font-medium text-gray-500">Total Time</th></tr></thead>
                  <tbody>
                    {byParticipant.slice(0, 15).map((p: any, i: number) => (
                      <tr key={i} className="border-b last:border-0"><td className="py-2">{p.name}</td><td className="py-2 text-gray-500">{p.email}</td><td className="py-2 text-right">{p.meetings}</td><td className="py-2 text-right">{fmtHours(p.totalMinutes / 60)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
