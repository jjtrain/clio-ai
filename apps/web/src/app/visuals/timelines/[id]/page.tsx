"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, GanttChart, Sparkles, AlertTriangle, Download, Share2, Plus, RefreshCw } from "lucide-react";

const CAT_COLORS: Record<string, string> = { INCIDENT: "#EF4444", MEDICAL: "#EC4899", LEGAL_FILING: "#3B82F6", DISCOVERY: "#8B5CF6", DEPOSITION: "#6366F1", HEARING: "#F59E0B", CONFERENCE: "#10B981", MOTION: "#06B6D4", ORDER: "#14B8A6", TRIAL: "#DC2626", SETTLEMENT: "#22C55E", COMMUNICATION: "#64748B", DOCUMENT: "#78716C", OTHER: "#9CA3AF" };
const SIG_SIZE: Record<string, string> = { LOW: "w-3 h-3", MEDIUM: "w-4 h-4", HIGH: "w-5 h-5", CRITICAL: "w-6 h-6" };

export default function TimelineViewerPage() {
  const { id } = useParams() as { id: string };
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: timeline, isLoading } = trpc.visuals["timelines.get"].useQuery({ id });
  const summaryMut = trpc.visuals["timelines.generateSummary"].useMutation({ onSuccess: () => { utils.visuals["timelines.get"].invalidate({ id }); toast({ title: "Summary generated" }); } });
  const patternsMut = trpc.visuals["timelines.detectPatterns"].useMutation({ onSuccess: (data: any) => toast({ title: `${data?.length || 0} patterns detected` }) });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!timeline) return <p className="text-center py-12 text-gray-400">Timeline not found.</p>;

  const events = timeline.events || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{timeline.title}</h1>
          <div className="flex gap-3 text-sm text-gray-500 mt-1">
            <Link href={`/matters/${timeline.matterId}`} className="text-blue-600 hover:underline">{timeline.matter?.name}</Link>
            <span>{timeline.timelineType.replace(/_/g, " ")}</span>
            <span>{events.length} events</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => summaryMut.mutate({ timelineId: id })} disabled={summaryMut.isLoading}><Sparkles className="h-4 w-4 mr-1" /> AI Summary</Button>
          <Button variant="outline" size="sm" onClick={() => patternsMut.mutate({ timelineId: id })} disabled={patternsMut.isLoading}><AlertTriangle className="h-4 w-4 mr-1" /> Patterns</Button>
        </div>
      </div>

      {/* Timeline Visualization */}
      <Card>
        <CardContent className="pt-6">
          {events.length > 0 ? (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {events.map((event: any) => (
                  <div key={event.id} className="flex items-start gap-4 relative">
                    <div className={`${SIG_SIZE[event.significance]} rounded-full flex-shrink-0 z-10 border-2 border-white`} style={{ backgroundColor: CAT_COLORS[event.category] || CAT_COLORS.OTHER }} />
                    <div className={`flex-1 p-3 rounded-lg border ${event.isKeyEvent ? "border-blue-300 bg-blue-50" : ""} ${event.isDisputed ? "border-dashed border-amber-400" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{new Date(event.date).toLocaleDateString()}</span>
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: (CAT_COLORS[event.category] || "#9CA3AF") + "20", color: CAT_COLORS[event.category] || "#9CA3AF" }}>{event.category}</span>
                          {event.isKeyEvent && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">KEY</span>}
                          {event.isDisputed && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">DISPUTED</span>}
                        </div>
                        {event.amount && <span className="text-xs font-medium text-emerald-600">${Number(event.amount).toLocaleString()}</span>}
                      </div>
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.description && <p className="text-xs text-gray-600 mt-1">{event.description}</p>}
                      {event.party && <p className="text-xs text-gray-400 mt-1">Party: {event.party}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400"><GanttChart className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No events. Add events or auto-build from matter data.</p></div>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {timeline.aiSummary && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> AI Summary</CardTitle></CardHeader>
          <CardContent><div className="prose prose-sm max-w-none"><p className="whitespace-pre-wrap">{timeline.aiSummary}</p></div></CardContent>
        </Card>
      )}

      {/* Category Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CAT_COLORS).map(([cat, color]) => {
          const count = events.filter((e: any) => e.category === cat).length;
          if (count === 0) return null;
          return <span key={cat} className="text-xs flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />{cat.replace(/_/g, " ")} ({count})</span>;
        })}
      </div>
    </div>
  );
}
