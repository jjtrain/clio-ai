"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, GripVertical, ArrowLeft } from "lucide-react";
import Link from "next/link";

const PRACTICE_AREAS = [
  "Family Law",
  "Criminal Defense",
  "Personal Injury",
  "Estate Planning",
  "Business Law",
  "Real Estate",
  "Immigration",
  "Trademark",
  "Employment Law",
  "Other",
];

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Text Area" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "SELECT", label: "Dropdown" },
  { value: "MULTISELECT", label: "Multi-Select" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "DATE", label: "Date" },
];

const CLIENT_FIELD_MAPS = [
  { value: "", label: "None" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "notes", label: "Notes" },
];

interface FieldDef {
  key: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  placeholder: string;
  helpText: string;
  options: string;
  clientFieldMap: string;
}

const defaultFields: FieldDef[] = [
  {
    key: "f1",
    label: "Full Name",
    fieldType: "TEXT",
    isRequired: true,
    placeholder: "Enter your full name",
    helpText: "",
    options: "",
    clientFieldMap: "name",
  },
  {
    key: "f2",
    label: "Email Address",
    fieldType: "EMAIL",
    isRequired: true,
    placeholder: "your@email.com",
    helpText: "",
    options: "",
    clientFieldMap: "email",
  },
  {
    key: "f3",
    label: "Phone Number",
    fieldType: "PHONE",
    isRequired: false,
    placeholder: "(555) 123-4567",
    helpText: "",
    options: "",
    clientFieldMap: "phone",
  },
  {
    key: "f4",
    label: "How can we help you?",
    fieldType: "TEXTAREA",
    isRequired: true,
    placeholder: "Briefly describe your legal matter...",
    helpText: "",
    options: "",
    clientFieldMap: "notes",
  },
];

export default function NewIntakeFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [confirmationMsg, setConfirmationMsg] = useState(
    "Thank you for your submission. We will review your information and be in touch shortly."
  );
  const [autoCreateClient, setAutoCreateClient] = useState(true);
  const [autoCreateMatter, setAutoCreateMatter] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [fields, setFields] = useState<FieldDef[]>(defaultFields);

  const createMutation = trpc.intakeForms.createTemplate.useMutation({
    onSuccess: (data) => {
      toast({ title: "Form created", description: "Your intake form has been created." });
      router.push(`/intake-forms/${data.id}`);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const addField = () => {
    setFields([
      ...fields,
      {
        key: `f${Date.now()}`,
        label: "",
        fieldType: "TEXT",
        isRequired: false,
        placeholder: "",
        helpText: "",
        options: "",
        clientFieldMap: "",
      },
    ]);
  };

  const removeField = (key: string) => {
    setFields(fields.filter((f) => f.key !== key));
  };

  const updateField = (key: string, updates: Partial<FieldDef>) => {
    setFields(fields.map((f) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Error", description: "Form name is required", variant: "destructive" });
      return;
    }
    if (fields.length === 0) {
      toast({ title: "Error", description: "Add at least one field", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      name,
      description: description || undefined,
      practiceArea: practiceArea || undefined,
      headerText: headerText || undefined,
      confirmationMsg: confirmationMsg || undefined,
      autoCreateClient,
      autoCreateMatter,
      notifyEmail: notifyEmail || undefined,
      fields: fields.map((f, i) => ({
        label: f.label,
        fieldType: f.fieldType as any,
        isRequired: f.isRequired,
        placeholder: f.placeholder || undefined,
        helpText: f.helpText || undefined,
        options: f.options || undefined,
        sortOrder: i,
        clientFieldMap: f.clientFieldMap || null,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/intake-forms">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Create Intake Form
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Build a public form to collect client inquiries
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Form Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Family Law Intake"
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceArea">Practice Area</Label>
              <Select value={practiceArea} onValueChange={setPracticeArea}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select practice area" />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_AREAS.map((pa) => (
                    <SelectItem key={pa} value={pa}>
                      {pa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal description of this form"
              className="bg-white"
            />
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Branding</h2>
          <div className="space-y-2">
            <Label htmlFor="headerText">Header Text</Label>
            <Textarea
              id="headerText"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Custom header shown at the top of the form"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmationMsg">Confirmation Message</Label>
            <Textarea
              id="confirmationMsg"
              value={confirmationMsg}
              onChange={(e) => setConfirmationMsg(e.target.value)}
              placeholder="Message shown after successful submission"
              className="bg-white"
            />
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-create Client</Label>
                <p className="text-sm text-gray-500">
                  Automatically create a client record on submission
                </p>
              </div>
              <Switch
                checked={autoCreateClient}
                onCheckedChange={setAutoCreateClient}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-create Matter</Label>
                <p className="text-sm text-gray-500">
                  Automatically create a matter linked to the new client
                </p>
              </div>
              <Switch
                checked={autoCreateMatter}
                onCheckedChange={setAutoCreateMatter}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notifyEmail">Notification Email</Label>
              <Input
                id="notifyEmail"
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="Email to notify on new submissions"
                className="bg-white"
              />
            </div>
          </div>
        </div>

        {/* Form Builder */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Form Fields</h2>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <Plus className="mr-2 h-4 w-4" />
              Add Field
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.key}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                        onClick={() => moveField(index, "up")}
                        disabled={index === 0}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                        onClick={() => moveField(index, "down")}
                        disabled={index === fields.length - 1}
                      >
                        ▼
                      </button>
                    </div>
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500">
                      Field {index + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={() => removeField(field.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Label *</Label>
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.key, { label: e.target.value })
                      }
                      placeholder="Field label"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={field.fieldType}
                      onValueChange={(v) =>
                        updateField(field.key, { fieldType: v })
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Map to Client Field</Label>
                    <Select
                      value={field.clientFieldMap}
                      onValueChange={(v) =>
                        updateField(field.key, { clientFieldMap: v })
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENT_FIELD_MAPS.map((m) => (
                          <SelectItem key={m.value || "none"} value={m.value || "none"}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                      value={field.placeholder}
                      onChange={(e) =>
                        updateField(field.key, { placeholder: e.target.value })
                      }
                      placeholder="Placeholder text"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Help Text</Label>
                    <Input
                      value={field.helpText}
                      onChange={(e) =>
                        updateField(field.key, { helpText: e.target.value })
                      }
                      placeholder="Help text below the field"
                      className="bg-white"
                    />
                  </div>
                </div>

                {(field.fieldType === "SELECT" ||
                  field.fieldType === "MULTISELECT") && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Options (one per line)
                    </Label>
                    <Textarea
                      value={
                        field.options
                          ? (() => {
                              try {
                                return JSON.parse(field.options).join("\n");
                              } catch {
                                return field.options;
                              }
                            })()
                          : ""
                      }
                      onChange={(e) =>
                        updateField(field.key, {
                          options: JSON.stringify(
                            e.target.value
                              .split("\n")
                              .filter((l) => l.trim())
                          ),
                        })
                      }
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                      className="bg-white"
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.isRequired}
                    onCheckedChange={(v) =>
                      updateField(field.key, { isRequired: v })
                    }
                  />
                  <Label className="text-sm text-gray-600">Required</Label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/intake-forms">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600"
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? "Creating..." : "Create Form"}
          </Button>
        </div>
      </form>
    </div>
  );
}
