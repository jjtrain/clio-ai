"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Loader2, ShieldCheck } from "lucide-react";

export default function RiskSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = trpc.riskAlerts.getSettings.useQuery();
  const update = trpc.riskAlerts.updateSettings.useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
  });

  const [form, setForm] = useState({
    isEnabled: true, autoScanEnabled: true, scanFrequency: "daily",
    unusualTimeEntryHours: 10, duplicateEntryDetection: true, billingAnomalyThreshold: 2.0,
    trustOverdraftAlert: true, deadlineAlertDays: 7, inactivityAlertDays: 30,
    conflictAutoCheck: true, notifyOnCritical: true, notifyEmail: "",
  });

  useEffect(() => {
    if (settings) setForm({
      isEnabled: settings.isEnabled,
      autoScanEnabled: settings.autoScanEnabled,
      scanFrequency: settings.scanFrequency,
      unusualTimeEntryHours: parseFloat(settings.unusualTimeEntryHours?.toString() || "10"),
      duplicateEntryDetection: settings.duplicateEntryDetection,
      billingAnomalyThreshold: parseFloat(settings.billingAnomalyThreshold?.toString() || "2"),
      trustOverdraftAlert: settings.trustOverdraftAlert,
      deadlineAlertDays: settings.deadlineAlertDays,
      inactivityAlertDays: settings.inactivityAlertDays,
      conflictAutoCheck: settings.conflictAutoCheck,
      notifyOnCritical: settings.notifyOnCritical,
      notifyEmail: settings.notifyEmail || "",
    });
  }, [settings]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  const handleSave = () => update.mutate(form);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link href="/risk"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-500" />Risk Detection Settings</h1>
          <p className="text-sm text-gray-500">Configure anomaly detection thresholds and notifications</p>
        </div>
      </div>

      {/* General */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">General</h2>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-700">Enable Risk Detection</p><p className="text-xs text-gray-400">Run anomaly detection and risk flagging</p></div>
          <Switch checked={form.isEnabled} onCheckedChange={(v) => setForm({ ...form, isEnabled: v })} /></div>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-700">Auto-Scan</p><p className="text-xs text-gray-400">Run scans automatically on schedule</p></div>
          <Switch checked={form.autoScanEnabled} onCheckedChange={(v) => setForm({ ...form, autoScanEnabled: v })} /></div>
      </div>

      {/* Billing */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Billing Thresholds</h2>
        <div><Label>Unusual Time Entry Hours (flag entries over this)</Label>
          <div className="flex items-center gap-3 mt-1"><Input type="range" min={4} max={16} step={0.5} value={form.unusualTimeEntryHours} onChange={(e) => setForm({ ...form, unusualTimeEntryHours: parseFloat(e.target.value) })} className="flex-1" /><span className="text-sm font-medium text-gray-700 w-12">{form.unusualTimeEntryHours}h</span></div></div>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-700">Duplicate Entry Detection</p></div>
          <Switch checked={form.duplicateEntryDetection} onCheckedChange={(v) => setForm({ ...form, duplicateEntryDetection: v })} /></div>
      </div>

      {/* Trust */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Trust Accounts</h2>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-700">Overdraft Alerts</p><p className="text-xs text-gray-400">Alert on negative trust balances</p></div>
          <Switch checked={form.trustOverdraftAlert} onCheckedChange={(v) => setForm({ ...form, trustOverdraftAlert: v })} /></div>
      </div>

      {/* Deadlines & Matters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Deadlines & Matters</h2>
        <div><Label>Deadline Alert Days (alert N days before)</Label>
          <div className="flex items-center gap-3 mt-1"><Input type="range" min={1} max={30} value={form.deadlineAlertDays} onChange={(e) => setForm({ ...form, deadlineAlertDays: parseInt(e.target.value) })} className="flex-1" /><span className="text-sm font-medium text-gray-700 w-12">{form.deadlineAlertDays}d</span></div></div>
        <div><Label>Inactivity Alert Days</Label>
          <div className="flex items-center gap-3 mt-1"><Input type="range" min={14} max={90} value={form.inactivityAlertDays} onChange={(e) => setForm({ ...form, inactivityAlertDays: parseInt(e.target.value) })} className="flex-1" /><span className="text-sm font-medium text-gray-700 w-12">{form.inactivityAlertDays}d</span></div></div>
      </div>

      {/* Compliance */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Compliance</h2>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-700">Conflict Auto-Check</p><p className="text-xs text-gray-400">Check opposing parties against client list</p></div>
          <Switch checked={form.conflictAutoCheck} onCheckedChange={(v) => setForm({ ...form, conflictAutoCheck: v })} /></div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Notifications</h2>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-700">Notify on Critical Alerts</p></div>
          <Switch checked={form.notifyOnCritical} onCheckedChange={(v) => setForm({ ...form, notifyOnCritical: v })} /></div>
        <div><Label>Notification Email</Label><Input type="email" value={form.notifyEmail} onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })} className="mt-1" placeholder="alerts@yourfirm.com" /></div>
      </div>

      <Button className="bg-blue-500 hover:bg-blue-600 w-full" onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Settings
      </Button>
    </div>
  );
}
