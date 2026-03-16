"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Scale, Bell, BookOpen, Clock, FileText, Plug, CheckCircle, XCircle, Copy } from "lucide-react";

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
