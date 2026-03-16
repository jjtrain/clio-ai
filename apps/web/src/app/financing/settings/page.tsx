"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Copy } from "lucide-react";

export default function FinancingSettingsPage() {
  const { toast } = useToast();
  const { data: settings, refetch } = trpc.financing.getSettings.useQuery();
  const updateSettings = trpc.financing.updateSettings.useMutation({
    onSuccess: () => { refetch(); toast({ title: "Settings saved" }); },
  });
  const testConn = trpc.financing.testConnection.useMutation({
    onSuccess: (d) => toast({ title: d.connected ? `Connected (${d.environment})` : "Failed", description: d.error, variant: d.connected ? "default" : "destructive" }),
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (settings) setForm({
      isEnabled: settings.isEnabled,
      affirmPublicKey: settings.affirmPublicKey || "",
      affirmPrivateKey: settings.affirmPrivateKey || "",
      affirmEnvironment: settings.affirmEnvironment,
      minimumAmount: Number(settings.minimumAmount),
      maximumAmount: Number(settings.maximumAmount),
      enabledForRetainers: settings.enabledForRetainers,
      enabledForInvoices: settings.enabledForInvoices,
      enabledForSettlements: settings.enabledForSettlements,
      promotionalMessage: settings.promotionalMessage || "",
    });
  }, [settings]);

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/affirm/webhook` : "/api/affirm/webhook";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/financing"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">Financing Settings</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Affirm Integration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Toggle label="Enable Client Financing" checked={form.isEnabled ?? false} onChange={(v) => setForm({ ...form, isEnabled: v })} />
            <div className="flex gap-3">
              <Button variant={form.affirmEnvironment === "sandbox" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, affirmEnvironment: "sandbox" })}>Sandbox</Button>
              <Button variant={form.affirmEnvironment === "production" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, affirmEnvironment: "production" })}>Production</Button>
            </div>
            <div className="space-y-2"><Label>Affirm Public Key</Label><Input value={form.affirmPublicKey || ""} onChange={(e) => setForm({ ...form, affirmPublicKey: e.target.value })} /></div>
            <div className="space-y-2"><Label>Affirm Private Key</Label><Input type="password" value={form.affirmPrivateKey || ""} onChange={(e) => setForm({ ...form, affirmPrivateKey: e.target.value })} /></div>
            <Button variant="outline" size="sm" onClick={() => testConn.mutate()} disabled={testConn.isLoading}>{testConn.isLoading ? "Testing..." : "Test Connection"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Amount Limits</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Minimum ($)</Label><Input type="number" step="0.01" value={form.minimumAmount ?? 50} onChange={(e) => setForm({ ...form, minimumAmount: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Maximum ($)</Label><Input type="number" step="0.01" value={form.maximumAmount ?? 30000} onChange={(e) => setForm({ ...form, maximumAmount: Number(e.target.value) })} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enabled For</CardTitle></CardHeader>
          <CardContent>
            <Toggle label="Invoices" checked={form.enabledForInvoices ?? true} onChange={(v) => setForm({ ...form, enabledForInvoices: v })} />
            <Toggle label="Retainers" checked={form.enabledForRetainers ?? true} onChange={(v) => setForm({ ...form, enabledForRetainers: v })} />
            <Toggle label="Settlements" checked={form.enabledForSettlements ?? false} onChange={(v) => setForm({ ...form, enabledForSettlements: v })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Promotional Message</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={3} placeholder="Pay over time with 0% APR financing available..." value={form.promotionalMessage || ""} onChange={(e) => setForm({ ...form, promotionalMessage: e.target.value })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Webhook URL</CardTitle><CardDescription>Configure this in your Affirm dashboard</CardDescription></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="bg-slate-50 font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard?.writeText(webhookUrl); toast({ title: "Copied" }); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => updateSettings.mutate({
          ...form,
          affirmPublicKey: form.affirmPublicKey || null,
          affirmPrivateKey: form.affirmPrivateKey || null,
          promotionalMessage: form.promotionalMessage || null,
        })} disabled={updateSettings.isLoading}>
          {updateSettings.isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
