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
import { Loader2, Users, CheckCircle } from "lucide-react";

export default function PrepareDepositionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({ matterId: "", deponentName: "", deponentRole: "party", depositionDate: "", depositionTime: "", location: "", locationType: "IN_PERSON", examiningAttorney: "", defendingAttorney: "", courtReporter: "", videoConferenceUrl: "" });

  const { data: matters } = trpc.matters.list.useQuery({});
  const prepareMut = trpc.visuals["deposition.prepare"].useMutation({
    onSuccess: (data: any) => { toast({ title: "Deposition prepared" }); router.push(`/visuals/depositions/${data?.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">Prepare Deposition</h1><p className="text-sm text-slate-500">Set up a deposition session with exhibits and tools</p></div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div><Label>Matter</Label><Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}><SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger><SelectContent>{((matters as any) || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Deponent Name</Label><Input value={form.deponentName} onChange={(e) => setForm({ ...form, deponentName: e.target.value })} /></div>
            <div><Label>Role</Label><Select value={form.deponentRole} onValueChange={(v) => setForm({ ...form, deponentRole: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="party">Party</SelectItem><SelectItem value="non-party">Non-Party</SelectItem><SelectItem value="expert">Expert</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Date</Label><Input type="date" value={form.depositionDate} onChange={(e) => setForm({ ...form, depositionDate: e.target.value })} /></div>
            <div><Label>Time</Label><Input type="time" value={form.depositionTime} onChange={(e) => setForm({ ...form, depositionTime: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Type</Label><Select value={form.locationType} onValueChange={(v) => setForm({ ...form, locationType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IN_PERSON">In Person</SelectItem><SelectItem value="REMOTE">Remote</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Examining Attorney</Label><Input value={form.examiningAttorney} onChange={(e) => setForm({ ...form, examiningAttorney: e.target.value })} /></div>
            <div><Label>Defending Attorney</Label><Input value={form.defendingAttorney} onChange={(e) => setForm({ ...form, defendingAttorney: e.target.value })} /></div>
          </div>
          <div><Label>Court Reporter</Label><Input value={form.courtReporter} onChange={(e) => setForm({ ...form, courtReporter: e.target.value })} /></div>
          {form.locationType !== "IN_PERSON" && <div><Label>Video Conference URL</Label><Input value={form.videoConferenceUrl} onChange={(e) => setForm({ ...form, videoConferenceUrl: e.target.value })} /></div>}
          <Button className="w-full" onClick={() => prepareMut.mutate({ matterId: form.matterId, deponentName: form.deponentName, depositionDate: form.depositionDate })} disabled={!form.matterId || !form.deponentName || !form.depositionDate || prepareMut.isLoading}>
            {prepareMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            Create Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
