"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Video, Clock, Mic, Sparkles, Edit, Copy, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function TemplatesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", defaultDuration: "30", defaultAgenda: "", waitingRoom: true, muteOnEntry: true, autoRecord: "NONE", autoSummarize: true, autoLogTime: false, billingActivityCode: "", meetingType: "", practiceArea: "" });

  const { data: templates, isLoading } = trpc.zoom["templates.list"].useQuery();
  const initMut = trpc.zoom["templates.initialize"].useMutation({ onSuccess: () => { utils.zoom["templates.list"].invalidate(); toast({ title: "Default templates created" }); } });
  const createMut = trpc.zoom["templates.create"].useMutation({ onSuccess: () => { utils.zoom["templates.list"].invalidate(); setShowCreate(false); resetForm(); toast({ title: "Template created" }); } });
  const updateMut = trpc.zoom["templates.update"].useMutation({ onSuccess: () => { utils.zoom["templates.list"].invalidate(); setEditing(null); toast({ title: "Template updated" }); } });
  const deleteMut = trpc.zoom["templates.delete"].useMutation({ onSuccess: () => { utils.zoom["templates.list"].invalidate(); toast({ title: "Template deleted" }); } });
  const dupMut = trpc.zoom["templates.duplicate"].useMutation({ onSuccess: () => { utils.zoom["templates.list"].invalidate(); toast({ title: "Template duplicated" }); } });

  const resetForm = () => setForm({ name: "", description: "", defaultDuration: "30", defaultAgenda: "", waitingRoom: true, muteOnEntry: true, autoRecord: "NONE", autoSummarize: true, autoLogTime: false, billingActivityCode: "", meetingType: "", practiceArea: "" });

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-1"><span className="text-sm">{label}</span><button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} /></button></label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Meeting Templates</h1><p className="text-sm text-slate-500">Reusable meeting configurations</p></div>
        <div className="flex gap-2">
          {(!templates || templates.length === 0) && <Button variant="outline" onClick={() => initMut.mutate()} disabled={initMut.isLoading}>{initMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Initialize Defaults</Button>}
          <Button onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="h-4 w-4 mr-2" /> New Template</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates || []).map((t: any) => (
            <Card key={t.id} className={!t.isActive ? "opacity-50" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{t.name}</p>
                  {t.meetingType && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.meetingType}</span>}
                </div>
                {t.description && <p className="text-xs text-gray-500 mb-3">{t.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t.defaultDuration}min</span>
                  {t.autoRecord !== "NONE" && <span className="flex items-center gap-1"><Mic className="h-3 w-3 text-red-400" /> Record</span>}
                  {t.autoSummarize && <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-purple-400" /> AI Summary</span>}
                  {t.autoLogTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-400" /> Auto-log</span>}
                </div>
                <p className="text-xs text-gray-300 mb-3">Used {t.usageCount} times</p>
                <div className="flex gap-1">
                  <Link href={`/zoom/schedule?template=${t.id}`}><Button size="sm" variant="outline"><Video className="h-3 w-3 mr-1" /> Schedule</Button></Link>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setForm({ name: t.name, description: t.description || "", defaultDuration: String(t.defaultDuration), defaultAgenda: t.defaultAgenda || "", waitingRoom: t.waitingRoom, muteOnEntry: t.muteOnEntry, autoRecord: t.autoRecord, autoSummarize: t.autoSummarize, autoLogTime: t.autoLogTime, billingActivityCode: t.billingActivityCode || "", meetingType: t.meetingType || "", practiceArea: t.practiceArea || "" }); }}><Edit className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => dupMut.mutate({ id: t.id, newName: `${t.name} (Copy)` })}><Copy className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate({ id: t.id })}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!templates || templates.length === 0) && <Card className="col-span-full"><CardContent className="py-12 text-center text-gray-400">No templates. Click "Initialize Defaults" or "New Template".</CardContent></Card>}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editing} onOpenChange={() => { setShowCreate(false); setEditing(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Template" : "Create Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Duration (min)</Label><Input type="number" value={form.defaultDuration} onChange={(e) => setForm({ ...form, defaultDuration: e.target.value })} /></div>
              <div><Label>Meeting Type</Label><Input value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })} placeholder="consultation, deposition_prep..." /></div>
            </div>
            <div><Label>Default Agenda</Label><Textarea value={form.defaultAgenda} onChange={(e) => setForm({ ...form, defaultAgenda: e.target.value })} rows={2} /></div>
            <div><Label>Auto-Record</Label>
              <Select value={form.autoRecord} onValueChange={(v) => setForm({ ...form, autoRecord: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NONE">None</SelectItem><SelectItem value="LOCAL">Local</SelectItem><SelectItem value="CLOUD">Cloud</SelectItem></SelectContent>
              </Select>
            </div>
            <Toggle label="Waiting Room" checked={form.waitingRoom} onChange={(v: boolean) => setForm({ ...form, waitingRoom: v })} />
            <Toggle label="Mute on Entry" checked={form.muteOnEntry} onChange={(v: boolean) => setForm({ ...form, muteOnEntry: v })} />
            <Toggle label="Auto-Summarize" checked={form.autoSummarize} onChange={(v: boolean) => setForm({ ...form, autoSummarize: v })} />
            <Toggle label="Auto-Log Time" checked={form.autoLogTime} onChange={(v: boolean) => setForm({ ...form, autoLogTime: v })} />
            {form.autoLogTime && <div><Label>Billing Activity Code</Label><Input value={form.billingActivityCode} onChange={(e) => setForm({ ...form, billingActivityCode: e.target.value })} /></div>}
            <div><Label>Practice Area</Label><Input value={form.practiceArea} onChange={(e) => setForm({ ...form, practiceArea: e.target.value })} /></div>
            <Button className="w-full" disabled={!form.name} onClick={() => {
              const data = { name: form.name, description: form.description || undefined, defaultDuration: parseInt(form.defaultDuration), defaultAgenda: form.defaultAgenda || undefined, waitingRoom: form.waitingRoom, muteOnEntry: form.muteOnEntry, autoRecord: form.autoRecord as any, autoSummarize: form.autoSummarize, autoLogTime: form.autoLogTime, billingActivityCode: form.billingActivityCode || undefined, meetingType: form.meetingType || undefined, practiceArea: form.practiceArea || undefined };
              if (editing) updateMut.mutate({ id: editing.id, ...data }); else createMut.mutate(data);
            }}>{editing ? "Update" : "Create"} Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
