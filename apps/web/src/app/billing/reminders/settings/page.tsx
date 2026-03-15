"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, RotateCcw, Loader2 } from "lucide-react";

export default function ReminderSettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.billingReminders.getSettings.useQuery();
  const { data: defaults } = trpc.billingReminders.getDefaultTemplates.useQuery();

  const [form, setForm] = useState({
    isEnabled: true,
    sendUpcomingReminder: true,
    sendDueDayReminder: true,
    sendPastDueReminders: true,
    pastDueSchedule: "3,7,14,30,60,90",
    defaultMethod: "EMAIL",
    escalateToPhone: false,
    includePaymentLink: true,
    includeLateFeesNotice: false,
    lateFeePercentage: 0,
    fromName: "",
    fromEmail: "",
    emailTemplateUpcoming: "",
    emailTemplateDueToday: "",
    emailTemplatePastDue: "",
    textTemplateUpcoming: "",
    textTemplateDueToday: "",
    textTemplatePastDue: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        isEnabled: settings.isEnabled ?? true,
        sendUpcomingReminder: settings.sendUpcomingReminder ?? true,
        sendDueDayReminder: settings.sendDueDayReminder ?? true,
        sendPastDueReminders: settings.sendPastDueReminders ?? true,
        pastDueSchedule: settings.pastDueSchedule || "3,7,14,30,60,90",
        defaultMethod: settings.defaultMethod || "EMAIL",
        escalateToPhone: settings.escalateToPhone ?? false,
        includePaymentLink: settings.includePaymentLink ?? true,
        includeLateFeesNotice: settings.includeLateFeesNotice ?? false,
        lateFeePercentage: settings.lateFeePercentage ? parseFloat(settings.lateFeePercentage.toString()) : 0,
        fromName: settings.fromName || "",
        fromEmail: settings.fromEmail || "",
        emailTemplateUpcoming: settings.emailTemplateUpcoming || "",
        emailTemplateDueToday: settings.emailTemplateDueToday || "",
        emailTemplatePastDue: settings.emailTemplatePastDue || "",
        textTemplateUpcoming: settings.textTemplateUpcoming || "",
        textTemplateDueToday: settings.textTemplateDueToday || "",
        textTemplatePastDue: settings.textTemplatePastDue || "",
      });
    }
  }, [settings]);

  const updateSettings = trpc.billingReminders.updateSettings.useMutation({
    onSuccess: () => {
      toast({ title: "Settings saved" });
      utils.billingReminders.getSettings.invalidate();
    },
  });

  const handleSave = () => {
    updateSettings.mutate(form);
  };

  const resetEmailTemplate = (type: "upcoming" | "dueToday" | "pastDue") => {
    if (!defaults) return;
    switch (type) {
      case "upcoming":
        setForm({ ...form, emailTemplateUpcoming: defaults.emailUpcoming.body });
        break;
      case "dueToday":
        setForm({ ...form, emailTemplateDueToday: defaults.emailDueToday.body });
        break;
      case "pastDue":
        setForm({ ...form, emailTemplatePastDue: defaults.emailPastDue.body });
        break;
    }
    toast({ title: "Template reset to default" });
  };

  const resetTextTemplate = (type: "upcoming" | "dueToday" | "pastDue") => {
    if (!defaults) return;
    switch (type) {
      case "upcoming":
        setForm({ ...form, textTemplateUpcoming: defaults.textUpcoming });
        break;
      case "dueToday":
        setForm({ ...form, textTemplateDueToday: defaults.textDueToday });
        break;
      case "pastDue":
        setForm({ ...form, textTemplatePastDue: defaults.textPastDue });
        break;
    }
    toast({ title: "Template reset to default" });
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing/reminders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reminder Settings</h1>
            <p className="text-gray-500 text-sm">Configure automated billing reminders</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isLoading}>
          {updateSettings.isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>General</CardTitle>
              <CardDescription>Enable or disable billing reminders</CardDescription>
            </div>
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Method</Label>
            <Select value={form.defaultMethod} onValueChange={(v) => setForm({ ...form, defaultMethod: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="BOTH">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="Your Firm Name"
              />
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="billing@yourfirm.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Reminder Schedule</CardTitle>
          <CardDescription>Choose when to send reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Upcoming Due (3 days before)</Label>
              <p className="text-xs text-muted-foreground">Send a friendly reminder before the due date</p>
            </div>
            <Switch
              checked={form.sendUpcomingReminder}
              onCheckedChange={(checked) => setForm({ ...form, sendUpcomingReminder: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Due Day Reminder</Label>
              <p className="text-xs text-muted-foreground">Send a reminder on the due date</p>
            </div>
            <Switch
              checked={form.sendDueDayReminder}
              onCheckedChange={(checked) => setForm({ ...form, sendDueDayReminder: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Past Due Reminders</Label>
              <p className="text-xs text-muted-foreground">Send graduated reminders after the due date</p>
            </div>
            <Switch
              checked={form.sendPastDueReminders}
              onCheckedChange={(checked) => setForm({ ...form, sendPastDueReminders: checked })}
            />
          </div>
          {form.sendPastDueReminders && (
            <div className="space-y-2">
              <Label>Past Due Schedule (days)</Label>
              <Input
                value={form.pastDueSchedule}
                onChange={(e) => setForm({ ...form, pastDueSchedule: e.target.value })}
                placeholder="3,7,14,30,60,90"
              />
              <p className="text-xs text-muted-foreground">Comma-separated days after due date</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label>Include Payment Link</Label>
              <p className="text-xs text-muted-foreground">Add a link to pay online in reminders</p>
            </div>
            <Switch
              checked={form.includePaymentLink}
              onCheckedChange={(checked) => setForm({ ...form, includePaymentLink: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Escalation */}
      <Card>
        <CardHeader>
          <CardTitle>Escalation</CardTitle>
          <CardDescription>Actions for severely overdue invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Create Phone Call Task</Label>
              <p className="text-xs text-muted-foreground">Create a task to call the client after 30 days overdue</p>
            </div>
            <Switch
              checked={form.escalateToPhone}
              onCheckedChange={(checked) => setForm({ ...form, escalateToPhone: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Late Fees */}
      <Card>
        <CardHeader>
          <CardTitle>Late Fees</CardTitle>
          <CardDescription>Optional late fee notice in reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Include Late Fees Notice</Label>
              <p className="text-xs text-muted-foreground">Mention potential late fees in past-due reminders</p>
            </div>
            <Switch
              checked={form.includeLateFeesNotice}
              onCheckedChange={(checked) => setForm({ ...form, includeLateFeesNotice: checked })}
            />
          </div>
          {form.includeLateFeesNotice && (
            <div className="space-y-2">
              <Label>Late Fee Percentage</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.lateFeePercentage}
                onChange={(e) => setForm({ ...form, lateFeePercentage: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>
            Customize email content. Placeholders: {"{CLIENT_NAME}"}, {"{INVOICE_NUMBER}"}, {"{AMOUNT_DUE}"}, {"{DUE_DATE}"}, {"{DAYS_OVERDUE}"}, {"{FIRM_NAME}"}, {"{PAYMENT_LINK}"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="dueToday">Due Today</TabsTrigger>
              <TabsTrigger value="pastDue">Past Due</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="space-y-3 mt-4">
              <Textarea
                rows={8}
                value={form.emailTemplateUpcoming}
                onChange={(e) => setForm({ ...form, emailTemplateUpcoming: e.target.value })}
                placeholder="HTML email template..."
              />
              <Button variant="outline" size="sm" onClick={() => resetEmailTemplate("upcoming")}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Default
              </Button>
            </TabsContent>
            <TabsContent value="dueToday" className="space-y-3 mt-4">
              <Textarea
                rows={8}
                value={form.emailTemplateDueToday}
                onChange={(e) => setForm({ ...form, emailTemplateDueToday: e.target.value })}
                placeholder="HTML email template..."
              />
              <Button variant="outline" size="sm" onClick={() => resetEmailTemplate("dueToday")}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Default
              </Button>
            </TabsContent>
            <TabsContent value="pastDue" className="space-y-3 mt-4">
              <Textarea
                rows={8}
                value={form.emailTemplatePastDue}
                onChange={(e) => setForm({ ...form, emailTemplatePastDue: e.target.value })}
                placeholder="HTML email template..."
              />
              <Button variant="outline" size="sm" onClick={() => resetEmailTemplate("pastDue")}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Default
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Text Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Text Message Templates</CardTitle>
          <CardDescription>SMS templates for text reminders</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="dueToday">Due Today</TabsTrigger>
              <TabsTrigger value="pastDue">Past Due</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="space-y-3 mt-4">
              <Textarea
                rows={3}
                value={form.textTemplateUpcoming}
                onChange={(e) => setForm({ ...form, textTemplateUpcoming: e.target.value })}
                placeholder="SMS template..."
              />
              <Button variant="outline" size="sm" onClick={() => resetTextTemplate("upcoming")}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Default
              </Button>
            </TabsContent>
            <TabsContent value="dueToday" className="space-y-3 mt-4">
              <Textarea
                rows={3}
                value={form.textTemplateDueToday}
                onChange={(e) => setForm({ ...form, textTemplateDueToday: e.target.value })}
                placeholder="SMS template..."
              />
              <Button variant="outline" size="sm" onClick={() => resetTextTemplate("dueToday")}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Default
              </Button>
            </TabsContent>
            <TabsContent value="pastDue" className="space-y-3 mt-4">
              <Textarea
                rows={3}
                value={form.textTemplatePastDue}
                onChange={(e) => setForm({ ...form, textTemplatePastDue: e.target.value })}
                placeholder="SMS template..."
              />
              <Button variant="outline" size="sm" onClick={() => resetTextTemplate("pastDue")}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Default
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
