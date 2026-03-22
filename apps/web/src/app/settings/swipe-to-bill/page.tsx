"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Settings } from "lucide-react";

export default function SwipeToBillSettingsPage() {
  const settings = trpc.swipeToBill["settings.get"].useQuery();
  const update = trpc.swipeToBill["settings.update"].useMutation({ onSuccess: () => settings.refetch() });

  const [form, setForm] = useState({
    detectPhoneCalls: true, detectVideoMeetings: true, detectSms: true, detectCalendar: true,
    detectVoiceNotes: true, detectEmails: true, minCallDuration: 60, minMeetingDuration: 300,
    notificationDelay: 30, expirationHours: 48, snoozeDuration: 30, maxSnoozeCount: 3,
    quietHoursStart: "22:00", quietHoursEnd: "07:00", weekendNotifications: false,
    billingIncrement: 6, roundingRule: "ROUND_UP" as string, minBillableMinutes: 3,
    aiNarrative: true, aiMatterMatching: true,
  });

  useEffect(() => {
    if (settings.data) setForm((prev) => ({ ...prev, ...(settings.data as any) }));
  }, [settings.data]);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) => setForm((p) => ({ ...p, [key]: val }));

  const toggles: { key: keyof typeof form; label: string }[] = [
    { key: "detectPhoneCalls", label: "Phone Calls" }, { key: "detectVideoMeetings", label: "Video Meetings" }, { key: "detectSms", label: "SMS" },
    { key: "detectCalendar", label: "Calendar Events" }, { key: "detectVoiceNotes", label: "Voice Notes" }, { key: "detectEmails", label: "Emails" },
  ];

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <div><h1 className="text-2xl font-bold">Swipe-to-Bill Settings</h1>
          <p className="text-muted-foreground">Configure event detection, notifications, and billing defaults</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle>Event Detection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {toggles.map((t) => (
              <div key={t.key} className="flex items-center justify-between rounded-md border p-3">
                <Label>{t.label}</Label>
                <Switch checked={form[t.key] as boolean} onCheckedChange={(v) => set(t.key, v)} />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Minimum Call Duration: {form.minCallDuration}s</Label>
            <input type="range" min={30} max={300} step={10} value={form.minCallDuration} onChange={(e) => set("minCallDuration", Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-2">
            <Label>Minimum Meeting Duration: {form.minMeetingDuration}s</Label>
            <input type="range" min={60} max={900} step={30} value={form.minMeetingDuration} onChange={(e) => set("minMeetingDuration", Number(e.target.value))} className="w-full" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Notification Delay (seconds)</Label>
              <Input type="number" value={form.notificationDelay} onChange={(e) => set("notificationDelay", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expiration Time (hours)</Label>
              <Input type="number" value={form.expirationHours} onChange={(e) => set("expirationHours", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Snooze Duration (minutes)</Label>
              <Input type="number" value={form.snoozeDuration} onChange={(e) => set("snoozeDuration", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max Snooze Count</Label>
              <Input type="number" value={form.maxSnoozeCount} onChange={(e) => set("maxSnoozeCount", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quiet Hours Start</Label>
              <Input type="time" value={form.quietHoursStart} onChange={(e) => set("quietHoursStart", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quiet Hours End</Label>
              <Input type="time" value={form.quietHoursEnd} onChange={(e) => set("quietHoursEnd", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Weekend Notifications</Label>
            <Switch checked={form.weekendNotifications} onCheckedChange={(v) => set("weekendNotifications", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Billing Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Billing Increment</Label>
              <Select value={String(form.billingIncrement)} onValueChange={(v) => set("billingIncrement", +v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rounding Rule</Label>
              <Select value={form.roundingRule} onValueChange={(v) => set("roundingRule", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUND_UP">Round Up</SelectItem>
                  <SelectItem value="ROUND_DOWN">Round Down</SelectItem>
                  <SelectItem value="ROUND_NEAREST">Round Nearest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Minimum Billable Minutes</Label>
              <Input type="number" value={form.minBillableMinutes} onChange={(e) => set("minBillableMinutes", +e.target.value)} />
            </div>
          </div>
          {[{ key: "aiNarrative" as const, label: "AI-Generated Narratives" }, { key: "aiMatterMatching" as const, label: "AI Matter Matching" }].map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-md border p-3">
              <Label>{t.label}</Label>
              <Switch checked={form[t.key] as boolean} onCheckedChange={(v) => set(t.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => update.mutate(form)} disabled={update.isPending}>
          <Save className="mr-2 h-4 w-4" /> {update.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
