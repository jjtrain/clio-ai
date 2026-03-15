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
  Plus,
  Trash2,
  Save,
  GripVertical,
  FileText,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface SetTemplateItem {
  templateName: string;
  title: string;
  description: string;
  required: boolean;
}

export default function SetTemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;
  const isNew = id === "new";

  const { data: existing, isLoading } = trpc.drafting.getSetTemplate.useQuery(
    { id },
    { enabled: !isNew }
  );
  const { data: docTemplates } = trpc.drafting.listTemplates.useQuery({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<SetTemplateItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<SetTemplateItem>({ templateName: "", title: "", description: "", required: true });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || "");
      setPracticeArea(existing.practiceArea || "");
      setCategory(existing.category || "");
      try { setItems(JSON.parse(existing.items as string)); } catch { setItems([]); }
    }
  }, [existing]);

  const createMut = trpc.drafting.createSetTemplate.useMutation({
    onSuccess: (data) => { toast({ title: "Template created" }); router.push(`/drafting/sets/templates/${data.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const updateMut = trpc.drafting.updateSetTemplate.useMutation({
    onSuccess: () => toast({ title: "Template saved" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const payload = {
      name,
      description: description || undefined,
      practiceArea: practiceArea || undefined,
      category: category || undefined,
      items: JSON.stringify(items),
    };
    if (isNew) {
      createMut.mutate(payload);
    } else {
      updateMut.mutate({ id, ...payload });
    }
  };

  const addItem = () => {
    if (!newItem.title.trim()) return;
    setItems([...items, { ...newItem }]);
    setNewItem({ templateName: "", title: "", description: "", required: true });
    setShowAddItem(false);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setItems(copy);
  };

  if (!isNew && isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafting/sets/templates"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold">{isNew ? "New Set Template" : "Edit Set Template"}</h1>
        </div>
        <Button
          className="bg-rose-600 hover:bg-rose-700"
          onClick={handleSave}
          disabled={!name.trim() || createMut.isPending || updateMut.isPending}
        >
          <Save className="h-4 w-4 mr-2" /> {createMut.isPending || updateMut.isPending ? "Saving..." : "Save Template"}
        </Button>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="space-y-1">
          <Label>Template Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Personal Injury Litigation Pack" />
        </div>
        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe when to use this template set..." rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Practice Area</Label>
            <Select value={practiceArea} onValueChange={setPracticeArea}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="litigation">Litigation</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="real-estate">Real Estate</SelectItem>
                <SelectItem value="estate-planning">Estate Planning</SelectItem>
                <SelectItem value="family-law">Family Law</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., starter, advanced" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Documents in Set ({items.length})</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAddItem(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Document
          </Button>
        </div>

        {showAddItem && (
          <div className="border border-rose-200 rounded-lg p-4 mb-4 space-y-3 bg-rose-50/50">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Document Title</Label>
                <Input
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="e.g., Engagement Letter"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link to Document Template</Label>
                <Select value={newItem.templateName} onValueChange={(v) => setNewItem({ ...newItem, templateName: v })}>
                  <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked template</SelectItem>
                    {docTemplates?.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Brief description of this document"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newItem.required}
                  onChange={(e) => setNewItem({ ...newItem, required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Required document
              </label>
              <div className="flex-1" />
              <Button size="sm" onClick={addItem} disabled={!newItem.title.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No documents added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.required && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-medium">Required</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {item.templateName && item.templateName !== "none" && (
                      <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> {item.templateName}</span>
                    )}
                    {item.description && <span>· {item.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveItem(idx, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => moveItem(idx, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={idx === items.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
