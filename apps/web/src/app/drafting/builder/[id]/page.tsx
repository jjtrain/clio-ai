"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Eye,
  EyeOff,
  History,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  X,
  Check,
  RotateCcw,
  Sparkles,
  FileText,
  Code,
} from "lucide-react";

const CATEGORIES = ["ENGAGEMENT", "PLEADING", "MOTION", "LETTER", "AGREEMENT", "DISCOVERY", "COURT_FORM", "OTHER"];

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

export default function TemplateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const { data: template, isLoading } = trpc.drafting.getTemplate.useQuery({ id: templateId });
  const { data: mergeFieldSets } = trpc.drafting.listMergeFieldSets.useQuery();
  const { data: matters } = trpc.matters.list.useQuery();
  const { data: versions } = trpc.drafting.listVersions.useQuery({ templateId });

  // Editor state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [practiceArea, setPracticeArea] = useState("");
  const [content, setContent] = useState("");
  const [variables, setVariables] = useState("[]");
  const [hasChanges, setHasChanges] = useState(false);

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [previewMatterId, setPreviewMatterId] = useState("");
  const [showCustomFieldDialog, setShowCustomFieldDialog] = useState(false);
  const [customFieldKey, setCustomFieldKey] = useState("");
  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [customFieldDefault, setCustomFieldDefault] = useState("");

  // Preview data
  const { data: previewData } = trpc.drafting.previewTemplate.useQuery(
    { templateId, matterId: previewMatterId || undefined },
    { enabled: showPreview }
  );

  // Load template data
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setCategory(template.category);
      setPracticeArea(template.practiceArea || "");
      setContent(template.content);
      setVariables(template.variables);
      setHasChanges(false);
      // Expand all sets by default
      const expanded: Record<string, boolean> = {};
      mergeFieldSets?.forEach((s: any) => { expanded[s.id] = true; });
      setExpandedSets(expanded);
    }
  }, [template, mergeFieldSets]);

  const updateTemplate = trpc.drafting.updateTemplate.useMutation({
    onSuccess: () => {
      setHasChanges(false);
      toast({ title: "Template saved" });
      utils.drafting.getTemplate.invalidate({ id: templateId });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveVersion = trpc.drafting.saveVersion.useMutation({
    onSuccess: () => utils.drafting.listVersions.invalidate({ templateId }),
  });

  const restoreVersion = trpc.drafting.restoreVersion.useMutation({
    onSuccess: () => {
      toast({ title: "Version restored" });
      utils.drafting.getTemplate.invalidate({ id: templateId });
      utils.drafting.listVersions.invalidate({ templateId });
      setShowVersions(false);
    },
  });

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateTemplate.mutate({
      id: templateId,
      name,
      description: description || undefined,
      category: category as any,
      practiceArea: practiceArea || undefined,
      content,
      variables,
    });
    saveVersion.mutate({ templateId, changeNote: "Manual save" });
  };

  // Extract used fields from content
  const usedFields = new Set((content.match(/\{\{(\w+)\}\}/g) || []).map((m: string) => m.replace(/\{\{|\}\}/g, "")));

  // Insert merge field at cursor
  const insertField = (key: string) => {
    const tag = `{{${key}}}`;
    if (editorRef.current) {
      const el = editorRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newContent = content.substring(0, start) + tag + content.substring(end);
      setContent(newContent);
      setHasChanges(true);
      // Restore cursor after field
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setContent(content + tag);
      setHasChanges(true);
    }
  };

  // Add custom variable
  const addCustomVariable = () => {
    if (!customFieldKey.trim()) return;
    const key = customFieldKey.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    try {
      const vars = JSON.parse(variables);
      if (vars.some((v: any) => v.name === key)) {
        toast({ title: "Variable already exists", variant: "destructive" });
        return;
      }
      vars.push({ name: key, label: customFieldLabel || key, type: "text", required: false, defaultValue: customFieldDefault || "" });
      setVariables(JSON.stringify(vars));
      setHasChanges(true);
    } catch {
      setVariables(JSON.stringify([{ name: key, label: customFieldLabel || key, type: "text", required: false, defaultValue: customFieldDefault || "" }]));
    }
    setCustomFieldKey("");
    setCustomFieldLabel("");
    setCustomFieldDefault("");
    setShowCustomFieldDialog(false);
  };

  // Get all available field keys (from merge field sets + template variables)
  const allFieldKeys = new Set<string>();
  mergeFieldSets?.forEach((s: any) => {
    try {
      const fields = JSON.parse(s.fields);
      fields.forEach((f: any) => allFieldKeys.add(f.key));
    } catch {}
  });
  try {
    JSON.parse(variables).forEach((v: any) => allFieldKeys.add(v.name));
  } catch {}

  // Render content with highlighted merge fields for the editor view
  const highlightedPreview = content.replace(
    /\{\{(\w+)\}\}/g,
    '<span class="inline-block bg-blue-100 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded border border-blue-200 mx-0.5">{{$1}}</span>'
  );

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!template) return <div className="py-20 text-center text-gray-500">Template not found</div>;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafting/builder"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
            className="text-lg font-semibold bg-transparent border-none outline-none w-64"
            placeholder="Template name"
          />
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>
            {category.replace("_", " ")}
          </span>
          {practiceArea && <span className="text-xs text-gray-500">{practiceArea}</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs ${hasChanges ? "text-amber-600" : "text-green-600"}`}>
            {hasChanges ? "Unsaved changes" : "Saved"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVersions(!showVersions)}
          >
            <History className="h-4 w-4 mr-1" /> Versions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showPreview ? "Editor" : "Preview"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateTemplate.isPending}
            className="bg-rose-600 hover:bg-rose-700"
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Version History Panel */}
      {showVersions && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Version History</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowVersions(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {versions?.map((v: any) => (
              <div key={v.id} className="shrink-0 bg-gray-50 rounded-lg p-3 min-w-[180px] border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">v{v.versionNumber}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => restoreVersion.mutate({ templateId, versionId: v.id })}
                    className="h-6 px-2"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Restore
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{new Date(v.createdAt).toLocaleString()}</p>
                {v.changeNote && <p className="text-xs text-gray-400 mt-0.5">{v.changeNote}</p>}
              </div>
            ))}
            {!versions?.length && <p className="text-xs text-gray-400">No versions saved yet</p>}
          </div>
        </div>
      )}

      {/* Main Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Merge Fields Palette */}
        <div className="w-[20%] min-w-[240px] bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <Input
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search fields..."
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {mergeFieldSets?.map((set: any) => {
              let fields: any[] = [];
              try { fields = JSON.parse(set.fields); } catch {}

              // Filter by search
              if (fieldSearch) {
                fields = fields.filter((f: any) =>
                  f.key.toLowerCase().includes(fieldSearch.toLowerCase()) ||
                  f.label.toLowerCase().includes(fieldSearch.toLowerCase())
                );
                if (fields.length === 0) return null;
              }

              const isExpanded = expandedSets[set.id] !== false;
              const usedCount = fields.filter((f: any) => usedFields.has(f.key)).length;

              return (
                <div key={set.id}>
                  <button
                    onClick={() => setExpandedSets({ ...expandedSets, [set.id]: !isExpanded })}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="flex-1 text-left">{set.name}</span>
                    {usedCount > 0 && (
                      <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                        {usedCount}
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="pl-2 space-y-0.5">
                      {fields.map((f: any) => {
                        const isUsed = usedFields.has(f.key);
                        return (
                          <button
                            key={f.key}
                            onClick={() => insertField(f.key)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-blue-50 group transition-colors"
                            title={`${f.label}\nClick to insert {{${f.key}}}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUsed ? "bg-green-500" : "bg-gray-300"}`} />
                            <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-1 rounded group-hover:bg-blue-100 truncate">
                              {`{{${f.key}}}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Custom Fields Section */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-semibold text-gray-600">Custom Variables</span>
                <button
                  onClick={() => setShowCustomFieldDialog(true)}
                  className="text-rose-600 hover:text-rose-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {(() => {
                try {
                  const vars = JSON.parse(variables);
                  const systemKeys = new Set<string>();
                  mergeFieldSets?.forEach((s: any) => {
                    try { JSON.parse(s.fields).forEach((f: any) => systemKeys.add(f.key)); } catch {}
                  });
                  const customVars = vars.filter((v: any) => !systemKeys.has(v.name));
                  return customVars.map((v: any) => (
                    <button
                      key={v.name}
                      onClick={() => insertField(v.name)}
                      className="w-full flex items-center gap-2 px-4 py-1 rounded text-left hover:bg-blue-50"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${usedFields.has(v.name) ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-1 rounded truncate">
                        {`{{${v.name}}}`}
                      </span>
                    </button>
                  ));
                } catch { return null; }
              })()}
            </div>

            {/* Custom Field Dialog */}
            {showCustomFieldDialog && (
              <div className="mx-2 mt-2 p-3 bg-white rounded-lg border border-rose-200 space-y-2">
                <Label className="text-xs">Field Key</Label>
                <Input
                  value={customFieldKey}
                  onChange={(e) => setCustomFieldKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                  placeholder="CUSTOM_FIELD"
                  className="h-7 text-xs font-mono"
                />
                <Label className="text-xs">Label</Label>
                <Input
                  value={customFieldLabel}
                  onChange={(e) => setCustomFieldLabel(e.target.value)}
                  placeholder="Custom Field"
                  className="h-7 text-xs"
                />
                <Label className="text-xs">Default Value</Label>
                <Input
                  value={customFieldDefault}
                  onChange={(e) => setCustomFieldDefault(e.target.value)}
                  placeholder="Optional"
                  className="h-7 text-xs"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 text-xs bg-rose-600 hover:bg-rose-700" onClick={addCustomVariable}>
                    <Check className="h-3 w-3 mr-1" /> Add
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCustomFieldDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL — Editor / Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Meta Fields Bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 shrink-0">
            <Input
              value={description}
              onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
              placeholder="Template description..."
              className="h-8 text-xs flex-1"
            />
            <Select value={category} onValueChange={(v) => { setCategory(v); setHasChanges(true); }}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={practiceArea}
              onChange={(e) => { setPracticeArea(e.target.value); setHasChanges(true); }}
              placeholder="Practice area"
              className="w-36 h-8 text-xs"
            />
          </div>

          {showPreview ? (
            /* Preview Mode */
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-3 shrink-0">
                <Label className="text-xs">Preview with matter:</Label>
                <Select value={previewMatterId} onValueChange={setPreviewMatterId}>
                  <SelectTrigger className="w-64 h-7 text-xs"><SelectValue placeholder="Select matter for preview..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No matter (unresolved fields)</SelectItem>
                    {matters?.matters?.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.matterNumber} - {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-8 max-w-3xl mx-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewData?.html || highlightedPreview }}
                />
              </div>
            </div>
          ) : (
            /* Editor Mode */
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center gap-1 px-4 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0 text-xs">
                {[
                  { label: "H1", tag: "<h1>", end: "</h1>" },
                  { label: "H2", tag: "<h2>", end: "</h2>" },
                  { label: "H3", tag: "<h3>", end: "</h3>" },
                  { label: "P", tag: "<p>", end: "</p>" },
                  { label: "B", tag: "<strong>", end: "</strong>" },
                  { label: "I", tag: "<em>", end: "</em>" },
                  { label: "U", tag: "<u>", end: "</u>" },
                  { label: "HR", tag: "<hr/>", end: "" },
                  { label: "BR", tag: "<br/>", end: "" },
                  { label: "UL", tag: "<ul>\n<li>", end: "</li>\n</ul>" },
                  { label: "OL", tag: "<ol>\n<li>", end: "</li>\n</ol>" },
                  { label: "Table", tag: '<table style="width:100%;border-collapse:collapse;">\n<tr><td style="border:1px solid #ddd;padding:8px;">', end: "</td></tr>\n</table>" },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => {
                      if (editorRef.current) {
                        const el = editorRef.current;
                        const start = el.selectionStart;
                        const end = el.selectionEnd;
                        const selected = content.substring(start, end);
                        const newContent = content.substring(0, start) + btn.tag + selected + btn.end + content.substring(end);
                        setContent(newContent);
                        setHasChanges(true);
                        setTimeout(() => {
                          el.focus();
                          el.setSelectionRange(start + btn.tag.length, start + btn.tag.length + selected.length);
                        }, 0);
                      }
                    }}
                    className="px-2 py-1 rounded hover:bg-gray-200 font-medium text-gray-600"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="flex-1 w-full p-4 font-mono text-sm resize-none outline-none border-none bg-white"
                spellCheck={false}
                placeholder="Start typing your template content (HTML)..."
              />
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Variable Manager & Info */}
        <div className="w-[25%] min-w-[260px] bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 shrink-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Code className="h-4 w-4" /> Template Variables
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Define variables that users fill when creating documents
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Fields Used Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2">Fields Used in Template</h4>
              <div className="flex flex-wrap gap-1">
                {usedFields.size === 0 ? (
                  <p className="text-xs text-gray-400">No merge fields used yet</p>
                ) : (
                  Array.from(usedFields).map((key) => (
                    <span key={key} className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                      {key}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Variable Definitions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">Variable Definitions</h4>
                <button
                  onClick={() => setShowCustomFieldDialog(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                >
                  + Add
                </button>
              </div>
              {(() => {
                try {
                  const vars = JSON.parse(variables);
                  return vars.map((v: any, i: number) => (
                    <div key={v.name} className="bg-white rounded-lg border border-gray-200 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {`{{${v.name}}}`}
                        </span>
                        <button
                          onClick={() => {
                            const newVars = vars.filter((_: any, j: number) => j !== i);
                            setVariables(JSON.stringify(newVars));
                            setHasChanges(true);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px]">Label</Label>
                          <Input
                            value={v.label || ""}
                            onChange={(e) => {
                              vars[i].label = e.target.value;
                              setVariables(JSON.stringify(vars));
                              setHasChanges(true);
                            }}
                            className="h-6 text-[11px]"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Type</Label>
                          <Select
                            value={v.type || "text"}
                            onValueChange={(val) => {
                              vars[i].type = val;
                              setVariables(JSON.stringify(vars));
                              setHasChanges(true);
                            }}
                          >
                            <SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="textarea">Textarea</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="select">Select</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px]">
                          <input
                            type="checkbox"
                            checked={v.required || false}
                            onChange={(e) => {
                              vars[i].required = e.target.checked;
                              setVariables(JSON.stringify(vars));
                              setHasChanges(true);
                            }}
                            className="rounded border-gray-300"
                          />
                          Required
                        </label>
                        <Input
                          value={v.defaultValue || ""}
                          onChange={(e) => {
                            vars[i].defaultValue = e.target.value;
                            setVariables(JSON.stringify(vars));
                            setHasChanges(true);
                          }}
                          placeholder="Default"
                          className="h-6 text-[10px] flex-1"
                        />
                      </div>
                      {v.type === "select" && (
                        <div>
                          <Label className="text-[10px]">Options (comma-separated)</Label>
                          <Input
                            value={(v.options || []).join(", ")}
                            onChange={(e) => {
                              vars[i].options = e.target.value.split(",").map((o: string) => o.trim()).filter(Boolean);
                              setVariables(JSON.stringify(vars));
                              setHasChanges(true);
                            }}
                            className="h-6 text-[10px]"
                          />
                        </div>
                      )}
                    </div>
                  ));
                } catch {
                  return <p className="text-xs text-gray-400">No variables defined</p>;
                }
              })()}
            </div>

            {/* Template Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
              <h4 className="text-xs font-semibold text-gray-600">Template Info</h4>
              <p className="text-[10px] text-gray-500">Used {template?.usageCount || 0} times</p>
              <p className="text-[10px] text-gray-500">
                {usedFields.size} merge fields, {(() => { try { return JSON.parse(variables).length; } catch { return 0; } })()} variables
              </p>
              <p className="text-[10px] text-gray-500">
                {versions?.length || 0} versions saved
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
