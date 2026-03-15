"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Shield } from "lucide-react";

export default function PortalSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = trpc.clientPortal.getSettings.useQuery();
  const updateSettings = trpc.clientPortal.updateSettings.useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [isEnabled, setIsEnabled] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [allowMessaging, setAllowMessaging] = useState(true);
  const [allowDocumentView, setAllowDocumentView] = useState(true);
  const [allowPayments, setAllowPayments] = useState(true);
  const [allowAppointmentView, setAllowAppointmentView] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setFirmName(settings.firmName || "");
      setPrimaryColor(settings.primaryColor);
      setWelcomeMessage(settings.welcomeMessage || "");
      setAllowMessaging(settings.allowMessaging);
      setAllowDocumentView(settings.allowDocumentView);
      setAllowPayments(settings.allowPayments);
      setAllowAppointmentView(settings.allowAppointmentView);
      setSessionTimeoutMinutes(settings.sessionTimeoutMinutes);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      isEnabled,
      firmName: firmName || undefined,
      primaryColor,
      welcomeMessage: welcomeMessage || undefined,
      allowMessaging,
      allowDocumentView,
      allowPayments,
      allowAppointmentView,
      sessionTimeoutMinutes,
    });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client-portal"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Portal Settings</h1>
            <p className="text-gray-500">Configure client portal behavior and appearance</p>
          </div>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Enable Client Portal</h2>
            <p className="text-sm text-gray-500">Allow clients to log in and view their matters, documents, and invoices</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">Branding</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Firm Name</Label>
            <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="Your firm name" />
          </div>
          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="flex gap-2">
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#1E40AF" className="flex-1" />
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-11 h-11 rounded border cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Welcome Message</Label>
          <Textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={3} placeholder="Welcome to our client portal..." />
        </div>
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">Portal Features</h2>
        <p className="text-sm text-gray-500">Choose which features clients can access</p>
        <div className="space-y-3">
          {[
            { label: "Secure Messaging", desc: "Clients can send and receive messages", checked: allowMessaging, set: setAllowMessaging },
            { label: "Document Viewing", desc: "Clients can view documents in their matters", checked: allowDocumentView, set: setAllowDocumentView },
            { label: "Invoice & Payments", desc: "Clients can view invoices and payment status", checked: allowPayments, set: setAllowPayments },
            { label: "Appointments", desc: "Clients can view upcoming appointments", checked: allowAppointmentView, set: setAllowAppointmentView },
          ].map((feat) => (
            <label key={feat.label} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
              <div>
                <p className="text-sm font-medium">{feat.label}</p>
                <p className="text-xs text-gray-400">{feat.desc}</p>
              </div>
              <input type="checkbox" checked={feat.checked} onChange={(e) => feat.set(e.target.checked)} className="rounded border-gray-300" />
            </label>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">Security</h2>
        <div className="space-y-2">
          <Label>Session Timeout (minutes)</Label>
          <Input
            type="number"
            min={5}
            max={1440}
            value={sessionTimeoutMinutes}
            onChange={(e) => setSessionTimeoutMinutes(parseInt(e.target.value) || 60)}
            className="max-w-[200px]"
          />
          <p className="text-xs text-gray-400">Clients will be logged out after this period of inactivity</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="h-4 w-4 mr-2" /> {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
