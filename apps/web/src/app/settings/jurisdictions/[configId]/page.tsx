"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar, Save, Play, Eye } from "lucide-react";

const CATEGORIES = ["General", "Financial", "Custody", "Property", "Filing", "Discovery"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function ConfigDetailPage() {
  const { configId } = useParams<{ configId: string }>();
  const [tab, setTab] = useState("forms");
  const [formDlg, setFormDlg] = useState(false);
  const [deadlineDlg, setDeadlineDlg] = useState(false);
  const [previewDate, setPreviewDate] = useState("");
  const [formData, setFormData] = useState({ formNumber: "", formName: "", category: "General", isRequired: false, filingFee: "" });
  const [dlData, setDlData] = useState({ name: "", triggerEvent: "", days: 0, calendarType: "CDT_CALENDAR", statute: "", priority: "MEDIUM", category: "General" });
  const [termMap, setTermMap] = useState<Record<string, string>>({});
  const [termDirty, setTermDirty] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [aiDirty, setAiDirty] = useState(false);

  const config = trpc.jurisdictions["configs.get"].useQuery({ id: configId }, {
    onSuccess: (data: any) => {
      try { setTermMap(JSON.parse(data.terminologyMap ?? "{}")); } catch { setTermMap({}); }
      setAiContext(data.aiPromptContext ?? "");
    },
  });
  const utils = trpc.useUtils();

  const createForm = trpc.jurisdictions["forms.create"].useMutation({
    onSuccess: () => { utils.jurisdictions["configs.get"].invalidate(); setFormDlg(false); },
  });
  const createDeadline = trpc.jurisdictions["deadlines.create"].useMutation({
    onSuccess: () => { utils.jurisdictions["configs.get"].invalidate(); setDeadlineDlg(false); },
  });
  const updateConfig = trpc.jurisdictions["configs.update"].useMutation({
    onSuccess: () => { utils.jurisdictions["configs.get"].invalidate(); setTermDirty(false); setAiDirty(false); },
  });

  const d = config.data as any;
  if (!d) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">{d.displayName}</h1>
        <div className="flex gap-2 mt-1">
          <Badge variant="outline">{d.practiceArea}</Badge>
          <Badge className="bg-blue-100 text-blue-800">{d.jurisdiction?.name}</Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="terminology">Terminology</TabsTrigger>
          <TabsTrigger value="ai">AI Context</TabsTrigger>
        </TabsList>

        {/* Forms Tab */}
        <TabsContent value="forms">
          <div className="flex justify-end mb-3">
            <Dialog open={formDlg} onOpenChange={setFormDlg}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Form</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Form</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-3 pt-2">
                  <Input placeholder="Form Number" value={formData.formNumber} onChange={(e) => setFormData({ ...formData, formNumber: e.target.value })} />
                  <Input placeholder="Form Name" value={formData.formName} onChange={(e) => setFormData({ ...formData, formName: e.target.value })} />
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.isRequired} onCheckedChange={(v) => setFormData({ ...formData, isRequired: !!v })} />
                    <span className="text-sm">Required</span>
                  </div>
                  <Input placeholder="Filing Fee" type="number" value={formData.filingFee} onChange={(e) => setFormData({ ...formData, filingFee: e.target.value })} />
                  <Button onClick={() => createForm.mutate({ ...formData, configId, filingFee: parseFloat(formData.filingFee) || 0 })} disabled={createForm.isLoading}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
              <TableHead>Required</TableHead><TableHead>Fee</TableHead><TableHead>Order</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.forms?.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-sm">{f.formNumber}</TableCell>
                  <TableCell>{f.formName}</TableCell>
                  <TableCell><Badge variant="outline">{f.category}</Badge></TableCell>
                  <TableCell>{f.isRequired ? <Badge className="bg-red-100 text-red-800">Required</Badge> : "—"}</TableCell>
                  <TableCell>${f.filingFee?.toFixed(2) ?? "0.00"}</TableCell>
                  <TableCell>{f.displayOrder}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines">
          <div className="flex justify-between mb-3">
            <div className="flex gap-2 items-center">
              <Input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} className="w-44" />
              {previewDate && <Eye className="h-4 w-4 text-gray-400" />}
            </div>
            <Dialog open={deadlineDlg} onOpenChange={setDeadlineDlg}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Deadline Rule</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Deadline Rule</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-3 pt-2">
                  <Input placeholder="Name" value={dlData.name} onChange={(e) => setDlData({ ...dlData, name: e.target.value })} />
                  <Input placeholder="Trigger Event" value={dlData.triggerEvent} onChange={(e) => setDlData({ ...dlData, triggerEvent: e.target.value })} />
                  <Input placeholder="Days (+/-)" type="number" value={dlData.days} onChange={(e) => setDlData({ ...dlData, days: parseInt(e.target.value) || 0 })} />
                  <Select value={dlData.calendarType} onValueChange={(v) => setDlData({ ...dlData, calendarType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CDT_CALENDAR">Calendar Days</SelectItem>
                      <SelectItem value="CDT_BUSINESS">Business Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Statute Reference" value={dlData.statute} onChange={(e) => setDlData({ ...dlData, statute: e.target.value })} />
                  <Select value={dlData.priority} onValueChange={(v) => setDlData({ ...dlData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={() => createDeadline.mutate({ ...dlData, configId })} disabled={createDeadline.isLoading}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Trigger</TableHead><TableHead>Days</TableHead>
              <TableHead>Type</TableHead><TableHead>Statute</TableHead><TableHead>Priority</TableHead><TableHead>Default</TableHead>
              {previewDate && <TableHead>Calculated</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {d.deadlines?.map((dl: any) => {
                let calc = "";
                if (previewDate) {
                  const base = new Date(previewDate);
                  base.setDate(base.getDate() + (dl.days ?? 0));
                  calc = base.toLocaleDateString();
                }
                return (
                  <TableRow key={dl.id}>
                    <TableCell>{dl.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{dl.triggerEvent}</TableCell>
                    <TableCell className="font-mono">{dl.days > 0 ? `+${dl.days}` : dl.days}</TableCell>
                    <TableCell><Badge variant="outline">{dl.calendarType === "CDT_BUSINESS" ? <><Calendar className="h-3 w-3 mr-1 inline" />Business</> : "Calendar"}</Badge></TableCell>
                    <TableCell className="text-xs">{dl.statute}</TableCell>
                    <TableCell><Badge className={dl.priority === "CRITICAL" ? "bg-red-100 text-red-800" : dl.priority === "HIGH" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}>{dl.priority}</Badge></TableCell>
                    <TableCell>{dl.isDefault ? <Badge className="bg-green-100 text-green-800">Default</Badge> : "—"}</TableCell>
                    {previewDate && <TableCell className="font-medium">{calc}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Terminology Tab */}
        <TabsContent value="terminology">
          <Card className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Standard Term</TableHead><TableHead>Local Term</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(termMap).map(([key, val]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell>
                      <Input value={val} onChange={(e) => { setTermMap({ ...termMap, [key]: e.target.value }); setTermDirty(true); }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 mt-4">
              <Input placeholder="New standard term" id="newTermKey" />
              <Input placeholder="Local term" id="newTermVal" />
              <Button variant="outline" onClick={() => {
                const k = (document.getElementById("newTermKey") as HTMLInputElement)?.value;
                const v = (document.getElementById("newTermVal") as HTMLInputElement)?.value;
                if (k) { setTermMap({ ...termMap, [k]: v }); setTermDirty(true); }
              }}><Plus className="h-4 w-4" /></Button>
            </div>
            <Button className="mt-4" disabled={!termDirty || updateConfig.isLoading}
              onClick={() => updateConfig.mutate({ id: configId, data: { terminologyMap: JSON.stringify(termMap) } })}>
              <Save className="h-4 w-4 mr-1" />Save Terminology
            </Button>
          </Card>
        </TabsContent>

        {/* AI Context Tab */}
        <TabsContent value="ai">
          <Card className="p-4 flex flex-col gap-4">
            <Textarea rows={12} value={aiContext} onChange={(e) => { setAiContext(e.target.value); setAiDirty(true); }}
              placeholder="Enter jurisdiction-specific AI prompt context..." />
            <div className="flex gap-2">
              <Button disabled={!aiDirty || updateConfig.isLoading}
                onClick={() => updateConfig.mutate({ id: configId, data: { aiPromptContext: aiContext } })}>
                <Save className="h-4 w-4 mr-1" />Save
              </Button>
              <Button variant="outline" onClick={() => alert("Test integration coming soon")}>
                <Play className="h-4 w-4 mr-1" />Test
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
