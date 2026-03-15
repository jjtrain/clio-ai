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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Save,
  TestTube,
  Phone,
  Shield,
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

export default function MessagingSettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.messaging.getSettings.useQuery();

  const [form, setForm] = useState({
    isEnabled: true,
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    defaultSignature: "",
    autoReplyEnabled: false,
    autoReplyMessage: "",
    autoReplyOutsideHours: false,
    businessHours: "",
    messageRetentionDays: 365,
    requireConsent: true,
    consentMessage: "You are receiving this message from {FIRM_NAME}. Reply STOP to opt out.",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        isEnabled: settings.isEnabled ?? true,
        twilioAccountSid: settings.twilioAccountSid || "",
        twilioAuthToken: settings.twilioAuthToken || "",
        twilioPhoneNumber: settings.twilioPhoneNumber || "",
        defaultSignature: settings.defaultSignature || "",
        autoReplyEnabled: settings.autoReplyEnabled ?? false,
        autoReplyMessage: settings.autoReplyMessage || "",
        autoReplyOutsideHours: settings.autoReplyOutsideHours ?? false,
        businessHours: settings.businessHours || "",
        messageRetentionDays: settings.messageRetentionDays ?? 365,
        requireConsent: settings.requireConsent ?? true,
        consentMessage: settings.consentMessage || "You are receiving this message from {FIRM_NAME}. Reply STOP to opt out.",
      });
    }
  }, [settings]);

  const updateSettings = trpc.messaging.updateSettings.useMutation({
    onSuccess: () => {
      toast({ title: "Settings saved" });
      utils.messaging.getSettings.invalidate();
    },
    onError: (err) => {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    },
  });

  const testConnection = trpc.messaging.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.connected) {
        toast({ title: "Connected!", description: `Phone: ${data.phoneNumber || "OK"}` });
      } else {
        toast({ title: "Connection failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (err) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: stats } = trpc.messaging.getStats.useQuery();

  const handleSave = () => {
    const data: any = { ...form };
    if (data.twilioAuthToken?.startsWith("••")) {
      delete data.twilioAuthToken;
    }
    updateSettings.mutate(data);
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/messaging">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Messaging Settings</h1>
            <p className="text-muted-foreground">Configure Twilio SMS integration</p>
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

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{stats.conversations}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalSent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.totalReceived}</p>
              <p className="text-xs text-muted-foreground">Received</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.totalFailed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Text Messaging
              </CardTitle>
              <CardDescription>Enable or disable SMS messaging</CardDescription>
            </div>
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Twilio Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Twilio Configuration
          </CardTitle>
          <CardDescription>
            Enter your Twilio credentials. Get them from your{" "}
            <span className="font-medium">Twilio Console</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account SID</Label>
            <Input
              value={form.twilioAccountSid}
              onChange={(e) => setForm({ ...form, twilioAccountSid: e.target.value })}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div className="space-y-2">
            <Label>Auth Token</Label>
            <Input
              type="password"
              value={form.twilioAuthToken}
              onChange={(e) => setForm({ ...form, twilioAuthToken: e.target.value })}
              placeholder="Enter auth token"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={form.twilioPhoneNumber}
              onChange={(e) => setForm({ ...form, twilioPhoneNumber: e.target.value })}
              placeholder="+15551234567"
            />
            <p className="text-xs text-muted-foreground">
              Your Twilio phone number in E.164 format
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isLoading}
            >
              {testConnection.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            {testConnection.data?.connected && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Connected
              </Badge>
            )}
            {testConnection.data && !testConnection.data.connected && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Failed
              </Badge>
            )}
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <p className="font-medium">Webhook URLs</p>
            <p className="text-xs mt-1">Configure these in your Twilio phone number settings:</p>
            <div className="mt-2 space-y-1 text-xs font-mono">
              <p>Incoming: <span className="select-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/twilio/webhook</span></p>
              <p>Status: <span className="select-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/twilio/status</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Message Defaults</CardTitle>
          <CardDescription>Default signature and auto-reply settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Signature</Label>
            <Input
              value={form.defaultSignature}
              onChange={(e) => setForm({ ...form, defaultSignature: e.target.value })}
              placeholder="- Your Law Firm"
            />
            <p className="text-xs text-muted-foreground">
              Appended to every outbound message
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Reply */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Auto-Reply
              </CardTitle>
              <CardDescription>Automatically reply to incoming messages</CardDescription>
            </div>
            <Switch
              checked={form.autoReplyEnabled}
              onCheckedChange={(checked) => setForm({ ...form, autoReplyEnabled: checked })}
            />
          </div>
        </CardHeader>
        {form.autoReplyEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Auto-Reply Message</Label>
              <Textarea
                value={form.autoReplyMessage}
                onChange={(e) => setForm({ ...form, autoReplyMessage: e.target.value })}
                rows={3}
                placeholder="Thank you for your message. We will get back to you shortly."
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Only Outside Business Hours</Label>
                <p className="text-xs text-muted-foreground">
                  Only send auto-replies outside business hours
                </p>
              </div>
              <Switch
                checked={form.autoReplyOutsideHours}
                onCheckedChange={(checked) => setForm({ ...form, autoReplyOutsideHours: checked })}
              />
            </div>
            {form.autoReplyOutsideHours && (
              <div className="space-y-2">
                <Label>Business Hours (JSON)</Label>
                <Input
                  value={form.businessHours}
                  onChange={(e) => setForm({ ...form, businessHours: e.target.value })}
                  placeholder='{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}'
                />
                <p className="text-xs text-muted-foreground">
                  JSON format: start/end times, days (0=Sun, 6=Sat)
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance
          </CardTitle>
          <CardDescription>TCPA and consent settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Consent Message</Label>
              <p className="text-xs text-muted-foreground">
                Send a consent message before the first outbound text
              </p>
            </div>
            <Switch
              checked={form.requireConsent}
              onCheckedChange={(checked) => setForm({ ...form, requireConsent: checked })}
            />
          </div>
          {form.requireConsent && (
            <div className="space-y-2">
              <Label>Consent Message</Label>
              <Textarea
                value={form.consentMessage}
                onChange={(e) => setForm({ ...form, consentMessage: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{FIRM_NAME}"} as a placeholder
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Message Retention (days)</Label>
            <Input
              type="number"
              value={form.messageRetentionDays}
              onChange={(e) => setForm({ ...form, messageRetentionDays: parseInt(e.target.value) || 365 })}
            />
            <p className="text-xs text-muted-foreground">
              How long to keep message records (0 = forever)
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <p className="font-medium">STOP/START Compliance</p>
            <p className="text-xs mt-1">
              When a client texts STOP, they are automatically opted out and no further
              messages will be sent. Texting START re-enables messaging.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
