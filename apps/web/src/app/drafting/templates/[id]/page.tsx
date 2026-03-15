"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Save,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Eye,
  GripVertical,
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

interface TemplateVariable {
  name: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;
  const utils = trpc.useUtils();

  const { data: template, isLoading } = trpc.drafting.getTemplate.useQuery({ id: templateId });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("OTHER");
  const [practiceArea, setPracticeArea] = useState("");
  const [content, setContent] = useState("");
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setCategory(template.category);
      setPracticeArea(template.practiceArea || "");
      setContent(template.content);
      try { setVariables(JSON.parse(template.variables)); } catch { setVariables([]); }
    }
  }, [template]);

  const updateTemplate = trpc.drafting.updateTemplate.useMutation({
    onSuccess: () => {
      toast({ title: "Template saved" });
      utils.drafting.getTemplate.invalidate({ id: templateId });
    },
  });

  const deleteTemplate = trpc.drafting.deleteTemplate.useMutation({
    onSuccess: () => { toast({ title: "Template archived" }); router.push("/drafting"); },
  });

  const duplicateTemplate = trpc.drafting.duplicateTemplate.useMutation({
    onSuccess: (t) => { toast({ title: "Duplicated" }); router.push(`/drafting/templates/${t.id}`); },
  });

  const handleSave = () => {
    updateTemplate.mutate({
      id: templateId,
      name,
      description: description || undefined,
      category: category as any,
      practiceArea: practiceArea || undefined,
      content,
      variables: JSON.stringify(variables),
    });
  };

  const addVariable = () => {
    setVariables([...variables, { name: "", label: "", type: "text", required: true }]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], ...updates };
    setVariables(newVars);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const getPreviewHtml = () => {
    let html = content;
    variables.forEach((v) => {
      const sample = v.defaultValue || `[${v.label || v.name}]`;
      html = html.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), `<mark style="background:#fef3c7;padding:0 2px;">${sample}</mark>`);
    });
    return html;
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!template) return <div className="py-20 text-center text-gray-500">Template not found</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-semibold border-none shadow-none p-0 h-auto" />
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>
                {category.replace("_", " ")}
              </span>
              {practiceArea && <span className="text-xs text-gray-500">{practiceArea}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-1" /> {showPreview ? "Edit" : "Preview"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => duplicateTemplate.mutate({ id: templateId })}>
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Archive?")) deleteTemplate.mutate({ id: templateId }); }}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
          <Button onClick={handleSave} disabled={updateTemplate.isPending} className="bg-rose-600 hover:bg-rose-700">
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="grid gap-4 md:grid-cols-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Template description" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(CATEGORY_COLORS).map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Practice Area</Label>
          <Input value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} placeholder="e.g. Family Law" />
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Content Editor */}
        <div className="lg:col-span-3">
          {showPreview ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">Preview (variables highlighted)</h3>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <Label className="text-xs mb-2 block">Template Content (HTML with {"{{VARIABLE}}"} placeholders)</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={30} className="font-mono text-sm" />
            </div>
          )}
        </div>

        {/* Variable Manager */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Variables ({variables.length})</h3>
              <Button variant="outline" size="sm" onClick={addVariable}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {variables.map((v, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500">{"{{" + (v.name || "NAME") + "}}"}</span>
                    <button onClick={() => removeVariable(i)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={v.name} onChange={(e) => updateVariable(i, { name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} placeholder="VARIABLE_NAME" className="h-7 text-xs font-mono" />
                    <Input value={v.label} onChange={(e) => updateVariable(i, { label: e.target.value })} placeholder="Display Label" className="h-7 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={v.type} onValueChange={(val) => updateVariable(i, { type: val })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="textarea">Text Area</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={v.required} onChange={(e) => updateVariable(i, { required: e.target.checked })} id={`req-${i}`} />
                      <label htmlFor={`req-${i}`} className="text-xs text-gray-600">Required</label>
                    </div>
                  </div>
                  <Input value={v.defaultValue || ""} onChange={(e) => updateVariable(i, { defaultValue: e.target.value })} placeholder="Default value (optional)" className="h-7 text-xs" />
                  {v.type === "select" && (
                    <Input
                      value={v.options?.join(", ") || ""}
                      onChange={(e) => updateVariable(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Options (comma separated)"
                      className="h-7 text-xs"
                    />
                  )}
                </div>
              ))}
              {variables.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No variables defined. Add variables that map to {"{{PLACEHOLDER}}"} syntax in your template.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
