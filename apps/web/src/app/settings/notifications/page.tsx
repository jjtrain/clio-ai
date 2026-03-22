"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Smartphone, Save, Monitor } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Prefs = {
  pushEnabled: boolean;
  deadlineAlerts: boolean;
  deadlineAlertDays: string;
  solAlerts: boolean;
  solAlertDays: string;
  courtDateAlerts: boolean;
  courtDateAlertDays: string;
  taskDueAlerts: boolean;
  taskDueAlertDays: string;
  newLeadAlerts: boolean;
  paymentReceived: boolean;
  signatureCompleted: boolean;
  courtRuleAlerts: boolean;
  billingAlerts: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  channelSms: boolean;
  smsPhone: string;
  dailyDigest: boolean;
  dailyDigestTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  weekendAlerts: boolean;
  urgentOverride: boolean;
};

const defaults: Prefs = {
  pushEnabled: false, deadlineAlerts: true, deadlineAlertDays: "30,14,7,3,1",
  solAlerts: true, solAlertDays: "90,60,30,14,7,3,1", courtDateAlerts: true,
  courtDateAlertDays: "14,7,3,1", taskDueAlerts: true, taskDueAlertDays: "3,1",
  newLeadAlerts: true, paymentReceived: true, signatureCompleted: true,
  courtRuleAlerts: true, billingAlerts: true, channelPush: true,
  channelEmail: true, channelSms: false, smsPhone: "", dailyDigest: false,
  dailyDigestTime: "08:00", quietHoursStart: "22:00", quietHoursEnd: "07:00",
  weekendAlerts: false, urgentOverride: true,
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const { data, isLoading } = trpc.notifications["getPreferences"].useQuery({ userId: "current-user" });
  const { data: subs } = trpc.notifications["getSubscriptions"].useQuery({ userId: "current-user" });
  const save = trpc.notifications["updatePreferences"].useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
  });
  const testPush = trpc.notifications["testPush"].useMutation({
    onSuccess: () => toast({ title: "Test notification sent" }),
  });

  useEffect(() => {
    if (data) setPrefs((p) => ({ ...p, ...(data as any) }));
  }, [data]);

  const set = <K extends keyof Prefs>(key: K, val: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: val }));

  if (isLoading) return <p className="p-6 text-center text-muted-foreground">Loading...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Notification Settings</h1>

      {/* Push Notifications */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Push Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="Push notifications" checked={prefs.pushEnabled} onChange={(v) => set("pushEnabled", v)} />
          <Button variant="outline" size="sm" disabled={testPush.isPending} onClick={() => testPush.mutate({ userId: "current-user" })}>
            <Send className="mr-2 h-4 w-4" />Test Push
          </Button>
          {subs && subs.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs text-muted-foreground">Registered devices</Label>
              {(subs as any[]).map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span>{s.browser}</span>
                  <Badge variant="outline" className="ml-auto text-xs">{s.lastUsed}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Categories */}
      <Card>
        <CardHeader><CardTitle>Alert Categories</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {([
            ["deadlineAlerts", "Deadline Alerts", "deadlineAlertDays"],
            ["solAlerts", "SOL Alerts", "solAlertDays"],
            ["courtDateAlerts", "Court Date Alerts", "courtDateAlertDays"],
            ["taskDueAlerts", "Task Due Alerts", "taskDueAlertDays"],
          ] as const).map(([key, label, daysKey]) => (
            <div key={key} className="space-y-2">
              <Toggle label={label} checked={prefs[key]} onChange={(v) => set(key, v)} />
              {prefs[key] && (
                <div className="pl-4">
                  <Label className="text-xs text-muted-foreground">Alert days (comma-separated)</Label>
                  <Input
                    className="mt-1"
                    value={prefs[daysKey]}
                    onChange={(e) => set(daysKey, e.target.value)}
                    placeholder="e.g. 30,14,7,3,1"
                  />
                </div>
              )}
            </div>
          ))}
          <hr className="my-4 border-gray-200" />
          <Toggle label="New Lead Alerts" checked={prefs.newLeadAlerts} onChange={(v) => set("newLeadAlerts", v)} />
          <Toggle label="Payment Received" checked={prefs.paymentReceived} onChange={(v) => set("paymentReceived", v)} />
          <Toggle label="Signature Completed" checked={prefs.signatureCompleted} onChange={(v) => set("signatureCompleted", v)} />
          <Toggle label="Court Rule Alerts" checked={prefs.courtRuleAlerts} onChange={(v) => set("courtRuleAlerts", v)} />
          <Toggle label="Billing Alerts" checked={prefs.billingAlerts} onChange={(v) => set("billingAlerts", v)} />
        </CardContent>
      </Card>

      {/* Delivery Channels */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Delivery Channels</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="Push" checked={prefs.channelPush} onChange={(v) => set("channelPush", v)} />
          <Toggle label="Email" checked={prefs.channelEmail} onChange={(v) => set("channelEmail", v)} />
          <Toggle label="SMS" checked={prefs.channelSms} onChange={(v) => set("channelSms", v)} />
          {prefs.channelSms && (
            <div className="pl-4">
              <Label className="text-xs text-muted-foreground">Phone number</Label>
              <Input className="mt-1" value={prefs.smsPhone} onChange={(e) => set("smsPhone", e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="Daily digest" checked={prefs.dailyDigest} onChange={(v) => set("dailyDigest", v)} />
          {prefs.dailyDigest && (
            <div className="pl-4">
              <Label className="text-xs text-muted-foreground">Digest time</Label>
              <Input className="mt-1 w-36" type="time" value={prefs.dailyDigestTime} onChange={(e) => set("dailyDigestTime", e.target.value)} />
            </div>
          )}
          <hr className="my-4 border-gray-200" />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quiet hours</Label>
            <div className="flex items-center gap-2 pl-4">
              <Input className="w-32" type="time" value={prefs.quietHoursStart} onChange={(e) => set("quietHoursStart", e.target.value)} />
              <span className="text-muted-foreground">to</span>
              <Input className="w-32" type="time" value={prefs.quietHoursEnd} onChange={(e) => set("quietHoursEnd", e.target.value)} />
            </div>
          </div>
          <Toggle label="Weekend alerts" checked={prefs.weekendAlerts} onChange={(v) => set("weekendAlerts", v)} />
          <Toggle label="Urgent overrides quiet hours" checked={prefs.urgentOverride} onChange={(v) => set("urgentOverride", v)} />
        </CardContent>
      </Card>

      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate({ userId: "current-user", ...prefs } as any)}>
        <Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
