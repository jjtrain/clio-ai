"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, GanttChart, Users, Presentation, Calendar, Plus, ArrowRight } from "lucide-react";

const TYPE_COLORS: Record<string, string> = { CASE_CHRONOLOGY: "bg-blue-100 text-blue-700", MEDICAL_TREATMENT: "bg-red-100 text-red-700", DISCOVERY: "bg-purple-100 text-purple-700", LITIGATION: "bg-amber-100 text-amber-700", INCIDENT: "bg-orange-100 text-orange-700", CUSTOM: "bg-gray-100 text-gray-700" };
const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-blue-100 text-blue-700", FINAL: "bg-emerald-100 text-emerald-700", SHARED: "bg-purple-100 text-purple-700", ARCHIVED: "bg-gray-100 text-gray-500", SETUP: "bg-amber-100 text-amber-700", COMPLETED: "bg-emerald-100 text-emerald-700" };

export default function VisualsDashboard() {
  const { data: timelines } = trpc.visuals["timelines.list"].useQuery({});
  const { data: depositions } = trpc.visuals["deposition.list"].useQuery({});
  const { data: presentations } = trpc.visuals["presentations.list"].useQuery({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Timelines & Visuals</h1><p className="text-sm text-slate-500">Case timelines, depositions, and courtroom presentations</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6 text-center"><GanttChart className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{(timelines || []).length}</p><p className="text-xs text-gray-500">Timelines</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Calendar className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{(depositions || []).filter((d: any) => d.status === "SETUP").length}</p><p className="text-xs text-gray-500">Upcoming Depos</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Users className="h-6 w-6 mx-auto mb-1 text-green-500" /><p className="text-2xl font-bold">{(depositions || []).reduce((s: number, d: any) => s + d.exhibitCount, 0)}</p><p className="text-xs text-gray-500">Exhibits</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Presentation className="h-6 w-6 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">{(presentations || []).length}</p><p className="text-xs text-gray-500">Presentations</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><GanttChart className="h-6 w-6 mx-auto mb-1 text-teal-500" /><p className="text-2xl font-bold">{(timelines || []).reduce((s: number, t: any) => s + t.eventCount, 0)}</p><p className="text-xs text-gray-500">Events</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Timelines</CardTitle><Link href="/visuals/timelines/new"><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Build</Button></Link></div></CardHeader>
          <CardContent className="space-y-2">
            {(timelines || []).slice(0, 5).map((t: any) => (
              <Link key={t.id} href={`/visuals/timelines/${t.id}`}><div className="flex items-center justify-between p-2 rounded hover:bg-gray-50"><div><p className="text-sm font-medium">{t.title}</p><p className="text-xs text-gray-500">{t.matter?.name} · {t.eventCount} events</p></div><div className="flex gap-1"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t.timelineType] || ""}`}>{t.timelineType.replace(/_/g, " ")}</span></div></div></Link>
            ))}
            {(!timelines || timelines.length === 0) && <p className="text-center text-gray-400 py-4">No timelines yet.</p>}
            <Link href="/visuals/timelines" className="text-xs text-blue-600 hover:underline block text-right">View All</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Depositions</CardTitle><Link href="/visuals/depositions/prepare"><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Prepare</Button></Link></div></CardHeader>
          <CardContent className="space-y-2">
            {(depositions || []).slice(0, 5).map((d: any) => (
              <Link key={d.id} href={`/visuals/depositions/${d.id}`}><div className="flex items-center justify-between p-2 rounded hover:bg-gray-50"><div><p className="text-sm font-medium">{d.deponentName}</p><p className="text-xs text-gray-500">{d.matter?.name} · {new Date(d.depositionDate).toLocaleDateString()} · {d.exhibitCount} exhibits</p></div><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status]}`}>{d.status}</span></div></Link>
            ))}
            {(!depositions || depositions.length === 0) && <p className="text-center text-gray-400 py-4">No depositions.</p>}
            <Link href="/visuals/depositions" className="text-xs text-blue-600 hover:underline block text-right">View All</Link>
          </CardContent>
        </Card>
      </div>

      {(presentations || []).length > 0 && (
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Presentations</CardTitle><Link href="/visuals/presentations"><Button size="sm" variant="outline">View All</Button></Link></div></CardHeader>
          <CardContent className="space-y-2">
            {(presentations || []).slice(0, 3).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2"><div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-gray-500">{p.slideCount} slides · {p.boardType}</p></div><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status}</span></div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
