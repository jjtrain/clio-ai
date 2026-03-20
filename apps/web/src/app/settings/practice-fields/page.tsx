"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Download, Upload, Database } from "lucide-react";

const PRACTICE_AREAS = [
  { key: "real_estate", label: "Real Estate" },
  { key: "criminal", label: "Criminal" },
  { key: "family_law", label: "Family Law" },
  { key: "personal_injury", label: "Personal Injury" },
  { key: "immigration", label: "Immigration" },
  { key: "corporate", label: "Corporate" },
  { key: "general_litigation", label: "General Litigation" },
];

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Textarea" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select" },
  { value: "MULTI_SELECT", label: "Multi-Select" },
  { value: "BOOLEAN", label: "Boolean" },
  { value: "CURRENCY", label: "Currency" },
  { value: "URL", label: "URL" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
];

const SECTIONS = ["details", "parties", "court", "financial", "dates", "custom"];

const TYPE_COLORS: Record<string, string> = {
  TEXT: "bg-gray-100 text-gray-700",
  TEXTAREA: "bg-gray-100 text-gray-700",
  NUMBER: "bg-blue-100 text-blue-700",
  DATE: "bg-purple-100 text-purple-700",
  SELECT: "bg-amber-100 text-amber-700",
  MULTI_SELECT: "bg-amber-100 text-amber-700",
  BOOLEAN: "bg-green-100 text-green-700",
  CURRENCY: "bg-emerald-100 text-emerald-700",
  URL: "bg-cyan-100 text-cyan-700",
  EMAIL: "bg-cyan-100 text-cyan-700",
  PHONE: "bg-cyan-100 text-cyan-700",
};

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/\s/g, "");
}

export default function PracticeAreaFieldsPage() {
  const [activePracticeArea, setActivePracticeArea] = useState("real_estate");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [section, setSection] = useState("details");
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [helpText, setHelpText] = useState("");
  const [fieldOptions, setFieldOptions] = useState("");
  const seededRef = useRef(false);

  const utils = trpc.useUtils();

  const seedDefaults = trpc.practiceAreaFields["fields.seedDefaults"].useMutation();
  const createField = trpc.practiceAreaFields["fields.create"].useMutation({
    onSuccess: () => {
      utils.practiceAreaFields["fields.list"].invalidate();
      resetForm();
      setDialogOpen(false);
    },
  });
  const deleteField = trpc.practiceAreaFields["fields.delete"].useMutation({
    onSuccess: () => {
      utils.practiceAreaFields["fields.list"].invalidate();
    },
  });
  const { data: exportData, refetch: exportFields } = trpc.practiceAreaFields["fields.export"].useQuery({ practiceArea: activePracticeArea }, { enabled: false });

  const { data: fields, isLoading } = trpc.practiceAreaFields["fields.list"].useQuery({
    practiceArea: activePracticeArea,
  });

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      seedDefaults.mutate();
    }
  }, []);

  function resetForm() {
    setFieldLabel("");
    setFieldType("TEXT");
    setSection("details");
    setIsRequired(false);
    setPlaceholder("");
    setHelpText("");
    setFieldOptions("");
  }

  function handleCreate() {
    const payload: Record<string, unknown> = {
      practiceArea: activePracticeArea,
      fieldLabel,
      fieldName: toCamelCase(fieldLabel),
      fieldType,
      section,
      isRequired,
      placeholder: placeholder || undefined,
      helpText: helpText || undefined,
    };
    if (fieldType === "SELECT" || fieldType === "MULTI_SELECT") {
      payload.fieldOptions = fieldOptions.split(",").map((o) => o.trim()).filter(Boolean);
    }
    createField.mutate(payload as any);
  }

  function handleDelete(id: string) {
    if (window.confirm("Are you sure you want to delete this field?")) {
      deleteField.mutate({ fieldId: id });
    }
  }

  async function handleExport() {
    const { data: result } = await exportFields();
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      alert("Exported JSON copied to clipboard!");
    } catch {
      alert(JSON.stringify(result, null, 2));
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Practice Area Fields</h1>
        <p className="text-gray-500 mt-1">
          Configure custom fields that appear on matters by practice area
        </p>
      </div>

      {/* Practice Area Tabs */}
      <div className="flex gap-2 flex-wrap">
        {PRACTICE_AREAS.map((area) => (
          <Button
            key={area.key}
            variant={activePracticeArea === area.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePracticeArea(area.key)}
          >
            {area.label}
          </Button>
        ))}
      </div>

      {/* Fields Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Fields</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                <Plus className="h-4 w-4 mr-1" /> Add Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Field</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Field Label</label>
                  <Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="e.g. Property Address" />
                  {fieldLabel && (
                    <p className="text-xs text-gray-400">Name: {toCamelCase(fieldLabel)}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Field Type</label>
                    <Select value={fieldType} onValueChange={setFieldType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Section</label>
                    <Select value={section} onValueChange={setSection}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isRequired" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="rounded" />
                  <label htmlFor="isRequired" className="text-sm text-gray-700">Required field</label>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Placeholder</label>
                  <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} placeholder="Placeholder text" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Help Text</label>
                  <Input value={helpText} onChange={(e) => setHelpText(e.target.value)} placeholder="Help text for users" />
                </div>
                {(fieldType === "SELECT" || fieldType === "MULTI_SELECT") && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Options (comma-separated)</label>
                    <Input value={fieldOptions} onChange={(e) => setFieldOptions(e.target.value)} placeholder="Option 1, Option 2, Option 3" />
                  </div>
                )}
                <Button onClick={handleCreate} disabled={!fieldLabel || createField.isLoading} className="w-full bg-blue-500 hover:bg-blue-600">
                  {createField.isLoading ? "Creating..." : "Create Field"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading fields...</div>
        ) : !fields?.length ? (
          <div className="p-8 text-center text-gray-400">No fields configured for this practice area.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Required</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(Object.values(fields ?? {}).flat() as any[]).map((field: any) => (
                <tr key={field.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-500">{field.displayOrder}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{field.fieldLabel}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={TYPE_COLORS[field.fieldType] || ""}>
                      {field.fieldType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{field.section}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {field.isRequired && <Badge className="bg-red-100 text-red-700">Required</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${field.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(field.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isLoading}>
          <Database className="h-4 w-4 mr-1" />
          {seedDefaults.isLoading ? "Seeding..." : "Seed Default Fields"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button variant="outline" size="sm" disabled>
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
      </div>
    </div>
  );
}
