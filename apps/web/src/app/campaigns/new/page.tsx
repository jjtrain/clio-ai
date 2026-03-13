"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowRight,
  Send,
  Save,
  Zap,
  Mail,
  Users,
  Eye,
  FileText,
} from "lucide-react";

const TRIGGER_EVENTS = [
  { value: "NEW_LEAD", label: "New Lead Created" },
  { value: "LEAD_STATUS_CHANGE", label: "Lead Status Changed" },
  { value: "NEW_CLIENT", label: "New Client Created" },
  { value: "INTAKE_SUBMITTED", label: "Intake Form Submitted" },
];

const LEAD_STATUSES = [
  "NEW", "CONTACTED", "QUALIFYING", "QUALIFIED", "PROPOSAL_SENT", "CONVERTED", "DECLINED",
];

const LEAD_SOURCES = [
  "INTAKE_FORM", "LIVE_CHAT", "CONTACT_FORM", "MANUAL", "REFERRAL", "WEBSITE", "PHONE", "OTHER",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [campaignType, setCampaignType] = useState<"BLAST" | "TRIGGERED">("BLAST");

  // Basics
  const [name, setName] = useState("");

  // Content
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Audience (blast)
  const [audienceType, setAudienceType] = useState("ALL_CLIENTS");
  const [filterPracticeArea, setFilterPracticeArea] = useState("");
  const [filterLeadStatuses, setFilterLeadStatuses] = useState<string[]>([]);
  const [filterLeadSources, setFilterLeadSources] = useState<string[]>([]);
  const [filterClientStatus, setFilterClientStatus] = useState("");

  // Trigger
  const [triggerEvent, setTriggerEvent] = useState("");
  const [triggerFromStatus, setTriggerFromStatus] = useState("");
  const [triggerToStatus, setTriggerToStatus] = useState("");

  // Schedule
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data: templates } = trpc.campaigns.listTemplates.useQuery();
  const createCampaign = trpc.campaigns.create.useMutation();
  const sendCampaign = trpc.campaigns.send.useMutation();

  const audienceFilter =
    audienceType === "CUSTOM"
      ? JSON.stringify({
          ...(filterPracticeArea ? { practiceArea: filterPracticeArea } : {}),
          ...(filterLeadStatuses.length > 0 ? { leadStatus: filterLeadStatuses } : {}),
          ...(filterLeadSources.length > 0 ? { leadSource: filterLeadSources } : {}),
          ...(filterClientStatus ? { clientStatus: filterClientStatus } : {}),
        })
      : undefined;

  const audiencePreview = trpc.campaigns.buildAudience.useQuery(
    { audienceType, audienceFilter },
    { enabled: step >= 3 && campaignType === "BLAST" }
  );

  const applyTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates?.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setHtmlContent(tpl.htmlContent);
    }
  };

  const handleSave = async (sendNow: boolean) => {
    if (!name || !subject || !htmlContent) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      const triggerCondition =
        campaignType === "TRIGGERED" && triggerEvent === "LEAD_STATUS_CHANGE"
          ? JSON.stringify({
              ...(triggerFromStatus ? { fromStatus: triggerFromStatus } : {}),
              ...(triggerToStatus ? { toStatus: triggerToStatus } : {}),
            })
          : undefined;

      const result = await createCampaign.mutateAsync({
        name,
        subject,
        htmlContent,
        campaignType,
        audienceType: campaignType === "BLAST" ? audienceType : "ALL_LEADS",
        audienceFilter,
        templateId: selectedTemplateId || undefined,
        scheduledAt: sendMode === "schedule" && scheduledAt ? scheduledAt : undefined,
        triggerEvent: campaignType === "TRIGGERED" ? triggerEvent : undefined,
        triggerCondition,
      });

      if (campaignType === "TRIGGERED") {
        // Activate the trigger (set to SENT which means active)
        await sendCampaign.mutateAsync({ id: result.id });
        toast({ title: "Triggered campaign activated" });
      } else if (sendNow) {
        await sendCampaign.mutateAsync({ id: result.id });
        toast({ title: "Campaign sent successfully" });
      } else {
        toast({ title: "Campaign saved as draft" });
      }

      router.push(`/campaigns/${result.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const totalSteps = campaignType === "BLAST" ? 4 : 4;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Campaign</h1>
          <p className="text-gray-500">Step {step} of {totalSteps}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i + 1 <= step ? "bg-blue-500" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Campaign Basics</h2>

          <div className="space-y-2">
            <Label>Campaign Name <span className="text-red-500">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Newsletter - March 2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Campaign Type</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setCampaignType("BLAST")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  campaignType === "BLAST"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Mail className="h-6 w-6 text-blue-500 mb-2" />
                <div className="font-medium">Blast</div>
                <p className="text-sm text-gray-500">Send to a group of recipients now or scheduled</p>
              </button>
              <button
                onClick={() => setCampaignType("TRIGGERED")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  campaignType === "TRIGGERED"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Zap className="h-6 w-6 text-purple-500 mb-2" />
                <div className="font-medium">Triggered</div>
                <p className="text-sm text-gray-500">Automatically send when an event occurs</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Trigger (TRIGGERED) or Content (BLAST) */}
      {step === 2 && campaignType === "TRIGGERED" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Trigger Configuration</h2>

          <div className="space-y-2">
            <Label>Trigger Event <span className="text-red-500">*</span></Label>
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select trigger event" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {triggerEvent === "LEAD_STATUS_CHANGE" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>From Status</Label>
                <Select value={triggerFromStatus} onValueChange={setTriggerFromStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Status</Label>
                <Select value={triggerToStatus} onValueChange={setTriggerToStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 (BLAST) / Step 3 (TRIGGERED): Content */}
      {((step === 2 && campaignType === "BLAST") || (step === 3 && campaignType === "TRIGGERED")) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Email Content</h2>
            {templates && templates.length > 0 && (
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Use Template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-mono">{"{NAME}"}</span>
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-mono">{"{EMAIL}"}</span>
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-mono">{"{FIRM_NAME}"}</span>
            <span className="text-gray-400 ml-1">Available placeholders</span>
          </div>

          <div className="space-y-2">
            <Label>Subject Line <span className="text-red-500">*</span></Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Important Update from {FIRM_NAME}"
            />
          </div>

          <div className="space-y-2">
            <Label>HTML Content <span className="text-red-500">*</span></Label>
            <Textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<p>Hello {NAME},</p><p>...</p>"
              rows={16}
              className="font-mono text-sm"
            />
          </div>
        </div>
      )}

      {/* Step 3 (BLAST): Audience */}
      {step === 3 && campaignType === "BLAST" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Audience</h2>

          <div className="space-y-2">
            <Label>Audience Type</Label>
            <Select value={audienceType} onValueChange={setAudienceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_CLIENTS">All Clients</SelectItem>
                <SelectItem value="ALL_LEADS">All Leads</SelectItem>
                <SelectItem value="INTAKE_SUBMISSIONS">Intake Submissions</SelectItem>
                <SelectItem value="CUSTOM">Custom Filters</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audienceType === "CUSTOM" && (
            <div className="grid gap-4 md:grid-cols-2 border rounded-lg p-4 bg-gray-50">
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Input
                  value={filterPracticeArea}
                  onChange={(e) => setFilterPracticeArea(e.target.value)}
                  placeholder="e.g. Family Law"
                />
              </div>
              <div className="space-y-2">
                <Label>Client Status</Label>
                <Select value={filterClientStatus} onValueChange={setFilterClientStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Lead Statuses</Label>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setFilterLeadStatuses((prev) =>
                          prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filterLeadStatuses.includes(s)
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Lead Sources</Label>
                <div className="flex flex-wrap gap-2">
                  {LEAD_SOURCES.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setFilterLeadSources((prev) =>
                          prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filterLeadSources.includes(s)
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audience Preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                <Users className="h-4 w-4 inline mr-1.5" />
                Audience Preview
              </span>
              <span className="text-sm font-bold text-blue-600">
                {audiencePreview.data?.count ?? "..."} recipients
              </span>
            </div>
            {audiencePreview.data && audiencePreview.data.preview.length > 0 && (
              <div className="space-y-1">
                {audiencePreview.data.preview.map((r, i) => (
                  <div key={i} className="text-xs text-gray-500 flex justify-between">
                    <span>{r.name}</span>
                    <span>{r.email}</span>
                  </div>
                ))}
                {audiencePreview.data.count > 10 && (
                  <p className="text-xs text-gray-400 mt-2">
                    and {audiencePreview.data.count - 10} more...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Review & Send */}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {campaignType === "TRIGGERED" ? "Review & Activate" : "Review & Send"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm text-gray-500">Campaign</span>
              <p className="font-medium">{name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-gray-500">Type</span>
              <p className="font-medium">{campaignType}</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-gray-500">Subject</span>
              <p className="font-medium">{subject}</p>
            </div>
            {campaignType === "BLAST" && (
              <div className="space-y-1">
                <span className="text-sm text-gray-500">Audience</span>
                <p className="font-medium">
                  {audienceType.replace(/_/g, " ")} ({audiencePreview.data?.count ?? "?"} recipients)
                </p>
              </div>
            )}
            {campaignType === "TRIGGERED" && (
              <div className="space-y-1">
                <span className="text-sm text-gray-500">Trigger</span>
                <p className="font-medium">
                  {TRIGGER_EVENTS.find((e) => e.value === triggerEvent)?.label || triggerEvent}
                </p>
              </div>
            )}
          </div>

          {/* Content preview */}
          <div className="space-y-2">
            <Label>Content Preview</Label>
            <div
              className="border rounded-lg p-4 bg-gray-50 prose max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>

          {campaignType === "BLAST" && (
            <div className="space-y-2">
              <Label>When to Send</Label>
              <div className="flex gap-4">
                <button
                  onClick={() => setSendMode("now")}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    sendMode === "now" ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  Send Now
                </button>
                <button
                  onClick={() => setSendMode("schedule")}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    sendMode === "schedule" ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  Schedule
                </button>
              </div>
              {sendMode === "schedule" && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-64"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex gap-3">
          {step < totalSteps && (
            <Button
              onClick={() => setStep(Math.min(totalSteps, step + 1))}
              className="bg-blue-500 hover:bg-blue-600"
              disabled={step === 1 && !name}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === totalSteps && campaignType === "BLAST" && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={createCampaign.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={createCampaign.isPending || sendCampaign.isPending}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendMode === "schedule" ? "Schedule" : "Send Now"}
              </Button>
            </>
          )}

          {step === totalSteps && campaignType === "TRIGGERED" && (
            <Button
              onClick={() => handleSave(true)}
              disabled={createCampaign.isPending || sendCampaign.isPending}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Zap className="h-4 w-4 mr-2" />
              Activate Trigger
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
