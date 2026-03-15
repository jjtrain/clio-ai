"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  FileText,
  Clock,
  Users,
  DollarSign,
  Sparkles,
  Copy,
  Plus,
} from "lucide-react";

const PRESETS = [
  {
    key: "summary",
    name: "Standard Summary",
    description: "Clean, minimal invoice with line item summary",
    icon: FileText,
    format: "SUMMARY",
    color: "#1E40AF",
    branding: { firmName: "Your Law Firm", primaryColor: "#1E40AF", accentColor: "#3B82F6", fontFamily: "Inter", showLogo: true },
    layout: { headerStyle: "centered", showMatterDetails: true, showTimeEntryDetails: false, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: true, showRemittanceSlip: false, groupTimeBy: "none", showHourlyBreakdown: false, showTotalHours: false, termsAndConditions: "Payment is due within 30 days of invoice date.", paymentInstructions: "Please include invoice number with your payment." },
  },
  {
    key: "detailed",
    name: "Detailed Hourly",
    description: "Full time entry breakdown grouped by date",
    icon: Clock,
    format: "DETAILED",
    color: "#7C3AED",
    branding: { firmName: "Your Law Firm", primaryColor: "#7C3AED", accentColor: "#8B5CF6", fontFamily: "Inter", showLogo: true },
    layout: { headerStyle: "left", showMatterDetails: true, showTimeEntryDetails: true, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: true, showRemittanceSlip: false, groupTimeBy: "date", showHourlyBreakdown: true, showTotalHours: true, termsAndConditions: "Payment is due within 30 days of invoice date." },
  },
  {
    key: "timekeeper",
    name: "Timekeeper Report",
    description: "Entries grouped by attorney for multi-attorney matters",
    icon: Users,
    format: "TIMEKEEPER",
    color: "#B45309",
    branding: { firmName: "Your Law Firm", primaryColor: "#B45309", accentColor: "#D97706", fontFamily: "Merriweather", showLogo: true },
    layout: { headerStyle: "split", showMatterDetails: true, showTimeEntryDetails: true, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: false, showRemittanceSlip: false, groupTimeBy: "timekeeper", showHourlyBreakdown: true, showTotalHours: true },
  },
  {
    key: "flatfee",
    name: "Flat Fee Simple",
    description: "Simple service and fee layout without hourly detail",
    icon: DollarSign,
    format: "FLAT_FEE",
    color: "#047857",
    branding: { firmName: "Your Law Firm", primaryColor: "#047857", accentColor: "#10B981", fontFamily: "Inter", showLogo: true },
    layout: { headerStyle: "centered", showMatterDetails: true, showTimeEntryDetails: false, showExpenseDetails: false, showPaymentHistory: true, showTrustBalance: false, showRemittanceSlip: false, groupTimeBy: "none", showHourlyBreakdown: false, showTotalHours: false, paymentInstructions: "Payment is due upon receipt. Please include invoice number with your payment." },
  },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"choose" | "custom">("choose");
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customFormat, setCustomFormat] = useState("SUMMARY");

  const { data: templates } = trpc.invoiceTemplates.list.useQuery();

  const createMutation = trpc.invoiceTemplates.create.useMutation({
    onSuccess: (tmpl) => {
      toast({ title: "Template created" });
      router.push(`/billing/templates/${tmpl.id}`);
    },
    onError: (error) => {
      toast({ title: "Error creating template", description: error.message, variant: "destructive" });
    },
  });

  const duplicateMutation = trpc.invoiceTemplates.duplicate.useMutation({
    onSuccess: (tmpl) => {
      toast({ title: "Template duplicated" });
      router.push(`/billing/templates/${tmpl.id}`);
    },
  });

  const handlePreset = (preset: typeof PRESETS[0]) => {
    createMutation.mutate({
      name: preset.name,
      description: preset.description,
      format: preset.format,
      branding: JSON.stringify(preset.branding),
      layout: JSON.stringify(preset.layout),
    });
  };

  const handleCustom = () => {
    if (!customName.trim()) {
      toast({ title: "Please enter a template name", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: customName,
      description: customDescription || undefined,
      format: customFormat,
      branding: JSON.stringify({ firmName: "Your Law Firm", primaryColor: "#1E40AF", accentColor: "#3B82F6", fontFamily: "Inter", showLogo: true }),
      layout: JSON.stringify({ headerStyle: "centered", showMatterDetails: true, showTimeEntryDetails: false, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: false, showRemittanceSlip: false, groupTimeBy: "none", showHourlyBreakdown: false, showTotalHours: false, termsAndConditions: "Payment is due within 30 days of invoice date." }),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/billing/templates">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">New Template</h1>
          <p className="text-gray-500 mt-1 text-sm">Start from a preset or create from scratch</p>
        </div>
      </div>

      {/* Preset Templates */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Start from a Preset
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.key}
                onClick={() => handlePreset(preset)}
                disabled={createMutation.isLoading}
                className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className="p-2.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: preset.color + "15", color: preset.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{preset.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{preset.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duplicate Existing */}
      {templates && templates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Copy className="h-5 w-5 text-gray-400" />
            Duplicate Existing
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => duplicateMutation.mutate({ id: tmpl.id })}
                disabled={duplicateMutation.isLoading}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
              >
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{tmpl.name}</p>
                  <p className="text-xs text-gray-500">{tmpl.format}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Blank Template */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-gray-400" />
          Blank Template
        </h2>
        {mode === "choose" ? (
          <Button variant="outline" onClick={() => setMode("custom")}>
            Create from scratch
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Template Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Custom Template"
                />
              </div>
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={customFormat} onValueChange={setCustomFormat}>
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
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("choose")}>Cancel</Button>
              <Button onClick={handleCustom} disabled={createMutation.isLoading} className="bg-blue-500 hover:bg-blue-600">
                {createMutation.isLoading ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
