"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Copy,
  Code,
  ExternalLink,
  UserPlus,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const LEAD_STATUSES = [
  { value: "NEW", label: "New", color: "bg-blue-100 text-blue-700" },
  { value: "CONTACTED", label: "Contacted", color: "bg-yellow-100 text-yellow-700" },
  { value: "QUALIFIED", label: "Qualified", color: "bg-purple-100 text-purple-700" },
  { value: "CONVERTED", label: "Converted", color: "bg-emerald-100 text-emerald-700" },
  { value: "DECLINED", label: "Declined", color: "bg-red-100 text-red-700" },
  { value: "ARCHIVED", label: "Archived", color: "bg-gray-100 text-gray-600" },
];

const PRACTICE_AREAS = [
  "Family Law", "Criminal Defense", "Personal Injury", "Estate Planning",
  "Business Law", "Real Estate", "Immigration", "Trademark", "Employment Law", "Other",
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
  { value: "none", label: "None" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "notes", label: "Notes" },
];

export default function IntakeFormDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<"settings" | "submissions">("submissions");
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: template, isLoading, refetch } =
    trpc.intakeForms.getTemplate.useQuery({ id });

  const { data: submissionsData, refetch: refetchSubs } =
    trpc.intakeForms.listSubmissions.useQuery({
      templateId: id,
      status: statusFilter ? (statusFilter as any) : undefined,
    });

  const { data: submissionDetail } = trpc.intakeForms.getSubmission.useQuery(
    { id: selectedSubmission! },
    { enabled: !!selectedSubmission }
  );

  const updateMutation = trpc.intakeForms.updateTemplate.useMutation({
    onSuccess: () => {
      toast({ title: "Saved", description: "Template updated." });
      refetch();
    },
    onError: (err) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateStatusMutation = trpc.intakeForms.updateSubmissionStatus.useMutation({
    onSuccess: () => refetchSubs(),
  });

  const addNoteMutation = trpc.intakeForms.addSubmissionNote.useMutation({
    onSuccess: () => refetchSubs(),
  });

  const convertMutation = trpc.intakeForms.convertToClient.useMutation({
    onSuccess: (client) => {
      toast({ title: "Client created", description: `${client.name} has been added.` });
      refetchSubs();
      setSelectedSubmission(null);
    },
    onError: (err) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyLink = () => {
    if (!template) return;
    const url = `${window.location.origin}/intake/${template.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  const copyEmbed = () => {
    if (!template) return;
    const url = `${window.location.origin}/intake/${template.slug}`;
    const code = `<iframe src="${url}" width="100%" height="800" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: "Embed code copied" });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-24">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500">Template not found</p>
      </div>
    );
  }

  const statusColor = (status: string) =>
    LEAD_STATUSES.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/intake-forms">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {template.name}
          </h1>
          <p className="text-gray-500 text-sm">
            {template._count.submissions} submission{template._count.submissions !== 1 ? "s" : ""}
            {template.practiceArea && ` \u00b7 ${template.practiceArea}`}
          </p>
        </div>
      </div>

      {/* Public Link Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Public Link</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <code className="flex-1 bg-gray-50 px-3 py-2 rounded text-sm text-gray-700 overflow-x-auto w-full">
            {typeof window !== "undefined"
              ? `${window.location.origin}/intake/${template.slug}`
              : `/intake/${template.slug}`}
          </code>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={copyEmbed}>
              <Code className="mr-2 h-4 w-4" />
              Embed Code
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/intake/${template.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "submissions"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setTab("submissions")}
        >
          Submissions
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "settings"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>

      {/* Submissions Tab */}
      {tab === "submissions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-600">Name</TableHead>
                    <TableHead className="font-semibold text-gray-600">Email</TableHead>
                    <TableHead className="font-semibold text-gray-600">Phone</TableHead>
                    <TableHead className="font-semibold text-gray-600">Status</TableHead>
                    <TableHead className="font-semibold text-gray-600">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!submissionsData?.submissions.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                        No submissions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    submissionsData.submissions.map((sub) => (
                      <TableRow
                        key={sub.id}
                        className="hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => setSelectedSubmission(sub.id)}
                      >
                        <TableCell className="font-medium text-gray-900">
                          {sub.submitterName || "Unknown"}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {sub.submitterEmail || "-"}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {sub.submitterPhone || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(sub.status)}`}
                          >
                            {sub.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {formatDate(sub.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <SettingsForm template={template} onSave={updateMutation.mutate} isLoading={updateMutation.isLoading} />
      )}

      {/* Submission Detail Dialog */}
      <Dialog
        open={!!selectedSubmission}
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {submissionDetail && (
            <div className="space-y-4">
              <div className="space-y-3">
                {submissionDetail.answers.map((answer, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-gray-600">
                      {answer.label}
                    </p>
                    <p className="text-gray-900">
                      {answer.value !== null && answer.value !== undefined
                        ? typeof answer.value === "boolean"
                          ? answer.value
                            ? "Yes"
                            : "No"
                          : String(answer.value)
                        : "-"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm">Status</Label>
                  <Select
                    value={submissionDetail.status}
                    onValueChange={(v) =>
                      updateStatusMutation.mutate({
                        id: submissionDetail.id,
                        status: v as any,
                      })
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm">Internal Notes</Label>
                  <Textarea
                    defaultValue={submissionDetail.notes || ""}
                    onBlur={(e) =>
                      addNoteMutation.mutate({
                        id: submissionDetail.id,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Add internal notes..."
                    className="bg-white"
                  />
                </div>

                {submissionDetail.clientId ? (
                  <div className="text-sm text-emerald-600">
                    Linked to client:{" "}
                    <Link
                      href={`/clients/${submissionDetail.clientId}`}
                      className="underline"
                    >
                      View Client
                    </Link>
                    {submissionDetail.matterId && (
                      <>
                        {" \u00b7 "}
                        <Link
                          href={`/matters/${submissionDetail.matterId}`}
                          className="underline"
                        >
                          View Matter
                        </Link>
                      </>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() =>
                      convertMutation.mutate({
                        submissionId: submissionDetail.id,
                      })
                    }
                    disabled={convertMutation.isLoading}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {convertMutation.isLoading
                      ? "Converting..."
                      : "Convert to Client"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Settings form component
function SettingsForm({
  template,
  onSave,
  isLoading,
}: {
  template: any;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [practiceArea, setPracticeArea] = useState(template.practiceArea || "");
  const [headerText, setHeaderText] = useState(template.headerText || "");
  const [confirmationMsg, setConfirmationMsg] = useState(template.confirmationMsg || "");
  const [autoCreateClient, setAutoCreateClient] = useState(template.autoCreateClient);
  const [autoCreateMatter, setAutoCreateMatter] = useState(template.autoCreateMatter);
  const [isPublic, setIsPublic] = useState(template.isPublic);
  const [notifyEmail, setNotifyEmail] = useState(template.notifyEmail || "");
  const [fields, setFields] = useState(
    template.fields.map((f: any, i: number) => ({
      key: f.id,
      label: f.label,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      placeholder: f.placeholder || "",
      helpText: f.helpText || "",
      options: f.options || "",
      clientFieldMap: f.clientFieldMap || "",
    }))
  );

  const addField = () => {
    setFields([
      ...fields,
      {
        key: `new-${Date.now()}`,
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
    setFields(fields.filter((f: any) => f.key !== key));
  };

  const updateField = (key: string, updates: any) => {
    setFields(fields.map((f: any) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSave = () => {
    onSave({
      id: template.id,
      name,
      description: description || undefined,
      practiceArea: practiceArea || undefined,
      headerText: headerText || undefined,
      confirmationMsg: confirmationMsg || undefined,
      autoCreateClient,
      autoCreateMatter,
      isPublic,
      notifyEmail: notifyEmail || undefined,
      fields: fields.map((f: any, i: number) => ({
        label: f.label,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        placeholder: f.placeholder || undefined,
        helpText: f.helpText || undefined,
        options: f.options || undefined,
        sortOrder: i,
        clientFieldMap: f.clientFieldMap === "none" ? null : f.clientFieldMap || null,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Form Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label>Practice Area</Label>
            <Select value={practiceArea} onValueChange={setPracticeArea}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select practice area" />
              </SelectTrigger>
              <SelectContent>
                {PRACTICE_AREAS.map((pa) => (
                  <SelectItem key={pa} value={pa}>{pa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Branding</h2>
        <div className="space-y-2">
          <Label>Header Text</Label>
          <Textarea value={headerText} onChange={(e) => setHeaderText(e.target.value)} className="bg-white" />
        </div>
        <div className="space-y-2">
          <Label>Confirmation Message</Label>
          <Textarea value={confirmationMsg} onChange={(e) => setConfirmationMsg(e.target.value)} className="bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Public</Label>
              <p className="text-sm text-gray-500">Make this form accessible via public link</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-create Client</Label>
              <p className="text-sm text-gray-500">Create a client record on submission</p>
            </div>
            <Switch checked={autoCreateClient} onCheckedChange={setAutoCreateClient} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-create Matter</Label>
              <p className="text-sm text-gray-500">Create a matter linked to the new client</p>
            </div>
            <Switch checked={autoCreateMatter} onCheckedChange={setAutoCreateMatter} />
          </div>
          <div className="space-y-2">
            <Label>Notification Email</Label>
            <Input type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} className="bg-white" placeholder="Email to notify" />
          </div>
        </div>
      </div>

      {/* Form Fields Editor */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Form Fields</h2>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field: any, index: number) => (
            <div key={field.key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" className="text-gray-400 hover:text-gray-600 text-xs leading-none" onClick={() => moveField(index, "up")} disabled={index === 0}>▲</button>
                    <button type="button" className="text-gray-400 hover:text-gray-600 text-xs leading-none" onClick={() => moveField(index, "down")} disabled={index === fields.length - 1}>▼</button>
                  </div>
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Field {index + 1}</span>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeField(field.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Label *</Label>
                  <Input value={field.label} onChange={(e) => updateField(field.key, { label: e.target.value })} className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={field.fieldType} onValueChange={(v) => updateField(field.key, { fieldType: v })}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => (<SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Map to Client Field</Label>
                  <Select value={field.clientFieldMap || "none"} onValueChange={(v) => updateField(field.key, { clientFieldMap: v === "none" ? "" : v })}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {CLIENT_FIELD_MAPS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Placeholder</Label>
                  <Input value={field.placeholder} onChange={(e) => updateField(field.key, { placeholder: e.target.value })} className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Help Text</Label>
                  <Input value={field.helpText} onChange={(e) => updateField(field.key, { helpText: e.target.value })} className="bg-white" />
                </div>
              </div>
              {(field.fieldType === "SELECT" || field.fieldType === "MULTISELECT") && (
                <div className="space-y-1">
                  <Label className="text-xs">Options (one per line)</Label>
                  <Textarea
                    value={field.options ? (() => { try { return JSON.parse(field.options).join("\n"); } catch { return field.options; } })() : ""}
                    onChange={(e) => updateField(field.key, { options: JSON.stringify(e.target.value.split("\n").filter((l: string) => l.trim())) })}
                    className="bg-white" rows={3}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={field.isRequired} onCheckedChange={(v) => updateField(field.key, { isRequired: v })} />
                <Label className="text-sm text-gray-600">Required</Label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSave} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
