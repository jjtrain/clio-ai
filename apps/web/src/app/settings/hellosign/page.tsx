"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Save,
  PenTool,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wifi,
  Loader2,
} from "lucide-react";

export default function HelloSignSettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = trpc.signatures.getHelloSignSettings.useQuery();
  const updateSettings = trpc.signatures.updateHelloSignSettings.useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const testConnection = trpc.signatures.testHellosignConnection.useMutation();

  const [isEnabled, setIsEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [defaultFromName, setDefaultFromName] = useState("");
  const [defaultFromEmail, setDefaultFromEmail] = useState("");

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setApiKey(settings.apiKey || "");
      setClientId(settings.clientId || "");
      setTestMode(settings.testMode);
      setCallbackUrl(settings.callbackUrl || "");
      setWebhookSecret(settings.webhookSecret || "");
      setDefaultFromName(settings.defaultFromName || "");
      setDefaultFromEmail(settings.defaultFromEmail || "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      isEnabled,
      apiKey: apiKey || undefined,
      clientId: clientId || undefined,
      testMode,
      callbackUrl: callbackUrl || undefined,
      webhookSecret: webhookSecret || undefined,
      defaultFromName: defaultFromName || undefined,
      defaultFromEmail: defaultFromEmail || undefined,
    });
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync();
      if (result.success) {
        toast({ title: "Connection successful", description: `Connected as ${result.account?.email_address || "your account"}` });
      } else {
        toast({ title: "Connection failed", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <PenTool className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">HelloSign Integration</h1>
            <p className="text-gray-500">Connect Dropbox Sign (HelloSign) for e-signatures</p>
          </div>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Enable HelloSign</h2>
            <p className="text-sm text-gray-500">When enabled, signature requests can be sent through HelloSign for legally binding e-signatures</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">API Configuration</h2>
        <p className="text-sm text-gray-500">
          Get your API key from the{" "}
          <a href="https://app.hellosign.com/home/myAccount#api" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
            HelloSign Dashboard <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your HelloSign API key"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testConnection.isPending || !apiKey || apiKey.startsWith("••")}
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Test
              </Button>
            </div>
            <p className="text-xs text-gray-400">Your API key is stored encrypted and never exposed to the client</p>
          </div>

          <div className="space-y-1">
            <Label>Client ID <span className="text-xs text-gray-400">(for embedded signing)</span></Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="HelloSign Client ID for embedded signing"
            />
            <p className="text-xs text-gray-400">Required for embedded signing. Get it from your HelloSign API settings</p>
          </div>

          <div className="space-y-1">
            <Label>Webhook Callback URL <span className="text-xs text-gray-400">(auto-configured)</span></Label>
            <Input
              value={callbackUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/api/hellosign/webhook`}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://your-domain.com/api/hellosign/webhook"
            />
            <p className="text-xs text-gray-400">HelloSign will send signature events to this URL. Set this in your HelloSign account settings too</p>
          </div>

          <div className="space-y-1">
            <Label>Webhook Secret <span className="text-xs text-gray-400">(optional)</span></Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Used for HMAC verification of webhook events"
            />
            <p className="text-xs text-gray-400">If set, webhook events will be verified using HMAC-SHA256</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="rounded border-gray-300"
            />
            Test Mode <span className="text-xs text-gray-400">(signatures are not legally binding)</span>
          </label>
        </div>
      </div>

      {/* Sender Defaults */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold">Sender Defaults</h2>
        <p className="text-sm text-gray-500">Default sender information for HelloSign signature requests</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Default From Name</Label>
            <Input
              value={defaultFromName}
              onChange={(e) => setDefaultFromName(e.target.value)}
              placeholder="Your Firm Name"
            />
          </div>
          <div className="space-y-1">
            <Label>Default From Email</Label>
            <Input
              type="email"
              value={defaultFromEmail}
              onChange={(e) => setDefaultFromEmail(e.target.value)}
              placeholder="signing@yourfirm.com"
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${
        isEnabled && apiKey && !apiKey.startsWith("••••") && apiKey.length > 5
          ? "bg-green-50 border-green-200"
          : isEnabled && settings?.apiKey
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
      }`}>
        {(isEnabled && (settings?.apiKey || (apiKey && !apiKey.startsWith("••••")))) ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">HelloSign is configured</p>
              <p className="text-xs text-green-600">
                {testMode ? "Running in test mode — signatures are not legally binding" : "Running in production mode"}
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">HelloSign is not configured</p>
              <p className="text-xs text-amber-600">Add your API key to enable HelloSign signing</p>
            </div>
          </>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold mb-3">How It Works</h2>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Create a signature request from the E-Signatures section</li>
          <li>Choose &quot;Send via HelloSign&quot; instead of the built-in signing</li>
          <li>HelloSign sends the signer a secure email with a signing link</li>
          <li>The signer reviews and signs the document in the HelloSign interface</li>
          <li>HelloSign notifies us via webhook when the document is signed</li>
          <li>Download the signed PDF from the signature request detail page</li>
        </ol>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          <Save className="h-4 w-4 mr-2" /> {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
