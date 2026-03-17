"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Video, Copy, CheckCircle, Clock, Users, Mic } from "lucide-react";

export default function ScheduleMeetingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"template" | "form" | "done">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [createdMeeting, setCreatedMeeting] = useState<any>(null);
  const [form, setForm] = useState({ topic: "", startDate: "", startTime: "", duration: "30", matterId: "", agenda: "", attendeeEmail: "" });

  const { data: templates } = trpc.zoom["templates.list"].useQuery({ isActive: true });
  const { data: matters } = trpc.matters.list.useQuery({});
  const createMut = trpc.zoom["meetings.create"].useMutation({
    onSuccess: (data) => { setCreatedMeeting(data); setStep("done"); toast({ title: "Meeting scheduled!" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSelectTemplate = (t: any) => {
    setSelectedTemplate(t);
    setForm({ ...form, topic: t.name, duration: String(t.defaultDuration), agenda: t.defaultAgenda || "" });
    setStep("form");
  };

  const handleSchedule = () => {
    const startTime = new Date(`${form.startDate}T${form.startTime}`).toISOString();
    const attendees = form.attendeeEmail ? form.attendeeEmail.split(",").map(e => ({ name: e.trim(), email: e.trim() })) : [];
    createMut.mutate({
      topic: form.topic, startTime, duration: parseInt(form.duration),
      matterId: form.matterId || undefined, agenda: form.agenda || undefined,
      templateId: selectedTemplate?.id, attendees,
    });
  };

  if (step === "done" && createdMeeting) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-12">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Meeting Scheduled!</h1>
          <p className="text-gray-500">{createdMeeting.topic}</p>
          <p className="text-sm text-gray-400 mt-1">{new Date(createdMeeting.startTime).toLocaleString()}</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div>
              <Label className="text-xs text-gray-500">Join URL</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={createdMeeting.joinUrl} className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(createdMeeting.joinUrl); toast({ title: "Copied" }); }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            {createdMeeting.password && <div><Label className="text-xs text-gray-500">Password</Label><p className="text-sm font-mono">{createdMeeting.password}</p></div>}
          </CardContent>
        </Card>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => router.push("/zoom")}>Back to Dashboard</Button>
          <Button onClick={() => { setStep("template"); setCreatedMeeting(null); setSelectedTemplate(null); }}>Schedule Another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule Meeting</h1>
        <p className="text-sm text-slate-500">{step === "template" ? "Choose a template or start custom" : "Configure your meeting"}</p>
      </div>

      {step === "template" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(templates || []).map((t: any) => (
              <Card key={t.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => handleSelectTemplate(t)}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="h-5 w-5 text-blue-500" />
                    <p className="font-medium">{t.name}</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{t.description || t.defaultAgenda || ""}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t.defaultDuration}min</span>
                    {t.autoRecord !== "NONE" && <span className="flex items-center gap-1"><Mic className="h-3 w-3" /> Record</span>}
                    {t.meetingType && <span className="bg-gray-100 px-2 py-0.5 rounded">{t.meetingType}</span>}
                  </div>
                  <p className="text-xs text-gray-300 mt-2">Used {t.usageCount} times</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button variant="outline" onClick={() => setStep("form")}>Custom Meeting (No Template)</Button>
          </div>
        </>
      )}

      {step === "form" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Meeting Details</CardTitle>
            {selectedTemplate && <CardDescription>Template: {selectedTemplate.name}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl">
            <div><Label>Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Meeting topic" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>Time</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            </div>
            <div>
              <Label>Matter (optional)</Label>
              <Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}>
                <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {((matters as any) || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Attendee Emails (comma-separated)</Label><Input value={form.attendeeEmail} onChange={(e) => setForm({ ...form, attendeeEmail: e.target.value })} placeholder="email1@example.com, email2@example.com" /></div>
            <div><Label>Agenda</Label><Textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={3} /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("template"); setSelectedTemplate(null); }}>Back</Button>
              <Button onClick={handleSchedule} disabled={!form.topic || !form.startDate || !form.startTime || createMut.isLoading}>
                {createMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                Schedule Meeting
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
