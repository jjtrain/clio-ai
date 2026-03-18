"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Scale, Bell, BookOpen, Clock, FileText, Plug, CheckCircle, XCircle, Copy, BarChart3, Lightbulb, Video, ShieldCheck, Search, Radar, Eye, GanttChart, Presentation, MailOpen } from "lucide-react";

const PROVIDERS = [
  { provider: "CASETEXT", name: "Casetext CoCounsel", desc: "AI legal research by Thomson Reuters", icon: Scale, color: "text-blue-600" },
  { provider: "DOCKET_ALARM", name: "Docket Alarm", desc: "Court docket monitoring and PACER search", icon: Bell, color: "text-amber-600" },
  { provider: "FASTCASE", name: "Fastcase", desc: "Legal research database with case law and statutes", icon: BookOpen, color: "text-green-600" },
  { provider: "VERA", name: "VERA", desc: "AI-powered automated court deadline tracking", icon: Clock, color: "text-purple-600" },
  { provider: "BRIEFPOINT", name: "Briefpoint", desc: "AI for discovery responses and objections", icon: FileText, color: "text-teal-600" },
  { provider: "CUSTOM", name: "Custom Provider", desc: "Connect any legal research API", icon: Plug, color: "text-slate-600" },
];

export default function IntegrationSettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [configOpen, setConfigOpen] = useState<string | null>(null);

  const { data: integrations } = trpc.legalTools["settings.list"].useQuery();
  const updateMut = trpc.legalTools["settings.update"].useMutation({
    onSuccess: () => { utils.legalTools["settings.list"].invalidate(); setConfigOpen(null); toast({ title: "Saved" }); },
  });
  const testMut = trpc.legalTools["settings.test"].useMutation({
    onSuccess: (d) => toast({ title: d.success ? "Connection successful!" : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }),
  });

  const intMap: Record<string, any> = {};
  for (const i of integrations || []) intMap[i.provider] = i;

  const webhookBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Legal Tool Integrations</h1>
        <p className="text-sm text-slate-500">Connect external legal research, docketing, and discovery tools</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => {
          const int = intMap[p.provider];
          const connected = int?.isEnabled && int?.apiKey;
          return (
            <Card key={p.provider}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p.icon className={`h-6 w-6 ${p.color}`} />
                    <div>
                      <CardTitle className="text-sm">{p.name}</CardTitle>
                      <CardDescription className="text-xs">{p.desc}</CardDescription>
                    </div>
                  </div>
                  {connected ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-gray-300" />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfigOpen(p.provider)}>Configure</Button>
                  {connected && <Button size="sm" variant="outline" onClick={() => testMut.mutate({ provider: p.provider as any })} disabled={testMut.isLoading}>Test</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Ross Intelligence placeholder */}
        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Plug className="h-6 w-6 text-gray-400" />
              <div>
                <CardTitle className="text-sm">Ross Intelligence</CardTitle>
                <CardDescription className="text-xs">Ceased operations January 2021. This slot is reserved for future AI legal research providers.</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Financial Insights Integrations */}
      <FinancialInsightsSection webhookBase={webhookBase} />

      {/* Video & Conferencing Integrations */}
      <ZoomSection webhookBase={webhookBase} />

      {/* Compliance Integrations */}
      <LeglSection webhookBase={webhookBase} />

      {/* Investigations Integrations */}
      <InvestigationsSection webhookBase={webhookBase} />

      {/* Timelines & Visuals */}
      <VisualsSection webhookBase={webhookBase} />

      {/* Mail */}
      <CaseMailSection webhookBase={webhookBase} />

      {/* Webhook URLs */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Webhook URLs</CardTitle><CardDescription>Add these to your provider dashboards for real-time alerts</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: "Docket Alarm", url: `${webhookBase}/api/integrations/docket-alarm/webhook` },
            { name: "VERA", url: `${webhookBase}/api/integrations/vera/webhook` },
          ].map((wh) => (
            <div key={wh.name} className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-32">{wh.name}:</span>
              <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{wh.url}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(wh.url); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Config Dialog */}
      {configOpen && (
        <ConfigDialog
          provider={configOpen}
          integration={intMap[configOpen]}
          onClose={() => setConfigOpen(null)}
          onSave={(data: any) => updateMut.mutate({ provider: configOpen as any, ...data })}
          isLoading={updateMut.isLoading}
        />
      )}
    </div>
  );
}

function FinancialInsightsSection({ webhookBase }: { webhookBase: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [finConfigOpen, setFinConfigOpen] = useState<string | null>(null);

  const { data: finIntegrations } = trpc.finInsights["settings.list"].useQuery();
  const finUpdateMut = trpc.finInsights["settings.update"].useMutation({
    onSuccess: () => { utils.finInsights["settings.list"].invalidate(); setFinConfigOpen(null); toast({ title: "Saved" }); },
  });
  const finTestMut = trpc.finInsights["settings.test"].useMutation({
    onSuccess: (d: any) => toast({ title: d.success ? "Connection successful!" : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }),
  });

  const finMap: Record<string, any> = {};
  for (const i of finIntegrations || []) finMap[i.provider] = i;

  const FIN_PROVIDERS = [
    { provider: "PWC_INSIGHTS", name: "PwC InsightsOfficer", desc: "Automated bookkeeping insights and financial analytics. PwC analyzes your practice management data to provide benchmarks, forecasts, compliance reviews, and actionable financial insights. Trusted by accounting professionals worldwide.", icon: BarChart3, color: "text-orange-600", note: "PwC InsightsOfficer connects your financial data to PwC's analysis engine. Data is encrypted in transit and at rest. Benchmarks compare your firm against similar practices." },
    { provider: "RAINMAKER", name: "Rainmaker", desc: "Client risk and opportunity diagnostics. Rainmaker identifies legal risks and new business opportunities for your clients, then generates work plans to address them. Use as an onboarding tool for new clients or annual review for existing ones.", icon: Lightbulb, color: "text-yellow-600", note: "Run diagnostics on new clients during onboarding to identify immediate legal needs. Schedule annual reviews for existing clients to uncover expansion opportunities and strengthen relationships." },
  ];

  return (
    <>
      <div>
        <h2 className="text-lg font-bold mt-8 mb-1">Financial Insights Integrations</h2>
        <p className="text-sm text-slate-500 mb-4">Connect financial analytics and client advisory providers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIN_PROVIDERS.map((p) => {
          const int = finMap[p.provider];
          const connected = int?.isEnabled && int?.apiKey;
          return (
            <Card key={p.provider}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p.icon className={`h-6 w-6 ${p.color}`} />
                    <div>
                      <CardTitle className="text-sm">{p.name}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed">{p.desc}</CardDescription>
                    </div>
                  </div>
                  {connected ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-gray-300" />}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-400 mb-3">{p.note}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setFinConfigOpen(p.provider)}>Configure</Button>
                  {connected && <Button size="sm" variant="outline" onClick={() => finTestMut.mutate({ provider: p.provider as any })} disabled={finTestMut.isLoading}>Test</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Financial Insights Webhook URLs */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Financial Insights Webhook URLs</CardTitle><CardDescription>Add these to your provider dashboards</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: "PwC InsightsOfficer", url: `${webhookBase}/api/integrations/pwc-insights/webhook` },
            { name: "Rainmaker", url: `${webhookBase}/api/integrations/rainmaker/webhook` },
          ].map((wh) => (
            <div key={wh.name} className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-40">{wh.name}:</span>
              <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{wh.url}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(wh.url); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Financial Insights Config Dialog */}
      {finConfigOpen && (
        <FinInsightsConfigDialog
          provider={finConfigOpen}
          integration={finMap[finConfigOpen]}
          onClose={() => setFinConfigOpen(null)}
          onSave={(data: any) => finUpdateMut.mutate({ provider: finConfigOpen as any, ...data })}
          isLoading={finUpdateMut.isLoading}
        />
      )}
    </>
  );
}

function FinInsightsConfigDialog({ provider, integration, onClose, onSave, isLoading }: any) {
  const [form, setForm] = useState<any>({
    displayName: integration?.displayName || provider,
    apiKey: integration?.apiKey || "",
    accountId: integration?.accountId || "",
    firmId: integration?.firmId || "",
    isEnabled: integration?.isEnabled ?? false,
    autoSyncAccounting: integration?.autoSyncAccounting ?? true,
    syncFrequency: integration?.syncFrequency || "daily",
    reportingPeriod: integration?.reportingPeriod || "monthly",
    fiscalYearStart: integration?.fiscalYearStart || 1,
    benchmarkIndustry: integration?.benchmarkIndustry || "legal_services",
    benchmarkFirmSize: integration?.benchmarkFirmSize || "solo_small",
  });

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  const isPwC = provider === "PWC_INSIGHTS";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configure {form.displayName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Toggle label="Enabled" checked={form.isEnabled} onChange={(v: boolean) => setForm({ ...form, isEnabled: v })} />
          <div className="space-y-2"><Label>Display Name</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
          <div className="space-y-2"><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></div>
          <div className="space-y-2"><Label>Account ID</Label><Input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></div>
          <div className="space-y-2"><Label>Firm ID</Label><Input value={form.firmId} onChange={(e) => setForm({ ...form, firmId: e.target.value })} /></div>
          {isPwC && (
            <>
              <Toggle label="Auto-sync Accounting Data" checked={form.autoSyncAccounting} onChange={(v: boolean) => setForm({ ...form, autoSyncAccounting: v })} />
              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.syncFrequency} onChange={(e) => setForm({ ...form, syncFrequency: e.target.value })}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Reporting Period</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.reportingPeriod} onChange={(e) => setForm({ ...form, reportingPeriod: e.target.value })}>
                  <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year Start Month</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.fiscalYearStart} onChange={(e) => setForm({ ...form, fiscalYearStart: parseInt(e.target.value) })}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "long" })}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Benchmark Industry</Label>
                <Input value={form.benchmarkIndustry} onChange={(e) => setForm({ ...form, benchmarkIndustry: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Benchmark Firm Size</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.benchmarkFirmSize} onChange={(e) => setForm({ ...form, benchmarkFirmSize: e.target.value })}>
                  <option value="solo_small">Solo / Small</option><option value="mid">Mid-size</option><option value="large">Large</option>
                </select>
              </div>
            </>
          )}
          <Button className="w-full" disabled={isLoading} onClick={() => onSave({
            displayName: form.displayName,
            apiKey: form.apiKey || null,
            accountId: form.accountId || null,
            firmId: form.firmId || null,
            isEnabled: form.isEnabled,
            ...(isPwC ? {
              autoSyncAccounting: form.autoSyncAccounting,
              syncFrequency: form.syncFrequency,
              reportingPeriod: form.reportingPeriod,
              fiscalYearStart: form.fiscalYearStart,
              benchmarkIndustry: form.benchmarkIndustry,
              benchmarkFirmSize: form.benchmarkFirmSize,
            } : {}),
          })}>
            {isLoading ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZoomSection({ webhookBase }: { webhookBase: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [zoomConfigOpen, setZoomConfigOpen] = useState(false);

  const { data: zoomConfig } = trpc.zoom["settings.get"].useQuery();
  const zoomUpdateMut = trpc.zoom["settings.update"].useMutation({
    onSuccess: () => { utils.zoom["settings.get"].invalidate(); setZoomConfigOpen(false); toast({ title: "Saved" }); },
  });
  const zoomTestMut = trpc.zoom["settings.test"].useMutation({
    onSuccess: (d: any) => toast({ title: d.success ? `Connected: ${d.userName}` : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }),
  });

  const connected = zoomConfig?.isEnabled && zoomConfig?.apiKey;

  const [zForm, setZForm] = useState<any>({
    apiKey: "", apiSecret: "", accountId: "", userId: "", isEnabled: false,
    defaultMeetingDuration: 30, defaultWaitingRoom: true, defaultMuteOnEntry: true,
    defaultRecordMeeting: false, defaultAutoTranscribe: true,
    autoCreateForAppointments: true, autoSaveRecordings: true, autoSaveTranscripts: true, autoSummarize: true,
    webhookSecret: "", webhookVerificationToken: "",
  });

  const loadForm = () => {
    if (zoomConfig) setZForm({
      apiKey: zoomConfig.apiKey || "", apiSecret: zoomConfig.apiSecret || "", accountId: zoomConfig.accountId || "",
      userId: zoomConfig.userId || "", isEnabled: zoomConfig.isEnabled,
      defaultMeetingDuration: zoomConfig.defaultMeetingDuration, defaultWaitingRoom: zoomConfig.defaultWaitingRoom,
      defaultMuteOnEntry: zoomConfig.defaultMuteOnEntry, defaultRecordMeeting: zoomConfig.defaultRecordMeeting,
      defaultAutoTranscribe: zoomConfig.defaultAutoTranscribe, autoCreateForAppointments: zoomConfig.autoCreateForAppointments,
      autoSaveRecordings: zoomConfig.autoSaveRecordings, autoSaveTranscripts: zoomConfig.autoSaveTranscripts,
      autoSummarize: zoomConfig.autoSummarize, webhookSecret: zoomConfig.webhookSecret || "",
      webhookVerificationToken: zoomConfig.webhookVerificationToken || "",
    });
    setZoomConfigOpen(true);
  };

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  return (
    <>
      <div>
        <h2 className="text-lg font-bold mt-8 mb-1">Video & Conferencing</h2>
        <p className="text-sm text-slate-500 mb-4">Video conferencing with recording, transcription, and AI intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Video className="h-6 w-6 text-blue-600" />
                <div>
                  <CardTitle className="text-sm">Zoom</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">Video conferencing with automatic recording, transcription, and AI meeting summaries. Schedule meetings from Clio AI, get join links, and automatically log time and create follow-up tasks after every call.</CardDescription>
                </div>
              </div>
              {connected ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-gray-300" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-3">Create a Server-to-Server OAuth app in the Zoom App Marketplace. Copy the Client ID, Client Secret, and Account ID. Required scopes: meeting:read, meeting:write, recording:read, user:read.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadForm}>Configure</Button>
              {connected && <Button size="sm" variant="outline" onClick={() => zoomTestMut.mutate()} disabled={zoomTestMut.isLoading}>Test</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zoom Webhook URL */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Zoom Webhook URL</CardTitle><CardDescription>Add this to your Zoom app Event Subscriptions</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 w-20">Zoom:</span>
            <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{webhookBase}/api/integrations/zoom/webhook</code>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(`${webhookBase}/api/integrations/zoom/webhook`); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Zoom Config Dialog */}
      {zoomConfigOpen && (
        <Dialog open onOpenChange={() => setZoomConfigOpen(false)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Configure Zoom</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Toggle label="Enabled" checked={zForm.isEnabled} onChange={(v: boolean) => setZForm({ ...zForm, isEnabled: v })} />
              <div className="space-y-2"><Label>Client ID (API Key)</Label><Input type="password" value={zForm.apiKey} onChange={(e: any) => setZForm({ ...zForm, apiKey: e.target.value })} /></div>
              <div className="space-y-2"><Label>Client Secret (API Secret)</Label><Input type="password" value={zForm.apiSecret} onChange={(e: any) => setZForm({ ...zForm, apiSecret: e.target.value })} /></div>
              <div className="space-y-2"><Label>Account ID</Label><Input value={zForm.accountId} onChange={(e: any) => setZForm({ ...zForm, accountId: e.target.value })} /></div>
              <div className="space-y-2"><Label>User ID / Email</Label><Input value={zForm.userId} onChange={(e: any) => setZForm({ ...zForm, userId: e.target.value })} placeholder="me" /></div>
              <div className="space-y-2"><Label>Default Meeting Duration (min)</Label><Input type="number" value={zForm.defaultMeetingDuration} onChange={(e: any) => setZForm({ ...zForm, defaultMeetingDuration: parseInt(e.target.value) || 30 })} /></div>
              <Toggle label="Waiting Room" checked={zForm.defaultWaitingRoom} onChange={(v: boolean) => setZForm({ ...zForm, defaultWaitingRoom: v })} />
              <Toggle label="Mute on Entry" checked={zForm.defaultMuteOnEntry} onChange={(v: boolean) => setZForm({ ...zForm, defaultMuteOnEntry: v })} />
              <Toggle label="Auto-Record (Cloud)" checked={zForm.defaultRecordMeeting} onChange={(v: boolean) => setZForm({ ...zForm, defaultRecordMeeting: v })} />
              <Toggle label="Auto-Transcribe" checked={zForm.defaultAutoTranscribe} onChange={(v: boolean) => setZForm({ ...zForm, defaultAutoTranscribe: v })} />
              <Toggle label="Auto-Create for Appointments" checked={zForm.autoCreateForAppointments} onChange={(v: boolean) => setZForm({ ...zForm, autoCreateForAppointments: v })} />
              <Toggle label="Auto-Save Recordings" checked={zForm.autoSaveRecordings} onChange={(v: boolean) => setZForm({ ...zForm, autoSaveRecordings: v })} />
              <Toggle label="Auto-Save Transcripts" checked={zForm.autoSaveTranscripts} onChange={(v: boolean) => setZForm({ ...zForm, autoSaveTranscripts: v })} />
              <Toggle label="Auto-Summarize (AI)" checked={zForm.autoSummarize} onChange={(v: boolean) => setZForm({ ...zForm, autoSummarize: v })} />
              <div className="space-y-2"><Label>Webhook Secret Token</Label><Input type="password" value={zForm.webhookSecret} onChange={(e: any) => setZForm({ ...zForm, webhookSecret: e.target.value })} /></div>
              <div className="space-y-2"><Label>Verification Token</Label><Input value={zForm.webhookVerificationToken} onChange={(e: any) => setZForm({ ...zForm, webhookVerificationToken: e.target.value })} /></div>
              <Button className="w-full" disabled={zoomUpdateMut.isLoading} onClick={() => zoomUpdateMut.mutate({
                apiKey: zForm.apiKey || null, apiSecret: zForm.apiSecret || null, accountId: zForm.accountId || null,
                userId: zForm.userId || null, isEnabled: zForm.isEnabled,
                defaultMeetingDuration: zForm.defaultMeetingDuration, defaultWaitingRoom: zForm.defaultWaitingRoom,
                defaultMuteOnEntry: zForm.defaultMuteOnEntry, defaultRecordMeeting: zForm.defaultRecordMeeting,
                defaultAutoTranscribe: zForm.defaultAutoTranscribe, autoCreateForAppointments: zForm.autoCreateForAppointments,
                autoSaveRecordings: zForm.autoSaveRecordings, autoSaveTranscripts: zForm.autoSaveTranscripts,
                autoSummarize: zForm.autoSummarize, webhookSecret: zForm.webhookSecret || null,
                webhookVerificationToken: zForm.webhookVerificationToken || null,
              })}>{zoomUpdateMut.isLoading ? "Saving..." : "Save Configuration"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function LeglSection({ webhookBase }: { webhookBase: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [configOpen, setConfigOpen] = useState(false);

  const { data: config } = trpc.compliance["settings.get"].useQuery();
  const updateMut = trpc.compliance["settings.update"].useMutation({
    onSuccess: () => { utils.compliance["settings.get"].invalidate(); setConfigOpen(false); toast({ title: "Saved" }); },
  });
  const testMut = trpc.compliance["settings.test"].useMutation({
    onSuccess: (d: any) => toast({ title: d.success ? `Connected: ${d.firmName}` : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }),
  });

  const connected = config?.isEnabled && config?.apiKey;

  const [form, setForm] = useState<any>({
    apiKey: "", apiSecret: "", accountId: "", firmId: "", isEnabled: false,
    autoRunOnNewClient: false, autoRunOnNewMatter: true, requireApprovalBeforeMatterStart: true,
    defaultRiskThreshold: "MEDIUM", sanctionsCheckEnabled: true, pepCheckEnabled: true,
    adverseMediaCheckEnabled: true, documentVerificationEnabled: true,
    ongoingMonitoringEnabled: false, monitoringFrequency: "quarterly", retentionPeriod: 60,
  });

  const loadForm = () => {
    if (config) setForm({
      apiKey: config.apiKey || "", apiSecret: config.apiSecret || "", accountId: config.accountId || "",
      firmId: config.firmId || "", isEnabled: config.isEnabled,
      autoRunOnNewClient: config.autoRunOnNewClient, autoRunOnNewMatter: config.autoRunOnNewMatter,
      requireApprovalBeforeMatterStart: config.requireApprovalBeforeMatterStart,
      defaultRiskThreshold: config.defaultRiskThreshold, sanctionsCheckEnabled: config.sanctionsCheckEnabled,
      pepCheckEnabled: config.pepCheckEnabled, adverseMediaCheckEnabled: config.adverseMediaCheckEnabled,
      documentVerificationEnabled: config.documentVerificationEnabled,
      ongoingMonitoringEnabled: config.ongoingMonitoringEnabled,
      monitoringFrequency: config.monitoringFrequency || "quarterly", retentionPeriod: config.retentionPeriod,
    });
    setConfigOpen(true);
  };

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  return (
    <>
      <div>
        <h2 className="text-lg font-bold mt-8 mb-1">Compliance & KYC/AML</h2>
        <p className="text-sm text-slate-500 mb-4">Client identity verification, sanctions screening, and compliance monitoring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                <div>
                  <CardTitle className="text-sm">Legl</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">KYC and AML compliance, client ID verification, sanctions screening, PEP checks, adverse media monitoring, and ongoing client monitoring. Legl provides a client-facing portal where your clients submit documents and complete verification.</CardDescription>
                </div>
              </div>
              {connected ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-gray-300" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-3">Legl handles the client-facing experience — clients receive a branded portal link where they upload ID documents and answer compliance questions. Results flow back to Clio AI automatically.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadForm}>Configure</Button>
              {connected && <Button size="sm" variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isLoading}>Test</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Compliance Webhook URL</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 w-20">Legl:</span>
            <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{webhookBase}/api/integrations/legl/webhook</code>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(`${webhookBase}/api/integrations/legl/webhook`); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button>
          </div>
        </CardContent>
      </Card>

      {configOpen && (
        <Dialog open onOpenChange={() => setConfigOpen(false)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Configure Legl</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Toggle label="Enabled" checked={form.isEnabled} onChange={(v: boolean) => setForm({ ...form, isEnabled: v })} />
              <div className="space-y-2"><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={(e: any) => setForm({ ...form, apiKey: e.target.value })} /></div>
              <div className="space-y-2"><Label>API Secret</Label><Input type="password" value={form.apiSecret} onChange={(e: any) => setForm({ ...form, apiSecret: e.target.value })} /></div>
              <div className="space-y-2"><Label>Account ID</Label><Input value={form.accountId} onChange={(e: any) => setForm({ ...form, accountId: e.target.value })} /></div>
              <div className="space-y-2"><Label>Firm ID</Label><Input value={form.firmId} onChange={(e: any) => setForm({ ...form, firmId: e.target.value })} /></div>
              <div className="border-t pt-3"><p className="text-xs font-medium text-gray-500 mb-2">Automation</p></div>
              <Toggle label="Auto-run on new client" checked={form.autoRunOnNewClient} onChange={(v: boolean) => setForm({ ...form, autoRunOnNewClient: v })} />
              <Toggle label="Auto-run on new matter" checked={form.autoRunOnNewMatter} onChange={(v: boolean) => setForm({ ...form, autoRunOnNewMatter: v })} />
              <Toggle label="Require approval before matter start" checked={form.requireApprovalBeforeMatterStart} onChange={(v: boolean) => setForm({ ...form, requireApprovalBeforeMatterStart: v })} />
              <div className="border-t pt-3"><p className="text-xs font-medium text-gray-500 mb-2">Checks Enabled</p></div>
              <Toggle label="Sanctions screening" checked={form.sanctionsCheckEnabled} onChange={(v: boolean) => setForm({ ...form, sanctionsCheckEnabled: v })} />
              <Toggle label="PEP screening" checked={form.pepCheckEnabled} onChange={(v: boolean) => setForm({ ...form, pepCheckEnabled: v })} />
              <Toggle label="Adverse media" checked={form.adverseMediaCheckEnabled} onChange={(v: boolean) => setForm({ ...form, adverseMediaCheckEnabled: v })} />
              <Toggle label="Document verification" checked={form.documentVerificationEnabled} onChange={(v: boolean) => setForm({ ...form, documentVerificationEnabled: v })} />
              <Toggle label="Ongoing monitoring" checked={form.ongoingMonitoringEnabled} onChange={(v: boolean) => setForm({ ...form, ongoingMonitoringEnabled: v })} />
              {form.ongoingMonitoringEnabled && (
                <div className="space-y-2"><Label>Monitoring Frequency</Label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.monitoringFrequency} onChange={(e) => setForm({ ...form, monitoringFrequency: e.target.value })}>
                    <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option>
                  </select>
                </div>
              )}
              <div className="space-y-2"><Label>Retention Period (months)</Label><Input type="number" value={form.retentionPeriod} onChange={(e: any) => setForm({ ...form, retentionPeriod: parseInt(e.target.value) || 60 })} /></div>
              <Button className="w-full" disabled={updateMut.isLoading} onClick={() => updateMut.mutate({
                apiKey: form.apiKey || null, apiSecret: form.apiSecret || null, accountId: form.accountId || null,
                firmId: form.firmId || null, isEnabled: form.isEnabled, autoRunOnNewClient: form.autoRunOnNewClient,
                autoRunOnNewMatter: form.autoRunOnNewMatter, requireApprovalBeforeMatterStart: form.requireApprovalBeforeMatterStart,
                sanctionsCheckEnabled: form.sanctionsCheckEnabled, pepCheckEnabled: form.pepCheckEnabled,
                adverseMediaCheckEnabled: form.adverseMediaCheckEnabled, documentVerificationEnabled: form.documentVerificationEnabled,
                ongoingMonitoringEnabled: form.ongoingMonitoringEnabled, monitoringFrequency: form.monitoringFrequency || null,
                retentionPeriod: form.retentionPeriod,
              })}>{updateMut.isLoading ? "Saving..." : "Save Configuration"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function InvestigationsSection({ webhookBase }: { webhookBase: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [iForm, setIForm] = useState<any>({ apiKey: "", accountId: "", userId: "", isEnabled: false, defaultSearchDepth: "standard", autoSearchOnNewMatter: false, autoSearchOnConflictCheck: false });

  const { data: integrations } = trpc.investigations.settings.list.useQuery();
  const updateMut = trpc.investigations.settings.update.useMutation({
    onSuccess: () => { utils.investigations.settings.list.invalidate(); setConfigOpen(null); toast({ title: "Saved" }); },
  });
  const testMut = trpc.investigations.settings.test.useMutation({
    onSuccess: (d: any) => toast({ title: d.success ? "Connected!" : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }),
  });

  const intMap: Record<string, any> = {};
  for (const i of integrations || []) intMap[i.provider] = i;

  const PROVIDERS = [
    { provider: "TRACERS", name: "Tracers", desc: "Investigative data spanning 23+ years. Locate persons, skip trace, asset searches, background checks, criminal records, court records, bankruptcies, liens/judgments, property, vehicles, and more.", icon: Search, color: "text-blue-600", note: "Tracers uses a credit-based system. Different search types cost different amounts." },
    { provider: "SONAR", name: "Sonar", desc: "Real-time identification of potential clients from incident databases — police reports, accident reports, citations, arrests. Includes lead scoring and market insights.", icon: Radar, color: "text-purple-600", note: "Particularly valuable for personal injury firms. Set up monitoring for your practice areas and jurisdictions." },
    { provider: "MEDIASCOPE", name: "Mediascope", desc: "AI-powered visual asset protection. Upload logos, product images, or trademarks and find unauthorized use across the web and marketplaces. Includes takedown notice generation.", icon: Eye, color: "text-emerald-600", note: "Essential for IP/trademark practices. Set up monitoring for client brand assets to automatically detect infringement." },
  ];

  const loadForm = (provider: string) => {
    const config = intMap[provider];
    if (config) setIForm({ apiKey: config.apiKey || "", accountId: config.accountId || "", userId: config.userId || "", isEnabled: config.isEnabled, defaultSearchDepth: config.defaultSearchDepth || "standard", autoSearchOnNewMatter: config.autoSearchOnNewMatter, autoSearchOnConflictCheck: config.autoSearchOnConflictCheck });
    else setIForm({ apiKey: "", accountId: "", userId: "", isEnabled: false, defaultSearchDepth: "standard", autoSearchOnNewMatter: false, autoSearchOnConflictCheck: false });
    setConfigOpen(provider);
  };

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-1"><span className="text-sm">{label}</span><button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} /></button></label>
  );

  return (
    <>
      <div><h2 className="text-lg font-bold mt-8 mb-1">Investigations & Records</h2><p className="text-sm text-slate-500 mb-4">People search, asset discovery, incident identification, and visual asset protection</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PROVIDERS.map((p) => {
          const config = intMap[p.provider];
          const connected = config?.isEnabled && config?.apiKey;
          return (
            <Card key={p.provider}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p.icon className={`h-6 w-6 ${p.color}`} />
                    <div><CardTitle className="text-sm">{p.name}</CardTitle><CardDescription className="text-xs leading-relaxed">{p.desc}</CardDescription></div>
                  </div>
                  {connected ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <XCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-400 mb-3">{p.note}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadForm(p.provider)}>Configure</Button>
                  {connected && <Button size="sm" variant="outline" onClick={() => testMut.mutate({ provider: p.provider as any })} disabled={testMut.isLoading}>Test</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Investigation Webhook URLs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[{ name: "Tracers", url: `${webhookBase}/api/integrations/tracers/webhook` }, { name: "Sonar", url: `${webhookBase}/api/integrations/sonar/webhook` }, { name: "Mediascope", url: `${webhookBase}/api/integrations/mediascope/webhook` }].map((wh) => (
            <div key={wh.name} className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-24">{wh.name}:</span>
              <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{wh.url}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(wh.url); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {configOpen && (
        <Dialog open onOpenChange={() => setConfigOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Configure {configOpen}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Toggle label="Enabled" checked={iForm.isEnabled} onChange={(v: boolean) => setIForm({ ...iForm, isEnabled: v })} />
              <div className="space-y-2"><Label>API Key</Label><Input type="password" value={iForm.apiKey} onChange={(e: any) => setIForm({ ...iForm, apiKey: e.target.value })} /></div>
              <div className="space-y-2"><Label>Account ID</Label><Input value={iForm.accountId} onChange={(e: any) => setIForm({ ...iForm, accountId: e.target.value })} /></div>
              <div className="space-y-2"><Label>User ID</Label><Input value={iForm.userId} onChange={(e: any) => setIForm({ ...iForm, userId: e.target.value })} /></div>
              {configOpen === "TRACERS" && (
                <>
                  <div className="space-y-2"><Label>Default Search Depth</Label>
                    <select className="w-full border rounded px-3 py-2 text-sm" value={iForm.defaultSearchDepth} onChange={(e) => setIForm({ ...iForm, defaultSearchDepth: e.target.value })}>
                      <option value="basic">Basic</option><option value="standard">Standard</option><option value="comprehensive">Comprehensive</option>
                    </select>
                  </div>
                  <Toggle label="Auto-search on new matter" checked={iForm.autoSearchOnNewMatter} onChange={(v: boolean) => setIForm({ ...iForm, autoSearchOnNewMatter: v })} />
                  <Toggle label="Auto-search on conflict check" checked={iForm.autoSearchOnConflictCheck} onChange={(v: boolean) => setIForm({ ...iForm, autoSearchOnConflictCheck: v })} />
                </>
              )}
              <Button className="w-full" disabled={updateMut.isLoading} onClick={() => updateMut.mutate({ provider: configOpen as any, apiKey: iForm.apiKey || null, accountId: iForm.accountId || null, userId: iForm.userId || null, isEnabled: iForm.isEnabled, defaultSearchDepth: iForm.defaultSearchDepth, autoSearchOnNewMatter: iForm.autoSearchOnNewMatter, autoSearchOnConflictCheck: iForm.autoSearchOnConflictCheck })}>
                {updateMut.isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function VisualsSection({ webhookBase }: { webhookBase: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [vForm, setVForm] = useState<any>({ apiKey: "", accountId: "", isEnabled: false, autoSyncDocuments: true, autoSyncTimeline: true });

  const { data: integrations } = trpc.visuals["settings.list"].useQuery();
  const updateMut = trpc.visuals["settings.update"].useMutation({
    onSuccess: () => { utils.visuals["settings.list"].invalidate(); setConfigOpen(null); toast({ title: "Saved" }); },
  });
  const testMut = trpc.visuals["settings.test"].useMutation({
    onSuccess: (d: any) => toast({ title: d.success ? "Connected!" : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }),
  });

  const intMap: Record<string, any> = {};
  for (const i of integrations || []) intMap[i.provider] = i;

  const PROVIDERS = [
    { provider: "TRIALLINE", name: "TrialLine", desc: "Create visual case timelines for strategy sessions, mediation, and courtroom presentations. Auto-builds from your docket entries, medical records, and documents.", icon: GanttChart, color: "text-blue-600", note: "Share interactive timelines with co-counsel or export for mediation briefs." },
    { provider: "AGILELAW", name: "AgileLaw", desc: "Digital deposition tool. Add documents as exhibits, annotate in real-time, present during depositions, stamp exhibits, and track admission status.", icon: Presentation, color: "text-purple-600", note: "AgileLaw replaces paper exhibits. Upload before, present live, annotate on the fly, export after." },
  ];

  const loadForm = (provider: string) => {
    const config = intMap[provider];
    if (config) setVForm({ apiKey: config.apiKey || "", accountId: config.accountId || "", isEnabled: config.isEnabled, autoSyncDocuments: config.autoSyncDocuments, autoSyncTimeline: config.autoSyncTimeline });
    else setVForm({ apiKey: "", accountId: "", isEnabled: false, autoSyncDocuments: true, autoSyncTimeline: true });
    setConfigOpen(provider);
  };

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-1"><span className="text-sm">{label}</span><button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} /></button></label>
  );

  return (
    <>
      <div><h2 className="text-lg font-bold mt-8 mb-1">Timelines & Visuals</h2><p className="text-sm text-slate-500 mb-4">Case timelines, deposition management, and courtroom presentations</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => {
          const config = intMap[p.provider];
          const connected = config?.isEnabled && config?.apiKey;
          return (
            <Card key={p.provider}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><p.icon className={`h-6 w-6 ${p.color}`} /><div><CardTitle className="text-sm">{p.name}</CardTitle><CardDescription className="text-xs leading-relaxed">{p.desc}</CardDescription></div></div>
                  {connected ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <XCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-400 mb-3">{p.note}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadForm(p.provider)}>Configure</Button>
                  {connected && <Button size="sm" variant="outline" onClick={() => testMut.mutate({ provider: p.provider as any })} disabled={testMut.isLoading}>Test</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Visuals Webhook URLs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[{ name: "TrialLine", url: `${webhookBase}/api/integrations/trialline/webhook` }, { name: "AgileLaw", url: `${webhookBase}/api/integrations/agilelaw/webhook` }].map((wh) => (
            <div key={wh.name} className="flex items-center gap-2"><span className="text-sm text-slate-500 w-24">{wh.name}:</span><code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{wh.url}</code><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(wh.url); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button></div>
          ))}
        </CardContent>
      </Card>

      {configOpen && (
        <Dialog open onOpenChange={() => setConfigOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Configure {configOpen === "TRIALLINE" ? "TrialLine" : "AgileLaw"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Toggle label="Enabled" checked={vForm.isEnabled} onChange={(v: boolean) => setVForm({ ...vForm, isEnabled: v })} />
              <div className="space-y-2"><Label>API Key</Label><Input type="password" value={vForm.apiKey} onChange={(e: any) => setVForm({ ...vForm, apiKey: e.target.value })} /></div>
              <div className="space-y-2"><Label>Account ID</Label><Input value={vForm.accountId} onChange={(e: any) => setVForm({ ...vForm, accountId: e.target.value })} /></div>
              <Toggle label="Auto-sync Documents" checked={vForm.autoSyncDocuments} onChange={(v: boolean) => setVForm({ ...vForm, autoSyncDocuments: v })} />
              <Toggle label="Auto-sync Timeline" checked={vForm.autoSyncTimeline} onChange={(v: boolean) => setVForm({ ...vForm, autoSyncTimeline: v })} />
              <Button className="w-full" disabled={updateMut.isLoading} onClick={() => updateMut.mutate({ provider: configOpen as any, apiKey: vForm.apiKey || null, accountId: vForm.accountId || null, isEnabled: vForm.isEnabled, autoSyncDocuments: vForm.autoSyncDocuments, autoSyncTimeline: vForm.autoSyncTimeline })}>
                {updateMut.isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function CaseMailSection({ webhookBase }: { webhookBase: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [configOpen, setConfigOpen] = useState(false);
  const [mForm, setMForm] = useState<any>({ apiKey: "", accountId: "", firmId: "", isEnabled: false, defaultReturnAddress: "", defaultReturnName: "", defaultMailClass: "first_class", autoTrackCosts: true, autoSaveProofs: true, autoCreateDocketEntry: true });

  const { data: config } = trpc.mail["settings.get"].useQuery();
  const updateMut = trpc.mail["settings.update"].useMutation({ onSuccess: () => { utils.mail["settings.get"].invalidate(); setConfigOpen(false); toast({ title: "Saved" }); } });
  const testMut = trpc.mail["settings.test"].useMutation({ onSuccess: (d: any) => toast({ title: d.success ? `Connected: ${d.firmName || "OK"}` : `Failed: ${d.error}`, variant: d.success ? "default" : "destructive" }) });

  const connected = config?.isEnabled && config?.apiKey;
  const loadForm = () => {
    if (config) setMForm({ apiKey: config.apiKey || "", accountId: config.accountId || "", firmId: config.firmId || "", isEnabled: config.isEnabled, defaultReturnAddress: config.defaultReturnAddress || "", defaultReturnName: config.defaultReturnName || "", defaultMailClass: config.defaultMailClass || "first_class", autoTrackCosts: config.autoTrackCosts, autoSaveProofs: config.autoSaveProofs, autoCreateDocketEntry: config.autoCreateDocketEntry });
    setConfigOpen(true);
  };

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-1"><span className="text-sm">{label}</span><button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} /></button></label>
  );

  return (
    <>
      <div><h2 className="text-lg font-bold mt-8 mb-1">Mail</h2><p className="text-sm text-slate-500 mb-4">Mail legal documents via First Class, Certified, FedEx, and UPS</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><MailOpen className="h-6 w-6 text-blue-600" /><div><CardTitle className="text-sm">CaseMail</CardTitle><CardDescription className="text-xs leading-relaxed">Mail legal documents directly from Clio AI. CaseMail prints, stuffs, and mails your documents. Proof of mailing and delivery auto-saved. Authorized bankruptcy notice provider by all U.S. Courts.</CardDescription></div></div>
              {connected ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <XCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-3">CaseMail handles printing and mailing. Certified mail tracking, proof of mailing, delivery confirmations, and green cards saved automatically.</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={loadForm}>Configure</Button>{connected && <Button size="sm" variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isLoading}>Test</Button>}</div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-sm">Mail Webhook URL</CardTitle></CardHeader>
        <CardContent><div className="flex items-center gap-2"><span className="text-sm text-slate-500 w-24">CaseMail:</span><code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded font-mono truncate">{webhookBase}/api/integrations/casemail/webhook</code><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(`${webhookBase}/api/integrations/casemail/webhook`); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button></div></CardContent>
      </Card>
      {configOpen && (
        <Dialog open onOpenChange={() => setConfigOpen(false)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Configure CaseMail</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Toggle label="Enabled" checked={mForm.isEnabled} onChange={(v: boolean) => setMForm({ ...mForm, isEnabled: v })} />
              <div className="space-y-2"><Label>API Key</Label><Input type="password" value={mForm.apiKey} onChange={(e: any) => setMForm({ ...mForm, apiKey: e.target.value })} /></div>
              <div className="space-y-2"><Label>Account ID</Label><Input value={mForm.accountId} onChange={(e: any) => setMForm({ ...mForm, accountId: e.target.value })} /></div>
              <div className="space-y-2"><Label>Firm ID</Label><Input value={mForm.firmId} onChange={(e: any) => setMForm({ ...mForm, firmId: e.target.value })} /></div>
              <div className="space-y-2"><Label>Default Return Name</Label><Input value={mForm.defaultReturnName} onChange={(e: any) => setMForm({ ...mForm, defaultReturnName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Default Return Address</Label><Input value={mForm.defaultReturnAddress} onChange={(e: any) => setMForm({ ...mForm, defaultReturnAddress: e.target.value })} /></div>
              <div className="space-y-2"><Label>Default Mail Class</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={mForm.defaultMailClass} onChange={(e) => setMForm({ ...mForm, defaultMailClass: e.target.value })}>
                  <option value="first_class">First Class</option><option value="certified">Certified</option><option value="certified_return_receipt">Certified Return Receipt</option><option value="priority">Priority</option><option value="express">Express</option>
                </select>
              </div>
              <Toggle label="Auto-track mailing costs as expenses" checked={mForm.autoTrackCosts} onChange={(v: boolean) => setMForm({ ...mForm, autoTrackCosts: v })} />
              <Toggle label="Auto-save proofs to matter documents" checked={mForm.autoSaveProofs} onChange={(v: boolean) => setMForm({ ...mForm, autoSaveProofs: v })} />
              <Toggle label="Auto-create docket entry for service mailings" checked={mForm.autoCreateDocketEntry} onChange={(v: boolean) => setMForm({ ...mForm, autoCreateDocketEntry: v })} />
              <Button className="w-full" disabled={updateMut.isLoading} onClick={() => updateMut.mutate({ apiKey: mForm.apiKey || null, accountId: mForm.accountId || null, firmId: mForm.firmId || null, isEnabled: mForm.isEnabled, defaultReturnAddress: mForm.defaultReturnAddress || null, defaultReturnName: mForm.defaultReturnName || null, defaultMailClass: mForm.defaultMailClass, autoTrackCosts: mForm.autoTrackCosts, autoSaveProofs: mForm.autoSaveProofs, autoCreateDocketEntry: mForm.autoCreateDocketEntry })}>
                {updateMut.isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ConfigDialog({ provider, integration, onClose, onSave, isLoading }: any) {
  const [form, setForm] = useState<any>({
    displayName: integration?.displayName || provider,
    apiKey: integration?.apiKey || "",
    apiSecret: integration?.apiSecret || "",
    baseUrl: integration?.baseUrl || "",
    accountId: integration?.accountId || "",
    isEnabled: integration?.isEnabled ?? false,
  });

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Configure {form.displayName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Toggle label="Enabled" checked={form.isEnabled} onChange={(v: boolean) => setForm({ ...form, isEnabled: v })} />
          <div className="space-y-2"><Label>Display Name</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
          <div className="space-y-2"><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></div>
          <div className="space-y-2"><Label>API Secret (if required)</Label><Input type="password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} /></div>
          <div className="space-y-2"><Label>Base URL (advanced)</Label><Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="Leave blank for default" /></div>
          <div className="space-y-2"><Label>Account ID</Label><Input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></div>
          <Button className="w-full" disabled={isLoading} onClick={() => onSave({
            displayName: form.displayName,
            apiKey: form.apiKey || null,
            apiSecret: form.apiSecret || null,
            baseUrl: form.baseUrl || null,
            accountId: form.accountId || null,
            isEnabled: form.isEnabled,
          })}>
            {isLoading ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
