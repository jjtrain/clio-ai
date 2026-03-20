"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LayoutList, Palette, Settings, Share2, Plus, Trash2, GripVertical,
  Copy, Check, Link as LinkIcon,
} from "lucide-react";

const fieldTypes = ["text", "email", "phone", "textarea", "select", "checkbox", "date", "number"];

export default function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const { data: form, refetch } = trpc.intakeForms["forms.get"].useQuery({ formId });
  const updateForm = trpc.intakeForms["forms.update"].useMutation({ onSuccess: () => refetch() });

  const [fields, setFields] = useState<any[]>([]);
  const [branding, setBranding] = useState({ firmName: "", primaryColor: "#2563eb", logoUrl: "" });
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [settings, setSettings] = useState({
    published: false, captcha: true, autoCreateLead: false,
    notificationEmails: "", passwordProtection: "",
  });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!form) return;
    try { setFields(JSON.parse(form.fields)); } catch { setFields([]); }
    const brandObj = form.branding ? JSON.parse(form.branding) : {};
    setBranding({ firmName: brandObj.firmName ?? "", primaryColor: brandObj.primaryColor ?? "#2563eb", logoUrl: brandObj.logoUrl ?? "" });
    setConfirmationMessage(form.confirmationMessage ?? "Thank you for your submission.");
    setSettings({
      published: form.isPublished ?? false, captcha: form.captchaEnabled ?? true,
      autoCreateLead: form.autoCreateLead ?? false,
      notificationEmails: form.notificationEmails ?? "",
      passwordProtection: form.password ?? "",
    });
  }, [form]);

  const save = () => {
    updateForm.mutate({ formId, data: { fields: JSON.stringify(fields), branding: JSON.stringify(branding), confirmationMessage, isPublished: settings.published, captchaEnabled: settings.captcha, autoCreateLead: settings.autoCreateLead, notificationEmails: settings.notificationEmails, password: settings.passwordProtection || null } });
  };

  const addField = () => {
    setFields([...fields, { id: crypto.randomUUID(), label: "New Field", type: "text", required: false }]);
  };

  const updateField = (idx: number, patch: any) => {
    setFields(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => setFields(fields.filter((_, i) => i !== idx));

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/intake/${formId}" width="100%" height="800" frameborder="0"></iframe>`;
  const directLink = `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${formId}`;

  if (!form) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{form.name}</h1>
          <Badge variant="outline" className="mt-1">{form.practiceArea}</Badge>
        </div>
        <Button onClick={save} disabled={updateForm.isPending}>
          {updateForm.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields"><LayoutList className="w-4 h-4 mr-1" />Fields</TabsTrigger>
          <TabsTrigger value="design"><Palette className="w-4 h-4 mr-1" />Design</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Settings</TabsTrigger>
          <TabsTrigger value="sharing"><Share2 className="w-4 h-4 mr-1" />Sharing</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-3 mt-4">
          {fields.map((field, idx) => (
            <Card key={field.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <Input className="flex-1" value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })} placeholder="Field label" />
                  <Select value={field.type} onValueChange={(v) => updateField(idx, { type: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fieldTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { required: v })} />
                    <span className="text-xs text-gray-500">Required</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeField(idx)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addField}><Plus className="w-4 h-4 mr-1" />Add Field</Button>
        </TabsContent>

        <TabsContent value="design" className="mt-4">
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Firm Name</Label>
                <Input value={branding.firmName} onChange={(e) => setBranding({ ...branding, firmName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="w-32" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Confirmation Message</Label>
                <Textarea value={confirmationMessage} onChange={(e) => setConfirmationMessage(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardContent className="pt-5 space-y-5">
              {([
                ["published", "Published", "Make this form publicly accessible"],
                ["captcha", "CAPTCHA Verification", "Require CAPTCHA before submission"],
                ["autoCreateLead", "Auto-Create Lead", "Automatically create a lead record on submission"],
              ] as const).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                  <Switch checked={settings[key]} onCheckedChange={(v) => setSettings({ ...settings, [key]: v })} />
                </div>
              ))}
              <div className="space-y-2">
                <Label>Notification Emails</Label>
                <Input value={settings.notificationEmails} onChange={(e) => setSettings({ ...settings, notificationEmails: e.target.value })} placeholder="email@firm.com, other@firm.com" />
              </div>
              <div className="space-y-2">
                <Label>Password Protection</Label>
                <Input type="password" value={settings.passwordProtection} onChange={(e) => setSettings({ ...settings, passwordProtection: e.target.value })} placeholder="Leave blank for no password" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sharing" className="mt-4 space-y-4">
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><LinkIcon className="w-4 h-4" />Direct Link</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input readOnly value={directLink} className="font-mono text-sm" />
                <Button variant="outline" onClick={() => copyText(directLink, "link")}>
                  {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Embed Code</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Textarea readOnly value={embedCode} className="font-mono text-xs" rows={3} />
                <Button variant="outline" onClick={() => copyText(embedCode, "embed")} className="shrink-0">
                  {copied === "embed" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
