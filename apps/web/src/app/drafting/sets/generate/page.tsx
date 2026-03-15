"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileText,
  Layers,
  PlusCircle,
  Check,
  X,
  Eye,
  Pencil,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const SET_CATEGORY_COLORS: Record<string, string> = {
  "Client Onboarding": "bg-blue-100 text-blue-700",
  Litigation: "bg-purple-100 text-purple-700",
  Transactional: "bg-emerald-100 text-emerald-700",
  "Estate Planning": "bg-teal-100 text-teal-700",
  Discovery: "bg-orange-100 text-orange-700",
  Appeals: "bg-amber-100 text-amber-700",
};

const GEN_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  GENERATING: "bg-blue-100 text-blue-700 animate-pulse",
  REVIEWING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function GenerateDocumentSetPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<"template" | "ai" | "custom" | null>(null);

  // Template method state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateItems, setTemplateItems] = useState<any[]>([]);

  // AI method state
  const [aiPrompt, setAiPrompt] = useState("");

  // Custom method state
  const [customItems, setCustomItems] = useState<any[]>([]);

  // Configure state (Step 3)
  const [matterId, setMatterId] = useState("");
  const [clientId, setClientId] = useState("");
  const [autoFillMerge, setAutoFillMerge] = useState(true);
  const [autoSign, setAutoSign] = useState(false);

  // Generated result (Step 4)
  const [generatedSet, setGeneratedSet] = useState<any>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const { data: setTemplates } = trpc.drafting.listSetTemplates.useQuery();
  const { data: matters } = trpc.matters.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: templates } = trpc.drafting.listTemplates.useQuery();

  const generateFromTemplate = trpc.drafting.generateDocumentSet.useMutation({
    onSuccess: (set) => { setGeneratedSet(set); setStep(4); toast({ title: "Documents generated" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateWithAi = trpc.drafting.generateWithAi.useMutation({
    onSuccess: (set) => { setGeneratedSet(set); setStep(4); toast({ title: "AI documents generated" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveSet = trpc.drafting.approveSet.useMutation({
    onSuccess: () => toast({ title: "Set approved" }),
  });

  const regenerateDoc = trpc.drafting.regenerateDocument.useMutation({
    onSuccess: () => toast({ title: "Document regenerated" }),
  });

  const handleSelectSetTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const st = setTemplates?.find((t: any) => t.id === id);
    if (st) {
      try {
        const items = JSON.parse(st.items);
        setTemplateItems(items.map((i: any) => ({ ...i, selected: true })));
      } catch {
        setTemplateItems([]);
      }
    }
  };

  const handleGenerate = () => {
    if (!matterId) { toast({ title: "Select a matter", variant: "destructive" }); return; }
    if (!clientId) { toast({ title: "Select a client", variant: "destructive" }); return; }

    if (method === "template") {
      const items = templateItems.filter((i) => i.selected).map((i, idx) => ({
        templateId: i.templateId || undefined,
        title: i.title,
        sortOrder: idx + 1,
        isRequired: i.isRequired ?? true,
        autoSendForSignature: i.autoSendForSignature ?? false,
      }));
      generateFromTemplate.mutate({
        setTemplateId: selectedTemplateId || undefined,
        items: selectedTemplateId ? undefined : items,
        matterId,
        clientId,
        autoFillMergeFields: autoFillMerge,
      });
    } else if (method === "ai") {
      generateWithAi.mutate({ matterId, clientId, prompt: aiPrompt });
    } else if (method === "custom") {
      const items = customItems.map((i, idx) => ({
        templateId: i.id,
        title: i.name || i.title,
        sortOrder: idx + 1,
        isRequired: true,
        autoSendForSignature: false,
      }));
      generateFromTemplate.mutate({ items, matterId, clientId, autoFillMergeFields: autoFillMerge });
    }
  };

  // Auto-fill client from matter
  const selectedMatter = matters?.matters?.find((m: any) => m.id === matterId);

  const isGenerating = generateFromTemplate.isPending || generateWithAi.isPending;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Generate Document Set</h1>
          <p className="text-sm text-gray-500">Step {step} of 4</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {["Method", "Select", "Configure", "Review"].map((label, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i + 1 <= step ? "bg-rose-500" : "bg-gray-200"}`} />
        ))}
      </div>

      {/* Step 1: Choose Method */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: "template" as const, label: "From Set Template", desc: "Pick a pre-built document set template", icon: Layers },
            { id: "ai" as const, label: "AI Generate", desc: "Describe what you need, AI creates the documents", icon: Sparkles },
            { id: "custom" as const, label: "Custom Assembly", desc: "Pick individual templates to include", icon: PlusCircle },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setStep(2); }}
              className={`p-6 rounded-xl border-2 text-left transition-all hover:border-rose-300 hover:shadow-md ${
                method === m.id ? "border-rose-500 bg-rose-50" : "border-gray-200"
              }`}
            >
              <m.icon className="h-8 w-8 text-rose-600 mb-3" />
              <h3 className="font-semibold text-lg mb-1">{m.label}</h3>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2a: From Set Template */}
      {step === 2 && method === "template" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Select a Set Template</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {setTemplates?.map((st: any) => {
              let itemCount = 0;
              try { itemCount = JSON.parse(st.items).length; } catch {}
              return (
                <button
                  key={st.id}
                  onClick={() => handleSelectSetTemplate(st.id)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    selectedTemplateId === st.id ? "border-rose-500 bg-rose-50" : "border-gray-200 hover:border-rose-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{st.name}</p>
                      <div className="flex gap-2 mt-1">
                        {st.category && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SET_CATEGORY_COLORS[st.category] || "bg-gray-100 text-gray-600"}`}>
                            {st.category}
                          </span>
                        )}
                        {st.practiceArea && <span className="text-[10px] text-gray-500">{st.practiceArea}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{itemCount} docs</span>
                  </div>
                  {st.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{st.description}</p>}
                </button>
              );
            })}
          </div>

          {selectedTemplateId && templateItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold mb-3">Documents in this set:</h3>
              <div className="space-y-2">
                {templateItems.map((item: any, i: number) => (
                  <label key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => {
                        const newItems = [...templateItems];
                        newItems[i] = { ...newItems[i], selected: e.target.checked };
                        setTemplateItems(newItems);
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm flex-1">{item.title}</span>
                    {item.isRequired && <span className="text-[10px] text-red-500 font-medium">Required</span>}
                    {item.autoSendForSignature && <span className="text-[10px] text-blue-500 font-medium">Auto-sign</span>}
                  </label>
                ))}
              </div>
              <Button onClick={() => setStep(3)} className="mt-4 bg-rose-600 hover:bg-rose-700">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 2b: AI Generate */}
      {step === 2 && method === "ai" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI Document Generation</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="space-y-2">
              <Label>Describe what documents you need</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={5}
                placeholder={'e.g. "Generate all documents needed to onboard a new family law client for a custody matter"\nor "Create a litigation startup package for a breach of contract case"'}
              />
            </div>
            <Button onClick={() => setStep(3)} disabled={!aiPrompt.trim()} className="bg-rose-600 hover:bg-rose-700">
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2c: Custom Assembly */}
      {step === 2 && method === "custom" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Custom Assembly</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Available templates */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold mb-3">Available Templates</h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {templates?.filter((t: any) => !customItems.some((ci) => ci.id === t.id)).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <span className="text-[10px] text-gray-500">{t.category}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setCustomItems([...customItems, t])}>
                      <PlusCircle className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected documents */}
            <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold mb-3">Selected ({customItems.length})</h3>
              <div className="space-y-1">
                {customItems.map((item, i) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setCustomItems(customItems.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                ))}
                {customItems.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Add templates from the left panel</p>}
              </div>
            </div>
          </div>

          <Button onClick={() => setStep(3)} disabled={customItems.length === 0} className="bg-rose-600 hover:bg-rose-700">
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Configure Generation</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Back</Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Matter <span className="text-red-500">*</span></Label>
                <Select value={matterId} onValueChange={(v) => {
                  setMatterId(v);
                  const m = matters?.matters?.find((m: any) => m.id === v);
                  if (m?.clientId) setClientId(m.clientId);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
                  <SelectContent>
                    {matters?.matters?.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.matterNumber} - {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    {(clients as any)?.map?.((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={autoFillMerge} onChange={(e) => setAutoFillMerge(e.target.checked)} className="rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium">Auto-fill merge fields from matter/client data</p>
                  <p className="text-xs text-gray-500">Automatically populate client name, matter number, firm info, etc.</p>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={autoSign} onChange={(e) => setAutoSign(e.target.checked)} className="rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium">Auto-send for e-signature after review</p>
                  <p className="text-xs text-gray-500">Applicable documents will be sent for signature once approved</p>
                </div>
              </label>
            </div>

            <Button onClick={handleGenerate} disabled={!matterId || !clientId || isGenerating} className="bg-rose-600 hover:bg-rose-700">
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating documents...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Documents</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && generatedSet && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Review Generated Documents</h2>
            <div className="flex gap-2">
              {generatedSet.generation && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${GEN_STATUS_COLORS[generatedSet.generation.status] || "bg-gray-100"}`}>
                  {generatedSet.generation.status}
                </span>
              )}
            </div>
          </div>

          {/* Progress summary */}
          {generatedSet.generation && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">
                  {generatedSet.generation.completedDocuments} of {generatedSet.generation.totalDocuments} generated
                  {generatedSet.generation.failedDocuments > 0 && (
                    <span className="text-red-500 ml-2">({generatedSet.generation.failedDocuments} failed)</span>
                  )}
                </span>
                <span className="text-gray-400">
                  {Math.round((generatedSet.generation.completedDocuments / Math.max(generatedSet.generation.totalDocuments, 1)) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${(generatedSet.generation.completedDocuments / Math.max(generatedSet.generation.totalDocuments, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Document list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {generatedSet.items?.map((item: any) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    {item.draftDocument ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.draftDocument && (
                        <span className="text-[10px] text-gray-400">Draft status: {item.draftDocument.status}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.draftDocument ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {item.draftDocument ? "Generated" : "Failed"}
                    </span>
                    <div className="flex gap-1">
                      {item.draftDocument && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewItemId(previewItemId === item.id ? null : item.id)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/drafting/${item.draftDocument.id}`}><Pencil className="h-3 w-3" /></Link>
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => regenerateDoc.mutate({ documentSetItemId: item.id })} disabled={regenerateDoc.isPending}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline preview */}
                  {previewItemId === item.id && item.draftDocument?.content && (
                    <div className="mt-3 border border-gray-200 rounded-lg p-4 bg-gray-50 prose prose-sm max-w-none max-h-64 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: item.draftDocument.content }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => { approveSet.mutate({ documentSetId: generatedSet.id }); }}
              disabled={approveSet.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" /> Approve All
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/drafting/sets/${generatedSet.id}`}>
                <FileText className="h-4 w-4 mr-2" /> Open Document Set
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
