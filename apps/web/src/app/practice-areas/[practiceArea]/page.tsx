"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Settings,
  BookOpen,
  Layers,
  FileText,
} from "lucide-react";
import Link from "next/link";

type Tab = "general" | "terminology" | "stages" | "fields";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
  { key: "terminology", label: "Terminology", icon: <BookOpen className="w-4 h-4" /> },
  { key: "stages", label: "Stages", icon: <Layers className="w-4 h-4" /> },
  { key: "fields", label: "Fields", icon: <FileText className="w-4 h-4" /> },
];

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function PracticeAreaDetailPage() {
  const { practiceArea } = useParams<{ practiceArea: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const config = trpc.practiceArea["config.get"].useQuery({ practiceArea });
  const updateMutation = trpc.practiceArea["config.update"].useMutation({
    onSuccess: () => config.refetch(),
  });
  const terminologyMutation = trpc.practiceArea["terminology.update"].useMutation({
    onSuccess: () => config.refetch(),
  });

  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [terminology, setTerminology] = useState<Record<string, string>>({});
  const [stages, setStages] = useState<{ name: string; description: string; order: number }[]>([]);
  const [fields, setFields] = useState<{ fieldName: string; fieldLabel: string; fieldType: string }[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (config.data && !initialized) {
    setDisplayName(config.data.displayName ?? "");
    setColor(config.data.color ?? "");
    setEnabled(config.data.isEnabled ?? false);
    setTerminology(parseJson(config.data.terminology, {}));
    setStages(parseJson(config.data.matterStages, []));
    setFields(parseJson(config.data.matterFields, []));
    setInitialized(true);
  }

  const handleSaveGeneral = () => {
    updateMutation.mutate({ practiceArea, data: { displayName, color, isEnabled: enabled } });
  };

  const handleSaveTerminology = () => {
    terminologyMutation.mutate({ practiceArea, terminology });
  };

  const updateStage = (i: number, key: string, value: string | number) => {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  };

  const updateField = (i: number, key: string, value: string) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/practice-areas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{displayName || practiceArea}</h1>
          <p className="text-sm text-gray-500">Practice area configuration</p>
        </div>
        {color && (
          <Badge style={{ backgroundColor: color, color: "#fff" }} className="ml-auto">
            {color}
          </Badge>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-100 pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className="gap-1.5"
          >
            {tab.icon} {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="flex items-center gap-2">
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              {color && <div className="w-8 h-8 rounded border" style={{ backgroundColor: color }} />}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Enabled</label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <Button onClick={handleSaveGeneral} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" /> Save General
          </Button>
        </div>
      )}

      {activeTab === "terminology" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm font-medium text-gray-500 px-1">
            <span>Key</span><span>Value</span>
          </div>
          {Object.entries(terminology).map(([key, value]) => (
            <div key={key} className="grid grid-cols-2 gap-2">
              <Input value={key} disabled className="bg-gray-50" />
              <Input
                value={value}
                onChange={(e) => setTerminology((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          <Button onClick={handleSaveTerminology} disabled={terminologyMutation.isPending}>
            <Save className="w-4 h-4 mr-2" /> Save Terminology
          </Button>
        </div>
      )}

      {activeTab === "stages" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="grid grid-cols-[1fr_2fr_80px_40px] gap-2 text-sm font-medium text-gray-500 px-1">
            <span>Name</span><span>Description</span><span>Order</span><span />
          </div>
          {stages.map((stage, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_80px_40px] gap-2">
              <Input value={stage.name} onChange={(e) => updateStage(i, "name", e.target.value)} />
              <Input value={stage.description} onChange={(e) => updateStage(i, "description", e.target.value)} />
              <Input type="number" value={stage.order} onChange={(e) => updateStage(i, "order", +e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => setStages((p) => p.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStages((p) => [...p, { name: "", description: "", order: p.length }])}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Stage
          </Button>
        </div>
      )}

      {activeTab === "fields" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 text-sm font-medium text-gray-500 px-1">
            <span>Field Name</span><span>Label</span><span>Type</span><span />
          </div>
          {fields.map((field, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2">
              <Input value={field.fieldName} onChange={(e) => updateField(i, "fieldName", e.target.value)} />
              <Input value={field.fieldLabel} onChange={(e) => updateField(i, "fieldLabel", e.target.value)} />
              <Input value={field.fieldType} onChange={(e) => updateField(i, "fieldType", e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => setFields((p) => p.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFields((p) => [...p, { fieldName: "", fieldLabel: "", fieldType: "text" }])}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Field
          </Button>
        </div>
      )}

      {config.isLoading && <p className="text-center text-gray-400 py-12">Loading configuration...</p>}
    </div>
  );
}
