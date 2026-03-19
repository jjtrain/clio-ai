"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Play, Copy, Pencil, Trash2, Clock, DollarSign } from "lucide-react";

export default function PromptTemplatesPage() {
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.ai["prompts.list"].useQuery();
  const createMut = trpc.ai["prompts.create"].useMutation({ onSuccess: () => { utils.ai["prompts.list"].invalidate(); setEditOpen(false); } });
  const updateMut = trpc.ai["prompts.update"].useMutation({ onSuccess: () => { utils.ai["prompts.list"].invalidate(); } });
  const deleteMut = trpc.ai["prompts.delete"].useMutation({ onSuccess: () => utils.ai["prompts.list"].invalidate() });
  const testMut = trpc.ai["prompts.test"].useMutation({ onSuccess: (d) => setTestResult(d) });
  const dupMut = trpc.ai["prompts.duplicate"].useMutation({ onSuccess: () => utils.ai["prompts.list"].invalidate() });

  const [form, setForm] = useState({ name: "", feature: "", systemPrompt: "", userPromptTemplate: "", preferredProvider: "", preferredModel: "", temperature: 0.3, maxTokens: 4096, responseFormat: "text" });

  const openNew = () => { setSelected(null); setForm({ name: "", feature: "", systemPrompt: "", userPromptTemplate: "", preferredProvider: "", preferredModel: "", temperature: 0.3, maxTokens: 4096, responseFormat: "text" }); setEditOpen(true); };
  const openEdit = (t: any) => { setSelected(t); setForm({ name: t.name, feature: t.feature, systemPrompt: t.systemPrompt, userPromptTemplate: t.userPromptTemplate || "", preferredProvider: t.preferredProvider || "", preferredModel: t.preferredModel || "", temperature: Number(t.temperature || 0.3), maxTokens: t.maxTokens || 4096, responseFormat: t.responseFormat || "text" }); setEditOpen(true); setTestResult(null); };
  const save = () => { if (selected) { updateMut.mutate({ templateId: selected.id, data: form }); } else { createMut.mutate(form as any); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Prompt Templates</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage AI prompt templates for consistent, high-quality outputs</p>
        </div>
        <Button onClick={openNew} className="bg-blue-500 hover:bg-blue-600"><Plus className="h-4 w-4 mr-1" /> Create Template</Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(templates || []).map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 transition-all cursor-pointer" onClick={() => openEdit(t)}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
              </div>
              <Badge variant="outline" className="text-xs">{t.feature}</Badge>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{t.systemPrompt.slice(0, 120)}...</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {t.preferredProvider && <Badge className={t.preferredProvider === "ANTHROPIC" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}>{t.preferredProvider}</Badge>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.averageLatencyMs || 0}ms</span>
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${Number(t.averageCost || 0).toFixed(4)}</span>
              <span>{t.usageCount} uses</span>
            </div>
          </div>
        ))}
        {!isLoading && (templates || []).length === 0 && <p className="text-gray-400 col-span-full text-center py-12">No templates yet. Create your first one!</p>}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium text-gray-700">Feature</label><Input value={form.feature} onChange={(e) => setForm({ ...form, feature: e.target.value })} placeholder="e.g. document_review" /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700">System Prompt</label><textarea className="w-full min-h-[120px] rounded-md border p-3 text-sm" value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700">User Prompt Template</label><textarea className="w-full min-h-[80px] rounded-md border p-3 text-sm" value={form.userPromptTemplate} onChange={(e) => setForm({ ...form, userPromptTemplate: e.target.value })} placeholder="Use {{variable}} for placeholders" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Provider</label>
                <Select value={form.preferredProvider} onValueChange={(v) => setForm({ ...form, preferredProvider: v })}>
                  <SelectTrigger><SelectValue placeholder="Best Available" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Best Available</SelectItem>
                    <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
                    <SelectItem value="OPENAI">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium text-gray-700">Model</label><Input value={form.preferredModel} onChange={(e) => setForm({ ...form, preferredModel: e.target.value })} placeholder="Auto" /></div>
              <div><label className="text-sm font-medium text-gray-700">Temperature</label><Input type="number" step="0.1" min="0" max="1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} className="bg-blue-500 hover:bg-blue-600">{selected ? "Update" : "Create"}</Button>
              {selected && <Button variant="outline" onClick={() => testMut.mutate({ templateId: selected.id })} disabled={testMut.isPending}><Play className="h-4 w-4 mr-1" /> {testMut.isPending ? "Testing..." : "Test"}</Button>}
              {selected && <Button variant="outline" onClick={() => dupMut.mutate({ templateId: selected.id, newName: `${selected.name} (Copy)` })}><Copy className="h-4 w-4 mr-1" /> Duplicate</Button>}
              {selected && <Button variant="outline" className="text-red-600" onClick={() => { deleteMut.mutate({ templateId: selected.id }); setEditOpen(false); }}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>}
            </div>
            {testResult && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-purple-900 mb-2">Anthropic</h4>
                  <p className="text-xs text-purple-800 whitespace-pre-wrap">{(testResult as any).anthropic?.content || (testResult as any).anthropic?.error || "N/A"}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-green-900 mb-2">OpenAI</h4>
                  <p className="text-xs text-green-800 whitespace-pre-wrap">{(testResult as any).openai?.content || (testResult as any).openai?.error || "N/A"}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
