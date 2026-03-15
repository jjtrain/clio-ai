"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  FileText,
  Sparkles,
  File,
  ArrowRight,
  Save,
  Eye,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  ENGAGEMENT: "bg-blue-100 text-blue-700",
  PLEADING: "bg-purple-100 text-purple-700",
  MOTION: "bg-amber-100 text-amber-700",
  LETTER: "bg-teal-100 text-teal-700",
  AGREEMENT: "bg-emerald-100 text-emerald-700",
  DISCOVERY: "bg-orange-100 text-orange-700",
  COURT_FORM: "bg-slate-100 text-slate-700",
  OTHER: "bg-gray-100 text-gray-700",
};

function NewDocumentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const mode = searchParams.get("mode") || "template";
  const paramMatterId = searchParams.get("matterId") || "";
  const paramClientId = searchParams.get("clientId") || "";

  const { data: templates } = trpc.drafting.listTemplates.useQuery();
  const { data: matters } = trpc.matters.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();

  // Template mode state
  const [step, setStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [templateCatFilter, setTemplateCatFilter] = useState("ALL");
  const [previewHtml, setPreviewHtml] = useState("");

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState<{ title: string; content: string } | null>(null);
  const [improveInstructions, setImproveInstructions] = useState("");
  const [showImprove, setShowImprove] = useState(false);

  // Blank mode state
  const [blankTitle, setBlankTitle] = useState("");

  // Shared
  const [matterId, setMatterId] = useState(paramMatterId);
  const [clientId, setClientId] = useState(paramClientId);

  const createFromTemplate = trpc.drafting.createFromTemplate.useMutation({
    onSuccess: (d) => { toast({ title: "Draft created" }); router.push(`/drafting/${d.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const createFromAi = trpc.drafting.createFromAi.useMutation({
    onSuccess: (d) => { toast({ title: "Document generated" }); router.push(`/drafting/${d.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const createBlank = trpc.drafting.createBlank.useMutation({
    onSuccess: (d) => { router.push(`/drafting/${d.id}`); },
  });

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);
  const templateVars: any[] = selectedTemplate ? (() => { try { return JSON.parse(selectedTemplate.variables); } catch { return []; } })() : [];
  const filteredTemplates = templates?.filter((t) => templateCatFilter === "ALL" || t.category === templateCatFilter) || [];

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    const t = templates?.find((x) => x.id === id);
    if (t) {
      const vars: any[] = (() => { try { return JSON.parse(t.variables); } catch { return []; } })();
      const defaults: Record<string, string> = {};
      vars.forEach((v: any) => {
        if (v.defaultValue) defaults[v.name] = v.defaultValue;
        if (v.name === "DATE") defaults[v.name] = new Date().toISOString().split("T")[0];
      });
      // Auto-fill FIRM_NAME from settings if available
      setVariableValues(defaults);
    }
    setStep(2);
  };

  const handlePreview = () => {
    if (!selectedTemplate) return;
    let html = selectedTemplate.content;
    for (const [key, val] of Object.entries(variableValues)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val || `[${key}]`);
    }
    // Replace any remaining unfilled vars
    html = html.replace(/\{\{(\w+)\}\}/g, "[$1]");
    setPreviewHtml(html);
    setStep(3);
  };

  const handleTemplateSave = () => {
    if (!selectedTemplateId) return;
    createFromTemplate.mutate({
      templateId: selectedTemplateId,
      matterId: matterId || undefined,
      clientId: clientId || undefined,
      variableValues,
    });
  };

  const modeButtons = [
    { id: "template", label: "From Template", icon: FileText },
    { id: "ai", label: "AI Generate", icon: Sparkles },
    { id: "blank", label: "Blank", icon: File },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">New Document</h1>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2">
        {modeButtons.map((m) => (
          <Link
            key={m.id}
            href={`/drafting/new?mode=${m.id}${matterId ? `&matterId=${matterId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <m.icon className="h-4 w-4" /> {m.label}
          </Link>
        ))}
      </div>

      {/* Matter/Client selectors */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Link to Matter (optional)</Label>
          <Select value={matterId} onValueChange={setMatterId}>
            <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {matters?.matters?.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.matterNumber} - {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Link to Client (optional)</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {(clients as any)?.map?.((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template Mode */}
      {mode === "template" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Step 1: Select Template</h2>
                <Select value={templateCatFilter} onValueChange={setTemplateCatFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {Object.keys(CATEGORY_COLORS).map((c) => (
                      <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t.id)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      selectedTemplateId === t.id ? "border-rose-500 bg-rose-50" : "border-gray-200 hover:border-rose-300"
                    }`}
                  >
                    <p className="font-medium text-sm">{t.name}</p>
                    <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category]}`}>
                      {t.category.replace("_", " ")}
                    </span>
                    {t.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && selectedTemplate && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Step 2: Fill Variables</h2>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Template: <strong>{selectedTemplate.name}</strong></p>
              <div className="grid gap-4 md:grid-cols-2">
                {templateVars.map((v: any) => (
                  <div key={v.name} className="space-y-1">
                    <Label className="text-xs">
                      {v.label} {v.required && <span className="text-red-500">*</span>}
                    </Label>
                    {v.type === "textarea" ? (
                      <Textarea
                        value={variableValues[v.name] || ""}
                        onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                        rows={3}
                        placeholder={v.label}
                      />
                    ) : v.type === "select" && v.options ? (
                      <Select value={variableValues[v.name] || ""} onValueChange={(val) => setVariableValues({ ...variableValues, [v.name]: val })}>
                        <SelectTrigger><SelectValue placeholder={`Select ${v.label}`} /></SelectTrigger>
                        <SelectContent>
                          {v.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"}
                        value={variableValues[v.name] || ""}
                        onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                        placeholder={v.label}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handlePreview} className="bg-rose-600 hover:bg-rose-700">
                  <Eye className="h-4 w-4 mr-2" /> Preview <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Step 3: Preview</h2>
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Back to Edit</Button>
              </div>
              <div className="border border-gray-200 rounded-lg p-6 bg-white prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              <Button onClick={handleTemplateSave} disabled={createFromTemplate.isPending} className="bg-rose-600 hover:bg-rose-700">
                <Save className="h-4 w-4 mr-2" /> {createFromTemplate.isPending ? "Saving..." : "Save as Draft"}
              </Button>
            </>
          )}
        </div>
      )}

      {/* AI Mode */}
      {mode === "ai" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">AI Document Generator</h2>
          <div className="space-y-2">
            <Label>Describe the document you need</Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={5}
              placeholder='e.g. "Draft a retainer agreement for a family law custody matter with a $5,000 retainer and $350/hour billing rate" or "Create a motion to compel discovery responses in a breach of contract case"'
            />
          </div>
          <Button
            onClick={() => createFromAi.mutate({ prompt: aiPrompt, matterId: matterId || undefined, clientId: clientId || undefined })}
            disabled={!aiPrompt.trim() || createFromAi.isPending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {createFromAi.isPending ? (
              <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> AI is drafting your document...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Generate Document</>
            )}
          </Button>
        </div>
      )}

      {/* Blank Mode */}
      {mode === "blank" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Blank Document</h2>
          <div className="space-y-2">
            <Label>Document Title <span className="text-red-500">*</span></Label>
            <Input value={blankTitle} onChange={(e) => setBlankTitle(e.target.value)} placeholder="Document title" />
          </div>
          <Button
            onClick={() => createBlank.mutate({ title: blankTitle, matterId: matterId || undefined, clientId: clientId || undefined })}
            disabled={!blankTitle.trim() || createBlank.isPending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            <Save className="h-4 w-4 mr-2" /> Create Draft
          </Button>
        </div>
      )}
    </div>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading...</div>}>
      <NewDocumentContent />
    </Suspense>
  );
}
