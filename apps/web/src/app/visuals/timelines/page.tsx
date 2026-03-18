"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, GanttChart, Plus, ArrowRight } from "lucide-react";

const TYPE_COLORS: Record<string, string> = { CASE_CHRONOLOGY: "bg-blue-100 text-blue-700", MEDICAL_TREATMENT: "bg-red-100 text-red-700", DISCOVERY: "bg-purple-100 text-purple-700", LITIGATION: "bg-amber-100 text-amber-700", INCIDENT: "bg-orange-100 text-orange-700", CUSTOM: "bg-gray-100 text-gray-700" };
const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-blue-100 text-blue-700", FINAL: "bg-emerald-100 text-emerald-700", SHARED: "bg-purple-100 text-purple-700", ARCHIVED: "bg-gray-100 text-gray-500" };

export default function TimelinesPage() {
  const { data: timelines, isLoading } = trpc.visuals["timelines.list"].useQuery({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Case Timelines</h1><p className="text-sm text-slate-500">Visual chronologies for your cases</p></div>
        <div className="flex gap-2"><Link href="/visuals/timelines/new"><Button><Plus className="h-4 w-4 mr-2" /> Build Timeline</Button></Link></div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(timelines || []).map((t: any) => (
            <Link key={t.id} href={`/visuals/timelines/${t.id}`}>
              <Card className="hover:border-blue-300 transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t.timelineType]}`}>{t.timelineType.replace(/_/g, " ")}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  </div>
                  <p className="font-medium mb-1">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.matter?.name}</p>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>{t.eventCount} events</span>
                    {t.dateRangeStart && t.dateRangeEnd && <span>{new Date(t.dateRangeStart).toLocaleDateString()} — {new Date(t.dateRangeEnd).toLocaleDateString()}</span>}
                    {t.provider && <span className="bg-gray-100 px-2 py-0.5 rounded">{t.provider}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!timelines || timelines.length === 0) && <Card className="col-span-full"><CardContent className="py-12 text-center text-gray-400"><GanttChart className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No timelines yet. Click "Build Timeline" to create one from your case data.</p></CardContent></Card>}
        </div>
      )}
    </div>
  );
}
