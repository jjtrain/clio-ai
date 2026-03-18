"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, GanttChart, CheckCircle } from "lucide-react";

const TYPES = ["CASE_CHRONOLOGY", "MEDICAL_TREATMENT", "DISCOVERY", "LITIGATION", "INCIDENT", "CUSTOM"];

export default function BuildTimelinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [matterId, setMatterId] = useState("");
  const [timelineType, setTimelineType] = useState("CASE_CHRONOLOGY");
  const [title, setTitle] = useState("");

  const { data: matters } = trpc.matters.list.useQuery({});
  const buildMut = trpc.visuals["timelines.buildFromMatter"].useMutation({
    onSuccess: (data: any) => { toast({ title: `Timeline built with ${data?.eventCount || 0} events` }); router.push(`/visuals/timelines/${data?.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const selectedMatter = (matters as any)?.find((m: any) => m.id === matterId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">Build Timeline</h1><p className="text-sm text-slate-500">Auto-build a visual timeline from your case data</p></div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div><Label>Select Matter</Label>
            <Select value={matterId} onValueChange={(v) => { setMatterId(v); const m = (matters as any)?.find((m: any) => m.id === v); if (m) setTitle(`${m.name} — ${timelineType.replace(/_/g, " ")}`); }}>
              <SelectTrigger><SelectValue placeholder="Choose a matter..." /></SelectTrigger>
              <SelectContent>{((matters as any) || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Timeline Type</Label>
            <Select value={timelineType} onValueChange={(v) => { setTimelineType(v); if (selectedMatter) setTitle(`${selectedMatter.name} — ${v.replace(/_/g, " ")}`); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <Button className="w-full" onClick={() => buildMut.mutate({ matterId, timelineType: timelineType as any })} disabled={!matterId || buildMut.isLoading}>
            {buildMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GanttChart className="h-4 w-4 mr-2" />}
            Build Timeline
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
