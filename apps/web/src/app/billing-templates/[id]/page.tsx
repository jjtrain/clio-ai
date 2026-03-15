"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Save,
  Eye,
  Palette,
  Layout,
  Type,
  Code,
  RefreshCw,
} from "lucide-react";

interface Branding {
  firmName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  showLogo: boolean;
}

interface LayoutSettings {
  headerStyle: string;
  showMatterDetails: boolean;
  showTimeEntryDetails: boolean;
  showExpenseDetails: boolean;
  showPaymentHistory: boolean;
  showTrustBalance: boolean;
  showRemittanceSlip: boolean;
  groupTimeBy: string;
  showHourlyBreakdown: boolean;
  showTotalHours: boolean;
  termsAndConditions?: string;
  paymentInstructions?: string;
}

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("SUMMARY");
  const [branding, setBranding] = useState<Branding>({
    firmName: "Your Law Firm",
    primaryColor: "#1E40AF",
    accentColor: "#3B82F6",
    fontFamily: "Inter",
    showLogo: true,
  });
  const [layout, setLayout] = useState<LayoutSettings>({
    headerStyle: "centered",
    showMatterDetails: true,
    showTimeEntryDetails: false,
    showExpenseDetails: true,
    showPaymentHistory: true,
    showTrustBalance: true,
    showRemittanceSlip: false,
    groupTimeBy: "none",
    showHourlyBreakdown: false,
    showTotalHours: false,
    termsAndConditions: "Payment is due within 30 days of invoice date.",
    paymentInstructions: "",
  });
  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [cssOverrides, setCssOverrides] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const { data: template, isLoading } = trpc.invoiceTemplates.getById.useQuery(
    { id: templateId },
    { enabled: !!templateId }
  );

  const updateMutation = trpc.invoiceTemplates.update.useMutation({
    onSuccess: () => {
      toast({ title: "Template saved" });
    },
    onError: (error) => {
      toast({ title: "Error saving template", description: error.message, variant: "destructive" });
    },
  });

  const previewMutation = trpc.invoiceTemplates.renderPreviewFromData.useMutation({
    onSuccess: (data) => {
      setPreviewHtml(data.html);
    },
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setFormat(template.format);
      try { setBranding(JSON.parse(template.branding as string)); } catch {}
      try { setLayout(JSON.parse(template.layout as string)); } catch {}
      setHeaderHtml(template.headerHtml || "");
      setFooterHtml(template.footerHtml || "");
      setCssOverrides(template.cssOverrides || "");
    }
  }, [template]);

  const refreshPreview = useCallback(() => {
    previewMutation.mutate({
      branding: JSON.stringify(branding),
      layout: JSON.stringify(layout),
      format,
      headerHtml: headerHtml || undefined,
      footerHtml: footerHtml || undefined,
      cssOverrides: cssOverrides || undefined,
    });
  }, [branding, layout, format, headerHtml, footerHtml, cssOverrides]);

  // Auto-refresh preview on load
  useEffect(() => {
    if (template) {
      refreshPreview();
    }
  }, [template]);

  const handleSave = () => {
    updateMutation.mutate({
      id: templateId,
      name,
      description: description || undefined,
      format,
      branding: JSON.stringify(branding),
      layout: JSON.stringify(layout),
      headerHtml: headerHtml || undefined,
      footerHtml: footerHtml || undefined,
      cssOverrides: cssOverrides || undefined,
    });
  };

  const updateBranding = (key: keyof Branding, value: string | boolean) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
  };

  const updateLayout = (key: keyof LayoutSettings, value: string | boolean) => {
    setLayout((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing-templates">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Edit Template</h1>
            <p className="text-gray-500 mt-1 text-sm">{name || "Untitled"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshPreview} disabled={previewMutation.isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${previewMutation.isLoading ? "animate-spin" : ""}`} />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isLoading} className="bg-blue-500 hover:bg-blue-600">
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left: Settings */}
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Basic Info</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Template Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." />
              </div>
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUMMARY">Summary</SelectItem>
                    <SelectItem value="DETAILED">Detailed</SelectItem>
                    <SelectItem value="TIMEKEEPER">Timekeeper</SelectItem>
                    <SelectItem value="FLAT_FEE">Flat Fee</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tabs for different settings */}
          <Tabs defaultValue="branding" className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent px-2 pt-2">
              <TabsTrigger value="branding" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Branding
              </TabsTrigger>
              <TabsTrigger value="layout" className="gap-1.5">
                <Layout className="h-3.5 w-3.5" />
                Layout
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1.5">
                <Type className="h-3.5 w-3.5" />
                Content
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-1.5">
                <Code className="h-3.5 w-3.5" />
                Advanced
              </TabsTrigger>
            </TabsList>

            <TabsContent value="branding" className="p-5 space-y-4">
              <div className="space-y-1">
                <Label>Firm Name</Label>
                <Input value={branding.firmName} onChange={(e) => updateBranding("firmName", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => updateBranding("primaryColor", e.target.value)}
                      className="h-10 w-12 rounded border cursor-pointer"
                    />
                    <Input value={branding.primaryColor} onChange={(e) => updateBranding("primaryColor", e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.accentColor}
                      onChange={(e) => updateBranding("accentColor", e.target.value)}
                      className="h-10 w-12 rounded border cursor-pointer"
                    />
                    <Input value={branding.accentColor} onChange={(e) => updateBranding("accentColor", e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Font Family</Label>
                <Select value={branding.fontFamily} onValueChange={(v) => updateBranding("fontFamily", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter (Modern)</SelectItem>
                    <SelectItem value="Merriweather">Merriweather (Serif)</SelectItem>
                    <SelectItem value="Roboto">Roboto (Clean)</SelectItem>
                    <SelectItem value="Georgia">Georgia (Classic)</SelectItem>
                    <SelectItem value="Arial">Arial (Simple)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={branding.showLogo}
                  onCheckedChange={(v) => updateBranding("showLogo", !!v)}
                />
                <Label>Show firm logo</Label>
              </div>
            </TabsContent>

            <TabsContent value="layout" className="p-5 space-y-4">
              <div className="space-y-1">
                <Label>Header Style</Label>
                <Select value={layout.headerStyle} onValueChange={(v) => updateLayout("headerStyle", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centered">Centered</SelectItem>
                    <SelectItem value="left">Left Aligned</SelectItem>
                    <SelectItem value="split">Split (Logo Left, Info Right)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Group Time Entries By</Label>
                <Select value={layout.groupTimeBy} onValueChange={(v) => updateLayout("groupTimeBy", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="timekeeper">Timekeeper</SelectItem>
                    <SelectItem value="task">Task Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Sections to Show</Label>
                {[
                  { key: "showMatterDetails" as const, label: "Matter details" },
                  { key: "showTimeEntryDetails" as const, label: "Time entry details" },
                  { key: "showExpenseDetails" as const, label: "Expense details" },
                  { key: "showPaymentHistory" as const, label: "Payment history" },
                  { key: "showTrustBalance" as const, label: "Trust balance" },
                  { key: "showRemittanceSlip" as const, label: "Remittance slip" },
                  { key: "showHourlyBreakdown" as const, label: "Hourly breakdown" },
                  { key: "showTotalHours" as const, label: "Total hours" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      checked={layout[key] as boolean}
                      onCheckedChange={(v) => updateLayout(key, !!v)}
                    />
                    <Label className="font-normal">{label}</Label>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="content" className="p-5 space-y-4">
              <div className="space-y-1">
                <Label>Terms & Conditions</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-gray-200 px-3 py-2 text-sm"
                  value={layout.termsAndConditions || ""}
                  onChange={(e) => updateLayout("termsAndConditions", e.target.value)}
                  placeholder="Payment terms..."
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Instructions</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-gray-200 px-3 py-2 text-sm"
                  value={layout.paymentInstructions || ""}
                  onChange={(e) => updateLayout("paymentInstructions", e.target.value)}
                  placeholder="How to pay..."
                />
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="p-5 space-y-4">
              <div className="space-y-1">
                <Label>Custom Header HTML</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-gray-200 px-3 py-2 text-sm font-mono"
                  value={headerHtml}
                  onChange={(e) => setHeaderHtml(e.target.value)}
                  placeholder="<div>Custom header...</div>"
                />
              </div>
              <div className="space-y-1">
                <Label>Custom Footer HTML</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-gray-200 px-3 py-2 text-sm font-mono"
                  value={footerHtml}
                  onChange={(e) => setFooterHtml(e.target.value)}
                  placeholder="<div>Custom footer...</div>"
                />
              </div>
              <div className="space-y-1">
                <Label>CSS Overrides</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-gray-200 px-3 py-2 text-sm font-mono"
                  value={cssOverrides}
                  onChange={(e) => setCssOverrides(e.target.value)}
                  placeholder=".invoice-header { ... }"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Live Preview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Eye className="h-4 w-4" />
              Live Preview
            </div>
            <Button variant="ghost" size="sm" onClick={refreshPreview} disabled={previewMutation.isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${previewMutation.isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="h-[calc(100vh-200px)] overflow-auto">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border-0"
                title="Invoice Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Click Preview to see your invoice</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
